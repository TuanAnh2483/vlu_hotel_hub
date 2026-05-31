import { useState, useEffect } from "react";
import MainNavbar from "../components/MainNavbar";
import Footer from "../components/Footer";
import {
  useMyHotels, useCreateHotel, useUpdateHotel,
  usePartnerRooms, useCreateRoom, useUpdateRoom, useUploadRoomImages,
  usePartnerBookings,
} from "../hooks/usePartnerQueries";
import {
  Building2, Bed, Calendar, BarChart3, Pencil, Users, DoorOpen,
  AlertCircle, CircleDollarSign, ClipboardList, CheckCircle2, Inbox, Layers,
} from "lucide-react";
import "../styles/pages/PartnerManagePage.css";

const P  = "#BE1E2E";
const BG = "linear-gradient(135deg, #ffffff 0%, #fdf4f5 45%, #f7ebeb 100%)";

// ── Shared helpers ────────────────────────────────────────────────────
function fmt(n) { return (n || 0).toLocaleString("vi-VN") + "₫"; }
function fmtDate(s) {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d) ? s : d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function nightsBetween(a, b) {
  const diff = (new Date(b) - new Date(a)) / 86400000;
  return diff > 0 ? Math.round(diff) : 0;
}



function Label({ children }) {
  return <div className="partner-manage-label">{children}</div>;
}

// ── Modal wrapper ─────────────────────────────────────────────────────
function Modal({ title, onClose, children, width = 520 }) {
  return (
    <div className="partner-manage-modal-overlay">
      <div className="partner-manage-modal" style={{ width }}>
        <div className="partner-manage-modal-header">
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#1a1a1a" }}>{title}</h3>
          <button onClick={onClose} className="partner-manage-modal-close">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── StatusBadge ───────────────────────────────────────────────────────
const BADGE = {
  ACTIVE:          { bg: "#e8f5e9", color: "#2e7d32", label: "Hoạt động" },
  INACTIVE:        { bg: "#f5f5f5", color: "#888",    label: "Tạm dừng"  },
  CONFIRMED:       { bg: "#e3f2fd", color: "#1565c0", label: "Đã xác nhận" },
  PENDING_PAYMENT: { bg: "#fff3e0", color: "#e65100", label: "Chờ TT" },
  CANCELLED:       { bg: "#ffebee", color: "#c62828", label: "Đã hủy" },
  COMPLETED:       { bg: "#e8f5e9", color: "#2e7d32", label: "Hoàn thành" },
};
function StatusBadge({ status }) {
  const s = BADGE[status] || { bg: "#f5f5f5", color: "#555", label: status };
  return (
    <span className="partner-manage-badge" style={{ background: s.bg, color: s.color }}>{s.label}</span>
  );
}

// ══════════════════════════════════════════════════════════════════════
// TAB 1 — Hotels
// ══════════════════════════════════════════════════════════════════════
const HOTEL_TYPES = ["HOTEL","APARTMENT","RESORT","VILLA","HOMESTAY","HOSTEL","GUEST_HOUSE"];
const HOTEL_TYPE_LABEL = { HOTEL:"Khách sạn",APARTMENT:"Căn hộ",RESORT:"Resort",VILLA:"Villa",HOMESTAY:"Homestay",HOSTEL:"Hostel",GUEST_HOUSE:"Nhà khách" };
const AMENITIES = [
  {key:"WIFI",label:"WiFi"},{key:"POOL",label:"Hồ bơi"},{key:"PARKING",label:"Bãi đỗ xe"},
  {key:"GYM",label:"Gym"},{key:"SPA",label:"Spa"},{key:"RESTAURANT",label:"Nhà hàng"},{key:"PET_ALLOWED",label:"Thú cưng"},
];
const EMPTY_HOTEL = { name:"",province:"",district:"",address:"",hotelType:"HOTEL",description:"",amenities:[] };

function HotelsTab() {
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY_HOTEL);
  const [err, setErr] = useState("");

  const { data: hotelsData, isLoading: loading } = useMyHotels();
  const hotels = Array.isArray(hotelsData) ? hotelsData : [];
  const createHotel = useCreateHotel();
  const updateHotel = useUpdateHotel();
  const saving = createHotel.isPending || updateHotel.isPending;

  function openCreate() { setForm(EMPTY_HOTEL); setErr(""); setModal("create"); }
  function openEdit(h) { setForm({ name: h.name||"", province: h.province||"", district: h.district||"", address: h.address||"", hotelType: h.hotelType||"HOTEL", description: h.description||"", amenities: h.amenities||[] }); setErr(""); setModal(h); }

  function handleSave() {
    if (!form.name.trim()) { setErr("Vui lòng nhập tên khách sạn"); return; }
    setErr("");
    if (modal === "create") {
      createHotel.mutate(form, {
        onSuccess: () => setModal(null),
        onError: (e) => setErr(e.message),
      });
    } else {
      updateHotel.mutate({ id: modal.id, ...form }, {
        onSuccess: () => setModal(null),
        onError: (e) => setErr(e.message),
      });
    }
  }

  function toggleAmenity(key) {
    setForm(f => ({ ...f, amenities: f.amenities.includes(key) ? f.amenities.filter(a => a !== key) : [...f.amenities, key] }));
  }

  return (
    <div>
      <div className="partner-manage-section-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#1a1a1a" }}>Danh sách khách sạn của tôi</div>
          <div style={{ fontSize: 13, color: "#888", marginTop: 2 }}>{hotels.length} khách sạn đã đăng ký</div>
        </div>
        <button className="partner-manage-btn-primary" onClick={openCreate}>+ Thêm khách sạn</button>
      </div>

      {loading ? <div style={{ textAlign: "center", padding: 48, color: "#bbb" }}>Đang tải...</div> : (
        <div style={{ display: "grid", gap: 14 }}>
          {hotels.length === 0 ? (
            <div style={{ textAlign: "center", padding: 64, color: "#bbb" }}>
              <Building2 size={48} color="#ddd" style={{ display: "block", margin: "0 auto 12px" }} />
              <div style={{ fontSize: 15, fontWeight: 700 }}>Chưa có khách sạn nào</div>
              <div style={{ fontSize: 13, marginTop: 6 }}>Nhấn "Thêm khách sạn" để bắt đầu</div>
            </div>
          ) : hotels.map(h => (
            <div key={h.id} className="partner-manage-card" style={{ padding: "18px 22px", display: "flex", alignItems: "center", gap: 18 }}>
              <div style={{ width: 52, height: 52, borderRadius: 12, background: `${P}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Building2 size={24} color={P} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, color: "#1a1a1a", fontSize: 15, marginBottom: 3 }}>{h.name}</div>
                <div style={{ fontSize: 12, color: "#888" }}>{HOTEL_TYPE_LABEL[h.hotelType] || h.hotelType} · {[h.district, h.province].filter(Boolean).join(", ")}</div>
                {h.amenities?.length > 0 && (
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 6 }}>
                    {h.amenities.slice(0, 5).map(a => (
                      <span key={a} style={{ background: "#f0f0f0", borderRadius: 5, padding: "2px 7px", fontSize: 11, color: "#666" }}>
                        {AMENITIES.find(x => x.key === a)?.label || a}
                      </span>
                    ))}
                    {h.amenities.length > 5 && <span style={{ fontSize: 11, color: "#aaa" }}>+{h.amenities.length - 5}</span>}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0, alignItems: "center" }}>
                <StatusBadge status={h.status || "ACTIVE"} />
                <button className="partner-manage-btn-ghost" style={{ display: "flex", alignItems: "center", gap: 5 }} onClick={() => openEdit(h)}><Pencil size={13} /> Sửa</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <Modal title={modal === "create" ? "Thêm khách sạn mới" : "Cập nhật khách sạn"} onClose={() => setModal(null)} width={560}>
          {err && <div style={{ background: "#ffebee", color: "#c62828", borderRadius: 8, padding: "9px 14px", fontSize: 13, marginBottom: 14, display: "flex", alignItems: "center", gap: 7 }}><AlertCircle size={14} />{err}</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
            <div><Label>Tên khách sạn *</Label><input className="partner-manage-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ví dụ: Grand Palace Hotel" /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div><Label>Tỉnh/Thành phố</Label><input className="partner-manage-input" value={form.province} onChange={e => setForm(f => ({ ...f, province: e.target.value }))} placeholder="Hà Nội" /></div>
              <div><Label>Quận/Huyện</Label><input className="partner-manage-input" value={form.district} onChange={e => setForm(f => ({ ...f, district: e.target.value }))} placeholder="Hoàn Kiếm" /></div>
            </div>
            <div><Label>Địa chỉ</Label><input className="partner-manage-input" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="123 Đường ABC" /></div>
            <div><Label>Loại</Label>
              <select className="partner-manage-input" value={form.hotelType} onChange={e => setForm(f => ({ ...f, hotelType: e.target.value }))}>
                {HOTEL_TYPES.map(t => <option key={t} value={t}>{HOTEL_TYPE_LABEL[t]}</option>)}
              </select>
            </div>
            <div><Label>Mô tả</Label><textarea className="partner-manage-input" style={{ height: 68, resize: "vertical" }} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Mô tả ngắn về khách sạn..." /></div>
            <div>
              <Label>Tiện ích</Label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {AMENITIES.map(a => {
                  const sel = form.amenities.includes(a.key);
                  return (
                    <button key={a.key} type="button" onClick={() => toggleAmenity(a.key)} style={{ padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1.5px solid ${sel ? P : "#ddd"}`, background: sel ? `${P}15` : "#f9f9f9", color: sel ? P : "#666" }}>
                      {a.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
            <button className="partner-manage-btn-ghost" onClick={() => setModal(null)}>Hủy</button>
            <button className="partner-manage-btn-primary" style={{ opacity: saving ? 0.6 : 1 }} disabled={saving} onClick={handleSave}>
              {saving ? "Đang lưu..." : modal === "create" ? "Tạo khách sạn" : "Lưu thay đổi"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// TAB 2 — Room Types
// ══════════════════════════════════════════════════════════════════════
const CATEGORIES  = [{key:"STANDARD",label:"Standard"},{key:"DELUXE",label:"Deluxe"},{key:"SUITE",label:"Suite"},{key:"FAMILY",label:"Family"}];
const BED_TYPES   = [{key:"SINGLE",label:"Giường đơn"},{key:"DOUBLE",label:"Giường đôi"},{key:"TWIN",label:"Hai giường"}];
const ROOM_AMENS  = [
  {key:"AIR_CONDITIONER",label:"Điều hòa"},{key:"TV",label:"TV"},{key:"MINI_BAR",label:"Mini bar"},
  {key:"PRIVATE_BATHROOM",label:"P.tắm riêng"},{key:"BATHTUB",label:"Bồn tắm"},{key:"BALCONY",label:"Ban công"},
  {key:"SEA_VIEW",label:"View biển"},{key:"BREAKFAST",label:"Bữa sáng"},{key:"WIFI",label:"WiFi"},
];
const EMPTY_ROOM = { name:"",capacity:2,quantity:1,price:500000,roomCategory:"STANDARD",bedType:"DOUBLE",amenities:[] };

function RoomsTab() {
  const [selHotel, setSelHotel] = useState(null);
  const [modal, setModal]       = useState(null);
  const [form, setForm]         = useState(EMPTY_ROOM);
  const [err, setErr]           = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);

  const { data: hotelsData, isLoading: loadingH } = useMyHotels();
  const hotels = Array.isArray(hotelsData) ? hotelsData : [];

  const { data: roomsData, isLoading: loadingR } = usePartnerRooms(selHotel?.id);
  const rooms = Array.isArray(roomsData) ? roomsData : [];

  const createRoom   = useCreateRoom();
  const updateRoom   = useUpdateRoom();
  const uploadImages = useUploadRoomImages();
  const saving = createRoom.isPending || updateRoom.isPending || uploadImages.isPending;

  useEffect(() => {
    if (hotels.length && !selHotel) setSelHotel(hotels[0]);
  }, [hotels]);

  function openCreate() { setForm(EMPTY_ROOM); setSelectedFiles([]); setErr(""); setModal("create"); }
  function openEdit(r) { setForm({ name:r.name||"",capacity:r.capacity||2,quantity:r.quantity||1,price:r.price||500000,roomCategory:r.roomCategory||"STANDARD",bedType:r.bedType||"DOUBLE",amenities:r.amenities||[],imageUrls:Array.isArray(r.imageUrls)?r.imageUrls:[] }); setSelectedFiles([]); setErr(""); setModal(r); }

  function handleSave() {
    if (!form.name.trim()) { setErr("Vui lòng nhập tên loại phòng"); return; }
    setErr("");
    const imageUrls = modal !== "create" && form.imageUrls ? [...form.imageUrls] : [];
    const newForm = { ...form, imageUrls };

    const onUpload = (savedRoomId, onDone) => {
      if (selectedFiles?.length) {
        uploadImages.mutate({ roomId: savedRoomId, hotelId: selHotel.id, files: selectedFiles }, {
          onSuccess: () => { setModal(null); setSelectedFiles([]); },
          onError: (e) => setErr(e.message),
        });
      } else { onDone(); }
    };

    if (modal === "create") {
      createRoom.mutate({ hotelId: selHotel.id, ...newForm }, {
        onSuccess: (savedRoom) => onUpload(savedRoom.id, () => { setModal(null); setSelectedFiles([]); }),
        onError: (e) => setErr(e.message),
      });
    } else {
      updateRoom.mutate({ roomId: modal.id, hotelId: selHotel.id, ...newForm }, {
        onSuccess: (savedRoom) => onUpload(savedRoom?.id ?? modal.id, () => { setModal(null); setSelectedFiles([]); }),
        onError: (e) => setErr(e.message),
      });
    }
  }
  function toggleRoomAmen(key) {
    setForm(f => ({ ...f, amenities: f.amenities.includes(key) ? f.amenities.filter(a => a !== key) : [...f.amenities, key] }));
  }

  return (
    <div>
      {/* Hotel picker */}
      <div className="partner-manage-section-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#555" }}>Khách sạn:</div>
          {loadingH ? <span style={{ color: "#bbb", fontSize: 13 }}>Đang tải...</span> : (
            <select className="partner-manage-input" style={{ width: "auto", minWidth: 220 }} value={selHotel?.id || ""} onChange={e => setSelHotel(hotels.find(h => String(h.id) === e.target.value))}>
              {hotels.length === 0 ? <option>Chưa có khách sạn</option> : hotels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          )}
        </div>
        {selHotel && <button className="partner-manage-btn-primary" onClick={openCreate}>+ Thêm loại phòng</button>}
      </div>

      {!selHotel && !loadingH && (
        <div style={{ textAlign: "center", padding: 64, color: "#bbb" }}>
          <Building2 size={40} color="#ddd" style={{ display: "block", margin: "0 auto 10px" }} />
          <div style={{ fontSize: 14 }}>Hãy tạo khách sạn trước ở tab "Khách sạn"</div>
        </div>
      )}

      {selHotel && (
        loadingR ? <div style={{ textAlign: "center", padding: 48, color: "#bbb" }}>Đang tải...</div> : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
            {rooms.length === 0 ? (
              <div style={{ gridColumn: "1/-1", textAlign: "center", padding: 64, color: "#bbb" }}>
                <Bed size={40} color="#ddd" style={{ display: "block", margin: "0 auto 10px" }} />
                <div style={{ fontSize: 14 }}>Chưa có loại phòng nào</div>
              </div>
            ) : rooms.map(r => (
              <div key={r.id} className="partner-manage-card" style={{ padding: "18px 20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: "#1a1a1a" }}>{r.name}</div>
                    <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{CATEGORIES.find(c => c.key === r.roomCategory)?.label} · {BED_TYPES.find(b => b.key === r.bedType)?.label}</div>
                  </div>
                  <button className="partner-manage-btn-ghost" style={{ padding: "5px 12px", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }} onClick={() => openEdit(r)}><Pencil size={12} /> Sửa</button>
                </div>
                <div style={{ display: "flex", gap: 14, fontSize: 13, color: "#555", marginBottom: 10 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Users size={13} /> {r.capacity} khách</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}><DoorOpen size={13} /> {r.quantity} phòng</span>
                </div>
                <div style={{ fontWeight: 900, color: P, fontSize: 16 }}>{fmt(r.price)}<span style={{ fontWeight: 400, fontSize: 12, color: "#aaa" }}>/đêm</span></div>
                {r.amenities?.length > 0 && (
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 8 }}>
                    {r.amenities.slice(0, 4).map(a => <span key={a} style={{ background: "#f0f0f0", borderRadius: 4, padding: "2px 7px", fontSize: 10, color: "#666" }}>{ROOM_AMENS.find(x => x.key === a)?.label || a}</span>)}
                    {r.amenities.length > 4 && <span style={{ fontSize: 10, color: "#aaa" }}>+{r.amenities.length - 4}</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {modal && (
        <Modal title={modal === "create" ? "Thêm loại phòng" : "Cập nhật loại phòng"} onClose={() => setModal(null)}>
          {err && <div style={{ background: "#ffebee", color: "#c62828", borderRadius: 8, padding: "9px 14px", fontSize: 13, marginBottom: 14, display: "flex", alignItems: "center", gap: 7 }}><AlertCircle size={14} />{err}</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div><Label>Tên loại phòng *</Label><input className="partner-manage-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="VD: Phòng Deluxe View Biển" /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div><Label>Hạng phòng</Label>
                <select className="partner-manage-input" value={form.roomCategory} onChange={e => setForm(f => ({ ...f, roomCategory: e.target.value }))}>
                  {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </div>
              <div><Label>Loại giường</Label>
                <select className="partner-manage-input" value={form.bedType} onChange={e => setForm(f => ({ ...f, bedType: e.target.value }))}>
                  {BED_TYPES.map(b => <option key={b.key} value={b.key}>{b.label}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div><Label>Sức chứa</Label><input className="partner-manage-input" type="number" min={1} max={20} value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: Number(e.target.value) }))} /></div>
              <div><Label>Số phòng</Label><input className="partner-manage-input" type="number" min={1} value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: Number(e.target.value) }))} /></div>
              <div><Label>Giá/đêm (₫)</Label><input className="partner-manage-input" type="number" min={0} step={50000} value={form.price} onChange={e => setForm(f => ({ ...f, price: Number(e.target.value) }))} /></div>
            </div>
            <div>
              <Label>Tiện nghi phòng</Label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {ROOM_AMENS.map(a => {
                  const sel = form.amenities.includes(a.key);
                  return (
                    <button key={a.key} type="button" onClick={() => toggleRoomAmen(a.key)} style={{ padding: "4px 11px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1.5px solid ${sel ? P : "#ddd"}`, background: sel ? `${P}15` : "#f9f9f9", color: sel ? P : "#666" }}>
                      {a.label}
                    </button>
                  );
                })}
              </div>
              <div>
                <Label>Hình ảnh phòng</Label>
                <input
                    type="file"
                    multiple
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="partner-manage-input"
                    onChange={(e) => setSelectedFiles(Array.from(e.target.files))}
                />
              </div>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
            <button className="partner-manage-btn-ghost" onClick={() => setModal(null)}>Hủy</button>
            <button className="partner-manage-btn-primary" style={{ opacity: saving ? 0.6 : 1 }} disabled={saving} onClick={handleSave}>
              {saving ? "Đang lưu..." : modal === "create" ? "Tạo loại phòng" : "Lưu thay đổi"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// TAB 3 — Calendar & Pricing
// ══════════════════════════════════════════════════════════════════════
const DAY_NAMES   = ["CN","T2","T3","T4","T5","T6","T7"];
const MONTH_NAMES = ["Tháng 1","Tháng 2","Tháng 3","Tháng 4","Tháng 5","Tháng 6","Tháng 7","Tháng 8","Tháng 9","Tháng 10","Tháng 11","Tháng 12"];

function buildCalDays(year, month) {
  const first = new Date(year, month, 1).getDay();
  const total  = new Date(year, month + 1, 0).getDate();
  const days   = [];
  for (let i = 0; i < first; i++) days.push(null);
  for (let d = 1; d <= total; d++) days.push(d);
  return days;
}
function buildOccupied(bookings, year, month) {
  const set = new Set();
  for (const b of bookings) {
    if (b.status === "CANCELLED") continue;
    const ci = new Date(b.checkIn), co = new Date(b.checkOut);
    const cur = new Date(ci);
    while (cur < co) {
      if (cur.getFullYear() === year && cur.getMonth() === month) set.add(cur.getDate());
      cur.setDate(cur.getDate() + 1);
    }
  }
  return set;
}

function CalendarTab() {
  const now = new Date();
  const [selHotel, setSelHotel]   = useState(null);
  const [selRoom, setSelRoom]     = useState(null);
  const [year, setYear]           = useState(now.getFullYear());
  const [month, setMonth]         = useState(now.getMonth());
  const [priceForm, setPriceForm] = useState({ from: "", to: "", price: "" });
  const [availForm, setAvailForm] = useState({ from: "", to: "", count: "" });
  const [msg, setMsg]             = useState("");

  const { data: hotelsData } = useMyHotels();
  const hotels = Array.isArray(hotelsData) ? hotelsData : [];

  const { data: roomsData } = usePartnerRooms(selHotel?.id);
  const rooms = Array.isArray(roomsData) ? roomsData : [];

  const calFrom = `${year}-${String(month + 1).padStart(2,"0")}-01`;
  const calTo   = `${year}-${String(month + 1).padStart(2,"0")}-${new Date(year, month + 1, 0).getDate()}`;
  const { data: bookingsData, isLoading: loadingB } = usePartnerBookings(
    { hotelId: selHotel?.id, checkInFrom: calFrom, checkInTo: calTo, size: 100 },
    { enabled: Boolean(selHotel) },
  );
  const bookings = bookingsData?.items || [];

  const updateRoom = useUpdateRoom();

  useEffect(() => {
    if (hotels.length && !selHotel) setSelHotel(hotels[0]);
  }, [hotels]);

  useEffect(() => {
    if (rooms.length && !selRoom) setSelRoom(rooms[0]);
    else if (!rooms.length) setSelRoom(null);
  }, [rooms]);

  function prevMonth() { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); }
  function nextMonth() { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); }

  const days     = buildCalDays(year, month);
  const occupied = buildOccupied(bookings, year, month);
  const today    = now.getDate();
  const isThisMonth = now.getFullYear() === year && now.getMonth() === month;

  function handleUpdatePrice() {
    if (!selRoom || !priceForm.price) return;
    updateRoom.mutate(
      { roomId: selRoom.id, hotelId: selHotel.id, ...selRoom, price: Number(priceForm.price) },
      {
        onSuccess: () => {
          setMsg(`✅ Đã cập nhật giá thành ${fmt(Number(priceForm.price))} cho "${selRoom.name}"`);
          setPriceForm({ from: "", to: "", price: "" });
        },
        onError: (e) => setMsg(`❌ ${e.message}`),
      },
    );
  }
  function handleUpdateAvail() {
    if (!selRoom || !availForm.count) return;
    updateRoom.mutate(
      { roomId: selRoom.id, hotelId: selHotel.id, ...selRoom, quantity: Number(availForm.count) },
      {
        onSuccess: () => {
          setMsg(`✅ Đã cập nhật số phòng thành ${availForm.count} cho "${selRoom.name}"`);
          setAvailForm({ from: "", to: "", count: "" });
        },
        onError: (e) => setMsg(`❌ ${e.message}`),
      },
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20 }}>
      {/* Left: calendar */}
      <div>
        {/* Selectors */}
        <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          <select className="partner-manage-input" style={{ width: "auto", minWidth: 200 }} value={selHotel?.id || ""} onChange={e => setSelHotel(hotels.find(h => String(h.id) === e.target.value))}>
            {hotels.length === 0 ? <option>Chưa có khách sạn</option> : hotels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
          <select className="partner-manage-input" style={{ width: "auto", minWidth: 180 }} value={selRoom?.id || ""} onChange={e => setSelRoom(rooms.find(r => String(r.id) === e.target.value))}>
            {rooms.length === 0 ? <option>Chưa có phòng</option> : rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>

        {/* Calendar */}
        <div className="partner-manage-card" style={{ overflow: "hidden" }}>
          {/* Month nav */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid #f0f0f0" }}>
            <button onClick={prevMonth} className="partner-manage-btn-ghost" style={{ padding: "6px 14px" }}>‹</button>
            <div style={{ fontWeight: 800, fontSize: 15 }}>{MONTH_NAMES[month]} {year}</div>
            <button onClick={nextMonth} className="partner-manage-btn-ghost" style={{ padding: "6px 14px" }}>›</button>
          </div>
          <div style={{ padding: "14px 16px" }}>
            {/* Day headers */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, marginBottom: 6 }}>
              {DAY_NAMES.map(d => <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: "#999", padding: "4px 0" }}>{d}</div>)}
            </div>
            {/* Days grid */}
            {loadingB ? (
              <div style={{ textAlign: "center", padding: 40, color: "#bbb" }}>Đang tải...</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
                {days.map((d, i) => {
                  if (!d) return <div key={`e${i}`} />;
                  const occ = occupied.has(d);
                  const isToday = isThisMonth && d === today;
                  return (
                    <div key={d} style={{
                      aspectRatio: "1", display: "flex", alignItems: "center", justifyContent: "center",
                      borderRadius: 8, fontSize: 13, fontWeight: isToday ? 800 : 500,
                      background: occ ? `${P}15` : isToday ? P : "transparent",
                      color: occ ? P : isToday ? "#fff" : "#333",
                      border: occ ? `1px solid ${P}30` : isToday ? "none" : "1px solid transparent",
                      position: "relative",
                    }}>
                      {d}
                      {occ && <div style={{ position: "absolute", bottom: 4, left: "50%", transform: "translateX(-50%)", width: 4, height: 4, borderRadius: "50%", background: P }} />}
                    </div>
                  );
                })}
              </div>
            )}
            {/* Legend */}
            <div style={{ display: "flex", gap: 16, marginTop: 14, fontSize: 12, color: "#888" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: `${P}15`, border: `1px solid ${P}30` }} /> Có booking
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: P }} /> Hôm nay
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right: settings forms */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {msg && (
          <div style={{ padding: "10px 14px", borderRadius: 9, fontSize: 13, background: msg.startsWith("✅") ? "#e8f5e9" : "#ffebee", color: msg.startsWith("✅") ? "#2e7d32" : "#c62828" }}>
            {msg}
            <button onClick={() => setMsg("")} style={{ float: "right", background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "inherit" }}>×</button>
          </div>
        )}

        {/* Price form */}
        <div className="partner-manage-card" style={{ padding: "18px 20px" }}>
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 14, color: "#1a1a1a", display: "flex", alignItems: "center", gap: 8 }}>
            <CircleDollarSign size={16} color={P} /> Thiết lập giá phòng
          </div>
          <div style={{ marginBottom: 10 }}>
            <Label>Loại phòng</Label>
            <div style={{ fontSize: 13, fontWeight: 700, color: P }}>{selRoom?.name || "—"}</div>
            <div style={{ fontSize: 12, color: "#888" }}>Giá hiện tại: {selRoom ? fmt(selRoom.price) : "—"}/đêm</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
            <div><Label>Từ ngày</Label><input type="date" className="partner-manage-input" value={priceForm.from} onChange={e => setPriceForm(f => ({ ...f, from: e.target.value }))} /></div>
            <div><Label>Đến ngày</Label><input type="date" className="partner-manage-input" value={priceForm.to} onChange={e => setPriceForm(f => ({ ...f, to: e.target.value }))} /></div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <Label>Giá mới (₫/đêm)</Label>
            <input type="number" className="partner-manage-input" placeholder="VD: 800000" step={50000} value={priceForm.price} onChange={e => setPriceForm(f => ({ ...f, price: e.target.value }))} />
          </div>
          <button className="partner-manage-btn-primary" style={{ width: "100%" }} onClick={handleUpdatePrice}>Cập nhật giá</button>
        </div>

        {/* Availability form */}
        <div className="partner-manage-card" style={{ padding: "18px 20px" }}>
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 14, color: "#1a1a1a", display: "flex", alignItems: "center", gap: 8 }}>
            <DoorOpen size={16} color={P} /> Thiết lập số phòng
          </div>
          <div style={{ marginBottom: 10 }}>
            <Label>Loại phòng</Label>
            <div style={{ fontSize: 13, fontWeight: 700, color: P }}>{selRoom?.name || "—"}</div>
            <div style={{ fontSize: 12, color: "#888" }}>Số phòng hiện tại: {selRoom?.quantity ?? "—"}</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
            <div><Label>Từ ngày</Label><input type="date" className="partner-manage-input" value={availForm.from} onChange={e => setAvailForm(f => ({ ...f, from: e.target.value }))} /></div>
            <div><Label>Đến ngày</Label><input type="date" className="partner-manage-input" value={availForm.to} onChange={e => setAvailForm(f => ({ ...f, to: e.target.value }))} /></div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <Label>Số phòng còn trống</Label>
            <input type="number" className="partner-manage-input" placeholder="VD: 5" min={0} value={availForm.count} onChange={e => setAvailForm(f => ({ ...f, count: e.target.value }))} />
          </div>
          <button className="partner-manage-btn-primary" style={{ width: "100%" }} onClick={handleUpdateAvail}>Cập nhật tồn phòng</button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// TAB 4 — Stats
// ══════════════════════════════════════════════════════════════════════
const MONTH_SHORT = ["T1","T2","T3","T4","T5","T6","T7","T8","T9","T10","T11","T12"];

function StatsTab() {
  const [selHotel, setSelHotel] = useState(null);
  const [year, setYear]         = useState(new Date().getFullYear());

  const { data: hotelsData } = useMyHotels();
  const hotels = Array.isArray(hotelsData) ? hotelsData : [];

  const { data: bookingsData, isLoading: loading } = usePartnerBookings(
    { hotelId: selHotel?.id, size: 500 },
    { enabled: Boolean(selHotel) },
  );
  const bookings = bookingsData?.items || [];

  useEffect(() => {
    if (hotels.length && !selHotel) setSelHotel(hotels[0]);
  }, [hotels]);

  const filtered = bookings.filter(b => {
    const d = new Date(b.checkIn || b.createdAt || "");
    return !isNaN(d) && d.getFullYear() === year;
  });

  const total   = filtered.filter(b => b.status !== "CANCELLED").reduce((s, b) => s + (b.totalPrice || 0), 0);
  const counts  = { all: filtered.length, confirmed: filtered.filter(b => b.status === "CONFIRMED" || b.status === "COMPLETED").length, cancelled: filtered.filter(b => b.status === "CANCELLED").length };

  const monthly = MONTH_SHORT.map((label, i) => {
    const key = `${year}-${String(i + 1).padStart(2, "0")}`;
    const mbks = filtered.filter(b => {
      const d = b.checkIn || b.createdAt || "";
      return d.startsWith(key) && b.status !== "CANCELLED";
    });
    return { label, revenue: mbks.reduce((s, b) => s + (b.totalPrice || 0), 0), count: mbks.length };
  });

  const maxRev = Math.max(...monthly.map(m => m.revenue), 1);

  return (
    <div>
      {/* Filters */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <select className="partner-manage-input" style={{ width: "auto", minWidth: 220 }} value={selHotel?.id || ""} onChange={e => setSelHotel(hotels.find(h => String(h.id) === e.target.value))}>
          {hotels.length === 0 ? <option>Chưa có khách sạn</option> : hotels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
        <select className="partner-manage-input" style={{ width: "auto" }} value={year} onChange={e => setYear(Number(e.target.value))}>
          {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {loading ? <div style={{ textAlign: "center", padding: 48, color: "#bbb" }}>Đang tải...</div> : (
        <>
          {/* Summary cards */}
          <div className="partner-manage-stat-grid">
            {[
              { label: "Tổng doanh thu", value: fmt(total),         Icon: CircleDollarSign, color: P          },
              { label: "Tổng booking",   value: counts.all,          Icon: ClipboardList,    color: "#4361ee"  },
              { label: "Đã xác nhận",    value: counts.confirmed,    Icon: CheckCircle2,     color: "#2e7d32"  },
            ].map(c => (
              <div key={c.label} className="partner-manage-card partner-manage-stat-card">
                <div style={{ width: 48, height: 48, borderRadius: 12, background: `${c.color}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><c.Icon size={22} color={c.color} /></div>
                <div>
                  <div style={{ fontSize: typeof c.value === "string" ? 18 : 26, fontWeight: 900, color: "#1a1a1a" }}>{c.value}</div>
                  <div style={{ fontSize: 11, color: "#888", marginTop: 2, fontWeight: 600 }}>{c.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Bar chart */}
          <div className="partner-manage-card" style={{ padding: "20px 24px", marginBottom: 22 }}>
            <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 18, color: "#1a1a1a" }}>Doanh thu theo tháng — {year}</div>
            <div className="partner-manage-chart">
              {monthly.map(m => (
                <div key={m.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ fontSize: 10, color: "#999", fontWeight: 600, whiteSpace: "nowrap" }}>
                    {m.revenue > 0 ? (m.revenue >= 1_000_000 ? (m.revenue / 1_000_000).toFixed(0) + "tr" : m.revenue.toLocaleString()) : ""}
                  </div>
                  <div 
                    className="partner-manage-chart-bar"
                    style={{
                      background: m.revenue > 0 ? P : "#f0f0f0",
                      height: m.revenue > 0 ? Math.max((m.revenue / maxRev) * 100, 4) + "px" : "4px",
                    }} 
                    title={`${m.label}: ${fmt(m.revenue)}`} 
                  />
                  <div style={{ fontSize: 10, color: "#aaa", fontWeight: 600 }}>{m.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Booking table */}
          <div className="partner-manage-card" style={{ overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid #f0f0f0", fontWeight: 800, fontSize: 14, color: "#1a1a1a" }}>
              Danh sách booking ({filtered.length})
            </div>
            <div className="partner-manage-table-container">
              <table className="partner-manage-table">
                <thead>
                  <tr style={{ background: "#f8f9fa" }}>
                    {["#ID","Check-in","Check-out","Đêm","Trạng thái","Tổng tiền"].map(h => (
                      <th key={h} className="partner-manage-table-th">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: "center", padding: 40, color: "#bbb" }}>Không có booking trong năm {year}</td></tr>
                  ) : filtered.slice(0, 50).map(b => (
                    <tr key={b.id} className="partner-manage-table-row">
                      <td className="partner-manage-table-td" style={{ fontFamily: "monospace", color: "#888" }}>#{b.id}</td>
                      <td className="partner-manage-table-td">{fmtDate(b.checkIn)}</td>
                      <td className="partner-manage-table-td">{fmtDate(b.checkOut)}</td>
                      <td className="partner-manage-table-td" style={{ textAlign: "center" }}>{nightsBetween(b.checkIn, b.checkOut)}</td>
                      <td className="partner-manage-table-td"><StatusBadge status={b.status} /></td>
                      <td className="partner-manage-table-td" style={{ fontWeight: 700, color: P }}>{fmt(b.totalPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════
const TABS = [
  { id: "hotels",   label: "Khách sạn của tôi",      Icon: Building2,        desc: "Tạo, cập nhật, xem danh sách" },
  { id: "rooms",    label: "Loại phòng",     Icon: Bed,              desc: "Quản lý loại phòng" },
  { id: "calendar", label: "Giá & Tồn phòng", Icon: Calendar,        desc: "Lịch phòng, giá, số lượng" },
  { id: "stats",    label: "Thống kê",        Icon: BarChart3,        desc: "Doanh thu & booking" },
];

export default function PartnerManagePage({ navigate, user, onLogout }) {
  const [tab, setTab] = useState("hotels");
  const active = TABS.find(t => t.id === tab);

  return (
    <div className="partner-manage-page">
      <MainNavbar active="partner-manage" navigate={navigate} user={user} onLogout={onLogout} />

      {/* Hero */}
      <div className="partner-manage-hero">
        <div className="partner-manage-hero-container">
          <div className="partner-manage-hero-meta">
            VLU HotelHub · Đối tác
          </div>
          <h1 className="partner-manage-hero-title">Quản lý đối tác</h1>
          <p className="partner-manage-hero-desc">
            Quản lý khách sạn, loại phòng, giá & tồn phòng và theo dõi thống kê
          </p>
          {/* Tabs */}
          <div className="partner-manage-tabs-header">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} className={`partner-manage-tab-btn ${tab === t.id ? "partner-manage-tab-btn-active" : ""}`}>
                <t.Icon size={14} />
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="partner-manage-content">
        <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
          <div>
            <div style={{ fontSize: 11, color: "#aaa", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8 }}>{active?.desc}</div>
          </div>
        </div>

        {tab === "hotels"   && <HotelsTab />}
        {tab === "rooms"    && <RoomsTab />}
        {tab === "calendar" && <CalendarTab />}
        {tab === "stats"    && <StatsTab />}
      </div>

      <Footer navigate={navigate} />
    </div>
  );
}
