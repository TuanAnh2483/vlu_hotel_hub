import { useState } from "react";
import { useParams } from "react-router-dom";
import { C } from "../lib/constants";
import MainNavbar from "../components/MainNavbar";
import Footer from "../components/Footer";
import { useBookingDetail, useCreateRefundRequest } from "../hooks/useBookingQueries";
import { 
  ChevronLeft, ArrowLeft, DollarSign, AlertCircle, 
  CheckCircle2, Clock, Info, HelpCircle, FileText,
  CreditCard, ShieldAlert, Zap
} from "lucide-react";
import "../styles/pages/RefundRequestPage.css";

const P = "#BE1E2E";

const REASONS = [
  { value: "",               label: "-- Chọn lý do hoàn tiền --" },
  { value: "CHANGE_OF_PLAN", label: "Thay đổi kế hoạch du lịch" },
  { value: "PAYMENT_ISSUE",  label: "Vấn đề về thanh toán / Trùng lặp" },
  { value: "WRONG_BOOKING",  label: "Đặt nhầm thông tin / Ngày tháng" },
  { value: "SERVICE_ISSUE",  label: "Dịch vụ không đúng như cam kết" },
  { value: "OTHER",          label: "Lý do cá nhân khác" },
];

function fmt(n) { return (n || 0).toLocaleString("vi-VN") + " ₫"; }
function fmtDate(s) {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d) ? s : d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function RefundRequestPage({ navigate, user, onLogout }) {
  const { bookingId } = useParams();

  const [reason, setReason]   = useState("");
  const [note, setNote]       = useState("");
  const [success, setSuccess] = useState(false);
  const [error, setError]     = useState("");

  const { data: booking, isLoading: loading } = useBookingDetail(bookingId);
  const createRefund = useCreateRefundRequest();
  const submitting   = createRefund.isPending;

  const handleSubmit = () => {
    if (!reason) { setError("Vui lòng chọn lý do để chúng tôi có thể hỗ trợ bạn tốt nhất."); return; }
    setError("");
    createRefund.mutate(
      { bookingId, reason, note },
      {
        onSuccess: () => setSuccess(true),
        onError:   (e) => setError(e.message || "Không thể gửi yêu cầu hoàn tiền."),
      }
    );
  };

  if (!user) {
    return (
      <div className="refund-page-container">
        <MainNavbar active="my-bookings" navigate={navigate} user={user} onLogout={onLogout} />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
           <div className="refund-restricted-card">
             <ShieldAlert size={60} color={P} style={{ marginBottom: 24 }} />
             <h2 style={{ fontSize: 20, fontWeight: 800, color: "#1e293b", marginBottom: 12 }}>Truy cập bị hạn chế</h2>
             <p style={{ fontSize: 14, color: "#64748b", marginBottom: 32, lineHeight: 1.6 }}>Vui lòng đăng nhập tài khoản của bạn để thực hiện yêu cầu hoàn tiền.</p>
             <button onClick={() => navigate("login")} className="refund-btn-primary" style={{ width: "100%" }}>Đăng nhập ngay</button>
           </div>
        </div>
        <Footer navigate={navigate} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="refund-page-container">
        <MainNavbar active="my-bookings" navigate={navigate} user={user} onLogout={onLogout} />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", fontWeight: 700 }}>
          Đang tải dữ liệu đặt phòng...
        </div>
        <Footer navigate={navigate} />
      </div>
    );
  }

  if (success) {
    return (
      <div className="refund-page-container">
        <MainNavbar active="my-bookings" navigate={navigate} user={user} onLogout={onLogout} />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div className="refund-success-card">
            <div className="refund-success-icon-box">
               <CheckCircle2 size={56} color="#10b981" />
            </div>
            <h2 className="refund-success-title">Đã gửi yêu cầu thành công!</h2>
            <p className="refund-success-desc">
              Yêu cầu hoàn tiền cho đơn hàng <strong style={{ color: "#1e293b" }}>#{bookingId}</strong> đã được hệ thống ghi nhận. 
              Đội ngũ hỗ trợ sẽ phản hồi kết quả qua email của bạn trong vòng 3-5 ngày làm việc.
            </p>
            <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
              <button onClick={() => navigate("my-bookings")} className="refund-btn-primary">Quản lý đặt phòng</button>
              <button onClick={() => navigate("home")} className="refund-btn-outline">Về trang chủ</button>
            </div>
          </div>
        </div>
        <Footer navigate={navigate} />
      </div>
    );
  }

    return (
      <div className="refund-page-container">
        <MainNavbar active="my-bookings" navigate={navigate} user={user} onLogout={onLogout} />

      <div style={{ flex: 1, maxWidth: 1140, margin: "0 auto", width: "100%", padding: "40px 20px" }}>
        
        {/* New Back Button Design */}
        <div style={{ marginBottom: 32 }}>
          <button 
            onClick={() => navigate("booking-detail", { bookingId })} 
            className="refund-request-back-btn"
          >
            <ChevronLeft size={18} /> Quay lại chi tiết đặt phòng
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 32, alignItems: "start" }}>
          
          {/* Form Side */}
          <div className="refund-form-card">
            <div className="refund-form-header">
               <div className="refund-form-icon-box">
                  <DollarSign size={28} color={P} />
               </div>
               <div>
                  <h1 className="refund-form-title">Yêu cầu hoàn tiền</h1>
                  <p className="refund-form-desc">Vui lòng cung cấp lý do để chúng tôi xử lý nhanh nhất</p>
               </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
               <div>
                  <label className="refund-label">LÝ DO HOÀN TIỀN *</label>
                  <select 
                    className="refund-select"
                    value={reason} 
                    onChange={e => setReason(e.target.value)}
                  >
                    {REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
               </div>

               <div>
                  <label className="refund-label">GHI CHÚ CHI TIẾT</label>
                  <textarea
                    className="refund-textarea"
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="Mô tả cụ thể vấn đề bạn gặp phải để đội ngũ hỗ trợ nắm bắt thông tin..."
                  />
               </div>

               <div className="refund-warning-box">
                  <AlertCircle size={24} color="#f59e0b" style={{ flexShrink: 0 }} />
                  <p style={{ margin: 0, fontSize: 13, color: "#92400e", lineHeight: 1.6, fontWeight: 500 }}>
                    Yêu cầu hoàn tiền sẽ được xem xét dựa trên chính sách của khách sạn. 
                    Tiền sẽ được hoàn về đúng phương thức thanh toán bạn đã sử dụng.
                  </p>
               </div>

               {error && (
                 <div className="refund-error-box">
                   {error}
                 </div>
               )}

               <button
                 disabled={submitting}
                 onClick={handleSubmit}
                 className="refund-btn-primary"
                 style={{ width: "100%", padding: "18px" }}
               >
                 {submitting ? "Đang xử lý yêu cầu..." : "Gửi yêu cầu hoàn tiền"}
               </button>
            </div>
          </div>

          {/* Info Side */}
          <div className="refund-info-sidebar">
             <div className="refund-summary-card">
                <h3 style={{ fontSize: 16, fontWeight: 800, color: "rgba(255,255,255,0.6)", marginBottom: 24, textTransform: "uppercase", letterSpacing: 1 }}>Tóm tắt đơn hàng</h3>
                
                <div style={{ marginBottom: 24 }}>
                   <p className="refund-summary-label">MÃ ĐẶT PHÒNG</p>
                   <p className="refund-summary-id">#{bookingId}</p>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 32 }}>
                   <div className="refund-summary-row">
                      <span style={{ color: "rgba(255,255,255,0.5)" }}>Khách sạn</span>
                      <span style={{ fontWeight: 700 }}>{booking?.hotelName || booking?.hotel?.name || "—"}</span>
                   </div>
                   <div className="refund-summary-row">
                      <span style={{ color: "rgba(255,255,255,0.5)" }}>Thời gian</span>
                      <span style={{ fontWeight: 700 }}>{fmtDate(booking?.checkIn)} - {fmtDate(booking?.checkOut)}</span>
                   </div>
                </div>

                <div className="refund-summary-amount-box">
                   <p className="refund-summary-label" style={{ textAlign: "center", marginBottom: 8 }}>SỐ TIỀN DỰ KIẾN HOÀN</p>
                   <p style={{ fontSize: 28, fontWeight: 900, color: "#fff", margin: 0, textAlign: "center" }}>{fmt(booking?.totalPrice)}</p>
                </div>
             </div>

             <div className="refund-support-box">
                <Zap size={24} color="#3b82f6" />
                <p style={{ margin: 0, fontSize: 13, color: "#64748b", fontWeight: 600 }}>Hỗ trợ nhanh 24/7 qua Hotline: 1900 1234</p>
             </div>
          </div>

        </div>
      </div>

      <Footer navigate={navigate} />
    </div>
  );
}
