import { useMemo, useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { AlertCircle, MessageSquareReply, Star } from "lucide-react";
import { useMyHotels, usePartnerReviews, useReplyReview } from "../../hooks/usePartnerQueries";
import { PageHeader, Card, Btn, Modal, Table } from "../../components/admin/AdminLayout";
import { useLang } from "../../contexts/LanguageContext";

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

export default function PartnerReviews() {
  const { t } = useLang();
  const { selectedHotelId: ctxHotelId, setSelectedHotelId: setCtxHotelId } = useOutletContext() || {};
  const REPLY_OPTIONS = [
    { value: "", label: t("pt_rv_reply_all") },
    { value: "false", label: t("pt_rv_reply_no") },
    { value: "true", label: t("pt_rv_reply_yes") },
  ];
  const [filters, setFilters] = useState({ hotelId: ctxHotelId ? String(ctxHotelId) : "", rating: "", hasReply: "" });
  const [error, setError] = useState("");
  const [selectedReview, setSelectedReview] = useState(null);
  const [reply, setReply] = useState("");

  useEffect(() => {
    setFilters(f => ({ ...f, hotelId: ctxHotelId ? String(ctxHotelId) : "" }));
  }, [ctxHotelId]);

  const { data: hotels = [] } = useMyHotels();
  const { data: reviewsData, isLoading: loading, error: loadError } = usePartnerReviews({
    hotelId: filters.hotelId || undefined,
    rating: filters.rating || undefined,
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
        onError: (e) => setError(e.message || "Không thể lưu phản hồi."),
      },
    );
  }

  return (
    <div style={{ paddingBottom: 60 }}>
      <PageHeader
        title={t("pt_rv_title")}
        subtitle={t("pt_rv_subtitle")}
      />

      {/* Reply Status Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {REPLY_TABS.map(tab => {
          const count = tab.value === "false"
            ? reviews.filter(r => !r.partnerReply).length
            : tab.value === "true"
              ? reviews.filter(r => r.partnerReply).length
              : reviews.length;
          return (
            <button
              key={tab.value}
              onClick={() => setFilters(c => ({ ...c, hasReply: tab.value }))}
              style={{
                padding: "8px 18px", borderRadius: 20, border: "none", cursor: "pointer",
                fontWeight: 700, fontSize: 13, transition: "all 0.15s", display: "flex", alignItems: "center", gap: 6,
                background: filters.hasReply === tab.value ? "#BE1E2E" : "#f1f5f9",
                color: filters.hasReply === tab.value ? "#fff" : "#475569",
              }}
            >
              {t(tab.label)}
              {tab.value === "false" && count > 0 && (
                <span style={{ background: filters.hasReply === "false" ? "rgba(255,255,255,0.3)" : "#BE1E2E", color: "#fff", borderRadius: 10, padding: "1px 7px", fontSize: 11 }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr auto", gap: 12, alignItems: "end" }}>
          <div>
            <div style={{ color: "#64748b", fontSize: 12, fontWeight: 800, marginBottom: 6 }}>{t("pt_rv_hotel_label")}</div>
            <select
              value={filters.hotelId}
              onChange={(event) => {
                const val = event.target.value;
                setFilters((current) => ({ ...current, hotelId: val }));
                setCtxHotelId?.(val ? Number(val) : null);
              }}
              style={selectStyle}
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
              value={filters.rating}
              onChange={(event) => setFilters((current) => ({ ...current, rating: event.target.value }))}
              style={selectStyle}
            >
              {RATING_OPTIONS.map((rating) => (
                <option key={rating || "all"} value={rating}>{rating ? t("pt_rv_score_x").replace("{n}", rating) : t("pt_rv_all_scores")}</option>
              ))}
            </select>
          </div>
          <Btn variant="ghost" onClick={() => setFilters({ hotelId: "", rating: "", hasReply: "" })}>
            {t("pt_rv_reset")}
          </Btn>
        </div>
      </Card>

      {(error || loadError) && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, color: "#b91c1c", fontSize: 13, fontWeight: 700, marginBottom: 16, padding: "12px 14px" }}>
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
              const hotel = hotelsById.get(Number(review.hotelId));
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
                <span style={{
                  color: needsReply ? "#ef4444" : "#10b981",
                  fontSize: 12, fontWeight: 800,
                  padding: "4px 10px", borderRadius: 8,
                  background: needsReply ? "#fef2f2" : "#ecfdf5",
                  border: `1px solid ${needsReply ? "#fecaca" : "#bbf7d0"}`,
                }}>
                  {needsReply ? t("pt_rv_not_replied") : t("pt_rv_replied")}
                </span>,
                needsReply ? (
                  <button
                    onClick={() => openReplyModal(review)}
                    style={{ padding: "8px 14px", borderRadius: 10, background: "#BE1E2E", color: "#fff", border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, boxShadow: "0 2px 8px rgba(190,30,46,0.25)" }}
                  >
                    <MessageSquareReply size={13} /> {t("pt_rv_reply_now")}
                  </button>
                ) : (
                  <Btn small variant="ghost" onClick={() => openReplyModal(review)}>
                    <span style={{ alignItems: "center", display: "flex", gap: 5 }}>
                      <MessageSquareReply size={13} /> {t("pt_rv_edit_reply")}
                    </span>
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
          <textarea
            value={reply}
            onChange={(event) => setReply(event.target.value)}
            placeholder={t("pt_rv_reply_ph")}
            rows={5}
            style={{ border: "1px solid #e2e8f0", borderRadius: 12, boxSizing: "border-box", fontFamily: "inherit", fontSize: 14, outline: "none", padding: 12, resize: "vertical", width: "100%" }}
          />
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
            <Btn variant="ghost" onClick={() => setSelectedReview(null)}>{t("adm_cancel")}</Btn>
            <Btn disabled={saving || !reply.trim()} loading={saving} onClick={handleSaveReply}>{t("pt_rv_save_reply")}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

const selectStyle = {
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  boxSizing: "border-box",
  color: "#334155",
  fontSize: 13,
  fontWeight: 700,
  outline: "none",
  padding: "10px 12px",
  width: "100%",
};
