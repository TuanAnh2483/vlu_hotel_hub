import { useState, useEffect, useMemo } from "react";
import {
  useMyHotels, useCatalogOptions, usePartnerRooms, partnerKeys,
  useCreateRoom, useUpdateRoom, useDeleteRoom,
  useUploadRoomImages, useDeleteRoomImage,
  useHotelRoomUnits, useUpdateRoomUnit,
} from "../../hooks/usePartnerQueries";
import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams, useOutletContext, useLocation, useNavigate } from "react-router-dom";
import { partnerService } from "../../services/partnerService"; // only used in queryClient.fetchQuery below
import {
  createExistingImageItems,
  createPendingImageItemsSafe,
  existingImageUrlsFromItems,
  imageItemUrl,
  pendingImageFilesFromItems,
  revokePendingImageUrls,
} from "../../utils/imageFormItems";
import { PageHeader, Card, Btn, Modal } from "../../components/admin/AdminLayout";
import {
  Bed, Users, Home, Edit3, Trash2, Search, Plus,
  Grid, TrendingUp, TrendingDown,
  MapPin, Building2, Sparkles, Minus, Box, AlertTriangle,
  Copy, CalendarDays, Power, Wrench, ChevronRight, DoorOpen,
  ChevronDown, ChevronUp, X, Hash, Layers, MoreHorizontal,
} from "lucide-react";
import { ROOM_AMENITY_KEYS, ROOM_AMENITY_CATEGORIES } from "../../utils/amenityConfig";
import "../../styles/pages/partner/PartnerRooms.css";
import { useLang } from "../../contexts/LanguageContext";
import { useToast } from "../../contexts/ToastContext";


const UNIT_STATUS_CONFIG = {
  AVAILABLE:   { label: "Phòng trống",    color: "#10b981", bg: "#d1fae5" },
  RESERVED:    { label: "Có người đặt",  color: "#8b5cf6", bg: "#ede9fe" },
  OCCUPIED:    { label: "Có khách",       color: "#3b82f6", bg: "#dbeafe" },
  CLEANING:    { label: "Dọn phòng",     color: "#f59e0b", bg: "#fef3c7" },
  MAINTENANCE: { label: "Bảo trì",       color: "#ef4444", bg: "#fee2e2" },
};


function getUnitCounts(units) {
  const total    = units.length;
  const avail    = units.filter(u => u.status === "AVAILABLE").length;
  const reserved = units.filter(u => u.status === "RESERVED").length;
  const occ      = units.filter(u => u.status === "OCCUPIED").length;
  const maint    = units.filter(u => u.status === "MAINTENANCE").length;
  const clean    = units.filter(u => u.status === "CLEANING").length;
  const pct      = (n) => total ? Math.round((n / total) * 100) : 0;
  return { total, avail, reserved, occ, maint, clean, pct };
}

const EMPTY_FORM = {
  name: "", capacity: 2, quantity: 1, price: 500000,
  roomCategory: "STANDARD", bedType: "DOUBLE", amenities: [], customAmenities: [],
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
    APARTMENT: t("pt_type_apartment"), HOMESTAY: t("pt_type_homestay"), HOSTEL: t("pt_type_hostel"), GUEST_HOUSE: t("pt_type_guest_house"),
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

function AmenityPicker({ form, setForm, onGoToServices }) {
  const [open, setOpen] = useState(false);
  const total = (form.amenities?.length || 0) + (form.customAmenities?.length || 0);

  function toggle(key) {
    setForm(f => {
      const list = Array.isArray(f.amenities) ? f.amenities : [];
      return list.includes(key)
        ? { ...f, amenities: list.filter(k => k !== key) }
        : { ...f, amenities: [...list, key] };
    });
  }

  return (
    <div className="pr-amenity-picker">
      <div className="pr-amenity-picker-bar">
        <div className="pr-amenity-picker-info">
          <Wrench size={14} color="#475569" />
          <span>Tiện ích: <strong>{total}</strong> mục đã chọn</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="pr-amenity-toggle-btn" onClick={() => setOpen(o => !o)}>
            {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {open ? "Thu gọn" : "Chọn nhanh"}
          </button>
          <button type="button" className="pr-services-link-btn" onClick={onGoToServices}>
            Tiện ích nâng cao <ChevronRight size={13} />
          </button>
        </div>
      </div>

      {open && (
        <div className="pr-amenity-grid">
          {ROOM_AMENITY_CATEGORIES.map(cat => (
            <div key={cat.label} className="pr-amenity-cat">
              <div className="pr-amenity-cat-label">{cat.label}</div>
              <div className="pr-amenity-items">
                {cat.items.map(item => {
                  const checked = Array.isArray(form.amenities) && form.amenities.includes(item.key);
                  return (
                    <label key={item.key} className={`pr-amenity-item${checked ? " pr-amenity-item--on" : ""}`}>
                      <input type="checkbox" checked={checked} onChange={() => toggle(item.key)} style={{ display: "none" }} />
                      {item.Icon && <item.Icon size={12} />}
                      <span>{item.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RoomForm({ form, setForm, onSubmit, onCancel, saving, title, categories, bedTypes, hotel, aiSuggestion, isAdd, saveError, onGoToServices, originalQuantity }) {
  const { t } = useLang();
  const [imageError, setImageError] = useState("");

  const isEntire = hotel?.bookingMode === "ENTIRE";
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
            <input
              className="pr-input"
              type="number"
              min="1"
              max={isEntire ? 1 : undefined}
              value={isEntire ? 1 : form.quantity}
              disabled={isEntire}
              onChange={e => setForm(f => ({ ...f, quantity: Math.max(1, Number(e.target.value)) }))}
            />
            {isEntire && (
              <div style={{ fontSize: 11.5, color: "#92400e", marginTop: 4 }}>
                Cơ sở thuê nguyên căn chỉ cho phép 1 phòng mỗi loại
              </div>
            )}
          </Field>
          <Field label={t("pt_rooms_price")}>
            <div className="pr-price-wrap">
              <input className="pr-input pr-input-icon-left" type="number" min="0" step="50000" value={form.price} onChange={e => setForm(f => ({ ...f, price: Number(e.target.value) }))} />
              <TrendingUp size={16} color="#10b981" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
            </div>
          </Field>
        </div>

        {/* Quantity reduction warning */}
        {!isAdd && originalQuantity != null && form.quantity < originalQuantity && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "11px 14px", background: "#fffbeb", borderRadius: 10, border: "1px solid #fde68a", fontSize: 12.5, color: "#92400e" }}>
            <AlertTriangle size={14} color="#d97706" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ lineHeight: 1.6 }}>
              <span style={{ fontWeight: 700 }}>
                Sẽ xóa {originalQuantity - form.quantity} phòng vật lý.
              </span>
              {" "}Hệ thống ưu tiên xóa phòng tự động sinh chưa đặt số trước, sau đó đến
              phòng sẵn sàng hoặc đang dọn (theo thứ tự tạo).
              Phòng đang có khách hoặc bảo trì sẽ <strong>không</strong> bị xóa —
              nếu không đủ phòng để xóa thao tác sẽ bị từ chối.
            </div>
          </div>
        )}

        {/* AI suggestion error */}
        {aiSuggestion?.error && (
          <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 14px", background: "#fff7ed", borderRadius: 12, border: "1px solid #fed7aa", fontSize: 12, color: "#c2410c" }}>
            <Sparkles size={12} style={{ opacity: 0.5 }} />
            Không thể tải gợi ý AI lúc này. Bạn có thể nhập giá thủ công.
          </div>
        )}

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
                      {aiSuggestion.data.isAddSuggestion
                        ? "Tham khảo · cùng loại phòng"
                        : aiSuggestion.data.aiGenerated ? "Gemini AI" : "Thống kê"
                      }{!aiSuggestion.data.isAddSuggestion ? " · 14 ngày" : ""}
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
                  {aiSuggestion.data.isAddSuggestion
                    ? "Mức giá trung bình của các phòng cùng loại trong cơ sở này"
                    : aiScheme.hint
                  }
                </div>
              </div>
            )}
          </div>
        )}

        {/* Inline amenity picker */}
        <AmenityPicker form={form} setForm={setForm} onGoToServices={() => { onCancel(); onGoToServices?.(); }} />

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
                  const { accepted, rejected } = createPendingImageItemsSafe(e.target.files);
                  setForm(f => ({ ...f, images: [...(f.images || []), ...accepted] }));
                  setImageError(rejected.length > 0 ? rejected.map(r => r.reason).join(" ") : "");
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          <p className="pr-image-hint">{t("pt_rooms_img_hint")}</p>
          {imageError && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, color: "#b91c1c", fontSize: 12, fontWeight: 600, lineHeight: 1.5, padding: "8px 12px", marginTop: 4 }}>
              ⚠️ {imageError}
            </div>
          )}
        </Field>

        {saveError && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, color: "#b91c1c", fontSize: 13, fontWeight: 600, lineHeight: 1.5, padding: "10px 14px", marginBottom: 8 }}>
            {saveError}
          </div>
        )}
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

function SummaryStrip({ counts }) {
  const items = [
    { label: "Tổng phòng",   value: counts.total,       color: "#475569", bg: "#f1f5f9" },
    { label: "Phòng trống",  value: counts.available,   color: "#10b981", bg: "#d1fae5" },
    { label: "Có người đặt", value: counts.reserved,    color: "#8b5cf6", bg: "#ede9fe" },
    { label: "Có khách",     value: counts.occupied,    color: "#3b82f6", bg: "#dbeafe" },
    { label: "Dọn phòng",   value: counts.cleaning,    color: "#f59e0b", bg: "#fef3c7" },
    { label: "Bảo trì",     value: counts.maintenance, color: "#ef4444", bg: "#fee2e2" },
  ].filter(i => i.value > 0 || i.label === "Tổng phòng");

  return (
    <div className="pr-summary-strip">
      {items.map(item => (
        <div key={item.label} className="pr-summary-item" style={{ background: item.bg }}>
          <span className="pr-summary-value" style={{ color: item.color }}>{item.value}</span>
          <span className="pr-summary-label" style={{ color: item.color }}>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function UnnumberedBanner({ count, hotelId, navigate, onDismiss }) {
  return (
    <div className="pr-unnumbered-banner">
      <AlertTriangle size={15} color="#d97706" style={{ flexShrink: 0 }} />
      <span className="pr-unnumbered-text">
        <strong>{count} phòng</strong> chưa được đặt số phòng — nên cập nhật để dễ quản lý.
      </span>
      <button
        className="pr-unnumbered-link"
        onClick={() => navigate(`/partner/room-units?hotelId=${hotelId}`)}
      >
        Cập nhật ngay <ChevronRight size={12} />
      </button>
      <button className="pr-unnumbered-close" onClick={onDismiss} title="Bỏ qua">
        <X size={13} />
      </button>
    </div>
  );
}

function UnitCard({ unit, hotelId, updateUnit }) {
  const [draft, setDraft] = useState({
    roomNumber: unit.roomNumber || "",
    floor:      unit.floor != null ? String(unit.floor) : "",
    notes:      unit.notes || "",
    guestName:  unit.guestName || "",
    status:     unit.status,
  });
  const [saving, setSaving] = useState(false);

  async function save(patch) {
    setSaving(true);
    try {
      await updateUnit.mutateAsync({
        roomId: unit.roomId, unitId: unit.id, hotelId,
        roomNumber:  patch.roomNumber?.trim() || null,
        floor:       patch.floor !== "" ? Number(patch.floor) : null,
        status:      patch.status,
        notes:       patch.notes?.trim() || null,
        guestName:   patch.guestName?.trim() || null,
        coverImageUrl: unit.coverImageUrl ?? null,
      });
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  }

  function onBlur(_field) {
    const next = { ...draft };
    if (
      next.roomNumber !== (unit.roomNumber || "") ||
      next.floor      !== (unit.floor != null ? String(unit.floor) : "") ||
      next.notes      !== (unit.notes || "") ||
      next.guestName  !== (unit.guestName || "") ||
      next.status     !== unit.status
    ) {
      save(next);
    }
  }

  const activeCfg = UNIT_STATUS_CONFIG[draft.status] || {};
  const needsGuest = draft.status === "OCCUPIED" || draft.status === "RESERVED";

  return (
    <div className="rup-unit-card" style={{ borderLeftColor: activeCfg.color || "#cbd5e1", opacity: saving ? 0.7 : 1 }}>
      {/* Row 1: số phòng + tầng */}
      <div className="rup-unit-top">
        <div className="rup-unit-num-wrap">
          <Hash size={10} color="#94a3b8" />
          <input
            className="rup-unit-input rup-unit-num-input"
            placeholder="Số phòng"
            maxLength={20}
            value={draft.roomNumber}
            onChange={e => setDraft(d => ({ ...d, roomNumber: e.target.value }))}
            onBlur={() => onBlur("roomNumber")}
            title="Số phòng (nhập tay)"
          />
          {unit.autoGenerated && !unit.roomNumber && (
            <span className="rup-auto-tag">Tự động</span>
          )}
        </div>
        <div className="rup-unit-floor-wrap" title="Số tầng">
          <Layers size={9} color="#94a3b8" />
          <input
            className="rup-unit-floor-input"
            placeholder="T?"
            type="number"
            min="0"
            value={draft.floor}
            onChange={e => setDraft(d => ({ ...d, floor: e.target.value }))}
            onBlur={() => onBlur("floor")}
          />
        </div>
      </div>

      {/* Row 2: status dropdown */}
      <select
        className="rup-status-select"
        value={draft.status}
        disabled={saving}
        onChange={e => {
          const next = { ...draft, status: e.target.value };
          setDraft(next);
          save(next);
        }}
        style={{ color: activeCfg.color }}
      >
        {Object.entries(UNIT_STATUS_CONFIG).map(([k, v]) => (
          <option key={k} value={k}>{v.label}</option>
        ))}
      </select>

      {/* Row 3: tên khách (chỉ hiện khi có khách hoặc đặt) */}
      {needsGuest && (
        <input
          className="rup-unit-input rup-guest-input"
          placeholder="Tên khách..."
          maxLength={200}
          value={draft.guestName}
          onChange={e => setDraft(d => ({ ...d, guestName: e.target.value }))}
          onBlur={() => onBlur("guestName")}
          title="Tên khách đang ở / đã đặt"
        />
      )}

      {/* Row 4: ghi chú */}
      <textarea
        className="rup-unit-input rup-notes-input"
        placeholder="Ghi chú..."
        maxLength={500}
        rows={2}
        value={draft.notes}
        onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))}
        onBlur={() => onBlur("notes")}
      />
    </div>
  );
}

function RoomUnitsPanel({ room, units = [], hotelId, onClose, navigate }) {
  const updateUnit = useUpdateRoomUnit();
  const [activeFilter, setActiveFilter] = useState("ALL");

  const counts = Object.fromEntries(Object.keys(UNIT_STATUS_CONFIG).map(k => [k, 0]));
  units.forEach(u => { if (counts[u.status] !== undefined) counts[u.status]++; });

  const displayed = activeFilter === "ALL" ? units : units.filter(u => u.status === activeFilter);

  const filterTabs = [
    { key: "ALL", label: "Tất cả", count: units.length },
    ...Object.entries(UNIT_STATUS_CONFIG)
      .filter(([k]) => counts[k] > 0)
      .map(([k, v]) => ({ key: k, label: v.label, count: counts[k], color: v.color, bg: v.bg })),
  ];

  return (
    <div className="rup-panel">
      {/* Header */}
      <div className="rup-header">
        <DoorOpen size={17} color="#BE1E2E" style={{ flexShrink: 0 }} />
        <div className="rup-header-title">
          <div className="rup-room-name">{room?.name}</div>
          <div className="rup-room-sub">{units.length} phòng vật lý</div>
        </div>
        <div className="rup-header-actions">
          <button
            className="rup-manage-btn"
            onClick={() => navigate(`/partner/room-units?roomId=${room?.id}&hotelId=${hotelId}`)}
          >
            Quản lý đầy đủ <ChevronRight size={13} />
          </button>
          <button className="rup-close-btn" onClick={onClose} title="Đóng">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      {units.length > 0 && (
        <div className="rup-filter-tabs">
          {filterTabs.map(tab => (
            <button
              key={tab.key}
              className={`rup-tab${activeFilter === tab.key ? " rup-tab--active" : ""}`}
              style={activeFilter === tab.key && tab.color ? { background: tab.bg, color: tab.color, borderColor: tab.color + "44" } : {}}
              onClick={() => setActiveFilter(tab.key)}
            >
              {tab.label}
              <span className="rup-tab-count">{tab.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Body */}
      {units.length === 0 ? (
        <div className="rup-empty">
          <DoorOpen size={28} style={{ opacity: 0.2, display: "block", margin: "0 auto 8px" }} />
          <div style={{ fontSize: 13, fontWeight: 600 }}>Chưa có phòng vật lý</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>Hệ thống sẽ tự động sinh phòng khi tạo loại phòng</div>
        </div>
      ) : (
        <div className="rup-grid">
          {displayed.map(unit => (
            <UnitCard key={unit.id} unit={unit} hotelId={hotelId} updateUnit={updateUnit} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function PartnerRooms() {
  const navigate = useNavigate();
  const { t } = useLang();
  const toast = useToast();
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
  const [sp] = useSearchParams();
  const { state: navState } = useLocation();
  const outletCtx = useOutletContext() || {};
  const { selectedHotelId: ctxHotelId, setSelectedHotelId: setCtxHotelId } = outletCtx;

  const queryClient = useQueryClient();
  const [selectedHotelId, setSelectedHotelId] = useState(
    () => sp.get("hotelId") || (ctxHotelId ? String(ctxHotelId) : "")
  );

  // Sync from sidebar hotel selection → local state
  useEffect(() => {
    if (ctxHotelId && !sp.get("hotelId")) {
      setSelectedHotelId(String(ctxHotelId));
    }
  }, [ctxHotelId]); // eslint-disable-line react-hooks/exhaustive-deps

  function selectHotel(id) {
    setSelectedHotelId(id);
    setCtxHotelId?.(id ? Number(id) : null);
    // FIX BUG-008: Reset pagination when switching hotels so the user never lands
    // on a page that doesn't exist for the newly selected hotel's room count.
    setPage(1);
    setExpandedRoomId(null);
    setOpenMenuId(null);
  }
  const [modal, setModal]       = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [saving, setSaving]     = useState(false);
  const [saveError, setSaveError] = useState("");
  const [showNewBanner, setShowNewBanner] = useState(!!navState?.newProperty);
  const [page, setPage]         = useState(1);
  const [error, _setError]      = useState("");
  const [searchText, setSearchText]     = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [roomAiSuggestion, setRoomAiSuggestion] = useState({ loading: false, data: null, error: false });
  const [expandedRoomId, setExpandedRoomId] = useState(null);
  const [openMenuId, setOpenMenuId]         = useState(null);
  const pageSize = 8;

  useEffect(() => {
    if (!openMenuId) return;
    function closeMenu() { setOpenMenuId(null); }
    document.addEventListener("click", closeMenu);
    return () => document.removeEventListener("click", closeMenu);
  }, [openMenuId]);

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
  const currentHotel = hotels.find(h => String(h.id) === String(selectedHotelId)) || null;
  const isEntire = currentHotel?.bookingMode === "ENTIRE";

  const { data: allUnitData = [] } = useHotelRoomUnits(selectedHotelId);
  const allUnits = Array.isArray(allUnitData) ? allUnitData : [];

  const unitsByRoomId = useMemo(() =>
    allUnits.reduce((acc, u) => { (acc[u.roomId] ??= []).push(u); return acc; }, {}),
  [allUnits]);

  const globalCounts = useMemo(() => ({
    total:       allUnits.length,
    available:   allUnits.filter(u => u.status === "AVAILABLE").length,
    reserved:    allUnits.filter(u => u.status === "RESERVED").length,
    occupied:    allUnits.filter(u => u.status === "OCCUPIED").length,
    cleaning:    allUnits.filter(u => u.status === "CLEANING").length,
    maintenance: allUnits.filter(u => u.status === "MAINTENANCE").length,
  }), [allUnits]);

  const unnumbered = useMemo(() => allUnits.filter(u => !u.roomNumber), [allUnits]);
  const [unnumberedDismissed, setUnnumberedDismissed] = useState(false);

  // Auto-select newly created hotel from wizard redirect
  useEffect(() => {
    if (navState?.newProperty && navState?.hotelId && hotels.length > 0) {
      const newId = String(navState.hotelId);
      if (hotels.find(h => String(h.id) === newId)) {
        selectHotel(newId);
      }
    }
  }, [hotels]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-select first hotel when list loads and nothing is selected
  useEffect(() => {
    if (!selectedHotelId && hotels.length > 0) {
      selectHotel(String(hotels[0].id));
    }
  }, [hotels]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mở edit modal cho room cụ thể khi navigate từ PartnerRoomUnits
  useEffect(() => {
    if (!navState?.openEditRoomId || rooms.length === 0) return;
    const target = rooms.find(r => r.id === navState.openEditRoomId);
    if (target) openEdit(target);
  }, [rooms]); // eslint-disable-line react-hooks/exhaustive-deps

  // Khôi phục form draft khi quay về từ trang tiện ích
  useEffect(() => {
    if (!navState?.returnedFromServices) return;
    try {
      const raw = sessionStorage.getItem("pr_room_form_draft");
      if (!raw) return;
      const { form: savedForm, modal: savedModal, selectedId, hotelId: savedHotelId } = JSON.parse(raw);
      sessionStorage.removeItem("pr_room_form_draft");
      if (savedHotelId) selectHotel(String(savedHotelId));
      setForm(savedForm);
      setModal(savedModal);
      if (savedModal === "edit" && selectedId) {
        const room = rooms.find(r => r.id === selectedId);
        if (room) setSelected(room);
      }
    } catch { /* noop */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const catalog = {
    roomCategories: Array.isArray(catalogData?.roomCategories) && catalogData.roomCategories.length ? catalogData.roomCategories : CATEGORIES.map(c => c.key),
    bedTypes:       Array.isArray(catalogData?.bedTypes)       && catalogData.bedTypes.length       ? catalogData.bedTypes       : BED_TYPES.map(b => b.key),
    roomAmenities:  Array.isArray(catalogData?.roomAmenities)  && catalogData.roomAmenities.length  ? catalogData.roomAmenities  : [...ROOM_AMENITY_KEYS],
  };

  const categoryOptions = catalog.roomCategories.map((key) => CATEGORIES.find((item) => item.key === key) || { key, label: key });
  const bedTypeOptions = catalog.bedTypes.map((key) => BED_TYPES.find((item) => item.key === key) || { key, label: key });

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
    setSaveError("");
    setForm({ ...EMPTY_FORM, images: [] });
    setRoomAiSuggestion({ loading: false, data: null, error: false });
    setModal("add");
  }

  // Cập nhật gợi ý giá tham khảo theo category khi ở modal Add
  useEffect(() => {
    if (modal !== "add") return;
    const sameCategory = rooms.filter(r => r.roomCategory === form.roomCategory && r.price > 0);
    if (sameCategory.length > 0) {
      const avg = Math.round(sameCategory.reduce((s, r) => s + r.price, 0) / sameCategory.length / 10000) * 10000;
      setRoomAiSuggestion({ loading: false, data: { suggestedPrice: avg, aiGenerated: false, isAddSuggestion: true }, error: false });
    } else {
      setRoomAiSuggestion({ loading: false, data: null, error: false });
    }
  }, [form.roomCategory, modal, rooms]);
  async function openEdit(room) {
    revokePendingImageUrls(form.images);
    setSaveError("");
    setSelected(room);
    setForm({
      name: room.name || "", capacity: room.capacity || 2, quantity: room.quantity || 1, price: room.price || 0,
      roomCategory: room.roomCategory || "STANDARD", bedType: room.bedType || "DOUBLE",
      amenities: room.amenities ? room.amenities.filter(key => ROOM_AMENITY_KEYS.has(key)) : [],
      customAmenities: room.customAmenities ? [...room.customAmenities] : [],
      images: createExistingImageItems(getRoomImageUrls(room)),
      description: room.description || "",
    });
    setModal("edit");
    setRoomAiSuggestion({ loading: true, data: null, error: false });
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
        setRoomAiSuggestion({ loading: false, data: { suggestedPrice: avg, aiGenerated: items.some(i => i.aiGenerated) }, error: false });
      } else {
        setRoomAiSuggestion({ loading: false, data: null, error: false });
      }
    }).catch(() => setRoomAiSuggestion({ loading: false, data: null, error: true }));
  }
  function openDelete(room) { setSelected(room); setModal("delete"); }

  function openDuplicate(room) {
    revokePendingImageUrls(form.images);
    setSelected(null);
    setSaveError("");
    setForm({
      name: `${room.name} (bản sao)`,
      capacity: room.capacity || 2,
      quantity: room.quantity > 0 ? room.quantity : 1,
      price: room.price || 0,
      roomCategory: room.roomCategory || "STANDARD",
      bedType: room.bedType || "DOUBLE",
      amenities: room.amenities ? room.amenities.filter(k => ROOM_AMENITY_KEYS.has(k)) : [],
      customAmenities: room.customAmenities ? [...room.customAmenities] : [],
      images: [],
      description: room.description || "",
    });
    setRoomAiSuggestion({ loading: false, data: null, error: false });
    setModal("add");
  }

  async function handleDeactivate(room) {
    try {
      await updateRoom.mutateAsync({
        roomId: room.id, hotelId: selectedHotelId,
        name: room.name, capacity: room.capacity, quantity: 0,
        price: room.price, roomCategory: room.roomCategory, bedType: room.bedType,
        amenities: room.amenities || [], customAmenities: room.customAmenities || [],
        imageUrls: getRoomImageUrls(room),
        description: room.description || null,
      });
      toast.success(`Đã tạm dừng kinh doanh phòng "${room.name}"`);
    } catch (e) { toast.error(e.message || "Không thể tạm dừng phòng"); }
  }

  function closeFormModal() {
    revokePendingImageUrls(form.images);
    setModal(null);
    setSelected(null);
    setForm({ ...EMPTY_FORM, images: [] });
    setRoomAiSuggestion({ loading: false, data: null, error: false });
  }

  async function handleSave() {
    if (!form.name.trim())                         { setSaveError("Vui lòng nhập tên loại phòng"); return; }
    if (form.name.trim().length < 2)               { setSaveError("Tên loại phòng phải có ít nhất 2 ký tự"); return; }
    if (form.name.trim().length > 100)             { setSaveError("Tên loại phòng không được vượt quá 100 ký tự"); return; }
    if (!Number.isFinite(Number(form.price)) || Number(form.price) < 0)
                                                   { setSaveError("Giá phòng phải là số ≥ 0"); return; }
    if (Number(form.price) > 0 && Number(form.price) < 10000)
                                                   { setSaveError("Giá phòng phải từ 10.000 ₫ trở lên"); return; }
    if (!Number.isInteger(Number(form.capacity)) || Number(form.capacity) < 1)
                                                   { setSaveError("Sức chứa phải là số nguyên ≥ 1"); return; }
    if (Number(form.capacity) > 30)                { setSaveError("Sức chứa tối đa là 30 khách"); return; }
    if (!Number.isInteger(Number(form.quantity)) || Number(form.quantity) < 1)
                                                   { setSaveError("Số lượng phòng phải là số nguyên ≥ 1"); return; }
    if (Number(form.quantity) > 500)               { setSaveError("Số lượng phòng tối đa là 500"); return; }
    const currentHotel = hotels.find(h => String(h.id) === String(selectedHotelId));
    if (currentHotel?.bookingMode === "ENTIRE" && Number(form.quantity) > 1)
                                                   { setSaveError("Cơ sở thuê nguyên căn chỉ cho phép tối đa 1 phòng mỗi loại"); return; }
    setSaving(true);
    setSaveError("");
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
        // existingImageUrls = ảnh cũ user GIỮ LẠI; payload đã chứa imageUrls đúng
        await updateRoom.mutateAsync({
          roomId: selected.id, hotelId: selectedHotelId,
          ...payload,
          // payload.imageUrls = existingImageUrls (đã tính ở trên), KHÔNG override bằng selected
        });
        // Xóa trên Cloudinary các ảnh bị remove khỏi form
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
      const wasAdd = modal === "add";
      const savedName = form.name;
      setModal(null);
      setSelected(null);
      setForm({ ...EMPTY_FORM, images: [] });
      setRoomAiSuggestion({ loading: false, data: null, error: false });
      toast.success(wasAdd
        ? `Đã thêm loại phòng "${savedName}" thành công`
        : `Đã cập nhật loại phòng "${savedName}" thành công`
      );
    } catch (e) {
      const fieldErrors = e.details?.map(d => `${d.field}: ${d.message}`).join("; ");
      const msg = fieldErrors ? `${e.message} (${fieldErrors})` : e.message;
      setSaveError(msg);
      toast.error(msg);
    }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    setSaving(true);
    const deletedName = selected?.name;
    try {
      await deleteRoomMut.mutateAsync({ roomId: selected.id, hotelId: selectedHotelId });
      setModal(null);
      toast.success(`Đã xóa loại phòng "${deletedName}"`);
    } catch (e) {
      toast.error(e.message || "Không thể xóa loại phòng");
      alert(e.message);
    }
    finally { setSaving(false); }
  }

  return (
    <div className="pr-root">
      <PageHeader
        title={isEntire ? "Thông tin căn" : t("pt_rooms_title")}
        subtitle={isEntire ? "Quản lý thông tin, giá và tiện ích của căn cho thuê" : t("pt_rooms_subtitle")}
        action={selectedHotelId && !(isEntire && rooms.length >= 1) && (
          <button className="pr-add-btn" onClick={openAdd}>
            <Plus size={20} /> {isEntire ? "Thêm thông tin căn" : t("pt_rooms_add_btn")}
          </button>
        )}
      />

      {/* New property onboarding banner */}
      {showNewBanner && (
        <div style={{
          display: "flex", alignItems: "center", gap: 14,
          background: "linear-gradient(135deg, #fff5f5, #fff1f2)",
          border: "1px solid #fecaca", borderRadius: 14,
          padding: "16px 20px", marginBottom: 20,
        }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: "#BE1E2E", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Sparkles size={20} color="#fff" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: "#1e293b", marginBottom: 3 }}>
              Cơ sở đã được tạo thành công!
            </div>
            <div style={{ fontSize: 13, color: "#64748b" }}>
              {isEntire
                ? <>Hãy bổ sung <strong>ảnh</strong>, <strong>tiện ích</strong> và <strong>giá</strong> cho căn để tăng khả năng được đặt.</>
                : <>Hãy bổ sung <strong>ảnh</strong> và <strong>tiện ích</strong> cho từng loại phòng để tăng khả năng được đặt phòng.</>
              }
            </div>
          </div>
          <button
            onClick={() => setShowNewBanner(false)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 4, flexShrink: 0 }}
            title="Đóng"
          >
            ✕
          </button>
        </div>
      )}

      {/* Hotel Selector — chip cards */}
      {hotels.length > 0 && (
        <div className="pr-hotel-chips-wrap">
          <div className="pr-hotel-chips-label">
            <Home size={16} color="#BE1E2E" /> Chọn cơ sở:
          </div>
          <div className="pr-hotel-chips-row">
            {hotels.map(h => {
              const thumb = h.coverImageUrl || (Array.isArray(h.imageUrls) ? h.imageUrls[0] : "");
              const active = String(h.id) === String(selectedHotelId);
              return (
                <button
                  key={h.id}
                  className={`pr-hotel-chip${active ? " pr-hotel-chip--active" : ""}`}
                  onClick={() => selectHotel(String(h.id))}
                >
                  <div className="pr-hotel-chip-thumb">
                    {thumb
                      ? <img src={thumb} alt={h.name} />
                      : <Building2 size={18} color="#94a3b8" />
                    }
                  </div>
                  <div className="pr-hotel-chip-info">
                    <div className="pr-hotel-chip-name">{h.name}</div>
                    {(h.district || h.province) && (
                      <div className="pr-hotel-chip-loc">
                        <MapPin size={10} /> {[h.district, h.province].filter(Boolean).join(", ")}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

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
          <h3 className="pr-empty-title">{isEntire ? "Chưa có thông tin căn" : t("pt_rooms_empty_title")}</h3>
          <p className="pr-empty-desc">{isEntire ? "Thêm thông tin để khách có thể đặt căn của bạn" : t("pt_rooms_empty_desc")}</p>
          <Btn onClick={openAdd}>{isEntire ? "Thêm thông tin căn" : t("pt_rooms_add_btn")}</Btn>
        </Card>
      ) : (
        <>
          {/* Filter bar — ẩn với ENTIRE vì chỉ có 1 đơn vị */}
          {!isEntire && (
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
          )}

          {/* Summary strip + unnumbered banner */}
          {globalCounts.total > 0 && <SummaryStrip counts={globalCounts} />}
          {unnumbered.length > 0 && !unnumberedDismissed && selectedHotelId && (
            <UnnumberedBanner
              count={unnumbered.length}
              hotelId={selectedHotelId}
              navigate={navigate}
              onDismiss={() => setUnnumberedDismissed(true)}
            />
          )}

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
                    {isEntire ? "Căn cho thuê" : (categoryOptions.find(c => c.key === r.roomCategory)?.label || r.roomCategory || "PHÒNG").toUpperCase()}
                  </span>
                </div>
                <div className="pr-room-price-wrap">
                  <span className="pr-room-price-badge">{fmtPrice(r.price)}</span>
                </div>
                {r.quantity === 0 && (
                  <div className="pr-room-status-badge">
                    <Power size={11} /> Tạm ngừng
                  </div>
                )}
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
                  {!isEntire && (
                  <div className="pr-room-meta-item">
                    <div className="pr-room-meta-icon"><Grid size={14} color="#64748b" /></div>
                    {r.quantity} phòng
                  </div>
                  )}
                  <div className="pr-room-meta-item">
                    <div className="pr-room-meta-icon"><Wrench size={14} color="#64748b" /></div>
                    {(r.amenities?.length || 0) + (r.customAmenities?.length || 0)} tiện ích
                  </div>
                </div>

                {/* Unit progress bar — derived from hotel-wide unit fetch */}
                {(() => {
                  const uc = getUnitCounts(unitsByRoomId[r.id] || []);
                  return uc.total > 0 ? (
                    <div className="pr-avail-bar-wrap">
                      <div className="pr-avail-bar">
                        <div className="pr-bar-seg pr-bar-avail"    style={{ width: `${uc.pct(uc.avail)}%` }} />
                        <div className="pr-bar-seg pr-bar-reserved" style={{ width: `${uc.pct(uc.reserved)}%` }} />
                        <div className="pr-bar-seg pr-bar-occ"      style={{ width: `${uc.pct(uc.occ)}%` }} />
                        <div className="pr-bar-seg pr-bar-clean"    style={{ width: `${uc.pct(uc.clean)}%` }} />
                        <div className="pr-bar-seg pr-bar-maint"    style={{ width: `${uc.pct(uc.maint)}%` }} />
                      </div>
                      <div className="pr-avail-legend">
                        {uc.avail    > 0 && <span className="pr-leg-avail">{uc.avail} trống</span>}
                        {uc.reserved > 0 && <span className="pr-leg-reserved">{uc.reserved} đã đặt</span>}
                        {uc.occ      > 0 && <span className="pr-leg-occ">{uc.occ} có khách</span>}
                        {uc.clean    > 0 && <span className="pr-leg-clean">{uc.clean} dọn phòng</span>}
                        {uc.maint    > 0 && <span className="pr-leg-maint">{uc.maint} bảo trì</span>}
                      </div>
                    </div>
                  ) : (
                    <div className="pr-unit-availability pr-unit-availability--none">
                      <DoorOpen size={13} color="#94a3b8" />
                      <span className="pr-unit-avail-text" style={{ color: "#94a3b8" }}>Chưa có phòng vật lý</span>
                    </div>
                  );
                })()}

                <div className="pr-room-actions">
                  <button className="pr-edit-btn" onClick={() => openEdit(r)}>
                    <Edit3 size={15} /> {t("adm_edit")}
                  </button>
                  <button
                    className={`pr-units-btn${expandedRoomId === r.id ? " pr-units-btn--active" : ""}`}
                    onClick={() => setExpandedRoomId(expandedRoomId === r.id ? null : r.id)}
                    title={expandedRoomId === r.id ? "Đóng danh sách phòng" : "Xem danh sách phòng vật lý"}
                  >
                    {expandedRoomId === r.id ? <ChevronUp size={15} /> : <DoorOpen size={15} />}
                    {(unitsByRoomId[r.id]?.length || 0) > 0
                      ? `${unitsByRoomId[r.id].length} ${isEntire ? "đơn vị" : "phòng"}`
                      : isEntire ? "Xem đơn vị" : "Xem phòng"}
                  </button>
                  <button
                    className="pr-quick-btn"
                    title="Lịch & giá phòng"
                    aria-label="Xem lịch và giá phòng"
                    onClick={() => navigate(`/partner/calendar?roomId=${r.id}`)}
                  >
                    <CalendarDays size={14} aria-hidden="true" />
                  </button>
                  {/* Overflow menu */}
                  <div className="pr-overflow-wrap" onClick={e => e.stopPropagation()}>
                    <button
                      className="pr-quick-btn"
                      title="Thêm tùy chọn"
                      aria-label="Thêm tùy chọn"
                      onClick={() => setOpenMenuId(openMenuId === r.id ? null : r.id)}
                    >
                      <MoreHorizontal size={15} aria-hidden="true" />
                    </button>
                    {openMenuId === r.id && (
                      <div className="pr-overflow-menu">
                        {!isEntire && (
                        <button className="pr-overflow-item" onClick={() => { setOpenMenuId(null); openDuplicate(r); }}>
                          <Copy size={13} /> Nhân bản
                        </button>
                        )}
                        {r.quantity > 0 && (
                          <button className="pr-overflow-item" onClick={() => { setOpenMenuId(null); handleDeactivate(r); }}>
                            <Power size={13} /> Tạm dừng
                          </button>
                        )}
                        <button className="pr-overflow-item pr-overflow-item--danger" onClick={() => { setOpenMenuId(null); openDelete(r); }}>
                          <Trash2 size={13} /> Xóa phòng
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
          )}
        </>
      )}

      {/* Accordion unit panel */}
      {expandedRoomId && (() => {
        const expandedRoom = rooms.find(r => r.id === expandedRoomId);
        return expandedRoom ? (
          <RoomUnitsPanel
            room={expandedRoom}
            units={unitsByRoomId[expandedRoomId] || []}
            hotelId={selectedHotelId}
            onClose={() => setExpandedRoomId(null)}
            navigate={navigate}
          />
        ) : null;
      })()}

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
          hotel={hotels.find(h => String(h.id) === String(selectedHotelId)) || null}
          aiSuggestion={roomAiSuggestion}
          isAdd={modal === "add"}
          saveError={saveError}
          onGoToServices={() => {
            try {
              sessionStorage.setItem("pr_room_form_draft", JSON.stringify({
                form, modal, selectedId: selected?.id, hotelId: selectedHotelId,
              }));
            } catch { /* noop */ }
            navigate("/partner/services", {
              state: { returnToRooms: true, hotelId: selectedHotelId },
            });
          }}
          originalQuantity={modal === "edit" ? selected?.quantity : null}
        />
      )}

      {modal === "delete" && (
        <Modal title={t("pt_rooms_del_title")} onClose={() => setModal(null)} width={460}>
          <div className="pr-delete-modal-content">
            <div className="pr-delete-modal-icon">
              <Trash2 size={32} color="#ef4444" />
            </div>
            <h3 className="pr-delete-modal-title">{t("adm_confirm")}</h3>
            {/* FIX BUG-006: Replaced dangerouslySetInnerHTML with safe React element composition.
                Room names are partner-controlled input and must never be injected as raw HTML. */}
            <p className="pr-delete-modal-desc">
              {(() => {
                const template = t("pt_rooms_del_desc");
                const parts = template.split("{name}");
                return parts.length === 2
                  ? <>{parts[0]}<strong>&ldquo;{selected?.name}&rdquo;</strong>{parts[1]}</>
                  : template;
              })()}
            </p>
            <div className="pr-delete-cascade-warn">
              <AlertTriangle size={15} color="#d97706" style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <div style={{ fontWeight: 700, color: "#92400e", marginBottom: 4 }}>Hành động này không thể hoàn tác</div>
                <div style={{ color: "#78350f", lineHeight: 1.5 }}>
                  Toàn bộ <strong>lịch giá</strong>, <strong>tồn kho</strong> và <strong>dữ liệu đặt phòng</strong> của loại phòng này sẽ bị xóa vĩnh viễn.
                </div>
              </div>
            </div>
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
