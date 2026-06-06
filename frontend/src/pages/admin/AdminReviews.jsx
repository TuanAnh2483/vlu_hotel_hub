import { useState } from "react";
import AdminLayout, {
  AP, PageHeader, Card, Btn, SearchInput, Table, Modal,
} from "../../components/admin/AdminLayout";
import { useQueryClient } from "@tanstack/react-query";
import { useAdminReviews, useDeleteAdminReview, useAdminHotels, adminKeys } from "../../hooks/useAdminQueries";
import { Star, Trash2, Eye, BarChart3, TrendingUp, TrendingDown, Building2, ChevronDown } from "lucide-react";
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

  const [noReviewOpen, setNoReviewOpen] = useState(false);

  const { data: reviewsData, isLoading: loading, error } = useAdminReviews();
  const reviews = Array.isArray(reviewsData) ? reviewsData : [];
  const deleteReview = useDeleteAdminReview();

  const queryClient = useQueryClient();
  const [hotelsEnabled, setHotelsEnabled] = useState(
    () => !!queryClient.getQueryData(adminKeys.hotels())
  );
  const { data: hotelsRaw } = useAdminHotels({ enabled: hotelsEnabled });
  const hotelsNoReview = hotelsRaw
    ? hotelsRaw.filter(h => !h.ratingCount || h.ratingCount === 0)
    : null;

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

      {/* Summary cards — 5 cards */}
      <div className="admin-summary-grid admin-summary-grid-5" style={{ marginBottom: noReviewOpen ? 0 : 20 }}>
        {[
          { label: t("adm_rv_total"),    value: counts.total,          Icon: Star,        color: "#f59e0b", clickable: false },
          { label: t("adm_rv_avg"),      value: counts.avg,            Icon: BarChart3,   color: "#4361ee", clickable: false },
          { label: t("adm_rv_five_star"),value: counts.fivestar,       Icon: TrendingUp,  color: "#2e7d32", clickable: false },
          { label: t("adm_rv_one_star"), value: counts.onestar,        Icon: TrendingDown,color: "#c62828", clickable: false },
          { label: "Chưa đánh giá",      value: hotelsNoReview === null ? "—" : hotelsNoReview.length, Icon: Building2,   color: "#6b7280", clickable: true  },
        ].map(c => (
          <div
            key={c.label}
            onClick={c.clickable ? () => { if (!hotelsEnabled) setHotelsEnabled(true); setNoReviewOpen(o => !o); } : undefined}
            role={c.clickable ? "button" : undefined}
            tabIndex={c.clickable ? 0 : undefined}
            aria-expanded={c.clickable ? noReviewOpen : undefined}
            onKeyDown={c.clickable ? (e) => { if (e.key === "Enter" || e.key === " ") { if (!hotelsEnabled) setHotelsEnabled(true); setNoReviewOpen(o => !o); } } : undefined}
            style={{
              background: "#fff", borderRadius: 12, padding: "14px 16px",
              boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
              border: c.clickable && noReviewOpen
                ? "1.5px solid #d1d5db"
                : "1px solid #f0f0f0",
              display: "flex", alignItems: "center", gap: 12,
              cursor: c.clickable ? "pointer" : "default",
              transition: "border-color 0.15s",
              borderBottomLeftRadius:  c.clickable && noReviewOpen ? 0 : 12,
              borderBottomRightRadius: c.clickable && noReviewOpen ? 0 : 12,
            }}
          >
            <div style={{
              width: 42, height: 42, borderRadius: "50%", background: `${c.color}18`, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center", color: c.color,
            }}>
              <c.Icon size={20} aria-hidden="true" />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#1a1a1a", lineHeight: 1.1 }}>{c.value}</div>
              <div style={{ fontSize: 11, color: "#888", marginTop: 3, fontWeight: 600 }}>{c.label}</div>
            </div>
            {c.clickable && (
              <ChevronDown
                size={14} color="#9ca3af" style={{ marginLeft: "auto", flexShrink: 0, transition: "transform 0.2s", transform: noReviewOpen ? "rotate(180deg)" : "rotate(0deg)" }}
              />
            )}
          </div>
        ))}
      </div>

      {/* Expandable list — anchored below 5th card */}
      {noReviewOpen && (
        <div style={{
          background: "#fff", border: "1.5px solid #d1d5db", borderTop: "none",
          borderRadius: "0 0 12px 12px", marginBottom: 20, overflow: "hidden",
          boxShadow: "0 4px 10px rgba(0,0,0,0.05)",
        }}>
          {!hotelsRaw ? (
            <div style={{ padding: "16px 20px", fontSize: 13, color: "#9ca3af", textAlign: "center" }}>
              Đang tải...
            </div>
          ) : hotelsNoReview.length === 0 ? (
            <div style={{ padding: "16px 20px", fontSize: 13, color: "#9ca3af", textAlign: "center" }}>
              Tất cả khách sạn đã có đánh giá 🎉
            </div>
          ) : (
            <div style={{ maxHeight: 260, overflowY: "auto" }}>
              {hotelsNoReview.map((h, i) => (
                <div key={h.id} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "9px 20px", fontSize: 13,
                  borderTop: i === 0 ? "none" : "1px solid #f3f4f6",
                }}>
                  <div style={{ minWidth: 0 }}>
                    <span style={{ fontWeight: 600, color: "#1a1a1a" }}>{h.name}</span>
                    {(h.province || h.district) && (
                      <span style={{ color: "#9ca3af", fontSize: 12, marginLeft: 8 }}>
                        {[h.district, h.province].filter(Boolean).join(", ")}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: 11, color: "#9ca3af", whiteSpace: "nowrap", marginLeft: 12 }}>
                    Chưa có đánh giá
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Card>
        {/* Filters */}
        <div style={{ display: "flex", gap: 12, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
          <SearchInput value={search} onChange={setSearch} placeholder={t("adm_rv_search_ph")} />
          <div className="admin-filter-bar" style={{ marginBottom: 0 }}>
            {RATING_OPTIONS.map(r => (
              <button
                key={r}
                onClick={() => setRating(r)}
                className={`admin-filter-tab${ratingFilter === r ? " active" : ""}`}
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
              headers={[t("adm_rv_col_hotel"), t("adm_rv_col_user"), t("adm_rv_col_rating"), t("adm_rv_col_comment"), t("adm_rv_col_date"), t("adm_actions")]}
              rows={filtered.slice((page - 1) * pageSize, page * pageSize).map(r => [
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
              <div className="admin-cell-actions">
                <Btn small iconOnly variant="action" title="Xem chi tiết" onClick={() => setDetail(r)}>
                  <Eye size={14} />
                </Btn>
                <Btn small iconOnly variant="danger" title={t("adm_rv_delete")}
                  disabled={deleteReview.isPending && deleteReview.variables === r.id}
                  onClick={() => handleDelete(r.id)}
                >
                  <Trash2 size={14} />
                </Btn>
              </div>,
            ])}
              empty={t("adm_rv_empty")}
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
      {detailModal && (
        <Modal title={t("adm_rv_detail_title")} onClose={() => setDetail(null)} width={500}>
          <div>
            {[
              ["Mã đánh giá",           `#${detailModal.id}`],
              [t("adm_rv_col_hotel"),   detailModal.hotelName || "—"],
              [t("adm_rv_col_user"),    detailModal.userEmail || "—"],
              [t("adm_rv_col_date"),    detailModal.createdAt
                ? new Date(detailModal.createdAt).toLocaleString("vi-VN")
                : "—"],
            ].map(([k, v]) => (
              <div key={k} className="admin-modal-row">
                <span className="admin-modal-row-key">{k}</span>
                <span className="admin-modal-row-val">{v}</span>
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
              <Trash2 size={14} /> {t("adm_rv_del_btn")}
            </Btn>
            <Btn variant="ghost" onClick={() => setDetail(null)}>{t("adm_close")}</Btn>
          </div>
        </Modal>
      )}
    </AdminLayout>
  );
}
