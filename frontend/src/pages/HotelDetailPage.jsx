import { useState, useEffect } from "react";
import { C } from "../lib/constants";
import { ShieldCheck, Clock, ShieldOff, MapPin, BedDouble, Building2, Users, CheckCircle2 } from "lucide-react";
import MainNavbar from "../components/MainNavbar";
import Footer from "../components/Footer";
import { useHotelDetail, useAvailableRooms } from "../hooks/useHotelQueries";
import { useHotelReviews } from "../hooks/useReviewQueries";
import { useLang } from "../contexts/LanguageContext";
import { ROOM_AMENITIES_FLAT, HOTEL_AMENITIES_FLAT } from "../utils/amenityConfig";
import { ROOM_CATEGORY_LABELS, BED_TYPE_LABELS } from "../utils/roomConfig";
import { getTypeLabel } from "../utils/propertyGroupUtils";
import "../styles/pages/HotelDetailPage.css";
import HotelLocationMap from "../components/map/HotelLocationMap";
import CancellationPolicyInfo from "../components/CancellationPolicyInfo";

const PLACEHOLDER = "repeating-conic-gradient(#ccc 0% 25%,#e8e8e8 0% 50%) 0 0/20px 20px";

const ROOM_CATEGORY_LABEL = ROOM_CATEGORY_LABELS;
const BED_TYPE_LABEL       = BED_TYPE_LABELS;
const AMENITY_LABEL        = Object.fromEntries(ROOM_AMENITIES_FLAT.map(a => [a.key, a.label]));
const HOTEL_AMENITY_LOOKUP = Object.fromEntries(HOTEL_AMENITIES_FLAT.map(a => [a.key, a]));

// ── Room detail modal ────────────────────────────────────────────────
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
      role="dialog"
      aria-modal="true"
      aria-labelledby="hdp-modal-room-title"
      className="hdp-modal-overlay"
      onClick={onClose}
    >
      <div className="hdp-modal-box" onClick={e => e.stopPropagation()}>

        {/* Gallery */}
        <div className="hdp-modal-gallery">
          {images[imgIdx]
            ? <img src={images[imgIdx]} alt={room.name} className="hdp-modal-img" />
            : <div className="hdp-modal-ph" />
          }
          <button
            onClick={onClose}
            aria-label="Đóng"
            className="hdp-modal-close-btn"
          >×</button>

          {images.length > 1 && (
            <>
              {[[-1, "‹", "hdp-modal-nav-left"], [1, "›", "hdp-modal-nav-right"]].map(([dir, label, cls]) => (
                <button
                  key={cls}
                  aria-label={dir === -1 ? "Ảnh trước" : "Ảnh sau"}
                  onClick={() => setImgIdx((imgIdx + dir + images.length) % images.length)}
                  className={`hdp-modal-nav ${cls}`}
                >
                  {label}
                </button>
              ))}
              <div className="hdp-modal-dots">
                {images.map((_, i) => (
                  <button
                    key={i}
                    aria-label={`Ảnh ${i + 1}`}
                    onClick={() => setImgIdx(i)}
                    className="hdp-modal-dot"
                    style={{ background: i === imgIdx ? "#fff" : "rgba(255,255,255,0.4)" }}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Content */}
        <div className="hdp-modal-body">
          <div className="hdp-modal-header">
            <h2 id="hdp-modal-room-title" className="hdp-modal-title">{room.name}</h2>
            {room.roomCategory && (
              <div className="hdp-modal-badges">
                <span className="hdp-modal-cat-badge">
                  {ROOM_CATEGORY_LABEL[room.roomCategory] || room.roomCategory}
                </span>
              </div>
            )}
          </div>

          <div className="hdp-modal-meta">
            <span className="hdp-modal-meta-item"><Users size={13} aria-hidden="true" /> {room.capacity} khách tối đa</span>
            {room.bedType && (
              <span className="hdp-modal-meta-item"><BedDouble size={13} aria-hidden="true" /> {BED_TYPE_LABEL[room.bedType] || room.bedType}</span>
            )}
            {room.availableUnits != null && (
              <span className={room.availableUnits <= 3 ? "hdp-modal-avail-low" : ""}>
                Còn {room.availableUnits} phòng
              </span>
            )}
          </div>

          {room.description && (
            <p className="hdp-modal-desc">{room.description}</p>
          )}

          {(room.amenities?.length > 0 || room.customAmenities?.length > 0) && (
            <div className="hdp-modal-amenities-section">
              <div className="hdp-modal-amenities-title">Tiện nghi phòng</div>
              <div className="hdp-modal-amenities-list">
                {room.amenities?.map(key => (
                  <span key={key} className="hdp-modal-amenity-tag">{AMENITY_LABEL[key] || key}</span>
                ))}
                {room.customAmenities?.map((label, i) => (
                  <span key={i} className="hdp-modal-amenity-tag">{label}</span>
                ))}
              </div>
            </div>
          )}

          <div className="hdp-modal-footer">
            <div>
              <div>
                <span className="hdp-modal-price-val">{fmt(room.price)}</span>
                <span className="hdp-modal-per-night">/đêm</span>
              </div>
              {nights > 1 && (
                <div className="hdp-modal-total-text">{fmt(room.price * nights)} cho {nights} đêm</div>
              )}
            </div>

            {room.available ? (
              <div className="hdp-modal-cart">
                {cartQty > 0 && (
                  <>
                    <button onClick={onRemove} className="hdp-modal-qty-btn" aria-label="Bớt phòng">−</button>
                    <span className="hdp-modal-qty-val">{cartQty}</span>
                  </>
                )}
                <button onClick={onAdd} className="hdp-modal-select-btn">
                  {cartQty > 0 ? "Thêm phòng +" : "Chọn phòng"}
                </button>
              </div>
            ) : (
              <span className="hdp-modal-sold">Hết phòng</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Review section ───────────────────────────────────────────────────
function ReviewSection({ hotelId, rating, ratingCount }) {
  const { t } = useLang();
  const { data: reviews = [] } = useHotelReviews(hotelId);
  const [showAll, setShowAll] = useState(false);
  const displayed = showAll ? reviews : reviews.slice(0, 2);

  return (
    <div className="hdp-card">
      <div className="hdp-review-header">
        <h2 className="hdp-review-title">{t("detail_reviews")}</h2>
        {ratingCount > 0 && (
          <div className="hdp-review-score">
            <span className="hdp-review-score-star">★</span>
            <span className="hdp-review-score-val">{rating?.toFixed(1)}</span>
            <span className="hdp-review-score-count">({ratingCount}{t("rating_count")})</span>
          </div>
        )}
      </div>

      {reviews.length === 0 ? (
        <p className="hdp-review-none">{t("detail_no_reviews")}</p>
      ) : (
        <>
          <div className="hdp-review-list">
            {displayed.map(r => (
              <div key={r.id} className="hdp-review-item">
                <div className="hdp-review-item-top">
                  <div className="hdp-review-avatar" aria-hidden="true">
                    {r.reviewerName?.charAt(0).toUpperCase() || "?"}
                  </div>
                  <div className="hdp-review-meta">
                    <div className="hdp-review-name-row">
                      <span className="hdp-review-name">{r.reviewerName || t("detail_guest")}</span>
                      <span className="hdp-review-date">{r.createdAt?.slice(0, 10)}</span>
                    </div>
                    <div className="hdp-review-stars" aria-label={`${r.rating} sao`}>
                      {[1,2,3,4,5].map(n => (
                        <span key={n} style={{ color: n <= r.rating ? "#f5a623" : "#ddd", fontSize: 13 }}>★</span>
                      ))}
                    </div>
                  </div>
                </div>
                {r.comment && <p className="hdp-review-comment">{r.comment}</p>}
                {r.partnerReply && (
                  <div className="hdp-review-reply">
                    <div className="hdp-review-reply-label">{t("detail_partner_reply")}</div>
                    <p className="hdp-review-reply-text">{r.partnerReply}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
          {reviews.length > 2 && (
            <button onClick={() => setShowAll(v => !v)} className="hdp-show-all-btn">
              {showAll ? t("detail_collapse") : `${t("detail_show_reviews")} ${reviews.length}${t("rating_count")} ▾`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ── Stars ────────────────────────────────────────────────────────────
function Stars({ n, size = 16 }) {
  return (
    <span className="hdp-stars" style={{ fontSize: size }} aria-label={`${Math.round(n)} sao`}>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} style={{ color: i <= Math.round(n) ? "#f5a623" : "#ddd" }}>★</span>
      ))}
    </span>
  );
}

function useRatingLabel() {
  const { t } = useLang();
  return r => {
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

// ── Cancellation policy config ───────────────────────────────────────
const POLICY_CFG = {
  FLEXIBLE: { Icon: ShieldCheck, color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0", label: "Miễn phí hủy trước 24h" },
  MODERATE: { Icon: Clock,       color: "#d97706", bg: "#fffbeb", border: "#fde68a", label: "Miễn phí hủy trước 7 ngày" },
  STRICT:   { Icon: ShieldOff,   color: "#dc2626", bg: "#fef2f2", border: "#fecaca", label: "Không hoàn tiền khi hủy" },
};

// ── Main component ───────────────────────────────────────────────────
export default function HotelDetailPage({ navigate, params = {}, user, onLogout, requireAuth }) {
  const { t, lang } = useLang();
  const ratingLabel = useRatingLabel();

  const [imgIdx, setImgIdx]     = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [checkin,  setCheckin]  = useState(params.checkIn  || params.checkin  || "");
  const [checkout, setCheckout] = useState(params.checkOut || params.checkout || "");
  const [guests,   setGuests]   = useState(params.guests || 2);
  const [roomCart, setRoomCart] = useState({});
  const [detailRoom, setDetailRoom] = useState(null);
  const [roomParams, setRoomParams] = useState({
    checkIn:  params.checkIn  || params.checkin  || "",
    checkOut: params.checkOut || params.checkout || "",
    adults: params.guests || 2,
    rooms:  Number(params.rooms) || 1,
  });

  const { data: hotel, isLoading: loadingHotel } = useHotelDetail(params.hotelId);
  const { data: rooms = [], isLoading: loadingRooms } =
    useAvailableRooms(params.hotelId, roomParams);

  useEffect(() => { setImgIdx(0); }, [hotel?.id]);

  const refreshRooms = () => {
    setRoomCart({});
    setRoomParams({ checkIn: checkin, checkOut: checkout, adults: guests, rooms: Number(params.rooms) || 1 });
  };

  const addRoom = r => setRoomCart(prev => {
    const qty = (prev[r.id]?.quantity || 0) + 1;
    if (qty > r.availableUnits) return prev;
    return { ...prev, [r.id]: { room: r, quantity: qty } };
  });

  const removeRoom = r => setRoomCart(prev => {
    const qty = (prev[r.id]?.quantity || 0) - 1;
    if (qty <= 0) { const next = { ...prev }; delete next[r.id]; return next; }
    return { ...prev, [r.id]: { room: r, quantity: qty } };
  });

  const nights = (() => {
    if (!checkin || !checkout) return 1;
    const d = (new Date(checkout) - new Date(checkin)) / 86400000;
    return d > 0 ? d : 1;
  })();

  const isEntire     = hotel?.bookingMode === "ENTIRE";
  const entireRoom   = isEntire ? rooms[0] : null;
  const cartItems    = Object.values(roomCart);
  const totalCapacity  = cartItems.reduce((s, { room: r, quantity }) => s + r.capacity * quantity, 0);
  const capacityDiff   = totalCapacity - guests;
  const totalPrice = isEntire
    ? (entireRoom?.price || 0) * nights
    : cartItems.reduce((s, { room: r, quantity }) => s + r.price * quantity * nights, 0);
  const tax = Math.round(totalPrice * 0.1);
  const maxGuests = isEntire
    ? (entireRoom?.capacity || 30)
    : cartItems.length > 0
      ? cartItems.reduce((s, { room: r, quantity }) => s + r.capacity * quantity, 0)
      : 30;

  const images     = hotel?.imageUrls?.length ? hotel.imageUrls : (hotel?.coverImageUrl ? [hotel.coverImageUrl] : []);
  const imageCount = Math.max(images.length, 1);

  // ── Loading ──
  if (loadingHotel) {
    return (
      <div className="hdp-state-wrap">
        <MainNavbar active="search" navigate={navigate} user={user} onLogout={onLogout} />
        <div className="hdp-state-inner">{t("detail_loading")}</div>
      </div>
    );
  }

  // ── Not found ──
  if (!hotel) {
    return (
      <div className="hdp-state-wrap">
        <MainNavbar active="search" navigate={navigate} user={user} onLogout={onLogout} />
        <div className="hdp-notfound-inner">
          <Building2 size={48} color={C.primary} style={{ marginBottom: 16 }} aria-hidden="true" />
          <h2 className="hdp-notfound-title">{t("detail_not_found")}</h2>
          <p className="hdp-notfound-sub">{t("detail_not_found_sub")}</p>
          <button onClick={() => window.history.back()} className="hdp-notfound-btn">
            {t("detail_back")}
          </button>
        </div>
      </div>
    );
  }

  const amenities  = hotel?.amenities || [];
  const description = hotel?.description || "";
  const descShort  = description.length > DESC_LIMIT ? description.slice(0, DESC_LIMIT) + "…" : description;
  const policy     = hotel?.cancellationPolicy || "MODERATE";
  const policyCfg  = POLICY_CFG[policy] || POLICY_CFG.MODERATE;
  const PolicyIcon = policyCfg.Icon;
  const insufficientCapacity = !isEntire && cartItems.length > 0 && capacityDiff < 0;
  const canBook = (isEntire ? !!entireRoom?.available : cartItems.length > 0) && !insufficientCapacity;

  return (
    <div className="hdp-root">
      <MainNavbar active="search" navigate={navigate} user={user} onLogout={onLogout} />

      {/* Back */}
      <div className="hdp-back-wrap">
        <button onClick={() => window.history.back()} className="hdp-back-btn">
          {t("detail_back")}
        </button>
      </div>

      <div className="hdp-layout">

        {/* ── LEFT COLUMN ── */}
        <div className="hdp-left">

          {/* Image carousel */}
          <div className="hdp-carousel">
            {images[imgIdx]
              ? <img src={images[imgIdx]} alt={hotel?.name || "hotel"} className="hdp-carousel-img" />
              : (
                <div className="hdp-carousel-ph">
                  <span className="hdp-carousel-ph-text">{t("detail_no_photo")}</span>
                </div>
              )
            }
            <div className="hdp-carousel-overlay">
              <div className="hdp-carousel-badges">
                <span className="hdp-badge-star">{hotel?.starLevel || "—"}{t("detail_star")}</span>
                <span className="hdp-badge-type">{getTypeLabel(hotel?.hotelType, lang)}</span>
              </div>
              <h1 className="hdp-hotel-name">{hotel?.name}</h1>
              <div className="hdp-hotel-addr">
                <MapPin size={13} aria-hidden="true" /> {hotel?.address}
              </div>
            </div>

            {imageCount > 1 && (
              <>
                {[{ dir: -1, label: "‹", cls: "hdp-carousel-nav-left" }, { dir: 1, label: "›", cls: "hdp-carousel-nav-right" }].map(({ dir, label, cls }) => (
                  <button
                    key={cls}
                    aria-label={dir === -1 ? "Ảnh trước" : "Ảnh sau"}
                    onClick={() => setImgIdx((imgIdx + dir + imageCount) % imageCount)}
                    className={`hdp-carousel-nav ${cls}`}
                  >
                    {label}
                  </button>
                ))}
                <div className="hdp-carousel-dots">
                  {images.map((_, i) => (
                    <button
                      key={i}
                      aria-label={`Ảnh ${i + 1}`}
                      onClick={() => setImgIdx(i)}
                      className="hdp-carousel-dot"
                      style={{ background: i === imgIdx ? "#fff" : "rgba(255,255,255,0.4)" }}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Rating summary */}
          <div className="hdp-rating-card">
            <div className="hdp-rating-center">
              <div className="hdp-rating-value">{hotel.rating > 0 ? hotel.rating.toFixed(1) : "—"}</div>
              <Stars n={hotel.rating || 0} />
              <div className="hdp-rating-count">
                {hotel.ratingCount > 0
                  ? `${hotel.ratingCount}${t("rating_count")}`
                  : (hotel.rating > 0 ? ratingLabel(hotel.rating) : t("rating_none"))}
              </div>
            </div>
            <div className="hdp-rating-none">
              {hotel.ratingCount === 0 && t("detail_no_review_msg")}
            </div>
          </div>

          {/* Description */}
          <div className="hdp-card">
            <h2 className="hdp-card-title">{t("detail_about")}</h2>
            <p className="hdp-desc-text">
              {expanded || description.length <= DESC_LIMIT ? description : descShort}
              {!expanded && description.length > DESC_LIMIT && (
                <> <button onClick={() => setExpanded(true)} className="hdp-text-btn">{t("detail_read_more")}</button></>
              )}
            </p>
            {expanded && hotel?.descriptionExtra && (
              <p className="hdp-desc-text" style={{ marginTop: 12 }}>{hotel.descriptionExtra}</p>
            )}
            {expanded && (
              <button onClick={() => setExpanded(false)} className="hdp-text-btn hdp-collapse-btn">
                {t("detail_collapse")}
              </button>
            )}
          </div>

          {/* Amenities */}
          {amenities.length > 0 && (
            <div className="hdp-card">
              <h2 className="hdp-card-title">{t("detail_amenities")}</h2>
              <div className="hdp-amenities-grid">
                {amenities.map(key => {
                  const a = HOTEL_AMENITY_LOOKUP[key];
                  if (!a) return null;
                  const Icon = a.Icon;
                  return (
                    <div key={key} className="hdp-amenity-item">
                      <Icon size={18} color={C.primary} aria-hidden="true" style={{ flexShrink: 0 }} />
                      <span className="hdp-amenity-label">{a.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Chính sách hủy & hoàn tiền */}
          <div className="hdp-card">
            <h2 className="hdp-card-title">{t("cpi_title")}</h2>
            <CancellationPolicyInfo policy={policy} />
          </div>

          {/* Vị trí trên bản đồ */}
          <div style={{ background: "#fff", borderRadius: 12, padding: "20px 24px", marginBottom: 20, boxShadow: "0 1px 6px rgba(0,0,0,0.07)" }}>
            <h2 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700, color: C.dark }}>Vị trí</h2>
            {hotel?.address && (
              <p style={{ margin: "0 0 12px", fontSize: 14, color: "#555", display: "flex", alignItems: "center", gap: 6 }}>
                <MapPin size={15} aria-hidden="true" /> {hotel.address}
              </p>
            )}
            <HotelLocationMap
              latitude={hotel?.latitude}
              longitude={hotel?.longitude}
              name={hotel?.name}
              address={hotel?.address}
            />
          </div>

          {/* Rooms — BY_ROOM only */}
          {!isEntire && (
            <div className="hdp-card">
              <div className="hdp-rooms-header">
                <h2 className="hdp-rooms-title">{t("detail_rooms")}</h2>
                <button onClick={refreshRooms} className="hdp-outline-btn">{t("detail_refresh")}</button>
              </div>

              {loadingRooms ? (
                <div className="hdp-rooms-state">{t("detail_loading_rooms")}</div>
              ) : rooms.length === 0 ? (
                <div className="hdp-rooms-state">{t("detail_no_rooms")}</div>
              ) : (
                <div className="hdp-rooms-grid">
                  {rooms.map(r => {
                    const cartQty = roomCart[r.id]?.quantity || 0;
                    return (
                      <div
                        key={r.id}
                        className="hdp-room-card"
                        style={{
                          border: cartQty > 0 ? `2px solid ${C.primary}` : "2px solid #eee",
                          opacity: r.available ? 1 : 0.55,
                        }}
                      >
                        <div className="hdp-room-thumb" onClick={() => setDetailRoom(r)}>
                          {r.imageUrl
                            ? <img src={r.imageUrl} alt={r.name} className="hdp-room-img" />
                            : <div className="hdp-room-img-ph" />
                          }
                          {r.imageUrls?.length > 1 && (
                            <span className="hdp-room-photo-count">1/{r.imageUrls.length} ảnh</span>
                          )}
                        </div>
                        <div className="hdp-room-body">
                          <div className="hdp-room-body-top">
                            <div className="hdp-room-name">{r.name}</div>
                            <button onClick={() => setDetailRoom(r)} className="hdp-room-detail-btn">Xem chi tiết</button>
                          </div>
                          <div className="hdp-room-meta">
                            <BedDouble size={13} aria-hidden="true" /> {r.beds}{r.size ? ` · ${r.size}` : ""}
                            {r.availableUnits != null && (
                              <span className={r.availableUnits <= 3 ? "hdp-room-avail-low" : "hdp-room-avail-ok"}>
                                · {t("detail_available_units") || "Còn"} {r.availableUnits}
                              </span>
                            )}
                          </div>
                          {r.tags.length > 0 && (
                            <div className="hdp-room-tags">
                              {r.tags.map(tag => (
                                <span key={tag} className="hdp-room-tag">{tag}</span>
                              ))}
                            </div>
                          )}
                          <div className="hdp-room-footer">
                            <div>
                              <div className="hdp-room-price-val">{r.price > 0 ? fmt(r.price) : t("contact")}</div>
                              {r.price > 0 && <div className="hdp-room-price-unit">{t("detail_per_night")}</div>}
                            </div>
                            {!r.available ? (
                              <span className="hdp-room-sold">{t("detail_full")}</span>
                            ) : (
                              <div className="hdp-room-cart">
                                {cartQty > 0 && (
                                  <>
                                    <button onClick={() => removeRoom(r)} className="hdp-room-qty-btn" aria-label="Bớt phòng">−</button>
                                    <span className="hdp-room-qty-val">{cartQty}</span>
                                  </>
                                )}
                                <button
                                  onClick={() => addRoom(r)}
                                  disabled={cartQty >= r.availableUnits}
                                  style={{
                                    background: cartQty >= r.availableUnits ? "#ccc" : C.primary,
                                    color: "#fff", border: "none", borderRadius: 8,
                                    padding: "8px 14px", fontSize: 13, fontWeight: 700,
                                    cursor: cartQty >= r.availableUnits ? "not-allowed" : "pointer",
                                  }}
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

          {/* Reviews */}
          <ReviewSection hotelId={hotel?.id} rating={hotel?.rating} ratingCount={hotel?.ratingCount} />

          {/* Contact */}
          <div className="hdp-contact-strip">
            <span className="hdp-contact-text">{t("detail_help")}</span>
            <button className="hdp-outline-btn">{t("detail_help_btn")}</button>
          </div>
        </div>

        {/* ── RIGHT SIDEBAR ── */}
        <div className="hdp-sidebar">
          <div className="hdp-sidebar-inner">
            <div className="hdp-sidebar-price">
              {totalPrice > 0 ? fmt(totalPrice) : "—"}{" "}
              <span className="hdp-sidebar-nights">{nights} đêm</span>
            </div>
            <div className="hdp-sidebar-subtitle">
              {isEntire
                ? (t("detail_entire_title") || "Thuê nguyên căn")
                : cartItems.length > 0
                  ? `${cartItems.length} loại phòng, ${cartItems.reduce((s, { quantity }) => s + quantity, 0)} phòng`
                  : (t("detail_select_room") || "Chưa chọn phòng")}
            </div>

            <h3 className="hdp-sidebar-trip-title">{t("detail_your_trip")}</h3>

            {/* Dates */}
            <div className="hdp-date-grid">
              <div>
                <label className="hdp-field-label">{t("detail_checkin")}</label>
                <input
                  type="date"
                  value={checkin}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={e => {
                    setCheckin(e.target.value);
                    if (checkout && checkout <= e.target.value) setCheckout("");
                  }}
                  className="hdp-date-input"
                />
              </div>
              <div>
                <label className="hdp-field-label">{t("detail_checkout")}</label>
                <input
                  type="date"
                  value={checkout}
                  min={checkin || new Date().toISOString().slice(0, 10)}
                  onChange={e => setCheckout(e.target.value)}
                  className="hdp-date-input"
                />
              </div>
            </div>

            {/* Guests stepper */}
            <div className="hdp-guests-wrap">
              <label className="hdp-field-label">{t("detail_guests")}</label>
              <div className="hdp-guests-stepper">
                <button
                  onClick={() => setGuests(Math.max(1, guests - 1))}
                  disabled={guests <= 1}
                  className="hdp-guests-btn"
                  aria-label="Giảm khách"
                >−</button>
                <div className="hdp-guests-value">{guests}{t("guests")}</div>
                <button
                  onClick={() => setGuests(Math.min(maxGuests, guests + 1))}
                  disabled={guests >= maxGuests}
                  className="hdp-guests-btn"
                  aria-label="Tăng khách"
                >+</button>
              </div>
            </div>

            {/* Capacity banner — BY_ROOM, chỉ khi đã chọn phòng */}
            {!isEntire && cartItems.length > 0 && (() => {
              if (capacityDiff < 0) return (
                <div className="hdp-cap-banner hdp-cap-banner--warn">
                  <span className="hdp-cap-icon">⚠️</span>
                  <div>Bạn vẫn cần chỗ cho <strong>{Math.abs(capacityDiff)} người lớn</strong> nữa.</div>
                </div>
              );
              if (capacityDiff === 0) return (
                <div className="hdp-cap-banner hdp-cap-banner--ok">
                  <CheckCircle2 size={18} color="#16a34a" style={{ flexShrink: 0 }} aria-hidden="true" />
                  <div>Đủ chỗ cho tất cả <strong>{guests} khách</strong>.</div>
                </div>
              );
              return (
                <div className="hdp-cap-banner hdp-cap-banner--info">
                  <span className="hdp-cap-icon">ℹ️</span>
                  <div>Phòng bạn chọn có thể chứa thêm <strong>{capacityDiff} người</strong> so với nhu cầu.</div>
                </div>
              );
            })()}

            {/* Price breakdown */}
            {totalPrice > 0 && (
              <div className="hdp-breakdown">
                {isEntire ? (
                  <div className="hdp-breakdown-row">
                    <span>{fmt(entireRoom?.price || 0)} × {nights} đêm</span>
                    <span>{fmt(totalPrice)}</span>
                  </div>
                ) : cartItems.map(({ room: r, quantity }) => (
                  <div key={r.id} className="hdp-breakdown-row">
                    <span className="hdp-breakdown-row-name">{r.name} × {quantity}</span>
                    <span style={{ flexShrink: 0 }}>{fmt(r.price * quantity * nights)}</span>
                  </div>
                ))}
                <div className="hdp-breakdown-row" style={{ marginTop: 4 }}>
                  <span>{t("detail_tax")}</span>
                  <span>{fmt(tax)}</span>
                </div>
                <div className="hdp-breakdown-total">
                  <span>{t("detail_total")}</span>
                  <span className="hdp-breakdown-total-val">{fmt(totalPrice + tax)}</span>
                </div>
              </div>
            )}

            {/* Book button */}
            <button
              disabled={!canBook}
              className="hdp-book-btn"
              onClick={() => {
                const bookingRooms = isEntire
                  ? [{ id: entireRoom.id, name: entireRoom.name, price: entireRoom.price, quantity: 1, capacity: entireRoom.capacity }]
                  : cartItems.map(({ room: r, quantity }) => ({ id: r.id, name: r.name, price: r.price, quantity, capacity: r.capacity }));
                const bp = {
                  hotelId: hotel?.id, hotelName: hotel?.name,
                  rooms: bookingRooms, checkin, checkout, guests, nights,
                  cancellationPolicy: hotel?.cancellationPolicy || "MODERATE",
                };
                if (user) navigate("booking", bp);
                else if (requireAuth) requireAuth("booking", bp);
                else navigate("login");
              }}
            >
              {isEntire ? (t("detail_book_entire") || "Đặt nguyên căn") : t("detail_confirm_btn")}
            </button>

            {/* Cancellation policy */}
            <div
              className="hdp-policy-badge"
              style={{ background: policyCfg.bg, border: `1px solid ${policyCfg.border}` }}
            >
              <PolicyIcon size={16} color={policyCfg.color} style={{ flexShrink: 0 }} aria-hidden="true" />
              <span className="hdp-policy-label" style={{ color: policyCfg.color }}>{policyCfg.label}</span>
            </div>
          </div>
        </div>
      </div>

      <Footer navigate={navigate} />

      {/* Room detail modal */}
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
