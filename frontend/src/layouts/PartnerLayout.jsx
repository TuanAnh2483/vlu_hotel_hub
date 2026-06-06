import { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import PartnerSidebar from "../components/partner/PartnerSidebar";
import "./partner/PartnerLayout.css";

const SELECTED_HOTEL_KEY  = "partner_selected_hotel_id";
const COLLAPSED_SIDEBAR_KEY = "partner_sidebar_collapsed";

const BREADCRUMB_MAP = {
  "/partner":                "Tổng quan",
  "/partner/hotels":         "Cơ sở của tôi",
  "/partner/rooms":          "Loại phòng",
  "/partner/room-units":     "Phòng",
  "/partner/calendar":       "Lịch & Vận hành",
  "/partner/bookings":       "Booking",
  "/partner/reviews":        "Đánh giá",
  "/partner/revenue":        "Doanh thu",
  "/partner/forecast":       "AI Dự báo",
  "/partner/add-property":   "Thêm cơ sở",
  "/partner/services":       "Dịch vụ & tiện ích",
};

function getPageTitle(pathname) {
  const exact = BREADCRUMB_MAP[pathname];
  if (exact) return exact;
  const match = Object.keys(BREADCRUMB_MAP)
    .filter(k => k !== "/partner" && pathname.startsWith(k))
    .sort((a, b) => b.length - a.length)[0];
  return match ? BREADCRUMB_MAP[match] : "Partner";
}

export default function PartnerLayout() {
  const { pathname } = useLocation();
  const [sidebarOpen,  setSidebarOpen]  = useState(false);
  const [collapsed,    setCollapsed]    = useState(
    () => localStorage.getItem(COLLAPSED_SIDEBAR_KEY) === "true"
  );

  const [selectedHotelId, setSelectedHotelId] = useState(() => {
    const saved = localStorage.getItem(SELECTED_HOTEL_KEY);
    return saved ? Number(saved) : null;
  });

  useEffect(() => {
    if (selectedHotelId != null) {
      localStorage.setItem(SELECTED_HOTEL_KEY, selectedHotelId);
    }
  }, [selectedHotelId]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  function toggleCollapsed() {
    setCollapsed(c => {
      const next = !c;
      localStorage.setItem(COLLAPSED_SIDEBAR_KEY, next);
      return next;
    });
  }

  const pageTitle = getPageTitle(pathname);

  return (
    <div className="partner-root">
      {sidebarOpen && (
        <div className="partner-sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      <PartnerSidebar
        selectedHotelId={selectedHotelId}
        onSelectHotel={setSelectedHotelId}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={collapsed}
      />

      <div className="partner-main">
        {/* Topbar */}
        <div className="partner-topbar">
          {/* Mobile: open drawer */}
          <button
            className="partner-topbar-hamburger"
            onClick={() => setSidebarOpen(true)}
            aria-label="Mở menu"
          >
            <Menu size={20} />
          </button>

          {/* Desktop: collapse / expand sidebar */}
          <button
            className="partner-topbar-collapse"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Mở rộng menu" : "Thu gọn menu"}
            title={collapsed ? "Mở rộng menu" : "Thu gọn menu"}
          >
            {collapsed
              ? <PanelLeftOpen  size={18} />
              : <PanelLeftClose size={18} />}
          </button>

          <div className="partner-topbar-breadcrumb">
            <span className="partner-topbar-title">{pageTitle}</span>
          </div>
        </div>

        <div className="partner-content">
          <Outlet context={{ selectedHotelId, setSelectedHotelId }} />
        </div>
      </div>
    </div>
  );
}
