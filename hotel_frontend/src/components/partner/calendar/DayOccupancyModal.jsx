import { useEffect, useMemo, useState } from "react";
import {
  BedDouble, Users, CheckCircle2, CircleDollarSign,
  Sparkles, Info, AlertTriangle,
} from "lucide-react";
import { Modal, Btn } from "../../admin/AdminLayout";
import { fmtDate, fmtCurrency, fmtCompact } from "./calendarUtils";

const MAX_VISUAL_SLOTS = 30;

const UNIT_SLOT_MAP = {
  AVAILABLE:   { status: "vacant",      txt: "Trống" },
  OCCUPIED:    { status: "occupied",    txt: "Có khách" },
  RESERVED:    { status: "reserved",    txt: "Đặt trước" },
  CLEANING:    { status: "maintenance", txt: "Dọn phòng" },
  MAINTENANCE: { status: "maintenance", txt: "Bảo trì" },
};

const AI_SCHEME = {
  HIGH:   { bg: "#FFF1F2", border: "#FECDD3", accent: "#BE1E2E", dark: "#9f1239", label: "Nhu cầu cao" },
  MEDIUM: { bg: "#FFFBEB", border: "#FDE68A", accent: "#D97706", dark: "#92400E", label: "Nhu cầu vừa" },
  LOW:    { bg: "#F0FDF4", border: "#A7F3D0", accent: "#059669", dark: "#065f46", label: "Nhu cầu thấp" },
};

function getAiLevel(suggested, currentStr) {
  const cur = Number(currentStr) || 0;
  if (!suggested || cur <= 0) return "MEDIUM";
  const pct = (suggested - cur) / cur * 100;
  return pct >= 12 ? "HIGH" : pct >= -5 ? "MEDIUM" : "LOW";
}

function SlotGrid({ slots, useRealUnits }) {
  const shown  = slots.slice(0, MAX_VISUAL_SLOTS);
  const hidden = slots.length - shown.length;
  return (
    <>
      <div className="pdom-slot-grid">
        {shown.map((slot, i) => (
          <div
            key={slot.label + i}
            className={`pdom-slot pdom-slot--${slot.status}`}
            title={slot.guestName || undefined}
          >
            <div className="pdom-slot-code">{slot.label}</div>
            {slot.floor != null && <div className="pdom-slot-floor">T{slot.floor}</div>}
            <div className="pdom-slot-dot" />
            <div className="pdom-slot-txt">{slot.txt}</div>
          </div>
        ))}
        {hidden > 0 && (
          <div className="pdom-slot pdom-slot--more">+{hidden}</div>
        )}
      </div>
      <div className="pdom-legend">
        <span className="pdom-legend-item pdom-legend--occupied">Có khách</span>
        {useRealUnits && <span className="pdom-legend-item pdom-legend--reserved">Đặt trước</span>}
        <span className="pdom-legend-item pdom-legend--vacant">Còn trống</span>
        {useRealUnits && <span className="pdom-legend-item pdom-legend--maintenance">Bảo trì / Dọn</span>}
        <span className="pdom-legend-item pdom-legend--closed">Đóng bán</span>
      </div>
    </>
  );
}

function WarningModal({ available, total, onClose }) {
  return (
    <div className="pcwarn-overlay">
      <div className="pcwarn-modal">
        <div className="pcwarn-icon">
          <div><AlertTriangle size={36} color="#D97706" strokeWidth={2.2} /></div>
        </div>
        <div className="pcwarn-title">Số phòng vượt quá inventory</div>
        <div className="pcwarn-body">
          Bạn đang đặt <strong style={{ color: "#BE1E2E" }}>{available}</strong> phòng có thể đặt,
          trong khi tổng inventory là <strong>{total}</strong> phòng.
        </div>
        <div className="pcwarn-hint">
          <Info size={13} color="#D97706" style={{ flexShrink: 0 }} />
          <span>Nếu muốn cho phép số này, hãy kiểm tra lại tổng số phòng thực tế tại trang Quản lý phòng.</span>
        </div>
        <button type="button" onClick={onClose} className="pcwarn-btn">
          Đã hiểu, kiểm tra lại
        </button>
      </div>
    </div>
  );
}

export default function DayOccupancyModal({
  modal, calendar, bookings, bookingsLoading, onClose,
  form, onChange, onSave, saving, error,
  aiData, aiLoading,
  onEditTabOpen,
  roomUnits,
  warnModal, onWarnClose,
}) {
  const [activeTab, setActiveTab] = useState("info");

  // Reset to info tab whenever a different date is opened
  useEffect(() => { setActiveTab("info"); }, [modal?.iso]);

  if (!modal) return null;

  const { item, iso, weekend } = modal;
  const totalQ   = calendar?.defaultQuantity || 0;
  const booked   = item?.blockedRooms || 0;
  const sellable = item?.sellableRooms ?? Math.max(0, totalQ - booked);
  const isClosed = Boolean(item?.closed);
  const roomName = calendar?.roomName || "—";
  const price    = item?.price ?? calendar?.basePrice;

  const hasRealUnits = Array.isArray(roomUnits) && roomUnits.length > 0;

  // When physical unit data is available, derive stats from it so they match the slot diagram
  const statsTotal    = hasRealUnits ? roomUnits.length : totalQ;
  const statsOccupied = hasRealUnits ? roomUnits.filter(u => u.status === "OCCUPIED").length  : booked;
  const statsFree     = hasRealUnits ? roomUnits.filter(u => u.status === "AVAILABLE").length : sellable;
  const statsPct      = statsTotal > 0 ? Math.round(statsOccupied / statsTotal * 100) : 0;

  const slots = useMemo(() => {
    if (hasRealUnits) {
      return roomUnits.map(u => {
        const map = UNIT_SLOT_MAP[u.status] || { status: "vacant", txt: "Trống" };
        return {
          label:     u.roomNumber || `#${u.id}`,
          status:    isClosed ? "closed" : map.status,
          txt:       isClosed ? "Đóng" : map.txt,
          floor:     u.floor,
          guestName: u.guestName || null,
        };
      });
    }
    return Array.from({ length: totalQ }, (_, i) => ({
      label:  `P${String(i + 1).padStart(2, "0")}`,
      status: isClosed ? "closed" : i < booked ? "occupied" : "vacant",
      txt:    isClosed ? "Đóng" : i < booked ? "Có khách" : "Trống",
      floor:  null,
    }));
  }, [hasRealUnits, roomUnits, totalQ, booked, isClosed]);

  const activeGuests = useMemo(() => {
    const list = bookings?.items ?? bookings ?? [];
    return list.filter(b =>
      b.checkIn <= iso && b.checkOut > iso &&
      b.status !== "CANCELLED" && b.status !== "REFUNDED",
    );
  }, [bookings, iso]);

  // Edit tab helpers
  const aiLevel  = aiData ? getAiLevel(aiData.suggestedPrice, form?.price) : "MEDIUM";
  const aiScheme = AI_SCHEME[aiLevel];

  const estRev = form?.price && !form?.closed
    ? Number(form.price) * (Number(form.availableRooms) || totalQ || 1)
    : null;

  function handleTabChange(tab) {
    setActiveTab(tab);
    if (tab === "edit") onEditTabOpen?.();
  }

  const modalTitle = `${roomName} — ${fmtDate(iso)}${weekend ? " · Cuối tuần" : ""}`;

  return (
    <>
      <Modal title={modalTitle} onClose={onClose} width={600}>
        <>
          {/* ── Tab switcher ── */}
          <div className="pdom-tabs">
            <button
              type="button"
              className={`pdom-tab${activeTab === "info" ? " pdom-tab--active" : ""}`}
              onClick={() => handleTabChange("info")}
            >
              Thông tin
            </button>
            <button
              type="button"
              className={`pdom-tab${activeTab === "edit" ? " pdom-tab--active" : ""}`}
              onClick={() => handleTabChange("edit")}
            >
              Chỉnh giá
            </button>
          </div>

          {/* ══ TAB: THÔNG TIN ══════════════════════════════════════════ */}
          {activeTab === "info" && (
            <div className="pdom-body">

              {/* Stats row */}
              <div className="pdom-stats">
                <div className="pdom-stat pdom-stat--total">
                  <div className="pdom-stat-icon"><BedDouble size={16} /></div>
                  <div>
                    <div className="pdom-stat-num">{statsTotal}</div>
                    <div className="pdom-stat-lbl">Tổng số phòng</div>
                  </div>
                </div>
                <div className="pdom-stat pdom-stat--occ">
                  <div className="pdom-stat-icon"><Users size={16} /></div>
                  <div>
                    <div className="pdom-stat-num">{statsOccupied}</div>
                    <div className="pdom-stat-lbl">Đang có khách</div>
                  </div>
                </div>
                <div className="pdom-stat pdom-stat--free">
                  <div className="pdom-stat-icon"><CheckCircle2 size={16} /></div>
                  <div>
                    <div className="pdom-stat-num">{isClosed ? "—" : statsFree}</div>
                    <div className="pdom-stat-lbl">{isClosed ? "Đóng bán" : "Còn trống"}</div>
                  </div>
                </div>
                {!isClosed && statsTotal > 0 && (
                  <div className="pdom-stat pdom-stat--pct">
                    <div className="pdom-stat-icon"><CircleDollarSign size={16} /></div>
                    <div>
                      <div className="pdom-stat-num">{statsPct}%</div>
                      <div className="pdom-stat-lbl">Công suất</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Close reason (info-only) */}
              {isClosed && item?.closeReason && (
                <div className="pdom-close-reason">
                  <div className="pdom-close-reason-label">Lý do đóng bán</div>
                  <div className="pdom-close-reason-text">{item.closeReason}</div>
                </div>
              )}

              {/* Slot map */}
              {(totalQ > 0 || hasRealUnits) && (
                <div className="pdom-section">
                  <div className="pdom-section-hd">
                    <span className="pdom-section-title">Sơ đồ phòng</span>
                    <span className="pdom-section-note">
                      {hasRealUnits ? "Phòng vật lý thực tế — trạng thái hiện tại" : "Mã tự động theo vị trí"}
                    </span>
                  </div>
                  <SlotGrid slots={slots} useRealUnits={hasRealUnits} />
                </div>
              )}

              {/* Active guests */}
              <div className="pdom-section">
                <div className="pdom-section-hd">
                  <span className="pdom-section-title">Khách đang lưu trú</span>
                  <span className="pdom-section-note">Toàn khách sạn · check-in trong tháng này</span>
                </div>
                {bookingsLoading ? (
                  <div className="pdom-loading">Đang tải danh sách khách...</div>
                ) : activeGuests.length === 0 ? (
                  <div className="pdom-empty">Không có khách đang ở trong ngày này.</div>
                ) : (
                  <div className="pdom-guest-list">
                    {activeGuests.map(b => (
                      <div key={b.bookingId} className="pdom-guest-row">
                        <span className="pdom-guest-id">#{b.bookingId}</span>
                        <span className="pdom-guest-name">{b.customerName || "—"}</span>
                        <span className="pdom-guest-dates">
                          {fmtDate(b.checkIn)} → {fmtDate(b.checkOut)}
                        </span>
                        <span className={`pdom-guest-status pdom-guest-status--${(b.status || "").toLowerCase()}`}>
                          {b.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="pdom-footer">
                <div className="pdom-footer-price">
                  <span className="pdom-price-label">Giá đêm nay</span>
                  <span className="pdom-price-value">{fmtCurrency(price)}</span>
                </div>
                <div className="pdom-footer-actions">
                  <Btn variant="ghost" onClick={onClose}>Đóng</Btn>
                  <Btn onClick={() => handleTabChange("edit")}>
                    <CircleDollarSign size={14} />
                    Chỉnh giá ngày này
                  </Btn>
                </div>
              </div>
            </div>
          )}

          {/* ══ TAB: CHỈNH GIÁ ══════════════════════════════════════════ */}
          {activeTab === "edit" && (
            <div className="pdom-edit-body">

              {/* AI suggestion */}
              {(aiLoading || aiData) && (
                aiLoading ? (
                  <div className="pcpm-ai-loading">
                    <Sparkles size={13} style={{ opacity: 0.4 }} />
                    Đang tải đề xuất giá AI...
                  </div>
                ) : (
                  <div className="pcpm-ai-card" style={{ background: aiScheme.bg, borderColor: aiScheme.border }}>
                    <div className="pcpm-ai-header">
                      <div className="pcpm-ai-badge" style={{ color: aiScheme.accent }}>
                        <Sparkles size={11} />
                        {aiData.aiGenerated ? "GEMINI AI" : "THỐNG KÊ"}
                      </div>
                      <button
                        type="button"
                        className="pcpm-ai-apply"
                        style={{ background: aiScheme.accent }}
                        onClick={() => onChange(f => ({ ...f, price: String(aiData.suggestedPrice) }))}
                      >
                        Áp dụng
                      </button>
                    </div>
                    <div className="pcpm-ai-price" style={{ color: aiScheme.accent }}>
                      {fmtCurrency(aiData.suggestedPrice)}
                    </div>
                    <div className="pcpm-ai-meta">
                      <span style={{ color: aiScheme.dark }}>
                        Khoảng: {fmtCompact(aiData.priceLow)} – {fmtCompact(aiData.priceHigh)}
                      </span>
                      <span className="pcpm-ai-demand" style={{ background: aiScheme.border, color: aiScheme.accent }}>
                        {aiScheme.label}
                      </span>
                    </div>
                  </div>
                )
              )}

              {/* Price input */}
              <label className="pdom-edit-field">
                <span className="pdom-edit-label">Giá đêm (₫)</span>
                <input
                  type="number"
                  min="0"
                  step="10000"
                  value={form?.price ?? ""}
                  onChange={e => onChange(f => ({ ...f, price: e.target.value }))}
                  placeholder="Nhập giá..."
                />
              </label>

              {/* Min stay + available rooms */}
              <div className="pdom-edit-grid">
                <label className="pdom-edit-field">
                  <span className="pdom-edit-label">Min lưu trú (đêm)</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={form?.minStay ?? ""}
                    onChange={e => onChange(f => ({ ...f, minStay: e.target.value }))}
                    placeholder="Mặc định 1 đêm"
                  />
                </label>
                <label className="pdom-edit-field">
                  <span className="pdom-edit-label">Phòng nhận đặt</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form?.availableRooms ?? ""}
                    onChange={e => onChange(f => ({ ...f, availableRooms: e.target.value }))}
                    placeholder={`Tối đa ${totalQ} phòng`}
                  />
                </label>
              </div>

              {/* Open/Close status toggle */}
              <div>
                <div className="pdom-edit-label">Trạng thái bán</div>
                <div className="pdom-status-toggle">
                  <button
                    type="button"
                    className={`pdom-status-btn pdom-status-btn--open${!form?.closed ? " pdom-status-btn--active" : ""}`}
                    onClick={() => onChange(f => ({ ...f, closed: false }))}
                  >
                    Mở bán
                  </button>
                  <button
                    type="button"
                    className={`pdom-status-btn pdom-status-btn--closed${form?.closed ? " pdom-status-btn--active" : ""}`}
                    onClick={() => onChange(f => ({ ...f, closed: true }))}
                  >
                    Đóng bán
                  </button>
                </div>
              </div>

              {/* Close reason (shown only when closing) */}
              {form?.closed && (
                <label className="pdom-edit-field">
                  <span className="pdom-edit-label">Lý do đóng bán</span>
                  <textarea
                    className="pdom-textarea"
                    rows={3}
                    maxLength={255}
                    value={form?.closeReason ?? ""}
                    onChange={e => onChange(f => ({ ...f, closeReason: e.target.value }))}
                    placeholder="Ví dụ: Bảo trì phòng, sự kiện nội bộ..."
                  />
                </label>
              )}

              {/* Apply to all weekends in month */}
              {weekend && (
                <label className="pdom-weekend-check">
                  <input
                    type="checkbox"
                    checked={form?.applyWeekendInMonth ?? false}
                    onChange={e => onChange(f => ({ ...f, applyWeekendInMonth: e.target.checked }))}
                  />
                  <span>Áp dụng tất cả cuối tuần trong tháng này</span>
                </label>
              )}

              {/* Revenue preview */}
              {estRev !== null && (
                <div className="pcpm-rev-preview">
                  <span className="pcpm-rev-label">Doanh thu ước tính:</span>
                  <span className="pcpm-rev-value">{fmtCurrency(estRev)}</span>
                  <span className="pcpm-rev-hint">
                    (1 ngày × {form?.availableRooms || totalQ || 1} phòng)
                  </span>
                </div>
              )}

              {/* Error */}
              {error && <div className="partner-calendar-error">{error}</div>}

              {/* Actions */}
              <div className="pdom-edit-actions">
                <Btn variant="ghost" onClick={onClose}>Hủy</Btn>
                <Btn
                  loading={saving}
                  onClick={() => onSave(form, { scope: "day", startDate: iso, endDate: iso, weekend: Boolean(weekend) })}
                >
                  {saving ? "Đang lưu..." : "Lưu thay đổi"}
                </Btn>
              </div>
            </div>
          )}
        </>
      </Modal>

      {warnModal && (
        <WarningModal
          available={warnModal.available}
          total={warnModal.total}
          onClose={onWarnClose}
        />
      )}
    </>
  );
}
