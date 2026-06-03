import { useState, useEffect, useRef } from "react";
import { C } from "../../lib/constants";
import { useHotelSearch } from "../../hooks/useHotelQueries";
import { useLang } from "../../contexts/LanguageContext";
import { Building2, Zap, ShieldCheck, MapPin, CalendarDays, User, BedDouble } from "lucide-react";
import "./HotelSearchResults.css";

function Img({ src, alt = "", h = 160, r = 0 }) {
  const [failed, setFailed] = useState(false);

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={alt}
        onError={() => setFailed(true)}
        style={{ width: "100%", height: h, flexShrink: 0, borderRadius: r, objectFit: "cover", display: "block" }}
      />
    );
  }

  return <div style={{ width: "100%", height: h, flexShrink: 0, borderRadius: r, background: "repeating-conic-gradient(#ccc 0% 25%,#e8e8e8 0% 50%) 0 0/20px 20px" }} />;
}

// ── SVG icons cho bộ lọc ─────────────────────────────────────────────
const FIC = {
  pin:     "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
  hotel:   "M7 13c1.66 0 3-1.34 3-3S8.66 7 7 7s-3 1.34-3 3 1.34 3 3 3zm12-6h-8v7H3V5H1v15h2v-3h18v3h2v-9c0-2.21-1.79-4-4-4z",
  star:    "M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z",
  layers:  "M11.99 18.54l-7.37-5.73L3 14.07l9 7 9-7-1.63-1.27-7.38 5.74zM12 16l7.36-5.73L21 9l-9-7-9 7 1.63 1.27L12 16z",
  wifi:    "M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4 2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z",
  access:  "M12 2c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm9 7h-6v13h-2v-6h-2v6H9V9H3V7h18v2z",
  wallet:  "M21 18v1c0 1.1-.9 2-2 2H5c-1.11 0-2-.9-2-2V5c0-1.1.89-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.11 0-2 .9-2 2v8c0 1.1.89 2 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z",
  check:   "M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z",
};
function FIcon({ k, size = 14, color = C.primary }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={{ flexShrink: 0 }}>
      <path d={FIC[k]} />
    </svg>
  );
}

const HOTEL_TYPE_OPTIONS = [
  { value: "HOTEL",     tkey: "hotel_type_hotel"     },
  { value: "APARTMENT", tkey: "hotel_type_apartment" },
  { value: "RESORT",    tkey: "hotel_type_resort"    },
  { value: "VILLA",     tkey: "hotel_type_villa"     },
  { value: "HOMESTAY",  tkey: "hotel_type_homestay"  },
  { value: "HOSTEL",    tkey: "hotel_type_hostel"    },
];

const ROOM_CATEGORY_OPTIONS = [
  { value: "STANDARD", tkey: "room_cat_standard" },
  { value: "DELUXE",   tkey: "room_cat_deluxe"   },
  { value: "SUITE",    tkey: "room_cat_suite"     },
  { value: "FAMILY",   tkey: "room_cat_family"    },
];

const AMENITY_FILTER_OPTIONS = [
  { value: "WIFI",       tkey: "amenity_wifi",       target: "hotelAmenities" },
  { value: "POOL",       tkey: "amenity_pool",       target: "hotelAmenities" },
  { value: "PARKING",    tkey: "amenity_parking",    target: "hotelAmenities" },
  { value: "SPA",        tkey: "amenity_spa",        target: "hotelAmenities" },
  { value: "RESTAURANT", tkey: "amenity_restaurant", target: "hotelAmenities" },
  { value: "MINI_BAR",   tkey: "amenity_minibar",    target: "roomAmenities"  },
  { value: "SEA_VIEW",   tkey: "amenity_seaview",    target: "roomAmenities"  },
  { value: "BREAKFAST",  tkey: "amenity_breakfast",  target: "roomAmenities"  },
];

function FilterOption({ label, checked, onClick, isRadio }) {
  const [hov, setHov] = useState(false);
  const active = checked;
  const bg    = active ? C.primary : hov ? "#fde8eb" : "#F7F7F7";
  const color = active ? "#fff"    : hov ? C.primary  : "#555";
  const border= active ? C.primary : hov ? C.primary  : "#e8e8e8";
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "7px 12px", borderRadius: 8, marginBottom: 6,
        background: bg, color, border: `1.5px solid ${border}`,
        fontSize: 13, fontWeight: active ? 600 : 400,
        cursor: "pointer", userSelect: "none",
        transition: "background 0.15s ease, color 0.15s ease, border-color 0.15s ease",
      }}
    >
      <div style={{
        width: 14, height: 14, borderRadius: isRadio ? "50%" : 3,
        border: `2px solid ${active ? "#fff" : color}`,
        background: active ? "#fff" : "transparent",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0, transition: "border-color 0.15s ease",
      }}>
        {active && (
          isRadio
            ? <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.primary }} />
            : <FIcon k="check" size={9} color={C.primary} />
        )}
      </div>
      {label}
    </div>
  );
}

function FilterSidebar({ filters, onChange, onApply }) {
  const { t } = useLang();

  const Section = ({ iconKey, title, children }) => (
    <div style={{ marginBottom: 18, paddingBottom: 18, borderBottom: "1px solid #f5f5f5" }}>
      <p style={{ fontSize: 12, fontWeight: 700, color: "#1a1a1a", marginBottom: 10, display: "flex", alignItems: "center", gap: 7, textTransform: "uppercase", letterSpacing: 0.8 }}>
        <FIcon k={iconKey} size={14} color={C.primary} />
        {title}
      </p>
      {children}
    </div>
  );

  const [showMoreAmenities, setShowMoreAmenities] = useState(false);
  const toggleEnumList = (key, value) => {
    const list = filters[key] || [];
    onChange({ ...filters, [key]: list.includes(value) ? list.filter((item) => item !== value) : [...list, value] });
  };

  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: "20px 16px", border: "1.5px solid #edd8da", position: "sticky", top: 20 }}>
      <h3 style={{ fontSize: 14, fontWeight: 800, color: "#1a1a1a", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
        <FIcon k="pin" size={16} color={C.primary} />
        {t("filter_title")}
      </h3>

      <Section iconKey="hotel" title={t("filter_hotel_type")}>
        {HOTEL_TYPE_OPTIONS.map((option) => (
          <FilterOption key={option.value} label={t(option.tkey)} isRadio
            checked={filters.hotelTypes === option.value}
            onClick={() => onChange({ ...filters, hotelTypes: filters.hotelTypes === option.value ? "" : option.value })} />
        ))}
      </Section>

      <Section iconKey="star" title={t("filter_rating")}>
        {[5, 4, 3, 2, 1].map(s => (
          <FilterOption key={s} label={`${s}${t("filter_rating_suffix")}`} isRadio
            checked={filters.stars === s}
            onClick={() => onChange({ ...filters, stars: filters.stars === s ? null : s })} />
        ))}
      </Section>

      <Section iconKey="layers" title={t("filter_room_cat")}>
        {ROOM_CATEGORY_OPTIONS.map((option) => (
          <FilterOption key={option.value} label={t(option.tkey)} isRadio
            checked={filters.roomCategories === option.value}
            onClick={() => onChange({ ...filters, roomCategories: filters.roomCategories === option.value ? "" : option.value })} />
        ))}
      </Section>

      <Section iconKey="wifi" title={t("filter_amenities")}>
        {(showMoreAmenities ? AMENITY_FILTER_OPTIONS : AMENITY_FILTER_OPTIONS.slice(0, 5)).map((option) => (
          <FilterOption key={`${option.target}-${option.value}`} label={t(option.tkey)}
            checked={(filters[option.target] || []).includes(option.value)}
            onClick={() => toggleEnumList(option.target, option.value)} />
        ))}
        <a style={{ fontSize: 12, color: C.primary, cursor: "pointer", fontWeight: 600 }}
          onClick={() => setShowMoreAmenities(p => !p)}>
          {showMoreAmenities ? t("filter_show_less") : t("filter_show_more")}
        </a>
      </Section>

      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: "#1a1a1a", marginBottom: 8, display: "flex", alignItems: "center", gap: 7, textTransform: "uppercase", letterSpacing: 0.8 }}>
          <FIcon k="wallet" size={14} color={C.primary} />
          {t("filter_budget")}
        </p>
        <input type="range" min="1000000" max="10000000" step="100000"
          value={filters.priceMax || 10000000}
          onChange={e => onChange({ ...filters, priceMax: +e.target.value })}
          style={{ width: "100%", accentColor: C.primary }} />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#777", marginTop: 4 }}>
          <span>1.000.000đ</span>
          <span style={{ fontWeight: 600, color: C.primary }}>{(filters.priceMax || 10000000).toLocaleString("vi-VN")}đ</span>
        </div>
      </div>

      <button onClick={onApply}
        style={{ width: "100%", padding: "11px", background: C.primary, color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
        {t("filter_apply")}
      </button>
    </div>
  );
}

function HotelResultCard({ hotel, onView }) {
  const { t } = useLang();
  return (
    <div
      className="hsr-result-card"
      style={{
        background: "#fff", borderRadius: 24, display: "flex", border: "1px solid #f1f5f9",
        overflow: "hidden", marginBottom: 20, boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
        transition: "all 0.3s ease", cursor: "pointer"
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 12px 24px rgba(0,0,0,0.08)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.03)"; }}
      onClick={onView}
    >
      <div className="hsr-result-card-image" style={{ flex: "0 0 260px", position: "relative" }}>
        <Img src={hotel.imageUrl} alt={hotel.name} h={240} />
        <div style={{ position: "absolute", top: 12, left: 12, background: "rgba(255,255,255,0.9)", backdropFilter: "blur(4px)", padding: "4px 10px", borderRadius: 100, fontSize: 12, fontWeight: 800, color: "#1e293b", display: "flex", alignItems: "center", gap: 4 }}>
           <span style={{ color: "#f59e0b" }}>★</span> {hotel.rating?.toFixed(1) || "5.0"}
        </div>
      </div>
      <div className="hsr-result-card-body" style={{ flex: 1, padding: "24px 32px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
            <h3 style={{ fontSize: 20, fontWeight: 900, color: "#1e293b", margin: 0 }}>{hotel.name}</h3>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#94a3b8" }}>{hotel.hotelType || "Khách sạn"}</div>
          </div>
          <p style={{ fontSize: 14, color: "#64748b", marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}>
            <FIcon k="pin" size={14} color="#94a3b8" /> {hotel.address}
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {hotel.amenities.slice(0, 3).map(a => (
              <span key={a} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 600, color: "#475569" }}>{a}</span>
            ))}
          </div>
        </div>
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 24 }}>
          <div>
            <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600, marginBottom: 2 }}>{t("price_label")}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: C.primary }}>
               {hotel.price > 0 ? hotel.price.toLocaleString("vi-VN") : "1.250.000"} ₫
               <span style={{ fontSize: 13, fontWeight: 500, color: "#94a3b8", marginLeft: 4 }}>{t("detail_per_night")}</span>
            </div>
          </div>
          <button
            style={{
              background: C.primary, color: "#fff", border: "none", borderRadius: 14,
              display: "flex", alignItems: "center", gap: 10,
              padding: "12px 28px", fontSize: 14, fontWeight: 800, cursor: "pointer",
              boxShadow: `0 8px 16px ${C.primary}33`, transition: "all 0.2s"
            }}
            onClick={(e) => { e.stopPropagation(); onView(); }}
            onMouseEnter={e => e.currentTarget.style.transform = "scale(1.02)"}
            onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
          >{t("view_detail")}</button>
        </div>
      </div>
    </div>
  );
}

function Pagination({ page, totalPages, onPage }) {
  function buildPages(cur, tot) {
    if (tot <= 7) return Array.from({ length: tot }, (_, i) => i + 1);
    if (cur <= 4) return [1, 2, 3, 4, 5, "...", tot];
    if (cur >= tot - 3) return [1, "...", tot - 4, tot - 3, tot - 2, tot - 1, tot];
    return [1, "...", cur - 1, cur, cur + 1, "...", tot];
  }
  const pages = totalPages > 1 ? buildPages(page, totalPages) : [1];
  return (
    <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 24 }}>
      {pages.map((p, i) => (
        <button key={i}
          style={{ width: 36, height: 36, borderRadius: 8, border: "1.5px solid", borderColor: p === page ? C.primary : "#edd8da", background: p === page ? C.primary : "#fff", color: p === page ? "#fff" : "#555", fontWeight: 700, fontSize: 13, cursor: p === "..." ? "default" : "pointer" }}
          onClick={() => typeof p === "number" && onPage(p)}
        >{p}</button>
      ))}
    </div>
  );
}

function FeaturedBanner() {
  const { t } = useLang();
  return (
    <div className="hsr-featured-banner" style={{
      borderRadius: 20, marginBottom: 20, overflow: "hidden", position: "relative",
      background: "linear-gradient(120deg, #BE1E2E 0%, #7a0d1a 50%, #3d0009 100%)",
      padding: "36px 40px",
      boxShadow: "0 12px 40px rgba(190,30,46,0.30)",
    }}>
      <div style={{ position: "absolute", top: -40, right: -40, width: 200, height: 200, borderRadius: "50%", background: "rgba(255,255,255,0.04)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: -60, right: 100, width: 280, height: 280, borderRadius: "50%", background: "rgba(255,255,255,0.03)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: 20, right: 180, width: 80, height: 80, borderRadius: "50%", background: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />

      <div style={{ position: "relative", zIndex: 1 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.12)", borderRadius: 100, padding: "4px 14px", marginBottom: 16 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#f5b200" }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.9)", letterSpacing: 1.5, textTransform: "uppercase" }}>{t("banner_badge")}</span>
        </div>

        <h2 style={{ fontSize: 32, fontWeight: 900, color: "#fff", margin: "0 0 10px", lineHeight: 1.15, letterSpacing: -0.5 }}>
          {t("banner_title_1")}<br />
          <span style={{ color: "#fcd4d8" }}>{t("banner_title_2")}</span>
        </h2>

        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", margin: "0 0 24px", lineHeight: 1.7, maxWidth: 420 }}>
          {t("banner_sub")}
        </p>

        <div style={{ display: "flex", gap: 28 }}>
          {[[Building2, t("banner_feat_1")], [Zap, t("banner_feat_2")], [ShieldCheck, t("banner_feat_3")]].map(([Icon, label]) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <Icon size={14} aria-hidden="true" />
              <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.8)" }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function createDefaultFilters(params = {}) {
  return {
    hotelTypes: params.hotelTypes || "",
    stars: null,
    roomCategories: "",
    hotelAmenities: [],
    roomAmenities: [],
    priceMax: 10000000,
  };
}

function filtersToSearchParams(filters) {
  return {
    hotelTypes: filters.hotelTypes || "",
    roomCategories: filters.roomCategories || "",
    hotelAmenities: filters.hotelAmenities || [],
    roomAmenities: filters.roomAmenities || [],
  };
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

function SearchSummaryBar({ params, totalItems, loading }) {
  const { t } = useLang();
  const hasSearch = !!(params.province || params.checkIn || params.hotelTypes);
  if (!hasSearch) return null;

  const typeOption = HOTEL_TYPE_OPTIONS.find(o => o.value === params.hotelTypes);
  const chips = [
    params.province   && { Icon: MapPin,       label: params.province + (params.district ? `, ${params.district}` : "") },
    params.checkIn && params.checkOut && { Icon: CalendarDays, label: `${params.checkIn} → ${params.checkOut}` },
    params.guests  && { Icon: User,        label: `${params.guests} ${t("guests").trim()}` },
    params.rooms   && params.rooms > 1 && { Icon: BedDouble,   label: `${params.rooms} ${t("search_rooms").toLowerCase()}` },
    params.hotelTypes && { Icon: Building2,    label: typeOption ? t(typeOption.tkey) : params.hotelTypes },
  ].filter(Boolean);

  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: "14px 20px", marginBottom: 16, boxShadow: "0 1px 6px rgba(0,0,0,0.07)", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: 0.8, flexShrink: 0 }}>{t("search_summary_label")}</span>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", flex: 1 }}>
        {chips.map(({ Icon, label }) => (
          <span key={label} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#fdf4f5", border: "1px solid #f5d0d4", borderRadius: 100, padding: "4px 12px", fontSize: 13, fontWeight: 600, color: "#7a0d1a" }}>
            <Icon size={13} aria-hidden="true" /> {label}
          </span>
        ))}
      </div>
      {!loading && (
        <span style={{ fontSize: 12, color: "#aaa", flexShrink: 0 }}>
          {totalItems} {t("results_suffix")}
        </span>
      )}
    </div>
  );
}

export default function HotelSearchResults({ navigate, params = {}, hideBanner = false, hideResultText = false }) {
  const { t } = useLang();
  const containerRef = useRef(null);
  const [filters, setFilters] = useState(() => createDefaultFilters(params));
  const [appliedFilters, setAppliedFilters] = useState(() => createDefaultFilters(params));
  const [page, setPage] = useState(1);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

  const searchParams = {
    ...params,
    ...filtersToSearchParams(appliedFilters),
    page,
    size: 10,
  };

  const { data: searchResult, isLoading: loading } = useHotelSearch(searchParams);
  const results    = searchResult?.hotels     ?? [];
  const totalPages = searchResult?.totalPages ?? 1;
  const totalItems = searchResult?.totalItems ?? 0;

  useEffect(() => {
    const next = createDefaultFilters(params);
    setFilters(next);
    setAppliedFilters(next);
    setPage(1);
  }, [params]);

  const handlePageChange = (p) => {
    setPage(p);
    if (containerRef.current) {
      const top = containerRef.current.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top, behavior: "smooth" });
    }
  };

  const displayed = results
    .filter(h => appliedFilters.stars === null || Math.round(h.rating) >= appliedFilters.stars)
    .filter(h => appliedFilters.priceMax >= 10000000 || h.price === 0 || h.price <= appliedFilters.priceMax);

  const handleApplyFilters = () => {
    setAppliedFilters({
      ...filters,
      hotelAmenities: [...(filters.hotelAmenities || [])],
      roomAmenities: [...(filters.roomAmenities || [])],
    });
    setPage(1);
  };

  const activeFilterCount = [
    appliedFilters.hotelTypes,
    appliedFilters.stars,
    appliedFilters.roomCategories,
    ...(appliedFilters.hotelAmenities || []),
    ...(appliedFilters.roomAmenities || []),
  ].filter(Boolean).length + (appliedFilters.priceMax < 10000000 ? 1 : 0);

  return (
    <div ref={containerRef} className="hsr-container" style={{ maxWidth: 1300, margin: "0 auto", width: "100%", padding: "24px 40px 40px", display: "flex", gap: 24, flex: 1, boxSizing: "border-box" }}>

      {/* ── Mobile filter overlay + drawer ───────────────────────────── */}
      {filterDrawerOpen && (
        <div className="hsr-filter-overlay visible" onClick={() => setFilterDrawerOpen(false)} />
      )}
      <div className={`hsr-filter-drawer${filterDrawerOpen ? " open" : ""}`}>
        <div className="hsr-filter-drawer-header">
          <h3 className="hsr-filter-drawer-title">{t("filter_title")}</h3>
          <button className="hsr-filter-close-btn" onClick={() => setFilterDrawerOpen(false)}>×</button>
        </div>
        <FilterSidebar
          filters={filters}
          onChange={setFilters}
          onApply={() => { handleApplyFilters(); setFilterDrawerOpen(false); }}
        />
      </div>

      {/* ── Desktop sidebar ───────────────────────────────────────────── */}
      <div className="hsr-sidebar" style={{ flex: "0 0 280px" }}>
        <FilterSidebar filters={filters} onChange={setFilters} onApply={handleApplyFilters} />
      </div>

      {/* ── Results area ─────────────────────────────────────────────── */}
      <div style={{ flex: 1, minWidth: 0 }}>

        {/* Mobile filter toggle button */}
        <button className="hsr-filter-toggle" onClick={() => setFilterDrawerOpen(true)}>
          <FIcon k="layers" size={15} color="#BE1E2E" />
          {t("filter_title")}
          {activeFilterCount > 0 && (
            <span className="hsr-filter-badge">{activeFilterCount}</span>
          )}
        </button>

        {!hideBanner && !params.province && !params.checkIn && !params.hotelTypes && <FeaturedBanner />}

        <SearchSummaryBar params={params} totalItems={totalItems} loading={loading} />

        {!loading && !hideResultText && !params.province && !params.checkIn && !params.hotelTypes && (
          <h2 style={{ fontSize: 20, fontWeight: 800, color: "#1a1a1a", marginBottom: 16 }}>
            {t("results_found")} {totalItems} {t("results_suffix")}
          </h2>
        )}

        {loading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} style={{ height: 200, background: "#fff", borderRadius: 14, border: "1.5px solid #edd8da", marginBottom: 16, opacity: 0.5 }} />
            ))
          : displayed.length === 0
            ? <p style={{ color: "#888", textAlign: "center", padding: "40px 0" }}>{t("no_results")}</p>
            : displayed.map(h => (
                <HotelResultCard key={h.id} hotel={h} onView={() => navigate("hotel", { hotelId: h.id, ...defaultStayParams(params) })} />
              ))
        }

        {!loading && totalPages > 1 && (
          <Pagination page={page} totalPages={totalPages} onPage={handlePageChange} />
        )}
      </div>
    </div>
  );
}
