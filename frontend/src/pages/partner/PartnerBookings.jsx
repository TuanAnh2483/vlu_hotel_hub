import { createElement, useState, useEffect } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { useMyHotels, usePartnerBookings, usePartnerBookingDetail, useCompleteBooking, usePartnerAssignedBookingIds } from "../../hooks/usePartnerQueries";
import { PageHeader, Card, Badge, Btn, Table, Modal } from "../../components/admin/AdminLayout";
import { Filter, Calendar, Download, User, Users, Building2, Eye, CheckCircle2, BedDouble, LogIn } from "lucide-react";
import { useLang } from "../../contexts/LanguageContext";
import "../../styles/pages/partner/PartnerBookings.css";
import "../../styles/pages/admin/AdminCommon.css";

const fmtPrice = (n) => new Intl.NumberFormat("vi-VN").format(n) + " ₫";

function calcNights(checkIn, checkOut) {
  if (!checkIn || !checkOut) return "—";
  const diff = new Date(checkOut) - new Date(checkIn);
  const nights = Math.round(diff / (1000 * 60 * 60 * 24));
  return nights > 0 ? nights : "—";
}

const STATUS_TABS = [
  { label: "pt_all_statuses",    value: "" },
  { label: "pt_bk_s_confirmed",  value: "CONFIRMED" },
  { label: "pt_bk_s_checked_in", value: "CHECKED_IN" },
  { label: "pt_bk_s_pending",    value: "PENDING_PAYMENT" },
  { label: "pt_bk_s_completed",  value: "COMPLETED" },
  { label: "pt_bk_s_cancelled",  value: "CANCELLED" },
];

function canCheckoutBooking(booking) {
  const status = booking?.status;
  if ((status !== "CONFIRMED" && status !== "CHECKED_IN") || !booking.checkOut) return false;
  const checkOut = new Date(`${booking.checkOut}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return !Number.isNaN(checkOut.getTime()) && checkOut <= today;
}

function canCheckinBooking(booking) {
  if (booking?.status !== "CONFIRMED" || !booking.checkIn) return false;
  const checkIn = new Date(`${booking.checkIn}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return !Number.isNaN(checkIn.getTime()) && today >= checkIn;
}

export default function PartnerBookings() {
  const navigate = useNavigate();
  const { t } = useLang();
  const { selectedHotelId: ctxHotelId, setSelectedHotelId: setCtxHotelId } = useOutletContext() || {};
  const [filters, setFilters] = useState({ hotelId: ctxHotelId ? String(ctxHotelId) : "", status: "", checkInFrom: "", checkInTo: "", page: 1 });

  useEffect(() => {
    setFilters(f => ({ ...f, hotelId: ctxHotelId ? String(ctxHotelId) : "", page: 1 }));
  }, [ctxHotelId]);

  const [detailId,           setDetailId]           = useState(null);
  const [checkoutConfirmId,  setCheckoutConfirmId]  = useState(null);
  const [error,              setError]              = useState("");
  const [message,            setMessage]            = useState("");

  const { data: hotels = [] }                     = useMyHotels();
  const { data: pageData, isLoading: loading, error: loadError } = usePartnerBookings({ ...filters, size: 10 });
  const { data: detail }                          = usePartnerBookingDetail(detailId, { enabled: Boolean(detailId) });
  const { data: assignedIds = [] }                = usePartnerAssignedBookingIds();
  const completeBooking = useCompleteBooking();

  const items = pageData?.items || [];
  const assignedSet = new Set(assignedIds);

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
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
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
        setTimeout(() => setMessage(""), 5000);
      },
      onError: (e) => setError(e.message || t("pt_bk_err_checkout")),
    });
  };

  const rows = items.map((b) => {
    const canCheckout  = canCheckoutBooking(b);
    const canCheckin   = canCheckinBooking(b);
    const needsAssign  = b.status === "CONFIRMED" && !canCheckin;
    const isCheckingOut = completeBooking.isPending && completeBooking.variables === b.bookingId;
    const isAssigned   = assignedSet.has(b.bookingId);

    return [
      <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
        <span className="pb-cell-id">#{b.bookingId}</span>
        {isAssigned && (
          <span
            title="Đã gán phòng vật lý"
            style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              background: "#d1fae5", color: "#047857",
              borderRadius: 999, padding: "2px 8px",
              fontSize: 11, fontWeight: 800, whiteSpace: "nowrap",
            }}
          >
            <BedDouble size={12} /> Đã gán
          </span>
        )}
      </div>,

      <div className="pb-cell-hotel">
        <Building2 size={14} color="#94a3b8" />
        {b.hotelName}
      </div>,

      <div className="pb-cell-customer">
        <div className="pb-cell-avatar">{b.customerName?.[0] || "C"}</div>
        {b.customerName || t("pt_unknown_guest")}
      </div>,

      <span className="pb-cell-date">{b.checkIn}</span>,
      <span className="pb-cell-date">{b.checkOut}</span>,
      <span className="pb-cell-nights">{calcNights(b.checkIn, b.checkOut)} đêm</span>,

      <span className={`pb-cell-amount${b.status === "CANCELLED" ? " pb-cell-amount--cancelled" : ""}`}>
        {fmtPrice(b.totalPrice)}
      </span>,

      <Badge status={b.status} />,

      /* All actions in one cell */
      <div className="pb-cell-actions">
        {/* View detail */}
        <button
          className="pb-act-btn pb-act-btn--view"
          title={t("pt_bk_detail")}
          aria-label={t("pt_bk_detail")}
          onClick={() => setDetailId(b.bookingId)}
        >
          <Eye size={15} />
        </button>

        {needsAssign && (
          <button
            className="pb-act-btn pb-act-btn--assign"
            title={t("pt_bk_assign_room")}
            aria-label={t("pt_bk_assign_room")}
            onClick={() => navigate(`/partner/bookings/${b.bookingId}`)}
          >
            <BedDouble size={14} />
          </button>
        )}

        {canCheckin && !canCheckout && (
          <button
            className="pb-act-btn pb-act-btn--checkin"
            title={t("pt_bk_checkin_btn")}
            aria-label={t("pt_bk_checkin_btn")}
            onClick={() => navigate(`/partner/bookings/${b.bookingId}`)}
          >
            <LogIn size={14} />
          </button>
        )}

        {canCheckout && checkoutConfirmId !== b.bookingId && (
          <button
            className="pb-act-btn pb-act-btn--checkout"
            title={t("pt_bk_checkout_btn")}
            aria-label={t("pt_bk_checkout_btn")}
            onClick={() => setCheckoutConfirmId(b.bookingId)}
            disabled={isCheckingOut}
          >
            <CheckCircle2 size={14} />
          </button>
        )}

        {canCheckout && checkoutConfirmId === b.bookingId && (
          <div className="pb-confirm-row">
            <span className="pb-confirm-label">Xác nhận?</span>
            <button className="pb-confirm-yes" onClick={() => handleCheckout(b)} disabled={isCheckingOut}>
              {isCheckingOut ? <><span className="spinner-sm" aria-hidden="true" /> Xử lý...</> : "Xác nhận"}
            </button>
            <button className="pb-confirm-no" onClick={() => setCheckoutConfirmId(null)}>Hủy</button>
          </div>
        )}

        {b.status === "COMPLETED" && (
          <span className="pb-act-badge--done">
            <CheckCircle2 size={13} /> {t("pt_bk_checked_out")}
          </span>
        )}
      </div>,
    ];
  });

  return (
    <div style={{ paddingBottom: 60 }}>
      <PageHeader
        title={t("pt_bk_title")}
        subtitle={t("pt_bk_subtitle")}
        action={
          <Btn variant="ghost" onClick={handleExport} disabled={!items.length}>
            <Download size={16} /> {t("pt_bk_export")}
          </Btn>
        }
      />

      {/* Status Tabs */}
      <div className="admin-filter-bar">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.value}
            className={`admin-filter-tab${filters.status === tab.value ? " active" : ""}`}
            onClick={() => setFilters({ ...filters, status: tab.value, page: 1 })}
          >
            {t(tab.label)}
          </button>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="pb-filter-bar">
        <div>
          <div className="pb-filter-label"><Building2 size={14} /> {t("pt_bk_hotel_label")}</div>
          <select
            className="pb-filter-input"
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
          <div className="pb-filter-label"><Calendar size={14} /> {t("pt_bk_from_label")}</div>
          <input type="date" className="pb-filter-input" value={filters.checkInFrom}
            onChange={e => setFilters({ ...filters, checkInFrom: e.target.value, page: 1 })} />
        </div>

        <div>
          <div className="pb-filter-label"><Calendar size={14} /> {t("pt_bk_to_label")}</div>
          <input type="date" className="pb-filter-input" value={filters.checkInTo}
            onChange={e => setFilters({ ...filters, checkInTo: e.target.value, page: 1 })} />
        </div>

        <Btn variant="ghost" onClick={() => setFilters({ hotelId: "", status: "", checkInFrom: "", checkInTo: "", page: 1 })}>
          {t("pt_bk_reset")}
        </Btn>
      </div>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        {(error || loadError) && (
          <div className="admin-error-alert" style={{ margin: 20 }}>
            {error || loadError?.message || t("pt_bk_err_load")}
          </div>
        )}
        {message && (
          <div style={{ background: "#ecfdf5", border: "1px solid #bbf7d0", borderRadius: 10, color: "#047857", fontSize: 13, fontWeight: 700, margin: 20, padding: "12px 14px" }}>
            {message}
          </div>
        )}
        {loading
          ? <div style={{ textAlign: "center", padding: 60, color: "#94a3b8", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
              <span className="spinner-sm dark" aria-hidden="true" />{t("pt_bk_loading")}
            </div>
          : <>
              <Table
                headers={[t("pt_bk_col_code"), t("pt_bk_col_hotel"), t("pt_bk_col_customer"), t("pt_bk_col_checkin"), t("pt_bk_col_checkout"), t("pt_bk_col_nights"), t("pt_bk_col_total"), t("pt_bk_col_status"), t("pt_bk_col_actions")]}
                rows={rows}
                empty={t("pt_bk_empty")}
              />

              {pageData?.totalPages > 1 && (() => {
                const pages = buildPageWindow(filters.page, pageData.totalPages);
                const go = (p) => setFilters({ ...filters, page: p });
                return (
                  <div className="pb-pagination">
                    <button className="pb-page-btn" disabled={filters.page === 1} onClick={() => go(filters.page - 1)}>‹</button>
                    {pages.map((p, idx) => {
                      const prev = pages[idx - 1];
                      return (
                        <span key={p} style={{ display: "contents" }}>
                          {prev && p - prev > 1 && <span className="pb-page-ellipsis">…</span>}
                          <button className={`pb-page-btn${filters.page === p ? " active" : ""}`} onClick={() => go(p)}>{p}</button>
                        </span>
                      );
                    })}
                    <button className="pb-page-btn" disabled={filters.page === pageData.totalPages} onClick={() => go(filters.page + 1)}>›</button>
                  </div>
                );
              })()}
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
                <InfoItem label="Khách sạn"  value={detail.hotelName}   Icon={Building2} />
                <InfoItem label="Nhận phòng" value={detail.checkIn}     Icon={Calendar} />
                <InfoItem label="Trả phòng"  value={detail.checkOut}    Icon={Calendar} />
                <InfoItem label="Số khách"   value={detail.guests != null ? `${detail.guests} khách` : "—"} Icon={Users} />
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
                <Btn style={{ width: "100%", marginBottom: 8 }} onClick={() => { setDetailId(null); navigate(`/partner/bookings/${detailId}`); }}>
                  {t("pt_bk_view_full")}
                </Btn>
                <Btn variant="ghost" style={{ width: "100%" }} onClick={() => setDetailId(null)}>{t("pt_close")}</Btn>
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

function buildPageWindow(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const near = new Set([1, total, current, current - 1, current + 1, current - 2, current + 2]);
  return [...near].filter(p => p >= 1 && p <= total).sort((a, b) => a - b);
}
