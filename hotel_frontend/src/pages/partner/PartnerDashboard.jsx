import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useMyHotels, usePartnerBookings, useAnalyticsSummary } from "../../hooks/usePartnerQueries";
import { useQueries } from "@tanstack/react-query";
import { useLang } from "../../contexts/LanguageContext";
import { 
  AlertCircle, Building2, ClipboardList, CircleDollarSign, BarChart3,
  Bed, Calendar, ArrowRight, User
} from "lucide-react";
import "../../styles/pages/PartnerDashboard.css";

// --- Helpers ---
function fmtPrice(n) {
  const value = Number(n || 0);
  if (value >= 1_000_000_000) return (value / 1_000_000_000).toFixed(1) + " tỷ ₫";
  if (value >= 1_000_000)     return (value / 1_000_000).toFixed(1) + " tr ₫";
  return new Intl.NumberFormat("vi-VN").format(value) + " ₫";
}

function toIsoDate(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("vi-VN");
}

function formatDisplayName(user) {
  return user?.email?.split("@")[0] || "Đối tác";
}

function startOfCurrentMonth() {
  const now = new Date();
  return toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1));
}

function endOfCurrentMonth() {
  const now = new Date();
  return toIsoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
}

export default function PartnerDashboard() {
  const { user } = useAuth();
  const { t } = useLang();
  const rrNavigate = useNavigate();

  function statusConfig(status) {
    const STATUS_LABELS = {
      CONFIRMED:       { label: t("pt_status_confirmed"),       color: "#10b981", bg: "#ecfdf5" },
      PENDING_PAYMENT: { label: t("pt_status_pending_payment"), color: "#f59e0b", bg: "#fffbeb" },
      CANCELLED:       { label: t("pt_status_cancelled"),       color: "#94a3b8", bg: "#f8fafc" },
      COMPLETED:       { label: t("pt_status_completed"),       color: "#BE1E2E", bg: "#FFF1F2" },
    };
    return STATUS_LABELS[status] || { label: status || t("pt_status_unknown"), color: "#475569", bg: "#f8fafc" };
  }
  const analyticsParams = {
    checkInFrom: startOfCurrentMonth(),
    checkInTo:   endOfCurrentMonth(),
  };

  const { data: hotelData,     isLoading: hotelsLoading  } = useMyHotels();
  const { data: bookingData,   isLoading: bookingsLoading } = usePartnerBookings({ size: 10, page: 1 });
  const { data: analyticsData, isLoading: analyticsLoading } = useAnalyticsSummary(analyticsParams);

  const hotelList = Array.isArray(hotelData) ? hotelData : [];

  // Fetch rooms for each hotel in parallel
  const roomQueries = useQueries({
    queries: hotelList.map((hotel) => ({
      queryKey: ["partner", "rooms", hotel.id],
      queryFn:  () => import("../../services/partnerService").then((m) => m.partnerService.getRooms(hotel.id)),
      staleTime: 2 * 60 * 1000,
    })),
  });

  const hotels      = hotelList;
  const rooms       = roomQueries.flatMap((q) => Array.isArray(q.data) ? q.data : []);
  const bookings    = Array.isArray(bookingData?.items) ? bookingData.items : [];
  const bookingTotal = Number(bookingData?.totalItems ?? analyticsData?.totalBookings ?? bookings.length ?? 0);
  const analytics   = analyticsData || null;
  const loading     = hotelsLoading || bookingsLoading || analyticsLoading;
  const [error]     = useState("");

  const totalRoomTypes = rooms.length;
  const totalPhysicalRooms = rooms.reduce((sum, room) => sum + Number(room.quantity || 0), 0);
  const monthlyBookings = Number(analytics?.totalBookings || 0);
  const monthlyRevenue = Number(analytics?.netRevenue ?? analytics?.grossRevenue ?? 0);
  
  const stats = [
    { label: t("pt_dash_hotels"),  value: hotels.length,          hint: t("pt_dash_hotels_hint"),                                              Icon: Building2,         color: "#BE1E2E", path: "/partner/hotels"   },
    { label: t("pt_dash_bookings"),value: bookingTotal,            hint: t("pt_dash_bookings_hint"),                                            Icon: ClipboardList,     color: "#0EA5E9", path: "/partner/bookings" },
    { label: t("pt_dash_revenue"), value: fmtPrice(monthlyRevenue),hint: t("pt_dash_revenue_hint"),                                             Icon: CircleDollarSign,  color: "#7C3AED", path: "/partner/revenue"  },
    { label: t("pt_dash_rooms"),   value: totalPhysicalRooms,      hint: t("pt_dash_rooms_hint").replace("{n}", totalRoomTypes),                 Icon: Bed,               color: "#059669", path: "/partner/rooms"    },
  ];

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Hero Header */}
      <div style={{ 
        background: "linear-gradient(135deg, #1e293b 0%, #334155 100%)", 
        borderRadius: 16, padding: "32px 40px", marginBottom: 32, position: "relative", overflow: "hidden",
        boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)"
      }}>
        <div style={{ position: "relative", zIndex: 1 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "#fff", marginBottom: 8, display: "flex", alignItems: "center", gap: 12, userSelect: "none", cursor: "default" }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <User size={24} color="#fff" />
            </div>
            {t("pt_dash_greeting").replace("{name}", formatDisplayName(user))}
          </h1>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", maxWidth: 600, lineHeight: 1.6 }}>
            {t("pt_dash_subtitle")}
          </p>
          <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
            <button
              onClick={() => rrNavigate("/partner/calendar")}
              style={{ padding: "10px 20px", borderRadius: 8, background: "#BE1E2E", color: "#fff", border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
            >
              {t("pt_dash_manage_price")} <ArrowRight size={16} />
            </button>
            <button
              onClick={() => rrNavigate("/partner/revenue")}
              style={{ padding: "10px 20px", borderRadius: 8, background: "rgba(255,255,255,0.1)", color: "#fff", border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
            >
              {t("pt_dash_finance")}
            </button>
          </div>
        </div>
        {/* Background Decorative Circles */}
        <div style={{ position: "absolute", right: -50, top: -50, width: 200, height: 200, borderRadius: "50%", background: "rgba(59, 130, 246, 0.1)" }} />
        <div style={{ position: "absolute", right: 80, bottom: -80, width: 160, height: 160, borderRadius: "50%", background: "rgba(139, 92, 246, 0.1)" }} />
      </div>

      {error && (
        <div style={{ marginBottom: 20, padding: "12px 14px", borderRadius: 12, background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca", display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700 }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Stat Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, marginBottom: 32 }}>
        {stats.map(card => (
          <button
            key={card.label}
            onClick={() => rrNavigate(card.path)}
            className="partner-dashboard-stat-card"
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: `${card.color}10`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <card.Icon size={22} color={card.color} />
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#1e293b" }}>{loading ? "..." : card.value}</div>
            </div>
            <div style={{ fontSize: 13, color: "#64748b", marginTop: 4, fontWeight: 500 }}>{card.label}</div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6, fontWeight: 600 }}>{card.hint}</div>
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24 }}>
        {/* Recent Bookings */}
        <div style={{ background: "#fff", borderRadius: 16, padding: "24px", border: "1px solid #f1f5f9", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Calendar size={18} color="#0EA5E9" />
              <h2 style={{ fontSize: 16, fontWeight: 800, color: "#1e293b", margin: 0, userSelect: "none", cursor: "default" }}>{t("pt_dash_recent")}</h2>
            </div>
            <button onClick={() => rrNavigate("/partner/bookings")} style={{ fontSize: 13, color: "#BE1E2E", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>
              {t("pt_view_all")}
            </button>
          </div>

          <div className="partner-dashboard-table-wrapper">
            <table className="partner-dashboard-table">
              <thead>
                  <tr className="partner-dashboard-table-header">
                    {[t("pt_dash_col_customer"), t("pt_dash_col_hotel"), t("pt_dash_col_stay"), t("pt_dash_col_amount"), t("pt_dash_col_status")].map(h => (
                      <th key={h} className="partner-dashboard-table-th">{h}</th>
                    ))}
                  </tr>
              </thead>
              <tbody>
                {!loading && bookings.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: "36px 16px", textAlign: "center", color: "#94a3b8", fontWeight: 700 }}>
                      {t("pt_dash_no_bookings")}
                    </td>
                  </tr>
                )}
                {loading && (
                  <tr>
                    <td colSpan={5} style={{ padding: "36px 16px", textAlign: "center", color: "#94a3b8", fontWeight: 700 }}>
                      {t("pt_dash_loading_bk")}
                    </td>
                  </tr>
                )}
                {!loading && bookings.slice(0, 6).map((b) => {
                  const s = statusConfig(b.status);
                  return (
                    <tr key={b.bookingId} className="partner-dashboard-table-row" style={{ borderBottom: "1px solid #f8fafc" }}>
                      <td style={{ padding: "16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#475569" }}>
                            {b.customerName?.[0] || "C"}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: "#1e293b" }}>{b.customerName || t("pt_unknown_guest")}</div>
                            <div style={{ fontSize: 11, color: "#94a3b8" }}>#{b.bookingId}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "16px", color: "#475569", fontWeight: 600 }}>{b.hotelName}</td>
                      <td style={{ padding: "16px" }}>
                        <div style={{ fontSize: 13, color: "#1e293b", fontWeight: 500 }}>{formatDate(b.checkIn)}</div>
                        <div style={{ fontSize: 11, color: "#94a3b8" }}>{formatDate(b.checkOut)}</div>
                      </td>
                      <td style={{ padding: "16px", color: "#BE1E2E", fontWeight: 800 }}>
                        {fmtPrice(b.totalPrice)}
                      </td>
                      <td style={{ padding: "16px" }}>
                        <span style={{ 
                          padding: "4px 12px", borderRadius: 20, background: s.bg, color: s.color, 
                          fontSize: 11, fontWeight: 800, border: `1px solid ${s.bg}` 
                        }}>
                          {s.label.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Actions & Tips */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: "24px", border: "1px solid #f1f5f9", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: "#1e293b", marginBottom: 20, userSelect: "none", cursor: "default" }}>{t("pt_dash_quick")}</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { title: t("pt_dash_qa_hotels"),   Icon: Building2, color: "#BE1E2E", path: "/partner/hotels"   },
                { title: t("pt_dash_qa_calendar"), Icon: Calendar,  color: "#0EA5E9", path: "/partner/calendar" },
                { title: t("pt_dash_qa_revenue"),  Icon: BarChart3, color: "#7C3AED", path: "/partner/revenue"  },
              ].map(item => (
                <button key={item.title} onClick={() => rrNavigate(item.path)} 
                className="partner-dashboard-quick-action"
                style={{ "--action-color": item.color }}
                >
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: `${item.color}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <item.Icon size={18} color={item.color} />
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#334155" }}>{item.title}</span>
                </button>
              ))}
            </div>
          </div>

          <div style={{ background: "#eff6ff", borderRadius: 16, padding: "24px", border: "1px solid #bfdbfe" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#BE1E2E", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <BarChart3 size={16} color="#fff" />
              </div>
              <h3 style={{ fontSize: 14, fontWeight: 800, color: "#991B1B", margin: 0, userSelect: "none", cursor: "default" }}>{t("pt_dash_monthly")}</h3>
            </div>
            <p style={{ fontSize: 13, color: "#1e40af", lineHeight: 1.5, margin: 0 }}>
              {monthlyBookings > 0
                ? t("pt_dash_monthly_msg").replace("{n}", monthlyBookings).replace("{revenue}", fmtPrice(monthlyRevenue))
                : t("pt_dash_monthly_empty")}
            </p>
            <button
              onClick={() => rrNavigate("/partner/revenue")}
              style={{ marginTop: 16, background: "none", border: "none", color: "#1d4ed8", fontSize: 13, fontWeight: 700, cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 4 }}
            >
              {t("pt_dash_see_report")} <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
