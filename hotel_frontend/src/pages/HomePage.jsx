import { useState, useEffect, useMemo } from "react";
import { C } from "../components/auth/AuthShared";
import MainNavbar from "../components/MainNavbar";
import Footer from "../components/Footer";
import { useHotelLocations, useHotelSearch, useDestinationCounts } from "../hooks/useHotelQueries";
import { SkeletonCard } from "../components/ui/Skeleton";
import { useLang } from "../contexts/LanguageContext";
import {
  IMG_HERO,
  IMG_HOTELS,
  IMG_DESTINATIONS,
  IMG_PROPERTY_TYPES,
} from "../assets/images/index.js";
import ProvinceCombobox from "../components/ui/ProvinceCombobox";
import { useVietnamProvinces, useVietnamDistricts } from "../hooks/useVietnamAdmin";
import { stripProvincePrefix, nfc } from "../services/vnAdminService";
import "../styles/pages/customer/HomePage.css";

const PLACEHOLDER_BG = "repeating-conic-gradient(#ccc 0% 25%,#e8e8e8 0% 50%) 0 0/20px 20px";
const DESTINATION_CARDS = [
  { id: "da-nang",   name: "Đà Nẵng",   searchKey: "Đà Nẵng",   image: IMG_DESTINATIONS.DA_NANG   },
  { id: "nha-trang", name: "Nha Trang", searchKey: "Nha Trang", image: IMG_DESTINATIONS.NHA_TRANG },
  { id: "hue",       name: "Huế",       searchKey: "Huế",       image: IMG_DESTINATIONS.HUE       },
  { id: "ninh-binh", name: "Ninh Bình", searchKey: "Ninh Bình", image: IMG_DESTINATIONS.NINH_BINH },
  { id: "can-tho",   name: "Cần Thơ",   searchKey: "Cần Thơ",   image: IMG_DESTINATIONS.CAN_THO   },
  { id: "phu-quoc",  name: "Phú Quốc",  searchKey: "Phú Quốc",  image: IMG_DESTINATIONS.PHU_QUOC  },
];
const DEFAULT_DESTINATIONS = DESTINATION_CARDS;
const PROPERTY_TYPE_CARDS = [
  { id: "HOTEL",     image: IMG_PROPERTY_TYPES.HOTEL     },
  { id: "APARTMENT", image: IMG_PROPERTY_TYPES.APARTMENT },
  { id: "RESORT",    image: IMG_PROPERTY_TYPES.RESORT    },
  { id: "VILLA",     image: IMG_PROPERTY_TYPES.VILLA     },
  { id: "HOMESTAY",  image: IMG_PROPERTY_TYPES.HOMESTAY  },
  { id: "HOSTEL",    image: IMG_PROPERTY_TYPES.HOSTEL    },
];
const PROP_TYPE_KEY = {
  HOTEL: "prop_hotel", APARTMENT: "prop_apartment", RESORT: "prop_resort",
  VILLA: "prop_villa", HOMESTAY: "prop_homestay", HOSTEL: "prop_hostel",
};

// ── SVG icon set ──────────────────────────────────────────────────────
const PATHS = {
  pin:      "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
  map:      "M20.5 3l-.16.03L15 5.1 9 3 3.36 4.9c-.21.07-.36.25-.36.48V20.5c0 .28.22.5.5.5l.16-.03L9 18.9l6 2.1 5.64-1.9c.21-.07.36-.25.36-.48V3.5c0-.28-.22-.5-.5-.5zM15 19l-6-2.11V5l6 2.11V19z",
  calendar: "M19 3h-1V1h-2v2H8V1H6v2H5C3.9 4 3 4.9 3 6v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v10zm0-12H5V6h14v1zm-7 4H7v5h5v-5z",
  people:   "M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13zm8 0c-.29 0-.62.02-.97.05C16.19 13.84 17 15 17 16.5V19h6v-2.5C23 14.17 18.33 13 16 13z",
  bed:      "M7 13c1.66 0 3-1.34 3-3S8.66 7 7 7 4 8.34 4 10s1.34 3 3 3zm12-6h-8v7H3V5H1v15h2v-3h18v3h2v-9c0-2.21-1.79-4-4-4z",
  search:   "M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z",
  arrow:    "M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z",
};

function Ic({ k, size = 14, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={{ flexShrink: 0, display: "block" }}>
      <path d={PATHS[k]} />
    </svg>
  );
}
// ─────────────────────────────────────────────────────────────────────

function ImgBox({ src, alt = "", h, style = {} }) {
  const [err, setErr] = useState(false);
  if (src && !err) {
    return <img src={src} alt={alt} onError={() => setErr(true)} style={{ width: "100%", height: h || "100%", objectFit: "cover", display: "block", ...style }} />;
  }
  return <div style={{ width: "100%", height: h || "100%", background: PLACEHOLDER_BG, ...style }} />;
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function defaultStayParams(params = {}) {
  const checkInDate = new Date();
  checkInDate.setDate(checkInDate.getDate() + 1);
  const checkOutDate = new Date();
  checkOutDate.setDate(checkOutDate.getDate() + 2);
  return {
    ...params,
    checkIn: params.checkIn || isoDate(checkInDate),
    checkOut: params.checkOut || isoDate(checkOutDate),
    guests: params.guests || 2,
    rooms: params.rooms || 1,
  };
}

const Field = ({ iconKey, label, children, flex }) => (
  <div className="customer-homepage-field" style={flex ? { flex } : undefined}>
    <div className="customer-homepage-field-label">
      <Ic k={iconKey} size={12} color="#BE1E2E" />
      {label}
    </div>
    {children}
  </div>
);

function SearchBar({ initial = {}, onSearch }) {
  const { t } = useLang();
  const { data: fetchedLocations } = useHotelLocations();
  const { data: adminProvinces } = useVietnamProvinces();

  const [q, setQ] = useState({
    province: initial.province || "",
    district: initial.district || "",
    checkIn:  initial.checkIn  || "",
    checkOut: initial.checkOut || "",
    guests:   initial.guests   || "",
    rooms:    initial.rooms    || "",
    hotelTypes: initial.hotelTypes || "",
  });
  const [provinceErr, setProvinceErr] = useState(false);
  const [searchErr, setSearchErr] = useState("");

  // Province code — set by combobox on select, or derived from admin list for URL-prefilled province
  const [selectedProvinceCode, setSelectedProvinceCode] = useState(null);
  const effectiveProvinceCode = useMemo(() => {
    if (selectedProvinceCode) return selectedProvinceCode;
    if (!q.province || !adminProvinces) return null;
    const match = adminProvinces.find(
      (p) => stripProvincePrefix(p.name) === nfc(q.province) || nfc(p.name) === nfc(q.province)
    );
    return match?.code ?? null;
  }, [selectedProvinceCode, q.province, adminProvinces]);
  // Districts from hotel backend — try both stripped and full province names
  const hotelLocation = useMemo(
    () => fetchedLocations?.find((l) => {
      const lNorm = nfc(l.province);
      const qNorm = nfc(q.province);
      return lNorm === qNorm || stripProvincePrefix(lNorm) === qNorm;
    }),
    [fetchedLocations, q.province]
  );
  const hotelDistricts = hotelLocation?.districts || [];

  // Always fetch complete district list from admin API for the selected province
  const { data: adminDistrictData, isLoading: adminDistrictLoading } = useVietnamDistricts(effectiveProvinceCode);
  const adminDistricts = useMemo(
    () => (adminDistrictData || []).map((d) => d.name),
    [adminDistrictData]
  );

  // Admin districts are primary (complete list); fall back to hotel districts before admin loads
  const districtOptions = adminDistricts.length > 0 ? adminDistricts : hotelDistricts;
  const districtLoading = q.province && effectiveProvinceCode != null && adminDistrictLoading;
  const visibleDistrictOptions = q.district && !districtOptions.includes(q.district)
    ? [q.district, ...districtOptions]
    : districtOptions;

  // Reset province code whenever initial props change (e.g. user navigates back with different URL)
  useEffect(() => {
    setSelectedProvinceCode(null);
    setQ({
      province: initial.province || "",
      district: initial.district || "",
      checkIn:  initial.checkIn  || "",
      checkOut: initial.checkOut || "",
      guests:   initial.guests   || "",
      rooms:    initial.rooms    || "",
      hotelTypes: initial.hotelTypes || "",
    });
    setProvinceErr(false);
    setSearchErr("");
  }, [
    initial.province,
    initial.district,
    initial.checkIn,
    initial.checkOut,
    initial.guests,
    initial.rooms,
    initial.hotelTypes,
  ]);

  const upd = k => e => {
    if (k === "province") setProvinceErr(false);
    setSearchErr("");
    setQ(p => ({ ...p, [k]: e.target.value }));
  };
  const clearAll = () => {
    setProvinceErr(false);
    setSearchErr("");
    setSelectedProvinceCode(null);
    setQ({ province: "", district: "", checkIn: "", checkOut: "", guests: "", rooms: "", hotelTypes: "" });
  };
  const hasData = !!(q.province || q.district || q.checkIn || q.checkOut || q.guests || q.rooms || q.hotelTypes);
  const handleSearch = () => {
    const province = q.province.trim();
    if (!province) {
      setProvinceErr(true);
      setSearchErr("");
      return;
    }
    if ((q.checkIn && !q.checkOut) || (!q.checkIn && q.checkOut)) {
      setProvinceErr(false);
      setSearchErr(t("search_err_dates"));
      return;
    }
    if (q.checkIn && q.checkOut && q.checkOut <= q.checkIn) {
      setProvinceErr(false);
      setSearchErr(t("search_err_checkout"));
      return;
    }
    setProvinceErr(false);
    setSearchErr("");
    onSearch({ ...q, province, guests: Number(q.guests) || 2, rooms: Number(q.rooms) || 1 });
  };

  return (
    <div className="customer-homepage-searchbar-wrap">
      <div className={`customer-homepage-searchbar${provinceErr || searchErr ? " has-error" : ""}`}>
        <Field iconKey="pin" label={t("search_province")}>
          <ProvinceCombobox
            value={q.province}
            onChange={({ name, code }) => {
              setProvinceErr(false);
              setSearchErr("");
              setSelectedProvinceCode(code);
              setQ((p) => ({ ...p, province: name, district: "" }));
            }}
            hotelLocations={fetchedLocations || []}
            placeholder={t("search_prov_ph")}
          />
        </Field>
        <Field iconKey="map" label={t("search_district")}>
          <select
            className="customer-homepage-field-input customer-homepage-field-select"
            value={q.district}
            onChange={upd("district")}
            disabled={!q.province || districtLoading || (visibleDistrictOptions.length === 0)}
          >
            <option value="">{districtLoading ? "Đang tải quận/huyện..." : t("search_dist_ph")}</option>
            {visibleDistrictOptions.map((district) => (
              <option key={district} value={district}>{district}</option>
            ))}
          </select>
        </Field>
        <Field iconKey="calendar" label={t("search_checkin")}>
          <input className="customer-homepage-field-input" type="date" value={q.checkIn} onChange={upd("checkIn")} />
        </Field>
        <Field iconKey="calendar" label={t("search_checkout")}>
          <input className="customer-homepage-field-input" type="date" value={q.checkOut} onChange={upd("checkOut")} />
        </Field>
        <Field iconKey="people" label={t("search_guests")} flex="0 0 120px">
          <input className="customer-homepage-field-input" type="number" min="1" placeholder={t("search_guests_ph")} value={q.guests} onChange={upd("guests")} />
        </Field>
        <Field iconKey="bed" label={t("search_rooms")} flex="0 0 120px">
          <input className="customer-homepage-field-input" type="number" min="1" placeholder={t("search_rooms_ph")} value={q.rooms} onChange={upd("rooms")} />
        </Field>
        {hasData && (
          <button onClick={clearAll} title={t("search_btn")} className="customer-homepage-clear-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        )}
        <div className="customer-homepage-searchbar-divider" />
        <button className="customer-homepage-search-btn" onClick={handleSearch}>
          <Ic k="search" size={15} color="#fff" />
          {t("search_btn")}
        </button>
      </div>
      {(provinceErr || searchErr) && (
        <div className="customer-homepage-error-tip">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="#BE1E2E"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
          {searchErr || t("search_err_province")}
        </div>
      )}
    </div>
  );
}

function HotelCard({ hotel, onView, imgUrl }) {
  const { t } = useLang();
  const ratingText = hotel.rating > 0 ? hotel.rating.toFixed(1) : t("rating_new");

  return (
    <div className="customer-homepage-hotel-card" onClick={onView}>
      <div className="customer-homepage-hotel-card-media">
        <ImgBox src={imgUrl} alt={hotel.name} h={220} />
        <button className="customer-homepage-favorite-btn" type="button" aria-label="Lưu chỗ nghỉ" onClick={(e) => e.stopPropagation()}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.8 4.6c-1.6-1.5-4.1-1.5-5.7 0L12 7.7 8.9 4.6c-1.6-1.5-4.1-1.5-5.7 0-1.7 1.6-1.7 4.3 0 5.9L12 19l8.8-8.5c1.7-1.6 1.7-4.3 0-5.9z" />
          </svg>
        </button>
      </div>
      <div className="customer-homepage-hotel-card-body">
        <span className="customer-homepage-hotel-card-badge">{t("card_badge")}</span>
        <h3 className="customer-homepage-hotel-card-name">{hotel.name}</h3>
        <div className="customer-homepage-hotel-card-location">
          <Ic k="pin" size={12} color="#aaa" />
          {hotel.address}
        </div>
        <div className="customer-homepage-hotel-card-rating-row">
          <span className="customer-homepage-hotel-card-rating">{ratingText}</span>
          <span className="customer-homepage-hotel-card-rating-copy">
            {hotel.rating > 0 ? t("card_rated") : t("card_new")}
          </span>
        </div>
        {hotel.availableUnits > 0 && (
          <div className="customer-homepage-hotel-card-availability">
            <Ic k="bed" size={12} color="#047857" />
            {hotel.availableUnits}{t("card_rooms")}
          </div>
        )}
        <div className="customer-homepage-hotel-card-footer">
          {hotel.price > 0
            ? <div className="customer-homepage-hotel-card-price-wrap">
                <span className="customer-homepage-hotel-card-price-label">{t("card_from")}</span>
                <span className="customer-homepage-hotel-card-price">
                  {hotel.price.toLocaleString("vi-VN")} ₫
                  <span className="customer-homepage-hotel-card-price-unit">{t("card_per_night")}</span>
                </span>
              </div>
            : <span className="customer-homepage-hotel-card-no-price">{t("card_no_price")}</span>}
          <span className="customer-homepage-hotel-card-arrow-box">
            <Ic k="arrow" size={16} color={C.primary} />
          </span>
        </div>
      </div>
    </div>
  );
}

function DestinationCard({ item, onNavigate }) {
  const { t } = useLang();
  return (
    <button className="customer-homepage-destination-card" type="button" onClick={onNavigate}>
      <ImgBox src={item.image} alt={item.name} h={150} />
      <span className="customer-homepage-destination-name">{item.name}</span>
      <span className="customer-homepage-destination-desc">
        {item.count > 0 ? `${item.count} ${t("stays")}` : t("card_explore")}
      </span>
    </button>
  );
}

function PropertyTypeCard({ item, onNavigate }) {
  const { t } = useLang();
  return (
    <button className="customer-homepage-property-card" type="button" onClick={onNavigate}>
      <ImgBox src={item.image} alt={item.id} h={190} />
      <span className="customer-homepage-property-name">{t(PROP_TYPE_KEY[item.id])}</span>
    </button>
  );
}

export default function HomePage({ navigate, user, onLogout }) {
  const { t } = useLang();
  const [searchQuery, setSearchQuery] = useState(() => {
    try {
      const saved = sessionStorage.getItem("homeSearch");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const { data: searchResult, isLoading: loadingHotels } = useHotelSearch(
    { size: 8, sort: "recommended" }
  );
  const hotels = searchResult?.hotels?.slice(0, 8) ?? [];

  const destinationResults = useDestinationCounts(DESTINATION_CARDS);
  const destinations = destinationResults.every((r) => r.data)
    ? destinationResults.map((r) => r.data)
    : DEFAULT_DESTINATIONS;

  const handleSearch = (q) => {
    setSearchQuery(q);
    sessionStorage.setItem("homeSearch", JSON.stringify(q));
    navigate("hotels", q);
  };

  const startSearchFromPreset = (preset = {}) => {
    const next = {
      province: "",
      district: "",
      checkIn: "",
      checkOut: "",
      guests: "",
      rooms: "",
      hotelTypes: "",
      ...preset,
    };
    setSearchQuery(next);
    sessionStorage.setItem("homeSearch", JSON.stringify(next));
    navigate("hotels", { ...next, sort: "recommended" });
  };

  return (
    <div className="customer-homepage">
      <MainNavbar active="home" navigate={navigate} user={user} onLogout={onLogout} />

      {/* ── Hero ── */}
      <div className="customer-homepage-hero">
        <ImgBox src={IMG_HERO} alt="hero" h={480} />
        <div className="customer-homepage-hero-overlay" />

        <div className="customer-homepage-hero-content">
          <h1 className="customer-homepage-hero-title" style={{ whiteSpace: "pre-line" }}>
            {t("hero_title")}
          </h1>
          <p className="customer-homepage-hero-subtitle">
            {t("hero_subtitle")}
          </p>
        </div>

        <div className="customer-homepage-searchbar-anchor">
          <SearchBar initial={searchQuery || {}} onSearch={handleSearch} />
        </div>
      </div>

      <>
          {/* ── Featured Hotels ── */}
          <div className="customer-homepage-section">
            <p className="customer-homepage-section-eyebrow">{t("section_featured_eyebrow")}</p>
            <div className="customer-homepage-section-header">
              <div>
                <h2 className="customer-homepage-section-title">{t("section_featured_title")}</h2>
                <p className="customer-homepage-section-desc">{t("section_featured_desc")}</p>
              </div>
              <a className="customer-homepage-view-all" onClick={() => startSearchFromPreset({})}>
                {t("view_all")} <Ic k="arrow" size={14} color={C.primary} />
              </a>
            </div>
            <div className="customer-homepage-hotels-row">
              {loadingHotels
                ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
                : hotels.map((h, i) => (
                    <HotelCard
                      key={h.id}
                      hotel={h}
                      imgUrl={h.imageUrl || IMG_HOTELS[i] || ""}
                      onView={() => navigate("hotel", { hotelId: h.id, ...defaultStayParams(searchQuery || {}) })}
                    />
                  ))
              }
              <div className="customer-homepage-more-card" onClick={() => startSearchFromPreset({})} title="Xem tất cả khách sạn">
                <Ic k="arrow" size={22} color={C.primary} />
              </div>
            </div>
          </div>

          {/* ── Trending Destinations ── */}
          <div className="customer-homepage-section customer-homepage-discovery-section">
            <div className="customer-homepage-section-header">
              <div>
                <h2 className="customer-homepage-section-title">{t("section_dest_title")}</h2>
                <p className="customer-homepage-section-desc">{t("section_dest_desc")}</p>
              </div>
            </div>
            <div className="customer-homepage-destination-row">
              {destinations.map((d) => (
                <DestinationCard
                  key={d.id}
                  item={d}
                  onNavigate={() => startSearchFromPreset({ province: d.searchKey })}
                />
              ))}
            </div>
          </div>

          <div className="customer-homepage-section customer-homepage-type-section">
            <div className="customer-homepage-section-header">
              <div>
                <h2 className="customer-homepage-section-title">{t("section_types_title")}</h2>
                <p className="customer-homepage-section-desc">{t("section_types_desc")}</p>
              </div>
            </div>
            <div className="customer-homepage-property-row">
              {PROPERTY_TYPE_CARDS.map((item) => (
                <PropertyTypeCard
                  key={item.id}
                  item={item}
                  onNavigate={() => startSearchFromPreset({ hotelTypes: item.id })}
                />
              ))}
            </div>
          </div>
      </>

      <Footer />
    </div>
  );
}
