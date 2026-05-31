import { useState, useEffect } from "react";
import { C } from "../lib/constants";
import { ShieldCheck, Clock, ShieldOff } from "lucide-react";
import MainNavbar from "../components/MainNavbar";
import Footer from "../components/Footer";
import { useHotelDetail, useAvailableRooms } from "../hooks/useHotelQueries";
import { useHotelReviews } from "../hooks/useReviewQueries";
import { useLang } from "../contexts/LanguageContext";
import { ROOM_AMENITIES_FLAT } from "../utils/amenityConfig";

const PLACEHOLDER = "repeating-conic-gradient(#ccc 0% 25%,#e8e8e8 0% 50%) 0 0/20px 20px";

const ROOM_CATEGORY_LABEL = { STANDARD: "Phòng tiêu chuẩn", DELUXE: "Phòng Deluxe", SUITE: "Suite", FAMILY: "Phòng gia đình" };
const BED_TYPE_LABEL       = { SINGLE: "1 giường đơn", DOUBLE: "1 giường đôi", TWIN: "2 giường đơn" };
const AMENITY_LABEL = Object.fromEntries(ROOM_AMENITIES_FLAT.map(a => [a.key, a.label]));

function RoomDetailModal({ room, nights, onClose, onAdd, onRemove, cartQty }) {
  const [imgIdx, setImgIdx] = useState(0);
  const images = room.imageUrls?.length ? room.imageUrls : (room.imageUrl ? [room.imageUrl] : []);
  const fmt = n => (n || 0).toLocaleString("vi-VN") + "₫";

  useEffect(() => {
    const onKey = e => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 680, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 8px 40px rgba(0,0,0,0.2)" }}
      >
        {/* Image gallery */}
        <div style={{ position: "relative", borderRadius: "16px 16px 0 0", overflow: "hidden" }}>
          {images[imgIdx] ? (
            <img src={images[imgIdx]} alt={room.name} style={{ width: "100%", height: 280, objectFit: "cover", display: "block" }} />
          ) : (
            <div style={{ background: PLACEHOLDER, height: 280 }} />
          )}
          <button
            onClick={onClose}
            style={{ position: "absolute", top: 12, right: 12, background: "rgba(0,0,0,0.45)", border: "none", color: "#fff", width: 36, height: 36, borderRadius: "50%", fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
          >×</button>
          {images.length > 1 && (
            <>
              {[[-1, "‹", "left"], [1, "›", "right"]].map(([dir, label, pos]) => (
                <button key={pos} onClick={() => setImgIdx((imgIdx + dir + images.length) % images.length)}
                  style={{ position: "absolute", top: "50%", [pos]: 10, transform: "translateY(-50%)", background: "rgba(0,0,0,0.35)", border: "none", color: "#fff", width: 36, height: 36, borderRadius: "50%", fontSize: 22, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {label}
                </button>
              ))}
              <div style={{ position: "absolute", bottom: 10, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 6 }}>
                {images.map((_, i) => (
                  <button key={i} onClick={() => setImgIdx(i)} style={{ width: 7, height: 7, borderRadius: "50%", background: i === imgIdx ? "#fff" : "rgba(255,255,255,0.4)", border: "none", cursor: "pointer", padding: 0 }} />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Content */}
        <div style={{ padding: "20px 24px 24px" }}>
          {/* Name + category */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#1a1a1a" }}>{room.name}</h2>
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              {room.roomCategory && <span style={{ background: "#f0f4ff", color: C.primary, borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 700 }}>{ROOM_CATEGORY_LABEL[room.roomCategory] || room.roomCategory}</span>}
            </div>
          </div>

          {/* Meta row */}
          <div style={{ display: "flex", gap: 16, fontSize: 13, color: "#666", marginBottom: 16 }}>
            <span>👥 {room.capacity} khách tối đa</span>
            {room.bedType && <span>🛏 {BED_TYPE_LABEL[room.bedType] || room.bedType}</span>}
            {room.availableUnits != null && (
              <span style={{ color: room.availableUnits <= 3 ? "#e57373" : "#888" }}>✦ Còn {room.availableUnits} phòng</span>
            )}
          </div>

          {/* Description */}
          {room.description && (
            <p style={{ margin: "0 0 16px", fontSize: 14, color: "#555", lineHeight: 1.75 }}>{room.description}</p>
          )}

          {/* Amenities */}
          {(room.amenities?.length > 0 || room.customAmenities?.length > 0) && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a", marginBottom: 8 }}>Tiện nghi phòng</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {room.amenities?.map(key => (
                  <span key={key} style={{ background: "#f7f8fa", borderRadius: 6, padding: "5px 10px", fontSize: 12, color: "#444" }}>
                    {AMENITY_LABEL[key] || key}
                  </span>
                ))}
                {room.customAmenities?.map((label, i) => (
                  <span key={i} style={{ background: "#f7f8fa", borderRadius: 6, padding: "5px 10px", fontSize: 12, color: "#444" }}>{label}</span>
                ))}
              </div>
            </div>
          )}

          {/* Price + action */}
          <div style={{ borderTop: "1px solid #eee", paddingTop: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: C.primary }}>{fmt(room.price)}<span style={{ fontSize: 13, fontWeight: 400, color: "#888" }}>/đêm</span></div>
              {nights > 1 && <div style={{ fontSize: 12, color: "#aaa" }}>{fmt(room.price * nights)} cho {nights} đêm</div>}
            </div>
            {room.available ? (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {cartQty > 0 && (
                  <>
                    <button onClick={onRemove} style={{ width: 32, height: 32, border: `1.5px solid ${C.primary}`, borderRadius: 8, background: "#fff", color: C.primary, fontSize: 20, cursor: "pointer", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                    <span style={{ fontSize: 16, fontWeight: 800, color: "#1a1a1a", minWidth: 24, textAlign: "center" }}>{cartQty}</span>
                  </>
                )}
                <button
                  onClick={onAdd}
                  style={{ background: C.primary, color: "#fff", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
                >
                  {cartQty > 0 ? "Thêm phòng +" : "Chọn phòng"}
                </button>
              </div>
            ) : (
              <span style={{ color: "#bbb", fontSize: 13, fontWeight: 600 }}>Hết phòng</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReviewSection({ hotelId, rating, ratingCount }) {
  const { t } = useLang();
  const { data: reviews = [] } = useHotelReviews(hotelId);
  const [showAll, setShowAll] = useState(false);

  const displayed = showAll ? reviews : reviews.slice(0, 2);

  return (
    <div style={{ background: "#fff", borderRadius: 12, padding: "20px 24px", marginBottom: 20, boxShadow: "0 1px 6px rgba(0,0,0,0.07)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#1a1a1a" }}>{t("detail_reviews")}</h2>
        {ratingCount > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 16, color: "#f5a623" }}>★</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: "#1a1a1a" }}>{rating?.toFixed(1)}</span>
            <span style={{ fontSize: 12, color: "#aaa" }}>({ratingCount}{t("rating_count")})</span>
          </div>
        )}
      </div>

      {reviews.length === 0 ? (
        <p style={{ margin: 0, color: "#aaa", fontSize: 13, fontStyle: "italic" }}>{t("detail_no_reviews")}</p>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {displayed.map(r => (
              <div key={r.id} style={{ borderBottom: "1px solid #f5f5f5", paddingBottom: 16 }}>
                <div style={{ display: "flex", gap: 12, marginBottom: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: "50%", background: C.primary, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 16, flexShrink: 0 }}>
                    {r.reviewerName?.charAt(0).toUpperCase() || "?"}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: "#1a1a1a" }}>{r.reviewerName || t("detail_guest")}</span>
                      <span style={{ fontSize: 11, color: "#aaa" }}>{r.createdAt?.slice(0, 10)}</span>
                    </div>
                    <div style={{ display: "flex", gap: 2, marginTop: 2 }}>
                      {[1,2,3,4,5].map(n => (
                        <span key={n} style={{ color: n <= r.rating ? "#f5a623" : "#ddd", fontSize: 13 }}>★</span>
                      ))}
                    </div>
                  </div>
                </div>
                {r.comment && <p style={{ margin: 0, fontSize: 13, color: "#555", lineHeight: 1.65 }}>{r.comment}</p>}
                {r.partnerReply && (
                  <div style={{ marginTop: 10, padding: "10px 12px", background: "#f8fafc", borderRadius: 8, borderLeft: "3px solid #3b82f6" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#3b82f6", marginBottom: 4 }}>{t("detail_partner_reply")}</div>
                    <p style={{ margin: 0, fontSize: 13, color: "#475569", lineHeight: 1.6 }}>{r.partnerReply}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
          {reviews.length > 2 && (
            <button
              onClick={() => setShowAll(v => !v)}
              style={{ marginTop: 14, background: "none", border: `1px solid ${C.primary}`, color: C.primary, borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer", width: "100%" }}
            >
              {showAll ? t("detail_collapse") : `${t("detail_show_reviews")} ${reviews.length}${t("rating_count")} ▾`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function Stars({ n, size = 16 }) {
  return (
    <span style={{ fontSize: size, letterSpacing: 1 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} style={{ color: i <= Math.round(n) ? "#f5a623" : "#ddd" }}>★</span>
      ))}
    </span>
  );
}

function useRatingLabel() {
  const { t } = useLang();
  return (r) => {
    if (r >= 4.5) return t("rating_excellent");
    if (r >= 4.0) return t("rating_great");
    if (r >= 3.5) return t("rating_good");
    return t("rating_ok");
  };
}

function fmt(n) {
  return n.toLocaleString("vi-VN") + "₫";
}

const DESC_LIMIT = 260;

export default function HotelDetailPage({ navigate, params = {}, user, onLogout, requireAuth }) {
  const { t } = useLang();
  const ratingLabel = useRatingLabel();
  const [imgIdx, setImgIdx]             = useState(0);
  const [expanded, setExpanded]         = useState(false);
  const [checkin, setCheckin]           = useState(params.checkIn  || params.checkin  || "");
  const [checkout, setCheckout]         = useState(params.checkOut || params.checkout || "");
  const [guests, setGuests]             = useState(params.guests || 2);
  // roomCart: { [roomId]: { room, quantity } } — chỉ dùng cho BY_ROOM
  const [roomCart, setRoomCart] = useState({});
  const [detailRoom, setDetailRoom] = useState(null);
  // Committed room search params — only update when user clicks Refresh
  const [roomParams, setRoomParams]     = useState({
    checkIn: params.checkIn || params.checkin || "",
    checkOut: params.checkOut || params.checkout || "",
    adults: params.guests || 2,
    rooms: Number(params.rooms) || 1,
  });

  const { data: hotel, isLoading: loadingHotel } = useHotelDetail(params.hotelId);
  const { data: rooms = [], isLoading: loadingRooms, refetch: refetchRooms } =
    useAvailableRooms(params.hotelId, roomParams);

  useEffect(() => {
    setImgIdx(0);
  }, [hotel?.id]);

  const refreshRooms = () => {
    setRoomCart({});
    setRoomParams({ checkIn: checkin, checkOut: checkout, adults: guests, rooms: Number(params.rooms) || 1 });
  };

  const addRoom = (r) => {
    setRoomCart(prev => {
      const qty = (prev[r.id]?.quantity || 0) + 1;
      if (qty > r.availableUnits) return prev;
      return { ...prev, [r.id]: { room: r, quantity: qty } };
    });
  };

  const removeRoom = (r) => setRoomCart(prev => {
    const qty = (prev[r.id]?.quantity || 0) - 1;
    if (qty <= 0) { const next = { ...prev }; delete next[r.id]; return next; }
    return { ...prev, [r.id]: { room: r, quantity: qty } };
  });

  const nights = (() => {
    if (!checkin || !checkout) return 1;
    const d = (new Date(checkout) - new Date(checkin)) / 86400000;
    return d > 0 ? d : 1;
  })();

  const isEntire = hotel?.bookingMode === "ENTIRE";
  // ENTIRE: luôn dùng room duy nhất với quantity=1
  const entireRoom = isEntire ? rooms[0] : null;
  const cartItems = Object.values(roomCart); // [{ room, quantity }]
  const totalCartCapacity  = cartItems.reduce((s, { room: r, quantity }) => s + r.capacity * quantity, 0);
  const capacityDiff       = totalCartCapacity - guests; // so với guests hiện tại, không phải searchedGuests
  const totalPrice = isEntire
    ? (entireRoom?.price || 0) * nights
    : cartItems.reduce((s, { room: r, quantity }) => s + r.price * quantity * nights, 0);
  const tax = Math.round(totalPrice * 0.1);
  // Số khách tối đa = tổng sức chứa các phòng đã chọn; fallback 30 khi chưa chọn phòng
  const maxGuests = isEntire
    ? (entireRoom?.capacity || 30)
    : cartItems.length > 0
      ? cartItems.reduce((s, { room: r, quantity }) => s + r.capacity * quantity, 0)
      : 30;
  const images = hotel?.imageUrls?.length ? hotel.imageUrls : (hotel?.coverImageUrl ? [hotel.coverImageUrl] : []);
  const imageCount = Math.max(images.length, 1);

  if (loadingHotel) {
    return (
      <div style={{ minHeight: "100vh", background: "#f7f8fa" }}>
        <MainNavbar active="search" navigate={navigate} user={user} onLogout={onLogout} />
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 24px", color: "#aaa", textAlign: "center" }}>{t("detail_loading")}</div>
      </div>
    );
  }

  if (!hotel) {
    return (
      <div style={{ minHeight: "100vh", background: "#f7f8fa" }}>
        <MainNavbar active="search" navigate={navigate} user={user} onLogout={onLogout} />
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "60px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🏨</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "#1a1a1a", marginBottom: 8 }}>{t("detail_not_found")}</h2>
          <p style={{ fontSize: 14, color: "#888", marginBottom: 24 }}>{t("detail_not_found_sub")}</p>
          <button onClick={() => window.history.back()} style={{ background: "#BE1E2E", color: "#fff", border: "none", borderRadius: 10, padding: "12px 28px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
            {t("detail_back")}
          </button>
        </div>
      </div>
    );
  }

  const amenities = hotel?.amenities || [];
  const description = hotel?.description || "";
  const descShort = description.length > DESC_LIMIT ? description.slice(0, DESC_LIMIT) + "…" : description;

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #ffffff 0%, #fdf4f5 45%, #f7ebeb 100%)", fontFamily: "'Segoe UI',sans-serif" }}>
      <MainNavbar active="search" navigate={navigate} user={user} onLogout={onLogout} />

      {/* Back */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "16px 24px 0" }}>
        <button
          onClick={() => window.history.back()}
          style={{ background: "none", border: "none", color: C.primary, cursor: "pointer", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, padding: 0 }}
        >
          {t("detail_back")}
        </button>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "16px 24px 40px", display: "flex", gap: 24, alignItems: "flex-start" }}>
        {/* LEFT COLUMN */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Image carousel */}
          <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", marginBottom: 24 }}>
            {images[imgIdx] ? (
              <img
                src={images[imgIdx]}
                alt={hotel?.name || "hotel"}
                style={{ width: "100%", height: 420, objectFit: "cover", display: "block" }}
              />
            ) : (
              <div style={{ background: PLACEHOLDER, height: 420, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ color: "#aaa", fontSize: 14 }}>{t("detail_no_photo")}</span>
              </div>
            )}
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(transparent,rgba(0,0,0,0.65))", padding: "40px 24px 20px" }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <span style={{ background: C.primary, color: "#fff", borderRadius: 4, padding: "2px 10px", fontSize: 12, fontWeight: 700 }}>{hotel?.starLevel || "—"}{t("detail_star")}</span>
                <span style={{ background: "rgba(255,255,255,0.2)", color: "#fff", borderRadius: 4, padding: "2px 10px", fontSize: 12 }}>{hotel?.hotelType || "Khách sạn"}</span>
              </div>
              <h1 style={{ margin: 0, color: "#fff", fontSize: 26, fontWeight: 800 }}>{hotel?.name}</h1>
              <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, marginTop: 4 }}>📍 {hotel?.address}</div>
            </div>
            {imageCount > 1 && (
              <>
                {[{ dir: -1, label: "‹", pos: "left" }, { dir: 1, label: "›", pos: "right" }].map(({ dir, label, pos }) => (
                  <button
                    key={pos}
                    onClick={() => setImgIdx((imgIdx + dir + imageCount) % imageCount)}
                    style={{ position: "absolute", top: "50%", [pos]: 12, transform: "translateY(-50%)", background: "rgba(0,0,0,0.4)", border: "none", color: "#fff", width: 40, height: 40, borderRadius: "50%", fontSize: 22, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                  >
                    {label}
                  </button>
                ))}
                <div style={{ position: "absolute", bottom: 12, right: 16, display: "flex", gap: 6 }}>
                  {images.map((_, i) => (
                    <button key={i} onClick={() => setImgIdx(i)} style={{ width: 8, height: 8, borderRadius: "50%", background: i === imgIdx ? "#fff" : "rgba(255,255,255,0.4)", border: "none", cursor: "pointer", padding: 0 }} />
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Rating summary */}
          <div style={{ background: "#fff", borderRadius: 12, padding: "16px 20px", marginBottom: 20, display: "flex", alignItems: "center", gap: 24, boxShadow: "0 1px 6px rgba(0,0,0,0.07)" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 36, fontWeight: 900, color: C.primary }}>{hotel.rating > 0 ? hotel.rating.toFixed(1) : "—"}</div>
              <Stars n={hotel.rating || 0} />
              <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>
                {hotel.ratingCount > 0 ? `${hotel.ratingCount}${t("rating_count")}` : (hotel.rating > 0 ? ratingLabel(hotel.rating) : t("rating_none"))}
              </div>
            </div>
            <div style={{ flex: 1, color: "#bbb", fontSize: 13, fontStyle: "italic" }}>
              {hotel.ratingCount === 0 && t("detail_no_review_msg")}
            </div>
          </div>

          {/* Description */}
          <div style={{ background: "#fff", borderRadius: 12, padding: "20px 24px", marginBottom: 20, boxShadow: "0 1px 6px rgba(0,0,0,0.07)" }}>
            <h2 style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 700, color: C.dark }}>{t("detail_about")}</h2>
            <p style={{ margin: 0, fontSize: 14, color: "#555", lineHeight: 1.75 }}>
              {expanded || description.length <= DESC_LIMIT ? description : descShort}
              {!expanded && description.length > DESC_LIMIT && (
                <> <button onClick={() => setExpanded(true)} style={{ background: "none", border: "none", color: C.primary, cursor: "pointer", fontSize: 14, fontWeight: 600, padding: 0 }}>{t("detail_read_more")}</button></>
              )}
            </p>
            {expanded && hotel?.descriptionExtra && (
              <p style={{ margin: "12px 0 0", fontSize: 14, color: "#555", lineHeight: 1.75 }}>{hotel.descriptionExtra}</p>
            )}
            {expanded && (
              <button onClick={() => setExpanded(false)} style={{ background: "none", border: "none", color: C.primary, cursor: "pointer", fontSize: 14, fontWeight: 600, padding: "8px 0 0", display: "block" }}>
                {t("detail_collapse")}
              </button>
            )}
          </div>

          {/* Amenities */}
          {amenities.length > 0 && (
            <div style={{ background: "#fff", borderRadius: 12, padding: "20px 24px", marginBottom: 20, boxShadow: "0 1px 6px rgba(0,0,0,0.07)" }}>
              <h2 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700, color: C.dark }}>{t("detail_amenities")}</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                {amenities.map((a) => (
                  <div key={a.label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#f7f8fa", borderRadius: 8 }}>
                    <span style={{ fontSize: 22 }}>{a.icon}</span>
                    <span style={{ fontSize: 13, color: C.dark, fontWeight: 500 }}>{a.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rooms — chỉ hiển thị cho BY_ROOM */}
          {!isEntire && (
            <div style={{ background: "#fff", borderRadius: 12, padding: "20px 24px", marginBottom: 20, boxShadow: "0 1px 6px rgba(0,0,0,0.07)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: C.dark }}>{t("detail_rooms")}</h2>
                <button
                  onClick={refreshRooms}
                  style={{ background: "none", border: `1px solid ${C.primary}`, color: C.primary, borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                >
                  {t("detail_refresh")}
                </button>
              </div>
              {loadingRooms ? (
                <div style={{ color: "#aaa", textAlign: "center", padding: "24px 0" }}>{t("detail_loading_rooms")}</div>
              ) : rooms.length === 0 ? (
                <div style={{ color: "#aaa", textAlign: "center", padding: "24px 0", fontSize: 14 }}>
                  {t("detail_no_rooms")}
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  {rooms.map((r) => {
                    const cartQty = roomCart[r.id]?.quantity || 0;
                    return (
                      <div key={r.id} style={{ border: cartQty > 0 ? `2px solid ${C.primary}` : "2px solid #eee", borderRadius: 12, overflow: "hidden", opacity: r.available ? 1 : 0.55 }}>
                        <div onClick={() => setDetailRoom(r)} style={{ cursor: "pointer", position: "relative" }}>
                          {r.imageUrl ? (
                            <img src={r.imageUrl} alt={r.name} style={{ width: "100%", height: 140, objectFit: "cover", display: "block" }} />
                          ) : (
                            <div style={{ background: PLACEHOLDER, height: 140 }} />
                          )}
                          {r.imageUrls?.length > 1 && (
                            <span style={{ position: "absolute", bottom: 6, right: 8, background: "rgba(0,0,0,0.45)", color: "#fff", borderRadius: 4, padding: "2px 7px", fontSize: 11 }}>1/{r.imageUrls.length} ảnh</span>
                          )}
                        </div>
                        <div style={{ padding: "14px 16px" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                            <div style={{ fontWeight: 700, fontSize: 15, color: C.dark }}>{r.name}</div>
                            <button onClick={() => setDetailRoom(r)} style={{ background: "none", border: "none", color: C.primary, fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0, flexShrink: 0 }}>Xem chi tiết</button>
                          </div>
                          <div style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>
                            🛏 {r.beds}{r.size ? ` · 📐 ${r.size}` : ""}
                            {r.availableUnits != null && (
                              <span style={{ marginLeft: 8, color: r.availableUnits <= 3 ? "#e57373" : "#aaa" }}>
                                · {t("detail_available_units") || "Còn"} {r.availableUnits}
                              </span>
                            )}
                          </div>
                          {r.tags.length > 0 && (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
                              {r.tags.map((tag) => (
                                <span key={tag} style={{ background: "#f0f4ff", color: C.primary, borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>{tag}</span>
                              ))}
                            </div>
                          )}
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div>
                              <div style={{ fontSize: 17, fontWeight: 800, color: C.primary }}>{r.price > 0 ? fmt(r.price) : t("contact")}</div>
                              {r.price > 0 && <div style={{ fontSize: 11, color: "#aaa" }}>{t("detail_per_night")}</div>}
                            </div>
                            {!r.available ? (
                              <span style={{ color: "#bbb", fontSize: 12, fontWeight: 600 }}>{t("detail_full")}</span>
                            ) : (
                              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                {cartQty > 0 && (
                                  <>
                                    <button
                                      onClick={() => removeRoom(r)}
                                      style={{ width: 30, height: 30, border: `1.5px solid ${C.primary}`, borderRadius: 6, background: "#fff", color: C.primary, fontSize: 18, lineHeight: 1, cursor: "pointer", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}
                                    >−</button>
                                    <span style={{ fontSize: 14, fontWeight: 700, color: C.dark, minWidth: 20, textAlign: "center" }}>{cartQty}</span>
                                  </>
                                )}
                                <button
                                  onClick={() => addRoom(r)}
                                  disabled={cartQty >= r.availableUnits}
                                  style={{ background: cartQty >= r.availableUnits ? "#ccc" : C.primary, color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: cartQty >= r.availableUnits ? "not-allowed" : "pointer" }}
                                >
                                  {cartQty > 0 ? "+" : t("detail_select")}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Guest Reviews */}
          <ReviewSection hotelId={hotel?.id} rating={hotel?.rating} ratingCount={hotel?.ratingCount} />

          {/* Contact */}
          <div style={{ background: "#fff", borderRadius: 12, padding: "16px 24px", boxShadow: "0 1px 6px rgba(0,0,0,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 14, color: "#555" }}>{t("detail_help")}</span>
            <button style={{ background: "none", border: `1px solid ${C.primary}`, color: C.primary, borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              {t("detail_help_btn")}
            </button>
          </div>
        </div>

        {/* RIGHT STICKY SIDEBAR */}
        <div style={{ width: 340, flexShrink: 0, position: "sticky", top: 80 }}>
          <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 4px 24px rgba(0,0,0,0.10)", padding: "24px 20px" }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: C.primary, marginBottom: 4 }}>
              {totalPrice > 0 ? fmt(totalPrice) : "—"} <span style={{ fontSize: 13, fontWeight: 400, color: "#888" }}>{nights} đêm</span>
            </div>
            <div style={{ fontSize: 13, color: "#aaa", marginBottom: 8 }}>
              {isEntire
                ? (t("detail_entire_title") || "Thuê nguyên căn")
                : cartItems.length > 0
                  ? `${cartItems.length} loại phòng, ${cartItems.reduce((s, { quantity }) => s + quantity, 0)} phòng`
                  : (t("detail_select_room") || "Chưa chọn phòng")}
            </div>

            <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700, color: C.dark }}>{t("detail_your_trip")}</h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
              <div>
                <label style={{ fontSize: 11, color: "#888", fontWeight: 600, display: "block", marginBottom: 4 }}>{t("detail_checkin")}</label>
                <input type="date" value={checkin} onChange={(e) => setCheckin(e.target.value)} style={{ width: "100%", padding: "8px 10px", border: "1px solid #ddd", borderRadius: 8, fontSize: 13, boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "#888", fontWeight: 600, display: "block", marginBottom: 4 }}>{t("detail_checkout")}</label>
                <input type="date" value={checkout} onChange={(e) => setCheckout(e.target.value)} style={{ width: "100%", padding: "8px 10px", border: "1px solid #ddd", borderRadius: 8, fontSize: 13, boxSizing: "border-box" }} />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, color: "#888", fontWeight: 600, display: "block", marginBottom: 4 }}>{t("detail_guests")}</label>
              <div style={{ display: "flex", alignItems: "center", border: "1px solid #ddd", borderRadius: 8, overflow: "hidden" }}>
                <button onClick={() => setGuests(Math.max(1, guests - 1))} style={{ width: 40, height: 38, background: "#f5f5f5", border: "none", fontSize: 18, cursor: "pointer", color: C.dark }}>−</button>
                <div style={{ flex: 1, textAlign: "center", fontSize: 14, fontWeight: 600 }}>{guests}{t("guests")}</div>
                <button onClick={() => setGuests(Math.min(maxGuests, guests + 1))} disabled={guests >= maxGuests} style={{ width: 40, height: 38, background: "#f5f5f5", border: "none", fontSize: 18, cursor: guests >= maxGuests ? "not-allowed" : "pointer", color: guests >= maxGuests ? "#ccc" : C.dark }}>+</button>
              </div>
            </div>

            {/* Capacity banner — BY_ROOM only, chỉ khi đã chọn ít nhất 1 phòng */}
            {!isEntire && cartItems.length > 0 && (() => {
              if (capacityDiff < 0) {
                // Thiếu chỗ
                return (
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "#fff8e1", border: "1px solid #ffe082", borderRadius: 10, padding: "10px 12px", marginBottom: 14 }}>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>⚠️</span>
                    <div style={{ fontSize: 13, color: "#7a5800", lineHeight: 1.5 }}>
                      Bạn vẫn cần chỗ cho <strong>{Math.abs(capacityDiff)} người lớn</strong> nữa.
                    </div>
                  </div>
                );
              }
              if (capacityDiff === 0) {
                // Đủ chỗ
                return (
                  <div style={{ display: "flex", gap: 10, alignItems: "center", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 10, padding: "10px 12px", marginBottom: 14 }}>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>✅</span>
                    <div style={{ fontSize: 13, color: "#166534", lineHeight: 1.5 }}>
                      Đủ chỗ cho tất cả <strong>{guests} khách</strong>.
                    </div>
                  </div>
                );
              }
              // Dư chỗ
              return (
                <div style={{ display: "flex", gap: 10, alignItems: "center", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 12px", marginBottom: 14 }}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>ℹ️</span>
                  <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>
                    Phòng bạn chọn có thể chứa thêm <strong>{capacityDiff} người</strong> so với nhu cầu.
                  </div>
                </div>
              );
            })()}

            {totalPrice > 0 && (
              <div style={{ borderTop: "1px solid #eee", paddingTop: 14, marginBottom: 14 }}>
                {isEntire ? (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#555", marginBottom: 6 }}>
                    <span>{fmt(entireRoom?.price || 0)} × {nights} đêm</span>
                    <span>{fmt(totalPrice)}</span>
                  </div>
                ) : cartItems.map(({ room: r, quantity }) => (
                  <div key={r.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#555", marginBottom: 4 }}>
                    <span style={{ flex: 1, marginRight: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name} × {quantity}</span>
                    <span style={{ flexShrink: 0 }}>{fmt(r.price * quantity * nights)}</span>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#555", marginBottom: 6, marginTop: 4 }}>
                  <span>{t("detail_tax")}</span>
                  <span>{fmt(tax)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 800, color: C.dark, borderTop: "1px solid #eee", paddingTop: 10, marginTop: 6 }}>
                  <span>{t("detail_total")}</span>
                  <span style={{ color: C.primary }}>{fmt(totalPrice + tax)}</span>
                </div>
              </div>
            )}

            <button
              disabled={isEntire ? !entireRoom?.available : cartItems.length === 0}
              style={{ width: "100%", background: (isEntire ? entireRoom?.available : cartItems.length > 0) ? C.primary : "#ccc", color: "#fff", border: "none", borderRadius: 10, padding: "14px", fontSize: 15, fontWeight: 800, cursor: (isEntire ? entireRoom?.available : cartItems.length > 0) ? "pointer" : "not-allowed", marginBottom: 10 }}
              onClick={() => {
                const bookingRooms = isEntire
                  ? [{ id: entireRoom.id, name: entireRoom.name, price: entireRoom.price, quantity: 1 }]
                  : cartItems.map(({ room: r, quantity }) => ({ id: r.id, name: r.name, price: r.price, quantity }));
                const bp = { hotelId: hotel?.id, hotelName: hotel?.name, rooms: bookingRooms, checkin, checkout, guests, nights, cancellationPolicy: hotel?.cancellationPolicy || "MODERATE" };
                if (user) navigate("booking", bp);
                else if (requireAuth) requireAuth("booking", bp);
                else navigate("login");
              }}
            >
              {isEntire ? (t("detail_book_entire") || "Đặt nguyên căn") : t("detail_confirm_btn")}
            </button>

            {(() => {
              const policy = hotel?.cancellationPolicy || "MODERATE";
              const cfg = {
                FLEXIBLE: { Icon: ShieldCheck, color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0", label: "Miễn phí hủy trước 24h" },
                MODERATE: { Icon: Clock,        color: "#d97706", bg: "#fffbeb", border: "#fde68a", label: "Miễn phí hủy trước 7 ngày" },
                STRICT:   { Icon: ShieldOff,    color: "#dc2626", bg: "#fef2f2", border: "#fecaca", label: "Không hoàn tiền khi hủy" },
              }[policy];
              const { Icon, color, bg, border, label } = cfg;
              return (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, background: bg, border: `1px solid ${border}` }}>
                  <Icon size={16} color={color} style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color }}>{label}</span>
                </div>
              );
            })()}

          </div>
        </div>
      </div>

      <Footer navigate={navigate} />



{detailRoom && (
        <RoomDetailModal
          room={detailRoom}
          nights={nights}
          onClose={() => setDetailRoom(null)}
          onAdd={() => { addRoom(detailRoom); setDetailRoom(null); }}
          onRemove={() => removeRoom(detailRoom)}
          cartQty={roomCart[detailRoom.id]?.quantity || 0}
        />
      )}
    </div>
  );
}
