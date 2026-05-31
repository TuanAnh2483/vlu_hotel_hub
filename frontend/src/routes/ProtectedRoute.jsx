import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

// role — tùy chọn; nếu có, userType phải khớp chính xác.
// Người dùng chưa đăng nhập được chuyển tới /login, lưu lại URL hiện tại để redirect sau khi đăng nhập.
export default function ProtectedRoute({ children, role }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return null;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (role && user.userType !== role) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}
