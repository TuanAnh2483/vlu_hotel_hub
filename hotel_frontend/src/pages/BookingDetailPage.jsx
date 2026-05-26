import { useState } from "react";
import { C } from "../lib/constants";
import MainNavbar from "../components/MainNavbar";
import Footer from "../components/Footer";
import {
  useBookingDetail,
  usePaymentHistory,
  useRefundRequest,
  useCancelBooking,
} from "../hooks/useBookingQueries";
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
  User,
  XCircle,
} from "lucide-react";
import "../styles/pages/BookingDetailPage.css";

function useStatusMap() {
  const { t } = useLang();
  return {
    PENDING_PAYMENT: { label: t("status_pending_payment"), color: "#f59e0b", bg: "#fffbeb", icon: Clock },
    CONFIRMED:       { label: t("status_confirmed"),       color: "#10b981", bg: "#ecfdf5", icon: CheckCircle2 },
    CANCELLED:       { label: t("status_cancelled"),       color: "#ef4444", bg: "#fef2f2", icon: XCircle },
    COMPLETED:       { label: t("status_completed"),       color: "#3b82f6", bg: "#eff6ff", icon: ShieldCheck },
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

export default function BookingDetailPage({ navigate, user, params = {}, onLogout }) {
  const { t } = useLang();
  const statusMap        = useStatusMap();
  const paymentStatusMap = usePaymentStatusMap();
  const refundStatusMap  = useRefundStatusMap();

  const { bookingId } = params;
  const [cancelError, setCancelError] = useState("");

  const { data: booking,       isLoading: loading,         error: bookingError    } = useBookingDetail(bookingId);
  const { data: rawPayments,   isLoading: paymentsLoading, error: paymentsErr     } = usePaymentHistory(bookingId);
  const { data: refundRequest, isLoading: refundLoading,   error: refundErr       } = useRefundRequest(bookingId);

  const cancelBooking = useCancelBooking();

  const payments     = Array.isArray(rawPayments) ? rawPayments : [];
  const error        = bookingError?.message || cancelError || "";
  const paymentsError = paymentsErr?.message || "";
  const refundError  = refundErr?.message    || "";
  const cancelling   = cancelBooking.isPending;

  const handleCancel = () => {
    if (!booking || !window.confirm(t("bkd_confirm_cancel"))) return;
    setCancelError("");
    cancelBooking.mutate(booking.bookingId, {
      onError: (err) => setCancelError(err.message || t("bkd_load_error")),
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
  const canRequestRefund = booking
    && ["CONFIRMED", "COMPLETED", "CANCELLED"].includes(booking.status)
    && booking.status !== "REFUNDED"
    && !refundRequest;

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
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 360px", gap: 24, alignItems: "start" }}>
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

                {booking.expiresAt && booking.status === "PENDING_PAYMENT" && (
                  <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 14, color: "#92400e", marginBottom: 18, padding: "12px 14px" }}>
                    {t("bkd_expires")} {fmtDateTime(booking.expiresAt)}
                  </div>
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
                  <button
                    onClick={handleCancel}
                    disabled={cancelling}
                    style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, color: "#64748b", cursor: cancelling ? "not-allowed" : "pointer", fontSize: 14, fontWeight: 700, opacity: cancelling ? 0.7 : 1, padding: "14px 18px", width: "100%" }}
                  >
                    {cancelling ? t("bkd_cancelling") : t("bkd_cancel")}
                  </button>
                )}
              </Card>

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
                ) : (
                  <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 14, color: "#64748b", fontSize: 13, lineHeight: 1.6, padding: "12px 14px" }}>
                    {t("bkd_refund_empty")}
                  </div>
                )}
              </Card>

            </div>
          </div>
        )}
      </div>

      <Footer navigate={navigate} />
    </div>
  );
}
