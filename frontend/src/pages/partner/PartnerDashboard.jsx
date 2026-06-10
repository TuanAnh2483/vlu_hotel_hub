import { useNavigate } from "react-router-dom";
import { useOutletContext } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useMyHotels, usePartnerBookings, useAnalyticsSummary, usePartnerRooms } from "../../hooks/usePartnerQueries";
import { useLang } from "../../contexts/LanguageContext";
import {
  Building2, ClipboardList, CircleDollarSign, BarChart3,
  Bed, Calendar, ArrowRight, TrendingUp, BedDouble,
  CalendarDays, Star, Lightbulb, PhoneCall,
} from "lucide-react";
import { getGroupColor, getTypeLabel } from "../../utils/propertyGroupUtils";
import { calcADR, calcOccupancyRate, calcRevPAR, sumBookingNights, periodDays, fmtMetric } from "../../utils/metricsCalculator";
import { SkeletonRow } from "../../components/ui/Skeleton";
import "../../styles/pages/PartnerDashboard.css";

const HOTEL_LIKE = ["HOTEL", "RESORT", "HOSTEL"];

function fmtPrice(n) { return fmtMetric(n, "currency"); }

function toIsoDate(date) {
  const yyyy = date.getFullYear();
  const mm   = String(date.getMonth() + 1).padStart(2, "0");
  const dd   = String(date.getDate()).padStart(2, "0");
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

const HOTEL_TIPS = [
  { Icon: TrendingUp,   color: "#059669", text: "Cập nhật giá cuối tuần giúp tăng doanh thu 15–20%." },
  { Icon: CalendarDays, color: "#0EA5E9", text: "Đặt lưu trú tối thiểu 2 đêm vào dịp lễ để tối ưu công suất." },
  { Icon: Star,         color: "#f59e0b", text: "Phản hồi đánh giá trong 24h tăng điểm xếp hạng tìm kiếm." },
  { Icon: PhoneCall,    color: "#7C3AED", text: "Cập nhật ảnh phòng định kỳ tăng tỷ lệ click từ khách." },
  { Icon: Lightbulb,    color: "#BE1E2E", text: "Đóng phòng trước lúc bảo trì để tránh huỷ đặt đột xuất." },
];

function PropertyBadge({ hotelType, lang }) {
  const color = getGroupColor(hotelType);
  const label = getTypeLabel(hotelType, lang);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
      background: `${color}18`, color, border: `1px solid ${color}40`,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, display: "inline-block" }} />
      {label}
    </span>
  );
}

function KpiCard({ label, value, hint, Icon, color, path, navigate, loading }) {
  return (
    <button onClick={() => navigate(path)} className="partner-dashboard-stat-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: `${color}10`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={22} color={color} />
        </div>
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, color: "#1e293b" }}>{loading ? "..." : value}</div>
      <div style={{ fontSize: 13, color: "#64748b", marginTop: 4, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6, fontWeight: 600 }}>{hint}</div>
    </button>
  );
}

export default function PartnerDashboard() {
  const { user } = useAuth();
  const { t, lang } = useLang();
  const rrNavigate = useNavigate();
  const { selectedHotelId } = useOutletContext() || {};

  const today      = toIsoDate(new Date());
  const monthLabel = new Date().toLocaleDateString("vi-VN", { month: "long", year: "numeric" });

  const sharedParam     = selectedHotelId ? { hotelId: selectedHotelId } : {};
  const analyticsParams = { checkInFrom: startOfCurrentMonth(), checkInTo: endOfCurrentMonth(), ...sharedParam };
  const bookingsParams  = { size: 10, page: 1, ...sharedParam };
  // Đếm chính xác booking CONFIRMED check-in hôm nay (loại bỏ CANCELLED / PENDING).
  // Chỉ cần totalItems nên lấy size:1 — totalItems là tổng số bản ghi, không phụ thuộc page size.
  const confirmedTodayParams = { checkInFrom: today, checkInTo: today, status: "CONFIRMED", size: 1, page: 1, ...sharedParam };

  const { data: hotelData,         isLoading: hotelsLoading    } = useMyHotels();
  const { data: bookingData,       isLoading: bookingsLoading  } = usePartnerBookings(bookingsParams);
  const { data: analyticsData,     isLoading: analyticsLoading } = useAnalyticsSummary(analyticsParams);
  const { data: confirmedTodayData, isLoading: todayLoading    } = usePartnerBookings(confirmedTodayParams);

  const hotelList     = Array.isArray(hotelData) ? hotelData : [];
  const selectedHotel = hotelList.find(h => h.id === selectedHotelId) || hotelList[0] || null;
  const hotelType     = selectedHotel?.hotelType || "HOTEL";
  const isHotelLike   = HOTEL_LIKE.includes(hotelType);

  const { data: roomsData = [], isLoading: roomsLoading } = usePartnerRooms(selectedHotel?.id || null);
  const rooms = Array.isArray(roomsData) ? roomsData : [];

  const bookings       = Array.isArray(bookingData?.items) ? bookingData.items : [];
  const bookingTotal   = Number(bookingData?.totalItems ?? analyticsData?.totalBookings ?? 0);
  const monthlyRevenue = Number(analyticsData?.netRevenue ?? analyticsData?.grossRevenue ?? 0);

  const totalPhysicalRooms = rooms.reduce((sum, r) => sum + Number(r.quantity || 0), 0);
  const checkInToday   = Number(confirmedTodayData?.totalItems ?? 0);
  const availableToday = Math.max(0, totalPhysicalRooms - checkInToday);

  const loading   = hotelsLoading || bookingsLoading || analyticsLoading;
  const opLoading = loading || todayLoading;

  // Hotel KPIs
  const confirmedBookings = bookings.filter(b => ["CONFIRMED","COMPLETED"].includes(b.status));
  const totalRevenue = confirmedBookings.reduce((s, b) => s + Number(b.totalPrice || 0), 0);
  const totalNights  = sumBookingNights(bookings);
  const totalRooms   = rooms.reduce((s, r) => s + Number(r.quantity || 0), 0);
  const days         = periodDays(startOfCurrentMonth(), endOfCurrentMonth());
  const adr          = calcADR(totalRevenue, totalNights);
  const occupancy    = calcOccupancyRate(totalNights, totalRooms, days);
  const revpar       = calcRevPAR(adr, occupancy);

  function statusConfig(status) {
    const MAP = {
      CONFIRMED:       { label: t("pt_status_confirmed"),       color: "#059669", bg: "#ecfdf5" },
      PENDING_PAYMENT: { label: t("pt_status_pending_payment"), color: "#b45309", bg: "#fffbeb" },
      CANCELLED:       { label: t("pt_status_cancelled"),       color: "#64748b", bg: "#f8fafc" },
      COMPLETED:       { label: t("pt_status_completed"),       color: "#BE1E2E", bg: "#FFF1F2" },
    };
    return MAP[status] || { label: status || t("pt_status_unknown"), color: "#475569", bg: "#f8fafc" };
  }

  const opKpis = [
    { label: "Phòng trống",     value: availableToday,       hint: "Chưa có khách check-in hôm nay", Icon: BedDouble,    color: "#059669", path: isHotelLike ? "/partner/rooms" : "/partner/calendar" },
    { label: "Check-in hôm nay", value: checkInToday,        hint: `Lượt nhận phòng ${today}`,       Icon: CalendarDays, color: "#0EA5E9", path: "/partner/bookings" },
    { label: "Booking tháng này", value: bookingTotal,        hint: `Tổng đặt phòng ${monthLabel}`,   Icon: ClipboardList, color: "#7C3AED", path: "/partner/bookings" },
    { label: "Tổng phòng",       value: totalPhysicalRooms,  hint: `${rooms.length} loại phòng`,     Icon: Bed,          color: "#f59e0b", path: isHotelLike ? "/partner/rooms" : "/partner/calendar" },
  ];

  const hotelKpis = [
    { label: "ADR",      hint: "TB/đêm phòng",  value: fmtPrice(adr),                    Icon: BedDouble,  color: "#0EA5E9", path: "/partner/revenue"  },
    { label: "Occupancy", hint: "Lấp đầy tháng", value: fmtMetric(occupancy, "percent"),  Icon: BarChart3,  color: "#7C3AED", path: "/partner/calendar" },
    { label: "RevPAR",   hint: "DT/phòng có sẵn", value: fmtPrice(revpar),               Icon: TrendingUp, color: "#059669", path: "/partner/revenue"  },
  ];

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#1e293b", margin: "0 0 6px" }}>
            {t("pt_dash_greeting").replace("{name}", formatDisplayName(user))}
          </h1>
          {selectedHotel ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "#64748b", fontSize: 13, fontWeight: 500 }}>{selectedHotel.name}</span>
              <PropertyBadge hotelType={hotelType} lang={lang} />
            </div>
          ) : (
            <div style={{ color: "#94a3b8", fontSize: 13 }}>{t("pt_dash_subtitle")}</div>
          )}
        </div>
        <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
          <button
            onClick={() => rrNavigate("/partner/calendar")}
            style={{ padding: "8px 16px", borderRadius: 8, background: "#BE1E2E", color: "#fff", border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
          >
            {t("pt_dash_manage_price")} <ArrowRight size={14} />
          </button>
          <button
            onClick={() => rrNavigate("/partner/revenue")}
            style={{ padding: "8px 16px", borderRadius: 8, background: "#fff", color: "#475569", border: "1px solid #e2e8f0", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
          >
            {t("pt_dash_finance")}
          </button>
        </div>
      </div>

      {/* Body: main + aside */}
      <div className="partner-dash-body">

        {/* ── Left: KPIs + bookings ── */}
        <div className="partner-dash-main">

          {/* Op KPI 4-grid */}
          <div className="partner-dashboard-stats-grid">
            {opKpis.map(card => (
              <KpiCard key={card.label} {...card} navigate={rrNavigate} loading={opLoading} />
            ))}
          </div>

          {/* Recent bookings */}
          <div style={{ background: "#fff", borderRadius: 16, padding: "24px", border: "1px solid #f1f5f9", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Calendar size={18} color="#0EA5E9" />
                <h2 style={{ fontSize: 16, fontWeight: 800, color: "#1e293b", margin: 0 }}>{t("pt_dash_recent")}</h2>
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
                  {loading && <><SkeletonRow cols={5} /><SkeletonRow cols={5} /><SkeletonRow cols={5} /></>}
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
                        <td style={{ padding: "16px", color: "#BE1E2E", fontWeight: 800 }}>{fmtPrice(b.totalPrice)}</td>
                        <td style={{ padding: "16px" }}>
                          <span style={{ padding: "4px 12px", borderRadius: 20, background: s.bg, color: s.color, fontSize: 11, fontWeight: 800, border: `1px solid ${s.color}30` }}>
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
        </div>

        {/* ── Right: Finance sidebar ── */}
        <aside className="partner-dash-aside">

          {/* Revenue + Hotel KPIs */}
          <div className="pda-card">
            <div className="pda-section-label">Tài chính — {monthLabel}</div>

            <div className="pda-revenue-row">
              <div className="pda-revenue-icon">
                <CircleDollarSign size={18} color="#7C3AED" />
              </div>
              <div>
                <div className="pda-revenue-value">{loading ? "..." : fmtPrice(monthlyRevenue)}</div>
                <div className="pda-revenue-hint">Doanh thu tháng này</div>
              </div>
            </div>

            {isHotelLike && (
              <div className="pda-kpi-list">
                {hotelKpis.map(k => (
                  <button key={k.label} className="pda-kpi-row" onClick={() => rrNavigate(k.path)}>
                    <div className="pda-kpi-icon" style={{ background: `${k.color}12`, color: k.color }}>
                      <k.Icon size={13} />
                    </div>
                    <div className="pda-kpi-meta">
                      <span className="pda-kpi-name">{k.label}</span>
                      <span className="pda-kpi-hint">{k.hint}</span>
                    </div>
                    <span className="pda-kpi-val" style={{ color: k.color }}>
                      {(loading || roomsLoading) ? "..." : k.value}
                    </span>
                  </button>
                ))}
              </div>
            )}

            <button onClick={() => rrNavigate("/partner/revenue")} className="pda-link">
              Xem báo cáo <ArrowRight size={11} />
            </button>
          </div>

          {/* Quick actions */}
          <div className="pda-card">
            <div className="pda-section-label">Thao tác nhanh</div>
            <div className="pda-quick-list">
              {[
                { title: "Quản lý cơ sở",  Icon: Building2,    color: "#BE1E2E", path: "/partner/hotels"   },
                { title: "Lịch phòng",      Icon: Calendar,     color: "#0EA5E9", path: "/partner/calendar" },
                { title: "Doanh thu",       Icon: BarChart3,    color: "#7C3AED", path: "/partner/revenue"  },
                { title: "AI Dự báo",       Icon: TrendingUp,   color: "#059669", path: "/partner/forecast" },
              ].map(item => (
                <button key={item.title} onClick={() => rrNavigate(item.path)} className="pda-quick-btn">
                  <div className="pda-quick-ico" style={{ background: `${item.color}12`, color: item.color }}>
                    <item.Icon size={14} />
                  </div>
                  <span className="pda-quick-label">{item.title}</span>
                  <ArrowRight size={11} className="pda-quick-arrow" />
                </button>
              ))}
            </div>
          </div>

          {/* Hotel tips */}
          <div className="pda-card pda-tips-card">
            <div className="pda-section-label">Gợi ý vận hành</div>
            <div className="pda-tips-list">
              {HOTEL_TIPS.map((tip, i) => (
                <div key={i} className="pda-tip-item">
                  <tip.Icon size={13} color={tip.color} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>{tip.text}</span>
                </div>
              ))}
            </div>
          </div>

        </aside>
      </div>
    </div>
  );
}
