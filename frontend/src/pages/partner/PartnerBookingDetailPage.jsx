import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { usePartnerBookingDetail, useCompleteBooking } from "../../hooks/usePartnerQueries";
import { PageHeader, Card, Badge } from "../../components/admin/AdminLayout";
import { useLang } from "../../contexts/LanguageContext";
import { ArrowLeft, Calendar, User, Building2, CreditCard, Clock, CheckCircle2 } from "lucide-react";
import "../../styles/pages/PartnerBookingDetailPage.css";

function fmtPrice(n) {
  return new Intl.NumberFormat("vi-VN").format(n) + " ₫";
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function canCheckoutBooking(booking) {
  if (booking?.status !== "CONFIRMED" || !booking.checkOut) return false;
  const checkOut = new Date(`${booking.checkOut}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return !Number.isNaN(checkOut.getTime()) && checkOut <= today;
}

export default function PartnerBookingDetailPage() {
  const { t } = useLang();
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");

  const { data: booking, isLoading: loading, error } = usePartnerBookingDetail(bookingId);
  const completeBooking = useCompleteBooking();
  const completing = completeBooking.isPending;

  function handleComplete() {
    if (!booking || !window.confirm(t("pt_bk_confirm_checkout"))) return;
    setActionError("");
    setActionMessage("");
    completeBooking.mutate(booking.bookingId, {
      onSuccess: () => setActionMessage(t("pt_bk_checkout_done")),
      onError: (e) => setActionError(e.message || t("pt_bk_err_checkout")),
    });
  }

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>{t("pt_loading")}</div>;
  if (error || !booking) return <div style={{ padding: 40, textAlign: "center", color: "#ef4444" }}>{error?.message || t("pt_bk_err_detail")}</div>;

  const customerName = booking.customerName || booking.contact?.fullName || booking.contact?.email || "khách hàng";

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <button
          onClick={() => navigate("/partner/bookings")}
          className="partner-booking-detail-back-btn"
        >
          <ArrowLeft size={18} /> {t("pt_bk_back")}
        </button>
      </div>

      <PageHeader
        title={t("pt_bk_detail_title").replace("#{id}", booking.bookingId)}
        subtitle={t("pt_bk_detail_subtitle").replace("{name}", customerName)}
        action={<Badge status={booking.status} />}
      />

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Main Info */}
          <Card title={t("pt_bk_section_hotel_rooms")}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", gap: 12 }}>
                <Building2 size={18} color="#64748b" style={{ marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>{t("pt_bk_col_hotel")}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>{booking.hotelName}</div>
                </div>
              </div>

              <div style={{ height: 1, background: "#f1f5f9" }} />

              <div>
                <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, marginBottom: 12 }}>{t("pt_bk_section_rooms")}</div>
                {booking.items?.map((item, i) => (
                  <div key={i} style={{ background: "#f8fafc", borderRadius: 10, padding: "12px 16px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 700, color: "#1e293b" }}>{item.roomTypeName || item.roomName || "Phòng"}</div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>{t("pt_bk_room_qty").replace("{n}", item.quantity)}</div>
                    </div>
                    <div style={{ fontWeight: 800, color: "#BE1E2E" }}>{fmtPrice(item.stayPrice)}</div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Customer Info */}
          <Card title={t("pt_bk_section_customer")}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <div style={{ display: "flex", gap: 12 }}>
                <User size={18} color="#64748b" />
                <div>
                  <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>{t("pt_bk_customer_name")}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#1e293b" }}>{customerName}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <CreditCard size={18} color="#64748b" />
                <div>
                  <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>{t("pt_bk_contact")}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#1e293b" }}>{booking.contact?.email || booking.contact?.phone || "—"}</div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Summary */}
          <Card style={{ background: "#FFF1F2", border: "1px solid #FFE4E6" }}>
            <div style={{ fontSize: 12, color: "#BE1E2E", fontWeight: 700, marginBottom: 16 }}>{t("pt_bk_section_cost")}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>{t("pt_bk_total_label")}</span>
                <span style={{ fontSize: 20, fontWeight: 800, color: "#BE1E2E" }}>{fmtPrice(booking.totalPrice)}</span>
              </div>
            </div>
            {actionError && (
              <div style={{ background: "#fff", border: "1px solid #fecaca", borderRadius: 10, color: "#b91c1c", fontSize: 12, fontWeight: 700, lineHeight: 1.5, marginTop: 16, padding: "10px 12px" }}>
                {actionError}
              </div>
            )}
            {actionMessage && (
              <div style={{ background: "#ecfdf5", border: "1px solid #bbf7d0", borderRadius: 10, color: "#047857", fontSize: 12, fontWeight: 700, lineHeight: 1.5, marginTop: 16, padding: "10px 12px" }}>
                {actionMessage}
              </div>
            )}
            {canCheckoutBooking(booking) && (
              <button
                onClick={handleComplete}
                disabled={completing}
                style={{ alignItems: "center", background: "#10b981", border: "none", borderRadius: 10, color: "#fff", cursor: completing ? "not-allowed" : "pointer", display: "flex", fontSize: 13, fontWeight: 800, gap: 8, justifyContent: "center", marginTop: 16, opacity: completing ? 0.7 : 1, padding: "12px 14px", width: "100%" }}
              >
                <CheckCircle2 size={16} />
                {completing ? t("pt_bk_checking_out") : t("pt_bk_checkout_open")}
              </button>
            )}
          </Card>

          {/* Dates */}
          <Card title={t("pt_bk_section_time")}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", gap: 12 }}>
                <Calendar size={18} color="#64748b" />
                <div>
                  <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>{t("pt_bk_col_checkin")}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>{new Date(booking.checkIn).toLocaleDateString("vi-VN")}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <Calendar size={18} color="#64748b" />
                <div>
                  <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>{t("pt_bk_col_checkout")}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>{new Date(booking.checkOut).toLocaleDateString("vi-VN")}</div>
                </div>
              </div>
              <div style={{ height: 1, background: "#f1f5f9" }} />
              <div style={{ display: "flex", gap: 12 }}>
                <Clock size={18} color="#64748b" />
                <div>
                  <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>{t("pt_bk_created_at")}</div>
                  <div style={{ fontSize: 14, color: "#64748b" }}>{fmtDate(booking.createdAt)}</div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
