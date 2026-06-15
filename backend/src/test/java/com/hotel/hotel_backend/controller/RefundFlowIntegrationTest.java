package com.hotel.hotel_backend.controller;

import com.hotel.hotel_backend.entity.*;
import com.hotel.hotel_backend.repository.*;
import com.hotel.hotel_backend.security.JwtService;
import com.hotel.hotel_backend.service.InventoryService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Integration tests for the full refund flow:
 *
 *  Customer tạo refund request
 *    → Partner hoặc Admin duyệt / từ chối
 *      → Booking chuyển REFUNDED, PaymentTransaction âm được tạo
 *
 * Mỗi test độc lập: setUp() xóa sạch DB trước khi chạy.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class RefundFlowIntegrationTest {

    // ── Controllers & infrastructure ────────────────────────────────────────

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private JwtService jwtService;

    // ── Repositories ─────────────────────────────────────────────────────────

    @Autowired private UserRepository              userRepository;
    @Autowired private HotelRepository             hotelRepository;
    @Autowired private RoomRepository              roomRepository;
    @Autowired private RoomUnitRepository          roomUnitRepository;
    @Autowired private DailyRateRepository         dailyRateRepository;
    @Autowired private DailyInventoryRepository    dailyInventoryRepository;
    @Autowired private BookingRepository           bookingRepository;
    @Autowired private BookingItemRepository       bookingItemRepository;
    @Autowired private PaymentTransactionRepository paymentTransactionRepository;
    @Autowired private RefundRequestRepository     refundRequestRepository;
    @Autowired private HotelReviewRepository       hotelReviewRepository;
    @Autowired private InventoryService            inventoryService;

    // ── Shared test fixtures ─────────────────────────────────────────────────

    private User    partner;
    private User    customer;
    private User    admin;
    private Hotel   flexibleHotel;   // CancellationPolicy.FLEXIBLE
    private Room    room;

    @BeforeEach
    void setUp() {
        hotelReviewRepository.deleteAll();
        refundRequestRepository.deleteAll();
        bookingItemRepository.deleteAll();
        bookingRepository.deleteAll();
        paymentTransactionRepository.deleteAll();
        dailyRateRepository.deleteAll();
        dailyInventoryRepository.deleteAll();
        roomUnitRepository.deleteAll();
        roomRepository.deleteAll();
        hotelRepository.deleteAll();
        userRepository.deleteAll();

        partner      = createUser("partner@test.com", UserType.PARTNER);
        customer     = createUser("customer@test.com", UserType.CUSTOMER);
        admin        = createUser("admin@test.com",   UserType.ADMIN);
        flexibleHotel = buildHotel(partner, "Flexible Hotel", CancellationPolicy.FLEXIBLE);
        room          = buildRoom(flexibleHotel);
    }

    // ════════════════════════════════════════════════════════════════════════
    // 1. Customer tạo refund request — happy path (booking CANCELLED + đã thanh toán)
    // ════════════════════════════════════════════════════════════════════════

    @Test
    void customer_createRefundRequest_cancelledAndPaid_shouldReturnPending() throws Exception {
        // Contract: Customer có booking CANCELLED + có PaymentTransaction SUCCESS
        // → POST /api/bookings/{id}/refund-request trả về status=PENDING.
        Booking booking = buildCancelledPaidBooking(customer.getId(), room, flexibleHotel);

        mockMvc.perform(post("/api/bookings/{id}/refund-request", booking.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(customer))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "reason": "CHANGE_OF_PLAN", "note": "Thay đổi kế hoạch" }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PENDING"))
                .andExpect(jsonPath("$.data.bookingId").value(booking.getId()))
                .andExpect(jsonPath("$.data.amount").value(booking.getTotalPrice()));
    }

    // ════════════════════════════════════════════════════════════════════════
    // 2. Customer tạo refund request — booking chưa thanh toán → lỗi
    // ════════════════════════════════════════════════════════════════════════

    @Test
    void customer_createRefundRequest_noPayment_shouldFail() throws Exception {
        // Contract: Booking không có PaymentTransaction SUCCESS
        // → hệ thống phải từ chối tạo refund request.
        Booking booking = buildBookingWithStatus(customer.getId(), room, BookingStatus.CANCELLED);
        // Không tạo PaymentTransaction

        mockMvc.perform(post("/api/bookings/{id}/refund-request", booking.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(customer))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "reason": "PAYMENT_ISSUE" }
                                """))
                .andExpect(status().is4xxClientError());
    }

    // ════════════════════════════════════════════════════════════════════════
    // 3. Customer tạo refund request lần 2 cùng booking → lỗi CONFLICT
    // ════════════════════════════════════════════════════════════════════════

    @Test
    void customer_createRefundRequest_duplicate_shouldFail() throws Exception {
        // Contract: Mỗi booking chỉ được có 1 refund request.
        // Lần thứ 2 phải trả về lỗi CONFLICT.
        Booking booking = buildCancelledPaidBooking(customer.getId(), room, flexibleHotel);

        // Lần 1 — thành công
        mockMvc.perform(post("/api/bookings/{id}/refund-request", booking.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(customer))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "reason": "OTHER" }
                                """))
                .andExpect(status().isOk());

        // Lần 2 — bị từ chối
        mockMvc.perform(post("/api/bookings/{id}/refund-request", booking.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(customer))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "reason": "OTHER" }
                                """))
                .andExpect(status().is4xxClientError());
    }

    // ════════════════════════════════════════════════════════════════════════
    // 4. Customer tạo refund request cho booking của người khác → lỗi
    // ════════════════════════════════════════════════════════════════════════

    @Test
    void customer_createRefundRequest_otherUsersBooking_shouldFail() throws Exception {
        // Contract: Booking không thuộc user hiện tại → 404/403.
        User otherCustomer = createUser("other@test.com", UserType.CUSTOMER);
        Booking booking = buildCancelledPaidBooking(otherCustomer.getId(), room, flexibleHotel);

        mockMvc.perform(post("/api/bookings/{id}/refund-request", booking.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(customer))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "reason": "OTHER" }
                                """))
                .andExpect(status().is4xxClientError());
    }

    // ════════════════════════════════════════════════════════════════════════
    // 5. Customer xem refund request của mình
    // ════════════════════════════════════════════════════════════════════════

    @Test
    void customer_getRefundRequest_shouldReturnRequest() throws Exception {
        // Contract: GET /api/bookings/{id}/refund-request trả về đúng refund request của mình.
        Booking booking = buildCancelledPaidBooking(customer.getId(), room, flexibleHotel);
        buildRefundRequest(booking, customer, flexibleHotel);

        mockMvc.perform(get("/api/bookings/{id}/refund-request", booking.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(customer)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PENDING"))
                .andExpect(jsonPath("$.data.bookingId").value(booking.getId()));
    }

    // ════════════════════════════════════════════════════════════════════════
    // 6. Customer xem refund request của người khác → lỗi
    // ════════════════════════════════════════════════════════════════════════

    @Test
    void customer_getRefundRequest_otherUser_shouldFail() throws Exception {
        // Contract: Refund request không thuộc user hiện tại → 404.
        User otherCustomer = createUser("other2@test.com", UserType.CUSTOMER);
        Booking booking = buildCancelledPaidBooking(otherCustomer.getId(), room, flexibleHotel);
        buildRefundRequest(booking, otherCustomer, flexibleHotel);

        mockMvc.perform(get("/api/bookings/{id}/refund-request", booking.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(customer)))
                .andExpect(status().is4xxClientError());
    }

    // ════════════════════════════════════════════════════════════════════════
    // 7. Partner xem danh sách refund requests của khách sạn mình
    // ════════════════════════════════════════════════════════════════════════

    @Test
    void partner_listRefunds_shouldReturnOwnHotelRefunds() throws Exception {
        // Contract: GET /api/partner/refunds chỉ trả về refund của hotel thuộc partner.
        Booking b1 = buildCancelledPaidBooking(customer.getId(), room, flexibleHotel);
        buildRefundRequest(b1, customer, flexibleHotel);

        // Hotel của partner khác — không được xuất hiện trong kết quả
        User    otherPartner = createUser("other-partner@test.com", UserType.PARTNER);
        Hotel   otherHotel   = buildHotel(otherPartner, "Other Hotel", CancellationPolicy.MODERATE);
        Room    otherRoom    = buildRoom(otherHotel);
        User    otherCust    = createUser("other-cust@test.com", UserType.CUSTOMER);
        Booking b2           = buildCancelledPaidBooking(otherCust.getId(), otherRoom, otherHotel);
        buildRefundRequest(b2, otherCust, otherHotel);

        MvcResult result = mockMvc.perform(get("/api/partner/refunds")
                        .header(HttpHeaders.AUTHORIZATION, bearer(partner)))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode data = readData(result);
        assertThat(data.isArray()).isTrue();
        assertThat(data.size()).isEqualTo(1);
        assertThat(data.get(0).path("hotelName").asText()).isEqualTo("Flexible Hotel");
    }

    // ════════════════════════════════════════════════════════════════════════
    // 8. Partner approve refund với transferNote
    // ════════════════════════════════════════════════════════════════════════

    @Test
    void partner_approveRefund_withTransferNote_shouldApproveAndPersistNote() throws Exception {
        // Contract: POST /api/partner/refunds/{id}/approve với transferNote
        // → status=APPROVED, transferNote trả về trong response.
        Booking booking = buildCancelledPaidBooking(customer.getId(), room, flexibleHotel);
        RefundRequest rr = buildRefundRequest(booking, customer, flexibleHotel);

        mockMvc.perform(post("/api/partner/refunds/{id}/approve", rr.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(partner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "transferNote": "FT26140123456" }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("APPROVED"))
                .andExpect(jsonPath("$.data.transferNote").value("FT26140123456"));
    }

    // ════════════════════════════════════════════════════════════════════════
    // 9. Partner approve refund không có transferNote
    // ════════════════════════════════════════════════════════════════════════

    @Test
    void partner_approveRefund_withoutTransferNote_shouldApprove() throws Exception {
        // Contract: POST /api/partner/refunds/{id}/approve không có body
        // → vẫn approve thành công, transferNote=null.
        Booking booking = buildCancelledPaidBooking(customer.getId(), room, flexibleHotel);
        RefundRequest rr = buildRefundRequest(booking, customer, flexibleHotel);

        mockMvc.perform(post("/api/partner/refunds/{id}/approve", rr.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(partner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("APPROVED"));
    }

    // ════════════════════════════════════════════════════════════════════════
    // 10. Sau khi partner approve — booking.status = REFUNDED
    // ════════════════════════════════════════════════════════════════════════

    @Test
    void partner_approveRefund_shouldChangeBookingStatusToRefunded() throws Exception {
        // Contract: Sau khi approve, Booking trong DB phải có status=REFUNDED.
        Booking booking = buildCancelledPaidBooking(customer.getId(), room, flexibleHotel);
        RefundRequest rr = buildRefundRequest(booking, customer, flexibleHotel);

        mockMvc.perform(post("/api/partner/refunds/{id}/approve", rr.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(partner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk());

        Booking updated = bookingRepository.findById(booking.getId()).orElseThrow();
        assertThat(updated.getStatus()).isEqualTo(BookingStatus.REFUNDED);
    }

    // ════════════════════════════════════════════════════════════════════════
    // 11. Sau khi approve — PaymentTransaction âm được tạo
    // ════════════════════════════════════════════════════════════════════════

    @Test
    void partner_approveRefund_shouldCreateNegativePaymentTransaction() throws Exception {
        // Contract: Sau khi approve, hệ thống tạo PaymentTransaction với amount âm
        // bằng totalPrice của booking, method=MANUAL_TRANSFER, status=SUCCESS.
        Booking booking = buildCancelledPaidBooking(customer.getId(), room, flexibleHotel);
        RefundRequest rr = buildRefundRequest(booking, customer, flexibleHotel);

        mockMvc.perform(post("/api/partner/refunds/{id}/approve", rr.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(partner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk());

        List<PaymentTransaction> txns = paymentTransactionRepository
                .findByBookingIdOrderByCreatedAtAsc(booking.getId());

        PaymentTransaction refundTxn = txns.stream()
                .filter(t -> t.getAmount() < 0)
                .findFirst()
                .orElseThrow(() -> new AssertionError("Không tìm thấy PaymentTransaction âm"));

        assertThat(refundTxn.getAmount()).isEqualTo(-booking.getTotalPrice());
        assertThat(refundTxn.getMethod()).isEqualTo(PaymentMethod.MANUAL_TRANSFER);
        assertThat(refundTxn.getStatus()).isEqualTo(PaymentTransactionStatus.SUCCESS);
    }

    // ════════════════════════════════════════════════════════════════════════
    // 12. Sau khi approve với transferNote — providerReference = transferNote
    // ════════════════════════════════════════════════════════════════════════

    @Test
    void partner_approveRefund_withTransferNote_providerReferenceShouldMatchNote() throws Exception {
        // Contract: transferNote được lưu làm providerReference trong PaymentTransaction
        // để có thể tra soát giao dịch ngân hàng sau này.
        Booking booking = buildCancelledPaidBooking(customer.getId(), room, flexibleHotel);
        RefundRequest rr = buildRefundRequest(booking, customer, flexibleHotel);

        mockMvc.perform(post("/api/partner/refunds/{id}/approve", rr.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(partner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "transferNote": "BANK-TXN-999" }
                                """))
                .andExpect(status().isOk());

        List<PaymentTransaction> txns = paymentTransactionRepository
                .findByBookingIdOrderByCreatedAtAsc(booking.getId());
        PaymentTransaction refundTxn = txns.stream()
                .filter(t -> t.getAmount() < 0)
                .findFirst()
                .orElseThrow();

        assertThat(refundTxn.getProviderReference()).isEqualTo("BANK-TXN-999");
    }

    // ════════════════════════════════════════════════════════════════════════
    // 13. Sau khi approve không có transferNote — providerReference = "MANUAL-REFUND-..."
    // ════════════════════════════════════════════════════════════════════════

    @Test
    void partner_approveRefund_withoutTransferNote_providerReferenceShouldBeAutoGenerated() throws Exception {
        // Contract: Khi không có transferNote, hệ thống tự sinh providerReference
        // theo pattern "MANUAL-REFUND-{UUID}" để không để trống trường này.
        Booking booking = buildCancelledPaidBooking(customer.getId(), room, flexibleHotel);
        RefundRequest rr = buildRefundRequest(booking, customer, flexibleHotel);

        mockMvc.perform(post("/api/partner/refunds/{id}/approve", rr.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(partner)))
                .andExpect(status().isOk());

        List<PaymentTransaction> txns = paymentTransactionRepository
                .findByBookingIdOrderByCreatedAtAsc(booking.getId());
        PaymentTransaction refundTxn = txns.stream()
                .filter(t -> t.getAmount() < 0)
                .findFirst()
                .orElseThrow();

        assertThat(refundTxn.getProviderReference()).startsWith("MANUAL-REFUND-");
    }

    // ════════════════════════════════════════════════════════════════════════
    // 14. Partner approve refund của hotel người khác → lỗi
    // ════════════════════════════════════════════════════════════════════════

    @Test
    void partner_approveRefund_otherPartnersHotel_shouldFail() throws Exception {
        // Contract: Partner chỉ được approve refund của hotel mình sở hữu.
        // Nếu cố approve hotel của partner khác → 404.
        User    otherPartner = createUser("partner2@test.com", UserType.PARTNER);
        Hotel   otherHotel   = buildHotel(otherPartner, "Other Hotel", CancellationPolicy.FLEXIBLE);
        Room    otherRoom    = buildRoom(otherHotel);
        Booking booking      = buildCancelledPaidBooking(customer.getId(), otherRoom, otherHotel);
        RefundRequest rr     = buildRefundRequest(booking, customer, otherHotel);

        mockMvc.perform(post("/api/partner/refunds/{id}/approve", rr.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(partner))  // sai partner
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().is4xxClientError());
    }

    // ════════════════════════════════════════════════════════════════════════
    // 15. Partner reject refund request
    // ════════════════════════════════════════════════════════════════════════

    @Test
    void partner_rejectRefund_shouldReturnRejected() throws Exception {
        // Contract: POST /api/partner/refunds/{id}/reject
        // → status=REJECTED, booking không thay đổi status.
        Booking booking = buildCancelledPaidBooking(customer.getId(), room, flexibleHotel);
        RefundRequest rr = buildRefundRequest(booking, customer, flexibleHotel);

        mockMvc.perform(post("/api/partner/refunds/{id}/reject", rr.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(partner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("REJECTED"));

        // Booking vẫn CANCELLED, không phải REFUNDED
        Booking updated = bookingRepository.findById(booking.getId()).orElseThrow();
        assertThat(updated.getStatus()).isEqualTo(BookingStatus.CANCELLED);
    }

    // ════════════════════════════════════════════════════════════════════════
    // 16. Approve lần 2 sau khi đã approve → lỗi CONFLICT
    // ════════════════════════════════════════════════════════════════════════

    @Test
    void partner_approveRefund_alreadyApproved_shouldFail() throws Exception {
        // Contract: assertPending() ngăn approve khi status != PENDING.
        // Approve lần 2 phải trả về lỗi.
        Booking booking = buildCancelledPaidBooking(customer.getId(), room, flexibleHotel);
        RefundRequest rr = buildRefundRequest(booking, customer, flexibleHotel);

        // Approve lần 1
        mockMvc.perform(post("/api/partner/refunds/{id}/approve", rr.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(partner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk());

        // Approve lần 2
        mockMvc.perform(post("/api/partner/refunds/{id}/approve", rr.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(partner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().is4xxClientError());
    }

    // ════════════════════════════════════════════════════════════════════════
    // 17. Approve sau khi đã reject → lỗi CONFLICT
    // ════════════════════════════════════════════════════════════════════════

    @Test
    void partner_approveRefund_afterReject_shouldFail() throws Exception {
        // Contract: Sau khi reject, refund request không thể được approve nữa.
        Booking booking = buildCancelledPaidBooking(customer.getId(), room, flexibleHotel);
        RefundRequest rr = buildRefundRequest(booking, customer, flexibleHotel);

        // Reject trước
        mockMvc.perform(post("/api/partner/refunds/{id}/reject", rr.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(partner)))
                .andExpect(status().isOk());

        // Approve sau → lỗi
        mockMvc.perform(post("/api/partner/refunds/{id}/approve", rr.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(partner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().is4xxClientError());
    }

    // ════════════════════════════════════════════════════════════════════════
    // 18. Admin xem tất cả refund requests (không giới hạn hotel)
    // ════════════════════════════════════════════════════════════════════════

    @Test
    void admin_listAllRefunds_shouldReturnAll() throws Exception {
        // Contract: Admin GET /api/admin/refunds thấy refund của mọi hotel.
        Booking b1 = buildCancelledPaidBooking(customer.getId(), room, flexibleHotel);
        buildRefundRequest(b1, customer, flexibleHotel);

        User    otherPartner = createUser("partner3@test.com", UserType.PARTNER);
        Hotel   otherHotel   = buildHotel(otherPartner, "Hotel B", CancellationPolicy.STRICT);
        Room    otherRoom    = buildRoom(otherHotel);
        User    otherCust    = createUser("cust2@test.com", UserType.CUSTOMER);
        Booking b2           = buildCancelledPaidBooking(otherCust.getId(), otherRoom, otherHotel);
        buildRefundRequest(b2, otherCust, otherHotel);

        MvcResult result = mockMvc.perform(get("/api/admin/refunds")
                        .header(HttpHeaders.AUTHORIZATION, bearer(admin)))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode data = readData(result);
        assertThat(data.isArray()).isTrue();
        assertThat(data.size()).isEqualTo(2);
    }

    // ════════════════════════════════════════════════════════════════════════
    // 19. Admin lọc refund theo status=PENDING
    // ════════════════════════════════════════════════════════════════════════

    @Test
    void admin_listRefunds_filterByPending_shouldReturnOnlyPending() throws Exception {
        // Contract: ?status=PENDING chỉ trả về các request đang chờ xử lý.
        Booking b1 = buildCancelledPaidBooking(customer.getId(), room, flexibleHotel);
        RefundRequest pending = buildRefundRequest(b1, customer, flexibleHotel);

        // Tạo thêm 1 refund đã APPROVED thủ công
        User    cust2  = createUser("cust3@test.com", UserType.CUSTOMER);
        Hotel   hotel2 = buildHotel(partner, "Hotel 2", CancellationPolicy.FLEXIBLE);
        Room    room2  = buildRoom(hotel2);
        Booking b2     = buildCancelledPaidBooking(cust2.getId(), room2, hotel2);
        RefundRequest approved = buildRefundRequest(b2, cust2, hotel2);
        approved.setStatus(RefundRequestStatus.APPROVED);
        refundRequestRepository.save(approved);

        MvcResult result = mockMvc.perform(get("/api/admin/refunds?status=PENDING")
                        .header(HttpHeaders.AUTHORIZATION, bearer(admin)))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode data = readData(result);
        assertThat(data.isArray()).isTrue();
        assertThat(data.size()).isEqualTo(1);
        assertThat(data.get(0).path("id").asLong()).isEqualTo(pending.getId());
    }

    // ════════════════════════════════════════════════════════════════════════
    // 20. Admin approve refund với transferNote
    // ════════════════════════════════════════════════════════════════════════

    @Test
    void admin_approveRefund_withTransferNote_shouldApprove() throws Exception {
        // Contract: Admin POST /api/admin/refunds/{id}/approve hoạt động như partner
        // nhưng không giới hạn hotel.
        Booking booking = buildCancelledPaidBooking(customer.getId(), room, flexibleHotel);
        RefundRequest rr = buildRefundRequest(booking, customer, flexibleHotel);

        mockMvc.perform(post("/api/admin/refunds/{id}/approve", rr.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "transferNote": "ADM-TXN-001" }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("APPROVED"))
                .andExpect(jsonPath("$.data.transferNote").value("ADM-TXN-001"));

        Booking updated = bookingRepository.findById(booking.getId()).orElseThrow();
        assertThat(updated.getStatus()).isEqualTo(BookingStatus.REFUNDED);
    }

    // ════════════════════════════════════════════════════════════════════════
    // 21. Admin reject refund
    // ════════════════════════════════════════════════════════════════════════

    @Test
    void admin_rejectRefund_shouldReturnRejected() throws Exception {
        // Contract: Admin POST /api/admin/refunds/{id}/reject → status=REJECTED.
        // Booking không chuyển sang REFUNDED.
        Booking booking = buildCancelledPaidBooking(customer.getId(), room, flexibleHotel);
        RefundRequest rr = buildRefundRequest(booking, customer, flexibleHotel);

        mockMvc.perform(post("/api/admin/refunds/{id}/reject", rr.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("REJECTED"));

        Booking updated = bookingRepository.findById(booking.getId()).orElseThrow();
        assertThat(updated.getStatus()).isEqualTo(BookingStatus.CANCELLED);
    }

    // ════════════════════════════════════════════════════════════════════════
    // 22. Admin approve refund không thuộc hotel mình — vẫn được
    // ════════════════════════════════════════════════════════════════════════

    @Test
    void admin_approveRefund_anyHotel_shouldSucceed() throws Exception {
        // Contract: Admin không bị giới hạn bởi hotel.getOwner()
        // → có thể approve refund của bất kỳ hotel nào.
        User    otherPartner = createUser("partner4@test.com", UserType.PARTNER);
        Hotel   otherHotel   = buildHotel(otherPartner, "Hotel C", CancellationPolicy.MODERATE);
        Room    otherRoom    = buildRoom(otherHotel);
        Booking booking      = buildCancelledPaidBooking(customer.getId(), otherRoom, otherHotel);
        RefundRequest rr     = buildRefundRequest(booking, customer, otherHotel);

        mockMvc.perform(post("/api/admin/refunds/{id}/approve", rr.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("APPROVED"));
    }

    // ════════════════════════════════════════════════════════════════════════
    // 23. Admin approve lần 2 → lỗi CONFLICT (giống partner)
    // ════════════════════════════════════════════════════════════════════════

    @Test
    void admin_approveRefund_alreadyApproved_shouldFail() throws Exception {
        // Contract: Admin cũng bị assertPending() chặn — không có ngoại lệ cho ADMIN.
        Booking booking = buildCancelledPaidBooking(customer.getId(), room, flexibleHotel);
        RefundRequest rr = buildRefundRequest(booking, customer, flexibleHotel);

        // Admin approve lần 1
        mockMvc.perform(post("/api/admin/refunds/{id}/approve", rr.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk());

        // Admin approve lần 2
        mockMvc.perform(post("/api/admin/refunds/{id}/approve", rr.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().is4xxClientError());
    }

    // ════════════════════════════════════════════════════════════════════════
    // 24. Partner approve → Admin cố approve cùng refund → lỗi
    //     (race condition prevention — sequential version)
    // ════════════════════════════════════════════════════════════════════════

    @Test
    void partnerApprove_thenAdminApprove_shouldFail() throws Exception {
        // Contract: Nếu partner đã approve trước, admin không thể approve lại.
        // assertPending() bảo vệ cả hai chiều.
        Booking booking = buildCancelledPaidBooking(customer.getId(), room, flexibleHotel);
        RefundRequest rr = buildRefundRequest(booking, customer, flexibleHotel);

        // Partner approve trước
        mockMvc.perform(post("/api/partner/refunds/{id}/approve", rr.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(partner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk());

        // Admin cố approve sau
        mockMvc.perform(post("/api/admin/refunds/{id}/approve", rr.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().is4xxClientError());
    }

    // ════════════════════════════════════════════════════════════════════════
    // 25. Booking đã REFUNDED không thể tạo refund request mới
    // ════════════════════════════════════════════════════════════════════════

    @Test
    void customer_createRefundRequest_alreadyRefunded_shouldFail() throws Exception {
        // Contract: Booking status=REFUNDED → không cho tạo refund request mới
        // (mặc dù refundRequestRepository.findByBookingId không có bản ghi).
        Booking booking = buildCancelledPaidBooking(customer.getId(), room, flexibleHotel);
        booking.setStatus(BookingStatus.REFUNDED);
        bookingRepository.save(booking);

        mockMvc.perform(post("/api/bookings/{id}/refund-request", booking.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(customer))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "reason": "OTHER" }
                                """))
                .andExpect(status().is4xxClientError());
    }

    // ════════════════════════════════════════════════════════════════════════
    // 26. Partner lọc refund theo status=PENDING
    // ════════════════════════════════════════════════════════════════════════

    @Test
    void partner_listRefunds_filterByPending_shouldReturnOnlyPending() throws Exception {
        // Contract: GET /api/partner/refunds?status=PENDING chỉ trả về PENDING.
        Booking b1 = buildCancelledPaidBooking(customer.getId(), room, flexibleHotel);
        buildRefundRequest(b1, customer, flexibleHotel);

        Hotel  hotel2 = buildHotel(partner, "Hotel 2", CancellationPolicy.FLEXIBLE);
        Room   room2  = buildRoom(hotel2);
        User   cust2  = createUser("cust4@test.com", UserType.CUSTOMER);
        Booking b2    = buildCancelledPaidBooking(cust2.getId(), room2, hotel2);
        RefundRequest rr2 = buildRefundRequest(b2, cust2, hotel2);
        rr2.setStatus(RefundRequestStatus.REJECTED);
        refundRequestRepository.save(rr2);

        MvcResult result = mockMvc.perform(get("/api/partner/refunds?status=PENDING")
                        .header(HttpHeaders.AUTHORIZATION, bearer(partner)))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode data = readData(result);
        assertThat(data.isArray()).isTrue();
        assertThat(data.size()).isEqualTo(1);
        assertThat(data.get(0).path("status").asText()).isEqualTo("PENDING");
    }

    // ════════════════════════════════════════════════════════════════════════
    // Helpers
    // ════════════════════════════════════════════════════════════════════════

    private String bearer(User user) {
        return "Bearer " + jwtService.generate(user);
    }

    private User createUser(String email, UserType type) {
        User u = new User();
        u.setEmail(email);
        u.setPasswordHash("hash");
        u.setUserType(type);
        u.setStatus(UserStatus.ACTIVE);
        return userRepository.save(u);
    }

    private Hotel buildHotel(User owner, String name, CancellationPolicy policy) {
        Hotel h = new Hotel();
        h.setOwner(owner);
        h.setName(name);
        h.setAddress(name + " address");
        h.setProvince("Ho Chi Minh");
        h.setDistrict("District 1");
        h.setHotelType(HotelType.HOTEL);
        h.setCancellationPolicy(policy);
        return hotelRepository.save(h);
    }

    private Room buildRoom(Hotel hotel) {
        Room r = new Room();
        r.setHotel(hotel);
        r.setName("Standard Room");
        r.setPrice(800_000L);
        r.setCapacity(2);
        r.setQuantity(2);
        r.setRoomCategory(RoomCategory.STANDARD);
        r.setBedType(BedType.DOUBLE);
        return roomRepository.save(r);
    }

    /**
     * Tạo Booking CANCELLED + PaymentTransaction SUCCESS (đã thanh toán).
     * Đây là trạng thái điều kiện để tạo refund request.
     */
    private Booking buildCancelledPaidBooking(Long userId, Room room, Hotel hotel) {
        // Check-in trong tương lai để chính sách FLEXIBLE hoàn 100% (= totalPrice) khi tạo
        // refund request, khớp với cách tính bậc mới của RefundPolicyCalculator.
        LocalDate checkIn  = LocalDate.now().plusDays(10);
        LocalDate checkOut = checkIn.plusDays(2);

        Booking booking = Booking.builder()
                .userId(userId)
                .checkIn(checkIn)
                .checkOut(checkOut)
                .totalPrice(800_000L)
                .status(BookingStatus.CANCELLED)
                .build();
        booking = bookingRepository.save(booking);

        BookingItem item = new BookingItem();
        item.setBooking(booking);
        item.setRoom(room);
        item.setQuantity(1);
        item.setPrice(800_000L);
        bookingItemRepository.save(item);

        PaymentTransaction txn = PaymentTransaction.builder()
                .booking(booking)
                .method(PaymentMethod.VIETQR_SEPAY)
                .status(PaymentTransactionStatus.SUCCESS)
                .amount(800_000L)
                .providerReference("SEPAY-TEST-001")
                .clientRequestId("pay-session-" + booking.getId())
                .build();
        paymentTransactionRepository.save(txn);

        return booking;
    }

    /** Tạo Booking với status tuỳ chọn, không có PaymentTransaction. */
    private Booking buildBookingWithStatus(Long userId, Room room, BookingStatus status) {
        LocalDate checkIn  = LocalDate.now().minusDays(5);
        LocalDate checkOut = checkIn.plusDays(2);

        Booking booking = Booking.builder()
                .userId(userId)
                .checkIn(checkIn)
                .checkOut(checkOut)
                .totalPrice(800_000L)
                .status(status)
                .build();
        booking = bookingRepository.save(booking);

        BookingItem item = new BookingItem();
        item.setBooking(booking);
        item.setRoom(room);
        item.setQuantity(1);
        item.setPrice(800_000L);
        bookingItemRepository.save(item);

        return booking;
    }

    /** Tạo sẵn RefundRequest PENDING trong DB (bỏ qua API). */
    private RefundRequest buildRefundRequest(Booking booking, User user, Hotel hotel) {
        RefundRequest rr = new RefundRequest();
        rr.setBooking(booking);
        rr.setUser(user);
        rr.setHotel(hotel);
        rr.setAmount(booking.getTotalPrice());
        rr.setReason("CHANGE_OF_PLAN");
        rr.setStatus(RefundRequestStatus.PENDING);
        return refundRequestRepository.save(rr);
    }

    private JsonNode readData(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsString()).path("data");
    }
}
