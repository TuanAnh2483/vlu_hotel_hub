import { Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useAppNavigate } from "../hooks/useAppNavigate";
import MainNavbar from "../components/MainNavbar";
import Footer from "../components/Footer";
import "./customer/CustomerLayout.css";

const PATH_TO_PAGE = {
  "/customer/reviews":  "customer-reviews",
  "/customer/bookings": "my-bookings",
};

export default function CustomerLayout() {
  const { user, logout } = useAuth();
  const navigate = useAppNavigate();
  const { pathname } = useLocation();
  const active = PATH_TO_PAGE[pathname] || "home";

  return (
    <div className="customer-root">
      <MainNavbar active={active} navigate={navigate} user={user} onLogout={logout} />
      <div className="customer-content">
        <Outlet />
      </div>
      <Footer />
    </div>
  );
}
