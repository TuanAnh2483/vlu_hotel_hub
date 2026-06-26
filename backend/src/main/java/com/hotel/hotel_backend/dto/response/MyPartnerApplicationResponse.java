package com.hotel.hotel_backend.dto.response;

/**
 * Đơn đăng ký partner của chính tài khoản đang đăng nhập (dùng cho GET /partner-onboarding/my).
 * Trả về status thật để màn hình theo dõi hiển thị đúng (Đã nộp / Đang xét duyệt / Được duyệt / Từ chối).
 */
public record MyPartnerApplicationResponse(
        Long id,
        String status,
        String businessName,
        String rejectionReason
) {
}
