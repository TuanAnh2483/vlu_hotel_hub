import AdminLayout, { AP, Card } from "../../components/admin/AdminLayout";
import { useAdminStats } from "../../hooks/useAdminQueries";
import Skeleton from "../../components/ui/Skeleton";
import { useLang } from "../../contexts/LanguageContext";
import {
  Users, Handshake, Building2, ClipboardList, Clock,
  DollarSign, Settings, Home,
  Tag, Globe, Server, Database, Shield, Calendar,
  Bed, Star, BarChart3, Bot,
} from "lucide-react";
import "../../styles/pages/AdminDashboard.css";

function StatCard({ icon, label, value, color, sub, onClick }) {
  return (
    <div
      onClick={onClick}
      className="admin-dashboard-stat-card"
      style={{ cursor: onClick ? "pointer" : "default" }}
    >
      <div
        className="admin-dashboard-stat-icon"
        style={{
          background: `linear-gradient(135deg, ${color}22, ${color}11)`,
          border: `1px solid ${color}30`,
        }}
      >
        {icon}
      </div>
      <div className="admin-dashboard-stat-info">
        <div className="admin-dashboard-stat-value">
          {value !== null && value !== undefined ? value.toLocaleString() : "—"}
        </div>
        <div className="admin-dashboard-stat-label">{label}</div>
        {sub && <div className="admin-dashboard-stat-sub" style={{ color }}>{sub}</div>}
      </div>
      {onClick && <span className="admin-dashboard-stat-arrow">›</span>}
    </div>
  );
}

function QuickBtn({ icon, label, desc, onClick }) {
  return (
    <button onClick={onClick} className="admin-dashboard-quick-btn">
      <span className="admin-dashboard-quick-btn-icon">{icon}</span>
      <div>
        <div className="admin-dashboard-quick-btn-label">{label}</div>
        <div className="admin-dashboard-quick-btn-desc">{desc}</div>
      </div>
    </button>
  );
}

export default function AdminDashboard({ navigate, user, onLogout }) {
  const { t } = useLang();
  const { data: stats, isLoading: loading } = useAdminStats();

  const STATS = [
    { icon: <Users size={24} color="#4361ee" />,     label: t("adm_dash_customers"),     key: "totalUsers",      color: "#4361ee", page: "admin-users"    },
    { icon: <Handshake size={24} color="#7209b7" />, label: t("adm_dash_partners"),       key: "totalPartners",   color: "#7209b7", page: "admin-partners" },
    { icon: <Building2 size={24} color={AP} />,      label: t("adm_dash_hotels"),         key: "totalHotels",     color: AP,        page: "admin-hotels"   },
    { icon: <ClipboardList size={24} color="#4cc9f0" />, label: t("adm_dash_total_bookings"), key: "totalBookings", color: "#4cc9f0", page: "admin-bookings" },
    { icon: <Clock size={24} color="#f72585" />,     label: t("adm_dash_pending"),        key: "pendingBookings", color: "#f72585", page: "admin-bookings" },
  ];

  const QUICK = [
    { icon: <Handshake size={22} color="#555" />, label: t("adm_dash_tile_partners"),  desc: t("adm_dash_tile_partners_sub"),  page: "admin-partners" },
    { icon: <Users size={22} color="#555" />,     label: t("adm_dash_tile_users"),     desc: t("adm_dash_tile_users_sub"),     page: "admin-users"    },
    { icon: <Building2 size={22} color="#555" />, label: t("adm_dash_tile_hotels"),    desc: t("adm_dash_tile_hotels_sub"),    page: "admin-hotels"   },
    { icon: <ClipboardList size={22} color="#555" />, label: t("adm_dash_tile_bookings"), desc: t("adm_dash_tile_bookings_sub"), page: "admin-bookings" },
    { icon: <DollarSign size={22} color="#555" />,label: t("adm_dash_tile_refunds"),   desc: t("adm_dash_tile_refunds_sub"),   page: "admin-refunds"  },
    { icon: <Settings size={22} color="#555" />,  label: t("adm_dash_tile_system"),    desc: t("adm_dash_tile_system_sub"),    page: "admin-system"   },
  ];

  return (
    <AdminLayout page="admin-dashboard" navigate={navigate} user={user} onLogout={onLogout}>
      {/* Welcome banner */}
      <div className="admin-dashboard-banner">
        <div className="admin-dashboard-banner-text">
          <div className="admin-dashboard-banner-greeting">
            {t("adm_dash_greeting").replace("{email}", user?.email || "Admin")}
          </div>
          <h1 className="admin-dashboard-banner-title">
            VLU <span style={{ color: AP }}>Hotel Hub</span> — Admin
          </h1>
          <p className="admin-dashboard-banner-sub">
            {t("adm_dash_subtitle")}
          </p>
        </div>
        <div className="admin-dashboard-banner-icon" aria-hidden="true">
          <Building2 size={64} strokeWidth={1} />
        </div>
      </div>

      {/* Stats */}
      <div style={{ marginBottom: 8 }}>
        <h2 className="admin-dashboard-section-title">{t("adm_dash_overview")}</h2>
        {loading ? (
          <div className="admin-dashboard-stats-grid">
            {STATS.map((_, i) => (
              <div key={i} className="admin-dashboard-skeleton-card">
                <Skeleton width="52px" height="52px" borderRadius="14px" />
                <div style={{ flex: 1 }}>
                  <Skeleton width="60%" height="28px" style={{ marginBottom: 8 }} />
                  <Skeleton width="40%" height="12px" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="admin-dashboard-stats-grid">
            {STATS.map(s => (
              <StatCard
                key={s.key}
                icon={s.icon}
                label={s.label}
                value={stats?.[s.key]}
                color={s.color}
                onClick={() => navigate(s.page)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Quick actions + System info */}
      <div className="admin-dashboard-two-col">
        <Card>
          <h3 className="admin-dashboard-section-title">{t("adm_dash_quick")}</h3>
          <div className="admin-dashboard-quick-grid">
            {QUICK.map(q => (
              <QuickBtn key={q.page} icon={q.icon} label={q.label} desc={q.desc} onClick={() => navigate(q.page)} />
            ))}
          </div>
        </Card>

        <Card>
          <h3 className="admin-dashboard-section-title">{t("adm_dash_sysinfo")}</h3>
          {[
            { icon: <Tag size={13} />,      label: t("adm_dash_version"), value: "1.0.0" },
            { icon: <Globe size={13} />,    label: t("adm_dash_env"),     value: "Development" },
            { icon: <Server size={13} />,   label: t("adm_dash_backend"), value: "Spring Boot" },
            { icon: <Database size={13} />, label: t("adm_dash_db"),      value: "PostgreSQL" },
            { icon: <Shield size={13} />,   label: t("adm_dash_jwt"),     value: "24h" },
            { icon: <Calendar size={13} />, label: t("adm_dash_date"),    value: new Date().toLocaleDateString("vi-VN") },
          ].map(({ icon, label, value }) => (
            <div key={label} className="admin-dashboard-sysinfo-row">
              <span className="admin-dashboard-sysinfo-key admin-dashboard-sysinfo-key-icon">
                {icon} {label}
              </span>
              <span className="admin-dashboard-sysinfo-val">{value}</span>
            </div>
          ))}

          <button onClick={() => navigate("home")} className="admin-dashboard-home-btn">
            <Home size={16} />
            {t("adm_dash_home")}
          </button>
        </Card>
      </div>

      {/* Partner feature map */}
      <Card>
        <h3 className="admin-dashboard-section-title" style={{ marginBottom: 6 }}>{t("adm_dash_partner_feat")}</h3>
        <p style={{ fontSize: 12, color: "#aaa", margin: "0 0 18px" }}>{t("adm_dash_partner_feat_sub")}</p>
        <div className="admin-dashboard-feature-grid">
          {[
            {
              Icon: Building2, color: "#4361ee", title: t("adm_dash_feat_hotel"),
              items: [t("adm_dash_feat_hotel_1"), t("adm_dash_feat_hotel_2"), t("adm_dash_feat_hotel_3")],
            },
            {
              Icon: Bed, color: "#7209b7", title: t("adm_dash_feat_rooms"),
              items: [t("adm_dash_feat_rooms_1"), t("adm_dash_feat_rooms_2"), t("adm_dash_feat_rooms_3")],
            },
            {
              Icon: DollarSign, color: "#e65100", title: t("adm_dash_feat_price"),
              items: [t("adm_dash_feat_price_1"), t("adm_dash_feat_price_2"), t("adm_dash_feat_calendar")],
            },
            {
              Icon: Star, color: "#f59e0b", title: t("adm_dash_feat_reviews"),
              items: [t("adm_dash_feat_reviews_1"), t("adm_dash_feat_reviews_2"), t("adm_dash_feat_reviews_3")],
            },
            {
              Icon: BarChart3, color: "#2e7d32", title: t("adm_dash_feat_stats"),
              items: [t("adm_dash_feat_stats_1"), t("adm_dash_feat_stats_2"), t("adm_dash_feat_stats_3")],
            },
            {
              Icon: Bot, color: "#c62828", title: t("adm_dash_feat_ai"),
              items: [t("adm_dash_feat_ai_1"), t("adm_dash_feat_ai_2"), t("adm_dash_feat_ai_3")],
            },
          ].map(f => (
            <div key={f.title}
              className="admin-dashboard-feature-card"
              style={{
                "--bg-base": `${f.color}06`,
                "--border-base": `${f.color}25`,
                "--bg-hover": `${f.color}10`,
                "--border-hover": `${f.color}50`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: `${f.color}18`, display: "flex",
                  alignItems: "center", justifyContent: "center",
                }}>
                  <f.Icon size={20} color={f.color} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#1a1a1a" }}>{f.title}</div>
              </div>
              <ul style={{ margin: 0, padding: "0 0 0 18px", listStyle: "disc" }}>
                {f.items.map(it => (
                  <li key={it} style={{ fontSize: 12, color: "#555", marginBottom: 4, lineHeight: 1.5 }}>{it}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>
    </AdminLayout>
  );
}
