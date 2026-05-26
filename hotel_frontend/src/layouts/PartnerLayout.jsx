import { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Menu, Bell } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useAppNavigate } from "../hooks/useAppNavigate";
import PartnerSidebar from "../components/partner/PartnerSidebar";
import "./partner/PartnerLayout.css";

const SELECTED_HOTEL_KEY = "partner_selected_hotel_id";

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
  const { user } = useAuth();
  const navigate = useAppNavigate();
  const { pathname } = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
      />

      <div className="partner-main">
        {/* Topbar */}
        <div className="partner-topbar">
          <button
            className="partner-topbar-hamburger"
            onClick={() => setSidebarOpen(true)}
            aria-label="Mở menu"
          >
            <Menu size={20} />
          </button>
          <div className="partner-topbar-breadcrumb">
            <span className="partner-topbar-parent">Partner</span>
            <span className="partner-topbar-sep">/</span>
            <span className="partner-topbar-title">{pageTitle}</span>
          </div>
          <div className="partner-topbar-bell-wrap">
            <button className="partner-topbar-bell" aria-label="Thông báo">
              <Bell size={18} />
            </button>
            <span className="partner-topbar-bell-tip">Tính năng thông báo đang phát triển</span>
          </div>
        </div>

        <div className="partner-content">
          <Outlet context={{ selectedHotelId, setSelectedHotelId }} />
        </div>
      </div>
    </div>
  );
}
