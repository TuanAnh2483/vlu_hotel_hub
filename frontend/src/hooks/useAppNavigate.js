import { useNavigate } from "react-router-dom";

// Chuyển đổi tên trang (navigate("hotel", ...)) thành URL React Router thực.
// Các page component không cần biết cấu trúc URL; hook này xử lý tập trung.

function toSearchString(params = {}) {
  const entries = Object.entries(params).filter(([, v]) => v !== "" && v != null);
  return entries.length > 0 ? "?" + new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString() : "";
}

export function useAppNavigate() {
  const rrNavigate = useNavigate();

  return function navigate(pageName, params = {}) {
    switch (pageName) {
      // ── Public ──────────────────────────────────────────────────────
      case "home":
        return rrNavigate("/");

      case "hotels": {
        const { province, district, checkIn, checkOut, guests, rooms, hotelTypes, sort } = params;
        return rrNavigate("/hotels" + toSearchString({ province, district, checkIn, checkOut, guests, rooms, hotelTypes, sort }));
      }

      case "search": {
        const { province, district, checkIn, checkOut, guests, rooms, hotelTypes, sort } = params;
        return rrNavigate("/hotels" + toSearchString({ province, district, checkIn, checkOut, guests, rooms, hotelTypes, sort }));
      }

      case "hotel": {
        const { hotelId, ...rest } = params;
        return rrNavigate(`/hotels/${hotelId}` + toSearchString(rest));
      }

      // ── Customer (auth-required) ─────────────────────────────────────
      case "booking":
        return rrNavigate("/book", { state: params });

      case "my-bookings":
        return rrNavigate("/customer/bookings");
      case "refund-request": {
        const { bookingId: rfId } = params;
        return rrNavigate(`/customer/refund-request/${rfId}`);
      }
      case "payment":
        if (params.bookingId) return rrNavigate(`/payment/${params.bookingId}`, { state: params });
        return rrNavigate("/customer/bookings");
      case "payment-success":
        return rrNavigate("/payment/success", { state: params });
      case "payment-failed":
        return rrNavigate("/payment/failed", { state: params });

      case "booking-detail":
        return rrNavigate(`/customer/bookings/${params.bookingId}`, { state: params });

      case "customer-profile":
        return rrNavigate("/profile");

      case "customer-reviews":
        return rrNavigate("/customer/reviews");

      case "profile":
        return rrNavigate("/profile");

      // ── Partner ─────────────────────────────────────────────────────
      case "partner-dashboard":
        return rrNavigate("/partner");
      case "partner-hotels":
        return rrNavigate("/partner/hotels");
      case "partner-rooms": {
        const { hotelId: rHotelId, ...rRest } = params;
        return rrNavigate("/partner/rooms" + toSearchString(rHotelId ? { hotelId: rHotelId, ...rRest } : rRest));
      }
      case "partner-calendar":
        return rrNavigate("/partner/calendar");
      case "partner-bookings":
        return rrNavigate("/partner/bookings");
      case "partner-reviews":
        return rrNavigate("/partner/reviews");
      case "partner-revenue":
        return rrNavigate("/partner/revenue");
      case "partner-forecast":
        return rrNavigate("/partner/forecast");

      // ── Admin ────────────────────────────────────────────────────────
      case "partner-manage":
        return rrNavigate("/partner-manage");

      // ── Admin ────────────────────────────────────────────────────────
      case "admin-dashboard":
        return rrNavigate("/admin");
      case "admin-users":
        return rrNavigate("/admin/users");
      case "admin-partners":
        return rrNavigate("/admin/partners");
      case "admin-hotels":
        return rrNavigate("/admin/hotels");
      case "admin-bookings":
        return rrNavigate("/admin/bookings");
      case "admin-refunds":
        return rrNavigate("/admin/refunds");
      case "admin-reviews":
        return rrNavigate("/admin/reviews");
      case "admin-system":
        return rrNavigate("/admin/system");

      // ── Auth ────────────────────────────────────────────────────────
      case "login":
        return rrNavigate("/login");
      case "register":
        return rrNavigate("/register");
      case "forgot":
        return rrNavigate("/forgot-password");
      case "reset-password":
        return rrNavigate("/reset-password" + toSearchString(params));
      case "become-partner":
        return rrNavigate("/become-partner");

      default:
        return rrNavigate("/");
    }
  };
}
