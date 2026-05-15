import { useState, useEffect } from "react";
import { C } from "../components/auth/AuthShared";
import MainNavbar from "../components/MainNavbar";
import Footer from "../components/Footer";
import { useHotelDetail, useAvailableRooms } from "../hooks/useHotelQueries";
import { useHotelReviews } from "../hooks/useReviewQueries";
import { useLang } from "../contexts/LanguageContext";

const PLACEHOLDER = "repeating-conic-gradient(#ccc 0% 25%,#e8e8e8 0% 50%) 0 0/20px 20px";

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
  const [selectedRoom, setSelectedRoom] = useState(null);
  // Committed room search params — only update when user clicks Refresh
  const [roomParams, setRoomParams]     = useState({
    checkIn: params.checkIn || params.checkin || "",
    checkOut: params.checkOut || params.checkout || "",
    adults: params.guests || 2,
    rooms: 1,
  });

  const { data: hotel, isLoading: loadingHotel } = useHotelDetail(params.hotelId);
  const { data: rooms = [], isLoading: loadingRooms, refetch: refetchRooms } =
    useAvailableRooms(params.hotelId, roomParams);

  useEffect(() => {
    setImgIdx(0);
  }, [hotel?.id]);

  const refreshRooms = () => {
    setSelectedRoom(null);
    setRoomParams({ checkIn: checkin, checkOut: checkout, adults: guests, rooms: 1 });
  };

  const nights = (() => {
    if (!checkin || !checkout) return 1;
    const d = (new Date(checkout) - new Date(checkin)) / 86400000;
    return d > 0 ? d : 1;
  })();

  const roomPrice = selectedRoom ? selectedRoom.price : (rooms[0]?.price || 0);
  const totalPrice = roomPrice * nights;
  const tax = Math.round(totalPrice * 0.1);
  const images = hotel?.imageUrls?.length ? hotel.imageUrls : (hotel?.imageUrl ? [hotel.imageUrl] : []);
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

          {/* Rooms */}
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
                {rooms.map((r) => (
                  <div key={r.id} style={{ border: selectedRoom?.id === r.id ? `2px solid ${C.primary}` : "2px solid #eee", borderRadius: 12, overflow: "hidden", opacity: r.available ? 1 : 0.55 }}>
                    {r.imageUrl ? (
                      <img src={r.imageUrl} alt={r.name} style={{ width: "100%", height: 140, objectFit: "cover", display: "block" }} />
                    ) : (
                      <div style={{ background: PLACEHOLDER, height: 140 }} />
                    )}
                    <div style={{ padding: "14px 16px" }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: C.dark, marginBottom: 4 }}>{r.name}</div>
                      <div style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>
                        🛏 {r.beds}{r.size ? ` · 📐 ${r.size}` : ""}
                      </div>
                      {r.tags.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
                          {r.tags.map((t) => (
                            <span key={t} style={{ background: "#f0f4ff", color: C.primary, borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>{t}</span>
                          ))}
                        </div>
                      )}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div>
                          <div style={{ fontSize: 17, fontWeight: 800, color: C.primary }}>{r.price > 0 ? fmt(r.price) : t("contact")}</div>
                          {r.price > 0 && <div style={{ fontSize: 11, color: "#aaa" }}>{t("detail_per_night")}</div>}
                        </div>
                        <button
                          disabled={!r.available}
                          onClick={() => setSelectedRoom(r)}
                          style={{ background: !r.available ? "#ccc" : selectedRoom?.id === r.id ? C.dark : C.primary, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: r.available ? "pointer" : "not-allowed" }}
                        >
                          {!r.available ? t("detail_full") : selectedRoom?.id === r.id ? t("detail_selected") : t("detail_select")}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

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
              {roomPrice > 0 ? fmt(roomPrice) : "—"} <span style={{ fontSize: 13, fontWeight: 400, color: "#888" }}>{t("detail_per_night_lbl")}</span>
            </div>
            <div style={{ fontSize: 13, color: "#aaa", marginBottom: 16 }}>
              {selectedRoom ? selectedRoom.name : rooms[0]?.name || hotel?.name || ""}
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
                <button onClick={() => setGuests(guests + 1)} style={{ width: 40, height: 38, background: "#f5f5f5", border: "none", fontSize: 18, cursor: "pointer", color: C.dark }}>+</button>
              </div>
            </div>

            {roomPrice > 0 && (
              <div style={{ borderTop: "1px solid #eee", paddingTop: 14, marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#555", marginBottom: 6 }}>
                  <span>{fmt(roomPrice)} × {nights} đêm</span>
                  <span>{fmt(roomPrice * nights)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#555", marginBottom: 6 }}>
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
              style={{ width: "100%", background: C.primary, color: "#fff", border: "none", borderRadius: 10, padding: "14px", fontSize: 15, fontWeight: 800, cursor: "pointer", marginBottom: 10 }}
              onClick={() => {
                const bp = { hotelId: hotel?.id, hotelName: hotel?.name, room: selectedRoom || rooms[0], checkin, checkout, guests, nights };
                if (user) navigate("booking", bp);
                else if (requireAuth) requireAuth("booking", bp);
                else navigate("login");
              }}
            >
              {t("detail_confirm_btn")}
            </button>

            <div style={{ fontSize: 12, color: "#aaa", textAlign: "center", lineHeight: 1.5 }}>
              {t("detail_cancel_policy")}
            </div>
          </div>
        </div>
      </div>

      <Footer navigate={navigate} />
    </div>
  );
}
