import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  useMyHotels, useCatalogOptions, partnerKeys,
  useCreateHotel, useUpdateHotel, useDeleteHotel,
  useUploadHotelImages, useDeleteHotelImage,
} from "../../hooks/usePartnerQueries";
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
  Building2, MapPin, Star, MoreVertical, Edit2, Trash2, Bed,
  Wifi, Waves, Car, Dumbbell, Sparkles, Utensils, Dog, Search, Plus, ArrowRight, Layout
} from "lucide-react";
import "../../styles/pages/partner/PartnerHotels.css";
import { useLang } from "../../contexts/LanguageContext";

// --- Configuration & Helpers ---
const HOTEL_TYPES = ["HOTEL", "APARTMENT", "RESORT", "VILLA", "HOMESTAY", "HOSTEL", "GUEST_HOUSE"];
const HOTEL_TYPE_LABELS = {
  HOTEL: "Khách sạn", APARTMENT: "Căn hộ", RESORT: "Resort",
  VILLA: "Villa", HOMESTAY: "Homestay", HOSTEL: "Hostel", GUEST_HOUSE: "Nhà khách",
};

const AMENITIES = [
  { key: "WIFI", label: "WiFi", Icon: Wifi },
  { key: "POOL", label: "Hồ bơi", Icon: Waves },
  { key: "PARKING", label: "Bãi đỗ xe", Icon: Car },
  { key: "GYM", label: "Gym", Icon: Dumbbell },
  { key: "SPA", label: "Spa", Icon: Sparkles },
  { key: "RESTAURANT", label: "Nhà hàng", Icon: Utensils },
  { key: "PET_ALLOWED", label: "Thú cưng", Icon: Dog },
];

const EMPTY_FORM = {
  name: "", province: "", district: "", address: "",
  hotelType: "HOTEL", description: "", amenities: [],
  images: [],
};

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

function HotelForm({ form, setForm, onSubmit, onCancel, saving, title, hotelTypes, amenities }) {
  const { t } = useLang();
  const HOTEL_TYPE_LABELS = {
    HOTEL: t("pt_type_hotel"), APARTMENT: t("pt_type_apartment"), RESORT: t("pt_type_resort"),
    VILLA: t("pt_type_villa"), HOMESTAY: t("pt_type_homestay"), HOSTEL: t("pt_type_hostel"), GUEST_HOUSE: t("pt_type_guest_house"),
  };
  function toggleAmenity(key) {
    setForm(f => ({
      ...f,
      amenities: f.amenities.includes(key)
        ? f.amenities.filter(a => a !== key)
        : [...f.amenities, key],
    }));
  }

  return (
    <Modal title={title} onClose={onCancel} width={640}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: "80vh", overflowY: "auto", paddingRight: 8 }}>
        <Field label={t("pt_hotels_name")} required>
          <input className="partner-hotel-form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder={t("pt_hotels_name_ph")} />
        </Field>

        <div className="partner-hotel-form-grid">
          <Field label={t("pt_hotels_province")}>
            <input className="partner-hotel-form-input" value={form.province} onChange={e => setForm(f => ({ ...f, province: e.target.value }))} placeholder={t("pt_hotels_province_ph")} />
          </Field>
          <Field label={t("pt_hotels_district")}>
            <input className="partner-hotel-form-input" value={form.district} onChange={e => setForm(f => ({ ...f, district: e.target.value }))} placeholder={t("pt_hotels_district_ph")} />
          </Field>
        </div>

        <Field label={t("pt_hotels_address")}>
          <input className="partner-hotel-form-input" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder={t("pt_hotels_address_ph")} />
        </Field>

        <Field label={t("pt_hotels_type")}>
          <select className="partner-hotel-form-input" value={form.hotelType} onChange={e => setForm(f => ({ ...f, hotelType: e.target.value }))}>
            {hotelTypes.map(ht => <option key={ht} value={ht}>{HOTEL_TYPE_LABELS[ht] || ht}</option>)}
          </select>
        </Field>

        <Field label={t("pt_hotels_desc")}>
          <textarea className="partner-hotel-form-input" style={{ height: 120, resize: "vertical" }} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder={t("pt_hotels_desc_ph")} />
        </Field>

        <Field label={t("pt_hotels_amenities")}>
          <div className="partner-hotel-amenity-wrap">
            {amenities.map(a => (
              <label key={a.key} className={`partner-hotel-amenity-label${form.amenities.includes(a.key) ? " selected" : ""}`}>
                <input type="checkbox" style={{ display: "none" }} checked={form.amenities.includes(a.key)} onChange={() => toggleAmenity(a.key)} />
                <a.Icon size={16} />
                {a.label}
              </label>
            ))}
          </div>
        </Field>

        <Field label={t("pt_hotels_images")}>
          <div className="partner-hotel-img-grid">
            {form.images?.map((img, idx) => {
              const url = imageItemUrl(img);
              return (
              <div key={img?.id || url || idx} className="partner-hotel-img-thumb">
                <img src={url} alt="" />
                <button
                  onClick={() => setForm(f => {
                    const images = [...(f.images || [])];
                    const [removed] = images.splice(idx, 1);
                    revokePendingImageUrls([removed]);
                    return { ...f, images };
                  })}
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
                  const images = createPendingImageItems(e.target.files);
                  setForm(f => ({ ...f, images: [...(f.images || []), ...images] }));
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          <p className="partner-hotel-img-hint">{t("pt_hotels_img_hint")}</p>
        </Field>

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
  const HOTEL_TYPE_LABELS = {
    HOTEL: t("pt_type_hotel"), APARTMENT: t("pt_type_apartment"), RESORT: t("pt_type_resort"),
    VILLA: t("pt_type_villa"), HOMESTAY: t("pt_type_homestay"), HOSTEL: t("pt_type_hostel"), GUEST_HOUSE: t("pt_type_guest_house"),
  };
  const AMENITIES = [
    { key: "WIFI",        label: t("pt_am_wifi"),        Icon: Wifi },
    { key: "POOL",        label: t("pt_am_pool"),        Icon: Waves },
    { key: "PARKING",     label: t("pt_am_parking"),     Icon: Car },
    { key: "GYM",         label: t("pt_am_gym"),         Icon: Dumbbell },
    { key: "SPA",         label: t("pt_am_spa"),         Icon: Sparkles },
    { key: "RESTAURANT",  label: t("pt_am_restaurant"),  Icon: Utensils },
    { key: "PET_ALLOWED", label: t("pt_am_pet"),         Icon: Dog },
  ];
  const queryClient = useQueryClient();
  const [modal, setModal]       = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [saving, setSaving]     = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage]         = useState(1);
  const pageSize = 8;

  const { data: hotelData, isLoading: loading, error: queryError } = useMyHotels();
  const { data: catalogData } = useCatalogOptions();
  const error = queryError?.message || "";

  const createHotel      = useCreateHotel();
  const updateHotel      = useUpdateHotel();
  const deleteHotelMut   = useDeleteHotel();
  const uploadImages     = useUploadHotelImages();
  const deleteImageMut   = useDeleteHotelImage();

  const hotels  = Array.isArray(hotelData) ? hotelData : [];
  const catalog = {
    hotelTypes:    Array.isArray(catalogData?.hotelTypes)    && catalogData.hotelTypes.length    ? catalogData.hotelTypes    : HOTEL_TYPES,
    hotelAmenities: Array.isArray(catalogData?.hotelAmenities) && catalogData.hotelAmenities.length ? catalogData.hotelAmenities : AMENITIES.map(a => a.key),
  };

  function load() {
    queryClient.invalidateQueries({ queryKey: partnerKeys.hotels() });
  }

  const hotelTypeOptions = Array.isArray(catalog.hotelTypes) && catalog.hotelTypes.length ? catalog.hotelTypes : HOTEL_TYPES;
  const amenityOptions = AMENITIES.filter((amenity) => catalog.hotelAmenities?.includes(amenity.key));

  const filteredHotels = hotels.filter(h => 
    (h.name || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
    h.province?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  function openAdd() {
    revokePendingImageUrls(form.images);
    setSelected(null);
    setForm({ ...EMPTY_FORM, images: [] });
    setModal("add");
  }
  function openEdit(hotel) {
    revokePendingImageUrls(form.images);
    setSelected(hotel);
    setForm({
      name: hotel.name || "", province: hotel.province || "", district: hotel.district || "",
      address: hotel.address || "", hotelType: hotel.hotelType || "HOTEL",
      description: hotel.description || "", amenities: hotel.amenities ? [...hotel.amenities] : [],
      images: createExistingImageItems(getHotelImageUrls(hotel)),
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
    setSaving(true);
    try {
      const images = form.images || [];
      const existingImageUrls = existingImageUrlsFromItems(images);
      const pendingFiles = pendingImageFilesFromItems(images);
      const payload = { ...form, imageUrls: existingImageUrls };
      delete payload.images;

      if (modal === "add") {
        const created = await createHotel.mutateAsync(payload);
        if (pendingFiles.length > 0) {
          await uploadImages.mutateAsync({ id: created.id, files: pendingFiles });
        }
      } else {
        await updateHotel.mutateAsync({
          id: selected.id,
          ...payload,
          imageUrls: getHotelImageUrls(selected),
        });
        // Delete removed images
        const remaining = new Set(existingImageUrls);
        const removed = getHotelImageUrls(selected).filter(url => !remaining.has(url));
        for (const imageUrl of removed) {
          await deleteImageMut.mutateAsync({ id: selected.id, imageUrl });
        }
        if (pendingFiles.length > 0) {
          await uploadImages.mutateAsync({ id: selected.id, files: pendingFiles });
        }
      }
      revokePendingImageUrls(images);
      setModal(null);
      setSelected(null);
      setForm({ ...EMPTY_FORM, images: [] });
      load();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    setSaving(true);
    try {
      await deleteHotelMut.mutateAsync(selected.id);
      setModal(null);
      load();
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
            onChange={e => setSearchTerm(e.target.value)}
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
                <span className="partner-hotel-card-type-badge">
                  {(HOTEL_TYPE_LABELS[h.hotelType] || h.hotelType || t("pt_type_hotel")).toUpperCase()}
                </span>
                <button onClick={() => openEdit(h)} className="partner-hotel-card-edit-btn">
                  <Edit2 size={18} color="#475569" />
                </button>
              </div>

              {/* Card Content */}
              <div className="partner-hotel-card-body">
                <div className="partner-hotel-card-header">
                  <h3 className="partner-hotel-card-name">{h.name}</h3>
                  <div className="partner-hotel-card-rating">
                    <Star size={16} fill="#f59e0b" />
                    <span className="partner-hotel-card-rating-val">4.9</span>
                  </div>
                </div>

                <div className="partner-hotel-card-location">
                  <MapPin size={16} color="#64748b" />
                  {h.district}, {h.province}
                </div>

                <div className="partner-hotel-card-amenities">
                  {h.amenities?.slice(0, 4).map(a => {
                    const am = AMENITIES.find(x => x.key === a);
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
                    onClick={() => rrNavigate(`/partner/rooms?hotelId=${h.id}`)}
                    className="partner-hotel-card-btn partner-hotel-card-btn-manage"
                  >
                    <Layout size={18} /> {t("pt_hotels_manage_rooms")}
                  </button>
                  <button
                    onClick={() => openDelete(h)}
                    className="partner-hotel-card-btn partner-hotel-card-btn-delete"
                  >
                    <Trash2 size={18} /> {t("adm_delete")}
                  </button>
                </div>
              </div>
            </div>
          ))}
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
      {(modal === "add" || modal === "edit") && (
        <HotelForm
          title={modal === "add" ? t("pt_hotels_form_add") : t("pt_hotels_form_edit")}
          form={form} setForm={setForm} onSubmit={handleSave} onCancel={closeFormModal} saving={saving}
          hotelTypes={hotelTypeOptions}
          amenities={amenityOptions.length ? amenityOptions : AMENITIES}
        />
      )}

      {modal === "delete" && (
        <Modal title={t("pt_hotels_del_title")} onClose={() => setModal(null)} width={440}>
          <div>
            <div className="partner-hotel-delete-icon-wrap">
              <Trash2 size={32} color="#ef4444" />
            </div>
            <h3 className="partner-hotel-delete-title">{t("pt_hotels_del_confirm")}</h3>
            <p className="partner-hotel-delete-desc"
              dangerouslySetInnerHTML={{ __html: t("pt_hotels_del_desc").replace("{name}", `<strong>"${selected?.name}"</strong>`) }}
            />
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
