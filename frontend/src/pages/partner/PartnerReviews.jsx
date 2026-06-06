import { useMemo, useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { AlertCircle, MessageSquareReply, Star } from "lucide-react";
import { useMyHotels, usePartnerReviews, useReplyReview } from "../../hooks/usePartnerQueries";
import { PageHeader, Card, Btn, Modal, Table } from "../../components/admin/AdminLayout";
import { useLang } from "../../contexts/LanguageContext";
import "../../styles/pages/admin/AdminCommon.css";

const REPLY_TABS = [
  { label: "pt_rv_reply_all", value: "" },
  { label: "pt_rv_reply_no",  value: "false" },
  { label: "pt_rv_reply_yes", value: "true" },
];

const RATING_OPTIONS = ["", "5", "4", "3", "2", "1"];

function fmtDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("vi-VN");
}

function Stars({ value }) {
  return (
    <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={15}
          fill={star <= Number(value || 0) ? "#f59e0b" : "transparent"}
          color={star <= Number(value || 0) ? "#f59e0b" : "#cbd5e1"}
        />
      ))}
      <span style={{ color: "#64748b", fontSize: 12, fontWeight: 700, marginLeft: 4 }}>{value}/5</span>
    </div>
  );
}

/* Inline reply-status badge */
function ReplyBadge({ needsReply, t }) {
  return (
    <span style={{
      color:      needsReply ? "#ef4444" : "#10b981",
      fontSize:   12,
      fontWeight: 800,
      padding:    "4px 10px",
      borderRadius: 8,
      background: needsReply ? "#fef2f2" : "#ecfdf5",
      border:     `1px solid ${needsReply ? "#fecaca" : "#bbf7d0"}`,
      whiteSpace: "nowrap",
    }}>
      {needsReply ? t("pt_rv_not_replied") : t("pt_rv_replied")}
    </span>
  );
}

export default function PartnerReviews() {
  const { t } = useLang();
  const { selectedHotelId: ctxHotelId, setSelectedHotelId: setCtxHotelId } = useOutletContext() || {};
  const [filters, setFilters] = useState({ hotelId: ctxHotelId ? String(ctxHotelId) : "", rating: "", hasReply: "" });
  const [error,          setError]          = useState("");
  const [selectedReview, setSelectedReview] = useState(null);
  const [reply,          setReply]          = useState("");

  useEffect(() => {
    setFilters(f => ({ ...f, hotelId: ctxHotelId ? String(ctxHotelId) : "" }));
  }, [ctxHotelId]);

  const { data: hotels = [] } = useMyHotels();
  const { data: reviewsData, isLoading: loading, error: loadError } = usePartnerReviews({
    hotelId:  filters.hotelId  || undefined,
    rating:   filters.rating   || undefined,
    hasReply: filters.hasReply === "" ? undefined : filters.hasReply,
  });
  const reviews = Array.isArray(reviewsData) ? reviewsData : [];
  const replyReview = useReplyReview();
  const saving = replyReview.isPending;

  const hotelsById = useMemo(() => new Map(hotels.map((hotel) => [Number(hotel.id), hotel])), [hotels]);

  function openReplyModal(review) {
    setSelectedReview(review);
    setReply(review.partnerReply || "");
    setError("");
  }

  function handleSaveReply() {
    if (!selectedReview || !reply.trim()) return;
    setError("");
    replyReview.mutate(
      { reviewId: selectedReview.reviewId, reply: reply.trim() },
      {
        onSuccess: () => { setSelectedReview(null); setReply(""); },
        onError:   (e) => setError(e.message || "Không thể lưu phản hồi."),
      },
    );
  }

  /* Counts for tab badges */
  const unrepliedCount = reviews.filter(r => !r.partnerReply).length;
  const repliedCount   = reviews.filter(r => r.partnerReply).length;

  return (
    <div style={{ paddingBottom: 60 }}>
      <PageHeader title={t("pt_rv_title")} subtitle={t("pt_rv_subtitle")} />

      {/* Reply Status Tabs */}
      <div className="admin-filter-bar">
        {REPLY_TABS.map(tab => {
          const count = tab.value === "false" ? unrepliedCount : tab.value === "true" ? repliedCount : reviews.length;
          return (
            <button
              key={tab.value}
              className={`admin-filter-tab${filters.hasReply === tab.value ? " active" : ""}`}
              onClick={() => setFilters(c => ({ ...c, hasReply: tab.value }))}
            >
              {t(tab.label)}
              {tab.value === "false" && count > 0 && (
                <span className="admin-filter-tab-badge" style={{ color: filters.hasReply === "false" ? "#fff" : undefined, background: filters.hasReply === "false" ? "rgba(255,255,255,0.25)" : undefined }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Filter Card */}
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr auto", gap: 12, alignItems: "end" }}>
          <div>
            <div style={{ color: "#64748b", fontSize: 12, fontWeight: 800, marginBottom: 6 }}>{t("pt_rv_hotel_label")}</div>
            <select
              className="admin-table-search"
              style={{ width: "100%", padding: "10px 12px", fontSize: 13 }}
              value={filters.hotelId}
              onChange={(event) => {
                const val = event.target.value;
                setFilters((current) => ({ ...current, hotelId: val }));
                setCtxHotelId?.(val ? Number(val) : null);
              }}
            >
              <option value="">{t("pt_rv_all_hotels")}</option>
              {hotels.map((hotel) => (
                <option key={hotel.id} value={hotel.id}>{hotel.name}</option>
              ))}
            </select>
          </div>
          <div>
            <div style={{ color: "#64748b", fontSize: 12, fontWeight: 800, marginBottom: 6 }}>{t("pt_rv_score_label")}</div>
            <select
              className="admin-table-search"
              style={{ width: "100%", padding: "10px 12px", fontSize: 13 }}
              value={filters.rating}
              onChange={(event) => setFilters((current) => ({ ...current, rating: event.target.value }))}
            >
              {RATING_OPTIONS.map((rating) => (
                <option key={rating || "all"} value={rating}>
                  {rating ? t("pt_rv_score_x").replace("{n}", rating) : t("pt_rv_all_scores")}
                </option>
              ))}
            </select>
          </div>
          <Btn variant="ghost" onClick={() => setFilters({ hotelId: "", rating: "", hasReply: "" })}>
            {t("pt_rv_reset")}
          </Btn>
        </div>
      </Card>

      {(error || loadError) && (
        <div className="admin-error-alert">
          {error || loadError?.message || "Không thể tải đánh giá."}
        </div>
      )}

      <Card style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div style={{ color: "#94a3b8", fontWeight: 700, padding: 48, textAlign: "center" }}>
            {t("pt_rv_loading")}
          </div>
        ) : (
          <Table
            headers={[t("pt_rv_col_hotel"), t("pt_rv_col_customer"), t("pt_rv_col_score"), t("pt_rv_col_comment"), t("pt_rv_col_date"), t("pt_rv_col_reply"), t("pt_rv_col_actions")]}
            rows={reviews.map((review) => {
              const hotel      = hotelsById.get(Number(review.hotelId));
              const needsReply = !review.partnerReply;
              return [
                <span style={{ color: "#0f172a", fontWeight: 800 }}>{hotel?.name || `#${review.hotelId}`}</span>,
                <span style={{ color: "#334155", fontWeight: 700 }}>{review.reviewerName || "Khách hàng"}</span>,
                <Stars value={review.rating} />,
                <div style={{ maxWidth: 280 }}>
                  <span style={{ color: review.comment ? "#475569" : "#94a3b8", display: "block", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {review.comment || t("pt_rv_no_comment")}
                  </span>
                  {needsReply && (
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 4, color: "#ef4444", fontSize: 11, fontWeight: 700 }}>
                      <AlertCircle size={11} /> {t("pt_rv_waiting")}
                    </div>
                  )}
                </div>,
                <span style={{ color: "#64748b", fontSize: 12 }}>{fmtDate(review.createdAt)}</span>,
                <ReplyBadge needsReply={needsReply} t={t} />,
                /* Action button */
                needsReply ? (
                  <Btn small onClick={() => openReplyModal(review)}>
                    <MessageSquareReply size={13} /> {t("pt_rv_reply_now")}
                  </Btn>
                ) : (
                  <Btn small variant="ghost" onClick={() => openReplyModal(review)}>
                    <MessageSquareReply size={13} /> {t("pt_rv_edit_reply")}
                  </Btn>
                ),
              ];
            })}
            empty={t("pt_rv_empty")}
          />
        )}
      </Card>

      {selectedReview && (
        <Modal title={t("pt_rv_modal_title")} onClose={() => setSelectedReview(null)} width={560}>
          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 14, marginBottom: 16, padding: 14 }}>
            <Stars value={selectedReview.rating} />
            <p style={{ color: selectedReview.comment ? "#334155" : "#94a3b8", fontSize: 14, lineHeight: 1.7, margin: "10px 0 0" }}>
              {selectedReview.comment || t("pt_rv_no_comment_long")}
            </p>
          </div>
          {error && <div className="admin-error-alert">{error}</div>}
          <textarea
            className="admin-textarea"
            value={reply}
            onChange={(event) => setReply(event.target.value)}
            placeholder={t("pt_rv_reply_ph")}
            rows={5}
          />
          <div className="admin-modal-actions">
            <Btn variant="ghost" onClick={() => setSelectedReview(null)}>{t("adm_cancel")}</Btn>
            <Btn disabled={saving || !reply.trim()} loading={saving} onClick={handleSaveReply}>{t("pt_rv_save_reply")}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
