import { useState } from "react";
import {
  useRoomUnits, useCreateRoomUnit, useUpdateRoomUnit, useDeleteRoomUnit,
} from "../../hooks/usePartnerQueries";
import {
  X, Plus, Pencil, Trash2, CheckCircle2, BedDouble,
  Sparkles, ChevronDown, AlertTriangle, Hash, Layers,
} from "lucide-react";
import "../../styles/pages/partner/RoomUnitsPanel.css";

// ── Cấu hình trạng thái ──────────────────────────────────────────────
const STATUS_CONFIG = {
  AVAILABLE:   { label: "Sẵn sàng",  color: "#10b981", bg: "#d1fae5", dot: "#10b981" },
  OCCUPIED:    { label: "Có khách",  color: "#3b82f6", bg: "#dbeafe", dot: "#3b82f6" },
  MAINTENANCE: { label: "Bảo trì",   color: "#ef4444", bg: "#fee2e2", dot: "#ef4444" },
  CLEANING:    { label: "Dọn phòng", color: "#f59e0b", bg: "#fef3c7", dot: "#f59e0b" },
};

const STATUS_OPTIONS = Object.entries(STATUS_CONFIG).map(([key, v]) => ({
  key, ...v,
}));

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.AVAILABLE;
  return (
    <span className="rup-status-badge" style={{ background: cfg.bg, color: cfg.color }}>
      <span className="rup-status-dot" style={{ background: cfg.dot }} />
      {cfg.label}
    </span>
  );
}

function StatusSelect({ value, onChange, disabled = false }) {
  return (
    <div className="rup-status-select-wrap">
      <select
        className="rup-status-select"
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        style={{
          color: STATUS_CONFIG[value]?.color,
          opacity: disabled ? 0.55 : 1,
          cursor: disabled ? "wait" : "pointer",
        }}
      >
        {STATUS_OPTIONS.map(s => (
          <option key={s.key} value={s.key}>{s.label}</option>
        ))}
      </select>
      <ChevronDown size={13} className="rup-status-select-icon" />
    </div>
  );
}

const EMPTY_FORM = { roomNumber: "", floor: "", status: "AVAILABLE", notes: "" };

function UnitForm({ initial = EMPTY_FORM, onSave, onCancel, saving, error, maxUnits, currentCount, isAdd }) {
  const [form, setForm] = useState({ ...EMPTY_FORM, ...initial });

  function set(key, val) { setForm(f => ({ ...f, [key]: val })); }

  function handleSubmit(e) {
    e.preventDefault();
    onSave({
      roomNumber: form.roomNumber.trim() || null,
      floor: form.floor !== "" ? Number(form.floor) : null,
      status: form.status,
      notes: form.notes.trim() || null,
    });
  }

  return (
    <form className="rup-unit-form" onSubmit={handleSubmit}>
      <div className="rup-unit-form-grid">
        <div className="rup-form-field">
          <label className="rup-form-label">
            <Hash size={12} /> Số phòng
          </label>
          <input
            className="rup-form-input"
            placeholder="VD: 301, 12A..."
            maxLength={20}
            value={form.roomNumber}
            onChange={e => set("roomNumber", e.target.value)}
          />
        </div>
        <div className="rup-form-field">
          <label className="rup-form-label">
            <Layers size={12} /> Tầng
          </label>
          <input
            className="rup-form-input"
            type="number"
            placeholder="VD: 3"
            value={form.floor}
            onChange={e => set("floor", e.target.value)}
          />
        </div>
      </div>

      <div className="rup-form-field">
        <label className="rup-form-label">Trạng thái</label>
        <StatusSelect value={form.status} onChange={v => set("status", v)} />
      </div>

      <div className="rup-form-field">
        <label className="rup-form-label">Ghi chú vận hành</label>
        <input
          className="rup-form-input"
          placeholder="VD: Sửa điều hoà, chờ bàn giao..."
          maxLength={500}
          value={form.notes}
          onChange={e => set("notes", e.target.value)}
        />
      </div>

      {isAdd && currentCount >= maxUnits && (
        <div className="rup-form-warn">
          <AlertTriangle size={13} />
          Đã đủ {maxUnits} phòng theo cấu hình. Hãy tăng số lượng loại phòng trước.
        </div>
      )}

      {error && <div className="rup-form-error">{error}</div>}

      <div className="rup-form-actions">
        <button type="button" className="rup-btn rup-btn-ghost" onClick={onCancel} disabled={saving}>
          Huỷ
        </button>
        <button
          type="submit"
          className="rup-btn rup-btn-primary"
          disabled={saving || (isAdd && currentCount >= maxUnits)}
        >
          {saving ? "Đang lưu..." : "Lưu"}
        </button>
      </div>
    </form>
  );
}

function SummaryBar({ units, quantity }) {
  const counts = { AVAILABLE: 0, OCCUPIED: 0, MAINTENANCE: 0, CLEANING: 0 };
  units.forEach(u => { if (counts[u.status] !== undefined) counts[u.status]++; });
  return (
    <div className="rup-summary-bar">
      {STATUS_OPTIONS.map(s => (
        <div key={s.key} className="rup-summary-item">
          <span className="rup-summary-dot" style={{ background: s.dot }} />
          <span className="rup-summary-count" style={{ color: s.color }}>{counts[s.key]}</span>
          <span className="rup-summary-label">{s.label}</span>
        </div>
      ))}
      <div className="rup-summary-sep" />
      <div className="rup-summary-total">
        {units.length} / {quantity} phòng đã tạo
      </div>
    </div>
  );
}

export default function RoomUnitsPanel({ room, hotelId, onClose }) {
  const { data: units = [], isLoading } = useRoomUnits(room.id);
  const createUnit = useCreateRoomUnit();
  const updateUnit = useUpdateRoomUnit();
  const deleteUnit = useDeleteRoomUnit();

  const [adding, setAdding]             = useState(false);
  const [editingId, setEditingId]       = useState(null);
  const [deleteId, setDeleteId]         = useState(null);
  const [formError, setFormError]       = useState("");
  const [saving, setSaving]             = useState(false);
  // Track which unit's status dropdown is mid-mutation (prevent race condition)
  const [changingStatusId, setChangingStatusId] = useState(null);

  async function handleCreate(data) {
    setSaving(true); setFormError("");
    try {
      await createUnit.mutateAsync({ roomId: room.id, hotelId, ...data });
      setAdding(false);
    } catch (e) { setFormError(e.message || "Lỗi khi tạo phòng"); }
    finally { setSaving(false); }
  }

  async function handleUpdate(unitId, data) {
    setSaving(true); setFormError("");
    try {
      await updateUnit.mutateAsync({ roomId: room.id, hotelId, unitId, ...data });
      setEditingId(null);
    } catch (e) { setFormError(e.message || "Lỗi khi cập nhật phòng"); }
    finally { setSaving(false); }
  }

  async function handleDelete(unitId) {
    setSaving(true);
    try {
      await deleteUnit.mutateAsync({ roomId: room.id, hotelId, unitId });
      setDeleteId(null);
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  }

  // Đổi trạng thái inline từ dropdown — lock row trong khi đang gửi
  async function handleStatusChange(unit, newStatus) {
    if (changingStatusId === unit.id) return; // bỏ qua nếu đang pending
    setChangingStatusId(unit.id);
    try {
      await updateUnit.mutateAsync({
        roomId: room.id, hotelId, unitId: unit.id,
        roomNumber: unit.roomNumber, floor: unit.floor,
        status: newStatus, notes: unit.notes,
      });
    } catch (e) { alert(e.message); }
    finally { setChangingStatusId(null); }
  }

  return (
    <div className="rup-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="rup-panel">
        {/* Header */}
        <div className="rup-header">
          <div className="rup-header-left">
            <BedDouble size={18} color="#BE1E2E" />
            <div>
              <div className="rup-header-title">{room.name}</div>
              <div className="rup-header-sub">Quản lý phòng cụ thể</div>
            </div>
          </div>
          <div className="rup-header-actions">
            {!adding && units.length < room.quantity && (
              <button className="rup-btn-add" onClick={() => { setAdding(true); setEditingId(null); setFormError(""); }}>
                <Plus size={14} /> Thêm phòng
              </button>
            )}
            <button className="rup-close-btn" onClick={onClose} title="Đóng">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Summary bar */}
        {units.length > 0 && <SummaryBar units={units} quantity={room.quantity} />}

        {/* Add form */}
        {adding && (
          <div className="rup-form-wrap">
            <div className="rup-form-title"><Sparkles size={13} /> Thêm phòng mới</div>
            <UnitForm
              onSave={handleCreate}
              onCancel={() => { setAdding(false); setFormError(""); }}
              saving={saving}
              error={formError}
              maxUnits={room.quantity}
              currentCount={units.length}
              isAdd
            />
          </div>
        )}

        {/* Content */}
        <div className="rup-body">
          {isLoading ? (
            <div className="rup-loading">
              <div className="rup-spinner" />
              Đang tải danh sách phòng...
            </div>
          ) : units.length === 0 && !adding ? (
            <div className="rup-empty">
              <BedDouble size={36} color="#cbd5e1" />
              <div className="rup-empty-title">Chưa có phòng cụ thể nào</div>
              <div className="rup-empty-desc">
                Nhấn <strong>Thêm phòng</strong> để tạo từng phòng (VD: 301, 302...)
                trong loại phòng <em>{room.name}</em>.
              </div>
              <div className="rup-empty-hint">
                Tối đa <strong>{room.quantity}</strong> phòng theo cấu hình loại phòng.
              </div>
              <button className="rup-btn rup-btn-primary" onClick={() => setAdding(true)}>
                <Plus size={14} /> Thêm phòng đầu tiên
              </button>
            </div>
          ) : (
            <div className="rup-table-wrap">
              <table className="rup-table">
                <thead>
                  <tr>
                    <th>Tầng</th>
                    <th>Số phòng</th>
                    <th>Trạng thái</th>
                    <th>Ghi chú</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {units.map(unit => (
                    editingId === unit.id ? (
                      <tr key={unit.id} className="rup-row-editing">
                        <td colSpan={5}>
                          <div className="rup-form-wrap rup-form-wrap--inline">
                            <div className="rup-form-title"><Pencil size={12} /> Chỉnh sửa phòng {unit.roomNumber || `#${unit.id}`}</div>
                            <UnitForm
                              initial={{
                                roomNumber: unit.roomNumber || "",
                                floor: unit.floor ?? "",
                                status: unit.status,
                                notes: unit.notes || "",
                              }}
                              onSave={(data) => handleUpdate(unit.id, data)}
                              onCancel={() => { setEditingId(null); setFormError(""); }}
                              saving={saving}
                              error={editingId === unit.id ? formError : ""}
                              maxUnits={room.quantity}
                              currentCount={units.length}
                              isAdd={false}
                            />
                          </div>
                        </td>
                      </tr>
                    ) : deleteId === unit.id ? (
                      <tr key={unit.id} className="rup-row-deleting">
                        <td colSpan={5}>
                          <div className="rup-delete-confirm">
                            <AlertTriangle size={15} color="#ef4444" />
                            <span>
                              Xóa phòng <strong>{unit.roomNumber || `#${unit.id}`}</strong>? Không thể hoàn tác.
                            </span>
                            <button className="rup-btn rup-btn-ghost" onClick={() => setDeleteId(null)} disabled={saving}>Huỷ</button>
                            <button className="rup-btn rup-btn-danger" onClick={() => handleDelete(unit.id)} disabled={saving}>
                              {saving ? "Đang xóa..." : "Xóa"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr key={unit.id} className="rup-row">
                        <td className="rup-cell-floor">
                          {unit.floor != null ? `Tầng ${unit.floor}` : <span className="rup-empty-val">—</span>}
                        </td>
                        <td className="rup-cell-number">
                          {unit.roomNumber
                            ? <strong>{unit.roomNumber}</strong>
                            : <span className="rup-empty-val">Chưa đặt số</span>
                          }
                        </td>
                        <td>
                          <StatusSelect
                            value={unit.status}
                            onChange={v => handleStatusChange(unit, v)}
                            disabled={changingStatusId === unit.id}
                          />
                        </td>
                        <td className="rup-cell-notes">
                          {unit.notes || <span className="rup-empty-val">—</span>}
                        </td>
                        <td className="rup-cell-actions">
                          <button
                            className="rup-action-btn"
                            title="Chỉnh sửa"
                            onClick={() => { setEditingId(unit.id); setAdding(false); setFormError(""); }}
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            className="rup-action-btn rup-action-btn--delete"
                            title="Xóa phòng"
                            onClick={() => setDeleteId(unit.id)}
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    )
                  ))}
                </tbody>
              </table>

              {units.length < room.quantity && !adding && (
                <button
                  className="rup-add-row-btn"
                  onClick={() => { setAdding(true); setEditingId(null); setFormError(""); }}
                >
                  <Plus size={14} /> Thêm phòng ({units.length}/{room.quantity})
                </button>
              )}
              {units.length === room.quantity && (
                <div className="rup-full-notice">
                  <CheckCircle2 size={14} color="#10b981" />
                  Đã tạo đủ {room.quantity} phòng theo cấu hình. Tăng số lượng loại phòng để thêm.
                </div>
              )}
              {units.length > room.quantity && (
                <div className="rup-over-notice">
                  <AlertTriangle size={14} color="#d97706" />
                  Có {units.length} phòng nhưng loại phòng chỉ cấu hình {room.quantity}.
                  Hãy xóa bớt hoặc tăng số lượng trong cài đặt loại phòng.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
