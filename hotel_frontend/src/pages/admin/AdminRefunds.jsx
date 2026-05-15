import { useState } from "react";
import AdminLayout, { AP, PageHeader, Card, Badge, Btn, Table, Modal } from "../../components/admin/AdminLayout";
import { useAdminRefunds, useUpdateRefundStatus } from "../../hooks/useAdminQueries";
import { useLang } from "../../contexts/LanguageContext";
import { SkeletonTableRows } from "../../components/ui/Skeleton";
import "../../styles/pages/admin/AdminCommon.css";

const STATUSES = ["", "PENDING", "APPROVED", "REJECTED"];

function fmt(n) {
  if (!n && n !== 0) return "—";
  return Number(n).toLocaleString("vi-VN") + " ₫";
}

export default function AdminRefunds({ navigate, user, onLogout }) {
  const { t } = useLang();
  const STATUS_LABEL = { "": t("adm_rf_tab_all"), PENDING: t("adm_rf_tab_pending"), APPROVED: t("adm_rf_tab_approved"), REJECTED: t("adm_rf_tab_rejected") };
  const [filter, setFilter]   = useState("");
  const [detail, setDetail]   = useState(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const { data: refunds = [], isLoading: loading } = useAdminRefunds(filter || null);
  const updateRefund = useUpdateRefundStatus();
  const acting = updateRefund.isPending ? updateRefund.variables?.refundId : null;

  const handleFilter = s => { setPage(1); setFilter(s); };

  const handleAction = (id, newStatus) => {
    const actionKey = newStatus === "APPROVED" ? "adm_rf_confirm_approve" : "adm_rf_confirm_reject";
    if (!window.confirm(t("adm_rf_confirm_msg").replace("{action}", t(actionKey)))) return;
    updateRefund.mutate({ refundId: id, newStatus }, {
      onError: (e) => alert(e.message || t("adm_rf_err_update")),
    });
  };

  const pending      = refunds.filter(r => r.status === "PENDING").length;
  const approved     = refunds.filter(r => r.status === "APPROVED").length;
  const rejected     = refunds.filter(r => r.status === "REJECTED").length;
  const totalPending = refunds.filter(r => r.status === "PENDING").reduce((s, r) => s + (r.amount || 0), 0);

  return (
    <AdminLayout page="admin-refunds" navigate={navigate} user={user} onLogout={onLogout}>
      <PageHeader title={t("adm_rf_title")} subtitle={t("adm_rf_subtitle")} />

      {/* Summary */}
      <div className="admin-summary-grid admin-summary-grid-4">
        {[
          { label: t("adm_rf_pending"),       value: pending,           color: "#f57f17", icon: "⏳" },
          { label: t("adm_rf_approved"),      value: approved,          color: "#2e7d32", icon: "✅" },
          { label: t("adm_rf_rejected"),      value: rejected,          color: "#c62828", icon: "❌" },
          { label: t("adm_rf_total_pending"), value: fmt(totalPending), color: AP,        icon: "💰", isStr: true },
        ].map(c => (
          <div key={c.label} className="admin-summary-card">
            <span className="admin-summary-card-icon">{c.icon}</span>
            <div>
              <div className="admin-summary-card-value" style={{ fontSize: c.isStr ? 15 : 24, color: c.color }}>{c.value}</div>
              <div className="admin-summary-card-label">{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      <Card>
        {/* Tabs */}
        <div className="admin-filter-bar">
          {STATUSES.map(s => (
            <button
              key={s}
              onClick={() => handleFilter(s)}
              className={`admin-filter-tab${filter === s ? " active" : ""}`}
            >
              {STATUS_LABEL[s]}
              {s === "PENDING" && pending > 0 && (
                <span className="admin-filter-tab-badge">{pending}</span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody><SkeletonTableRows rows={5} cols={7} /></tbody>
          </table>
        ) : (
          <>
            <Table
              headers={[t("adm_id"), t("adm_rf_col_booking"), t("adm_rf_col_user"), t("adm_rf_col_hotel"), t("adm_rf_col_amount"), t("adm_status"), t("adm_actions")]}
              rows={refunds.slice((page - 1) * pageSize, page * pageSize).map(r => [
              <span className="admin-cell-id">#{r.id}</span>,
              <span className="admin-cell-id">#B{r.bookingId}</span>,
              <span className="admin-cell-text">{r.userEmail}</span>,
              <span className="admin-cell-name">{r.hotelName}</span>,
              <span className="admin-cell-amount">{fmt(r.amount)}</span>,
              <Badge status={r.status} />,
              <div className="admin-cell-actions">
                <Btn small variant="action" onClick={() => setDetail(r)}>{t("adm_view")}</Btn>
                {r.status === "PENDING" && (
                  <>
                    <Btn small variant="success" disabled={acting === r.id} onClick={() => handleAction(r.id, "APPROVED")}>{t("adm_rf_approve")}</Btn>
                    <Btn small variant="danger"  disabled={acting === r.id} onClick={() => handleAction(r.id, "REJECTED")}>{t("adm_rf_reject")}</Btn>
                  </>
                )}
              </div>,
            ])}
              empty={t("adm_rf_empty")}
            />

            {/* Pagination */}
            {refunds.length > pageSize && (
              <div className="admin-pagination">
                {[...Array(Math.ceil(refunds.length / pageSize))].map((_, i) => (
                  <button
                    key={i}
                    onClick={() => { setPage(i + 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                    className={`admin-page-btn${page === i + 1 ? " active" : ""}`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </Card>

      {/* Detail modal */}
      {detail && (
        <Modal title={`💰 ${t("adm_rf_detail_title")} #${detail.id}`} onClose={() => setDetail(null)}>
          <div className="admin-modal-info">
            <div className="admin-modal-info-title">{detail.hotelName}</div>
            <div className="admin-modal-info-sub">{detail.userEmail}</div>
          </div>
          {[
            [t("adm_rf_booking_id"),   `#B${detail.bookingId}`],
            [t("adm_rf_amount"),        fmt(detail.amount)],
            [t("adm_rf_booking_date"),  detail.bookingDate || "—"],
            [t("adm_rf_request_date"),  detail.requestedAt || "—"],
            [t("adm_rf_reason"),        detail.reason],
            [t("adm_status"),           <Badge status={detail.status} />],
          ].map(([k, v]) => (
            <div key={k} className="admin-modal-row">
              <span className="admin-modal-row-key">{k}</span>
              <span className="admin-modal-row-val">{v}</span>
            </div>
          ))}
          {detail.status === "PENDING" && (
            <div className="admin-modal-actions">
              <Btn variant="danger"  onClick={() => handleAction(detail.id, "REJECTED")}>❌ {t("adm_rf_reject")}</Btn>
              <Btn variant="success" onClick={() => handleAction(detail.id, "APPROVED")}>✅ {t("adm_rf_approve")}</Btn>
            </div>
          )}
          {detail.status !== "PENDING" && (
            <div className="admin-modal-actions-right">
              <Btn variant="ghost" onClick={() => setDetail(null)}>{t("adm_close")}</Btn>
            </div>
          )}
        </Modal>
      )}
    </AdminLayout>
  );
}
