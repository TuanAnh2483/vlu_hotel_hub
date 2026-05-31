import { useState } from "react";
import { Clock3, CircleDollarSign, XCircle, RefreshCcw } from "lucide-react";
import { Badge, Btn, Card, Modal, Table } from "../../admin/AdminLayout";
import { fmtCurrency, fmtDate, fmtDateTime } from "./calendarUtils";
import RefundConfirmModal from "./RefundConfirmModal";

const TONES = {
  amber: { bg: "#FFFBEB", fg: "#D97706" },
  green: { bg: "#ECFDF5", fg: "#059669" },
  red:   { bg: "#FFF1F2", fg: "#BE1E2E" },
  blue:  { bg: "#EFF6FF", fg: "#2563EB" },
};

function MetricCard({ icon: Icon, tone, label, value, sub }) {
  const t = TONES[tone];
  return (
    <div className="pck-card">
      <div className="pck-icon" style={{ background: t.bg, color: t.fg }}>
        <Icon size={20} />
      </div>
      <div className="pck-body">
        <div className="pck-label">{label}</div>
        <div className="pck-value" style={{ color: t.fg, fontSize: typeof value === "string" && value.length > 6 ? 16 : 22 }}>
          {value}
        </div>
        {sub && <div className="pck-hint">{sub}</div>}
      </div>
    </div>
  );
}

const STATUS_FILTERS = [
  { value: "",         label: "Tất cả" },
  { value: "PENDING",  label: "Chờ xử lý" },
  { value: "APPROVED", label: "Đã duyệt" },
  { value: "REJECTED", label: "Đã từ chối" },
];

export default function RefundDashboard({
  hotels, selectedHotelId, onHotelChange,
  refunds, refundsLoading,
  statusFilter, onStatusFilter,
  approveRefund, rejectRefund,
  t,
}) {
  const [detailRefund, setDetailRefund] = useState(null);
  const [confirmPending, setConfirmPending] = useState(null);

  const pendingCount   = refunds.filter(r => r.status === "PENDING").length;
  const approvedTotal  = refunds.filter(r => r.status === "APPROVED").reduce((s, r) => s + Number(r.amount || 0), 0);
  const rejectedCount  = refunds.filter(r => r.status === "REJECTED").length;

  const actingId = (approveRefund.isPending && approveRefund.variables) ||
                   (rejectRefund.isPending  && rejectRefund.variables)  || null;

  function requestAction(type, refund) {
    setConfirmPending({ type, refund });
  }

  function executeAction(transferNote) {
    if (!confirmPending) return;
    const { type, refund } = confirmPending;
    if (type === "approve") {
      approveRefund.mutate({ refundRequestId: refund.id, transferNote }, {
        onSuccess: updated => {
          setDetailRefund(cur => cur?.id === refund.id ? updated : cur);
          setConfirmPending(null);
        },
        onError: () => setConfirmPending(null),
      });
    } else {
      rejectRefund.mutate(refund.id, {
        onSuccess: updated => {
          setDetailRefund(cur => cur?.id === refund.id ? updated : cur);
          setConfirmPending(null);
        },
        onError: () => setConfirmPending(null),
      });
    }
  }

  const metrics = [
    { icon: Clock3,          tone: "amber", label: "Chờ xử lý",       value: pendingCount,              sub: "Cần phản hồi" },
    { icon: CircleDollarSign, tone: "green", label: "Tổng đã hoàn",    value: fmtCurrency(approvedTotal), sub: "Đã duyệt" },
    { icon: XCircle,         tone: "red",   label: "Đã từ chối",       value: rejectedCount,             sub: "Không đủ điều kiện" },
    { icon: RefreshCcw,      tone: "blue",  label: "Tổng yêu cầu",    value: refunds.length,            sub: "Trong kỳ lọc" },
  ];

  return (
    <>
      {/* KPI row */}
      <div className="pck-grid">
        {metrics.map(m => (
          <MetricCard key={m.label} {...m} />
        ))}
      </div>

      {/* Table card */}
      <Card style={{ borderRadius: 24 }}>
        {/* Toolbar */}
        <div className="pcrd-toolbar">
          <div className="pcrd-title">{t("pt_cal_rf_title")}</div>
          <div className="pcrd-filters">
            <div className="pct-select-wrap">
              <select
                className="pct-select"
                value={selectedHotelId}
                onChange={e => onHotelChange(e.target.value)}
                aria-label="Lọc theo khách sạn"
              >
                {!hotels.length && <option value="">Chưa có khách sạn</option>}
                {hotels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </div>
            <div className="pcrd-status-chips">
              {STATUS_FILTERS.map(f => (
                <button
                  key={f.value || "all"}
                  type="button"
                  onClick={() => onStatusFilter(f.value)}
                  className={`pcrd-chip${statusFilter === f.value ? " pcrd-chip--active" : ""}`}
                >
                  {f.label}
                  {f.value === "PENDING" && pendingCount > 0 && (
                    <span className="pcrd-chip-badge">{pendingCount}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {refundsLoading ? (
          <div className="pcrd-loading">{t("pt_cal_rf_loading")}</div>
        ) : (
          <Table
            headers={["Mã", "Booking", t("pt_cal_rf_col_hotel"), t("pt_cal_rf_col_guest"), t("pt_cal_rf_col_amount"), "Ngày yêu cầu", "Lý do", t("adm_status"), t("adm_actions")]}
            rows={refunds.map(r => [
              <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#64748b", fontSize: 12 }}>#{r.id}</span>,
              <span style={{ fontWeight: 800, color: "#BE1E2E" }}>#{r.bookingId}</span>,
              <span style={{ fontWeight: 700, color: "#0f172a" }}>{r.hotelName}</span>,
              <span style={{ color: "#475569" }}>{r.userEmail}</span>,
              <span style={{ fontWeight: 800 }}>{fmtCurrency(r.amount)}</span>,
              <span style={{ color: "#64748b", fontSize: 12 }}>{fmtDate(r.requestedAt)}</span>,
              <span className="pcrd-reason-cell" title={r.reason}>{r.reason || "—"}</span>,
              <Badge status={r.status} />,
              <div className="pcrd-actions-cell">
                <Btn small variant="ghost" onClick={() => setDetailRefund(r)}>
                  {t("adm_detail")}
                </Btn>
                {r.status === "PENDING" && (
                  <>
                    <Btn
                      small
                      variant="success"
                      loading={actingId === r.id}
                      onClick={() => requestAction("approve", r)}
                    >
                      {t("adm_approve")}
                    </Btn>
                    <Btn
                      small
                      variant="danger"
                      loading={actingId === r.id}
                      onClick={() => requestAction("reject", r)}
                    >
                      {t("adm_reject")}
                    </Btn>
                  </>
                )}
              </div>,
            ])}
            empty={t("pt_cal_rf_empty")}
          />
        )}
      </Card>

      {/* Detail modal */}
      {detailRefund && (
        <Modal
          title={`Yêu cầu hoàn tiền #${detailRefund.id}`}
          onClose={() => setDetailRefund(null)}
          width={600}
        >
          <div className="pcrd-detail-body">
            <div className="pcrd-detail-hotel">
              <div className="pcrd-detail-hotel-label">KHÁCH SẠN</div>
              <div className="pcrd-detail-hotel-name">{detailRefund.hotelName}</div>
              <div className="pcrd-detail-hotel-guest">{detailRefund.userEmail}</div>
            </div>

            <div className="pcrd-detail-grid">
              {[
                ["Booking",      `#${detailRefund.bookingId}`],
                ["Số tiền",      fmtCurrency(detailRefund.amount)],
                ["Check-in",     fmtDate(detailRefund.checkIn)],
                ["Check-out",    fmtDate(detailRefund.checkOut)],
                ["Yêu cầu lúc",  fmtDateTime(detailRefund.requestedAt)],
                ["Đã xử lý lúc", fmtDateTime(detailRefund.reviewedAt)],
              ].map(([lbl, val]) => (
                <div key={lbl} className="pcrd-detail-item">
                  <div className="pcrd-detail-item-label">{lbl}</div>
                  <div className="pcrd-detail-item-value">{val}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, color: "#64748b", fontWeight: 700 }}>Trạng thái:</span>
              <Badge status={detailRefund.status} />
            </div>

            <div className="pcrd-detail-reason-box">
              <div className="pcrd-detail-reason-lbl">LÝ DO</div>
              <div className="pcrd-detail-reason-txt">{detailRefund.reason || "—"}</div>
              {detailRefund.note && (
                <>
                  <div className="pcrd-detail-reason-lbl" style={{ marginTop: 14 }}>GHI CHÚ</div>
                  <div className="pcrd-detail-reason-txt">{detailRefund.note}</div>
                </>
              )}
              {detailRefund.transferNote && (
                <>
                  <div className="pcrd-detail-reason-lbl" style={{ marginTop: 14 }}>MÃ CHUYỂN KHOẢN</div>
                  <div className="pcrd-detail-reason-txt" style={{ fontFamily: "monospace", fontWeight: 700 }}>{detailRefund.transferNote}</div>
                </>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <Btn variant="ghost" onClick={() => setDetailRefund(null)}>{t("adm_close")}</Btn>
              {detailRefund.status === "PENDING" && (
                <>
                  <Btn
                    variant="danger"
                    loading={actingId === detailRefund.id}
                    onClick={() => requestAction("reject", detailRefund)}
                  >
                    {t("adm_reject")}
                  </Btn>
                  <Btn
                    loading={actingId === detailRefund.id}
                    onClick={() => requestAction("approve", detailRefund)}
                  >
                    {t("adm_approve")}
                  </Btn>
                </>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Confirm modal — replaces window.confirm */}
      <RefundConfirmModal
        pending={confirmPending}
        onConfirm={executeAction}
        onCancel={() => setConfirmPending(null)}
        loading={approveRefund.isPending || rejectRefund.isPending}
      />
    </>
  );
}
