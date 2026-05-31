import { useState, useEffect, useRef } from "react";
import { C } from "../lib/constants";
import { LOGO_IMG } from "./auth/AuthShared";
import {
  User,
  LogOut,
  LayoutDashboard,
  Moon,
  Sun,
  Globe,
  ChevronDown,
  ClipboardList,
  Menu,
  X,
} from "lucide-react";
import { useLang } from "../contexts/LanguageContext";
import "./MainNavbar.css";

const BASE_LINK_PAGES = [
  { key: "nav_home",           page: "home"                                       },
  { key: "nav_hotels",         page: "hotels"                                     },
  { key: "nav_mybookings",     page: "my-bookings",      role: "CUSTOMER"         },
  { key: "nav_reviews",        page: "customer-reviews", role: "CUSTOMER", authOnly: true },
];

const PARTNER_LINK_PAGES = [
  { vi: "Trang chủ",        en: "Dashboard",      page: "partner-dashboard" },
  { vi: "Khách sạn của tôi", en: "My Hotels",      page: "partner-hotels"    },
  { vi: "Loại phòng",       en: "Room Types",     page: "partner-rooms"     },
  { vi: "Lịch & Vận hành",  en: "Calendar",       page: "partner-calendar"  },
  { vi: "Booking",           en: "Bookings",       page: "partner-bookings"  },
  { vi: "Đánh giá",         en: "Reviews",        page: "partner-reviews"   },
  { vi: "Doanh thu",         en: "Revenue",        page: "partner-revenue"   },
  { vi: "AI Dự báo",        en: "AI Forecast",    page: "partner-forecast"  },
];

const ROLE_LABEL = {
  CUSTOMER: "Khách hàng",
  PARTNER:  "Đối tác",
  ADMIN:    "Quản trị viên",
};

const ROLE_STYLE = {
  CUSTOMER: { background: "#e8f4ff", color: "#1565c0" },
  PARTNER:  { background: "#FFF1F2", color: "#BE1E2E" },
  ADMIN:    { background: "#fce4ec", color: "#BE1E2E" },
};

export default function MainNavbar({ active, navigate, user, onLogout }) {
  const [showMenu, setShowMenu]           = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isDark, setIsDark]               = useState(() => localStorage.getItem("theme") === "dark");
  const menuRef                           = useRef(null);
  const { lang, toggleLang, t }           = useLang();

  const isPartner      = user?.userType === "PARTNER";
  const canApplyPartner = !isPartner && user?.userType !== "ADMIN";

  const baseLinks    = BASE_LINK_PAGES.map(l => ({ ...l, label: t(l.key) }));
  const partnerLinks = PARTNER_LINK_PAGES.map(l => ({ ...l, label: lang === "en" ? l.en : l.vi }));

  const navLinks = isPartner
    ? partnerLinks
    : [
        ...baseLinks.filter(l => (!l.authOnly || user) && (!l.role || !user || user.userType === l.role)),
        ...(canApplyPartner ? [{ label: t("nav_become_partner"), page: "become-partner" }] : []),
        ...(user?.userType === "ADMIN" ? [{ label: t("nav_admin"), page: "admin-dashboard" }] : []),
      ];

  useEffect(() => {
    if (!showMenu) return;
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showMenu]);

  useEffect(() => {
    if (isDark) {
      // invert(0.92) đổi #ffffff thành ~#141414 (xám tối nhẹ)
      // contrast(0.9) làm mềm chữ tránh quá tương phản
      document.documentElement.style.filter = "invert(0.92) hue-rotate(180deg) contrast(0.9)";
      document.documentElement.style.background = "#fff";

      let style = document.getElementById("dark-mode-fixes");
      if (!style) {
        style = document.createElement("style");
        style.id = "dark-mode-fixes";
        style.innerHTML = `
          img, video, iframe {
            /* Đảo ngược invert của thẻ cha để giữ màu thật của ảnh/video */
            filter: contrast(1.11) hue-rotate(180deg) invert(1) !important;
          }
          input { background-color: transparent !important; }
        `;
        document.head.appendChild(style);
      }
    } else {
      document.documentElement.style.filter = "";
      document.documentElement.style.background = "";
      const style = document.getElementById("dark-mode-fixes");
      if (style) style.remove();
    }
  }, [isDark]);

  const toggleDark = () => {
    setIsDark(p => {
      const next = !p;
      localStorage.setItem("theme", next ? "dark" : "light");
      return next;
    });
  };

  return (
    <nav className="main-navbar-nav" aria-label="Điều hướng chính">
      <button className="navbar-logo-wrap" onClick={() => navigate("home")} aria-label={t("nav_home")}>
        <img src={LOGO_IMG} alt="VLU Hotel Hub" className="navbar-logo" />
      </button>

      <ul className={`main-navbar-links${isPartner ? " partner" : ""}`}>
        {navLinks.map(({ label, page }) => (
          <li key={page}>
            <a
              className={`navbar-nav-link${active === page ? " active" : ""}`}
              aria-current={active === page ? "page" : undefined}
              onClick={() => navigate(page)}
            >{label}</a>
          </li>
        ))}
      </ul>

      <div className="main-navbar-actions">
        <button
          className="navbar-icon-btn"
          onClick={toggleDark}
          title={isDark ? "Chế độ sáng" : "Chế độ tối"}
          aria-label={isDark ? "Chế độ sáng" : "Chế độ tối"}
        >
          {isDark ? <Sun size={20} color="#1a1a1a" /> : <Moon size={20} color="#1a1a1a" />}
        </button>

        <button
          className="navbar-lang-btn"
          onClick={toggleLang}
          title={lang === "vi" ? "Switch to English" : "Chuyển sang tiếng Việt"}
          aria-label={lang === "vi" ? "Switch to English" : "Chuyển sang tiếng Việt"}
        >
          <Globe size={16} color="#1a1a1a" />
          <span className="navbar-lang-label">{lang === "vi" ? "VI" : "EN"}</span>
        </button>

        {user ? (
          <div ref={menuRef} style={{ position: "relative" }}>
            <button
              type="button"
              aria-label={`Tài khoản: ${user.email}`}
              aria-expanded={showMenu}
              aria-haspopup="menu"
              className="navbar-avatar-btn"
              onClick={() => setShowMenu(p => !p)}
            >
              <div
                style={{
                  width: 32, height: 32, borderRadius: "50%", background: C.primary,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontWeight: 700, fontSize: 13,
                  boxShadow: "0 2px 8px rgba(190,30,46,0.2)"
                }}
              >
                {user.email?.[0]?.toUpperCase() ?? "U"}
              </div>
              <ChevronDown size={14} color="#666" style={{ transform: showMenu ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
            </button>
            {showMenu && (
              <div role="menu" aria-label="Menu tài khoản" className="navbar-dropdown" style={{ position: "absolute", right: 0, top: 46, background: "#fff", borderRadius: 14, boxShadow: "0 10px 40px rgba(0,0,0,0.12)", border: "1px solid rgba(0,0,0,0.06)", minWidth: 220, zIndex: 200, overflow: "hidden" }}>

                <div style={{ padding: "16px 20px", borderBottom: "1px solid #f0f0f0", background: "linear-gradient(to bottom, #fff, #fdfdfd)" }}>
                  <p style={{ fontSize: 10, color: "#aaa", margin: 0, textTransform: "uppercase", letterSpacing: 1.2, fontWeight: 700 }}>{t("nav_account")}</p>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a", margin: "4px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</p>
                  {user.userType && (
                    <span style={{ fontSize: 10, borderRadius: 6, padding: "2px 10px", fontWeight: 800, display: "inline-block", marginTop: 6, textTransform: "uppercase", ...(ROLE_STYLE[user.userType] || { background: "#f0f0f0", color: "#555" }) }}>
                      {ROLE_LABEL[user.userType] || user.userType}
                    </span>
                  )}
                </div>

                <div style={{ padding: "6px 0" }}>
                  {user?.userType === "PARTNER" && (
                    <button
                      role="menuitem"
                      className="navbar-menu-item"
                      style={{ width: "100%", padding: "12px 20px", background: "none", border: "none", textAlign: "left", fontSize: 13, cursor: "pointer", color: "#333", display: "flex", alignItems: "center", gap: 12, transition: "background 0.2s" }}
                      onClick={() => { navigate("partner-dashboard"); setShowMenu(false); }}
                    >
                      <LayoutDashboard size={16} color="#555" />
                      <span style={{ fontWeight: 500 }}>{t("nav_dashboard")}</span>
                    </button>
                  )}

                  {user?.userType === "ADMIN" && (
                    <button
                      role="menuitem"
                      className="navbar-menu-item"
                      style={{ width: "100%", padding: "12px 20px", background: "none", border: "none", textAlign: "left", fontSize: 13, cursor: "pointer", color: "#333", display: "flex", alignItems: "center", gap: 12, transition: "background 0.2s" }}
                      onClick={() => { navigate("admin-dashboard"); setShowMenu(false); }}
                    >
                      <LayoutDashboard size={16} color="#555" />
                      <span style={{ fontWeight: 500 }}>{t("nav_admin_sys")}</span>
                    </button>
                  )}

                  {user?.userType === "CUSTOMER" && (
                    <button
                      role="menuitem"
                      className="navbar-menu-item"
                      style={{ width: "100%", padding: "12px 20px", background: "none", border: "none", textAlign: "left", fontSize: 13, cursor: "pointer", color: "#333", display: "flex", alignItems: "center", gap: 12, transition: "background 0.2s" }}
                      onClick={() => { navigate("become-partner"); setShowMenu(false); }}
                    >
                      <ClipboardList size={16} color="#555" />
                      <span style={{ fontWeight: 500 }}>{t("nav_become_partner")}</span>
                    </button>
                  )}

                  <button
                    className="navbar-menu-item"
                    style={{ width: "100%", padding: "12px 20px", background: "none", border: "none", textAlign: "left", fontSize: 13, cursor: "pointer", color: "#333", display: "flex", alignItems: "center", gap: 12, transition: "background 0.2s" }}
                    onClick={() => { navigate("profile"); setShowMenu(false); }}
                  >
                    <User size={16} color="#555" />
                    <span style={{ fontWeight: 500 }}>{t("nav_profile")}</span>
                  </button>
                </div>

                <button
                  role="menuitem"
                  className="navbar-menu-item"
                  style={{ width: "100%", padding: "14px 20px", background: "none", border: "none", textAlign: "left", fontSize: 13, cursor: "pointer", color: C.primary, fontWeight: 700, borderTop: "1px solid #f0f0f0", display: "flex", alignItems: "center", gap: 12, transition: "background 0.2s" }}
                  onClick={() => { if (onLogout) onLogout(); setShowMenu(false); }}
                >
                  <LogOut size={16} />
                  {t("nav_logout")}
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <button
              className="navbar-auth-btn"
              onClick={() => navigate("login")}
            >{t("nav_login")}</button>
            <button
              className="navbar-auth-btn"
              onClick={() => navigate("register")}
            >{t("nav_register")}</button>
          </>
        )}
      </div>

      {/* ── Mobile hamburger ─────────────────────────────────────── */}
      <button
        className="main-navbar-hamburger"
        onClick={() => setMobileNavOpen(p => !p)}
        aria-label={mobileNavOpen ? "Đóng menu" : "Mở menu"}
      >
        {mobileNavOpen ? <X size={22} /> : <Menu size={22} />}
      </button>

      {/* Mobile backdrop */}
      {mobileNavOpen && (
        <div className="main-navbar-overlay visible" onClick={() => setMobileNavOpen(false)} />
      )}

      {/* Mobile side drawer */}
      <div className={`main-navbar-drawer${mobileNavOpen ? " open" : ""}`}>

        {/* Nav links */}
        <div className="main-navbar-drawer-nav">
          {navLinks.map(({ label, page: p }) => (
            <button
              key={p}
              className={`main-navbar-drawer-item${active === p ? " active" : ""}`}
              onClick={() => { navigate(p); setMobileNavOpen(false); }}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="main-navbar-drawer-divider" />

        {/* Dark mode + language */}
        <div className="main-navbar-drawer-tools">
          <button
            className="navbar-icon-btn"
            onClick={toggleDark}
            title={isDark ? "Chế độ sáng" : "Chế độ tối"}
            aria-label={isDark ? "Chế độ sáng" : "Chế độ tối"}
          >
            {isDark ? <Sun size={20} color="#1a1a1a" /> : <Moon size={20} color="#1a1a1a" />}
          </button>
          <button
            className="navbar-lang-btn"
            onClick={toggleLang}
            title={lang === "vi" ? "Switch to English" : "Chuyển sang tiếng Việt"}
            aria-label={lang === "vi" ? "Switch to English" : "Chuyển sang tiếng Việt"}
          >
            <Globe size={16} color="#1a1a1a" />
            <span className="navbar-lang-label">{lang === "vi" ? "VI" : "EN"}</span>
          </button>
        </div>

        <div className="main-navbar-drawer-divider" />

        {/* User section */}
        {user ? (
          <>
            <div className="main-navbar-drawer-user-info">
              <div className="main-navbar-drawer-user-email">{user.email}</div>
              {user.userType && (
                <span style={{ fontSize: 10, borderRadius: 6, padding: "2px 10px", fontWeight: 800, display: "inline-block", textTransform: "uppercase", ...(ROLE_STYLE[user.userType] || { background: "#f0f0f0", color: "#555" }) }}>
                  {ROLE_LABEL[user.userType] || user.userType}
                </span>
              )}
            </div>
            <button
              className="main-navbar-drawer-item"
              onClick={() => { navigate("profile"); setMobileNavOpen(false); }}
            >
              <User size={16} color="#555" style={{ marginRight: 10, flexShrink: 0 }} />
              {t("nav_profile")}
            </button>
            {user.userType === "PARTNER" && (
              <button
                className="main-navbar-drawer-item"
                onClick={() => { navigate("partner-dashboard"); setMobileNavOpen(false); }}
              >
                <LayoutDashboard size={16} color="#555" style={{ marginRight: 10, flexShrink: 0 }} />
                {t("nav_dashboard")}
              </button>
            )}
            {user.userType === "ADMIN" && (
              <button
                className="main-navbar-drawer-item"
                onClick={() => { navigate("admin-dashboard"); setMobileNavOpen(false); }}
              >
                <LayoutDashboard size={16} color="#555" style={{ marginRight: 10, flexShrink: 0 }} />
                {t("nav_admin_sys")}
              </button>
            )}
            <button
              className="main-navbar-drawer-logout"
              onClick={() => { if (onLogout) onLogout(); setMobileNavOpen(false); }}
            >
              <LogOut size={16} />
              {t("nav_logout")}
            </button>
          </>
        ) : (
          <div className="main-navbar-drawer-auth">
            <button
              className="main-navbar-drawer-auth-btn primary"
              onClick={() => { navigate("login"); setMobileNavOpen(false); }}
            >
              {t("nav_login")}
            </button>
            <button
              className="main-navbar-drawer-auth-btn secondary"
              onClick={() => { navigate("register"); setMobileNavOpen(false); }}
            >
              {t("nav_register")}
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
