import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2, Home, TreePalm, Hotel, Warehouse, House,
  ChevronRight, ChevronLeft,
  Plus, Trash2, Check,
  Users, AlertCircle, Upload, X, BedDouble,
} from "lucide-react";
import { partnerService } from "../../services/partnerService";
import {
  createPendingImageItemsSafe,
  pendingImageFilesFromItems, imageItemUrl, revokePendingImageUrls,
} from "../../utils/imageFormItems";
import { getPropertyGroup, getDefaultBookingMode } from "../../utils/propertyGroupUtils";
import { ROOM_CATEGORIES, ROOM_CATEGORY_LABELS, BED_TYPES, BED_TYPE_LABELS } from "../../utils/roomConfig";
import AmenityPicker from "../../components/partner/AmenityPicker";
import { HOTEL_AMENITY_CATEGORIES, ROOM_AMENITY_CATEGORIES, HOTEL_AMENITY_KEYS } from "../../utils/amenityConfig";
import { useVnLocations } from "../../hooks/useVnLocations";

// ── Constants ───────────────────────────────────────────────────────────

const DRAFT_KEY = "wizard_draft";

const PROPERTY_TYPES = [
  { value: "HOTEL",       label: "Khách sạn",  Icon: Hotel,     desc: "Nhiều loại phòng, nhiều tiện ích" },
  { value: "VILLA",       label: "Villa",       Icon: TreePalm,  desc: "Nguyên căn riêng tư, hồ bơi" },
  { value: "HOMESTAY",    label: "Homestay",    Icon: Home,      desc: "Cho thuê phòng tại nhà" },
  { value: "RESORT",      label: "Resort",      Icon: Building2, desc: "Khu nghỉ dưỡng cao cấp" },
  { value: "APARTMENT",   label: "Căn hộ",      Icon: Warehouse, desc: "Căn hộ dịch vụ, studio" },
  { value: "HOSTEL",      label: "Hostel",      Icon: Users,     desc: "Phòng tập thể, giá tốt" },
  { value: "GUEST_HOUSE", label: "Nhà nghỉ",    Icon: House,     desc: "Nhỏ gọn, ấm cúng, giá rẻ" },
];



const EMPTY_ROOM_TYPE = { name: "", bedType: "DOUBLE", quantity: 1, capacity: 2, roomCategory: "STANDARD", price: "" };

const INITIAL_STATE = {
  propertyType: null,
  step: 0,
  // Step 1
  name: "", province: "", district: "", address: "", phone: "", email: "", website: "",
  // Step 2 - hotel
  totalRooms: "", checkInTime: "14:00", checkOutTime: "12:00",
  roomTypes: [{ ...EMPTY_ROOM_TYPE }],
  // Step 2 - villa
  bedrooms: "", bathrooms: "", area: "", maxGuests: "", villaGrade: "STANDARD", minStay: "1",
  description: "",
  // Step 2 - homestay
  hostName: "", hostPhone: "", sharingType: "ENTIRE", houseRules: "",
  // Step 3
  amenities: [],
  customAmenities: [],
  // Step 4
  images: [],
  // Step 5
  basePrice: "",
  weekendMarkup: "",
  cleaningFee: "",
  cancellationPolicy: "MODERATE",
  allowChildren: true,
  allowPets: false,
};

// ── Helpers ─────────────────────────────────────────────────────────────

function saveDraft(state) {
  try {
    const { images: _images, ...rest } = state;
    localStorage.setItem(DRAFT_KEY, JSON.stringify(rest));
  } catch { /* noop */ }
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
}


// ── UI Components ────────────────────────────────────────────────────────

function Field({ label, children, required, hint }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6 }}>
        {label} {required && <span style={{ color: "#BE1E2E" }}>*</span>}
      </label>
      {children}
      {hint && <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

const inputSt = {
  width: "100%", padding: "10px 14px", borderRadius: 10,
  border: "1px solid #e5e7eb", fontSize: 14, outline: "none",
  background: "#f9fafb", boxSizing: "border-box",
  fontFamily: "inherit",
};

function Input({ value, onChange, placeholder, type = "text" }) {
  return <input style={inputSt} type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />;
}

function ProgressBar({ step, total }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#6b7280" }}>Bước {step} / {total}</span>
        <span style={{ fontSize: 12, color: "#9ca3af" }}>{Math.round((step / total) * 100)}%</span>
      </div>
      <div style={{ height: 6, background: "#f3f4f6", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${(step / total) * 100}%`, background: "#BE1E2E", borderRadius: 99, transition: "width 0.3s" }} />
      </div>
    </div>
  );
}

// ── Step 0: Chọn loại ────────────────────────────────────────────────────

function StepPropertyType({ state, update }) {
  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: "#111827", marginBottom: 8 }}>Bạn muốn đăng ký loại hình nào?</h2>
      <p style={{ color: "#6b7280", marginBottom: 16 }}>Chọn loại phù hợp để chúng tôi tùy chỉnh form cho bạn</p>

      {/* Hướng dẫn phân biệt loại hình */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 24 }}>
        <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 12, padding: "12px 14px" }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#15803d", marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
            <Building2 size={13} /> Cho thuê theo phòng
          </div>
          <div style={{ fontSize: 12, color: "#166534", lineHeight: 1.6 }}>
            Khách đặt từng phòng riêng lẻ trong cơ sở.<br />
            Áp dụng cho: <strong>Khách sạn, Resort, Hostel, Nhà nghỉ, Homestay</strong>
          </div>
        </div>
        <div style={{ background: "#fefce8", border: "1px solid #fde68a", borderRadius: 12, padding: "12px 14px" }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#b45309", marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
            <Home size={13} /> Cho thuê nguyên căn
          </div>
          <div style={{ fontSize: 12, color: "#92400e", lineHeight: 1.6 }}>
            Khách thuê toàn bộ cơ sở, không chia phòng.<br />
            Áp dụng cho: <strong>Villa, Căn hộ</strong>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
        {PROPERTY_TYPES.map(({ value, label, Icon, desc }) => {
          const selected = state.propertyType === value;
          return (
            <button
              key={value}
              onClick={() => update({ propertyType: value })}
              style={{
                padding: "20px 16px", borderRadius: 16, cursor: "pointer", textAlign: "left",
                border: selected ? "2px solid #BE1E2E" : "2px solid #e5e7eb",
                background: selected ? "#fff5f5" : "#fff",
                transition: "all 0.15s",
              }}
            >
              <div style={{ width: 44, height: 44, borderRadius: 12, background: selected ? "#BE1E2E" : "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                <Icon size={22} color={selected ? "#fff" : "#6b7280"} />
              </div>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#111827", marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 12, color: "#9ca3af" }}>{desc}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Step 1: Thông tin cơ bản ─────────────────────────────────────────────

function StepBasicInfo({ state, update }) {
  const typeLabel = PROPERTY_TYPES.find(t => t.value === state.propertyType)?.label || "cơ sở";
  const { provinceOptions, districtOptions, loadingProvinces, loadingDistricts } = useVnLocations(state.province);
  const visibleDistricts = state.district && !districtOptions.includes(state.district)
    ? [state.district, ...districtOptions]
    : districtOptions;
  return (
    <div>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#fff5f5", border: "1px solid #fecaca", borderRadius: 8, padding: "6px 12px", marginBottom: 20 }}>
        <span style={{ fontSize: 12, color: "#BE1E2E", fontWeight: 700 }}>Loại hình đã chọn: {typeLabel}</span>
      </div>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: "#111827", marginBottom: 20 }}>Thông tin cơ bản</h2>

      <Field label={`Tên ${typeLabel}`} required>
        <Input value={state.name} onChange={v => update({ name: v })} placeholder={`VD: ${typeLabel} Hòa Bình`} />
      </Field>

      <Field label="Địa chỉ" required>
        <Input value={state.address} onChange={v => update({ address: v })} placeholder="Số nhà, tên đường" />
      </Field>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Field label="Tỉnh / Thành phố" required>
          <select
            style={inputSt}
            value={state.province}
            onChange={e => update({ province: e.target.value, district: "" })}
            disabled={loadingProvinces}
          >
            <option value="">{loadingProvinces ? "Đang tải..." : "Chọn tỉnh / thành phố"}</option>
            {provinceOptions.map(p => <option key={p.code} value={p.name}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="Quận / Huyện" required>
          <select
            style={inputSt}
            value={state.district}
            onChange={e => update({ district: e.target.value })}
            disabled={!state.province || loadingDistricts}
          >
            <option value="">{loadingDistricts ? "Đang tải quận/huyện..." : "Chọn quận / huyện"}</option>
            {visibleDistricts.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </Field>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Field label="Số điện thoại" required>
          <Input value={state.phone} onChange={v => update({ phone: v })} placeholder="0912345678" />
        </Field>
        <Field label="Email liên hệ">
          <Input value={state.email} onChange={v => update({ email: v })} type="email" placeholder="contact@example.com" />
        </Field>
      </div>

      <Field label="Website (tùy chọn)">
        <Input value={state.website} onChange={v => update({ website: v })} placeholder="https://example.com" />
      </Field>
    </div>
  );
}

// ── Step 2: Chi tiết property ────────────────────────────────────────────

function StepHotelDetail({ state, update }) {
  function addRoomType() {
    update({ roomTypes: [...state.roomTypes, { ...EMPTY_ROOM_TYPE }] });
  }
  function removeRoomType(idx) {
    update({ roomTypes: state.roomTypes.filter((_, i) => i !== idx) });
  }
  function updateRoomType(idx, field, value) {
    const next = state.roomTypes.map((rt, i) => i === idx ? { ...rt, [field]: value } : rt);
    update({ roomTypes: next });
  }

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: "#111827", marginBottom: 20 }}>Chi tiết khách sạn</h2>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 4 }}>
        <Field label="Tổng số phòng" required>
          <Input value={state.totalRooms} onChange={v => update({ totalRooms: v })} placeholder="22" type="number" />
        </Field>
        <Field label="Giờ check-in" required>
          <input style={inputSt} type="time" value={state.checkInTime} onChange={e => update({ checkInTime: e.target.value })} />
        </Field>
        <Field label="Giờ check-out" required>
          <input style={inputSt} type="time" value={state.checkOutTime} onChange={e => update({ checkOutTime: e.target.value })} />
        </Field>
      </div>

      <div style={{ marginTop: 8, marginBottom: 12, borderTop: "1px solid #f3f4f6", paddingTop: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "#374151", marginBottom: 4 }}>Loại phòng <span style={{ color: "#BE1E2E" }}>*</span></div>
        <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 16 }}>Vui lòng thêm ít nhất 1 loại phòng</div>

        {state.roomTypes.map((rt, idx) => (
          <div key={idx} style={{ background: "#f9fafb", borderRadius: 12, padding: 16, marginBottom: 12, border: "1px solid #e5e7eb" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: "#374151" }}>Loại phòng #{idx + 1}</span>
              {state.roomTypes.length > 1 && (
                <button onClick={() => removeRoomType(idx)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", padding: 4 }}>
                  <Trash2 size={15} />
                </button>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 12 }}>
              <Field label="Tên loại phòng">
                <Input value={rt.name} onChange={v => updateRoomType(idx, "name", v)} placeholder="VD: Phòng Đôi" />
              </Field>
              <Field label="Số lượng phòng">
                <Input value={rt.quantity} onChange={v => updateRoomType(idx, "quantity", v)} type="number" placeholder="10" />
              </Field>
              <Field label="Sức chứa (khách)">
                <Input value={rt.capacity} onChange={v => updateRoomType(idx, "capacity", v)} type="number" placeholder="2" />
              </Field>
              <Field label="Giá / đêm (₫)">
                <Input value={rt.price} onChange={v => updateRoomType(idx, "price", v)} type="number" placeholder="500000" />
              </Field>
            </div>
            <Field label="Hạng phòng">
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                {ROOM_CATEGORIES.map(rc => (
                  <button key={rc} onClick={() => updateRoomType(idx, "roomCategory", rc)}
                    style={{ padding: "6px 14px", borderRadius: 8, border: rt.roomCategory === rc ? "2px solid #BE1E2E" : "1px solid #e5e7eb", background: rt.roomCategory === rc ? "#fff5f5" : "#fff", color: rt.roomCategory === rc ? "#BE1E2E" : "#6b7280", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    {ROOM_CATEGORY_LABELS[rc]}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Loại giường">
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {BED_TYPES.map(bt => (
                  <button key={bt} onClick={() => updateRoomType(idx, "bedType", bt)}
                    style={{ padding: "6px 14px", borderRadius: 8, border: rt.bedType === bt ? "2px solid #BE1E2E" : "1px solid #e5e7eb", background: rt.bedType === bt ? "#fff5f5" : "#fff", color: rt.bedType === bt ? "#BE1E2E" : "#6b7280", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    {BED_TYPE_LABELS[bt]}
                  </button>
                ))}
              </div>
            </Field>
          </div>
        ))}

        <button onClick={addRoomType}
          style={{ width: "100%", padding: "12px", borderRadius: 12, border: "2px dashed #e5e7eb", background: "transparent", color: "#6b7280", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <Plus size={16} /> Thêm loại phòng khác
        </button>
      </div>
    </div>
  );
}

function StepVillaDetail({ state, update }) {
  const grades = [{ v: "STANDARD", l: "Tiêu chuẩn" }, { v: "LUXURY", l: "Sang trọng" }, { v: "PREMIUM", l: "Cao cấp (Luxury)" }];
  const minStays = [{ v: "1", l: "Không yêu cầu (1 đêm)" }, { v: "3", l: "3 đêm" }, { v: "7", l: "7 đêm" }, { v: "30", l: "30 đêm (dài hạn)" }];
  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: "#111827", marginBottom: 20 }}>Chi tiết Villa</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16 }}>
        <Field label="Số phòng ngủ" required><Input value={state.bedrooms} onChange={v => update({ bedrooms: v })} type="number" placeholder="4" /></Field>
        <Field label="Số phòng tắm" required><Input value={state.bathrooms} onChange={v => update({ bathrooms: v })} type="number" placeholder="3" /></Field>
        <Field label="Diện tích (m²)" required><Input value={state.area} onChange={v => update({ area: v })} type="number" placeholder="200" /></Field>
        <Field label="Số khách tối đa" required><Input value={state.maxGuests} onChange={v => update({ maxGuests: v })} type="number" placeholder="8" /></Field>
      </div>
      <Field label="Hạng villa">
        <div style={{ display: "flex", gap: 8 }}>
          {grades.map(g => (
            <button key={g.v} onClick={() => update({ villaGrade: g.v })}
              style={{ flex: 1, padding: "10px", borderRadius: 10, border: state.villaGrade === g.v ? "2px solid #BE1E2E" : "1px solid #e5e7eb", background: state.villaGrade === g.v ? "#fff5f5" : "#fff", color: state.villaGrade === g.v ? "#BE1E2E" : "#6b7280", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
              {g.l}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Yêu cầu số đêm tối thiểu">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {minStays.map(m => (
            <label key={m.v} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 14, color: "#374151" }}>
              <input type="radio" checked={state.minStay === m.v} onChange={() => update({ minStay: m.v })} style={{ accentColor: "#BE1E2E" }} />
              {m.l}
            </label>
          ))}
        </div>
      </Field>
      <Field label="Mô tả ngắn về villa">
        <textarea style={{ ...inputSt, height: 100, resize: "vertical" }} value={state.description} onChange={e => update({ description: e.target.value })} placeholder="Villa view biển, có hồ bơi riêng..." />
      </Field>
    </div>
  );
}

function StepHomestayDetail({ state, update }) {
  const sharingTypes = [
    { v: "ENTIRE", l: "Toàn bộ nhà/căn hộ" },
    { v: "PRIVATE", l: "Phòng riêng (chung khu vực với chủ nhà)" },
    { v: "SHARED", l: "Phòng chung (ngủ chung phòng)" },
  ];
  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: "#111827", marginBottom: 20 }}>Chi tiết Homestay</h2>
      <Field label="Bạn cho thuê theo kiểu nào?" required>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {sharingTypes.map(s => (
            <label key={s.v} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 10, border: state.sharingType === s.v ? "2px solid #BE1E2E" : "1px solid #e5e7eb", cursor: "pointer", background: state.sharingType === s.v ? "#fff5f5" : "#fff" }}>
              <input type="radio" checked={state.sharingType === s.v} onChange={() => update({ sharingType: s.v })} style={{ accentColor: "#BE1E2E" }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>{s.l}</span>
            </label>
          ))}
        </div>
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Field label="Tên chủ nhà (host)" required><Input value={state.hostName} onChange={v => update({ hostName: v })} placeholder="Nguyễn Văn A" /></Field>
        <Field label="SĐT chủ nhà" required><Input value={state.hostPhone} onChange={v => update({ hostPhone: v })} placeholder="0987654321" /></Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
        <Field label="Số phòng ngủ"><Input value={state.bedrooms} onChange={v => update({ bedrooms: v })} type="number" placeholder="1" /></Field>
        <Field label="Số phòng tắm"><Input value={state.bathrooms} onChange={v => update({ bathrooms: v })} type="number" placeholder="1" /></Field>
        <Field label="Số khách tối đa"><Input value={state.maxGuests} onChange={v => update({ maxGuests: v })} type="number" placeholder="2" /></Field>
      </div>
      <Field label="Quy định nhà ở (house rules)" required>
        <textarea style={{ ...inputSt, height: 100, resize: "vertical" }} value={state.houseRules} onChange={e => update({ houseRules: e.target.value })} placeholder="Không hút thuốc trong nhà. Giờ yên tĩnh sau 10PM..." />
      </Field>
    </div>
  );
}

function StepPropertyDetail({ state, update }) {
  const group = getPropertyGroup(state.propertyType);
  if (group === "villa") return <StepVillaDetail state={state} update={update} />;
  if (group === "homestay") return <StepHomestayDetail state={state} update={update} />;
  return <StepHotelDetail state={state} update={update} />;
}

// ── Step 3: Tiện ích ─────────────────────────────────────────────────────

function StepAmenities({ state, update }) {
  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: "#111827", marginBottom: 8 }}>Tiện ích cơ sở</h2>
      <p style={{ color: "#6b7280", marginBottom: 24 }}>Chọn các tiện ích mà cơ sở của bạn cung cấp. Nếu không có trong danh sách, hãy nhập vào ô phía dưới.</p>
      <AmenityPicker
        categories={HOTEL_AMENITY_CATEGORIES}
        selected={state.amenities}
        customAmenities={state.customAmenities || []}
        onChange={(amenities, customAmenities) => update({ amenities, customAmenities })}
      />
    </div>
  );
}

// ── Step 4: Hình ảnh ─────────────────────────────────────────────────────

function StepImages({ state, update }) {
  const [imageError, setImageError] = useState("");
  function handleFiles(e) {
    const { accepted, rejected } = createPendingImageItemsSafe(e.target.files);
    update({ images: [...state.images, ...accepted] });
    setImageError(rejected.length > 0 ? rejected.map(r => r.reason).join(" ") : "");
    e.target.value = "";
  }
  function removeImage(idx) {
    const next = [...state.images];
    revokePendingImageUrls([next[idx]]);
    next.splice(idx, 1);
    update({ images: next });
  }
  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: "#111827", marginBottom: 8 }}>Hình ảnh</h2>
      <p style={{ color: "#6b7280", marginBottom: 8 }}>Tải lên ít nhất 3 hình ảnh chất lượng cao</p>
      <p style={{ fontSize: 12, color: "#9ca3af", marginBottom: imageError ? 8 : 24 }}>Hình đầu tiên sẽ là ảnh đại diện. Định dạng JPG, PNG, WEBP, GIF — tối đa 10 MB/ảnh</p>
      {imageError && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, color: "#b91c1c", fontSize: 12, fontWeight: 600, lineHeight: 1.5, padding: "8px 12px", marginBottom: 16 }}>
          ⚠️ {imageError}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
        {state.images.map((img, idx) => (
          <div key={idx} style={{ position: "relative", borderRadius: 12, overflow: "hidden", aspectRatio: "4/3" }}>
            <img src={imageItemUrl(img)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            {idx === 0 && <div style={{ position: "absolute", top: 6, left: 6, background: "#BE1E2E", color: "#fff", fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 6 }}>ĐẠI DIỆN</div>}
            <button onClick={() => removeImage(idx)}
              style={{ position: "absolute", top: 6, right: 6, width: 26, height: 26, borderRadius: "50%", background: "rgba(0,0,0,0.6)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <X size={14} color="#fff" />
            </button>
          </div>
        ))}

        <label style={{ borderRadius: 12, border: "2px dashed #e5e7eb", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, aspectRatio: "4/3", color: "#9ca3af", transition: "all 0.2s" }}
          onMouseEnter={e => e.currentTarget.style.borderColor = "#BE1E2E"}
          onMouseLeave={e => e.currentTarget.style.borderColor = "#e5e7eb"}>
          <Upload size={24} />
          <span style={{ fontSize: 12, fontWeight: 600 }}>Thêm ảnh</span>
          <input type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif" style={{ display: "none" }} onChange={handleFiles} />
        </label>
      </div>
    </div>
  );
}

// ── Step 5: Giá & Chính sách ─────────────────────────────────────────────

function StepPricing({ state, update }) {
  const group = getPropertyGroup(state.propertyType);
  const policies = [
    { v: "FLEXIBLE", l: "Linh hoạt", desc: "Hủy miễn phí trước 24h" },
    { v: "MODERATE", l: "Trung bình", desc: "Hủy miễn phí trước 7 ngày" },
    { v: "STRICT", l: "Nghiêm ngặt", desc: "Không hoàn tiền khi hủy" },
  ];

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: "#111827", marginBottom: 20 }}>Giá & Chính sách</h2>

      {group === "hotel" ? (
        <div style={{ marginBottom: 4 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 8 }}>Tóm tắt giá loại phòng</div>
          {state.roomTypes.filter(rt => rt.name?.trim()).map((rt, idx) => (
            <div key={idx} style={{ background: "#f9fafb", borderRadius: 10, padding: "10px 16px", marginBottom: 8, border: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 600, fontSize: 13, color: "#374151", display: "flex", alignItems: "center", gap: 5 }}><BedDouble size={13} aria-hidden="true" /> {rt.name} ({rt.quantity} phòng)</span>
              <span style={{ fontWeight: 700, fontSize: 13, color: "#BE1E2E" }}>
                {rt.price ? new Intl.NumberFormat("vi-VN").format(Number(rt.price)) + " ₫/đêm" : "Chưa đặt giá"}
              </span>
            </div>
          ))}
          <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>Giá đã được điền ở bước Chi tiết. Bạn có thể chỉnh lại từ trang Quản lý phòng.</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 4 }}>
          <Field label="Giá thuê / đêm (₫)" required>
            <Input value={state.basePrice} onChange={v => update({ basePrice: v })} type="number" placeholder="2500000" />
          </Field>
          <Field label="Tăng giá cuối tuần (%)" hint="Để trống nếu không áp dụng">
            <Input value={state.weekendMarkup} onChange={v => update({ weekendMarkup: v })} type="number" placeholder="20" />
          </Field>
          {group === "villa" && (
            <Field label="Phí dọn dẹp (₫)" hint="1 lần duy nhất">
              <Input value={state.cleaningFee} onChange={v => update({ cleaningFee: v })} type="number" placeholder="300000" />
            </Field>
          )}
        </div>
      )}

      <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 20, marginTop: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "#374151", marginBottom: 12 }}>Chính sách hủy phòng</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {policies.map(p => (
            <label key={p.v} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 10, border: state.cancellationPolicy === p.v ? "2px solid #BE1E2E" : "1px solid #e5e7eb", cursor: "pointer", background: state.cancellationPolicy === p.v ? "#fff5f5" : "#fff" }}>
              <input type="radio" checked={state.cancellationPolicy === p.v} onChange={() => update({ cancellationPolicy: p.v })} style={{ accentColor: "#BE1E2E" }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#374151" }}>{p.l}</div>
                <div style={{ fontSize: 12, color: "#9ca3af" }}>{p.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 20, marginTop: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "#374151", marginBottom: 12 }}>Chính sách khác</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            { key: "allowChildren", label: "Cho phép trẻ em" },
            { key: "allowPets", label: "Cho phép thú cưng" },
          ].map(({ key, label }) => (
            <label key={key} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 14, color: "#374151" }}>
              <input type="checkbox" checked={state[key]} onChange={e => update({ [key]: e.target.checked })} style={{ accentColor: "#BE1E2E", width: 16, height: 16 }} />
              {label}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Wizard ──────────────────────────────────────────────────────────

const STEPS = ["Loại hình", "Thông tin cơ bản", "Chi tiết", "Tiện ích", "Hình ảnh", "Giá & Chính sách"];

export default function AddPropertyWizard() {
  const navigate = useNavigate();

  const [state, setState] = useState(() => {
    const draft = loadDraft();
    return draft ? { ...INITIAL_STATE, ...draft, images: [] } : INITIAL_STATE;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [createdHotelId, setCreatedHotelId] = useState(null);
  const [showResume, setShowResume] = useState(() => {
    const draft = loadDraft();
    return draft && draft.propertyType && draft.step > 0;
  });

  function update(patch) {
    setState(prev => {
      const next = { ...prev, ...patch };
      saveDraft(next);
      return next;
    });
  }

  function nextStep() {
    const group = getPropertyGroup(state.propertyType);

    if (state.step === 0) {
      if (!state.propertyType) { setError("Vui lòng chọn loại hình cơ sở"); return; }
    }

    if (state.step === 1) {
      if (!state.name.trim())                        { setError("Vui lòng nhập tên cơ sở lưu trú"); return; }
      if (state.name.trim().length < 5)              { setError("Tên cơ sở phải có ít nhất 5 ký tự"); return; }
      if (state.name.trim().length > 100)            { setError("Tên cơ sở không được vượt quá 100 ký tự"); return; }
      if (!state.address.trim())                     { setError("Vui lòng nhập địa chỉ"); return; }
      if (state.address.trim().length < 5)           { setError("Địa chỉ phải có ít nhất 5 ký tự"); return; }
      if (!state.district.trim())                    { setError("Vui lòng nhập Quận / Huyện"); return; }
      if (!state.province.trim())                    { setError("Vui lòng nhập Tỉnh / Thành phố"); return; }
      if (!state.phone.trim())                       { setError("Vui lòng nhập số điện thoại liên hệ"); return; }
      if (!/^(\+84|0)[3-9]\d{8}$/.test(state.phone.trim().replace(/\s/g, ""))) {
        setError("Số điện thoại không hợp lệ (VD: 0901234567)"); return;
      }
    }

    if (state.step === 2) {
      if (group === "hotel") {
        if (!state.totalRooms || Number(state.totalRooms) < 1) {
          setError("Vui lòng nhập tổng số phòng (ít nhất 1)"); return;
        }
        const validRooms = state.roomTypes.filter(rt => rt.name?.trim() && Number(rt.price) > 0);
        if (validRooms.length === 0) {
          setError("Vui lòng thêm ít nhất 1 loại phòng với tên và giá hợp lệ"); return;
        }
        const missingPrice = state.roomTypes.find(rt => rt.name?.trim() && !Number(rt.price));
        if (missingPrice) {
          setError(`Loại phòng "${missingPrice.name}" chưa có giá`); return;
        }
        const lowPrice = state.roomTypes.find(rt => rt.name?.trim() && Number(rt.price) > 0 && Number(rt.price) < 10000);
        if (lowPrice) {
          setError(`Giá loại phòng "${lowPrice.name}" phải từ 10.000 ₫ trở lên`); return;
        }
        const totalRoomsNum = Number(state.totalRooms);
        const sumQuantity = state.roomTypes
          .filter(rt => rt.name?.trim())
          .reduce((s, rt) => s + (Number(rt.quantity) || 0), 0);
        if (sumQuantity > totalRoomsNum) {
          setError(`Tổng số phòng từng loại (${sumQuantity}) vượt quá tổng số phòng của cơ sở (${totalRoomsNum})`); return;
        }
      } else if (group === "villa") {
        if (!state.bedrooms || Number(state.bedrooms) < 1) { setError("Vui lòng nhập số phòng ngủ"); return; }
        if (!state.area || Number(state.area) < 1)         { setError("Vui lòng nhập diện tích"); return; }
        if (!state.maxGuests || Number(state.maxGuests) < 1) { setError("Vui lòng nhập số khách tối đa"); return; }
      } else {
        // homestay
        if (!state.hostName?.trim())  { setError("Vui lòng nhập tên chủ nhà"); return; }
        if (!state.hostPhone?.trim()) { setError("Vui lòng nhập SĐT chủ nhà"); return; }
        if (!/^(\+84|0)[3-9]\d{8}$/.test(state.hostPhone.trim().replace(/\s/g, ""))) {
          setError("SĐT chủ nhà không hợp lệ (VD: 0901234567)"); return;
        }
        if (!state.houseRules?.trim()) { setError("Vui lòng nhập quy định nhà ở"); return; }
      }
    }

    // Step 4: bắt buộc ít nhất 1 ảnh
    if (state.step === 4) {
      if (!state.images || state.images.length === 0) {
        setError("Vui lòng tải lên ít nhất 1 ảnh cho cơ sở"); return;
      }
    }

    // Step 5: validate giá villa/homestay
    if (state.step === 5) {
      const group = getPropertyGroup(state.propertyType);
      if (group !== "hotel") {
        if (!state.basePrice || Number(state.basePrice) <= 0) {
          setError("Vui lòng nhập giá thuê / đêm"); return;
        }
        if (Number(state.basePrice) < 10000) {
          setError("Giá thuê phải từ 10.000 ₫ trở lên"); return;
        }
        if (state.weekendMarkup !== "" && (Number(state.weekendMarkup) < 0 || Number(state.weekendMarkup) > 200)) {
          setError("Tăng giá cuối tuần phải từ 0% đến 200%"); return;
        }
        if (state.cleaningFee !== "" && Number(state.cleaningFee) < 0) {
          setError("Phí dọn dẹp không được âm"); return;
        }
      }
    }

    setError("");
    update({ step: state.step + 1 });
  }

  function prevStep() {
    setError("");
    update({ step: Math.max(0, state.step - 1) });
  }

  function startFresh() {
    clearDraft();
    setState(INITIAL_STATE);
    setShowResume(false);
  }

  async function handleSubmit() {
    if (!state.name.trim() || !state.province.trim() || !state.district.trim() || !state.address.trim()) {
      setError("Vui lòng điền đầy đủ thông tin bắt buộc (*): Tên, Địa chỉ, Quận/Huyện, Tỉnh/Thành phố");
      return;
    }
    setSaving(true);
    setError("");

    try {
      const group = getPropertyGroup(state.propertyType);

      // 1. Tạo hotel
      const amenityKeys = state.amenities.filter(a => HOTEL_AMENITY_KEYS.has(a));
      // bookingMode: homestay cho phép chọn qua sharingType, còn lại derive từ loại hình
      const bookingMode = state.propertyType === "HOMESTAY"
        ? (state.sharingType === "ENTIRE" ? "ENTIRE" : "BY_ROOM")
        : getDefaultBookingMode(state.propertyType);
      const hotel = await partnerService.createHotel({
        name: state.name,
        province: state.province,
        district: state.district,
        address: state.address,
        hotelType: state.propertyType,
        bookingMode,
        description: state.description || "",
        amenities: amenityKeys,
        customAmenities: state.customAmenities || [],
        cancellationPolicy: state.cancellationPolicy || "MODERATE",
      });
      const hotelId = hotel.id;

      // 2. Tạo rooms
      if (group === "hotel") {
        // Hotel/Resort/Hostel: multiple room types, each with its own price
        for (const rt of state.roomTypes) {
          if (!rt.name?.trim()) continue;
          await partnerService.createRoom(hotelId, {
            name: rt.name,
            bedType: rt.bedType || "DOUBLE",
            quantity: Number(rt.quantity) || 1,
            capacity: Number(rt.capacity) || 2,
            price: Number(rt.price) || 0,
            roomCategory: rt.roomCategory || "STANDARD",
          });
        }
      } else {
        // Villa / Homestay: single unit
        const roomName = group === "villa" ? "Toàn bộ villa" : "Phòng";
        await partnerService.createRoom(hotelId, {
          name: roomName,
          bedType: "DOUBLE",
          quantity: 1,
          capacity: Number(state.maxGuests) || 2,
          price: Number(state.basePrice) || 0,
          roomCategory: "STANDARD",
        });
        if (state.basePrice) {
          await partnerService.setHotelBasePricing(hotelId, {
            basePrice: Number(state.basePrice),
            minStay: state.minStay ? Number(state.minStay) : undefined,
          });
        }
      }

      // 3. Upload ảnh
      const files = pendingImageFilesFromItems(state.images);
      if (files.length > 0) {
        await partnerService.uploadHotelImages(hotelId, files);
      }
      revokePendingImageUrls(state.images);

      clearDraft();
      setCreatedHotelId(hotelId);
    } catch (e) {
      setError(e.message || "Có lỗi xảy ra. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  }

  const isLastStep = state.step === STEPS.length - 1;

  // ── Success screen ──────────────────────────────────────────────────────
  if (createdHotelId) {
    return (
      <div style={{ maxWidth: 520, margin: "0 auto", paddingBottom: 60, paddingTop: 32, textAlign: "center" }}>
        <Building2 size={56} color="#BE1E2E" style={{ marginBottom: 16 }} aria-hidden="true" />
        <h1 style={{ fontSize: 24, fontWeight: 900, color: "#111827", marginBottom: 8 }}>Cơ sở đã được tạo thành công!</h1>
        <p style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.6, marginBottom: 28 }}>
          Cơ sở lưu trú của bạn đã được thêm vào hệ thống. Tiếp theo, hãy thêm phòng và cài đặt giá để bắt đầu nhận đặt phòng.
        </p>

        {/* Next steps */}
        <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 14, padding: "20px 24px", marginBottom: 28, textAlign: "left" }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#6b7280", marginBottom: 14, letterSpacing: 0.5 }}>BƯỚC TIẾP THEO</div>
          {[
            { num: 1, label: "Thêm loại phòng", desc: "Tạo các loại phòng với giá và số lượng", done: false },
            { num: 2, label: "Thêm phòng vật lý", desc: "Gán số phòng cụ thể để quản lý tình trạng", done: false },
            { num: 3, label: "Cài giá theo mùa", desc: "Thiết lập giá trên lịch để tối ưu doanh thu", done: false },
          ].map(s => (
            <div key={s.num} style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
              <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#BE1E2E", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, flexShrink: 0, marginTop: 1 }}>{s.num}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{s.label}</div>
                <div style={{ fontSize: 12, color: "#9ca3af" }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            onClick={() => navigate("/partner/rooms", { state: { newProperty: true, hotelId: createdHotelId } })}
            style={{ background: "#BE1E2E", border: "none", borderRadius: 12, color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 800, padding: "14px", width: "100%" }}
          >
            Thêm phòng ngay →
          </button>
          <button
            onClick={() => navigate("/partner/hotels")}
            style={{ background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 12, color: "#475569", cursor: "pointer", fontSize: 14, fontWeight: 600, padding: "12px" }}
          >
            Về danh sách cơ sở
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", paddingBottom: 60 }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <button onClick={() => navigate("/partner/hotels")}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, marginBottom: 16, padding: 0 }}>
          <ChevronLeft size={16} /> Quay lại danh sách
        </button>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: "#111827", margin: 0 }}>Thêm cơ sở lưu trú mới</h1>
      </div>

      {/* Resume draft banner */}
      {showResume && (
        <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 12, padding: "14px 18px", marginBottom: 24, display: "flex", alignItems: "center", gap: 12 }}>
          <AlertCircle size={18} color="#d97706" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#92400e" }}>Bạn có form đang điền dở</div>
            <div style={{ fontSize: 13, color: "#78350f" }}>Tiếp tục từ bước {state.step + 1} hay bắt đầu lại?</div>
          </div>
          <button onClick={startFresh} style={{ background: "transparent", border: "1px solid #d97706", color: "#d97706", padding: "6px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Làm mới
          </button>
          <button onClick={() => setShowResume(false)} style={{ background: "#d97706", border: "none", color: "#fff", padding: "6px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Tiếp tục
          </button>
        </div>
      )}

      {/* Card */}
      <div style={{ background: "#fff", borderRadius: 20, padding: 32, border: "1px solid #f3f4f6", boxShadow: "0 1px 8px rgba(0,0,0,0.06)" }}>
        {state.step > 0 && <ProgressBar step={state.step} total={STEPS.length - 1} />}

        {/* Step content */}
        {state.step === 0 && <StepPropertyType state={state} update={update} />}
        {state.step === 1 && <StepBasicInfo state={state} update={update} />}
        {state.step === 2 && <StepPropertyDetail state={state} update={update} />}
        {state.step === 3 && <StepAmenities state={state} update={update} />}
        {state.step === 4 && <StepImages state={state} update={update} />}
        {state.step === 5 && <StepPricing state={state} update={update} />}

        {/* Error */}
        {error && (
          <div style={{ marginTop: 16, padding: "12px 14px", borderRadius: 10, background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", fontSize: 13, fontWeight: 600, display: "flex", gap: 8, alignItems: "center" }}>
            <AlertCircle size={15} /> {error}
          </div>
        )}

        {/* Navigation buttons */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 28 }}>
          <button
            onClick={state.step === 0 ? () => navigate("/partner/hotels") : prevStep}
            style={{ padding: "11px 24px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#fff", color: "#6b7280", fontWeight: 700, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
          >
            <ChevronLeft size={16} /> {state.step === 0 ? "Hủy" : "Quay lại"}
          </button>

          {isLastStep ? (
            <button
              onClick={handleSubmit}
              disabled={saving}
              style={{ padding: "11px 28px", borderRadius: 10, border: "none", background: saving ? "#94a3b8" : "#BE1E2E", color: "#fff", fontWeight: 700, fontSize: 14, cursor: saving ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8, boxShadow: "0 4px 12px rgba(190,30,46,0.25)" }}
            >
              {saving ? "Đang lưu..." : "Hoàn tất"}  <Check size={16} />
            </button>
          ) : (
            <button
              onClick={nextStep}
              style={{ padding: "11px 28px", borderRadius: 10, border: "none", background: "#BE1E2E", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, boxShadow: "0 4px 12px rgba(190,30,46,0.25)" }}
            >
              Tiếp tục <ChevronRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}