import { useState } from "react";
import { C } from "../components/auth/AuthShared";
import MainNavbar from "../components/MainNavbar";
import Footer from "../components/Footer";
import { useMyBookings } from "../hooks/useBookingQueries";
import { useLang } from "../contexts/LanguageContext";
import EmptyState from "../components/ui/EmptyState";
import { SkeletonBookingCard } from "../components/ui/Skeleton";
import { CalendarOff, ClipboardList } from "lucide-react";

function useStatusMap() {
  const { t } = useLang();
  return {
    PENDING_PAYMENT: { label: t("status_pending_payment"), color: "#d48806", bg: "#fffbe6", border: "#ffe58f" },
    CONFIRMED:       { label: t("status_confirmed"),       color: "#389e0d", bg: "#f6ffed", border: "#b7eb8f" },
    CANCELLED:       { label: t("status_cancelled"),       color: "#888",    bg: "#f5f5f5", border: "#d9d9d9" },
    COMPLETED:       { label: t("status_completed"),       color: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe" },
    REFUNDED:        { label: t("status_refunded"),        color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
  };
}

function fmt(n) { return (n || 0).toLocaleString("vi-VN") + "₫"; }

function fmtDate(s) {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d) ? s : d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function nightsBetween(a, b) {
  if (!a || !b) return 0;
  const diff = (new Date(b) - new Date(a)) / 86400000;
  return diff > 0 ? Math.round(diff) : 0;
}

function StatusBadge({ status }) {
  const statusMap = useStatusMap();
  const cfg = statusMap[status] || { label: status, color: "#555", bg: "#eee", border: "#ccc" };
  return (
    <span style={{ padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
      {cfg.label}
    </span>
  );
}

function BookingCard({ booking, onView }) {
  const { t } = useLang();
  const roomNames = booking.items?.map(i => i.roomTypeName).join(", ") || t("mybookings_room_fb");
  const n = nightsBetween(booking.checkIn, booking.checkOut);
  const isPending = booking.status === "PENDING_PAYMENT";

  return (
    <div style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #eee", padding: "20px 24px", marginBottom: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div>
          <p style={{ fontSize: 12, color: "#aaa", margin: "0 0 4px" }}>{t("mybookings_booking_id")}{booking.bookingId}</p>
          <p style={{ fontSize: 15, fontWeight: 700, color: "#1a1a1a", margin: 0 }}>{roomNames}</p>
        </div>
        <StatusBadge status={booking.status} />
      </div>

      <div style={{ display: "flex", gap: 24, fontSize: 13, color: "#555", marginBottom: 12, flexWrap: "wrap" }}>
        <span>📅 {fmtDate(booking.checkIn)} → {fmtDate(booking.checkOut)}</span>
        {n > 0 && <span>🌙 {n}{t("night")}</span>}
        {booking.contact?.fullName && <span>👤 {booking.contact.fullName}</span>}
      </div>

      {isPending && booking.expiresAt && (
        <div style={{ fontSize: 12, color: "#d48806", background: "#fffbe6", borderRadius: 6, padding: "4px 10px", display: "inline-block", marginBottom: 12 }}>
          ⏰ {t("mybookings_expires")} {new Date(booking.expiresAt).toLocaleString("vi-VN")}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: C.primary }}>{fmt(booking.totalPrice)}</p>
        <button
          style={{ background: C.primary, color: "#fff", border: "none", borderRadius: 8, padding: "9px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          onClick={onView}
        >{t("mybookings_view")}</button>
      </div>
    </div>
  );
}

function useTabs() {
  const { t } = useLang();
  return [
    { key: "ALL",             label: t("tab_all") },
    { key: "PENDING_PAYMENT", label: t("tab_pending") },
    { key: "CONFIRMED",       label: t("tab_confirmed") },
    { key: "COMPLETED",       label: t("tab_completed") },
    { key: "REFUNDED",        label: t("tab_refunded") },
    { key: "CANCELLED",       label: t("tab_cancelled") },
  ];
}

export default function MyBookingsPage({ navigate, user, onLogout }) {
  const { t } = useLang();
  const tabs = useTabs();
  const [tab, setTab] = useState("ALL");

  const { data, isLoading: loading, error: queryError } = useMyBookings({ enabled: Boolean(user) });
  const bookings = Array.isArray(data) ? data : [];
  const error = queryError?.message || "";

  if (!user) {
    return (
      <div style={{ minHeight: "100vh", background: "#f7f8fa", fontFamily: "'Segoe UI',sans-serif" }}>
        <MainNavbar active="my-bookings" navigate={navigate} user={user} onLogout={onLogout} />
        <div style={{ maxWidth: 480, margin: "80px auto", textAlign: "center", padding: 24 }}>
          <p style={{ fontSize: 16, color: "#555", marginBottom: 20 }}>{t("mybookings_login_msg")}</p>
          <button
            style={{ background: C.primary, color: "#fff", border: "none", borderRadius: 10, padding: "12px 32px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}
            onClick={() => navigate("login")}
          >{t("nav_login")}</button>
        </div>
      </div>
    );
  }

  const filtered = tab === "ALL" ? bookings : bookings.filter(b => b.status === tab);

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #ffffff 0%, #fdf4f5 45%, #f7ebeb 100%)", fontFamily: "'Segoe UI',sans-serif", display: "flex", flexDirection: "column" }}>
      <MainNavbar active="my-bookings" navigate={navigate} user={user} onLogout={onLogout} />

      <div style={{ maxWidth: 900, margin: "0 auto", width: "100%", padding: "32px 24px", flex: 1, boxSizing: "border-box" }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "#1a1a1a", marginBottom: 24 }}>{t("mybookings_title")}</h1>

        {/* Status tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
          {tabs.map(tb => (
            <button key={tb.key}
              style={{ padding: "8px 18px", borderRadius: 20, border: "1.5px solid", borderColor: tab === tb.key ? C.primary : "#ddd", background: tab === tb.key ? C.primary : "#fff", color: tab === tb.key ? "#fff" : "#555", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              onClick={() => setTab(tb.key)}
            >{tb.label}</button>
          ))}
        </div>

        {loading && (
          <>
            <SkeletonBookingCard />
            <SkeletonBookingCard />
            <SkeletonBookingCard />
          </>
        )}

        {error && (
          <div style={{ background: "#fff5f5", border: "1px solid #ffa39e", borderRadius: 10, padding: "12px 16px", color: "#cf1322", marginBottom: 16 }}>
            {error}
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          tab === "ALL" ? (
            <EmptyState
              icon={<CalendarOff size={56} />}
              title={t("mybookings_empty_all")}
              description={t("mybookings_empty_all_desc")}
              action={{ label: t("mybookings_find_hotel"), onClick: () => navigate("hotels") }}
            />
          ) : (
            <EmptyState
              icon={<ClipboardList size={56} />}
              title={t("mybookings_empty_tab")}
            />
          )
        )}

        {filtered.map(b => (
          <BookingCard
            key={b.bookingId}
            booking={b}
            onView={() => navigate("booking-detail", { bookingId: b.bookingId })}
          />
        ))}
      </div>

      <Footer navigate={navigate} />
    </div>
  );
}
