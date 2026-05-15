import { useState, useEffect } from "react";
import {
  useMyHotels, useCatalogOptions, usePartnerRooms, partnerKeys,
  useCreateRoom, useUpdateRoom, useDeleteRoom,
  useUploadRoomImages, useDeleteRoomImage,
} from "../../hooks/usePartnerQueries";
import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { partnerService } from "../../services/partnerService"; // only used in queryClient.fetchQuery below
import {
  createExistingImageItems,
  createPendingImageItems,
  existingImageUrlsFromItems,
  imageItemUrl,
  pendingImageFilesFromItems,
  revokePendingImageUrls,
} from "../../utils/imageFormItems";
import { PageHeader, Card, Btn, Modal } from "../../components/admin/AdminLayout";
import {
  Bed, Users, Home, Edit3, Trash2, Search, Plus,
  Wind, Coffee, Bath, Layout, Grid, Smartphone, Box, TrendingUp, TrendingDown,
  MapPin, FileText, Building2, Sparkles, Minus
} from "lucide-react";
import "../../styles/pages/partner/PartnerRooms.css";
import { useLang } from "../../contexts/LanguageContext";

// --- Configuration ---
const CATEGORIES = [
  { key: "STANDARD", label: "Tiêu chuẩn" },
  { key: "DELUXE",   label: "Sang trọng" },
  { key: "SUITE",    label: "Suite" },
  { key: "FAMILY",   label: "Gia đình" },
];
const BED_TYPES = [
  { key: "SINGLE", label: "Giường đơn" },
  { key: "DOUBLE", label: "Giường đôi" },
  { key: "TWIN",   label: "Hai giường" },
];
const ROOM_AMENITIES = [
  { key: "AIR_CONDITIONER", label: "Điều hòa", Icon: Wind },
  { key: "TV", label: "TV", Icon: Smartphone },
  { key: "MINI_BAR", label: "Mini bar", Icon: Coffee },
  { key: "PRIVATE_BATHROOM", label: "Phòng tắm riêng", Icon: Bath },
  { key: "BATHTUB", label: "Bồn tắm", Icon: Bath },
  { key: "HAIR_DRYER", label: "Máy sấy tóc", Icon: Wind },
  { key: "BALCONY", label: "Ban công", Icon: Layout },
  { key: "WINDOW", label: "Cửa sổ", Icon: Layout },
  { key: "DESK", label: "Bàn làm việc", Icon: Layout },
  { key: "WARDROBE", label: "Tủ quần áo", Icon: Box },
  { key: "KETTLE", label: "Ấm đun nước", Icon: Coffee },
  { key: "REFRIGERATOR", label: "Tủ lạnh", Icon: Box },
  { key: "SAFE_BOX", label: "Két an toàn", Icon: Box },
  { key: "FREE_WATER", label: "Nước miễn phí", Icon: Coffee },
  { key: "SEA_VIEW", label: "Hướng biển", Icon: Layout },
  { key: "BREAKFAST", label: "Bữa sáng", Icon: Coffee },
];
const ROOM_AMENITY_KEYS = new Set(ROOM_AMENITIES.map((amenity) => amenity.key));

const HOTEL_TYPE_LABELS = {
  HOTEL: "Khách sạn", RESORT: "Resort", VILLA: "Villa",
  APARTMENT: "Căn hộ", HOMESTAY: "Homestay", MOTEL: "Nhà nghỉ",
};

const EMPTY_FORM = {
  name: "", capacity: 2, quantity: 1, price: 500000,
  roomCategory: "STANDARD", bedType: "DOUBLE", amenities: [],
  images: [], description: "",
};

function getRoomImageUrl(room) {
  const imageUrls = getRoomImageUrls(room);
  return room?.coverImageUrl || imageUrls[0] || "";
}

function getRoomImageUrls(room) {
  const imageUrls = Array.isArray(room?.imageUrls) ? room.imageUrls : [];
  const legacyImages = Array.isArray(room?.images) ? room.images : [];
  return imageUrls.length ? imageUrls : legacyImages;
}

function Field({ label, children, required }) {
  return (
    <div className="pr-field">
      <div className="pr-field-label">
        {label} {required && <span className="pr-field-required">*</span>}
      </div>
      {children}
    </div>
  );
}

function HotelInfoPanel({ hotel }) {
  const { t } = useLang();
  const HOTEL_TYPE_LABELS = {
    HOTEL: t("pt_type_hotel"), RESORT: t("pt_type_resort"), VILLA: t("pt_type_villa"),
    APARTMENT: t("pt_type_apartment"), HOMESTAY: t("pt_type_homestay"), MOTEL: t("pt_type_guest_house"),
  };
  if (!hotel) return null;
  return (
    <div className="pr-hotel-info-panel">
      <div className="pr-hotel-info-header">
        <Building2 size={18} color="#BE1E2E" />
        <span className="pr-hotel-info-title">{t("pt_rooms_hotel_intro")}</span>
        {hotel.hotelType && (
          <span className="pr-hotel-type-badge">
            {HOTEL_TYPE_LABELS[hotel.hotelType] || hotel.hotelType}
          </span>
        )}
      </div>
      <div className="pr-hotel-info-name">{hotel.name}</div>
      {(hotel.address || hotel.district || hotel.province) && (
        <div className="pr-hotel-info-address">
          <MapPin size={13} color="#94a3b8" />
          {[hotel.address, hotel.district, hotel.province].filter(Boolean).join(", ")}
        </div>
      )}
      {hotel.description ? (
        <p className="pr-hotel-info-desc">{hotel.description}</p>
      ) : (
        <p className="pr-hotel-info-desc pr-hotel-info-desc--empty">{t("pt_rooms_hotel_no_desc")}</p>
      )}
    </div>
  );
}

function RoomForm({ form, setForm, onSubmit, onCancel, saving, title, categories, bedTypes, amenities, hotel, aiSuggestion }) {
  const { t } = useLang();

  const aiSuggestedPrice = aiSuggestion?.data?.suggestedPrice ?? null;
  const aiDelta = (aiSuggestedPrice !== null && form.price > 0) ? aiSuggestedPrice - form.price : null;
  const aiDeltaPct = (aiDelta !== null && form.price > 0) ? (aiDelta / form.price) * 100 : null;
  // Derive demand from % delta — matches PartnerForecast's effectiveDemand thresholds
  const aiDemand = aiDeltaPct !== null
    ? (aiDeltaPct >= 12 ? "HIGH" : aiDeltaPct >= -5 ? "MEDIUM" : "LOW")
    : "MEDIUM";
  const aiIsUp = aiDemand === "HIGH";
  const aiIsDown = aiDemand === "LOW";
  const AI_ROOM_SCHEMES = {
    HIGH:   { bg: "#FFF1F2", border: "#FECDD3", accent: "#BE1E2E", hint: "AI đề xuất tăng giá · thị trường đang tốt" },
    MEDIUM: { bg: "#FFFBEB", border: "#FDE68A", accent: "#D97706", hint: "AI đề xuất giá ổn định với thị trường hiện tại" },
    LOW:    { bg: "#F0FDF4", border: "#A7F3D0", accent: "#059669", hint: "AI đề xuất giảm giá · tối ưu công suất lấp phòng" },
  };
  const aiScheme = AI_ROOM_SCHEMES[aiDemand];

  function toggleAmenity(key) {
    setForm(f => ({
      ...f,
      amenities: f.amenities.includes(key)
        ? f.amenities.filter(a => a !== key)
        : [...f.amenities, key],
    }));
  }

  return (
    <Modal title={title} onClose={onCancel} width={680}>
      <div className="pr-form-body">
        <HotelInfoPanel hotel={hotel} />

        <Field label={t("pt_rooms_name")} required>
          <input className="pr-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder={t("pt_rooms_name_ph")} />
        </Field>

        <div className="pr-form-grid-2">
          <Field label={t("pt_rooms_category")}>
            <select className="pr-input" value={form.roomCategory} onChange={e => setForm(f => ({ ...f, roomCategory: e.target.value }))}>
              {categories.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </Field>
          <Field label={t("pt_rooms_bed_type")}>
            <select className="pr-input" value={form.bedType} onChange={e => setForm(f => ({ ...f, bedType: e.target.value }))}>
              {bedTypes.map(b => <option key={b.key} value={b.key}>{b.label}</option>)}
            </select>
          </Field>
        </div>

        <div className="pr-form-grid-3">
          <Field label={t("pt_rooms_capacity")}>
            <input className="pr-input" type="number" min="1" value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: Number(e.target.value) }))} />
          </Field>
          <Field label={t("pt_rooms_quantity")}>
            <input className="pr-input" type="number" min="0" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: Number(e.target.value) }))} />
          </Field>
          <Field label={t("pt_rooms_price")}>
            <div className="pr-price-wrap">
              <input className="pr-input pr-input-icon-left" type="number" min="0" step="50000" value={form.price} onChange={e => setForm(f => ({ ...f, price: Number(e.target.value) }))} />
              <TrendingUp size={16} color="#10b981" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
            </div>
          </Field>
        </div>

        {/* AI suggestion — full width below grid, no blank space issue */}
        {aiSuggestion && (aiSuggestion.loading || aiSuggestion.data) && (
          <div style={{ marginBottom: 4 }}>
            {aiSuggestion.loading ? (
              <div style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "9px 14px", background: "#f8fafc", borderRadius: 12,
                border: "1px solid #e2e8f0", fontSize: 12, color: "#94a3b8",
              }}>
                <Sparkles size={12} style={{ opacity: 0.35 }} />
                Đang phân tích dữ liệu 14 ngày tới...
              </div>
            ) : aiSuggestion.data && (
              <div style={{
                borderRadius: 14, background: aiScheme.bg,
                border: `1.5px solid ${aiScheme.border}`,
                padding: "10px 14px",
                boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
              }}>
                {/* Single row: badge · price · delta · spacer · apply */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                    <Sparkles size={11} color={aiScheme.accent} />
                    <span style={{ fontSize: 10, fontWeight: 900, color: aiScheme.accent, letterSpacing: 0.4, textTransform: "uppercase" }}>
                      {aiSuggestion.data.aiGenerated ? "Gemini AI" : "Thống kê"} · 14 ngày
                    </span>
                  </div>
                  <span style={{ color: aiScheme.border, fontSize: 16, lineHeight: 1 }}>·</span>
                  <span style={{ fontSize: 17, fontWeight: 900, color: aiScheme.accent, flexShrink: 0 }}>
                    {new Intl.NumberFormat("vi-VN").format(aiSuggestion.data.suggestedPrice)} ₫
                  </span>
                  {aiDelta !== null && (
                    <div style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
                      {aiIsUp
                        ? <TrendingUp size={12} color={aiScheme.accent} />
                        : aiIsDown
                        ? <TrendingDown size={12} color={aiScheme.accent} />
                        : <Minus size={11} color="#94a3b8" />}
                      <span style={{ fontSize: 11, fontWeight: 800, color: aiIsUp || aiIsDown ? aiScheme.accent : "#94a3b8" }}>
                        {aiIsUp ? "+" : ""}{Math.round(aiDelta).toLocaleString("vi-VN")} ₫
                        {aiDeltaPct !== null && ` (${aiIsUp ? "+" : ""}${aiDeltaPct.toFixed(1)}%)`}
                      </span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, price: aiSuggestion.data.suggestedPrice }))}
                    style={{
                      marginLeft: "auto", flexShrink: 0,
                      display: "flex", alignItems: "center", gap: 4,
                      padding: "5px 12px", borderRadius: 8, border: "none",
                      background: aiScheme.accent, color: "#fff",
                      fontSize: 11, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
                      boxShadow: `0 3px 8px ${aiScheme.accent}44`,
                    }}
                  >
                    Áp dụng
                  </button>
                </div>
                {/* Hint text */}
                <div style={{ fontSize: 11, color: aiScheme.accent, opacity: 0.75, marginTop: 5, fontWeight: 600 }}>
                  {aiScheme.hint}
                </div>
              </div>
            )}
          </div>
        )}

        <Field label={t("pt_rooms_amenities")}>
          <div className="pr-amenities-grid">
            {amenities.map(a => {
              const selected = form.amenities.includes(a.key);
              return (
                <label
                  key={a.key}
                  className="pr-amenity-label"
                  style={{
                    background:  selected ? "#FFF1F2" : "#fff",
                    color:       selected ? "#BE1E2E" : "#64748b",
                    borderColor: selected ? "#BE1E2E" : "#e2e8f0",
                    fontWeight:  selected ? 700 : 500,
                  }}
                >
                  <input type="checkbox" style={{ display: "none" }} checked={selected} onChange={() => toggleAmenity(a.key)} />
                  <a.Icon size={16} />
                  {a.label}
                </label>
              );
            })}
          </div>
        </Field>

        <Field label={t("pt_rooms_desc")}>
          <textarea
            className="pr-input pr-textarea"
            value={form.description || ""}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder={t("pt_rooms_desc_ph")}
            rows={4}
          />
        </Field>

        <Field label={t("pt_rooms_images")}>
          <div className="pr-images-grid">
            {form.images?.map((img, idx) => {
              const url = imageItemUrl(img);
              return (
              <div key={img?.id || url || idx} className="pr-image-thumb">
                <img src={url} alt="" />
                <button
                  className="pr-image-delete-btn"
                  onClick={() => setForm(f => {
                    const images = [...(f.images || [])];
                    const [removed] = images.splice(idx, 1);
                    revokePendingImageUrls([removed]);
                    return { ...f, images };
                  })}
                >
                  <Trash2 size={12} />
                </button>
              </div>
              );
            })}
            <label className="pr-image-add-label">
              <Plus size={24} />
              <div className="pr-image-add-text">{t("pt_rooms_img_add")}</div>
              <input
                type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif" style={{ display: "none" }}
                onChange={e => {
                  const images = createPendingImageItems(e.target.files);
                  setForm(f => ({ ...f, images: [...(f.images || []), ...images] }));
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          <p className="pr-image-hint">{t("pt_rooms_img_hint")}</p>
        </Field>

        <div className="pr-form-footer">
          <Btn variant="ghost" onClick={onCancel}>{t("adm_cancel")}</Btn>
          <Btn onClick={onSubmit} disabled={saving || !form.name.trim()}>
            {saving ? t("adm_processing") : t("pt_rooms_save")}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

function fmtPrice(n) {
  return new Intl.NumberFormat("vi-VN").format(n) + " ₫";
}

export default function PartnerRooms() {
  const { t } = useLang();
  const CATEGORIES = [
    { key: "STANDARD", label: t("pt_cat_standard") },
    { key: "DELUXE",   label: t("pt_cat_deluxe") },
    { key: "SUITE",    label: t("pt_cat_suite") },
    { key: "FAMILY",   label: t("pt_cat_family") },
  ];
  const BED_TYPES = [
    { key: "SINGLE", label: t("pt_bed_single") },
    { key: "DOUBLE", label: t("pt_bed_double") },
    { key: "TWIN",   label: t("pt_bed_twin") },
  ];
  const ROOM_AMENITIES = [
    { key: "AIR_CONDITIONER",  label: t("pt_ram_ac"),        Icon: Wind },
    { key: "TV",               label: t("pt_ram_tv"),        Icon: Smartphone },
    { key: "MINI_BAR",         label: t("pt_ram_minibar"),   Icon: Coffee },
    { key: "PRIVATE_BATHROOM", label: t("pt_ram_bathroom"),  Icon: Bath },
    { key: "BATHTUB",          label: t("pt_ram_bathtub"),   Icon: Bath },
    { key: "HAIR_DRYER",       label: t("pt_ram_hairdryer"), Icon: Wind },
    { key: "BALCONY",          label: t("pt_ram_balcony"),   Icon: Layout },
    { key: "WINDOW",           label: t("pt_ram_window"),    Icon: Layout },
    { key: "DESK",             label: t("pt_ram_desk"),      Icon: Layout },
    { key: "WARDROBE",         label: t("pt_ram_wardrobe"),  Icon: Box },
    { key: "KETTLE",           label: t("pt_ram_kettle"),    Icon: Coffee },
    { key: "REFRIGERATOR",     label: t("pt_ram_fridge"),    Icon: Box },
    { key: "SAFE_BOX",         label: t("pt_ram_safe"),      Icon: Box },
    { key: "FREE_WATER",       label: t("pt_ram_water"),     Icon: Coffee },
    { key: "SEA_VIEW",         label: t("pt_ram_seaview"),   Icon: Layout },
    { key: "BREAKFAST",        label: t("pt_ram_breakfast"), Icon: Coffee },
  ];
  const [sp] = useSearchParams();
  const initialHotelId = sp.get("hotelId") || "";

  const queryClient = useQueryClient();
  const [selectedHotelId, setSelectedHotelId] = useState(initialHotelId);
  const [modal, setModal]       = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [saving, setSaving]     = useState(false);
  const [page, setPage]         = useState(1);
  const [error, setError]       = useState("");
  const [searchText, setSearchText]     = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [roomAiSuggestion, setRoomAiSuggestion] = useState({ loading: false, data: null });
  const pageSize = 8;

  const { data: hotelData }   = useMyHotels();
  const { data: catalogData } = useCatalogOptions();
  const { data: roomData, isLoading: loading } = usePartnerRooms(selectedHotelId);

  const createRoom     = useCreateRoom();
  const updateRoom     = useUpdateRoom();
  const deleteRoomMut  = useDeleteRoom();
  const uploadImages   = useUploadRoomImages();
  const deleteImageMut = useDeleteRoomImage();

  const hotels = Array.isArray(hotelData) ? hotelData : [];
  const rooms  = Array.isArray(roomData)  ? roomData  : [];

  // Auto-select first hotel when list loads
  useEffect(() => {
    if (!initialHotelId && hotels.length > 0 && !selectedHotelId) {
      setSelectedHotelId(String(hotels[0].id));
    }
  }, [hotels, initialHotelId]); // eslint-disable-line react-hooks/exhaustive-deps

  const catalog = {
    roomCategories: Array.isArray(catalogData?.roomCategories) && catalogData.roomCategories.length ? catalogData.roomCategories : CATEGORIES.map(c => c.key),
    bedTypes:       Array.isArray(catalogData?.bedTypes)       && catalogData.bedTypes.length       ? catalogData.bedTypes       : BED_TYPES.map(b => b.key),
    roomAmenities:  Array.isArray(catalogData?.roomAmenities)  && catalogData.roomAmenities.length  ? catalogData.roomAmenities  : ROOM_AMENITIES.map(a => a.key),
  };

  const categoryOptions = catalog.roomCategories.map((key) => CATEGORIES.find((item) => item.key === key) || { key, label: key });
  const bedTypeOptions = catalog.bedTypes.map((key) => BED_TYPES.find((item) => item.key === key) || { key, label: key });
  const roomAmenityOptions = catalog.roomAmenities
    .map((key) => ROOM_AMENITIES.find((item) => item.key === key) || { key, label: key, Icon: Box });

  const filteredRooms = rooms.filter(r => {
    const matchCategory = !categoryFilter || r.roomCategory === categoryFilter;
    const matchSearch = !searchText || r.name.toLowerCase().includes(searchText.toLowerCase());
    return matchCategory && matchSearch;
  });

  function toIsoDateLocal(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function openAdd() {
    revokePendingImageUrls(form.images);
    setSelected(null);
    setForm({ ...EMPTY_FORM, images: [] });
    setRoomAiSuggestion({ loading: false, data: null });
    setModal("add");
  }
  async function openEdit(room) {
    revokePendingImageUrls(form.images);
    setSelected(room);
    setForm({
      name: room.name || "", capacity: room.capacity || 2, quantity: room.quantity || 1, price: room.price || 0,
      roomCategory: room.roomCategory || "STANDARD", bedType: room.bedType || "DOUBLE",
      amenities: room.amenities ? room.amenities.filter(key => catalog.roomAmenities.includes(key) || ROOM_AMENITY_KEYS.has(key)) : [],
      images: createExistingImageItems(getRoomImageUrls(room)),
      description: room.description || "",
    });
    setModal("edit");
    setRoomAiSuggestion({ loading: true, data: null });
    const today = new Date();
    const end = new Date(today.getTime() + 14 * 86400000);
    const from = toIsoDateLocal(today);
    const to   = toIsoDateLocal(end);
    queryClient.fetchQuery({
      queryKey: partnerKeys.priceSugs(room.id, from, to),
      queryFn:  () => partnerService.getPriceSuggestions(room.id, from, to),
      staleTime: 5 * 60 * 1000,
    }).then(result => {
      const items = (result?.items || []).filter(i => i.suggestedPrice > 0);
      if (items.length > 0) {
        const avg = Math.round(items.reduce((s, i) => s + i.suggestedPrice, 0) / items.length / 1000) * 1000;
        setRoomAiSuggestion({ loading: false, data: { suggestedPrice: avg, aiGenerated: items.some(i => i.aiGenerated) } });
      } else {
        setRoomAiSuggestion({ loading: false, data: null });
      }
    }).catch(() => setRoomAiSuggestion({ loading: false, data: null }));
  }
  function openDelete(room) { setSelected(room); setModal("delete"); }

  function closeFormModal() {
    revokePendingImageUrls(form.images);
    setModal(null);
    setSelected(null);
    setForm({ ...EMPTY_FORM, images: [] });
    setRoomAiSuggestion({ loading: false, data: null });
  }

  async function handleSave() {
    setSaving(true);
    try {
      const images = form.images || [];
      const existingImageUrls = existingImageUrlsFromItems(images);
      const pendingFiles = pendingImageFilesFromItems(images);
      const payload = { ...form, imageUrls: existingImageUrls };
      delete payload.images;
      if (!payload.description) payload.description = null;

      if (modal === "add") {
        const created = await createRoom.mutateAsync({ hotelId: selectedHotelId, ...payload });
        if (pendingFiles.length > 0) {
          await uploadImages.mutateAsync({ roomId: created.id, hotelId: selectedHotelId, files: pendingFiles });
        }
      } else {
        await updateRoom.mutateAsync({
          roomId: selected.id, hotelId: selectedHotelId,
          ...payload, imageUrls: getRoomImageUrls(selected),
        });
        // Delete removed images
        const remaining = new Set(existingImageUrls);
        const removed = getRoomImageUrls(selected).filter(url => !remaining.has(url));
        for (const imageUrl of removed) {
          await deleteImageMut.mutateAsync({ roomId: selected.id, hotelId: selectedHotelId, imageUrl });
        }
        if (pendingFiles.length > 0) {
          await uploadImages.mutateAsync({ roomId: selected.id, hotelId: selectedHotelId, files: pendingFiles });
        }
      }
      revokePendingImageUrls(images);
      setModal(null);
      setSelected(null);
      setForm({ ...EMPTY_FORM, images: [] });
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    setSaving(true);
    try {
      await deleteRoomMut.mutateAsync({ roomId: selected.id, hotelId: selectedHotelId });
      setModal(null);
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="pr-root">
      <PageHeader
        title={t("pt_rooms_title")}
        subtitle={t("pt_rooms_subtitle")}
        action={selectedHotelId && (
          <button className="pr-add-btn" onClick={openAdd}>
            <Plus size={20} /> {t("pt_rooms_add_btn")}
          </button>
        )}
      />

      {/* Hotel Selector */}
      <div className="pr-hotel-selector">
        <div className="pr-hotel-selector-label">
          <Home size={20} color="#BE1E2E" /> {t("pt_rooms_select_hotel").toUpperCase()}:
        </div>
        <select
          className="pr-hotel-select"
          value={selectedHotelId}
          onChange={e => setSelectedHotelId(e.target.value)}
        >
          <option value="">-- {t("pt_rooms_select_hotel")} --</option>
          {hotels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
      </div>

      {error && (
        <div style={{ marginBottom: 18, padding: "12px 14px", borderRadius: 12, background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", fontSize: 13, fontWeight: 700 }}>
          {error}
        </div>
      )}

      {!selectedHotelId ? (
        <Card style={{ textAlign: "center", padding: "100px 0", borderRadius: 28 }}>
          <div className="pr-empty-icon">
            <Box size={40} color="#cbd5e1" />
          </div>
          <h3 className="pr-empty-title">{t("pt_rooms_select_hotel")}</h3>
          <p className="pr-empty-desc">{t("pt_rooms_no_hotel")}</p>
        </Card>
      ) : loading ? (
        <div className="pr-loading">
          <div className="pr-spinner" />
          {t("pt_rooms_loading")}
        </div>
      ) : rooms.length === 0 ? (
        <Card style={{ textAlign: "center", padding: "80px 20px", borderRadius: 20 }}>
          <div className="pr-empty-icon">
            <Bed size={40} color="#cbd5e1" />
          </div>
          <h3 className="pr-empty-title">{t("pt_rooms_empty_title")}</h3>
          <p className="pr-empty-desc">{t("pt_rooms_empty_desc")}</p>
          <Btn onClick={openAdd}>{t("pt_rooms_add_btn")}</Btn>
        </Card>
      ) : (
        <>
          {/* Filter bar */}
          <div className="pr-filter-bar">
            <div className="pr-filter-search-wrap">
              <Search size={15} color="#94a3b8" className="pr-filter-search-icon" />
              <input
                className="pr-filter-search"
                placeholder={t("pt_rooms_search_ph")}
                value={searchText}
                onChange={e => { setSearchText(e.target.value); setPage(1); }}
              />
            </div>
            <select
              className="pr-filter-cat-select"
              value={categoryFilter}
              onChange={e => { setCategoryFilter(e.target.value); setPage(1); }}
            >
              <option value="">{t("pt_rooms_all_categories")}</option>
              {categoryOptions.map(cat => (
                <option key={cat.key} value={cat.key}>{cat.label}</option>
              ))}
            </select>
            <div className="pr-filter-count">
              {filteredRooms.length} / {rooms.length} loại phòng
            </div>
          </div>

          {filteredRooms.length === 0 ? (
            <Card style={{ textAlign: "center", padding: "60px 20px", borderRadius: 20 }}>
              <div className="pr-empty-icon"><Search size={36} color="#cbd5e1" /></div>
              <h3 className="pr-empty-title">{t("pt_rooms_empty_title")}</h3>
              <p className="pr-empty-desc">{t("pt_rooms_empty_desc")}</p>
            </Card>
          ) : (
        <div className="pr-rooms-grid">
          {filteredRooms.slice((page - 1) * pageSize, page * pageSize).map((r) => (
            <div key={r.id} className="pr-room-card">
              <div className="pr-room-image-wrap">
                {getRoomImageUrl(r) ? (
                  <img src={getRoomImageUrl(r)} alt={r.name} className="pr-room-image" />
                ) : (
                  <div className="pr-room-image" style={{ alignItems: "center", background: "#f8fafc", color: "#cbd5e1", display: "flex", justifyContent: "center" }}>
                    <Bed size={42} />
                  </div>
                )}
                <div className="pr-room-badge-wrap">
                  <span className="pr-room-category-badge">
                    {(categoryOptions.find(c => c.key === r.roomCategory)?.label || r.roomCategory || "PHÒNG").toUpperCase()}
                  </span>
                </div>
                <div className="pr-room-price-wrap">
                  <span className="pr-room-price-badge">{fmtPrice(r.price)}</span>
                </div>
              </div>

              <div className="pr-room-body">
                <div className="pr-room-header">
                  <h3 className="pr-room-name">{r.name}</h3>
                </div>

                <div className="pr-room-meta-grid">
                  <div className="pr-room-meta-item">
                    <div className="pr-room-meta-icon"><Users size={14} color="#64748b" /></div>
                    {r.capacity} khách tối đa
                  </div>
                  <div className="pr-room-meta-item">
                    <div className="pr-room-meta-icon"><Bed size={14} color="#64748b" /></div>
                    {bedTypeOptions.find(b => b.key === r.bedType)?.label || r.bedType || "—"}
                  </div>
                  <div className="pr-room-meta-item">
                    <div className="pr-room-meta-icon"><Grid size={14} color="#64748b" /></div>
                    {r.quantity} phòng tổng
                  </div>
                  <div className="pr-room-meta-item">
                    <div className="pr-room-meta-icon"><Box size={14} color="#64748b" /></div>
                    Mã #{r.id}
                  </div>
                </div>

                <div className="pr-room-actions">
                  <button className="pr-edit-btn" onClick={() => openEdit(r)}>
                    <Edit3 size={16} /> {t("adm_edit")}
                  </button>
                  <button className="pr-delete-btn" onClick={() => openDelete(r)}>
                    <Trash2 size={16} /> {t("adm_delete")}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
          )}
        </>
      )}

      {/* Pagination */}
      {filteredRooms.length > pageSize && (
        <div className="pr-pagination">
          {[...Array(Math.ceil(filteredRooms.length / pageSize))].map((_, i) => (
            <button
              key={i}
              className="pr-page-btn"
              onClick={() => { setPage(i + 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}
              style={{
                background:  page === i + 1 ? "#BE1E2E" : "#fff",
                color:       page === i + 1 ? "#fff" : "#475569",
                boxShadow:   page === i + 1 ? "0 4px 12px rgba(190, 30, 46, 0.3)" : "none",
              }}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}

      {/* Modals */}
      {(modal === "add" || modal === "edit") && (
        <RoomForm
          title={modal === "add" ? t("pt_rooms_form_add") : t("pt_rooms_form_edit")}
          form={form} setForm={setForm} onSubmit={handleSave} onCancel={closeFormModal} saving={saving}
          categories={categoryOptions}
          bedTypes={bedTypeOptions}
          amenities={roomAmenityOptions}
          hotel={hotels.find(h => String(h.id) === String(selectedHotelId)) || null}
          aiSuggestion={modal === "edit" ? roomAiSuggestion : null}
        />
      )}

      {modal === "delete" && (
        <Modal title={t("pt_rooms_del_title")} onClose={() => setModal(null)} width={440}>
          <div className="pr-delete-modal-content">
            <div className="pr-delete-modal-icon">
              <Trash2 size={32} color="#ef4444" />
            </div>
            <h3 className="pr-delete-modal-title">{t("adm_confirm")}</h3>
            <p className="pr-delete-modal-desc"
              dangerouslySetInnerHTML={{ __html: t("pt_rooms_del_desc").replace("{name}", `<strong>"${selected?.name}"</strong>`) }}
            />
            <div className="pr-delete-modal-actions">
              <button className="pr-delete-modal-cancel" onClick={() => setModal(null)}>{t("adm_cancel")}</button>
              <button className="pr-delete-modal-confirm" onClick={handleDelete} disabled={saving}>
                {saving ? t("adm_deleting") : t("pt_rooms_del_submit")}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
