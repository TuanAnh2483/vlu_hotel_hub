import { useState, useEffect } from "react";
import MainNavbar from "../components/MainNavbar";
import Footer from "../components/Footer";
import BookingStepper from "../components/ui/BookingStepper";
import { useBookingDetail, useCreatePaymentSession, useReconcilePayment } from "../hooks/useBookingQueries";
import { C } from "../lib/constants";
import {
  ChevronLeft, CreditCard, Wallet,
  ShieldCheck, Lock, ArrowRight,
  QrCode
} from "lucide-react";
import "../styles/pages/PaymentPage.css";

function fmt(n) { return (n || 0).toLocaleString("vi-VN") + " ₫"; }
function fmtDate(s) {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d) ? s : d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function nightsBetween(a, b) {
  const diff = (new Date(b) - new Date(a)) / 86400000;
  return diff > 0 ? Math.round(diff) : 0;
}

const METHODS = [
  { id: "bank",   label: "VietQR",       icon: QrCode,      sub: "Chuyển khoản ngân hàng" },
  { id: "card",   label: "Thẻ Quốc Tế",  icon: CreditCard,  sub: "Sẽ hỗ trợ sau", disabled: true },
  { id: "wallet", label: "Ví Điện Tử",   icon: Wallet,      sub: "Sẽ hỗ trợ sau", disabled: true },
];

function MethodBtn({ method, active, onSelect }) {
  const Icon = method.icon;
  return (
    <button
      onClick={() => !method.disabled && onSelect(method.id)}
      disabled={method.disabled}
      aria-pressed={active}
      aria-label={`Phương thức ${method.label}${method.disabled ? " (chưa hỗ trợ)" : ""}`}
      className={`pay-method-btn ${active ? "active" : ""}`}
    >
      <div className="pay-method-icon">
        <Icon size={24} color={active ? "#fff" : "#64748b"} aria-hidden="true" />
      </div>
      <div>
        <div className="pay-method-label">{method.label}</div>
        <div className="pay-method-sub">{method.sub}</div>
      </div>
    </button>
  );
}

export default function PaymentPage({ navigate, user, params = {}, onLogout }) {
  const { bookingId } = params;

  const isPending = (data) => data?.status === "PENDING_PAYMENT";

  const [method, setMethod]               = useState("bank");
  const [paying, setPaying]               = useState(false);
  const [error, setError]                 = useState("");
  const [paymentSession, setPaymentSession] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionError, setSessionError]   = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const {
    data: booking,
    isLoading: loading,
    error: bookingError,
    refetch: refetchBooking,
  } = useBookingDetail(bookingId, {
    refetchInterval: (query) => (isPending(query.state.data) ? 5000 : false),
  });

  useEffect(() => {
    if (bookingError) setError(bookingError.message || "Không thể tải đơn đặt phòng để thanh toán.");
  }, [bookingError]);

  const createPaymentSession = useCreatePaymentSession();
  const reconcilePayment = useReconcilePayment();

  useEffect(() => {
    if (!booking || !isPending(booking) || paymentSession || sessionLoading) return;
    setSessionLoading(true);
    setSessionError("");
    createPaymentSession.mutate(bookingId, {
      onSuccess: (session) => setPaymentSession(session),
      onError:   (err)     => setSessionError(err.message || "Không thể tạo phiên thanh toán chuyển khoản."),
      onSettled: ()        => setSessionLoading(false),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking?.status, bookingId]);

  useEffect(() => {
    if (!booking) return;
    if (booking.status === "CONFIRMED")
      navigate("payment-success", { bookingId, amount: booking.totalPrice, hotelName: booking.hotelName, cancellationPolicy: booking.cancellationPolicy });
    if (booking.status === "CANCELLED")
      navigate("payment-failed", { bookingId, errorMessage: "Phiên thanh toán đã hết hạn." });
  }, [booking?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const nights  = booking ? nightsBetween(booking.checkIn, booking.checkOut) : 0;
  const total   = booking?.totalPrice || 0;
  const qrImageUrl = paymentSession?.qrImageUrl || null;

  const handlePay = async () => {
    setPaying(true); setError(""); setStatusMessage("");
    try {
      // Chủ động đối soát với SePay trước, không chỉ chờ webhook.
      // Lỗi reconcile (vd chưa cấu hình API token) không chặn luồng — vẫn fallback về refetch.
      try {
        const result = await reconcilePayment.mutateAsync(bookingId);
        if (result?.matched || result?.bookingStatus === "CONFIRMED") {
          const { data: confirmed } = await refetchBooking();
          navigate("payment-success", { bookingId, amount: confirmed?.totalPrice ?? booking?.totalPrice, hotelName: confirmed?.hotelName ?? booking?.hotelName, cancellationPolicy: confirmed?.cancellationPolicy ?? booking?.cancellationPolicy });
          return;
        }
      } catch { /* bỏ qua, fallback refetch bên dưới */ }

      const { data: latest } = await refetchBooking();
      if (latest?.status === "CONFIRMED") {
        navigate("payment-success", { bookingId, amount: latest.totalPrice, hotelName: latest.hotelName, cancellationPolicy: latest.cancellationPolicy });
        return;
      }
      if (latest?.status === "CANCELLED") {
        navigate("payment-failed", { bookingId, errorMessage: "Phiên thanh toán đã hết hạn." });
        return;
      }
      setStatusMessage("Chưa nhận được giao dịch. Vui lòng kiểm tra đúng số tiền và nội dung chuyển khoản.");
    } catch (err) {
      setError(err.message || "Không thể kiểm tra trạng thái thanh toán. Vui lòng thử lại.");
    } finally { setPaying(false); }
  };

  return (
    <div className="pay-root">
      <MainNavbar active="payment" navigate={navigate} user={user} onLogout={onLogout} />

      {/* Immersive header */}
      <div className="pay-header">
        <div className="pay-header-glow" aria-hidden="true" />
        <div className="pay-header-inner">
          <BookingStepper current={2} darkMode />
          <h1>Hoàn tất thanh toán</h1>
          <p>An toàn · Bảo mật · Nhanh chóng</p>
        </div>
      </div>

      <div className="pay-body">
        {/* ── Left column ── */}
        <div className="flex flex-col gap-6">
          <button className="pay-back-btn w-fit" onClick={() => navigate("booking-detail", { bookingId })}>
            <ChevronLeft size={18} aria-hidden="true" /> Quay lại chi tiết đặt phòng
          </button>

          <div className="pay-card">
            <h3 className="text-[18px] font-[800] text-[var(--text-main)] mb-6">Phương thức thanh toán</h3>

            {/* Method selector */}
            <div className="pay-methods" role="group" aria-label="Chọn phương thức thanh toán">
              {METHODS.map(m => (
                <MethodBtn key={m.id} method={m} active={method === m.id} onSelect={setMethod} />
              ))}
            </div>

            {/* Form area */}
            <div className="pay-form-area">
              {/* Disabled method notice */}
              {(method === "card" || method === "wallet") && (
                <div className="pay-unsupported">
                  {method === "card"
                    ? <CreditCard size={48} color="#cbd5e1" strokeWidth={1.5} style={{ marginBottom: 16 }} aria-hidden="true" />
                    : <Wallet size={48} color="#cbd5e1" strokeWidth={1.5} style={{ marginBottom: 16 }} aria-hidden="true" />
                  }
                  <p>{method === "card" ? "Thẻ Quốc Tế" : "Ví Điện Tử"} chưa được hỗ trợ</p>
                  <p>Phương thức này đang trong quá trình phát triển. Vui lòng chọn VietQR để tiếp tục thanh toán.</p>
                </div>
              )}

              {/* VietQR */}
              {method === "bank" && (
                <div className="flex flex-col items-center text-center">
                  <div className="pay-qr-box">
                    <div className="pay-qr-img">
                      {qrImageUrl
                        ? <img src={qrImageUrl} alt="Mã QR chuyển khoản VietQR" style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: 10 }} />
                        : <QrCode size={80} color="#cbd5e1" strokeWidth={1} aria-hidden="true" />
                      }
                    </div>
                    <p className="mt-3 text-[13px] font-[800] text-[var(--text-main)]">Mã QR VietQR</p>
                  </div>

                  {sessionLoading && (
                    <div className="flex items-center gap-2 text-[var(--text-muted)] text-[13px] font-[700] mb-3">
                      <span className="spinner-sm dark" aria-hidden="true" />
                      Đang tạo mã thanh toán...
                    </div>
                  )}
                  {sessionError && (
                    <div className="alert alert-error mb-4 max-w-[460px]">
                      {sessionError}
                    </div>
                  )}

                  {paymentSession ? (
                    <div className="w-full max-w-[400px]">
                      <div className="pay-info-row"><span>Ngân hàng:</span> <strong>{paymentSession.bankName}</strong></div>
                      <div className="pay-info-row"><span>Số tài khoản:</span> <strong>{paymentSession.bankAccountNo}</strong></div>
                      <div className="pay-info-row"><span>Chủ tài khoản:</span> <strong>{paymentSession.bankAccountName}</strong></div>
                      <div className="pay-info-row"><span>Số tiền:</span> <strong>{fmt(paymentSession.amount)}</strong></div>
                      <div className="pay-info-row"><span>Nội dung CK:</span> <strong className="text-[var(--primary)]">{paymentSession.transferContent}</strong></div>
                    </div>
                  ) : !sessionLoading && !sessionError && (
                    <p className="text-[var(--text-light)] text-[13px] font-[600]">Thông tin chuyển khoản sẽ hiện khi mã được tạo.</p>
                  )}

                  <p className="mt-4 text-[var(--text-muted)] text-[12px] leading-relaxed max-w-[440px]">
                    SePay sẽ tự xác nhận khi giao dịch vào tài khoản. Trang này kiểm tra trạng thái mỗi vài giây.
                  </p>
                </div>
              )}
            </div>

            {/* Safety badges */}
            <div className="pay-safety-row">
              <div className="pay-safety-item" style={{ color: "#10b981" }}>
                <ShieldCheck size={20} aria-hidden="true" /> Bảo mật SSL 256-bit
              </div>
              <div className="pay-safety-item" style={{ color: "#3b82f6" }}>
                <Lock size={20} aria-hidden="true" /> Thanh toán an toàn PCI-DSS
              </div>
            </div>
          </div>
        </div>

        {/* ── Right column — summary ── */}
        <div className="flex flex-col gap-6">
          <div className="pay-card pay-card-summary">
            <h3 className="text-[18px] font-[900] text-[var(--text-main)] mb-6">Chi tiết đơn hàng</h3>

            {loading && <div className="text-[var(--text-light)] text-[14px] mb-5">Đang tải thông tin thanh toán...</div>}
            {!loading && !booking && (
              <div className="alert alert-error mb-5">
                {error || "Không tìm thấy đơn đặt phòng để thanh toán."}
              </div>
            )}

            {/* Hotel thumbnail */}
            <div className="pay-summary-hotel">
              <div className="pay-summary-thumb">
                {booking?.coverImageUrl
                  ? <img src={booking.coverImageUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt={booking.hotelName || "Hotel"} />
                  : <div className="w-full h-full flex items-center justify-center" style={{ background: "linear-gradient(135deg,#1e293b 0%,#BE1E2E 100%)" }}>
                      <QrCode size={28} color="rgba(255,255,255,0.35)" aria-hidden="true" />
                    </div>
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-[800] text-[var(--text-main)] mb-1 truncate">
                  {booking?.hotelName || "—"}
                </div>
                <div className="text-[12px] text-[var(--text-light)] font-[600]">
                  {nights} đêm · {fmtDate(booking?.checkIn)}
                </div>
              </div>
            </div>

            {/* Items */}
            <div className="pay-items">
              {booking?.items?.map((item, i) => (
                <div key={i} className="pay-item-row">
                  <span>{item.roomTypeName} × {item.quantity}</span>
                  <span className="font-[700] text-[var(--text-main)]">{fmt(item.stayPrice)}</span>
                </div>
              ))}
              <div className="pay-divider" />
              <div className="pay-total-row">
                <span className="text-[15px] font-[800] text-[var(--text-main)]">Tổng thanh toán</span>
                <span className="text-[24px] font-[900] text-[var(--primary)]">{fmt(total)}</span>
              </div>
            </div>

            {/* Pay button */}
            <button
              className="pay-submit-btn"
              disabled={paying || loading || sessionLoading || !booking || booking.status !== "PENDING_PAYMENT"}
              onClick={handlePay}
            >
              {paying
                ? <><span className="spinner-sm" aria-hidden="true" /> Đang kiểm tra...</>
                : <>Tôi đã chuyển khoản <ArrowRight size={20} aria-hidden="true" /></>
              }
            </button>

            {error && booking && <div className="alert alert-error mt-4">{error}</div>}
            {statusMessage && <div className="alert alert-warning mt-4">{statusMessage}</div>}

            {booking?.status && booking.status !== "PENDING_PAYMENT" && (
              <div className="alert alert-info mt-4">
                Trạng thái hiện tại: {booking.status}
              </div>
            )}
          </div>
        </div>
      </div>

      <Footer navigate={navigate} />
    </div>
  );
}
