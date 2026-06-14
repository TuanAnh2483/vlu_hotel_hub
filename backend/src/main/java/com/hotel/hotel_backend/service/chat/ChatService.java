package com.hotel.hotel_backend.service.chat;

import com.hotel.hotel_backend.dto.request.ChatRequest.ChatContext;
import com.hotel.hotel_backend.entity.Hotel;
import com.hotel.hotel_backend.exception.ApiException;
import com.hotel.hotel_backend.repository.HotelRepository;
import com.hotel.hotel_backend.repository.UserProfileRepository;
import com.hotel.hotel_backend.security.JwtPrincipal;
import com.hotel.hotel_backend.service.SecurityService;
import com.hotel.hotel_backend.service.chat.PendingActionStore.PendingAction;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Consumer;
import java.util.stream.Collectors;

import static com.hotel.hotel_backend.service.chat.ChatJsonUtil.obj;

/**
 * Orchestrator của chatbot: giữ vòng lặp function-calling giữa Gemini và các tool service.
 *
 * <p>Mỗi request: lấy history theo sessionId → append message user → lặp tối đa
 * {@link #MAX_TOOL_ITERATIONS} lượt gọi Gemini (thực thi tool nếu model yêu cầu) → trả text
 * cuối cùng và lưu lại history (trim 20). Khi Gemini chưa cấu hình key hoặc lỗi/timeout,
 * trả câu fallback thay vì 500.
 *
 * <p>Thao tác ghi (write) trong {@link #CUSTOMER_CONFIRM}/{@link #PARTNER_CONFIRM} KHÔNG chạy ngay:
 * orchestrator lưu {@link PendingActionStore} + gửi thẻ xác nhận; chỉ chạy khi client gửi lại
 * {@code confirm=true} (xem {@link #handleConfirmStream}).
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class ChatService {

    private static final int MAX_TOOL_ITERATIONS = 5;
    private static final String FALLBACK_MSG =
            "Xin lỗi, trợ lý đang tạm thời gián đoạn. Bạn vui lòng thử lại sau ít phút nhé.";

    /** Tool ghi cần xác nhận trước khi thực thi (theo role). */
    private static final Set<String> CUSTOMER_CONFIRM = Set.of("cancel_my_booking", "create_booking_hold");
    private static final Set<String> PARTNER_CONFIRM = Set.of("block_room", "set_room_price", "reply_to_review");

    /**
     * Field chỉ phục vụ hiển thị (thẻ UI) hoặc quá nặng — cắt khỏi functionResponse gửi cho model để
     * tiết kiệm token, vì kết quả tool được gửi LẠI Gemini ở MỌI lượt sau (history). Thẻ UI vẫn dùng
     * result đầy đủ (emit trước khi cắt). {@code coverImage}/{@code payUrl} là URL chỉ thẻ cần;
     * {@code days} là mảng tồn kho theo ngày (rất nặng) trong get_available_rooms — model chỉ cần minSellable.
     */
    private static final Set<String> MODEL_OMIT_KEYS = Set.of("coverImage", "payUrl", "days");

    private final ChatGeminiClient geminiClient;
    private final ChatSessionService sessionService;
    private final PendingActionStore pendingActionStore;
    private final CustomerToolService customerToolService;
    private final PartnerToolService partnerToolService;
    private final SecurityService securityService;
    private final HotelRepository hotelRepository;
    private final UserProfileRepository userProfileRepository;

    public String chatCustomer(String message, String sessionId, ChatContext context, Boolean confirm) {
        return chat(ChatRole.CUSTOMER, message, sessionId, context,
                ChatTools.CUSTOMER_TOOLS, customerSystemPrompt(context), confirm);
    }

    public String chatPartner(String message, String sessionId, ChatContext context, Boolean confirm) {
        return chat(ChatRole.PARTNER, message, sessionId, context,
                ChatTools.PARTNER_TOOLS, partnerSystemPrompt(context), confirm);
    }

    public void chatCustomerStream(String message, String sessionId, ChatContext context, Boolean confirm, SseEmitter emitter) {
        chatStream(ChatRole.CUSTOMER, message, sessionId, context,
                ChatTools.CUSTOMER_TOOLS, customerSystemPrompt(context), confirm, emitter);
    }

    public void chatPartnerStream(String message, String sessionId, ChatContext context, Boolean confirm, SseEmitter emitter) {
        chatStream(ChatRole.PARTNER, message, sessionId, context,
                ChatTools.PARTNER_TOOLS, partnerSystemPrompt(context), confirm, emitter);
    }

    // ── Non-stream ───────────────────────────────────────────────────────────

    private String chat(ChatRole role, String message, String sessionId, ChatContext context,
                        List<Map<String, Object>> tools, String systemPrompt, Boolean confirm) {
        if (!geminiClient.isConfigured()) {
            return FALLBACK_MSG;
        }
        List<Map<String, Object>> history = new ArrayList<>(sessionService.getHistory(sessionId));
        try {
            String reply = confirm != null
                    ? handleConfirm(role, sessionId, context, tools, systemPrompt, history, confirm)
                    : runFromUserMessage(role, sessionId, context, tools, systemPrompt, history, message);
            sessionService.save(sessionId, history);
            return reply;
        } catch (Exception e) {
            log.warn("[Chat] role={} lỗi xử lý: {}", role, e.getMessage());
            return FALLBACK_MSG;
        }
    }

    private String runFromUserMessage(ChatRole role, String sessionId, ChatContext context,
                                      List<Map<String, Object>> tools, String systemPrompt,
                                      List<Map<String, Object>> history, String message) {
        history.add(userContent(message));
        return runLoop(role, sessionId, context, history, tools, systemPrompt);
    }

    /** Xử lý phản hồi nút xác nhận (non-stream): thực thi pending action nếu confirm=true. */
    private String handleConfirm(ChatRole role, String sessionId, ChatContext context,
                                 List<Map<String, Object>> tools, String systemPrompt,
                                 List<Map<String, Object>> history, boolean confirm) {
        PendingAction action = pendingActionStore.take(sessionId, role);
        if (!confirm || action == null) {
            String msg = (action == null && confirm)
                    ? "Thao tác đã hết hạn, bạn thử lại nhé."
                    : "Đã huỷ thao tác.";
            history.add(userContent(confirm ? "Xác nhận" : "Huỷ"));
            history.add(modelTextContent(msg));
            return msg;
        }
        history.add(userContent("Xác nhận thực hiện."));
        history.add(modelFunctionCall(action.toolName(), action.args()));
        Map<String, Object> result = dispatch(role, action.toolName(), action.args());
        history.add(functionResponse(action.toolName(), modelView(result)));
        return runLoop(role, sessionId, context, history, tools, systemPrompt);
    }

    private String runLoop(ChatRole role, String sessionId, ChatContext context,
                           List<Map<String, Object>> history, List<Map<String, Object>> tools, String systemPrompt) {
        for (int i = 0; i < MAX_TOOL_ITERATIONS; i++) {
            ChatGeminiClient.GeminiTurn turn = geminiClient.generate(history, tools, systemPrompt);
            if (turn.isFunctionCall()) {
                if (isConfirmRequired(role, turn.functionName())) {
                    String ask = "Bạn xác nhận " + confirmSummary(turn.functionName(), turn.functionArgs()) + " không?";
                    pendingActionStore.put(sessionId, role, turn.functionName(), turn.functionArgs());
                    history.add(modelTextContent(ask));
                    return ask;
                }
                history.add(modelFunctionCall(turn.functionName(), turn.functionArgs()));
                Map<String, Object> result = dispatch(role, turn.functionName(),
                        augmentArgs(role, turn.functionName(), turn.functionArgs(), context));
                history.add(functionResponse(turn.functionName(), modelView(result)));
                continue;
            }
            String text = turn.text();
            if (text == null || text.isBlank()) {
                text = "Mình chưa rõ ý bạn lắm, bạn nói rõ hơn giúp mình nhé.";
            }
            history.add(modelTextContent(text));
            return text;
        }
        String giveUp = "Xin lỗi, mình chưa xử lý xong yêu cầu này. Bạn thử diễn đạt lại nhé.";
        history.add(modelTextContent(giveUp));
        return giveUp;
    }

    // ── Streaming ──────────────────────────────────────────────────────────────

    /**
     * Biến thể streaming: chạy cùng vòng lặp tool-calling nhưng stream lượt sinh text cuối
     * xuống client qua {@link SseEmitter}. Luôn complete emitter (kể cả khi lỗi/chưa configured)
     * để client không bị treo. Phải được gọi trên thread đã có SecurityContext (partner cần JWT).
     */
    private void chatStream(ChatRole role, String message, String sessionId, ChatContext context,
                            List<Map<String, Object>> tools, String systemPrompt, Boolean confirm, SseEmitter emitter) {
        if (!geminiClient.isConfigured()) {
            sendDelta(emitter, FALLBACK_MSG);
            finish(emitter, sessionId);
            return;
        }
        List<Map<String, Object>> history = new ArrayList<>(sessionService.getHistory(sessionId));
        if (confirm != null) {
            handleConfirmStream(role, sessionId, context, tools, systemPrompt, history, confirm, emitter);
            return;
        }
        history.add(userContent(message));
        streamLoop(role, sessionId, context, history, tools, systemPrompt, emitter, new boolean[]{false});
    }

    /** Xử lý phản hồi nút xác nhận (stream): thực thi pending action nếu confirm=true, rồi sinh text. */
    private void handleConfirmStream(ChatRole role, String sessionId, ChatContext context,
                                     List<Map<String, Object>> tools, String systemPrompt,
                                     List<Map<String, Object>> history, boolean confirm, SseEmitter emitter) {
        PendingAction action = pendingActionStore.take(sessionId, role);
        if (!confirm || action == null) {
            String msg = (action == null && confirm)
                    ? "Thao tác đã hết hạn, bạn thử lại nhé."
                    : "Đã huỷ thao tác.";
            sendDelta(emitter, msg);
            history.add(userContent(confirm ? "Xác nhận" : "Huỷ"));
            history.add(modelTextContent(msg));
            sessionService.save(sessionId, history);
            finish(emitter, sessionId);
            return;
        }
        history.add(userContent("Xác nhận thực hiện."));
        history.add(modelFunctionCall(action.toolName(), action.args()));
        safeSend(emitter, "tool", Map.of("name", action.toolName()));
        Map<String, Object> result = dispatch(role, action.toolName(), action.args());
        emitCards(role, action.toolName(), action.args(), result, emitter);
        history.add(functionResponse(action.toolName(), modelView(result)));
        streamLoop(role, sessionId, context, history, tools, systemPrompt, emitter, new boolean[]{false});
    }

    /** Vòng lặp tool-calling chung cho stream: dùng cho cả lượt mới và lượt tiếp sau xác nhận. */
    private void streamLoop(ChatRole role, String sessionId, ChatContext context,
                            List<Map<String, Object>> history, List<Map<String, Object>> tools,
                            String systemPrompt, SseEmitter emitter, boolean[] emitted) {
        Consumer<String> onDelta = piece -> {
            emitted[0] = true;
            sendDelta(emitter, piece);
        };
        try {
            for (int i = 0; i < MAX_TOOL_ITERATIONS; i++) {
                ChatGeminiClient.GeminiTurn turn = geminiClient.generateStream(history, tools, systemPrompt, onDelta);
                if (turn.isFunctionCall()) {
                    if (isConfirmRequired(role, turn.functionName())) {
                        requestConfirmation(role, sessionId, turn, history, emitter);
                        return;
                    }
                    history.add(modelFunctionCall(turn.functionName(), turn.functionArgs()));
                    safeSend(emitter, "tool", Map.of("name", turn.functionName()));
                    Map<String, Object> result = dispatch(role, turn.functionName(),
                            augmentArgs(role, turn.functionName(), turn.functionArgs(), context));
                    emitCards(role, turn.functionName(), turn.functionArgs(), result, emitter);
                    history.add(functionResponse(turn.functionName(), modelView(result)));
                    continue;
                }
                String text = turn.text();
                if (text == null || text.isBlank()) {
                    text = "Mình chưa rõ ý bạn lắm, bạn nói rõ hơn giúp mình nhé.";
                    if (!emitted[0]) {
                        sendDelta(emitter, text);
                    }
                }
                history.add(modelTextContent(text));
                sessionService.save(sessionId, history);
                finish(emitter, sessionId);
                return;
            }
            String giveUp = "Xin lỗi, mình chưa xử lý xong yêu cầu này. Bạn thử diễn đạt lại nhé.";
            if (!emitted[0]) {
                sendDelta(emitter, giveUp);
            }
            history.add(modelTextContent(giveUp));
            sessionService.save(sessionId, history);
            finish(emitter, sessionId);
        } catch (Exception e) {
            log.warn("[Chat] stream role={} lỗi xử lý: {}", role, e.getMessage());
            if (!emitted[0]) {
                sendDelta(emitter, FALLBACK_MSG);
            }
            finish(emitter, sessionId);
        }
    }

    /**
     * Model muốn chạy 1 write tool → KHÔNG thực thi: lưu pending, gửi câu hỏi xác nhận (delta)
     * + event {@code confirm} (để client render nút Có/Không), rồi kết thúc lượt.
     */
    private void requestConfirmation(ChatRole role, String sessionId, ChatGeminiClient.GeminiTurn turn,
                                     List<Map<String, Object>> history, SseEmitter emitter) {
        String summary = confirmSummary(turn.functionName(), turn.functionArgs());
        String ask = "Bạn xác nhận " + summary + " không?";
        pendingActionStore.put(sessionId, role, turn.functionName(), turn.functionArgs());
        sendDelta(emitter, ask);
        safeSend(emitter, "confirm", obj("name", turn.functionName(), "summary", summary));
        history.add(modelTextContent(ask));
        sessionService.save(sessionId, history);
        finish(emitter, sessionId);
    }

    // ── Confirmation helpers ───────────────────────────────────────────────────

    private boolean isConfirmRequired(ChatRole role, String name) {
        return role == ChatRole.PARTNER ? PARTNER_CONFIRM.contains(name) : CUSTOMER_CONFIRM.contains(name);
    }

    /** Câu mô tả tiếng Việt cho thao tác ghi, hiển thị trước khi xác nhận. */
    private String confirmSummary(String name, Map<String, Object> args) {
        Map<String, Object> a = args == null ? Map.of() : args;
        return switch (name) {
            case "cancel_my_booking" -> "huỷ đơn #" + a.get("bookingId");
            case "create_booking_hold" -> "giữ phòng để đặt từ " + a.get("checkIn") + " đến " + a.get("checkOut")
                    + " (" + a.getOrDefault("quantity", 1) + " phòng)";
            case "block_room" -> ("unblock".equalsIgnoreCase(String.valueOf(a.get("action"))) ? "mở khoá" : "khoá")
                    + " phòng #" + a.get("roomId") + " từ " + a.get("dateFrom") + " đến " + a.get("dateTo");
            case "set_room_price" -> "đặt giá " + a.get("price") + "đ/đêm cho phòng #" + a.get("roomId")
                    + " từ " + a.get("dateFrom") + " đến " + a.get("dateTo");
            case "reply_to_review" -> "gửi phản hồi cho đánh giá #" + a.get("reviewId");
            default -> "thực hiện thao tác này";
        };
    }

    /**
     * Bổ sung toạ độ khách (từ ChatContext) vào args của tool tìm/gợi ý KS để hỗ trợ "gần tôi".
     * Chỉ áp dụng cho customer; trả nguyên args nếu không có toạ độ. Không sửa args gốc (history).
     */
    private Map<String, Object> augmentArgs(ChatRole role, String name, Map<String, Object> args, ChatContext context) {
        if (role != ChatRole.CUSTOMER || context == null || context.lat() == null || context.lng() == null) {
            return args;
        }
        if (!"suggest_hotels".equals(name) && !"search_rooms".equals(name)) {
            return args;
        }
        Map<String, Object> copy = new HashMap<>(args == null ? Map.of() : args);
        copy.putIfAbsent("lat", context.lat());
        copy.putIfAbsent("lng", context.lng());
        return copy;
    }

    // ── Cards (SSE) ────────────────────────────────────────────────────────────

    private void emitCards(ChatRole role, String fnName, Map<String, Object> args,
                           Map<String, Object> result, SseEmitter emitter) {
        if (role == ChatRole.CUSTOMER) {
            emitHotelCards(emitter, fnName, args, result);
            emitPaymentCard(emitter, fnName, result);
        } else {
            emitPartnerCards(emitter, fnName, result);
        }
    }

    private void sendDelta(SseEmitter emitter, String text) {
        safeSend(emitter, "delta", Map.of("text", text));
    }

    private void finish(SseEmitter emitter, String sessionId) {
        safeSend(emitter, "done", Map.of("sessionId", sessionId));
        try {
            emitter.complete();
        } catch (Exception ignored) {
            // emitter có thể đã đóng (client ngắt) — bỏ qua.
        }
    }

    private void safeSend(SseEmitter emitter, String event, Object data) {
        try {
            emitter.send(SseEmitter.event().name(event).data(data, MediaType.APPLICATION_JSON));
        } catch (Exception e) {
            // Client ngắt kết nối hoặc emitter đã đóng — không cần làm gì thêm.
            log.debug("[Chat] không gửi được SSE event {}: {}", event, e.getMessage());
        }
    }

    /**
     * Sau khi tool search_rooms/suggest_hotels chạy, phát thêm SSE event "cards" để client render
     * thẻ khách sạn có nút đặt phòng. Kèm checkIn/checkOut/guests (từ args search_rooms) để deep-link
     * mang theo tiêu chí; suggest_hotels không có ngày nên các trường đó để null.
     */
    private void emitHotelCards(SseEmitter emitter, String fnName, Map<String, Object> args,
                                Map<String, Object> result) {
        if (!"search_rooms".equals(fnName) && !"suggest_hotels".equals(fnName)) {
            return;
        }
        if (!(result.get("hotels") instanceof List<?> hotels) || hotels.isEmpty()) {
            return;
        }
        List<Map<String, Object>> items = new ArrayList<>();
        for (Object o : hotels) {
            if (!(o instanceof Map<?, ?> h)) {
                continue;
            }
            Object fromPrice = h.containsKey("fromPrice") ? h.get("fromPrice") : h.get("fromPricePerNight");
            items.add(obj(
                    "hotelId", h.get("hotelId"),
                    "name", h.get("hotelName"),
                    "location", joinLocation(h.get("district"), h.get("province")),
                    "image", h.get("coverImage"),
                    "rating", h.get("ratingAvg"),
                    "fromPrice", fromPrice));
            if (items.size() >= 8) {
                break;
            }
        }
        if (items.isEmpty()) {
            return;
        }
        safeSend(emitter, "cards", obj(
                "kind", "hotel",
                "items", items,
                "checkIn", args == null ? null : args.get("checkIn"),
                "checkOut", args == null ? null : args.get("checkOut"),
                "guests", args == null ? null : args.get("guests")));
    }

    /** Thẻ "Đi tới thanh toán" sau khi create_booking_hold giữ phòng thành công. */
    private void emitPaymentCard(SseEmitter emitter, String fnName, Map<String, Object> result) {
        if (!"create_booking_hold".equals(fnName) || result.get("bookingId") == null) {
            return;
        }
        safeSend(emitter, "cards", obj(
                "kind", "payment",
                "items", List.of(obj(
                        "bookingId", result.get("bookingId"),
                        "totalPrice", result.get("totalPrice"),
                        "payUrl", result.get("payUrl")))));
    }

    /**
     * Thẻ cho partner: booking sắp check-in (get_upcoming_checkins) → mở chi tiết booking;
     * phòng còn trống (get_available_rooms) → mở lịch phòng. Mỗi kind có layout/nút riêng ở client.
     */
    private void emitPartnerCards(SseEmitter emitter, String fnName, Map<String, Object> result) {
        if ("get_upcoming_checkins".equals(fnName)) {
            if (!(result.get("bookings") instanceof List<?> bookings) || bookings.isEmpty()) {
                return;
            }
            List<Map<String, Object>> items = new ArrayList<>();
            for (Object o : bookings) {
                if (!(o instanceof Map<?, ?> b)) {
                    continue;
                }
                items.add(obj(
                        "bookingId", b.get("bookingId"),
                        "customerName", b.get("customerName"),
                        "hotelName", b.get("hotelName"),
                        "checkIn", b.get("checkIn"),
                        "checkOut", b.get("checkOut"),
                        "guests", b.get("guests"),
                        "status", b.get("status")));
                if (items.size() >= 8) {
                    break;
                }
            }
            if (!items.isEmpty()) {
                safeSend(emitter, "cards", obj("kind", "booking", "items", items));
            }
        } else if ("get_available_rooms".equals(fnName)) {
            if (!(result.get("rooms") instanceof List<?> rooms) || rooms.isEmpty()) {
                return;
            }
            List<Map<String, Object>> items = new ArrayList<>();
            for (Object o : rooms) {
                if (!(o instanceof Map<?, ?> r)) {
                    continue;
                }
                items.add(obj(
                        "roomId", r.get("roomId"),
                        "roomName", r.get("roomName"),
                        "hotelName", r.get("hotelName"),
                        "minSellable", r.get("minSellable")));
                if (items.size() >= 8) {
                    break;
                }
            }
            if (!items.isEmpty()) {
                safeSend(emitter, "cards", obj("kind", "room", "items", items));
            }
        }
    }

    private String joinLocation(Object district, Object province) {
        String d = district == null ? "" : String.valueOf(district).trim();
        String p = province == null ? "" : String.valueOf(province).trim();
        if (d.isEmpty()) {
            return p.isEmpty() ? null : p;
        }
        return p.isEmpty() ? d : d + ", " + p;
    }

    private Map<String, Object> dispatch(ChatRole role, String name, Map<String, Object> args) {
        try {
            return role == ChatRole.PARTNER
                    ? partnerToolService.execute(name, args)
                    : customerToolService.execute(name, args);
        } catch (ApiException e) {
            return Map.of("error", e.getMessage() != null ? e.getMessage() : e.getCode().name());
        } catch (Exception e) {
            log.warn("[Chat] tool {} lỗi: {}", name, e.getMessage());
            return Map.of("error", "Không thực hiện được thao tác này.");
        }
    }

    // ── Model view (rút gọn tool result trước khi đưa vào history) ───────────────

    /**
     * Bản rút gọn của tool result để nhét vào history gửi Gemini: loại bỏ {@link #MODEL_OMIT_KEYS}
     * (đệ quy qua map/list lồng nhau). Trả map MỚI — không sửa result gốc (thẻ UI vẫn dùng bản đầy đủ).
     */
    private Map<String, Object> modelView(Map<String, Object> result) {
        return stripMap(result);
    }

    private Map<String, Object> stripMap(Map<String, Object> src) {
        Map<String, Object> out = new LinkedHashMap<>();
        for (Map.Entry<String, Object> e : src.entrySet()) {
            if (MODEL_OMIT_KEYS.contains(e.getKey())) {
                continue;
            }
            out.put(e.getKey(), stripValue(e.getValue()));
        }
        return out;
    }

    @SuppressWarnings("unchecked")
    private Object stripValue(Object v) {
        if (v instanceof Map<?, ?> m) {
            return stripMap((Map<String, Object>) m);
        }
        if (v instanceof List<?> list) {
            List<Object> out = new ArrayList<>(list.size());
            for (Object o : list) {
                out.add(stripValue(o));
            }
            return out;
        }
        return v;
    }

    // ── Gemini Content builders ──────────────────────────────────────────────

    private Map<String, Object> userContent(String text) {
        return Map.of("role", "user", "parts", List.of(Map.of("text", text == null ? "" : text)));
    }

    private Map<String, Object> modelTextContent(String text) {
        return Map.of("role", "model", "parts", List.of(Map.of("text", text == null ? "" : text)));
    }

    private Map<String, Object> modelFunctionCall(String name, Map<String, Object> args) {
        return Map.of("role", "model", "parts",
                List.of(Map.of("functionCall", Map.of("name", name, "args", args == null ? Map.of() : args))));
    }

    private Map<String, Object> functionResponse(String name, Map<String, Object> result) {
        return Map.of("role", "user", "parts",
                List.of(Map.of("functionResponse", Map.of("name", name, "response", result))));
    }

    // ── System prompts ───────────────────────────────────────────────────────

    private String customerSystemPrompt(ChatContext context) {
        Long currentHotelId = context != null ? context.hotelId() : null;
        boolean hasLocation = context != null && context.lat() != null && context.lng() != null;
        return """
                Bạn là trợ lý đặt phòng của HotelHub — nền tảng đặt phòng khách sạn trực tuyến.
                Nhiệm vụ: giúp khách tìm phòng, đặt/huỷ phòng, tra cứu booking, trả lời thắc mắc.
                Ngôn ngữ: tiếng Việt, thân thiện tự nhiên.

                Quy tắc:
                - Không bịa thông tin — chỉ trả lời dựa trên kết quả từ tool.
                - Tìm phòng được hỗ trợ theo địa điểm: khách nêu tỉnh/thành phố hoặc quận/huyện
                  thì truyền vào tham số location của search_rooms (không bắt buộc khách phải nêu tên khách sạn).
                - Lọc nâng cao: nếu khách nêu tiện nghi (hồ bơi, đỗ xe, gym, spa…) thì truyền vào tham số
                  amenities; nếu nêu khoảng giá thì dùng minPrice/maxPrice.
                - Có thể so sánh các khách sạn vừa tìm theo giá/đánh giá/tiện nghi khi khách yêu cầu.%s
                - Khi khách hỏi "gần đây/xung quanh có gì" (ăn uống, tham quan), gọi get_nearby_attractions và
                  chia sẻ liên kết bản đồ (mapsUrl) trả về — KHÔNG tự liệt kê tên địa điểm cụ thể vì có thể sai.
                - Khi khách đã đăng nhập muốn đặt nhanh một phòng cụ thể (đã rõ khách sạn, phòng, ngày), dùng
                  create_booking_hold để giữ phòng rồi hướng dẫn thanh toán. Khi khách muốn huỷ đơn của họ, dùng
                  cancel_my_booking. Nếu khách chưa đăng nhập, mời khách đăng nhập hoặc mở trang khách sạn để đặt.
                - Tư vấn trước khi tìm: khi yêu cầu còn chung chung, hãy HỎI để hiểu rõ nhu cầu rồi mới gọi tool —
                  ưu tiên nắm: địa điểm; ngày nhận–trả & số khách; ngân sách mỗi đêm; ưu tiên/tiện nghi
                  (gần biển, trung tâm, yên tĩnh, hồ bơi, đỗ xe…). Gom 2–3 ý vào MỘT câu hỏi ngắn, thân thiện;
                  hỏi tối đa 2 lượt, không tra hỏi từng thứ một và không hỏi lại điều khách đã nói.
                - Quy đổi ngân sách dạng lời nói thành minPrice/maxPrice: "dưới 1 triệu" → maxPrice=1000000;
                  "tầm 500–800k" → minPrice=500000, maxPrice=800000; "rẻ/bình dân" → đặt maxPrice hợp lý.
                - Khi đã đủ địa điểm + ngày + số khách thì gọi search_rooms NGAY, kèm MỌI tiêu chí đã thu thập
                  (minPrice/maxPrice/amenities/location) để kết quả khớp nhất. Khách chưa có ngày cụ thể thì dùng
                  suggest_hotels (cũng truyền kèm location/amenities/khoảng giá). Khách đã nói rõ hết ngay từ đầu
                  thì tìm luôn, không hỏi thêm cho có.
                - Nếu tool trả về không có kết quả, thông báo lịch sự và gợi ý thay đổi tiêu chí.
                - Khi liệt kê khách sạn/phòng, trình bày ngắn gọn (giao diện đã hiển thị thẻ khách sạn
                  kèm nút đặt riêng) — không cần lặp lại toàn bộ giá từng phòng.
                - Không trả lời các chủ đề ngoài phạm vi đặt phòng khách sạn.%s
                - Hôm nay là %s.
                """.formatted(
                        hasLocation
                                ? "\n                - Hệ thống đã có vị trí hiện tại của khách: khi khách muốn tìm khách sạn"
                                        + " \"gần tôi\", gọi suggest_hotels với sortBy='distance' (không cần hỏi toạ độ)."
                                : "",
                        customerContextLines(currentHotelId),
                        LocalDate.now());
    }

    /**
     * Các dòng ngữ cảnh động thêm vào system prompt customer: trạng thái đăng nhập (để dùng
     * get_my_bookings) và khách sạn đang xem (để hiểu "phòng này / đặt phòng này"). Trả "" nếu không có.
     */
    private String customerContextLines(Long currentHotelId) {
        StringBuilder sb = new StringBuilder();
        JwtPrincipal principal = securityService.getCurrentPrincipalOrNull();
        if (principal != null) {
            String name = userProfileRepository.findByUserId(principal.userId())
                    .map(p -> firstNonBlank(p.getFullName(), p.getBrandName()))
                    .filter(s -> s != null && !s.isBlank())
                    .orElse(null);
            sb.append("\n                - Khách đã đăng nhập")
                    .append(name != null ? " (tên: " + name + ")" : "")
                    .append(". Khi khách hỏi về đơn của họ, dùng get_my_bookings — không cần hỏi email/phone.");
        }
        if (currentHotelId != null) {
            hotelRepository.findById(currentHotelId).ifPresent(h -> sb
                    .append("\n                - Khách đang xem khách sạn \"").append(h.getName())
                    .append("\" (hotelId=").append(currentHotelId).append("). Khi khách nói \"phòng này\", ")
                    .append("\"khách sạn này\", \"đặt phòng này\" thì hiểu là khách sạn này — truyền hotelId này vào tool."));
        }
        return sb.toString();
    }

    private String partnerSystemPrompt(ChatContext context) {
        long ownerId = securityService.getCurrentPrincipal().userId();
        String partnerName = userProfileRepository.findByUserId(ownerId)
                .map(p -> firstNonBlank(p.getBrandName(), p.getFullName()))
                .filter(s -> s != null && !s.isBlank())
                .orElse("đối tác");
        List<Hotel> hotels = hotelRepository.findByOwnerId(ownerId);
        String propertyName = hotels.isEmpty()
                ? "(chưa có khách sạn)"
                : hotels.stream().map(Hotel::getName).collect(Collectors.joining(", "));

        return """
                Bạn là trợ lý quản lý của HotelHub dành cho đối tác.
                Đối tác hiện tại: %s — Khách sạn: %s
                Nhiệm vụ: hỗ trợ xem thống kê, quản lý phòng, theo dõi booking, trả lời đánh giá.
                Ngôn ngữ: tiếng Việt, ngắn gọn chuyên nghiệp.

                Quy tắc:
                - Chỉ được truy cập dữ liệu thuộc khách sạn của đối tác này.
                - Không bịa số liệu — chỉ trả lời dựa trên kết quả từ tool.
                - "Tổng quan hôm nay" → dùng get_today_overview; hỏi xu hướng/so sánh doanh thu → get_revenue_trend.
                - Muốn trả lời một đánh giá: trước tiên get_recent_reviews để lấy reviewId, rồi reply_to_review.
                - Nếu thiếu thông tin để gọi tool, hỏi lại ngắn gọn — mỗi lần chỉ hỏi 1 thông tin còn thiếu.
                - Khi đã đủ thông tin thì gọi tool ngay, không hỏi thêm.
                - Với thao tác ghi (block/unblock phòng, đổi giá phòng, trả lời đánh giá): hệ thống sẽ hiện nút
                  xác nhận cho người dùng — bạn chỉ cần gọi tool, KHÔNG cần hỏi xác nhận lại bằng lời.%s
                - Hôm nay là %s.
                """.formatted(partnerName, propertyName, partnerContextLines(context), LocalDate.now());
    }

    /** Dòng ngữ cảnh động cho partner: tab đang xem + booking đang xem (cho "đơn này"). "" nếu không có. */
    private String partnerContextLines(ChatContext context) {
        if (context == null) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        if (context.page() != null && !context.page().isBlank()) {
            sb.append("\n                - Đối tác đang xem trang: ").append(context.page()).append(".");
        }
        if (context.bookingId() != null) {
            sb.append("\n                - Đang xem chi tiết booking #").append(context.bookingId())
                    .append("; khi đối tác nói \"đơn này / booking này\" thì hiểu là booking đó.");
        }
        return sb.toString();
    }

    private String firstNonBlank(String a, String b) {
        return (a != null && !a.isBlank()) ? a : b;
    }
}
