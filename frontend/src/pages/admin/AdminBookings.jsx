import { useState } from "react";
import AdminLayout, { AP, PageHeader, Card, Badge, Btn, Table, Modal } from "../../components/admin/AdminLayout";
import { useAdminBookings } from "../../hooks/useAdminQueries";
import { useLang } from "../../contexts/LanguageContext";
import { SkeletonTableRows } from "../../components/ui/Skeleton";
import "../../styles/pages/admin/AdminCommon.css";

const STATUSES = ["", "CONFIRMED", "PENDING_PAYMENT", "CANCELLED", "COMPLETED"];

function fmt(n) {
  if (!n && n !== 0) return "—";
  return Number(n).toLocaleString("vi-VN") + " ₫";
}

export default function AdminBookings({ navigate, user, onLogout }) {
  const { t } = useLang();
  const STATUS_LABEL = {
    "":              t("adm_bk_tab_all"),
    CONFIRMED:       t("adm_bk_tab_confirmed"),
    PENDING_PAYMENT: t("adm_bk_tab_pending"),
    CANCELLED:       t("adm_bk_tab_cancelled"),
    COMPLETED:       t("adm_bk_tab_completed"),
  };
  const [filter, setFilter]     = useState("");
  const [detail, setDetail]     = useState(null);
  const [search, setSearch]     = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const { data: bookings = [], isLoading: loading } = useAdminBookings(filter || null);
  const handleFilter = s => { setPage(1); setFilter(s); };

  const filtered = bookings.filter(b => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (b.userEmail || "").toLowerCase().includes(q) || (b.hotelName || "").toLowerCase().includes(q);
  });

  const counts = {
    total:          bookings.length,
    confirmed:      bookings.filter(b => b.status === "CONFIRMED").length,
    pending:        bookings.filter(b => b.status === "PENDING_PAYMENT").length,
    cancelled:      bookings.filter(b => b.status === "CANCELLED").length,
    revenue:        bookings.filter(b => b.status === "CONFIRMED" || b.status === "COMPLETED")
                            .reduce((s, b) => s + (Number(b.totalPrice) || 0), 0),
  };

  return (
    <AdminLayout page="admin-bookings" navigate={navigate} user={user} onLogout={onLogout}>
      <PageHeader title={t("adm_bk_title")} subtitle={t("adm_bk_subtitle")} />

      {/* Summary */}
      <div className="admin-summary-grid admin-summary-grid-5">
        {[
          { label: t("adm_bk_total"),     value: counts.total,        color: "#4361ee", icon: "📋" },
          { label: t("adm_bk_confirmed"), value: counts.confirmed,    color: "#2e7d32", icon: "✅" },
          { label: t("adm_bk_pending"),   value: counts.pending,      color: "#f57f17", icon: "⏳" },
          { label: t("adm_bk_cancelled"), value: counts.cancelled,    color: "#888",    icon: "❌" },
          { label: t("adm_bk_revenue"),   value: fmt(counts.revenue), color: AP,        icon: "💰", isStr: true },
        ].map(c => (
          <div key={c.label} className="admin-summary-card">
            <span className="admin-summary-card-icon">{c.icon}</span>
            <div>
              <div className="admin-summary-card-value" style={{ fontSize: c.isStr ? 14 : 22, color: c.color }}>{c.value}</div>
              <div className="admin-summary-card-label">{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      <Card>
        <div className="admin-table-toolbar">
          <div className="admin-table-toolbar-left">
            {STATUSES.map(s => (
              <button
                key={s}
                onClick={() => handleFilter(s)}
                className={`admin-filter-tab${filter === s ? " active" : ""}`}
                style={{ padding: "6px 14px" }}
              >
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={`🔍 ${t("adm_bk_search_ph")}`}
            className="admin-table-search"
          />
        </div>

        {loading ? (
          <div className="ui-table-wrap"><table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody><SkeletonTableRows rows={6} cols={9} /></tbody>
          </table></div>
        ) : (
          <>
            <Table
              headers={[t("adm_id"), t("adm_bk_col_user"), t("adm_bk_col_hotel"), t("adm_bk_col_checkin"), t("adm_bk_col_checkout"), t("adm_bk_col_nights"), t("adm_bk_col_total"), t("adm_status"), ""]}
              rows={filtered.slice((page - 1) * pageSize, page * pageSize).map(b => [
              <span className="admin-cell-id">#{b.id}</span>,
              <span className="admin-cell-text">{b.userEmail}</span>,
              <span className="admin-cell-name">{b.hotelName || "—"}</span>,
              <span className="admin-cell-text">{b.checkIn}</span>,
              <span className="admin-cell-text">{b.checkOut}</span>,
              <span className="admin-cell-text">{t("adm_bk_nights").replace("{n}", b.nights)}</span>,
              <span className="admin-cell-amount">{fmt(b.totalPrice)}</span>,
              <Badge status={b.status} />,
              <Btn small variant="action" onClick={() => setDetail(b)}>{t("adm_detail")}</Btn>,
            ])}
              empty={t("adm_bk_empty")}
            />

            {/* Pagination */}
            {filtered.length > pageSize && (
              <div className="admin-pagination">
                {[...Array(Math.ceil(filtered.length / pageSize))].map((_, i) => (
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
        <Modal title={`📋 ${t("adm_bk_detail_title")} #${detail.id}`} onClose={() => setDetail(null)}>
          <div className="admin-modal-info">
            <div className="admin-modal-info-title">{detail.hotelName || "—"}</div>
            <div className="admin-modal-info-sub">{detail.userEmail}</div>
          </div>
          {[
            [t("adm_bk_checkin"),    detail.checkIn],
            [t("adm_bk_checkout"),   detail.checkOut],
            [t("adm_bk_night_count"), t("adm_bk_nights").replace("{n}", detail.nights)],
            [t("adm_bk_price"),      fmt(detail.totalPrice)],
            [t("adm_bk_booked_at"),  detail.createdAt],
            [t("adm_status"),        <Badge status={detail.status} />],
          ].map(([k, v]) => (
            <div key={k} className="admin-modal-row">
              <span className="admin-modal-row-key">{k}</span>
              <span className="admin-modal-row-val">{v}</span>
            </div>
          ))}
          <div className="admin-modal-actions-right">
            <Btn variant="ghost" onClick={() => setDetail(null)}>{t("adm_close")}</Btn>
          </div>
        </Modal>
      )}
    </AdminLayout>
  );
}
