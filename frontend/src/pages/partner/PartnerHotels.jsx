import { useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import {
  useMyHotels, useCatalogOptions,
  useUpdateHotel, useDeleteHotel,
  useUploadHotelImages, useDeleteHotelImage, useSetHotelCoverImage,
} from "../../hooks/usePartnerQueries";
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
  Building2, MapPin, Star, Edit2, Trash2,
  Search, Plus, LayoutDashboard, DoorOpen,
  CheckCircle2, Clock, Ban, AlertTriangle
} from "lucide-react";
import AmenityPicker from "../../components/partner/AmenityPicker";
import { HOTEL_AMENITY_CATEGORIES, HOTEL_AMENITIES_FLAT, HOTEL_AMENITY_KEYS } from "../../utils/amenityConfig";
import "../../styles/pages/partner/PartnerHotels.css";
import { useLang } from "../../contexts/LanguageContext";
import { getGroupColor, getTypeLabel } from "../../utils/propertyGroupUtils";
import { useVnLocations } from "../../hooks/useVnLocations";

// --- Configuration & Helpers ---
const HOTEL_TYPES = ["HOTEL", "APARTMENT", "RESORT", "VILLA", "HOMESTAY", "HOSTEL", "GUEST_HOUSE"];

const HOTEL_STATUS_CONFIG = {
  ACTIVE:   { label: "Đang hoạt động", color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0", Icon: CheckCircle2 },
  INACTIVE: { label: "Tạm ngừng",      color: "#d97706", bg: "#fffbeb", border: "#fde68a", Icon: Clock         },
  BLOCKED:  { label: "Bị chặn",        color: "#dc2626", bg: "#fef2f2", border: "#fecaca", Icon: Ban           },
};
const BOOKING_MODE_OPTIONS = [
  { value: "BY_ROOM",  label: "Đặt theo phòng (Khách sạn tiêu chuẩn)" },
  { value: "ENTIRE",   label: "Đặt nguyên căn (Villa, Căn hộ)" },
];

const EMPTY_FORM = {
  name: "", province: "", district: "", address: "",
  hotelType: "HOTEL", bookingMode: "BY_ROOM", description: "",
  amenities: [], customAmenities: [],
  images: [], coverImageUrl: "",
  cancellationPolicy: "MODERATE",
};

const CANCELLATION_POLICY_OPTIONS = [
  { value: "FLEXIBLE", label: "Linh hoạt", desc: "Hủy miễn phí trước 24h" },
  { value: "MODERATE", label: "Trung bình", desc: "Hủy miễn phí trước 7 ngày" },
  { value: "STRICT",   label: "Nghiêm ngặt", desc: "Không hoàn tiền khi hủy" },
];

function HotelStatusBadge(status) {
  const cfg = HOTEL_STATUS_CONFIG[status] || HOTEL_STATUS_CONFIG.ACTIVE;
  return (
    <span className="partner-hotel-card-status-badge" style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
      <cfg.Icon size={11} />
      {cfg.label}
    </span>
  );
}

function getHotelImageUrl(hotel) {
  const imageUrls = getHotelImageUrls(hotel);
  return hotel?.coverImageUrl || imageUrls[0] || "";
}

function getHotelImageUrls(hotel) {
  const imageUrls = Array.isArray(hotel?.imageUrls) ? hotel.imageUrls : [];
  const legacyImages = Array.isArray(hotel?.images) ? hotel.images : [];
  return imageUrls.length ? imageUrls : legacyImages;
}

// --- Components ---

function Field({ label, children, required }) {
  return (
    <div className="partner-hotel-form-field">
      <div className="partner-hotel-form-label">
        {label} {required && <span className="partner-hotel-form-required">*</span>}
      </div>
      {children}
    </div>
  );
}

function HotelForm({ form, setForm, onSubmit, onCancel, saving, title, hotelTypes, saveError }) {
  const { t } = useLang();
  const [imageError, setImageError] = useState("");
  const HOTEL_TYPE_LABELS = {
    HOTEL: t("pt_type_hotel"), APARTMENT: t("pt_type_apartment"), RESORT: t("pt_type_resort"),
    VILLA: t("pt_type_villa"), HOMESTAY: t("pt_type_homestay"), HOSTEL: t("pt_type_hostel"), GUEST_HOUSE: t("pt_type_guest_house"),
  };
  const { provinceOptions, districtOptions, loadingProvinces, loadingDistricts } = useVnLocations(form.province);
  const visibleDistricts = form.district && !districtOptions.includes(form.district)
    ? [form.district, ...districtOptions]
    : districtOptions;

  return (
    <Modal title={title} onClose={onCancel} width={640}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: "80vh", overflowY: "auto", paddingRight: 8 }}>
        <Field label={t("pt_hotels_name")} required>
          <input className="partner-hotel-form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder={t("pt_hotels_name_ph")} />
        </Field>

        <div className="partner-hotel-form-grid">
          <Field label={t("pt_hotels_province")} required>
            <select
              className="partner-hotel-form-input"
              value={form.province}
              onChange={e => setForm(f => ({ ...f, province: e.target.value, district: "" }))}
              disabled={loadingProvinces}
            >
              <option value="">{loadingProvinces ? "Đang tải..." : t("pt_hotels_province_ph")}</option>
              {provinceOptions.map(p => <option key={p.code} value={p.name}>{p.name}</option>)}
            </select>
          </Field>
          <Field label={t("pt_hotels_district")} required>
            <select
              className="partner-hotel-form-input"
              value={form.district}
              onChange={e => setForm(f => ({ ...f, district: e.target.value }))}
              disabled={!form.province || loadingDistricts}
            >
              <option value="">{loadingDistricts ? "Đang tải quận/huyện..." : t("pt_hotels_district_ph")}</option>
              {visibleDistricts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </Field>
        </div>

        <Field label={t("pt_hotels_address")} required>
          <input className="partner-hotel-form-input" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder={t("pt_hotels_address_ph")} />
        </Field>

        <div className="partner-hotel-form-grid">
          <Field label={t("pt_hotels_type")}>
            <select className="partner-hotel-form-input" value={form.hotelType} onChange={e => setForm(f => ({ ...f, hotelType: e.target.value }))}>
              {hotelTypes.map(ht => <option key={ht} value={ht}>{HOTEL_TYPE_LABELS[ht] || ht}</option>)}
            </select>
          </Field>
          <Field label="Chế độ đặt phòng">
            <select className="partner-hotel-form-input" value={form.bookingMode || "BY_ROOM"} onChange={e => setForm(f => ({ ...f, bookingMode: e.target.value }))}>
              {BOOKING_MODE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
        </div>

        <Field label={t("pt_hotels_desc")}>
          <textarea className="partner-hotel-form-input" style={{ height: 120, resize: "vertical" }} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder={t("pt_hotels_desc_ph")} />
        </Field>

        <Field label="Chính sách hủy phòng">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {CANCELLATION_POLICY_OPTIONS.map(p => (
              <label key={p.value} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 8, border: form.cancellationPolicy === p.value ? "2px solid #BE1E2E" : "1px solid #e5e7eb", cursor: "pointer", background: form.cancellationPolicy === p.value ? "#fff5f5" : "#fff" }}>
                <input type="radio" checked={form.cancellationPolicy === p.value} onChange={() => setForm(f => ({ ...f, cancellationPolicy: p.value }))} style={{ accentColor: "#BE1E2E" }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "#374151" }}>{p.label}</div>
                  <div style={{ fontSize: 12, color: "#9ca3af" }}>{p.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </Field>

        <Field label={t("pt_hotels_amenities")}>
          <AmenityPicker
            categories={HOTEL_AMENITY_CATEGORIES}
            selected={form.amenities}
            customAmenities={form.customAmenities || []}
            onChange={(amenities, customAmenities) => setForm(f => ({ ...f, amenities, customAmenities }))}
          />
        </Field>

        <Field label={t("pt_hotels_images")}>
          <p className="partner-hotel-img-cover-hint">Nhấn vào ảnh đã lưu để đặt làm <strong>ảnh bìa</strong> (hiển thị đầu tiên cho khách)</p>
          <div className="partner-hotel-img-grid">
            {form.images?.map((img, idx) => {
              const url = imageItemUrl(img);
              const isCover = form.coverImageUrl ? url === form.coverImageUrl : idx === 0;
              return (
              <div
                key={img?.id || url || idx}
                className={`partner-hotel-img-thumb${isCover ? " partner-hotel-img-thumb--cover" : ""}`}
                onClick={() => !img?.file && setForm(f => ({ ...f, coverImageUrl: url }))}
                title={!img?.file ? (isCover ? "Ảnh bìa hiện tại" : "Nhấn để đặt làm ảnh bìa") : ""}
                style={{ cursor: !img?.file ? "pointer" : "default" }}
              >
                <img src={url} alt="" />
                {isCover && (
                  <span className="partner-hotel-img-cover-badge">
                    <Star size={10} fill="#fff" color="#fff" /> Bìa
                  </span>
                )}
                <button
                  onClick={e => {
                    e.stopPropagation();
                    setForm(f => {
                      const images = [...(f.images || [])];
                      const [removed] = images.splice(idx, 1);
                      revokePendingImageUrls([removed]);
                      const newCover = f.coverImageUrl === url ? "" : f.coverImageUrl;
                      return { ...f, images, coverImageUrl: newCover };
                    });
                  }}
                  className="partner-hotel-img-remove"
                >
                  <Trash2 size={12} />
                </button>
              </div>
              );
            })}
            <label className="partner-hotel-img-add">
              <Plus size={24} />
              <div className="partner-hotel-img-add-label">{t("pt_hotels_img_add")}</div>
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
          <p className="partner-hotel-img-hint">{t("pt_hotels_img_hint")}</p>
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
        <div className="partner-hotel-form-actions">
          <Btn variant="ghost" onClick={onCancel}>{t("adm_cancel")}</Btn>
          <Btn onClick={onSubmit} disabled={saving || !form.name.trim()}>
            {saving ? t("adm_processing") : t("adm_save")}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

export default function PartnerHotels() {
  const { t } = useLang();
  const rrNavigate = useNavigate();
  const [modal, setModal]       = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [saving, setSaving]     = useState(false);
  const [saveError, setSaveError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage]         = useState(1);
  const pageSize = 8;

  const { setSelectedHotelId } = useOutletContext() || {};
  const { data: hotelData, isLoading: loading, error: queryError } = useMyHotels();
  const { data: catalogData } = useCatalogOptions();
  const error = queryError?.message || "";

  const updateHotel      = useUpdateHotel();
  const deleteHotelMut   = useDeleteHotel();
  const uploadImages     = useUploadHotelImages();
  const deleteImageMut   = useDeleteHotelImage();
  const setCoverImageMut = useSetHotelCoverImage();

  const hotels  = Array.isArray(hotelData) ? hotelData : [];
  const catalog = {
    hotelTypes:    Array.isArray(catalogData?.hotelTypes)    && catalogData.hotelTypes.length    ? catalogData.hotelTypes    : HOTEL_TYPES,
    hotelAmenities: Array.isArray(catalogData?.hotelAmenities) && catalogData.hotelAmenities.length ? catalogData.hotelAmenities : [...HOTEL_AMENITY_KEYS],
  };

  const hotelTypeOptions = Array.isArray(catalog.hotelTypes) && catalog.hotelTypes.length ? catalog.hotelTypes : HOTEL_TYPES;

  const q = searchTerm.toLowerCase();
  const filteredHotels = hotels.filter(h =>
    (h.name     || "").toLowerCase().includes(q) ||
    (h.province || "").toLowerCase().includes(q) ||
    (h.district || "").toLowerCase().includes(q) ||
    (h.address  || "").toLowerCase().includes(q)
  );

  function openAdd() {
    rrNavigate("/partner/add-property");
  }
  function openEdit(hotel) {
    revokePendingImageUrls(form.images);
    setSaveError("");
    setSelected(hotel);
    setForm({
      name: hotel.name || "", province: hotel.province || "", district: hotel.district || "",
      address: hotel.address || "", hotelType: hotel.hotelType || "HOTEL",
      bookingMode: hotel.bookingMode || "BY_ROOM",
      description: hotel.description || "",
      amenities: hotel.amenities ? [...hotel.amenities] : [],
      customAmenities: hotel.customAmenities ? [...hotel.customAmenities] : [],
      images: createExistingImageItems(getHotelImageUrls(hotel)),
      coverImageUrl: hotel.coverImageUrl || "",
      cancellationPolicy: hotel.cancellationPolicy || "MODERATE",
    });
    setModal("edit");
  }
  function openDelete(hotel) { setSelected(hotel); setModal("delete"); }

  function closeFormModal() {
    revokePendingImageUrls(form.images);
    setModal(null);
    setSelected(null);
    setForm({ ...EMPTY_FORM, images: [] });
  }

  async function handleSave() {
    if (!form.name.trim())                 { setSaveError("Vui lòng nhập tên cơ sở"); return; }
    if (form.name.trim().length < 5)       { setSaveError("Tên cơ sở phải có ít nhất 5 ký tự"); return; }
    if (form.name.trim().length > 100)     { setSaveError("Tên cơ sở không được vượt quá 100 ký tự"); return; }
    if (!form.province.trim())             { setSaveError("Vui lòng nhập Tỉnh / Thành phố"); return; }
    if (!form.district.trim())             { setSaveError("Vui lòng nhập Quận / Huyện"); return; }
    if (!form.address.trim())              { setSaveError("Vui lòng nhập địa chỉ"); return; }
    if (form.address.trim().length < 5)    { setSaveError("Địa chỉ phải có ít nhất 5 ký tự"); return; }
    setSaving(true);
    setSaveError("");
    try {
      const images = form.images || [];
      const existingImageUrls = existingImageUrlsFromItems(images);
      const pendingFiles = pendingImageFilesFromItems(images);
      const payload = { ...form, imageUrls: existingImageUrls };
      delete payload.images;
      delete payload.coverImageUrl;

      await updateHotel.mutateAsync({ id: selected.id, ...payload });
      // Xóa trên Cloudinary các ảnh bị remove khỏi form
      const remaining = new Set(existingImageUrls);
      const removed = getHotelImageUrls(selected).filter(url => !remaining.has(url));
      for (const imageUrl of removed) {
        await deleteImageMut.mutateAsync({ id: selected.id, imageUrl });
      }
      if (pendingFiles.length > 0) {
        await uploadImages.mutateAsync({ id: selected.id, files: pendingFiles });
      }
      // Cập nhật ảnh bìa nếu user thay đổi
      const desiredCover = form.coverImageUrl || existingImageUrls[0] || "";
      if (desiredCover && desiredCover !== selected.coverImageUrl) {
        try { await setCoverImageMut.mutateAsync({ id: selected.id, imageUrl: desiredCover }); } catch { /* noop */ }
      }
      revokePendingImageUrls(images);
      setModal(null);
      setSelected(null);
      setForm({ ...EMPTY_FORM, images: [] });
    } catch (e) { setSaveError(e.message); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    setSaving(true);
    try {
      await deleteHotelMut.mutateAsync(selected.id);
      setModal(null);
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="partner-hotel-root">
      <PageHeader
        title={t("pt_hotels_title")}
        subtitle={t("pt_hotels_subtitle")}
        action={
          <button onClick={openAdd} className="partner-hotel-add-btn">
            <Plus size={20} /> {t("pt_hotels_add_btn")}
          </button>
        }
      />

      {/* Filter Bar */}
      <div className="partner-hotel-filter-bar">
        <div className="partner-hotel-filter-search-wrap">
          <Search size={20} color="#94a3b8" className="partner-hotel-filter-search-icon" />
          <input
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); setPage(1); }}
            placeholder={t("pt_hotels_search_ph")}
            className="partner-hotel-filter-search-input"
          />
        </div>
        <div className="partner-hotel-filter-count-wrap">
          <div className="partner-hotel-filter-divider" />
          <div className="partner-hotel-filter-count">
            <span className="partner-hotel-filter-count-num">{filteredHotels.length}</span> {t("pt_hotels_results")}
          </div>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: 18, padding: "12px 14px", borderRadius: 12, background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", fontSize: 13, fontWeight: 700 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="partner-hotel-loading">
          <div className="ui-spinner" />
          {t("pt_hotels_loading")}
        </div>
      ) : filteredHotels.length === 0 ? (
        <div className="partner-hotel-empty">
          <Building2 size={64} color="#e2e8f0" style={{ marginBottom: 20 }} />
          <h3 className="partner-hotel-empty-title">{t("pt_hotels_empty_title")}</h3>
          <p className="partner-hotel-empty-desc">{t("pt_hotels_empty_desc")}</p>
          <Btn onClick={openAdd}>{t("pt_hotels_add_now")}</Btn>
        </div>
      ) : (
        <div className="partner-hotel-grid">
          {filteredHotels.slice((page - 1) * pageSize, page * pageSize).map((h) => (
            <div key={h.id} className="partner-hotel-card">
              {/* Card Image */}
              <div className="partner-hotel-card-img-wrap">
                {getHotelImageUrl(h) ? (
                  <img src={getHotelImageUrl(h)} alt={h.name} className="partner-hotel-card-img" />
                ) : (
                  <div className="partner-hotel-card-img" style={{ alignItems: "center", background: "#f8fafc", color: "#cbd5e1", display: "flex", justifyContent: "center" }}>
                    <Building2 size={46} />
                  </div>
                )}
                <span className="partner-hotel-card-type-badge" style={{ background: getGroupColor(h.hotelType) }}>
                  {(getTypeLabel(h.hotelType, "vi") || "").toUpperCase()}
                </span>
                {/* Status badge */}
                {HotelStatusBadge(h.status)}
              </div>

              {/* Card Content */}
              <div className="partner-hotel-card-body">
                <div className="partner-hotel-card-header">
                  <h3 className="partner-hotel-card-name">{h.name}</h3>
                  <div className="partner-hotel-card-rating">
                    <Star size={16} fill="#f59e0b" color="#f59e0b" />
                    <span className="partner-hotel-card-rating-val">
                      {h.ratingAvg && Number(h.ratingAvg) > 0 ? Number(h.ratingAvg).toFixed(1) : "—"}
                    </span>
                  </div>
                </div>

                <div className="partner-hotel-card-location">
                  <MapPin size={16} color="#64748b" />
                  {h.district}, {h.province}
                </div>

                <div className="partner-hotel-card-amenities">
                  {h.amenities?.slice(0, 4).map(a => {
                    const am = HOTEL_AMENITIES_FLAT.find(x => x.key === a);
                    return (
                      <span key={a} className="partner-hotel-card-chip">
                        {am && <am.Icon size={14} color="#64748b" />}
                        {am?.label || a}
                      </span>
                    );
                  })}
                  {h.amenities?.length > 4 && <span className="partner-hotel-card-chip-more">+{h.amenities.length - 4}</span>}
                </div>

                {/* Card Actions */}
                <div className="partner-hotel-card-actions">
                  <button
                    onClick={() => { setSelectedHotelId?.(h.id); rrNavigate("/partner"); }}
                    className="partner-hotel-card-btn partner-hotel-card-btn-manage"
                  >
                    <LayoutDashboard size={16} /> {t("pt_hotels_view_dashboard") || "Dashboard"}
                  </button>
                  <button
                    onClick={() => rrNavigate(`/partner/rooms?hotelId=${h.id}`)}
                    className="partner-hotel-card-btn partner-hotel-card-btn-rooms"
                  >
                    <DoorOpen size={16} /> Phòng
                  </button>
                  <button
                    onClick={() => openEdit(h)}
                    className="partner-hotel-card-btn partner-hotel-card-btn-icon"
                    aria-label={`Chỉnh sửa ${h.name}`}
                  >
                    <Edit2 size={16} aria-hidden="true" />
                  </button>
                  <button
                    onClick={() => openDelete(h)}
                    className="partner-hotel-card-btn partner-hotel-card-btn-delete partner-hotel-card-btn-icon"
                    aria-label={`Xóa ${h.name}`}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Dashed card: Thêm cơ sở mới */}
          <button
            onClick={openAdd}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              gap: 12, minHeight: 220, borderRadius: 20, border: "2px dashed #e2e8f0",
              background: "transparent", cursor: "pointer", color: "#94a3b8", transition: "all 0.2s",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#BE1E2E"; e.currentTarget.style.color = "#BE1E2E"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.color = "#94a3b8"; }}
          >
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Plus size={24} />
            </div>
            <span style={{ fontSize: 14, fontWeight: 700 }}>{t("pt_hotels_add_btn") || "Thêm cơ sở mới"}</span>
          </button>
        </div>
      )}

      {/* Pagination */}
      {filteredHotels.length > pageSize && (
        <div className="ui-pagination">
          {[...Array(Math.ceil(filteredHotels.length / pageSize))].map((_, i) => (
            <button
              key={i}
              onClick={() => { setPage(i + 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}
              className={`ui-page-btn${page === i + 1 ? " active" : ""}`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}

      {/* Modals */}
      {modal === "edit" && (
        <HotelForm
          title={t("pt_hotels_form_edit")}
          form={form} setForm={setForm} onSubmit={handleSave} onCancel={closeFormModal} saving={saving}
          hotelTypes={hotelTypeOptions}
          saveError={saveError}
        />
      )}

      {modal === "delete" && (
        <Modal title={t("pt_hotels_del_title")} onClose={() => setModal(null)} width={460}>
          <div>
            <div className="partner-hotel-delete-icon-wrap">
              <Trash2 size={32} color="#ef4444" />
            </div>
            <h3 className="partner-hotel-delete-title">{t("pt_hotels_del_confirm")}</h3>
            <p className="partner-hotel-delete-desc"
              dangerouslySetInnerHTML={{ __html: t("pt_hotels_del_desc").replace("{name}", `<strong>"${selected?.name}"</strong>`) }}
            />
            <div className="partner-hotel-delete-cascade-warn">
              <AlertTriangle size={15} color="#d97706" style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <div style={{ fontWeight: 700, color: "#92400e", marginBottom: 4 }}>Hành động này không thể hoàn tác</div>
                <div style={{ color: "#78350f", lineHeight: 1.5 }}>
                  Tất cả <strong>phòng</strong>, <strong>lịch giá</strong> và <strong>dữ liệu đặt phòng</strong> liên quan đến cơ sở này sẽ bị xóa vĩnh viễn.
                </div>
              </div>
            </div>
            <div className="partner-hotel-delete-actions">
              <button onClick={() => setModal(null)} className="partner-hotel-delete-cancel-btn">{t("adm_cancel")}</button>
              <button onClick={handleDelete} disabled={saving} className="partner-hotel-delete-confirm-btn">
                {saving ? t("pt_hotels_deleting") : t("pt_hotels_del_submit")}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
