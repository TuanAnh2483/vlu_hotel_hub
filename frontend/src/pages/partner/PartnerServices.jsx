import { useState, useEffect } from "react";
import { useOutletContext, useNavigate, useLocation } from "react-router-dom";
import {
  useMyHotels, usePartnerRooms, useUpdateHotel, useUpdateRoom,
} from "../../hooks/usePartnerQueries";
import { PageHeader } from "../../components/admin/AdminLayout";
import {
  Building2, BedDouble, MapPin, Home, Check, Save,
  Wrench, Plus, X,
} from "lucide-react";
import {
  HOTEL_AMENITY_CATEGORIES, HOTEL_AMENITY_KEYS,
  ROOM_AMENITY_CATEGORIES, ROOM_AMENITY_KEYS,
} from "../../utils/amenityConfig";
import { useToast } from "../../contexts/ToastContext";
import "../../styles/pages/partner/PartnerServices.css";

const ROOM_CATEGORIES = [
  { key: "STANDARD", label: "Tiêu chuẩn" },
  { key: "DELUXE",   label: "Sang trọng" },
  { key: "SUITE",    label: "Suite" },
  { key: "FAMILY",   label: "Gia đình" },
];

function HotelChips({ hotels, selectedId, onSelect }) {
  return (
    <div className="psv-hotel-chips-wrap">
      <div className="psv-hotel-chips-label">
        <Home size={15} color="#BE1E2E" /> Chọn cơ sở:
      </div>
      <div className="psv-hotel-chips-row">
        {hotels.map(h => {
          const thumb = h.coverImageUrl || (Array.isArray(h.imageUrls) ? h.imageUrls[0] : "");
          const active = String(h.id) === String(selectedId);
          return (
            <button
              key={h.id}
              className={`psv-hotel-chip${active ? " psv-hotel-chip--active" : ""}`}
              onClick={() => onSelect(String(h.id))}
            >
              <div className="psv-chip-thumb">
                {thumb
                  ? <img src={thumb} alt={h.name} />
                  : <Building2 size={16} color="#94a3b8" />
                }
              </div>
              <div className="psv-chip-info">
                <div className="psv-chip-name">{h.name}</div>
                {(h.district || h.province) && (
                  <div className="psv-chip-loc">
                    <MapPin size={10} /> {[h.district, h.province].filter(Boolean).join(", ")}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RoomChips({ rooms, selectedId, onSelect }) {
  return (
    <div className="psv-room-chips-wrap">
      <div className="psv-room-chips-label">
        <BedDouble size={15} color="#BE1E2E" /> Chọn loại phòng:
      </div>
      <div className="psv-room-chips-row">
        {rooms.map(r => {
          const active = String(r.id) === String(selectedId);
          const catLabel = ROOM_CATEGORIES.find(c => c.key === r.roomCategory)?.label || r.roomCategory;
          const count = (r.amenities?.length || 0) + (r.customAmenities?.length || 0);
          return (
            <button
              key={r.id}
              className={`psv-room-chip${active ? " psv-room-chip--active" : ""}`}
              onClick={() => onSelect(String(r.id))}
            >
              <div className="psv-room-chip-cat">{catLabel}</div>
              <div className="psv-room-chip-name">{r.name}</div>
              {count > 0 && <span className="psv-room-chip-badge">{count}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AmenityGroup({ category, selected, onToggle }) {
  return (
    <div className="psv-amenity-group">
      <div className="psv-amenity-group-label">{category.label}</div>
      <div className="psv-amenity-grid">
        {category.items.map(({ key, label, Icon }) => {
          const checked = selected.has(key);
          return (
            <button
              key={key}
              type="button"
              className={`psv-amenity-item${checked ? " selected" : ""}`}
              onClick={() => onToggle(key)}
            >
              <span className="psv-amenity-check">{checked && <Check size={11} />}</span>
              <Icon size={14} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CustomAmenities({ values, onRemove, input, onInputChange, onAdd }) {
  return (
    <div className="psv-custom-section">
      <div className="psv-section-label">Tiện ích tùy chỉnh</div>
      {values.length > 0 && (
        <div className="psv-custom-tags">
          {values.map((tag, i) => (
            <span key={i} className="psv-custom-tag">
              {tag}
              <button className="psv-custom-tag-del" onClick={() => onRemove(i)}>
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="psv-custom-input-row">
        <input
          className="psv-custom-input"
          placeholder="Nhập tiện ích tùy chỉnh rồi nhấn Enter..."
          value={input}
          onChange={e => onInputChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" && input.trim()) { onAdd(); }
          }}
        />
        <button className="psv-custom-add-btn" onClick={onAdd} disabled={!input.trim()}>
          <Plus size={14} /> Thêm
        </button>
      </div>
    </div>
  );
}

export default function PartnerServices() {
  const navigate = useNavigate();
  const { state: navState } = useLocation();
  const outletCtx = useOutletContext() || {};
  const { selectedHotelId: ctxHotelId, setSelectedHotelId: setCtxHotelId } = outletCtx;
  const toast = useToast();

  const [selectedHotelId, setSelectedHotelId] = useState(
    ctxHotelId ? String(ctxHotelId) : ""
  );
  const [activeTab, setActiveTab]     = useState("hotel");
  const [selectedRoomId, setSelectedRoomId] = useState("");

  const [hotelAmenities, setHotelAmenities]   = useState(new Set());
  const [hotelCustom, setHotelCustom]         = useState([]);
  const [hotelCustomInput, setHotelCustomInput] = useState("");

  const [roomAmenities, setRoomAmenities]     = useState(new Set());
  const [roomCustom, setRoomCustom]           = useState([]);
  const [roomCustomInput, setRoomCustomInput] = useState("");

  const [saving, setSaving] = useState(false);

  const { data: hotelData = [] } = useMyHotels();
  const hotels = Array.isArray(hotelData) ? hotelData : [];

  const { data: roomData = [] } = usePartnerRooms(selectedHotelId);
  const rooms = Array.isArray(roomData) ? roomData : [];

  const updateHotelMut = useUpdateHotel();
  const updateRoomMut  = useUpdateRoom();

  const selectedHotel = hotels.find(h => String(h.id) === selectedHotelId);
  const selectedRoom  = rooms.find(r => String(r.id) === selectedRoomId);

  // Auto-select first hotel
  useEffect(() => {
    if (!selectedHotelId && hotels.length > 0) selectHotel(String(hotels[0].id));
  }, [hotels]); // eslint-disable-line

  // Sync outlet context → local
  useEffect(() => {
    if (ctxHotelId && !selectedHotelId) setSelectedHotelId(String(ctxHotelId));
  }, [ctxHotelId]); // eslint-disable-line

  // Load hotel amenities when selection changes
  useEffect(() => {
    if (!selectedHotel) return;
    setHotelAmenities(new Set((selectedHotel.amenities || []).filter(k => HOTEL_AMENITY_KEYS.has(k))));
    setHotelCustom(selectedHotel.customAmenities ? [...selectedHotel.customAmenities] : []);
  }, [selectedHotelId, selectedHotel?.amenities?.join(",")]); // eslint-disable-line

  // Auto-select first room when rooms load
  useEffect(() => {
    if (rooms.length === 0) { setSelectedRoomId(""); return; }
    if (!selectedRoomId || !rooms.find(r => String(r.id) === selectedRoomId)) {
      setSelectedRoomId(String(rooms[0].id));
    }
  }, [rooms]); // eslint-disable-line

  // Load room amenities when selection changes
  useEffect(() => {
    if (!selectedRoom) return;
    setRoomAmenities(new Set((selectedRoom.amenities || []).filter(k => ROOM_AMENITY_KEYS.has(k))));
    setRoomCustom(selectedRoom.customAmenities ? [...selectedRoom.customAmenities] : []);
  }, [selectedRoomId, selectedRoom?.amenities?.join(",")]); // eslint-disable-line

  function selectHotel(id) {
    setSelectedHotelId(id);
    setCtxHotelId?.(id ? Number(id) : null);
    setSelectedRoomId("");
  }

  function toggleHotelAmenity(key) {
    setHotelAmenities(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function toggleRoomAmenity(key) {
    setRoomAmenities(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  async function handleSaveHotelAmenities() {
    if (!selectedHotel) return;
    setSaving(true);
    try {
      await updateHotelMut.mutateAsync({
        id:             selectedHotel.id,
        name:           selectedHotel.name,
        address:        selectedHotel.address,
        district:       selectedHotel.district,
        province:       selectedHotel.province,
        description:    selectedHotel.description || "",
        hotelType:      selectedHotel.hotelType,
        bookingMode:    selectedHotel.bookingMode || "BY_ROOM",
        amenities:      [...hotelAmenities],
        customAmenities: hotelCustom,
        imageUrls:      selectedHotel.imageUrls || [],
      });
      toast.success("Đã lưu tiện ích khách sạn");
    } catch (e) {
      toast.error(e.message || "Không thể lưu tiện ích");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveRoomAmenities() {
    if (!selectedRoom) return;
    setSaving(true);
    try {
      await updateRoomMut.mutateAsync({
        roomId:          selectedRoom.id,
        hotelId:         selectedHotelId,
        name:            selectedRoom.name,
        capacity:        selectedRoom.capacity,
        quantity:        selectedRoom.quantity,
        price:           selectedRoom.price,
        roomCategory:    selectedRoom.roomCategory,
        bedType:         selectedRoom.bedType,
        amenities:       [...roomAmenities],
        customAmenities: roomCustom,
        imageUrls:       selectedRoom.imageUrls || [],
        description:     selectedRoom.description || null,
      });
      toast.success("Đã lưu tiện ích phòng");
    } catch (e) {
      toast.error(e.message || "Không thể lưu tiện ích");
    } finally {
      setSaving(false);
    }
  }

  if (hotels.length === 0) {
    return (
      <div className="psv-root">
        <PageHeader
          title="Dịch vụ & tiện ích"
          subtitle="Cấu hình tiện ích cho khách sạn và từng loại phòng"
        />
        <div className="psv-empty">
          <Wrench size={40} color="#cbd5e1" />
          <div className="psv-empty-title">Chưa có cơ sở nào</div>
          <div className="psv-empty-desc">Hãy thêm khách sạn trước để quản lý tiện ích</div>
        </div>
      </div>
    );
  }

  return (
    <div className="psv-root">
      <PageHeader
        title="Dịch vụ & tiện ích"
        subtitle="Cấu hình tiện ích hiển thị với khách hàng cho từng khách sạn và loại phòng"
        action={navState?.returnToRooms ? (
          <button
            className="psv-back-btn"
            onClick={() => navigate("/partner/rooms", {
              state: { returnedFromServices: true },
            })}
          >
            ← Trở về chỉnh sửa phòng
          </button>
        ) : null}
      />

      <HotelChips hotels={hotels} selectedId={selectedHotelId} onSelect={selectHotel} />

      {selectedHotelId && (
        <>
          <div className="psv-tabs">
            <button
              className={`psv-tab${activeTab === "hotel" ? " active" : ""}`}
              onClick={() => setActiveTab("hotel")}
            >
              <Building2 size={15} /> Tiện ích khách sạn
              {hotelAmenities.size > 0 && (
                <span className="psv-tab-count">{hotelAmenities.size + hotelCustom.length}</span>
              )}
            </button>
            <button
              className={`psv-tab${activeTab === "room" ? " active" : ""}`}
              onClick={() => setActiveTab("room")}
            >
              <BedDouble size={15} /> Tiện ích phòng
              {selectedRoom && (roomAmenities.size + roomCustom.length) > 0 && (
                <span className="psv-tab-count">{roomAmenities.size + roomCustom.length}</span>
              )}
            </button>
          </div>

          {activeTab === "hotel" && (
            <div className="psv-panel">
              <div className="psv-panel-header">
                <div className="psv-panel-title">
                  Tiện ích của <strong>{selectedHotel?.name}</strong>
                </div>
                <div className="psv-panel-count">
                  {hotelAmenities.size + hotelCustom.length} mục đã chọn
                </div>
              </div>

              {HOTEL_AMENITY_CATEGORIES.map(cat => (
                <AmenityGroup
                  key={cat.label}
                  category={cat}
                  selected={hotelAmenities}
                  onToggle={toggleHotelAmenity}
                />
              ))}

              <CustomAmenities
                values={hotelCustom}
                onRemove={i => setHotelCustom(p => p.filter((_, j) => j !== i))}
                input={hotelCustomInput}
                onInputChange={setHotelCustomInput}
                onAdd={() => {
                  if (hotelCustomInput.trim()) {
                    setHotelCustom(p => [...p, hotelCustomInput.trim()]);
                    setHotelCustomInput("");
                  }
                }}
              />

              <div className="psv-save-row">
                <button
                  className="psv-save-btn"
                  onClick={handleSaveHotelAmenities}
                  disabled={saving}
                >
                  <Save size={16} />
                  {saving ? "Đang lưu..." : "Lưu tiện ích khách sạn"}
                </button>
              </div>
            </div>
          )}

          {activeTab === "room" && rooms.length > 0 && (
            <RoomChips
              rooms={rooms}
              selectedId={selectedRoomId}
              onSelect={setSelectedRoomId}
            />
          )}

          {activeTab === "room" && (
            <div className="psv-panel">
              {rooms.length === 0 ? (
                <div className="psv-empty psv-empty--inline">
                  <BedDouble size={36} color="#cbd5e1" />
                  <div className="psv-empty-title" style={{ fontSize: 16 }}>Chưa có phòng nào</div>
                  <div className="psv-empty-desc">
                    <button className="psv-link-btn" onClick={() => navigate("/partner/rooms")}>
                      Thêm phòng ngay →
                    </button>
                  </div>
                </div>
              ) : !selectedRoom ? (
                <div className="psv-empty psv-empty--inline">
                  <BedDouble size={36} color="#cbd5e1" />
                  <div className="psv-empty-title" style={{ fontSize: 16 }}>Chọn một loại phòng</div>
                  <div className="psv-empty-desc">Chọn phòng phía trên để xem và chỉnh sửa tiện ích</div>
                </div>
              ) : (
                <>
                  <div className="psv-panel-header">
                    <div className="psv-panel-title">
                      Tiện ích · <strong>{selectedRoom.name}</strong>
                    </div>
                    <div className="psv-panel-count">
                      {roomAmenities.size + roomCustom.length} mục đã chọn
                    </div>
                  </div>

                  {ROOM_AMENITY_CATEGORIES.map(cat => (
                    <AmenityGroup
                      key={cat.label}
                      category={cat}
                      selected={roomAmenities}
                      onToggle={toggleRoomAmenity}
                    />
                  ))}

                  <CustomAmenities
                    values={roomCustom}
                    onRemove={i => setRoomCustom(p => p.filter((_, j) => j !== i))}
                    input={roomCustomInput}
                    onInputChange={setRoomCustomInput}
                    onAdd={() => {
                      if (roomCustomInput.trim()) {
                        setRoomCustom(p => [...p, roomCustomInput.trim()]);
                        setRoomCustomInput("");
                      }
                    }}
                  />

                  <div className="psv-save-row">
                    <button
                      className="psv-save-btn"
                      onClick={handleSaveRoomAmenities}
                      disabled={saving}
                    >
                      <Save size={16} />
                      {saving ? "Đang lưu..." : "Lưu tiện ích phòng"}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
