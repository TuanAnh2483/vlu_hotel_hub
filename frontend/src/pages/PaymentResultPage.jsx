import { useLocation, Navigate } from "react-router-dom";
import { CheckCircle2, XCircle, CreditCard } from "lucide-react";
import { C } from "../lib/constants";
import MainNavbar from "../components/MainNavbar";
import Footer from "../components/Footer";

function fmt(n) { return (n || 0).toLocaleString("vi-VN") + " ₫"; }

const CANCEL_POLICY_TEXT = {
  FLEXIBLE: "Miễn phí hủy trước 24 giờ nhận phòng",
  MODERATE: "Miễn phí hủy trước 7 ngày nhận phòng",
  STRICT:   "Chính sách không hoàn tiền khi hủy",
};

function SuccessPage({ navigate, user, onLogout, state }) {
  const { bookingId, amount, hotelName, cancellationPolicy } = state || {};

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #ffffff 0%, #fdf4f5 45%, #f7ebeb 100%)", fontFamily: "'Segoe UI',sans-serif", display: "flex", flexDirection: "column" }}>
      <MainNavbar active="my-bookings" navigate={navigate} user={user} onLogout={onLogout} />

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ background: "#fff", borderRadius: 20, padding: "52px 48px", maxWidth: 520, width: "100%", boxShadow: "0 4px 32px rgba(0,0,0,0.10)", textAlign: "center" }}>
          {/* Success icon */}
          <div style={{ width: 80, height: 80, borderRadius: "50%", background: "#e8f5e9", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
            <CheckCircle2 size={44} color="#16a34a" aria-hidden="true" />
          </div>

          <h1 style={{ fontSize: 24, fontWeight: 900, color: "#1a1a1a", marginBottom: 8 }}>
            Thanh toán thành công!
          </h1>
          <p style={{ fontSize: 14, color: "#888", marginBottom: 32, lineHeight: 1.6 }}>
            Đặt phòng của bạn đã được xác nhận. Cảm ơn bạn đã sử dụng dịch vụ của VLU HotelHub.
          </p>

          {/* Detail card */}
          <div style={{ background: "#f8fafc", borderRadius: 12, padding: "20px 24px", marginBottom: 28, textAlign: "left" }}>
            {bookingId && (
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ fontSize: 13, color: "#888" }}>Mã đặt phòng</span>
                <span style={{ fontFamily: "monospace", fontWeight: 800, fontSize: 15, color: C.primary }}>#{bookingId}</span>
              </div>
            )}
            {hotelName && (
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ fontSize: 13, color: "#888" }}>Khách sạn</span>
                <span style={{ fontWeight: 600, fontSize: 13, color: "#1a1a1a", textAlign: "right", maxWidth: 240 }}>{hotelName}</span>
              </div>
            )}
            {amount > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #e2e8f0", paddingTop: 12, marginTop: 4 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a" }}>Số tiền đã thanh toán</span>
                <span style={{ fontSize: 16, fontWeight: 900, color: "#16a34a" }}>{fmt(amount)}</span>
              </div>
            )}
          </div>

          {/* Checklist */}
          {[
            "Email xác nhận đã được gửi đến địa chỉ của bạn",
            "Xuất trình mã đặt phòng khi nhận phòng",
            ...(CANCEL_POLICY_TEXT[cancellationPolicy] ? [CANCEL_POLICY_TEXT[cancellationPolicy]] : []),
          ].map(msg => (
            <div key={msg} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, textAlign: "left" }}>
              <span style={{ color: "#16a34a", flexShrink: 0 }}>✓</span>
              <span style={{ fontSize: 13, color: "#555" }}>{msg}</span>
            </div>
          ))}

          <div style={{ display: "flex", gap: 12, marginTop: 32 }}>
            <button
              onClick={() => navigate("booking-detail", { bookingId })}
              style={{ flex: 1, background: C.primary, color: "#fff", border: "none", borderRadius: 10, padding: "13px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
            >
              Xem chi tiết đặt phòng
            </button>
            <button
              onClick={() => navigate("my-bookings")}
              style={{ flex: 1, background: "#f0f0f5", color: "#555", border: "none", borderRadius: 10, padding: "13px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
            >
              Tất cả đặt phòng
            </button>
          </div>
        </div>
      </div>

      <Footer navigate={navigate} />
    </div>
  );
}

function FailedPage({ navigate, user, onLogout, state }) {
  const { bookingId, errorMessage } = state || {};

  return (
    <div style={{ minHeight: "100vh", background: "#f7f8fa", fontFamily: "'Segoe UI',sans-serif", display: "flex", flexDirection: "column" }}>
      <MainNavbar active="my-bookings" navigate={navigate} user={user} onLogout={onLogout} />

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ background: "#fff", borderRadius: 20, padding: "52px 48px", maxWidth: 520, width: "100%", boxShadow: "0 4px 32px rgba(0,0,0,0.10)", textAlign: "center" }}>
          {/* Failed icon */}
          <div style={{ width: 80, height: 80, borderRadius: "50%", background: "#ffebee", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
            <XCircle size={44} color="#dc2626" aria-hidden="true" />
          </div>

          <h1 style={{ fontSize: 24, fontWeight: 900, color: "#1a1a1a", marginBottom: 8 }}>
            Thanh toán thất bại
          </h1>
          <p style={{ fontSize: 14, color: "#888", marginBottom: 28, lineHeight: 1.6 }}>
            Giao dịch của bạn không thể hoàn tất. Đặt phòng vẫn được giữ nguyên và bạn có thể thử lại.
          </p>

          {errorMessage && (
            <div style={{ background: "#fff5f5", border: "1px solid #ffcdd2", borderRadius: 10, padding: "12px 16px", fontSize: 13, color: C.primary, marginBottom: 24, textAlign: "left" }}>
              <strong>Chi tiết lỗi:</strong> {errorMessage}
            </div>
          )}

          {/* Common reasons */}
          <div style={{ background: "#f8fafc", borderRadius: 10, padding: "16px 20px", marginBottom: 28, textAlign: "left" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 10 }}>Nguyên nhân thường gặp:</div>
            {[
              "Số dư tài khoản không đủ",
              "Thẻ bị từ chối hoặc hết hạn",
              "Kết nối mạng bị gián đoạn",
              "Phiên thanh toán đã hết hạn",
            ].map(r => (
              <div key={r} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, fontSize: 12, color: "#64748b" }}>
                <span style={{ color: C.primary }}>•</span> {r}
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            {bookingId && (
              <button
                onClick={() => navigate("payment", { bookingId })}
                style={{ flex: 2, background: C.primary, color: "#fff", border: "none", borderRadius: 10, padding: "13px", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                <CreditCard size={16} aria-hidden="true" /> Thử thanh toán lại
              </button>
            )}
            <button
              onClick={() => navigate("my-bookings")}
              style={{ flex: 1, background: "#f0f0f5", color: "#555", border: "none", borderRadius: 10, padding: "13px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
            >
              Đặt phòng của tôi
            </button>
          </div>
        </div>
      </div>

      <Footer navigate={navigate} />
    </div>
  );
}

export default function PaymentResultPage({ navigate, user, onLogout, variant }) {
  const location = useLocation();
  const state    = location.state;

  if (!state) return <Navigate to="/customer/bookings" replace />;

  const isSuccess = variant === "success";
  return isSuccess
    ? <SuccessPage navigate={navigate} user={user} onLogout={onLogout} state={state} />
    : <FailedPage  navigate={navigate} user={user} onLogout={onLogout} state={state} />;
}
