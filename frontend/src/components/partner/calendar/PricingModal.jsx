import { AlertTriangle, Info, Sparkles } from "lucide-react";
import { Btn, Modal } from "../../admin/AdminLayout";
import { fmtCurrency, fmtCompact, fmtDate } from "./calendarUtils";

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

function WarningModal({ available, total, onClose }) {
  return (
    <div className="pcwarn-overlay">
      <div className="pcwarn-modal">
        <div className="pcwarn-icon">
          <AlertTriangle size={36} color="#D97706" strokeWidth={2.2} />
        </div>
        <div className="pcwarn-title">Số phòng vượt quá inventory</div>
        <div className="pcwarn-body">
          Bạn đang đặt <strong style={{ color: "#BE1E2E" }}>{available}</strong> phòng có thể đặt,
          trong khi tổng inventory là <strong>{total}</strong> phòng.
        </div>
        <div className="pcwarn-hint">
          <Info size={13} color="#D97706" style={{ flexShrink: 0 }} />
          <span>
            Nếu muốn cho phép số này, hãy kiểm tra lại tổng số phòng thực tế tại trang Quản lý phòng.
          </span>
        </div>
        <button type="button" onClick={onClose} className="pcwarn-btn">
          Đã hiểu, kiểm tra lại
        </button>
      </div>
    </div>
  );
}

export default function PricingModal({
  modal, form, onChange, onSave, onClose,
  saving, error,
  aiData, aiLoading,
  selectedRoom, calendar,
  year, month, monthNames,
  warnModal, onWarnClose,
  t,
}) {
  if (!modal) return null;

  const aiLevel  = aiData ? getAiLevel(aiData.suggestedPrice, form.price) : "MEDIUM";
  const aiScheme = AI_SCHEME[aiLevel];

  const startDisplay = fmtDate(form.startDate || modal.startDate);
  const endDisplay   = fmtDate(form.endDate   || modal.endDate);
  const dateRange    = startDisplay === endDisplay ? startDisplay : `${startDisplay} – ${endDisplay}`;

  // Estimated revenue impact (simple: price × availableRooms × days)
  const days = modal.startDate && modal.endDate
    ? Math.max(1, Math.round((new Date(modal.endDate) - new Date(modal.startDate)) / 86400000) + 1)
    : 1;
  const estRev = form.price && !form.closed
    ? Number(form.price) * (Number(form.availableRooms) || calendar?.defaultQuantity || 1) * days
    : null;

  const scopeNote =
    form.applyWeekendInMonth && modal.weekend
      ? "Áp dụng cho tất cả thứ 7 và Chủ nhật trong tháng đang xem."
      : modal.scope === "month"
        ? `Áp dụng toàn bộ ${monthNames[month]} ${year}. Các ngày chưa chỉnh sẽ dùng giá mới.`
        : modal.scope === "range"
          ? "Áp dụng liên tục từ ngày bắt đầu đến ngày kết thúc đã chọn."
          : "Ngày chưa có giá riêng sẽ dùng giá mặc định của loại phòng.";

  return (
    <>
      <Modal
        title={
          modal.scope === "day"   ? `Cập nhật ngày ${startDisplay}` :
          modal.scope === "month" ? `Cập nhật giá ${monthNames[month]} ${year}` :
          "Cập nhật theo khoảng ngày"
        }
        onClose={onClose}
        width={560}
      >
        <div className="pcpm-form">
          {/* Section 1 — Summary */}
          <div className="pcpm-summary">
            <div>
              <div className="pcpm-sum-label">Phòng</div>
              <div className="pcpm-sum-value">{selectedRoom?.name || calendar?.roomName || "—"}</div>
            </div>
            <div>
              <div className="pcpm-sum-label">Khoảng ngày</div>
              <div className="pcpm-sum-value">{dateRange}</div>
            </div>
            {calendar?.basePrice && (
              <div>
                <div className="pcpm-sum-label">Giá cơ bản</div>
                <div className="pcpm-sum-value">{fmtCurrency(calendar.basePrice)}</div>
              </div>
            )}
          </div>

          {/* Section 2 — AI suggestion */}
          {(aiLoading || aiData) && (
            <div className="pcpm-ai-wrap">
              {aiLoading ? (
                <div className="pcpm-ai-loading">
                  <Sparkles size={13} style={{ opacity: 0.4 }} />
                  Đang tải đề xuất giá AI...
                </div>
              ) : aiData && (
                <div className="pcpm-ai-card" style={{ background: aiScheme.bg, borderColor: aiScheme.border }}>
                  <div className="pcpm-ai-header">
                    <div className="pcpm-ai-badge" style={{ color: aiScheme.accent }}>
                      <Sparkles size={11} />
                      {aiData.aiGenerated ? "GEMINI AI" : "THỐNG KÊ"}
                      {aiData.count > 1 && ` · TB ${aiData.count} ngày`}
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
              )}
            </div>
          )}

          {/* Section 3 — Fields */}
          <div className="partner-calendar-rate-grid">
            {modal.scope === "range" && (
              <>
                <label className="partner-calendar-rate-field">
                  <span>{t("pt_cal_start_date")}</span>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={e => onChange(f => ({ ...f, startDate: e.target.value }))}
                  />
                </label>
                <label className="partner-calendar-rate-field">
                  <span>{t("pt_cal_end_date")}</span>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={e => onChange(f => ({ ...f, endDate: e.target.value }))}
                  />
                </label>
              </>
            )}

            <label className="partner-calendar-rate-field">
              <span>{t("pt_cal_price")}</span>
              <input
                type="number" min="0" step="10000"
                value={form.price}
                onChange={e => onChange(f => ({ ...f, price: e.target.value }))}
                placeholder={t("pt_cal_price_ph")}
              />
            </label>

            <label className="partner-calendar-rate-field">
              <span>{t("pt_cal_available")}</span>
              <input
                type="number" min="0" step="1"
                value={form.availableRooms}
                onChange={e => onChange(f => ({ ...f, availableRooms: e.target.value }))}
                placeholder={t("pt_cal_available_ph")}
              />
            </label>

            <label className="partner-calendar-rate-field">
              <span>{t("pt_cal_min_stay")}</span>
              <input
                type="number" min="1" step="1"
                value={form.minStay}
                onChange={e => onChange(f => ({ ...f, minStay: e.target.value }))}
                placeholder={t("pt_cal_min_stay_ph")}
              />
            </label>

            <label className="partner-calendar-rate-toggle">
              <input
                type="checkbox"
                checked={form.closed}
                onChange={e => onChange(f => ({ ...f, closed: e.target.checked }))}
              />
              <span>{t("pt_cal_closed")}</span>
            </label>

            {modal.weekend && (
              <label className="partner-calendar-rate-toggle partner-calendar-rate-toggle-weekend">
                <input
                  type="checkbox"
                  checked={form.applyWeekendInMonth}
                  onChange={e => onChange(f => ({ ...f, applyWeekendInMonth: e.target.checked }))}
                />
                <span>{t("pt_cal_apply_weekend")}</span>
              </label>
            )}
          </div>

          {/* Section 4 — Revenue preview */}
          {estRev !== null && (
            <div className="pcpm-rev-preview">
              <span className="pcpm-rev-label">Doanh thu ước tính:</span>
              <span className="pcpm-rev-value">{fmtCurrency(estRev)}</span>
              <span className="pcpm-rev-hint">({days} ngày × {form.availableRooms || calendar?.defaultQuantity || 1} phòng)</span>
            </div>
          )}

          {/* Note */}
          <div className="partner-calendar-rate-note">{scopeNote}</div>

          {/* Error */}
          {error && <div className="partner-calendar-error">{error}</div>}

          {/* Actions */}
          <div className="partner-calendar-rate-actions">
            <Btn variant="ghost" onClick={onClose}>{t("adm_cancel")}</Btn>
            <Btn loading={saving} onClick={() => onSave(form, modal)}>
              {saving ? t("pt_cal_saving") : t("pt_cal_save")}
            </Btn>
          </div>
        </div>
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
