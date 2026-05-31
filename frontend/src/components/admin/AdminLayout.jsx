import { useState } from "react";
import {
  LayoutDashboard, Users, Handshake, Building2,
  ClipboardList, CircleDollarSign, Settings, Home, LogOut,
  Menu, Search, Star, ChevronDown, UserPlus
} from "lucide-react";
import { LOGO_IMG } from "../auth/AuthShared";
import { useLang } from "../../contexts/LanguageContext";
import "../../layouts/admin/AdminLayout.css";

// ── Brand colours ────────────────────────────────────────────────────
export const AP = "#BE1E2E";
const SIDEBAR_BG   = "#EFD6D6";
const SIDEBAR_HVR  = "rgba(190,30,46,0.09)";
const SIDEBAR_ACT  = AP;
const SIDEBAR_TEXT = "#5a1a22";
const SIDEBAR_DIV  = "rgba(190,30,46,0.14)";

// ── Icon sizes ────────────────────────────────────────────────────────
const NAV_ICON      = 18;
const NAV_CHILD_ICON = 15;
const TOPBAR_ICON   = 18;
const ACTION_ICON   = 16;

// ── Sidebar ───────────────────────────────────────────────────────────
function Sidebar({ page, navigate, user, onLogout, open, onClose }) {
  const { t } = useLang();
  const NAV = [
    { key: "admin-dashboard", icon: <LayoutDashboard size={NAV_ICON} />, label: t("adm_nav_dashboard") },
    {
      key: "admin-users-group",
      icon: <Users size={NAV_ICON} />,
      label: t("adm_users_title"),
      children: [
        { key: "admin-users",    icon: <UserPlus size={NAV_CHILD_ICON} />,   label: t("adm_users_add_btn").replace("+ ", "") },
        { key: "admin-partners", icon: <Handshake size={NAV_CHILD_ICON} />,  label: t("adm_dash_tile_partners") },
      ],
    },
    { key: "admin-hotels",   icon: <Building2 size={NAV_ICON} />,        label: t("adm_hotels_title") },
    { key: "admin-bookings", icon: <ClipboardList size={NAV_ICON} />,    label: t("adm_nav_bookings") },
    { key: "admin-refunds",  icon: <CircleDollarSign size={NAV_ICON} />, label: t("adm_dash_tile_refunds") },
    { key: "admin-reviews",  icon: <Star size={NAV_ICON} />,             label: t("adm_rv_title") },
    { key: "admin-system",   icon: <Settings size={NAV_ICON} />,         label: t("adm_sys_title") },
  ];
  const initialOpen = NAV
    .filter(item => item.children?.some(c => c.key === page))
    .map(item => item.key);
  const [expanded, setExpanded] = useState(initialOpen);

  const toggleGroup = key =>
    setExpanded(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);

  return (
    <>
      {open && <div className="admin-sidebar-overlay" onClick={onClose} />}

      <aside className={`admin-sidebar${open ? " open" : ""}`}>
        {/* Logo */}
        <div className="admin-sidebar-logo">
          <div className="admin-sidebar-logo-box">
            <img src={LOGO_IMG} alt="VLU Hotel Hub" />
          </div>
          <div className="admin-sidebar-logo-tag">{t("adm_sidebar_tag")}</div>
        </div>

        {/* Nav */}
        <nav className="admin-sidebar-nav">
          <div className="admin-nav-section-label">{t("adm_sidebar_cat")}</div>
          {NAV.map(item => {
            if (item.children) {
              const isOpen    = expanded.includes(item.key);
              const hasActive = item.children.some(c => c.key === page);
              return (
                <div key={item.key} style={{ marginBottom: 2 }}>
                  <button
                    onClick={() => toggleGroup(item.key)}
                    className={`admin-nav-btn${hasActive ? " active" : ""}`}
                  >
                    <span className="admin-nav-icon">{item.icon}</span>
                    <span style={{ flex: 1 }}>{item.label}</span>
                    <span className={`admin-nav-chevron ${isOpen ? "open" : "closed"}`}>
                      <ChevronDown size={NAV_CHILD_ICON} />
                    </span>
                  </button>
                  {isOpen && (
                    <div className="admin-nav-children">
                      {item.children.map(child => {
                        const childActive = page === child.key;
                        return (
                          <button
                            key={child.key}
                            onClick={() => { navigate(child.key); onClose?.(); }}
                            className={`admin-nav-btn-child${childActive ? " active" : ""}`}
                          >
                            <span className="admin-nav-icon-sm">{child.icon}</span>
                            {child.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            const isActive = page === item.key;
            return (
              <button
                key={item.key}
                onClick={() => { navigate(item.key); onClose?.(); }}
                className={`admin-nav-btn${isActive ? " active" : ""}`}
              >
                <span className="admin-nav-icon">{item.icon}</span>
                {item.label}
              </button>
            );
          })}

          {/* Back to home */}
          <div className="admin-nav-divider">
            <button onClick={() => navigate("home")} className="admin-nav-home-btn">
              <span className="admin-nav-icon"><Home size={NAV_ICON} /></span>
              {t("adm_dash_home")}
            </button>
          </div>
        </nav>

        {/* User info */}
        <div className="admin-sidebar-user">
          <div className="admin-sidebar-user-row">
            <div className="admin-sidebar-avatar">
              {user?.email?.[0]?.toUpperCase() || "A"}
            </div>
            <div className="admin-sidebar-user-info">
              <div className="admin-sidebar-user-email">{user?.email || "admin"}</div>
              <div className="admin-sidebar-user-role">{t("adm_sidebar_role")}</div>
            </div>
          </div>
          <button onClick={onLogout} className="admin-sidebar-logout-btn">
            <LogOut size={ACTION_ICON} /> {t("nav_logout")}
          </button>
        </div>
      </aside>
    </>
  );
}

// ── Main layout ───────────────────────────────────────────────────────
export default function AdminLayout({ page, navigate, user, onLogout, children }) {
  const { t } = useLang();
  const [mobileOpen, setMobileOpen] = useState(false);
  const PAGE_TITLES = {
    "admin-dashboard": t("adm_nav_dashboard"),
    "admin-users":     t("adm_users_title"),
    "admin-partners":  t("adm_partners_title"),
    "admin-hotels":    t("adm_hotels_title"),
    "admin-bookings":  t("adm_bk_title"),
    "admin-refunds":   t("adm_rf_title"),
    "admin-reviews":   t("adm_rv_title"),
    "admin-system":    t("adm_sys_title"),
  };

  return (
    <div className="admin-root">
      <Sidebar
        page={page} navigate={navigate} user={user} onLogout={onLogout}
        open={mobileOpen} onClose={() => setMobileOpen(false)}
      />

      <div className="admin-content-area">
        {/* Top bar */}
        <div className="admin-topbar">
          <button
            onClick={() => setMobileOpen(true)}
            className="admin-menu-btn"
            aria-label="Mở menu"
          >
            <Menu size={20} color={AP} />
          </button>
          <div className="admin-topbar-breadcrumb">
            <span className="admin-topbar-parent">{t("adm_sidebar_role")}</span>
            <span className="admin-topbar-sep">/</span>
            <span className="admin-topbar-title">{PAGE_TITLES[page] || page}</span>
          </div>
        </div>

        {/* Page content */}
        <main className="admin-main">
          {children}
        </main>
      </div>
    </div>
  );
}

// ── Shared UI primitives ──────────────────────────────────────────────

export function PageHeader({ title, subtitle, action }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28, gap: 16 }}>
      <div style={{ minWidth: 0 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1e293b", margin: 0, userSelect: "none", cursor: "default" }}>{title}</h1>
        {subtitle && <p style={{ color: "#64748b", fontSize: 13, marginTop: 4, marginBottom: 0 }}>{subtitle}</p>}
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  );
}

export function Card({ children, style = {} }) {
  return (
    <div style={{
      background: "rgba(255, 255, 255, 0.9)", borderRadius: 14, padding: "22px 26px",
      boxShadow: "0 4px 20px rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.03)",
      backdropFilter: "blur(10px)",
      ...style,
    }}>
      {children}
    </div>
  );
}

export { default as Badge } from "../ui/Badge";
export { default as Modal } from "../ui/Modal";

export function Btn({ children, onClick, variant = "primary", disabled = false, small = false, loading = false, style: extraStyle = {} }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      data-variant={variant}
      data-small={small || undefined}
      className="admin-btn"
      style={extraStyle}
    >
      {loading && (
        <svg className="admin-btn-spinner" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      )}
      {children}
    </button>
  );
}

export function SearchInput({ value, onChange, placeholder = "Tìm kiếm..." }) {
  return (
    <div className="ui-search-wrap">
      <span className="ui-search-icon"><Search size={ACTION_ICON} /></span>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="ui-search-input"
      />
    </div>
  );
}

export function Table({ headers, rows, empty = "Không có dữ liệu" }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: "#f8f9fa", borderBottom: "2px solid #f0f0f0" }}>
            {headers.map((h, i) => (
              <th key={i} style={{
                padding: "11px 14px", textAlign: "left", fontWeight: 700,
                color: "#555", whiteSpace: "nowrap", fontSize: 12, letterSpacing: 0.3,
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0
            ? (
              <tr>
                <td colSpan={headers.length} style={{ textAlign: "center", padding: "48px 0", color: "#bbb" }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
                  <div style={{ fontSize: 13 }}>{empty}</div>
                </td>
              </tr>
            )
            : rows.map((row, i) => (
              <tr
                key={i}
                className="admin-table-row"
              >
                {row.map((cell, j) => (
                  <td key={j} style={{ padding: "12px 14px", color: "#333", verticalAlign: "middle" }}>{cell}</td>
                ))}
              </tr>
            ))
          }
        </tbody>
      </table>
    </div>
  );
}


export function FormField({ label, children, required }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#555", marginBottom: 5, letterSpacing: 0.2 }}>
        {label}{required && <span style={{ color: AP, marginLeft: 3 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

export function Input({ value, onChange, type = "text", placeholder, disabled }) {
  return (
    <input
      value={value}
      onChange={onChange}
      type={type}
      placeholder={placeholder}
      disabled={disabled}
      className="ui-input"
    />
  );
}

export function Select({ value, onChange, children }) {
  return (
    <select
      value={value}
      onChange={onChange}
      style={{
        width: "100%", padding: "9px 12px", borderRadius: 8,
        border: "1px solid #e0e0e0", fontSize: 13, background: "#fff", outline: "none",
        cursor: "pointer",
      }}
    >
      {children}
    </select>
  );
}
