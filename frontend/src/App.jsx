import { createElement } from "react";
import { Routes, Route, Navigate, useParams, useSearchParams, useLocation, useNavigate } from "react-router-dom";

import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ToastProvider } from "./contexts/ToastContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import { useAppNavigate } from "./hooks/useAppNavigate";
import ProtectedRoute from "./routes/ProtectedRoute";

// Layout
import PartnerLayout from "./layouts/PartnerLayout";
import CustomerLayout from "./layouts/CustomerLayout";

// Style dùng chung cho trang xác thực
import { S, Navbar } from "./components/auth/AuthShared";

// Trang xác thực
import Login          from "./pages/Login";
import Register       from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import VerifyEmailPage from "./pages/VerifyEmailPage";

import HomePage        from "./pages/HomePage";
import HotelListPage   from "./pages/HotelListPage";
import HotelDetailPage from "./pages/HotelDetailPage";
import BookingPage     from "./pages/BookingPage";

// Trang khách hàng
import MyBookingsPage    from "./pages/MyBookingsPage";
import BookingDetailPage from "./pages/BookingDetailPage";

// Trang tài khoản khách hàng (có sidebar)
import ProfilePage from "./pages/customer/ProfilePage";
import ReviewsPage from "./pages/customer/ReviewsPage";

// Trang quản trị (mỗi trang tự nhúng AdminLayout)
import PaymentPage    from "./pages/PaymentPage";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers     from "./pages/admin/AdminUsers";
import AdminPartners  from "./pages/admin/AdminPartners";
import AdminHotels    from "./pages/admin/AdminHotels";
import AdminBookings  from "./pages/admin/AdminBookings";
import AdminRefunds   from "./pages/admin/AdminRefunds";
import AdminReviews   from "./pages/admin/AdminReviews";
import AdminSystem    from "./pages/admin/AdminSystem";

// Trang đối tác
import PartnerDashboard from "./pages/partner/PartnerDashboard";
import AddPropertyWizard from "./pages/partner/AddPropertyWizard";
import PartnerHotels    from "./pages/partner/PartnerHotels";
import PartnerRooms     from "./pages/partner/PartnerRooms";
import PartnerRoomUnits from "./pages/partner/PartnerRoomUnits";
import PartnerCalendar  from "./pages/partner/PartnerCalendar";
import PartnerBookings  from "./pages/partner/PartnerBookings";
import PartnerRevenue   from "./pages/partner/PartnerRevenue";
import PartnerForecast  from "./pages/partner/PartnerForecast";
import PartnerReviews   from "./pages/partner/PartnerReviews";
import PartnerBookingDetailPage from "./pages/partner/PartnerBookingDetailPage";
import PartnerServices          from "./pages/partner/PartnerServices";

import PartnerManagePage   from "./pages/PartnerManagePage";
import UnauthorizedPage    from "./pages/UnauthorizedPage";
import ResetPasswordPage   from "./pages/ResetPasswordPage";
import BecomePartnerPage   from "./pages/BecomePartnerPage";
import PaymentResultPage   from "./pages/PaymentResultPage";
import RefundRequestPage   from "./pages/RefundRequestPage";

// ── Auth page wrapper (keeps existing auth UI: two-column layout + Navbar) ──

function AuthWrapper({ active, children }) {
  const navigate = useAppNavigate();
  const { user } = useAuth();
  return (
    <div style={S.page}>
      <Navbar active={active} setPage={navigate} user={user} />
      {children}
    </div>
  );
}

// ── Các route component ───────────────────────────────────────────────────────
// Mỗi route đọc URL/search params rồi truyền đúng props mà page component cần.

function LoginRoute() {
  const navigate    = useAppNavigate();
  const rrNavigate  = useNavigate();
  const { user, login } = useAuth();
  const location    = useLocation();

  if (user) {
    if (user.userType === "ADMIN")   return <Navigate to="/admin"  replace />;
    if (user.userType === "PARTNER") return <Navigate to="/partner" replace />;
    return <Navigate to="/" replace />;
  }

  function handleLoginSuccess(userData, token) {
    login(userData, token);
    if (userData.userType === "ADMIN")   { rrNavigate("/admin",    { replace: true }); return; }
    if (userData.userType === "PARTNER") { rrNavigate("/partner", { replace: true }); return; }
    const from = location.state?.from?.pathname || "/";
    rrNavigate(from === "/login" ? "/" : from, { replace: true });
  }

  return (
    <AuthWrapper active="login">
      <Login setPage={navigate} onSuccess={handleLoginSuccess} />
    </AuthWrapper>
  );
}

function RegisterRoute() {
  const navigate = useAppNavigate();
  const { user } = useAuth();
  if (user) return <Navigate to="/" replace />;
  return (
    <AuthWrapper active="register">
      <Register setPage={navigate} />
    </AuthWrapper>
  );
}

function ForgotRoute() {
  const navigate = useAppNavigate();
  return (
    <AuthWrapper active="forgot">
      <ForgotPassword setPage={navigate} />
    </AuthWrapper>
  );
}

function ResetPasswordRoute() {
  const navigate = useAppNavigate();
  return (
    <AuthWrapper active="">
      <ResetPasswordPage setPage={navigate} />
    </AuthWrapper>
  );
}

function VerifyEmailRoute() {
  const navigate = useAppNavigate();
  return (
    <AuthWrapper active="">
      <VerifyEmailPage setPage={navigate} />
    </AuthWrapper>
  );
}

function BecomePartnerRoute() {
  const navigate         = useAppNavigate();
  const { user, logout } = useAuth();
  return <BecomePartnerPage navigate={navigate} user={user} onLogout={logout} />;
}

function HomeRoute() {
  const navigate         = useAppNavigate();
  const { user, logout } = useAuth();
  if (user?.userType === "PARTNER") return <Navigate to="/partner" replace />;
  return <HomePage navigate={navigate} user={user} onLogout={logout} />;
}

function HotelListRoute() {
  const [sp]           = useSearchParams();
  const navigate       = useAppNavigate();
  const { user, logout } = useAuth();
  const params = {
    province: sp.get("province") || "",
    district: sp.get("district") || "",
    checkIn:  sp.get("checkIn")  || "",
    checkOut: sp.get("checkOut") || "",
    guests:   Number(sp.get("guests"))  || 2,
    rooms:    Number(sp.get("rooms"))   || 1,
    hotelTypes: sp.get("hotelTypes") || "",
    sort: sp.get("sort") || "",
  };
  return <HotelListPage navigate={navigate} user={user} onLogout={logout} params={params} />;
}

function HotelDetailRoute() {
  const { hotelId }    = useParams();
  const [sp]           = useSearchParams();
  const navigate       = useAppNavigate();
  const rrNavigate     = useNavigate();
  const location       = useLocation();
  const { user, logout } = useAuth();

  const params = {
    hotelId,
    checkIn:  sp.get("checkIn")  || "",
    checkOut: sp.get("checkOut") || "",
    guests:   Number(sp.get("guests")) || 2,
    rooms:    Number(sp.get("rooms"))  || 1,
  };

  function requireAuth(pageName, p = {}) {
    if (user) {
      navigate(pageName, p);
    } else {
      rrNavigate("/login", { state: { from: location } });
    }
  }

  return <HotelDetailPage navigate={navigate} user={user} onLogout={logout} params={params} requireAuth={requireAuth} />;
}

function BookingRoute() {
  const location       = useLocation();
  const navigate       = useAppNavigate();
  const { user, logout } = useAuth();
  return <BookingPage navigate={navigate} user={user} onLogout={logout} params={location.state || {}} />;
}

function MyBookingsRoute() {
  const navigate       = useAppNavigate();
  const { user, logout } = useAuth();
  return <MyBookingsPage navigate={navigate} user={user} onLogout={logout} />;
}

function BookingDetailRoute() {
  const { bookingId }  = useParams();
  const location       = useLocation();
  const navigate       = useAppNavigate();
  const { user, logout } = useAuth();
  return <BookingDetailPage navigate={navigate} user={user} onLogout={logout} params={{ ...location.state, bookingId }} />;
}

function PaymentResultRoute({ variant }) {
  const navigate       = useAppNavigate();
  const { user, logout } = useAuth();
  return <PaymentResultPage navigate={navigate} user={user} onLogout={logout} variant={variant} />;
}

function PaymentRoute() {
  const { bookingId }  = useParams();
  const location       = useLocation();
  const navigate       = useAppNavigate();
  const { user, logout } = useAuth();
  return <PaymentPage navigate={navigate} user={user} onLogout={logout} params={{ ...location.state, bookingId }} />;
}

function RefundRequestRoute() {
  const navigate       = useAppNavigate();
  const { user, logout } = useAuth();
  return <RefundRequestPage navigate={navigate} user={user} onLogout={logout} />;
}

function PartnerManageRoute() {
  const navigate         = useAppNavigate();
  const { user, logout } = useAuth();
  return <PartnerManagePage navigate={navigate} user={user} onLogout={logout} />;
}

function ProfileRoute() {
  const navigate         = useAppNavigate();
  const { user, logout } = useAuth();
  return <ProfilePage navigate={navigate} user={user} onLogout={logout} />;
}

// Wrapper cho trang admin — truyền props cần thiết; mỗi trang tự nhúng AdminLayout.
function AdminRoute({ page }) {
  const navigate       = useAppNavigate();
  const { user, logout } = useAuth();
  return createElement(page, { navigate, user, onLogout: logout });
}

// ── Root router ───────────────────────────────────────────────────────────────

function AppRoutes() {
  return (
    <Routes>
      {/* ── Public ────────────────────────────────────────────────── */}
      <Route path="/"                element={<HomeRoute />} />
      <Route path="/hotels"          element={<HotelListRoute />} />
      <Route path="/hotels/:hotelId" element={<HotelDetailRoute />} />
      <Route path="/profile"         element={<ProtectedRoute><ProfileRoute /></ProtectedRoute>} />

      {/* ── Auth ──────────────────────────────────────────────────── */}
      <Route path="/login"           element={<LoginRoute />} />
      <Route path="/register"        element={<RegisterRoute />} />
      <Route path="/forgot-password"  element={<ForgotRoute />} />
      <Route path="/reset-password"   element={<ResetPasswordRoute />} />
      <Route path="/verify-email"     element={<VerifyEmailRoute />} />

      {/* ── Booking (CUSTOMER only) ───────── */}
      <Route path="/book" element={
        <ProtectedRoute role="CUSTOMER"><BookingRoute /></ProtectedRoute>
      } />

      {/* ── Customer auth pages (no sidebar — keep existing layout) ── */}
      <Route path="/customer/bookings" element={
        <ProtectedRoute role="CUSTOMER"><MyBookingsRoute /></ProtectedRoute>
      } />
      <Route path="/customer/bookings/:bookingId" element={
        <ProtectedRoute role="CUSTOMER"><BookingDetailRoute /></ProtectedRoute>
      } />

      {/* ── Customer layout pages (top-navbar, CUSTOMER only) ── */}
      <Route path="/customer" element={
        <ProtectedRoute role="CUSTOMER"><CustomerLayout /></ProtectedRoute>
      }>
        <Route path="reviews" element={<ReviewsPage />} />
        <Route index element={<Navigate to="/customer/bookings" replace />} />
      </Route>

      {/* Profile — standalone (ProfilePage has own navbar+footer, accessible by all roles) */}
      <Route path="/customer/profile" element={<Navigate to="/profile" replace />} />

      {/* ── Partner (PARTNER only, sidebar layout) ────────────────── */}
      <Route path="/partner" element={
        <ProtectedRoute role="PARTNER"><PartnerLayout /></ProtectedRoute>
      }>
        <Route index            element={<PartnerDashboard />} />
        <Route path="hotels"    element={<PartnerHotels />} />
        <Route path="rooms"       element={<PartnerRooms />} />
        <Route path="room-units"  element={<PartnerRoomUnits />} />
        <Route path="calendar"    element={<PartnerCalendar />} />
        <Route path="bookings"  element={<PartnerBookings />} />
        <Route path="bookings/:bookingId" element={<PartnerBookingDetailPage />} />
        <Route path="reviews"   element={<PartnerReviews />} />
        <Route path="revenue"   element={<PartnerRevenue />} />
        <Route path="forecast"  element={<PartnerForecast />} />
        <Route path="services"  element={<PartnerServices />} />
        <Route path="add-property" element={<AddPropertyWizard />} />
      </Route>

      {/* ── Admin (ADMIN only) ────────────────────────────────────── */}
      <Route path="/admin" element={
        <ProtectedRoute role="ADMIN"><AdminRoute page={AdminDashboard} /></ProtectedRoute>
      } />
      <Route path="/admin/users" element={
        <ProtectedRoute role="ADMIN"><AdminRoute page={AdminUsers} /></ProtectedRoute>
      } />
      <Route path="/admin/partners" element={
        <ProtectedRoute role="ADMIN"><AdminRoute page={AdminPartners} /></ProtectedRoute>
      } />
      <Route path="/admin/hotels" element={
        <ProtectedRoute role="ADMIN"><AdminRoute page={AdminHotels} /></ProtectedRoute>
      } />
      <Route path="/admin/bookings" element={
        <ProtectedRoute role="ADMIN"><AdminRoute page={AdminBookings} /></ProtectedRoute>
      } />
      <Route path="/admin/refunds" element={
        <ProtectedRoute role="ADMIN"><AdminRoute page={AdminRefunds} /></ProtectedRoute>
      } />
      <Route path="/admin/reviews" element={
        <ProtectedRoute role="ADMIN"><AdminRoute page={AdminReviews} /></ProtectedRoute>
      } />
      <Route path="/admin/system" element={
        <ProtectedRoute role="ADMIN"><AdminRoute page={AdminSystem} /></ProtectedRoute>
      } />

      {/* ── Partner Manage (PARTNER only, standalone page) ──────────── */}
      <Route path="/partner-manage" element={
        <ProtectedRoute role="PARTNER">
          <PartnerManageRoute />
        </ProtectedRoute>
      } />

      {/* ── Become Partner (auth required, CUSTOMER only) ─────────── */}
      <Route path="/become-partner" element={<ProtectedRoute role="CUSTOMER"><BecomePartnerRoute /></ProtectedRoute>} />

      {/* ── Payment page ──────────────────────────────────────────── */}
      <Route path="/payment/:bookingId" element={
        <ProtectedRoute role="CUSTOMER"><PaymentRoute /></ProtectedRoute>
      } />

      {/* ── Payment result pages ───────────────────────────────────── */}
      <Route path="/payment/success" element={<PaymentResultRoute variant="success" />} />
      <Route path="/payment/failed"  element={<PaymentResultRoute variant="failed" />} />

      {/* ── Refund request (customer auth required) ───────────────── */}
      <Route path="/customer/refund-request/:bookingId" element={
        <ProtectedRoute role="CUSTOMER"><RefundRequestRoute /></ProtectedRoute>
      } />

      {/* ── Fallbacks ─────────────────────────────────────────────── */}
      <Route path="/unauthorized" element={<UnauthorizedPage />} />
      <Route path="*"             element={<Navigate to="/" replace />} />
    </Routes>
  );
}

import ScrollToTop from "./components/ScrollToTop";

export default function App() {
  return (
    <LanguageProvider>
      <ToastProvider>
        <AuthProvider>
          <AppRoutes />
          <ScrollToTop />
        </AuthProvider>
      </ToastProvider>
    </LanguageProvider>
  );
}
