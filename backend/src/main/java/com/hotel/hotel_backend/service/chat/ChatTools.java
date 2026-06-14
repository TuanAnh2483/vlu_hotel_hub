package com.hotel.hotel_backend.service.chat;

import java.util.List;
import java.util.Map;

import static com.hotel.hotel_backend.service.chat.ChatJsonUtil.obj;

/**
 * Khai báo function declarations gửi cho Gemini (metadata JSON, không chứa logic).
 * Partner tools KHÔNG khai báo propertyId/ownerId — backend tự lấy từ JWT.
 */
final class ChatTools {

    private ChatTools() {
    }

    static final List<Map<String, Object>> CUSTOMER_TOOLS = List.of(
            decl("search_rooms",
                    "Tìm kiếm phòng còn trống theo tiêu chí của khách. Hỗ trợ lọc theo địa điểm "
                            + "(tỉnh/thành phố hoặc quận/huyện) qua tham số location, theo tiện nghi và khoảng giá.",
                    obj("type", "object",
                            "properties", obj(
                                    "checkIn", str("Ngày nhận phòng, định dạng yyyy-MM-dd"),
                                    "checkOut", str("Ngày trả phòng, định dạng yyyy-MM-dd"),
                                    "guests", integer("Số người ở"),
                                    "location", str("Địa điểm khách muốn ở: tên tỉnh/thành phố hoặc quận/huyện "
                                            + "(ví dụ: Hồ Chí Minh, Đà Nẵng, Quận 1). Tuỳ chọn."),
                                    "minPrice", number("Giá tối thiểu mỗi đêm (VND), tuỳ chọn"),
                                    "maxPrice", number("Giá tối đa mỗi đêm (VND), tuỳ chọn"),
                                    "amenities", strArray("Tiện nghi khách sạn cần có, ví dụ: hồ bơi, đỗ xe, gym, "
                                            + "spa, wifi, ăn sáng. Tuỳ chọn."),
                                    "hotelId", integer("ID khách sạn cụ thể nếu khách hỏi đích danh, tuỳ chọn")
                            ),
                            "required", List.of("checkIn", "checkOut", "guests"))),

            decl("get_booking_status",
                    "Tra cứu trạng thái booking theo mã đặt phòng",
                    obj("type", "object",
                            "properties", obj("bookingCode", integer("Mã booking (id)")),
                            "required", List.of("bookingCode"))),

            decl("find_booking_by_contact",
                    "Tra cứu các booking của khách theo email hoặc số điện thoại đã dùng khi đặt phòng "
                            + "(dùng khi khách không nhớ mã booking). Phải có ít nhất email hoặc phone.",
                    obj("type", "object",
                            "properties", obj(
                                    "email", str("Email đã dùng khi đặt phòng, tuỳ chọn"),
                                    "phone", str("Số điện thoại đã dùng khi đặt phòng, tuỳ chọn")
                            ),
                            "required", List.of())),

            decl("get_my_bookings",
                    "Xem các booking của chính khách đang đăng nhập (không cần email/phone). Dùng khi khách "
                            + "đã đăng nhập hỏi 'đơn của tôi', 'booking của tôi'. Nếu khách chưa đăng nhập, "
                            + "tool trả về authenticated=false — khi đó hãy hỏi email/phone và dùng find_booking_by_contact.",
                    obj("type", "object",
                            "properties", obj(),
                            "required", List.of())),

            decl("suggest_hotels",
                    "Gợi ý khách sạn nổi bật (rating cao), giá rẻ hoặc gần vị trí khách, có thể lọc theo địa điểm/tiện nghi. "
                            + "Dùng khi khách hỏi chung chung chưa có ngày cụ thể. Dùng sortBy='distance' khi khách muốn "
                            + "khách sạn gần vị trí hiện tại (hệ thống tự cung cấp toạ độ).",
                    obj("type", "object",
                            "properties", obj(
                                    "location", str("Tỉnh/thành phố hoặc quận/huyện muốn lọc, tuỳ chọn"),
                                    "amenities", strArray("Tiện nghi cần có (hồ bơi, đỗ xe, gym, spa…), tuỳ chọn"),
                                    "minPrice", number("Giá tối thiểu mỗi đêm (VND), tuỳ chọn"),
                                    "maxPrice", number("Giá tối đa mỗi đêm (VND), tuỳ chọn"),
                                    "sortBy", enumStr("Tiêu chí xếp hạng: rating (mặc định), price, hoặc distance (gần tôi)",
                                            List.of("rating", "price", "distance"))
                            ),
                            "required", List.of())),

            decl("get_hotel_faq",
                    "Trả lời câu hỏi thường gặp về chính sách khách sạn (huỷ phòng, nhận/trả phòng, tiện nghi, thanh toán)",
                    obj("type", "object",
                            "properties", obj(
                                    "topic", enumStr("Chủ đề câu hỏi",
                                            List.of("cancellation", "checkin", "checkout", "amenities", "payment", "general")),
                                    "hotelId", integer("ID khách sạn nếu hỏi về khách sạn cụ thể, tuỳ chọn")
                            ),
                            "required", List.of("topic"))),

            decl("get_nearby_attractions",
                    "Lấy liên kết bản đồ để khám phá địa điểm (ăn uống, tham quan…) quanh khách sạn. "
                            + "Trả về mapsUrl — hãy chia sẻ liên kết này cho khách thay vì tự liệt kê tên địa điểm.",
                    obj("type", "object",
                            "properties", obj(
                                    "hotelId", integer("ID khách sạn"),
                                    "category", enumStr("Loại địa điểm, tuỳ chọn",
                                            List.of("food", "entertainment", "shopping", "nature", "all"))
                            ),
                            "required", List.of("hotelId"))),

            decl("cancel_my_booking",
                    "Huỷ một booking của chính khách đang đăng nhập. Chỉ huỷ được đơn chưa hoàn tất. "
                            + "Hệ thống sẽ hiện nút xác nhận trước khi huỷ.",
                    obj("type", "object",
                            "properties", obj("bookingId", integer("ID đơn cần huỷ")),
                            "required", List.of("bookingId"))),

            decl("create_booking_hold",
                    "Giữ phòng (tạo đơn chờ thanh toán) cho khách đã đăng nhập theo phòng/ngày cụ thể, rồi đưa link "
                            + "thanh toán. Cần biết hotelId, roomId, ngày nhận/trả và số khách. Hệ thống sẽ hiện nút xác nhận.",
                    obj("type", "object",
                            "properties", obj(
                                    "hotelId", integer("ID khách sạn"),
                                    "roomId", integer("ID loại phòng cần đặt"),
                                    "checkIn", str("Ngày nhận phòng, định dạng yyyy-MM-dd"),
                                    "checkOut", str("Ngày trả phòng, định dạng yyyy-MM-dd"),
                                    "guests", integer("Số người ở"),
                                    "quantity", integer("Số phòng cần đặt, mặc định 1")
                            ),
                            "required", List.of("roomId", "checkIn", "checkOut")))
    );

    static final List<Map<String, Object>> PARTNER_TOOLS = List.of(
            decl("get_available_rooms",
                    "Xem danh sách phòng còn trống của đối tác trong khoảng thời gian",
                    obj("type", "object",
                            "properties", obj(
                                    "dateFrom", str("Ngày bắt đầu, định dạng yyyy-MM-dd"),
                                    "dateTo", str("Ngày kết thúc, định dạng yyyy-MM-dd")
                            ),
                            "required", List.of("dateFrom", "dateTo"))),

            decl("get_revenue_stats",
                    "Xem thống kê doanh thu theo tháng của đối tác",
                    obj("type", "object",
                            "properties", obj(
                                    "month", integer("Tháng, 1-12"),
                                    "year", integer("Năm, ví dụ 2026")
                            ),
                            "required", List.of("month", "year"))),

            decl("get_upcoming_checkins",
                    "Xem danh sách booking sắp check-in hoặc chưa xác nhận",
                    obj("type", "object",
                            "properties", obj(
                                    "days", integer("Số ngày tới cần xem, mặc định 3"),
                                    "status", enumStr("Lọc trạng thái, mặc định all",
                                            List.of("pending", "confirmed", "all"))
                            ),
                            "required", List.of())),

            decl("block_room",
                    "Block hoặc unblock phòng trong khoảng thời gian. PHẢI xác nhận với người dùng trước khi gọi tool này.",
                    obj("type", "object",
                            "properties", obj(
                                    "roomId", integer("ID loại phòng"),
                                    "dateFrom", str("Ngày bắt đầu, định dạng yyyy-MM-dd"),
                                    "dateTo", str("Ngày kết thúc, định dạng yyyy-MM-dd"),
                                    "action", enumStr("Hành động", List.of("block", "unblock")),
                                    "reason", str("Lý do block, tuỳ chọn")
                            ),
                            "required", List.of("roomId", "dateFrom", "dateTo", "action"))),

            decl("set_room_price",
                    "Đặt giá phòng (VND/đêm) cho một khoảng ngày. PHẢI xác nhận rõ ràng với đối tác "
                            + "(roomId, khoảng ngày, mức giá) TRƯỚC khi gọi tool này.",
                    obj("type", "object",
                            "properties", obj(
                                    "roomId", integer("ID loại phòng"),
                                    "dateFrom", str("Ngày bắt đầu, định dạng yyyy-MM-dd"),
                                    "dateTo", str("Ngày kết thúc, định dạng yyyy-MM-dd"),
                                    "price", number("Giá mới mỗi đêm (VND), >= 0")
                            ),
                            "required", List.of("roomId", "dateFrom", "dateTo", "price"))),

            decl("get_occupancy_rate",
                    "Xem tỷ lệ lấp đầy (occupancy) của khách sạn đối tác trong khoảng ngày: "
                            + "phần trăm phòng đã đặt/khoá trên tổng phòng mở bán.",
                    obj("type", "object",
                            "properties", obj(
                                    "dateFrom", str("Ngày bắt đầu, định dạng yyyy-MM-dd"),
                                    "dateTo", str("Ngày kết thúc, định dạng yyyy-MM-dd"),
                                    "hotelId", integer("ID khách sạn cụ thể, tuỳ chọn (bỏ trống = tất cả KS của đối tác)")
                            ),
                            "required", List.of("dateFrom", "dateTo"))),

            decl("get_recent_reviews",
                    "Xem đánh giá gần đây của khách sạn đối tác (kèm reviewId để có thể trả lời). "
                            + "Dùng để tóm tắt cảm nhận khách, điểm cần cải thiện, hoặc lấy reviewId trước khi reply_to_review.",
                    obj("type", "object",
                            "properties", obj(
                                    "hotelId", integer("ID khách sạn cụ thể, tuỳ chọn"),
                                    "rating", integer("Lọc theo số sao 1-5, tuỳ chọn"),
                                    "limit", integer("Số đánh giá tối đa cần xem (mặc định 5, tối đa 10)")
                            ),
                            "required", List.of())),

            decl("get_booking_detail",
                    "Xem chi tiết một booking thuộc khách sạn của đối tác (trạng thái, ngày, khách, phòng, tổng tiền).",
                    obj("type", "object",
                            "properties", obj("bookingId", integer("ID booking cần xem")),
                            "required", List.of("bookingId"))),

            decl("get_today_overview",
                    "Tổng quan nhanh cho đối tác hôm nay: số khách check-in hôm nay, đơn chờ thanh toán, "
                            + "doanh thu tháng hiện tại và các phòng sắp hết chỗ trong 7 ngày tới.",
                    obj("type", "object",
                            "properties", obj(),
                            "required", List.of())),

            decl("get_revenue_trend",
                    "Xu hướng doanh thu theo tháng để đối tác thấy biến động: chuỗi nhiều tháng gần nhất, "
                            + "thay đổi so tháng trước (MoM) và so cùng kỳ năm trước (YoY).",
                    obj("type", "object",
                            "properties", obj(
                                    "year", integer("Năm cần xem, mặc định năm hiện tại"),
                                    "months", integer("Số tháng gần nhất cần xem, mặc định 6")
                            ),
                            "required", List.of())),

            decl("reply_to_review",
                    "Gửi phản hồi của đối tác cho một đánh giá của khách. Lấy reviewId từ get_recent_reviews. "
                            + "Hệ thống sẽ hiện nút xác nhận trước khi gửi.",
                    obj("type", "object",
                            "properties", obj(
                                    "reviewId", integer("ID đánh giá cần trả lời"),
                                    "reply", str("Nội dung phản hồi gửi tới khách")
                            ),
                            "required", List.of("reviewId", "reply")))
    );

    private static Map<String, Object> decl(String name, String description, Map<String, Object> parameters) {
        return obj("name", name, "description", description, "parameters", parameters);
    }

    private static Map<String, Object> str(String description) {
        return obj("type", "string", "description", description);
    }

    private static Map<String, Object> integer(String description) {
        return obj("type", "integer", "description", description);
    }

    private static Map<String, Object> number(String description) {
        return obj("type", "number", "description", description);
    }

    private static Map<String, Object> enumStr(String description, List<String> values) {
        return obj("type", "string", "description", description, "enum", values);
    }

    private static Map<String, Object> strArray(String description) {
        return obj("type", "array", "description", description, "items", obj("type", "string"));
    }
}
