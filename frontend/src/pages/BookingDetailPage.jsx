import { useState, useEffect } from "react";
import { useCountdown } from "../hooks/useCountdown";
import { C } from "../lib/constants";
import MainNavbar from "../components/MainNavbar";
import Footer from "../components/Footer";
import {
  useBookingDetail,
  usePaymentHistory,
  useRefundRequest,
  useCancelBooking,
} from "../hooks/useBookingQueries";
import { useMyReviews, useCreateReview } from "../hooks/useReviewQueries";
import { useLang } from "../contexts/LanguageContext";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  Clock,
  CreditCard,
  ReceiptText,
  RefreshCcw,
  ShieldCheck,
  ShieldOff,
  Star,
  User,
  XCircle,
} from "lucide-react";
import "../styles/pages/BookingDetailPage.css";
import { useScrollLock } from "../hooks/useScrollLock";

const POLICY_CFG = {
  FLEXIBLE: { Icon: ShieldCheck, color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0", warnKey: "bkd_cancel_warn_flexible" },
  MODERATE: { Icon: Clock,       color: "#d97706", bg: "#fffbeb", border: "#fde68a", warnKey: "bkd_cancel_warn_moderate" },
  STRICT:   { Icon: ShieldOff,   color: "#dc2626", bg: "#fff1f2", border: "#fecdd3", warnKey: "bkd_cancel_warn_strict"   },
};

function ConfirmDialog({ title, message, policyWarning, confirmLabel = "Xác nhận", onConfirm, onCancel, loading }) {
  useScrollLock(true);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)", zIndex: "var(--z-modal)" }}
    >
      <div className="bg-white rounded-2xl p-8 w-full max-w-sm" style={{ boxShadow: "var(--shadow-xl)" }}>
        <h3 id="confirm-dialog-title" className="text-[17px] font-[800] text-[var(--text-main)] mt-0 mb-2.5">{title}</h3>
        <p className="text-[14px] text-[var(--text-muted)] leading-relaxed mt-0 mb-4">{message}</p>
        {policyWarning && (
          <div style={{ background: policyWarning.bg, border: `1px solid ${policyWarning.border}`, borderRadius: 10, color: policyWarning.color, fontSize: 13, fontWeight: 600, lineHeight: 1.6, marginBottom: 20, padding: "10px 14px" }}>
            {policyWarning.text}
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={loading} className="btn btn-secondary flex-1">
            Hủy bỏ
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="btn flex-1 text-white font-[800]"
            style={{ background: "#ef4444" }}
          >
            {loading ? <><span className="spinner-sm" aria-hidden="true" /> Đang xử lý...</> : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function ExpiryCountdown({ expiresAt, onExpired }) {
  const { t } = useLang();
  const { minutes, seconds, expired, urgent } = useCountdown(expiresAt);

  useEffect(() => {
    if (expired && onExpired) onExpired();
  }, [expired]);

  if (expired) {
    return (
      <div style={{ background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: 14, color: "#be123c", fontWeight: 700, marginBottom: 18, padding: "12px 14px" }}>
        {t("bkd_expired")}
      </div>
    );
  }

  const pad = n => String(n).padStart(2, "0");
  return (
    <div style={{
      background: urgent ? "#fff1f2" : "#fffbeb",
      border: `1px solid ${urgent ? "#fecdd3" : "#fde68a"}`,
      borderRadius: 14,
      color: urgent ? "#be123c" : "#92400e",
      marginBottom: 18,
      padding: "12px 14px",
      display: "flex",
      alignItems: "center",
      gap: 10,
    }}>
      <Clock size={16} style={{ flexShrink: 0 }} />
      <span style={{ fontWeight: 700 }}>
        {t("bkd_expires_in")}{" "}
        <span style={{ fontVariantNumeric: "tabular-nums", fontSize: 16 }}>
          {pad(minutes)}:{pad(seconds)}
        </span>
      </span>
    </div>
  );
}

function useStatusMap() {
  const { t } = useLang();
  return {
    PENDING_PAYMENT: { label: t("status_pending_payment"), color: "#f59e0b", bg: "#fffbeb", icon: Clock },
    CONFIRMED:       { label: t("status_confirmed"),       color: "#10b981", bg: "#ecfdf5", icon: CheckCircle2 },
    CANCELLED:       { label: t("status_cancelled"),       color: "#64748b", bg: "#f8fafc", icon: XCircle },
    COMPLETED:       { label: t("status_completed"),       color: "#BE1E2E", bg: "#FFF1F2", icon: ShieldCheck },
    REFUNDED:        { label: t("status_refunded"),        color: "#7c3aed", bg: "#f5f3ff", icon: RefreshCcw },
  };
}

function usePaymentStatusMap() {
  const { t } = useLang();
  return {
    SUCCESS: { label: t("pay_status_success"), color: "#047857", bg: "#ecfdf5", border: "#a7f3d0" },
    FAILED:  { label: t("pay_status_failed"),  color: "#be123c", bg: "#fff1f2", border: "#fecdd3" },
    PENDING: { label: t("pay_status_pending"), color: "#b45309", bg: "#fffbeb", border: "#fde68a" },
  };
}

function useRefundStatusMap() {
  const { t } = useLang();
  return {
    PENDING:  { label: t("refund_status_pending"),  color: "#b45309", bg: "#fffbeb", border: "#fde68a" },
    APPROVED: { label: t("refund_status_approved"), color: "#047857", bg: "#ecfdf5", border: "#a7f3d0" },
    REJECTED: { label: t("refund_status_rejected"), color: "#be123c", bg: "#fff1f2", border: "#fecdd3" },
  };
}

function fmt(n) {
  return (n || 0).toLocaleString("vi-VN") + " ₫";
}

function fmtDate(s) {
  if (!s) return "—";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtDateTime(s) {
  if (!s) return "—";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleString("vi-VN");
}

function nightsBetween(a, b) {
  if (!a || !b) return 0;
  const diff = (new Date(b) - new Date(a)) / 86400000;
  return diff > 0 ? Math.round(diff) : 0;
}

function Card({ children, style }) {
  return (
    <div style={{ background: "#fff", borderRadius: 20, border: "1px solid #f1f5f9", boxShadow: "0 10px 30px rgba(0,0,0,0.04)", padding: 24, ...style }}>
      {children}
    </div>
  );
}

function SmallBadge({ value, map }) {
  const { t } = useLang();
  const cfg = map[value] || { label: value || t("bkd_unknown"), color: "#475569", bg: "#f8fafc", border: "#e2e8f0" };
  return (
    <span style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 999, color: cfg.color, display: "inline-flex", fontSize: 12, fontWeight: 800, padding: "4px 10px" }}>
      {cfg.label}
    </span>
  );
}

function fieldLabel(value) {
  if (!value) return "—";
  return String(value).replaceAll("_", " ");
}

function StarPicker({ value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          onClick={() => onChange(n)}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}
        >
          <Star
            size={24}
            fill={n <= value ? "#f59e0b" : "none"}
            color={n <= value ? "#f59e0b" : "#d1d5db"}
            strokeWidth={1.5}
          />
        </button>
      ))}
    </div>
  );
}

function ReviewCard({ bookingId, hotelName, hasReview, canWrite, createReview, t }) {
  const [rating,    setRating]    = useState(5);
  const [comment,   setComment]   = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [err,       setErr]       = useState("");

  if (hasReview || submitted) {
    return (
      <Card>
        <div style={{ alignItems: "center", display: "flex", gap: 10, marginBottom: 8 }}>
          <Star size={20} fill="#f59e0b" color="#f59e0b" />
          <span style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>{t("review_your_label")}</span>
        </div>
        <div className="alert alert-success">
          ✓ {t("review_submitted")}
        </div>
      </Card>
    );
  }

  if (!canWrite) return null;

  function handleSubmit() {
    setErr("");
    if (!rating) { setErr("Vui lòng chọn số sao."); return; }
    createReview.mutate(
      { bookingId: Number(bookingId), rating, comment: comment.trim() || null },
      {
        onSuccess: () => setSubmitted(true),
        onError: (e) => setErr(e.message || "Gửi đánh giá thất bại."),
      }
    );
  }

  return (
    <Card>
      <div style={{ alignItems: "center", display: "flex", gap: 10, marginBottom: 16 }}>
        <Star size={20} fill="#f59e0b" color="#f59e0b" />
        <h2 style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", margin: 0 }}>{t("review_title")}</h2>
      </div>
      <p style={{ color: "#64748b", fontSize: 13, lineHeight: 1.6, margin: "0 0 16px" }}>
        Chia sẻ trải nghiệm của bạn tại <strong>{hotelName}</strong> để giúp khách hàng khác.
      </p>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 8 }}>{t("review_rating_lbl")}</div>
        <StarPicker value={rating} onChange={setRating} />
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 8 }}>
          {t("review_comment_lbl")} <span style={{ fontWeight: 400 }}>{t("review_comment_opt")}</span>
        </div>
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder={t("review_comment_ph")}
          maxLength={500}
          aria-label={t("review_comment_lbl")}
          style={{ width: "100%", minHeight: 90, padding: "10px 12px", border: "1.5px solid #e2e8f0", borderRadius: 12, fontSize: 13, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", outline: "none" }}
        />
        <div style={{ fontSize: 11, color: "#94a3b8", textAlign: "right" }}>{comment.length}/500</div>
      </div>

      {err && <div className="alert alert-error" style={{ marginBottom: 12 }}>{err}</div>}

      <button
        onClick={handleSubmit}
        disabled={createReview.isPending}
        className="btn btn-primary btn-full"
      >
        <Star size={16} fill="#fff" color="#fff" aria-hidden="true" />
        {createReview.isPending
          ? <><span className="spinner-sm" aria-hidden="true" /> {t("review_submitting")}</>
          : t("review_submit_btn")
        }
      </button>
    </Card>
  );
}

export default function BookingDetailPage({ navigate, user, params = {}, onLogout }) {
  const { t } = useLang();
  const statusMap        = useStatusMap();
  const paymentStatusMap = usePaymentStatusMap();
  const refundStatusMap  = useRefundStatusMap();

  const { bookingId } = params;
  const [cancelError, setCancelError]         = useState("");
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  const { data: booking, isLoading: loading, error: bookingError, refetch: refetchBooking } = useBookingDetail(bookingId);
  const { data: rawPayments,   isLoading: paymentsLoading, error: paymentsErr     } = usePaymentHistory(bookingId);
  const { data: refundRequest, isLoading: refundLoading,   error: refundErr       } = useRefundRequest(bookingId);

  const cancelBooking = useCancelBooking();

  // Must be called before any conditional return
  const { data: myReviews = [] } = useMyReviews();
  const createReview = useCreateReview();

  const payments     = Array.isArray(rawPayments) ? rawPayments : [];
  const error        = bookingError?.message || cancelError || "";
  const paymentsError = paymentsErr?.message || "";
  const refundError  = refundErr?.message    || "";
  const cancelling   = cancelBooking.isPending;

  const handleCancel = () => {
    if (!booking) return;
    setShowCancelDialog(true);
  };

  const confirmCancel = () => {
    setCancelError("");
    cancelBooking.mutate(booking.bookingId, {
      onSuccess: () => setShowCancelDialog(false),
      onError: (err) => {
        setCancelError(err.message || t("bkd_load_error"));
        setShowCancelDialog(false);
      },
    });
  };

  if (!user) {
    return (
      <div className="bkd-root">
        <MainNavbar active="my-bookings" navigate={navigate} user={user} onLogout={onLogout} />
        <div className="bkd-login-center">
          <div className="bkd-login-box">
            <div className="bkd-login-avatar">
              <User size={40} color="#94a3b8" />
            </div>
            <h2 className="bkd-login-title">{t("bkd_login_title")}</h2>
            <p className="bkd-login-desc">{t("bkd_login_desc")}</p>
            <button className="bkd-login-btn" onClick={() => navigate("login")}>{t("bkd_login_btn")}</button>
          </div>
        </div>
        <Footer navigate={navigate} />
      </div>
    );
  }

  const nights = nightsBetween(booking?.checkIn, booking?.checkOut);
  const statusCfg = statusMap[booking?.status] || { label: booking?.status || t("bkd_unknown"), color: "#64748b", bg: "#f8fafc", icon: AlertCircle };
  const StatusIcon = statusCfg.icon;
  const hasPaid = payments.some(p => p.status === "SUCCESS" && p.amount > 0);

  const hasReview = myReviews.some(r => Number(r.bookingId) === Number(bookingId));
  const canWriteReview = booking?.status === "COMPLETED" && !hasReview;

  const allowsRefund = booking?.cancellationPolicy !== "STRICT";
  const canRequestRefund = booking
    && ["CONFIRMED", "CANCELLED"].includes(booking.status)
    && !refundRequest
    && hasPaid
    && allowsRefund;

  return (
    <div className="bkd-root">
      <MainNavbar active="my-bookings" navigate={navigate} user={user} onLogout={onLogout} />

      <div style={{ maxWidth: 1140, margin: "0 auto", padding: "32px 24px 40px" }}>
        <button
          onClick={() => navigate("my-bookings")}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 999, color: "#64748b", cursor: "pointer", fontSize: 13, fontWeight: 700, marginBottom: 24, padding: "10px 18px" }}
        >
          <ChevronLeft size={18} /> {t("bkd_back")}
        </button>

        {loading && (
          <Card>
            <div style={{ color: "#94a3b8", textAlign: "center", padding: "32px 0" }}>{t("bkd_loading")}</div>
          </Card>
        )}

        {!loading && error && !booking && (
          <Card>
            <div style={{ color: "#be123c", fontWeight: 700, marginBottom: 10 }}>{t("bkd_load_error")}</div>
            <div style={{ color: "#64748b", lineHeight: 1.6 }}>{error}</div>
          </Card>
        )}

        {!loading && booking && (
          <div className="bkd-grid">
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <Card>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 20 }}>
                  <div>
                    <div style={{ fontSize: 13, color: "#94a3b8", fontWeight: 700, marginBottom: 8 }}>{t("bkd_booking_id")}{booking.bookingId}</div>
                    <h1 style={{ fontSize: 28, fontWeight: 900, color: "#0f172a", margin: "0 0 8px" }}>{booking.hotelName || t("bkd_title_fallback")}</h1>
                    <div style={{ color: "#64748b", fontSize: 14 }}>
                      {booking.items?.map((item) => item.roomTypeName).join(", ") || t("bkd_items_fallback")}
                    </div>
                  </div>
                  <div style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 8, background: statusCfg.bg, color: statusCfg.color, borderRadius: 999, fontSize: 13, fontWeight: 800, padding: "8px 14px" }}>
                    <StatusIcon size={16} />
                    {statusCfg.label}
                  </div>
                </div>

                {booking.status === "PENDING_PAYMENT" && booking.expiresAt && (
                  <ExpiryCountdown expiresAt={booking.expiresAt} onExpired={refetchBooking} />
                )}

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14 }}>
                  <div style={{ background: "#f8fafc", borderRadius: 16, padding: 16 }}>
                    <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 800, marginBottom: 6 }}>{t("bkd_checkin")}</div>
                    <div style={{ color: "#0f172a", fontSize: 16, fontWeight: 800 }}>{fmtDate(booking.checkIn)}</div>
                  </div>
                  <div style={{ background: "#f8fafc", borderRadius: 16, padding: 16 }}>
                    <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 800, marginBottom: 6 }}>{t("bkd_checkout")}</div>
                    <div style={{ color: "#0f172a", fontSize: 16, fontWeight: 800 }}>{fmtDate(booking.checkOut)}</div>
                  </div>
                  <div style={{ background: "#f8fafc", borderRadius: 16, padding: 16 }}>
                    <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 800, marginBottom: 6 }}>{t("bkd_stay_lbl")}</div>
                    <div style={{ color: "#0f172a", fontSize: 16, fontWeight: 800 }}>{nights > 0 ? `${nights} ${t("bkd_night")}` : "—"}</div>
                  </div>
                </div>
              </Card>

              <Card>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", margin: "0 0 18px" }}>{t("bkd_rooms_title")}</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {booking.items?.map((item) => (
                    <div key={`${item.roomTypeId}-${item.roomTypeName}`} style={{ alignItems: "center", border: "1px solid #f1f5f9", borderRadius: 16, display: "flex", justifyContent: "space-between", gap: 12, padding: 16 }}>
                      <div>
                        <div style={{ color: "#0f172a", fontSize: 15, fontWeight: 800, marginBottom: 4 }}>{item.roomTypeName}</div>
                        <div style={{ color: "#64748b", fontSize: 13 }}>
                          {item.quantity} {t("bkd_room_qty")} {nights > 0 ? `${nights} ${t("bkd_night")}` : t("bkd_stay_fallback")}
                        </div>
                      </div>
                      <div style={{ color: C.primary, fontSize: 16, fontWeight: 900 }}>{fmt(item.stayPrice)}</div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", margin: "0 0 18px" }}>{t("bkd_contact_title")}</h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16 }}>
                  <div>
                    <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 800, marginBottom: 6 }}>{t("bkd_fullname")}</div>
                    <div style={{ color: "#0f172a", fontSize: 14, fontWeight: 700 }}>{booking.contact?.fullName || "—"}</div>
                  </div>
                  <div>
                    <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 800, marginBottom: 6 }}>{t("bkd_email")}</div>
                    <div style={{ color: "#0f172a", fontSize: 14, fontWeight: 700 }}>{booking.contact?.email || "—"}</div>
                  </div>
                  <div>
                    <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 800, marginBottom: 6 }}>{t("bkd_phone")}</div>
                    <div style={{ color: "#0f172a", fontSize: 14, fontWeight: 700 }}>{booking.contact?.phone || "—"}</div>
                  </div>
                </div>
              </Card>

              <Card>
                <div style={{ alignItems: "center", display: "flex", gap: 10, marginBottom: 18 }}>
                  <CreditCard size={20} color={C.primary} />
                  <h2 style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", margin: 0 }}>{t("bkd_payment_title")}</h2>
                </div>

                {paymentsLoading ? (
                  <div style={{ color: "#94a3b8", fontWeight: 700, padding: "14px 0" }}>{t("bkd_payment_loading")}</div>
                ) : paymentsError ? (
                  <div style={{ background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: 14, color: "#be123c", fontSize: 13, lineHeight: 1.6, padding: "12px 14px" }}>
                    {paymentsError}
                  </div>
                ) : payments.length === 0 ? (
                  <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 14, color: "#64748b", fontSize: 13, lineHeight: 1.6, padding: "14px 16px" }}>
                    {t("bkd_payment_empty")}
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {payments.map((payment) => (
                      <div key={payment.paymentTransactionId || payment.clientRequestId} style={{ border: "1px solid #f1f5f9", borderRadius: 16, padding: 16 }}>
                        <div style={{ alignItems: "flex-start", display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
                          <div>
                            <div style={{ color: "#0f172a", fontSize: 14, fontWeight: 900 }}>
                              {fieldLabel(payment.method)}
                            </div>
                            <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 700, marginTop: 4 }}>
                              {fmtDateTime(payment.createdAt)}
                            </div>
                          </div>
                          <SmallBadge value={payment.status} map={paymentStatusMap} />
                        </div>
                        <div style={{ alignItems: "center", color: C.primary, display: "flex", fontSize: 18, fontWeight: 900, justifyContent: "space-between" }}>
                          <span>{fmt(payment.amount)}</span>
                          <span style={{ color: "#94a3b8", fontSize: 12, fontWeight: 700 }}>#{payment.paymentTransactionId}</span>
                        </div>
                        {(payment.providerReference || payment.failureReason) && (
                          <div style={{ borderTop: "1px solid #f1f5f9", color: "#64748b", fontSize: 12, lineHeight: 1.6, marginTop: 12, paddingTop: 10 }}>
                            {payment.providerReference && <div>{t("bkd_provider_ref")} <strong>{payment.providerReference}</strong></div>}
                            {payment.failureReason && <div>{t("bkd_fail_reason")} <strong>{payment.failureReason}</strong></div>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 24, position: "sticky", top: 20 }}>
              <Card>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", margin: "0 0 18px" }}>{t("bkd_total_title")}</h2>
                <div style={{ borderBottom: "1px solid #f1f5f9", color: "#64748b", display: "flex", fontSize: 14, justifyContent: "space-between", marginBottom: 16, paddingBottom: 12 }}>
                  <span>{t("bkd_subtotal")}</span>
                  <span style={{ color: "#0f172a", fontWeight: 700 }}>{fmt(booking.totalPrice)}</span>
                </div>
                <div style={{ color: C.primary, display: "flex", fontSize: 24, fontWeight: 900, justifyContent: "space-between", marginBottom: 18 }}>
                  <span>{t("bkd_total")}</span>
                  <span>{fmt(booking.totalPrice)}</span>
                </div>

                {error && (
                  <div style={{ background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: 14, color: "#be123c", fontSize: 13, lineHeight: 1.6, marginBottom: 16, padding: "12px 14px" }}>
                    {error}
                  </div>
                )}

                {booking.status === "PENDING_PAYMENT" && (
                  <button
                    onClick={() => navigate("payment", { bookingId: booking.bookingId })}
                    style={{ alignItems: "center", background: C.primary, border: "none", borderRadius: 16, boxShadow: `0 12px 24px ${C.primary}33`, color: "#fff", cursor: "pointer", display: "flex", fontSize: 15, fontWeight: 800, gap: 10, justifyContent: "center", marginBottom: 12, padding: "15px 18px", width: "100%" }}
                  >
                    {t("bkd_pay_now")} <ArrowRight size={18} />
                  </button>
                )}

                {(booking.status === "PENDING_PAYMENT" || booking.status === "CONFIRMED") && (
                  <button onClick={handleCancel} disabled={cancelling} className="bkd-cancel-btn">
                    {cancelling
                      ? <><span className="spinner-sm dark" aria-hidden="true" style={{ display: "inline-block" }} /> {t("bkd_cancelling")}</>
                      : t("bkd_cancel")}
                  </button>
                )}
              </Card>

              {/* Cancellation Policy */}
              {(() => {
                const pKey = (booking.cancellationPolicy || "MODERATE").toUpperCase();
                const pcfg = POLICY_CFG[pKey] || POLICY_CFG.MODERATE;
                const { Icon: PolicyIcon } = pcfg;
                return (
                  <Card>
                    <div style={{ alignItems: "center", display: "flex", gap: 10, marginBottom: 14 }}>
                      <PolicyIcon size={18} color={pcfg.color} />
                      <h2 style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", margin: 0 }}>{t("bkd_policy_title")}</h2>
                    </div>
                    <div style={{ background: pcfg.bg, border: `1px solid ${pcfg.border}`, borderRadius: 10, padding: "11px 14px" }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: pcfg.color, marginBottom: 4 }}>
                        {t(`booking_cancel_policy_title_${(booking.cancellationPolicy || "MODERATE").toLowerCase()}`)}
                      </div>
                      <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.6 }}>
                        {t(`booking_cancel_policy_text_${(booking.cancellationPolicy || "MODERATE").toLowerCase()}`)}
                      </div>
                    </div>
                  </Card>
                );
              })()}

              <Card>
                <div style={{ alignItems: "center", display: "flex", gap: 10, marginBottom: 16 }}>
                  <ReceiptText size={20} color={C.primary} />
                  <h2 style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", margin: 0 }}>{t("bkd_refund_title")}</h2>
                </div>

                {refundLoading ? (
                  <div style={{ color: "#94a3b8", fontSize: 13, fontWeight: 700 }}>{t("bkd_refund_loading")}</div>
                ) : refundError ? (
                  <div style={{ background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: 14, color: "#be123c", fontSize: 13, lineHeight: 1.6, padding: "12px 14px" }}>
                    {refundError}
                  </div>
                ) : refundRequest ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <span style={{ color: "#64748b", fontSize: 13, fontWeight: 800 }}>#{refundRequest.id}</span>
                      <SmallBadge value={refundRequest.status} map={refundStatusMap} />
                    </div>
                    <div style={{ background: "#f8fafc", borderRadius: 14, padding: 14 }}>
                      <div style={{ color: "#94a3b8", fontSize: 11, fontWeight: 900, marginBottom: 4 }}>{t("bkd_refund_amount")}</div>
                      <div style={{ color: C.primary, fontSize: 20, fontWeight: 900 }}>{fmt(refundRequest.amount)}</div>
                    </div>
                    <div style={{ color: "#475569", fontSize: 13, lineHeight: 1.7 }}>
                      <div><strong>{t("bkd_refund_reason")}</strong> {fieldLabel(refundRequest.reason)}</div>
                      {refundRequest.note && <div><strong>{t("bkd_refund_note")}</strong> {refundRequest.note}</div>}
                      <div><strong>{t("bkd_refund_date")}</strong> {fmtDateTime(refundRequest.requestedAt)}</div>
                      {refundRequest.reviewedAt && <div><strong>{t("bkd_refund_reviewed")}</strong> {fmtDateTime(refundRequest.reviewedAt)}</div>}
                      {refundRequest.transferNote && (
                        <div style={{ marginTop: 8, padding: "8px 12px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8 }}>
                          <strong style={{ color: "#166534" }}>Mã chuyển khoản: </strong>
                          <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#166534" }}>{refundRequest.transferNote}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : canRequestRefund ? (
                  <div>
                    <p style={{ color: "#64748b", fontSize: 13, lineHeight: 1.7, margin: "0 0 14px" }}>
                      {t("bkd_refund_eligible")}
                    </p>
                    <button
                      onClick={() => navigate("refund-request", { bookingId: booking.bookingId })}
                      style={{ background: "#fff", border: `1px solid ${C.primary}`, borderRadius: 16, color: C.primary, cursor: "pointer", fontSize: 14, fontWeight: 800, padding: "13px 16px", width: "100%" }}
                    >
                      {t("bkd_refund_request")}
                    </button>
                  </div>
                ) : !allowsRefund ? (
                  <div style={{ background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: 14, color: "#be123c", fontSize: 13, lineHeight: 1.6, padding: "12px 14px" }}>
                    {t("bkd_refund_strict")}
                  </div>
                ) : (
                  <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 14, color: "#64748b", fontSize: 13, lineHeight: 1.6, padding: "12px 14px" }}>
                    {t("bkd_refund_empty")}
                  </div>
                )}
              </Card>

              {/* ── Review card ── */}
              {booking.status === "COMPLETED" && (
                <ReviewCard
                  bookingId={booking.bookingId}
                  hotelName={booking.hotelName}
                  hasReview={hasReview}
                  canWrite={canWriteReview}
                  createReview={createReview}
                  t={t}
                />
              )}

            </div>
          </div>
        )}
      </div>

      {showCancelDialog && (() => {
        const pKey = (booking?.cancellationPolicy || "MODERATE").toUpperCase();
        const pcfg = POLICY_CFG[pKey] || POLICY_CFG.MODERATE;
        return (
          <ConfirmDialog
            title={t("bkd_confirm_cancel_title")}
            message={t("bkd_confirm_cancel")}
            policyWarning={{ bg: pcfg.bg, border: pcfg.border, color: pcfg.color, text: t(pcfg.warnKey) }}
            confirmLabel={t("bkd_confirm_cancel_btn")}
            loading={cancelling}
            onConfirm={confirmCancel}
            onCancel={() => setShowCancelDialog(false)}
          />
        );
      })()}

      <Footer navigate={navigate} />
    </div>
  );
}
