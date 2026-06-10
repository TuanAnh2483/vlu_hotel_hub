import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LogIn, LogOut, Users, Building2, ArrowRight,
  CalendarDays, Loader2, CheckCircle2, Clock,
} from "lucide-react";
import {
  usePartnerBookings, useCheckinBooking, useCompleteBooking,
} from "../../../hooks/usePartnerQueries";
import { fmtDate, fmtCurrency } from "./calendarUtils";

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_CFG = {
  CONFIRMED:        { label: "Đã xác nhận",  bg: "#ECFDF5", color: "#059669" },
  CHECKED_IN:       { label: "Đang lưu trú", bg: "#EFF6FF", color: "#2563EB" },
  PENDING_PAYMENT:  { label: "Chờ thanh toán",bg: "#FFFBEB", color: "#D97706" },
  COMPLETED:        { label: "Đã hoàn thành", bg: "#F0FDF4", color: "#15803d" },
  CANCELLED:        { label: "Đã hủy",        bg: "#FEF2F2", color: "#DC2626" },
};

function StatusChip({ status }) {
  const cfg = STATUS_CFG[status] || { label: status, bg: "#f1f5f9", color: "#64748b" };
  return (
    <span className="pcops-status" style={{ background: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  );
}

function KpiChip({ icon: Icon, color, bg, label, value, loading }) {
  return (
    <div className="pcops-kpi" style={{ background: bg, borderColor: color + "33" }}>
      <div className="pcops-kpi-icon" style={{ background: color + "18", color }}>
        <Icon size={18} />
      </div>
      <div>
        <div className="pcops-kpi-value" style={{ color }}>
          {loading ? <Loader2 size={16} className="pcops-spin" /> : value}
        </div>
        <div className="pcops-kpi-label">{label}</div>
      </div>
    </div>
  );
}

function ActionButton({ label, icon: Icon, color, onClick, loading, disabled }) {
  return (
    <button
      type="button"
      className="pcops-action-btn"
      style={{ background: color, opacity: disabled ? 0.5 : 1 }}
      onClick={onClick}
      disabled={loading || disabled}
    >
      {loading ? <Loader2 size={13} className="pcops-spin" /> : <Icon size={13} />}
      {label}
    </button>
  );
}

// ── Booking row ───────────────────────────────────────────────────────────────

function BookingRow({ booking, action, onAction, actionLoading }) {
  const navigate = useNavigate();
  const nights = useMemo(() => {
    if (!booking.checkIn || !booking.checkOut) return 0;
    const diff = new Date(booking.checkOut) - new Date(booking.checkIn);
    return Math.max(1, Math.round(diff / 86400000));
  }, [booking.checkIn, booking.checkOut]);

  const roomSummary = useMemo(() => {
    const items = booking.items ?? [];
    if (!items.length) return "—";
    return items.map(i => `${i.roomTypeName || "Phòng"} ×${i.quantity || 1}`).join(", ");
  }, [booking.items]);

  return (
    <div className="pcops-row">
      <div className="pcops-row-main">
        <div className="pcops-booking-id">#{booking.bookingId}</div>
        <div className="pcops-guest-name">{booking.customerName || "Khách"}</div>
        <div className="pcops-room-summary">{roomSummary}</div>
        <div className="pcops-dates">
          <CalendarDays size={11} />
          {fmtDate(booking.checkIn)} → {fmtDate(booking.checkOut)}
          <span className="pcops-nights">{nights} đêm</span>
        </div>
        {booking.totalPrice != null && (
          <div className="pcops-price">{fmtCurrency(booking.totalPrice)}</div>
        )}
      </div>
      <div className="pcops-row-aside">
        <StatusChip status={booking.status} />
        <div className="pcops-row-btns">
          {action === "checkin" && (
            <ActionButton
              label="Check-in"
              icon={LogIn}
              color="#059669"
              onClick={() => onAction(booking.bookingId)}
              loading={actionLoading === booking.bookingId}
            />
          )}
          {action === "checkout" && (
            <ActionButton
              label="Check-out"
              icon={LogOut}
              color="#BE1E2E"
              onClick={() => onAction(booking.bookingId)}
              loading={actionLoading === booking.bookingId}
            />
          )}
          <button
            type="button"
            className="pcops-detail-btn"
            onClick={() => navigate(`/partner/bookings/${booking.bookingId}`)}
          >
            Chi tiết <ArrowRight size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ icon: Icon, color, title, badge, children, loading, empty }) {
  return (
    <div className="pcops-section">
      <div className="pcops-section-hd" style={{ borderLeftColor: color }}>
        <Icon size={16} color={color} />
        <span className="pcops-section-title">{title}</span>
        {badge != null && (
          <span className="pcops-section-badge" style={{ background: color + "18", color }}>
            {badge}
          </span>
        )}
      </div>
      {loading ? (
        <div className="pcops-loading">
          <Loader2 size={20} className="pcops-spin" />
          <span>Đang tải...</span>
        </div>
      ) : empty ? (
        <div className="pcops-empty">
          <CheckCircle2 size={20} color="#94a3b8" />
          <span>Không có mục nào</span>
        </div>
      ) : (
        <div className="pcops-list">{children}</div>
      )}
    </div>
  );
}

// ── Hotel selector ────────────────────────────────────────────────────────────

function HotelSelect({ hotels, selectedHotelId, onHotelChange }) {
  if (hotels.length <= 1) return null;
  return (
    <div className="pcops-hotel-select-wrap">
      <Building2 size={14} color="#94a3b8" />
      <select
        className="pcops-hotel-select"
        value={selectedHotelId}
        onChange={e => onHotelChange(e.target.value)}
      >
        {hotels.map(h => (
          <option key={h.id} value={String(h.id)}>{h.name}</option>
        ))}
      </select>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function OperationsTab({ hotels, selectedHotelId, onHotelChange, todayIso }) {
  const [checkinLoadingId,  setCheckinLoadingId]  = useState(null);
  const [checkoutLoadingId, setCheckoutLoadingId] = useState(null);

  const hotelId = selectedHotelId ? Number(selectedHotelId) : undefined;

  // Today's expected arrivals (CONFIRMED, checkIn = today)
  const { data: arrivalsPage, isLoading: arrivalsLoading } = usePartnerBookings(
    { hotelId, status: "CONFIRMED", checkInFrom: todayIso, checkInTo: todayIso, size: 100 },
    { enabled: Boolean(hotelId) },
  );
  const arrivals = useMemo(
    () => arrivalsPage?.items ?? arrivalsPage ?? [],
    [arrivalsPage],
  );

  // All in-house guests (CHECKED_IN)
  const { data: inHousePage, isLoading: inHouseLoading } = usePartnerBookings(
    { hotelId, status: "CHECKED_IN", size: 100 },
    { enabled: Boolean(hotelId) },
  );
  const inHouseAll = useMemo(
    () => inHousePage?.items ?? inHousePage ?? [],
    [inHousePage],
  );

  // Split in-house: departing today vs still staying
  const { departures, staying } = useMemo(() => {
    const departures = inHouseAll.filter(b => b.checkOut === todayIso);
    const staying    = inHouseAll.filter(b => b.checkOut !== todayIso);
    return { departures, staying };
  }, [inHouseAll, todayIso]);

  const checkinMutation  = useCheckinBooking();
  const checkoutMutation = useCompleteBooking();

  async function handleCheckin(bookingId) {
    setCheckinLoadingId(bookingId);
    try { await checkinMutation.mutateAsync(bookingId); }
    finally { setCheckinLoadingId(null); }
  }

  async function handleCheckout(bookingId) {
    setCheckoutLoadingId(bookingId);
    try { await checkoutMutation.mutateAsync(bookingId); }
    finally { setCheckoutLoadingId(null); }
  }

  const todayLabel = new Date(todayIso).toLocaleDateString("vi-VN", {
    weekday: "long", day: "2-digit", month: "2-digit", year: "numeric",
  });

  return (
    <div className="pcops-root">
      {/* Header strip */}
      <div className="pcops-header">
        <div className="pcops-header-left">
          <Clock size={16} color="#BE1E2E" />
          <span className="pcops-today-label">Hôm nay — {todayLabel}</span>
        </div>
        <HotelSelect
          hotels={hotels}
          selectedHotelId={selectedHotelId}
          onHotelChange={onHotelChange}
        />
      </div>

      {/* KPI chips */}
      <div className="pcops-kpis">
        <KpiChip
          icon={LogIn} color="#059669" bg="#ECFDF5"
          label="Nhận phòng hôm nay"
          value={arrivals.length}
          loading={arrivalsLoading}
        />
        <KpiChip
          icon={Users} color="#2563EB" bg="#EFF6FF"
          label="Đang lưu trú"
          value={inHouseAll.length}
          loading={inHouseLoading}
        />
        <KpiChip
          icon={LogOut} color="#BE1E2E" bg="#FFF1F2"
          label="Trả phòng hôm nay"
          value={departures.length}
          loading={inHouseLoading}
        />
      </div>

      {!hotelId ? (
        <div className="pcops-no-hotel">
          <Building2 size={32} color="#cbd5e1" />
          <p>Vui lòng chọn khách sạn để xem vận hành</p>
        </div>
      ) : (
        <div className="pcops-sections">
          {/* Arrivals */}
          <Section
            icon={LogIn} color="#059669"
            title="Nhận phòng hôm nay"
            badge={arrivals.length}
            loading={arrivalsLoading}
            empty={!arrivalsLoading && arrivals.length === 0}
          >
            {arrivals.map(b => (
              <BookingRow
                key={b.bookingId}
                booking={b}
                action="checkin"
                onAction={handleCheckin}
                actionLoading={checkinLoadingId}
              />
            ))}
          </Section>

          {/* Departures today */}
          <Section
            icon={LogOut} color="#BE1E2E"
            title="Trả phòng hôm nay"
            badge={departures.length}
            loading={inHouseLoading}
            empty={!inHouseLoading && departures.length === 0}
          >
            {departures.map(b => (
              <BookingRow
                key={b.bookingId}
                booking={b}
                action="checkout"
                onAction={handleCheckout}
                actionLoading={checkoutLoadingId}
              />
            ))}
          </Section>

          {/* Still staying */}
          <Section
            icon={Users} color="#2563EB"
            title="Đang lưu trú"
            badge={staying.length}
            loading={inHouseLoading}
            empty={!inHouseLoading && staying.length === 0}
          >
            {staying.map(b => (
              <BookingRow
                key={b.bookingId}
                booking={b}
                action={null}
                onAction={null}
                actionLoading={null}
              />
            ))}
          </Section>
        </div>
      )}
    </div>
  );
}
