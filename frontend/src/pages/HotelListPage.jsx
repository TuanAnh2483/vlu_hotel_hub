import MainNavbar from "../components/MainNavbar";
import Footer from "../components/Footer";
import HotelSearchResults from "../components/hotel/HotelSearchResults";

export default function HotelListPage({ navigate, params = {}, user, onLogout }) {
  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #ffffff 0%, #fdf4f5 45%, #f7ebeb 100%)", fontFamily: "'Segoe UI','Be Vietnam Pro',sans-serif", display: "flex", flexDirection: "column" }}>
      <MainNavbar active="hotels" navigate={navigate} user={user} onLogout={onLogout} />

      <HotelSearchResults navigate={navigate} params={params} />

      <Footer />
    </div>
  );
}
