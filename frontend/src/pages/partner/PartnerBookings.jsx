import { createElement, useState, useEffect } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { useMyHotels, usePartnerBookings, usePartnerBookingDetail, useCompleteBooking } from "../../hooks/usePartnerQueries";
import { PageHeader, Card, Badge, Btn, Table, Modal } from "../../components/admin/AdminLayout";
import { Filter, Calendar, Download, User, Building2, Eye, CheckCircle2 } from "lucide-react";
import { useLang } from "../../contexts/LanguageContext";
import "../../styles/pages/partner/PartnerBookings.css";

const fmtPrice = (n) => new Intl.NumberFormat("vi-VN").format(n) + " ₫";

function calcNights(checkIn, checkOut) {
  if (!checkIn || !checkOut) return "—";
  const diff = new Date(checkOut) - new Date(checkIn);
  const nights = Math.round(diff / (1000 * 60 * 60 * 24));
  return nights > 0 ? nights : "—";
}

const STATUS_TABS = [
  { label: "pt_all_statuses", value: "" },
  { label: "pt_bk_s_confirmed", value: "CONFIRMED" },
  { label: "pt_bk_s_pending", value: "PENDING_PAYMENT" },
  { label: "pt_bk_s_completed", value: "COMPLETED" },
  { label: "pt_bk_s_cancelled", value: "CANCELLED" },
];

function canCheckoutBooking(booking) {
  if (booking?.status !== "CONFIRMED" || !booking.checkOut) return false;
  const checkOut = new Date(`${booking.checkOut}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return !Number.isNaN(checkOut.getTime()) && checkOut <= today;
}

export default function PartnerBookings() {
  const navigate = useNavigate();
  const { t } = useLang();
  const { selectedHotelId: ctxHotelId, setSelectedHotelId: setCtxHotelId } = useOutletContext() || {};
  const [filters, setFilters] = useState({ hotelId: ctxHotelId ? String(ctxHotelId) : "", status: "", checkInFrom: "", checkInTo: "", page: 1 });

  useEffect(() => {
    setFilters(f => ({ ...f, hotelId: ctxHotelId ? String(ctxHotelId) : "", page: 1 }));
  }, [ctxHotelId]);
  const [detailId, setDetailId] = useState(null);
  const [checkoutConfirmId, setCheckoutConfirmId] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const { data: hotels = [] } = useMyHotels();
  const { data: pageData, isLoading: loading, error: loadError } = usePartnerBookings({ ...filters, size: 10 });
  const { data: detail } = usePartnerBookingDetail(detailId, { enabled: Boolean(detailId) });
  const completeBooking = useCompleteBooking();

  const items = pageData?.items || [];

  const handleExport = () => {
    if (!items.length) return;
    const headers = [t("pt_bk_col_code"), t("pt_bk_col_hotel"), t("pt_bk_col_customer"), t("pt_bk_col_checkin"), t("pt_bk_col_checkout"), t("pt_bk_col_nights"), t("pt_bk_col_total"), t("pt_bk_col_status")];
    const rows = items.map(b => [
      `#${b.bookingId}`,
      b.hotelName || "",
      b.customerName || "",
      b.checkIn || "",
      b.checkOut || "",
      calcNights(b.checkIn, b.checkOut),
      b.totalPrice,
      b.status,
    ]);
    const csv = [headers, ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bookings_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCheckout = (booking) => {
    if (!booking) return;
    setCheckoutConfirmId(null);
    setError("");
    setMessage("");
    completeBooking.mutate(booking.bookingId, {
      onSuccess: (updated) => {
        setMessage(t("pt_bk_checkout_msg").replace("{id}", updated.bookingId));
        if (detailId === booking.bookingId) setDetailId(null);
      },
      onError: (e) => setError(e.message || t("pt_bk_err_checkout")),
    });
  };

  const rows = items.map((b) => {
    const canCheckout = canCheckoutBooking(b);
    const isCheckingOut = completeBooking.isPending && completeBooking.variables === b.bookingId;

    return [
      <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: "#64748b" }}>#{b.bookingId}</span>,
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Building2 size={14} color="#94a3b8" />
        <span style={{ fontWeight: 600, color: "#1e293b" }}>{b.hotelName}</span>
      </div>,
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#475569" }}>
          {b.customerName?.[0] || "C"}
        </div>
        <span style={{ fontWeight: 500, color: "#334155" }}>{b.customerName || t("pt_unknown_guest")}</span>
      </div>,
      <div style={{ fontSize: 13, color: "#1e293b" }}>{b.checkIn}</div>,
      <div style={{ fontSize: 13, color: "#1e293b" }}>{b.checkOut}</div>,
      <div style={{ fontSize: 13, fontWeight: 600, color: "#475569", textAlign: "center" }}>{calcNights(b.checkIn, b.checkOut)} đêm</div>,
      <span style={{ fontWeight: 800, color: b.status === "CANCELLED" ? "#94a3b8" : "#BE1E2E" }}>{fmtPrice(b.totalPrice)}</span>,
      <Badge status={b.status} />,
      <button
        onClick={() => setDetailId(b.bookingId)}
        style={{ padding: "8px 16px", borderRadius: 10, background: "#f1f5f9", border: "none", color: "#475569", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
      >
        <Eye size={14} /> {t("pt_bk_detail")}
      </button>,
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {canCheckout && checkoutConfirmId !== b.bookingId && (
          <button
            onClick={() => setCheckoutConfirmId(b.bookingId)}
            disabled={isCheckingOut}
            style={{ alignItems: "center", background: "#10b981", border: "none", borderRadius: 10, color: "#fff", cursor: "pointer", display: "flex", fontSize: 12, fontWeight: 800, gap: 6, padding: "8px 12px" }}
          >
            <CheckCircle2 size={14} /> {t("pt_bk_checkout_btn")}
          </button>
        )}
        {canCheckout && checkoutConfirmId === b.bookingId && (
          <div style={{ display: "flex", gap: 6, alignItems: "center", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "6px 10px" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#047857" }}>Xác nhận check-out?</span>
            <button
              onClick={() => handleCheckout(b)}
              disabled={isCheckingOut}
              style={{ background: "#10b981", border: "none", borderRadius: 8, color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 800, padding: "5px 10px", opacity: isCheckingOut ? 0.7 : 1 }}
            >
              {isCheckingOut ? "..." : "Xác nhận"}
            </button>
            <button
              onClick={() => setCheckoutConfirmId(null)}
              style={{ background: "#f1f5f9", border: "none", borderRadius: 8, color: "#64748b", cursor: "pointer", fontSize: 12, fontWeight: 700, padding: "5px 10px" }}
            >
              Hủy
            </button>
          </div>
        )}
        {b.status === "COMPLETED" && (
          <span style={{ alignItems: "center", background: "#ecfdf5", border: "1px solid #bbf7d0", borderRadius: 10, color: "#047857", display: "flex", fontSize: 12, fontWeight: 800, gap: 6, padding: "7px 10px" }}>
            <CheckCircle2 size={14} /> {t("pt_bk_checked_out")}
          </span>
        )}
        <button
          onClick={() => navigate(`/partner/bookings/${b.bookingId}`)}
          style={{ padding: "8px 16px", borderRadius: 10, background: "#BE1E2E", color: "#fff", border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 10px rgba(190, 30, 46, 0.2)" }}
        >
          {t("pt_bk_view_full")}
        </button>
      </div>,
    ];
  });

  return (
    <div style={{ paddingBottom: 60 }}>
      <PageHeader
        title={t("pt_bk_title")}
        subtitle={t("pt_bk_subtitle")}
        action={
          <button
            onClick={handleExport}
            disabled={!items.length}
            style={{
              padding: "10px 18px", borderRadius: 10, background: "#fff", color: "#475569",
              border: "1px solid #e2e8f0", fontWeight: 700, fontSize: 13, cursor: items.length ? "pointer" : "not-allowed",
              display: "flex", alignItems: "center", gap: 8, opacity: items.length ? 1 : 0.5,
            }}
          >
            <Download size={16} /> {t("pt_bk_export")}
          </button>
        }
      />

      {/* Status Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {STATUS_TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => setFilters({ ...filters, status: tab.value, page: 1 })}
            style={{
              padding: "8px 18px", borderRadius: 20, border: "none", cursor: "pointer",
              fontWeight: 700, fontSize: 13, transition: "all 0.15s",
              background: filters.status === tab.value ? "#BE1E2E" : "#f1f5f9",
              color: filters.status === tab.value ? "#fff" : "#475569",
            }}
          >
            {t(tab.label)}
          </button>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="pb-filter-bar">
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <Building2 size={14} /> {t("pt_bk_hotel_label")}
          </div>
          <select
            style={selectSt}
            value={filters.hotelId}
            onChange={e => {
              const val = e.target.value;
              setFilters({ ...filters, hotelId: val, page: 1 });
              setCtxHotelId?.(val ? Number(val) : null);
            }}
          >
            <option value="">{t("pt_all_hotels")}</option>
            {hotels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <Calendar size={14} /> {t("pt_bk_from_label")}
          </div>
          <input
            type="date" style={selectSt} value={filters.checkInFrom}
            onChange={e => setFilters({ ...filters, checkInFrom: e.target.value, page: 1 })}
          />
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <Calendar size={14} /> {t("pt_bk_to_label")}
          </div>
          <input
            type="date" style={selectSt} value={filters.checkInTo}
            onChange={e => setFilters({ ...filters, checkInTo: e.target.value, page: 1 })}
          />
        </div>

        <button
          onClick={() => setFilters({ hotelId: "", status: "", checkInFrom: "", checkInTo: "", page: 1 })}
          style={{ padding: "10px 16px", borderRadius: 10, background: "#f1f5f9", border: "none", color: "#475569", fontWeight: 700, fontSize: 13, cursor: "pointer", height: 42 }}
        >
          {t("pt_bk_reset")}
        </button>
      </div>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        {(error || loadError) && (
          <div style={{ margin: 20, padding: "12px 14px", borderRadius: 12, background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", fontSize: 13, fontWeight: 700 }}>
            {error || loadError?.message || t("pt_bk_err_load")}
          </div>
        )}
        {message && (
          <div style={{ margin: 20, padding: "12px 14px", borderRadius: 12, background: "#ecfdf5", border: "1px solid #bbf7d0", color: "#047857", fontSize: 13, fontWeight: 700 }}>
            {message}
          </div>
        )}
        {loading
          ? <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>{t("pt_bk_loading")}</div>
          : <>
              <Table
                headers={[t("pt_bk_col_code"), t("pt_bk_col_hotel"), t("pt_bk_col_customer"), t("pt_bk_col_checkin"), t("pt_bk_col_checkout"), t("pt_bk_col_nights"), t("pt_bk_col_total"), t("pt_bk_col_status"), "", t("pt_bk_col_actions")]}
                rows={rows}
                empty={t("pt_all")}
              />

              {/* Pagination */}
              {pageData?.totalPages > 1 && (
                <div style={{ display: "flex", justifyContent: "center", gap: 8, padding: "24px", borderTop: "1px solid #f1f5f9" }}>
                  {[...Array(pageData.totalPages)].map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setFilters({ ...filters, page: i + 1 })}
                      style={{
                        width: 36, height: 36, borderRadius: 10, border: "1px solid #e2e8f0",
                        background: filters.page === i + 1 ? "#BE1E2E" : "#fff",
                        color: filters.page === i + 1 ? "#fff" : "#475569",
                        fontWeight: 700, cursor: "pointer", transition: "all 0.2s"
                      }}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              )}
            </>
        }
      </Card>

      {/* Detail Modal */}
      {detailId && (
        <Modal title={`Chi tiết đặt phòng #${detailId}`} onClose={() => setDetailId(null)} width={500}>
          {!detail ? (
            <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>{t("pt_bk_loading")}</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px", background: "#f8fafc", borderRadius: 12 }}>
                <div>
                  <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>TỔNG THANH TOÁN</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#BE1E2E" }}>{fmtPrice(detail.totalPrice)}</div>
                </div>
                <Badge status={detail.status} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <InfoItem label="Khách hàng" value={detail.customerName || detail.contact?.fullName || detail.contact?.email} Icon={User} />
                <InfoItem label="Khách sạn" value={detail.hotelName} Icon={Building2} />
                <InfoItem label="Nhận phòng" value={detail.checkIn} Icon={Calendar} />
                <InfoItem label="Trả phòng" value={detail.checkOut} Icon={Calendar} />
              </div>

              {detail.items && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#94a3b8", marginBottom: 10, letterSpacing: 0.5 }}>DANH SÁCH PHÒNG</div>
                  {detail.items.map((it, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #f1f5f9" }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#1e293b" }}>{it.roomTypeName} × {it.quantity}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#475569" }}>{fmtPrice(it.stayPrice)}</div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ marginTop: 10 }}>
                {canCheckoutBooking(detail) && (
                  <Btn
                    loading={completeBooking.isPending && completeBooking.variables === detail.bookingId}
                    style={{ width: "100%", marginBottom: 10, background: "#10b981", boxShadow: "0 4px 12px rgba(16,185,129,0.3)" }}
                    onClick={() => handleCheckout(detail)}
                  >
                    <CheckCircle2 size={15} /> {t("pt_bk_checkout_btn")}
                  </Btn>
                )}
                <Btn style={{ width: "100%" }} onClick={() => setDetailId(null)}>{t("pt_close")}</Btn>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

function InfoItem({ label, value, Icon }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
        {createElement(Icon, { size: 12 })} {label.toUpperCase()}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: "#1e293b" }}>{value || "—"}</div>
    </div>
  );
}

const selectSt = {
  width: "100%", padding: "10px 14px", borderRadius: 12, border: "1px solid #e2e8f0",
  fontSize: 14, outline: "none", background: "#f8fafc", cursor: "pointer", fontWeight: 500
};
