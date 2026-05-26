package com.hotel.hotel_backend.service;

import com.hotel.hotel_backend.config.PaymentProperties;
import com.hotel.hotel_backend.dto.request.SepayWebhookRequest;
import com.hotel.hotel_backend.dto.response.PaymentSessionResponse;
import com.hotel.hotel_backend.dto.response.SepayWebhookResponse;
import com.hotel.hotel_backend.entity.Booking;
import com.hotel.hotel_backend.entity.BookingStatus;
import com.hotel.hotel_backend.entity.PaymentMethod;
import com.hotel.hotel_backend.entity.PaymentTransaction;
import com.hotel.hotel_backend.entity.PaymentTransactionStatus;
import com.hotel.hotel_backend.exeption.ApiException;
import com.hotel.hotel_backend.exeption.ErrorCode;
import com.hotel.hotel_backend.repository.BookingRepository;
import com.hotel.hotel_backend.repository.PaymentTransactionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import tools.jackson.databind.ObjectMapper;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
/*
 * Service điều phối thanh toán VietQR/SePay.
 *
 * Nguyên tắc chính:
 * - Frontend chỉ hiển thị QR và mã chuyển khoản, không tự xác nhận thanh toán.
 * - Webhook SePay là nguồn xác nhận giao dịch thật.
 * - Mỗi booking pending có một paymentCode riêng để match giao dịch ngân hàng.
 * - Mọi bước webhook phải idempotent vì provider có thể gửi cùng webhook nhiều lần.
 */
public class BookingPaymentGatewayService {

    private static final String GATEWAY_SEPAY = "SEPAY";
    private static final DateTimeFormatter SEPAY_DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final BookingRepository bookingRepository;
    private final PaymentTransactionRepository paymentTransactionRepository;
    private final BookingExpirationService bookingExpirationService;
    private final PaymentProperties paymentProperties;
    private final ObjectMapper objectMapper;

    /*
     * Tạo phiên thanh toán cho booking đang PENDING_PAYMENT.
     *
     * Hàm này không confirm booking và không gọi SePay. Nó chỉ tạo dữ liệu để
     * frontend hiển thị cho customer: số tiền, QR, tài khoản nhận tiền và
     * paymentCode cần ghi trong nội dung chuyển khoản.
     *
     * Nếu customer reload trang payment nhiều lần, ta reuse PENDING transaction
     * còn hạn để không đổi paymentCode giữa chừng. Điều này tránh việc khách
     * đang nhìn mã cũ nhưng backend lại sinh mã mới.
     */
    @Transactional
    public PaymentSessionResponse createPaymentSession(Long userId, Long bookingId) {
        Booking booking = loadOwnedBooking(userId, bookingId);
        booking = bookingExpirationService.expirePendingBookingIfNeeded(booking);
        if (booking.getStatus() != BookingStatus.PENDING_PAYMENT) {
            throw new ApiException(ErrorCode.CONFLICT, "Booking is not waiting for payment");
        }

        PaymentTransaction pendingTransaction = paymentTransactionRepository
                .findTopByBookingIdAndMethodAndStatusOrderByCreatedAtDesc(
                        bookingId,
                        PaymentMethod.VIETQR_SEPAY,
                        PaymentTransactionStatus.PENDING
                )
                .filter(transaction -> StringUtils.hasText(transaction.getPaymentCode()))
                .filter(transaction -> !isExpired(transaction.getExpiresAt()))
                .orElse(null);

        if (pendingTransaction != null) {
            return toPaymentSessionResponse(pendingTransaction);
        }

        /*
         * Tạo transaction PENDING làm "lời hứa thanh toán".
         * Transaction này chỉ chuyển sang SUCCESS khi webhook SePay báo có tiền vào
         * và số tiền/nội dung chuyển khoản khớp với booking.
         */
        PaymentTransaction transaction = PaymentTransaction.builder()
                .booking(booking)
                .method(PaymentMethod.VIETQR_SEPAY)
                .status(PaymentTransactionStatus.PENDING)
                .amount(booking.getTotalPrice())
                .providerReference("SEPAY-" + UUID.randomUUID())
                .clientRequestId("sepay-session-" + UUID.randomUUID())
                .paymentCode(generatePaymentCode(booking.getId()))
                .gateway(GATEWAY_SEPAY)
                .expiresAt(booking.getExpiresAt())
                .build();

        return toPaymentSessionResponse(paymentTransactionRepository.save(transaction));
    }

    /*
     * Xử lý webhook từ SePay.
     *
     * SePay gọi endpoint này sau khi tài khoản nhận tiền phát sinh giao dịch.
     * Backend phải kiểm tra theo thứ tự:
     * 1. API key hợp lệ.
     * 2. Đây là giao dịch tiền vào.
     * 3. Webhook chưa từng được xử lý.
     * 4. Tìm được paymentCode trong payload.
     * 5. Số tiền khớp.
     * 6. Booking vẫn còn PENDING_PAYMENT.
     *
     * Chỉ khi đủ các điều kiện trên mới đổi booking sang CONFIRMED.
     */
    @Transactional
    public SepayWebhookResponse handleSepayWebhook(String authorizationHeader, SepayWebhookRequest request) {
        verifyWebhookApiKey(authorizationHeader);


        //Dòng này convert object request thành JSON string để lát nữa lưu vào transaction:
        String rawPayload = toRawPayload(request);


        /*
         * Chỉ xử lý giao dịch tiền vào. Với tiền ra hoặc loại giao dịch không liên quan,
         * trả success=true để SePay không retry vô ích.
         */
        if (!"in".equalsIgnoreCase(normalize(request.transferType()))) {
            log.info("Ignored SePay webhook transferType={} referenceCode={}", request.transferType(), request.referenceCode());
            return new SepayWebhookResponse(true);
        }

        /*
         * Idempotency cấp gateway: nếu cùng id SePay đã được lưu trước đó thì bỏ qua.
         * Đây là lớp bảo vệ quan trọng khi SePay retry webhook do timeout/mạng chập chờn.
         */
        //Nếu request.id() bằng null thì gán gatewayTransactionId = null, còn nếu không null thì chuyển request.id() thành String rồi gán vào gatewayTransactionId.
        String gatewayTransactionId = request.id() == null ? null : String.valueOf(request.id());
        if (StringUtils.hasText(gatewayTransactionId)) {
            Optional<PaymentTransaction> existingGatewayTransaction =
                    paymentTransactionRepository.findByGatewayTransactionId(gatewayTransactionId);
            if (existingGatewayTransaction.isPresent()) {
                log.info("Ignored duplicate SePay webhook id={}", gatewayTransactionId);
                return new SepayWebhookResponse(true);
            }
        }

        /*
         * Payment code là cầu nối giữa giao dịch ngân hàng và booking.
         * SePay có thể gửi code riêng nếu nhận diện được; nếu không, ta parse từ
         * content/description vì customer có thể nhập paymentCode trong nội dung CK.
         */
        String paymentCode = resolvePaymentCode(request);
        if (!StringUtils.hasText(paymentCode)) {
            log.warn("SePay webhook has no payment code, referenceCode={}, content={}", request.referenceCode(), request.content());
            return new SepayWebhookResponse(true);
        }

        PaymentTransaction transaction = paymentTransactionRepository.findByPaymentCode(paymentCode)
                .orElse(null);
        if (transaction == null) {
            log.warn("No payment transaction matched SePay code={}, referenceCode={}", paymentCode, request.referenceCode());
            return new SepayWebhookResponse(true);
        }

        transaction.setRawPayload(rawPayload);
        transaction.setGateway(GATEWAY_SEPAY);
        transaction.setGatewayReferenceCode(request.referenceCode());

        if (transaction.getStatus() == PaymentTransactionStatus.SUCCESS) {
            attachGatewayTransactionId(transaction, gatewayTransactionId);
            return new SepayWebhookResponse(true);
        }

        /*
         * Không confirm nếu số tiền lệch. Case chuyển thiếu/dư cần xử lý thủ công,
         * vì tự động confirm sẽ làm sai doanh thu và có thể giữ phòng không đúng.
         */
        if (!amountMatches(request.transferAmount(), transaction.getAmount())) {
            transaction.setFailureReason("Payment amount mismatch");
            log.warn(
                    "SePay amount mismatch for code={}, expected={}, actual={}",
                    paymentCode,
                    transaction.getAmount(),
                    request.transferAmount()
            );
            return new SepayWebhookResponse(true);
        }

        Booking booking = bookingExpirationService.expirePendingBookingIfNeeded(transaction.getBooking());
        /*
         * Nếu booking đã hết hạn, inventory có thể đã được nhả cho người khác.
         * Vì vậy webhook đến muộn không được tự xác nhận booking; giao dịch đó
         * cần được xem như case đối soát/manual review.
         */
        if (booking.getStatus() != BookingStatus.PENDING_PAYMENT) {
            transaction.setStatus(PaymentTransactionStatus.FAILED);
            transaction.setFailureReason("Booking is not waiting for payment");
            attachGatewayTransactionId(transaction, gatewayTransactionId);
            log.warn("SePay payment arrived for non-payable booking={}, status={}", booking.getId(), booking.getStatus());
            return new SepayWebhookResponse(true);
        }

        transaction.setStatus(PaymentTransactionStatus.SUCCESS);
        transaction.setFailureReason(null);
        transaction.setPaidAt(resolvePaidAt(request.transactionDate()));
        attachGatewayTransactionId(transaction, gatewayTransactionId);

        booking.setStatus(BookingStatus.CONFIRMED);
        booking.setExpiresAt(null);
        bookingRepository.save(booking);

        log.info("Confirmed booking {} from SePay payment code={}", booking.getId(), paymentCode);
        return new SepayWebhookResponse(true);
    }

    private Booking loadOwnedBooking(Long userId, Long bookingId) {
        if (userId == null) {
            throw new ApiException(ErrorCode.UNAUTHORIZED, "User is required");
        }
        return bookingRepository.findByIdAndUserId(bookingId, userId)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Booking not found"));
    }

    private PaymentSessionResponse toPaymentSessionResponse(PaymentTransaction transaction) {
        PaymentProperties.Bank bank = paymentProperties.getBank();
        return new PaymentSessionResponse(
                transaction.getId(),
                transaction.getBooking().getId(),
                transaction.getMethod().name(),
                transaction.getStatus().name(),
                transaction.getAmount(),
                transaction.getPaymentCode(),
                transaction.getPaymentCode(),
                bank.getAccountNo(),
                bank.getAccountName(),
                bank.getBankName(),
                paymentProperties.normalizedQrImageUrl(),
                transaction.getExpiresAt()
        );
    }

    private String generatePaymentCode(Long bookingId) {
        String prefix = paymentProperties.normalizedTransferPrefix();
        for (int attempt = 0; attempt < 10; attempt++) {
            String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 6).toUpperCase(Locale.ROOT);
            // Format ngắn, không dấu, không khoảng trắng để ngân hàng/SePay dễ nhận diện.
            String paymentCode = prefix + bookingId + suffix;
            if (paymentTransactionRepository.findByPaymentCode(paymentCode).isEmpty()) {
                return paymentCode;
            }
        }
        throw new ApiException(ErrorCode.CONFLICT, "Unable to generate payment code");
    }

    private boolean isExpired(LocalDateTime expiresAt) {
        return expiresAt != null && expiresAt.isBefore(LocalDateTime.now());
    }

    private void verifyWebhookApiKey(String authorizationHeader) {
        String configuredApiKey = paymentProperties.getSepay().getWebhookApiKey();
        if (!StringUtils.hasText(configuredApiKey)) {
            throw new ApiException(ErrorCode.INTERNAL_ERROR, "SePay webhook API key is not configured");
        }

        /*
         * SePay gửi header Authorization dạng "Apikey <key>".
         * Key này là bí mật do mình nhập trên dashboard SePay và cấu hình lại
         * trong backend bằng PAYMENT_SEPAY_WEBHOOK_API_KEY.
         */
        String receivedApiKey = extractApiKey(authorizationHeader);
        if (!configuredApiKey.equals(receivedApiKey)) {
            throw new ApiException(ErrorCode.UNAUTHORIZED, "Invalid SePay webhook API key");
        }
    }

    // hàm này lấy api key từ authorizationHeader
    private String extractApiKey(String authorizationHeader) {
        if (!StringUtils.hasText(authorizationHeader)) {
            return "";
        }

        String trimmed = authorizationHeader.trim();
        if (trimmed.regionMatches(true, 0, "Apikey ", 0, "Apikey ".length())) {
            return trimmed.substring("Apikey ".length()).trim();
        }
        return trimmed;
    }

    private String resolvePaymentCode(SepayWebhookRequest request) {
        /*
         * Thứ tự lấy mã:
         * 1. request.code: tốt nhất vì SePay đã parse sẵn payment code.
         * 2. request.content: nội dung chuyển khoản thực tế.
         * 3. request.description: fallback cuối cùng cho một số ngân hàng.
         */
        String directCode = normalizePaymentCode(request.code());
        if (StringUtils.hasText(directCode)) {
            return directCode;
        }

        String fromContent = findPaymentCode(request.content());
        if (StringUtils.hasText(fromContent)) {
            return fromContent;
        }

        return findPaymentCode(request.description());
    }
//Hàm này nhận vào một chuỗi value vd:"  bk 123 abc  "  Sau đó nó biến chuỗi đó thành dạng chuẩn:
//"BK123ABC"\
    //Rồi kiểm tra chuỗi đó có bắt đầu bằng prefix hợp lệ hay không. Nếu đúng thì trả về mã đã chuẩn hóa, nếu sai thì trả về null.
    private String normalizePaymentCode(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }

        String normalized = value.trim().toUpperCase(Locale.ROOT).replaceAll("\\s+", "");
        String prefix = paymentProperties.normalizedTransferPrefix();
        if (normalized.startsWith(prefix)) {
            return normalized;
        }
        return null;
    }
    //Lấy prefix mã thanh toán từ cấu hình. vd
    private String findPaymentCode(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }

        //<prefix><4 đến 32 ký tự chữ hoặc số> vd:BK
        //BK[A-Z0-9]{4,32}
        String prefix = paymentProperties.normalizedTransferPrefix();
        Pattern pattern = Pattern.compile(Pattern.quote(prefix) + "[A-Z0-9]{4,32}", Pattern.CASE_INSENSITIVE);
        Matcher matcher = pattern.matcher(value.toUpperCase(Locale.ROOT));
        return matcher.find() ? matcher.group().toUpperCase(Locale.ROOT) : null;
    }

    private boolean amountMatches(Double actualAmount, Long expectedAmount) {
        if (actualAmount == null || expectedAmount == null) {
            return false;
        }
        return Math.round(actualAmount) == expectedAmount;
    }


    //Nếu webhook/cổng thanh toán gửi về một gatewayTransactionId hợp lệ, và giao dịch trong database hiện chưa có gatewayID,\
    // thì lưu gateway ID đó vào giao dịch. Nếu giao dịch đã có rồi thì không ghi đè.
    private void attachGatewayTransactionId(PaymentTransaction transaction, String gatewayTransactionId) {
        if (StringUtils.hasText(gatewayTransactionId) && !StringUtils.hasText(transaction.getGatewayTransactionId())) {
            transaction.setGatewayTransactionId(gatewayTransactionId);
        }
    }

    private LocalDateTime resolvePaidAt(String transactionDate) {
        if (!StringUtils.hasText(transactionDate)) {
            return LocalDateTime.now();
        }

        try {
            //Dòng này cố gắng chuyển chuỗi transactionDate thành kiểu LocalDateTime.
            return LocalDateTime.parse(transactionDate.trim(), SEPAY_DATE_FORMATTER); //transactionDate.trim() dùng để xóa khoảng trắng đầu/cuối.
        } catch (DateTimeParseException exception) {
            log.warn("Unable to parse SePay transactionDate={}", transactionDate);
            return LocalDateTime.now();
        }
    }
    //Hàm này dùng để chuyển object webhook request thành chuỗi JSON.
    private String toRawPayload(SepayWebhookRequest request) {
        try {
            return objectMapper.writeValueAsString(request);
        } catch (Exception exception) {
            return "{}";
        }
    }

    //value == null ? "" : ...: Toán tử 3 ngôi kiểm tra nếu value là null
    // (chưa khởi tạo) thì trả về "" (chuỗi rỗng), tránh lỗi NullPointerException.value.trim(): Nếu value không null, nó sẽ loại bỏ các khoảng trắng (spaces, tabs, newlines) ở đầu và cuối chuỗi.
//    normalize(null) ->""
//    normalize("  Hello  ") ->"Hello"
//    normalize(" Java ") -> "Java"

    private String normalize(String value) {
        return value == null ? "" : value.trim();
    }
}
