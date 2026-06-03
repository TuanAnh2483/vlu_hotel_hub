import { useState } from "react";
import AdminLayout, {
  AP, PageHeader, Card, Badge, Btn, SearchInput,
  Table, Modal, FormField, Input, Select,
} from "../../components/admin/AdminLayout";
import { useAdminHotels, useUpdateAdminHotel, useDeleteAdminHotel, useAdminHotelRooms } from "../../hooks/useAdminQueries";
import { useLang } from "../../contexts/LanguageContext";
import { HOTEL_AMENITIES_FLAT, ROOM_AMENITIES_FLAT } from "../../utils/amenityConfig";
import { Building2, CheckCircle2, Star } from "lucide-react";

const HOTEL_AMENITY_LABEL = Object.fromEntries(HOTEL_AMENITIES_FLAT.map(a => [a.key, a.label]));
const ROOM_AMENITY_LABEL  = Object.fromEntries(ROOM_AMENITIES_FLAT.map(a => [a.key, a.label]));

const HOTEL_TYPES = ["HOTEL", "RESORT", "VILLA", "APARTMENT", "HOMESTAY", "HOSTEL", "GUEST_HOUSE"];
const EMPTY_FORM = { name: "", province: "", district: "", address: "", hotelType: "HOTEL", description: "" };

export default function AdminHotels({ navigate, user, onLogout }) {
  const { t } = useLang();
  const HOTEL_TYPE_LABEL = {
    HOTEL: t("pt_type_hotel"), RESORT: t("pt_type_resort"), VILLA: t("pt_type_villa"),
    APARTMENT: t("pt_type_apartment"), HOMESTAY: t("pt_type_homestay"), HOSTEL: t("pt_type_hostel"), GUEST_HOUSE: t("pt_type_guesthouse"),
  };
  const [search, setSearch]   = useState("");
  const [modal, setModal]     = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm]       = useState(EMPTY_FORM);
  const [error, setError]     = useState("");
  const [filterType, setFilterType] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const { data: hotels = [], isLoading: loading } = useAdminHotels();
  const { data: selectedRooms = [], isLoading: roomsLoading } = useAdminHotelRooms((modal === "edit" || modal === "detail") ? selected?.id : null);
  const updateHotel = useUpdateAdminHotel();
  const deleteHotel = useDeleteAdminHotel();
  const acting = updateHotel.isPending || deleteHotel.isPending;

  const filtered = hotels.filter(h => {
    const q = search.toLowerCase();
    const matchQ = !q || (h.name || "").toLowerCase().includes(q) || (h.province || "").toLowerCase().includes(q);
    const matchType = !filterType || h.hotelType === filterType;
    return matchQ && matchType;
  });

  const upd = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const openDetail = h => { setSelected(h); setModal("detail"); };
  const openEdit = h => {
    setError("");
    setSelected(h);
    setForm({ name: h.name || "", province: h.province || "", district: h.district || "", address: h.address || "", hotelType: h.hotelType || "HOTEL", description: h.description || "" });
    setModal("edit");
  };
  const openDel = h => { setError(""); setSelected(h); setModal("delete"); };

  const handleSave = () => {
    if (!form.name.trim() || !form.province.trim() || !form.district.trim() || !form.address.trim() || !selected?.id) return;
    setError("");
    updateHotel.mutate({ hotelId: selected.id, ...form }, {
      onSuccess: () => setModal(null),
      onError: (e) => setError(e.message || t("adm_hotels_err_update")),
    });
  };

  const handleDelete = () => {
    setError("");
    deleteHotel.mutate(selected.id, {
      onSuccess: () => setModal(null),
      onError: (e) => setError(e.message || t("adm_hotels_err_delete")),
    });
  };

  const counts = {
    total:  hotels.length,
    active: hotels.filter(h => h.status === "ACTIVE").length,
    avg:    hotels.length ? (hotels.reduce((s, h) => s + (Number(h.ratingAvg) || 0), 0) / hotels.length).toFixed(1) : "—",
  };

  return (
    <AdminLayout page="admin-hotels" navigate={navigate} user={user} onLogout={onLogout}>
      <PageHeader
        title={t("adm_hotels_title")}
        subtitle={t("adm_hotels_subtitle")}
      />

      {error && (
        <div style={{ background: "#ffebee", color: "#c62828", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 16, fontWeight: 700 }}>
          {error}
        </div>
      )}

      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 24 }}>
        {[
          { label: t("adm_hotels_total"),      value: counts.total,  color: AP,        Icon: Building2 },
          { label: t("adm_users_active"),      value: counts.active, color: "#2e7d32", Icon: CheckCircle2 },
          { label: t("adm_hotels_avg_rating"), value: counts.avg,    color: "#f5a623", Icon: Star },
        ].map(c => (
          <div key={c.label} style={{
            background: "#fff", borderRadius: 12, padding: "16px 20px",
            boxShadow: "0 2px 10px rgba(0,0,0,0.05)", border: "1px solid #f0f0f0",
            display: "flex", alignItems: "center", gap: 14,
          }}>
            <span style={{ color: c.color }}><c.Icon size={22} aria-hidden="true" /></span>
            <div>
              <div style={{ fontSize: 24, fontWeight: 900, color: c.color }}>{c.value}</div>
              <div style={{ fontSize: 11, color: "#888", marginTop: 2, fontWeight: 600 }}>{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <SearchInput value={search} onChange={setSearch} placeholder={t("adm_hotels_search_ph")} />
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              style={{ padding: "9px 12px", borderRadius: 9, border: "1px solid #e5e5e5", fontSize: 13, background: "#f8f9fa", cursor: "pointer" }}
            >
              <option value="">{t("adm_hotels_filter_type")}</option>
              {HOTEL_TYPES.map(ht => <option key={ht} value={ht}>{HOTEL_TYPE_LABEL[ht]}</option>)}
            </select>
          </div>
          <span style={{ fontSize: 12, color: "#aaa", fontWeight: 600 }}>{t("adm_hotels_count").replace("{count}", filtered.length)}</span>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 48, color: "#bbb" }}>{t("adm_loading")}</div>
        ) : (
          <>
            <Table
              headers={[t("adm_id"), t("adm_hotels_col_name"), t("adm_hotels_col_loc"), t("adm_hotels_col_type"), t("adm_hotels_col_rating"), t("adm_status"), t("adm_actions")]}
              rows={filtered.slice((page - 1) * pageSize, page * pageSize).map(h => [
              <span style={{ color: "#bbb", fontSize: 12, fontFamily: "monospace" }}>#{h.id}</span>,
              <div>
                <div style={{ fontWeight: 700, color: "#1a1a1a" }}>{h.name}</div>
                {h.description && <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>{h.description.slice(0, 50)}{h.description.length > 50 ? "…" : ""}</div>}
                {h.customAmenities?.length > 0 && (
                  <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a", borderRadius: 6, padding: "1px 6px" }}>
                      {h.customAmenities.length} tiện ích tùy chỉnh
                    </span>
                  </div>
                )}
              </div>,
              <span style={{ fontSize: 12, color: "#666" }}>
                {[h.district, h.province].filter(Boolean).join(", ") || "—"}
              </span>,
              <span style={{
                fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 20,
                background: "#f0f4ff", color: "#4361ee",
              }}>{HOTEL_TYPE_LABEL[h.hotelType] || h.hotelType || "—"}</span>,
              <span style={{ fontWeight: 700, color: "#f5a623" }}>
                {h.ratingAvg > 0 ? `★ ${Number(h.ratingAvg).toFixed(1)}` : "—"}
                {h.ratingCount > 0 && <span style={{ color: "#aaa", fontWeight: 400, fontSize: 11 }}> ({h.ratingCount})</span>}
              </span>,
              <Badge status={h.status || "ACTIVE"} />,
              <div style={{ display: "flex", gap: 6 }}>
                <Btn small variant="ghost" onClick={() => openDetail(h)}>Chi tiết</Btn>
                <Btn small variant="action" onClick={() => openEdit(h)}>{t("adm_edit")}</Btn>
                <Btn small variant="danger" onClick={() => openDel(h)}>{t("adm_delete")}</Btn>
              </div>,
            ])}
              empty={t("adm_hotels_empty")}
            />

            {/* Pagination */}
            {filtered.length > pageSize && (
              <div style={{ display: "flex", justifyContent: "center", gap: 8, padding: "24px 0", borderTop: "1px solid #f5f5f5", marginTop: 10 }}>
                {[...Array(Math.ceil(filtered.length / pageSize))].map((_, i) => (
                  <button
                    key={i}
                    onClick={() => { setPage(i + 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                    style={{
                      width: 34, height: 34, borderRadius: 8, border: "1px solid #e0e0e0",
                      background: page === i + 1 ? AP : "#fff",
                      color: page === i + 1 ? "#fff" : "#666",
                      fontWeight: 800, fontSize: 13, cursor: "pointer", transition: "all 0.2s"
                    }}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </Card>

      {/* Edit modal */}
      {modal === "edit" && (
        <Modal title={t("adm_hotels_edit_title")} onClose={() => setModal(null)} width={520}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
            <div style={{ gridColumn: "1/-1" }}>
              <FormField label={t("adm_hotels_col_name")} required>
                <Input value={form.name} onChange={upd("name")} placeholder={t("adm_hotels_name_ph")} />
              </FormField>
            </div>
            <div style={{ paddingRight: 8 }}>
              <FormField label={t("adm_hotels_province")} required>
                <Input value={form.province} onChange={upd("province")} placeholder={t("adm_hotels_province_ph")} />
              </FormField>
            </div>
            <div style={{ paddingLeft: 8 }}>
              <FormField label={t("adm_hotels_district")} required>
                <Input value={form.district} onChange={upd("district")} placeholder={t("adm_hotels_district_ph")} />
              </FormField>
            </div>
            <div style={{ gridColumn: "1/-1" }}>
              <FormField label={t("adm_hotels_address")} required>
                <Input value={form.address} onChange={upd("address")} placeholder={t("adm_hotels_address_ph")} />
              </FormField>
            </div>
            <div style={{ gridColumn: "1/-1" }}>
              <FormField label={t("adm_hotels_type")}>
                <Select value={form.hotelType} onChange={upd("hotelType")}>
                  {HOTEL_TYPES.map(ht => <option key={ht} value={ht}>{HOTEL_TYPE_LABEL[ht]}</option>)}
                </Select>
              </FormField>
            </div>
            <div style={{ gridColumn: "1/-1" }}>
              <FormField label={t("adm_hotels_desc")}>
                <textarea
                  value={form.description}
                  onChange={upd("description")}
                  placeholder={t("adm_hotels_desc_ph")}
                  rows={3}
                  style={{
                    width: "100%", padding: "9px 12px", borderRadius: 8,
                    border: "1px solid #e0e0e0", fontSize: 13, resize: "vertical",
                    boxSizing: "border-box", fontFamily: "inherit",
                  }}
                />
              </FormField>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
            <Btn variant="ghost" onClick={() => setModal(null)}>{t("adm_cancel")}</Btn>
            <Btn disabled={acting || !form.name.trim() || !form.province.trim() || !form.district.trim() || !form.address.trim()} onClick={handleSave}>
              {acting ? t("adm_saving") : t("adm_hotels_save")}
            </Btn>
          </div>
        </Modal>
      )}

      {/* Detail modal */}
      {modal === "detail" && selected && (
        <Modal title={`Chi tiết: ${selected.name}`} onClose={() => setModal(null)} width={620}>
          {/* Basic info */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 20px", marginBottom: 18, fontSize: 13 }}>
            {[
              ["ID",         `#${selected.id}`],
              ["Chủ sở hữu", selected.ownerEmail],
              ["Loại hình",  HOTEL_TYPE_LABEL[selected.hotelType] || selected.hotelType],
              ["Trạng thái", selected.status],
              ["Đánh giá",   selected.ratingAvg > 0 ? `★ ${Number(selected.ratingAvg).toFixed(1)} (${selected.ratingCount})` : "Chưa có"],
              ["Tỉnh/Thành", selected.province],
              ["Quận/Huyện", selected.district],
              ["Địa chỉ",    selected.address],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", gap: 6 }}>
                <span style={{ color: "#999", minWidth: 90, fontWeight: 600 }}>{k}:</span>
                <span style={{ color: "#333", fontWeight: 500, wordBreak: "break-all" }}>{v || "—"}</span>
              </div>
            ))}
            {selected.description && (
              <div style={{ gridColumn: "1/-1", display: "flex", gap: 6 }}>
                <span style={{ color: "#999", minWidth: 90, fontWeight: 600 }}>Mô tả:</span>
                <span style={{ color: "#555", fontStyle: "italic" }}>{selected.description}</span>
              </div>
            )}
          </div>

          {/* Standard amenities */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#666", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Tiện ích tiêu chuẩn ({selected.amenities?.length || 0})
            </div>
            {selected.amenities?.length > 0 ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {[...selected.amenities].map(a => (
                  <span key={a} style={{
                    fontSize: 12, padding: "3px 10px", borderRadius: 20,
                    background: "#f0f4ff", color: "#4361ee", fontWeight: 600, border: "1px solid #d0daff",
                  }}>
                    {HOTEL_AMENITY_LABEL[a] || a}
                  </span>
                ))}
              </div>
            ) : (
              <span style={{ fontSize: 12, color: "#bbb" }}>Chưa có tiện ích tiêu chuẩn</span>
            )}
          </div>

          {/* Custom amenities — always visible so admin can see what partner added */}
          <div style={{ marginBottom: 16, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#92400e", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Tiện ích tùy chỉnh của partner ({selected.customAmenities?.length || 0})
            </div>
            {selected.customAmenities?.length > 0 ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {[...selected.customAmenities].map(a => (
                  <span key={a} style={{
                    fontSize: 12, padding: "3px 10px", borderRadius: 20,
                    background: "#fef3c7", color: "#92400e", fontWeight: 700, border: "1px solid #fde68a",
                  }}>
                    {a}
                  </span>
                ))}
              </div>
            ) : (
              <span style={{ fontSize: 12, color: "#b45309" }}>Partner chưa thêm tiện ích tùy chỉnh</span>
            )}
          </div>

          {/* Rooms */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#666", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Danh sách phòng ({roomsLoading ? "…" : selectedRooms.length})
            </div>
            {roomsLoading ? (
              <div style={{ color: "#bbb", fontSize: 13, padding: "10px 0" }}>Đang tải phòng…</div>
            ) : selectedRooms.length === 0 ? (
              <div style={{ color: "#bbb", fontSize: 13, padding: "10px 0" }}>Chưa có phòng nào</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {selectedRooms.map(room => (
                  <div key={room.id} style={{
                    border: "1px solid #f0f0f0", borderRadius: 10, padding: "10px 14px",
                    background: "#fafafa",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: "#1a1a1a" }}>
                        {room.name}
                        <span style={{ fontWeight: 400, fontSize: 11, color: "#999", marginLeft: 8 }}>#{room.id}</span>
                      </div>
                      <div style={{ fontSize: 12, color: "#666", display: "flex", gap: 10 }}>
                        <span>{room.price?.toLocaleString("vi-VN")} ₫/đêm</span>
                        <span>·</span>
                        <span>{room.capacity} khách</span>
                        <span>·</span>
                        <Badge status={room.status || "ACTIVE"} />
                      </div>
                    </div>
                    {room.amenities?.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: room.customAmenities?.length > 0 ? 6 : 0 }}>
                        {[...room.amenities].map(a => (
                          <span key={a} style={{
                            fontSize: 11, padding: "2px 8px", borderRadius: 20,
                            background: "#f0f4ff", color: "#4361ee", fontWeight: 600, border: "1px solid #d0daff",
                          }}>
                            {ROOM_AMENITY_LABEL[a] || a}
                          </span>
                        ))}
                      </div>
                    )}
                    {room.customAmenities?.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                        {[...room.customAmenities].map(a => (
                          <span key={a} style={{
                            fontSize: 11, padding: "2px 8px", borderRadius: 20,
                            background: "#fef3c7", color: "#92400e", fontWeight: 700, border: "1px solid #fde68a",
                          }}>
                            ✨ {a}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
            <Btn variant="ghost" onClick={() => setModal(null)}>Đóng</Btn>
          </div>
        </Modal>
      )}

      {/* Delete confirm */}
      {modal === "delete" && (
        <Modal title={t("adm_hotels_del_title")} onClose={() => setModal(null)}>
          <div style={{ textAlign: "center", padding: "12px 0 20px" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
            <p style={{ fontSize: 14, color: "#333", margin: "0 0 6px" }}>
              {t("adm_hotels_del_confirm")}
            </p>
            <p style={{ fontSize: 15, fontWeight: 800, color: AP, margin: 0 }}>"{selected?.name}"?</p>
            <p style={{ fontSize: 12, color: "#aaa", marginTop: 8 }}>{t("adm_hotels_del_warning")}</p>
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
            <Btn variant="ghost" onClick={() => setModal(null)}>{t("adm_cancel")}</Btn>
            <Btn variant="danger" disabled={acting} onClick={handleDelete}>
              {acting ? t("adm_deleting") : t("adm_hotels_del_submit")}
            </Btn>
          </div>
        </Modal>
      )}
    </AdminLayout>
  );
}
