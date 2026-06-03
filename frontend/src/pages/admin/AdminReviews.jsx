import { useState } from "react";
import AdminLayout, {
  AP, PageHeader, Card, Btn, SearchInput, Table, Modal,
} from "../../components/admin/AdminLayout";
import { useAdminReviews, useDeleteAdminReview } from "../../hooks/useAdminQueries";
import { Star, Trash2, Eye, BarChart3, TrendingUp, TrendingDown } from "lucide-react";
import { useLang } from "../../contexts/LanguageContext";

function StarRating({ rating, size = 14 }) {
  return (
    <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
      {[1, 2, 3, 4, 5].map(n => (
        <Star
          key={n}
          size={size}
          fill={n <= rating ? "#f59e0b" : "none"}
          color={n <= rating ? "#f59e0b" : "#ddd"}
        />
      ))}
      <span style={{ fontSize: 12, color: "#888", marginLeft: 4, fontWeight: 600 }}>{rating}/5</span>
    </div>
  );
}

const RATING_OPTIONS = ["", "5", "4", "3", "2", "1"];
const RATING_LABEL   = { "": "Tất cả", "5": "5 sao", "4": "4 sao", "3": "3 sao", "2": "2 sao", "1": "1 sao" };

export default function AdminReviews({ navigate, user, onLogout }) {
  const { t } = useLang();
  const [search, setSearch]         = useState("");
  const [ratingFilter, setRating]   = useState("");
  const [detailModal, setDetail]    = useState(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const { data: reviewsData, isLoading: loading, error } = useAdminReviews();
  const reviews = Array.isArray(reviewsData) ? reviewsData : [];
  const deleteReview = useDeleteAdminReview();

  const handleDelete = (id) => {
    if (!window.confirm(t("adm_rv_del_confirm"))) return;
    deleteReview.mutate(id, {
      onError: (e) => alert(e.message),
    });
  };

  const filtered = reviews.filter(r => {
    const matchSearch = !search ||
      r.hotelName?.toLowerCase().includes(search.toLowerCase()) ||
      r.userEmail?.toLowerCase().includes(search.toLowerCase());
    const matchRating = !ratingFilter || String(r.rating) === ratingFilter;
    return matchSearch && matchRating;
  });

  const counts = {
    total: reviews.length,
    avg: reviews.length
      ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
      : "—",
    fivestar: reviews.filter(r => r.rating === 5).length,
    onestar:  reviews.filter(r => r.rating === 1).length,
  };

  return (
    <AdminLayout page="admin-reviews" navigate={navigate} user={user} onLogout={onLogout}>
      <PageHeader
        title={t("adm_rv_title")}
        subtitle={t("adm_rv_subtitle")}
      />

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
        {[
          { label: t("adm_rv_total"),    value: counts.total,    Icon: Star,       color: "#f59e0b" },
          { label: t("adm_rv_avg"),      value: counts.avg,      Icon: BarChart3,  color: "#4361ee" },
          { label: t("adm_rv_five_star"),value: counts.fivestar, Icon: TrendingUp, color: "#2e7d32" },
          { label: t("adm_rv_one_star"), value: counts.onestar,  Icon: TrendingDown,color: "#c62828" },
        ].map(c => (
          <div key={c.label} style={{
            background: "#fff", borderRadius: 12, padding: "16px 20px",
            boxShadow: "0 2px 10px rgba(0,0,0,0.05)", border: "1px solid #f0f0f0",
            display: "flex", alignItems: "center", gap: 14,
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: "50%", background: `${c.color}18`,
              display: "flex", alignItems: "center", justifyContent: "center", color: c.color,
            }}>
              <c.Icon size={22} aria-hidden="true" />
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 900, color: "#1a1a1a" }}>{c.value}</div>
              <div style={{ fontSize: 11, color: "#888", marginTop: 2, fontWeight: 600 }}>{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      <Card>
        {/* Filters */}
        <div style={{ display: "flex", gap: 12, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
          <SearchInput value={search} onChange={setSearch} placeholder={t("adm_rv_search_ph")} />
          <div style={{ display: "flex", gap: 6 }}>
            {RATING_OPTIONS.map(r => (
              <button
                key={r}
                onClick={() => setRating(r)}
                style={{
                  padding: "7px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                  border: ratingFilter === r ? "none" : "1px solid #e5e5e5",
                  cursor: "pointer",
                  background: ratingFilter === r ? AP : "#f5f5f5",
                  color: ratingFilter === r ? "#fff" : "#666",
                  transition: "all 0.15s",
                  whiteSpace: "nowrap",
                }}
              >
                {RATING_LABEL[r]}
              </button>
            ))}
          </div>
          <span style={{ fontSize: 12, color: "#aaa", fontWeight: 600, marginLeft: "auto" }}>
            {t("adm_rv_count").replace("{count}", filtered.length)}
          </span>
        </div>

        {error && (
          <div style={{ background: "#ffebee", color: "#c62828", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
            ⚠️ {error.message}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: 48, color: "#bbb" }}>{t("adm_loading")}</div>
        ) : (
          <>
            <Table
              headers={[t("adm_id"), t("adm_rv_col_hotel"), t("adm_rv_col_user"), t("adm_rv_col_rating"), t("adm_rv_col_comment"), t("adm_rv_col_date"), t("adm_actions")]}
              rows={filtered.slice((page - 1) * pageSize, page * pageSize).map(r => [
              <span style={{ color: "#bbb", fontSize: 12, fontFamily: "monospace" }}>#{r.id}</span>,
              <span style={{ fontWeight: 700, color: "#1a1a1a", fontSize: 13 }}>{r.hotelName || "—"}</span>,
              <span style={{ fontSize: 12, color: "#555" }}>{r.userEmail || "—"}</span>,
              <StarRating rating={r.rating} />,
              <span style={{
                fontSize: 12, color: "#444", maxWidth: 200,
                display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {r.comment || <span style={{ color: "#ccc" }}>—</span>}
              </span>,
              <span style={{ fontSize: 12, color: "#888" }}>
                {r.createdAt ? new Date(r.createdAt).toLocaleDateString("vi-VN") : "—"}
              </span>,
              <div style={{ display: "flex", gap: 6 }}>
                <Btn small variant="action" onClick={() => setDetail(r)}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}><Eye size={13} /> {t("adm_view")}</div>
                </Btn>
                <Btn small variant="danger" disabled={deleteReview.isPending && deleteReview.variables === r.id} onClick={() => handleDelete(r.id)}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <Trash2 size={13} /> {deleteReview.isPending && deleteReview.variables === r.id ? t("adm_rv_deleting") : t("adm_rv_delete")}
                  </div>
                </Btn>
              </div>,
            ])}
              empty={t("adm_rv_empty")}
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

      {/* Detail modal */}
      {detailModal && (
        <Modal title={t("adm_rv_detail_title")} onClose={() => setDetail(null)} width={500}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {[
              ["ID",                    `#${detailModal.id}`],
              [t("adm_rv_col_hotel"),   detailModal.hotelName || "—"],
              [t("adm_rv_col_user"),    detailModal.userEmail || "—"],
              [t("adm_rv_col_date"),    detailModal.createdAt
                ? new Date(detailModal.createdAt).toLocaleString("vi-VN")
                : "—"],
            ].map(([k, v]) => (
              <div key={k} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "10px 0", borderBottom: "1px solid #f5f5f5", fontSize: 13,
              }}>
                <span style={{ color: "#888", fontWeight: 600 }}>{k}</span>
                <span style={{ fontWeight: 700, color: "#1a1a1a" }}>{v}</span>
              </div>
            ))}
            <div style={{ padding: "10px 0", borderBottom: "1px solid #f5f5f5" }}>
              <div style={{ color: "#888", fontWeight: 600, fontSize: 13, marginBottom: 6 }}>{t("adm_rv_score")}</div>
              <StarRating rating={detailModal.rating} size={18} />
            </div>
            <div style={{ padding: "12px 0" }}>
              <div style={{ color: "#888", fontWeight: 600, fontSize: 13, marginBottom: 8 }}>{t("adm_rv_comment_label")}</div>
              <div style={{
                background: "#f8f9fa", borderRadius: 10, padding: "12px 14px",
                fontSize: 13, color: detailModal.comment ? "#333" : "#999", lineHeight: 1.6,
              }}>
                {detailModal.comment || t("adm_rv_no_comment")}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
            <Btn variant="danger" disabled={deleteReview.isPending && deleteReview.variables === detailModal.id} onClick={() => { handleDelete(detailModal.id); setDetail(null); }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}><Trash2 size={14} /> {t("adm_rv_del_btn")}</div>
            </Btn>
            <Btn variant="ghost" onClick={() => setDetail(null)}>{t("adm_close")}</Btn>
          </div>
        </Modal>
      )}
    </AdminLayout>
  );
}
