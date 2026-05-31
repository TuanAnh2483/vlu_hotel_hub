import { useMemo, useState } from "react";
import { Calendar, Edit3, MessageSquare, Plus, Star, Trash2 } from "lucide-react";
import { useMyBookings } from "../../hooks/useBookingQueries";
import { useMyReviews, useCreateReview, useUpdateReview, useDeleteReview } from "../../hooks/useReviewQueries";
import { useLang } from "../../contexts/LanguageContext";

function fmtDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("vi-VN");
}

function Stars({ value }) {
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={16}
          fill={star <= Number(value || 0) ? "#f59e0b" : "transparent"}
          color={star <= Number(value || 0) ? "#f59e0b" : "#cbd5e1"}
        />
      ))}
    </div>
  );
}

export default function ReviewsPage() {
  const { t } = useLang();
  const [error, setError]           = useState("");
  const [reviewModal, setReviewModal] = useState(null);
  const [reviewForm, setReviewForm]  = useState({ rating: 5, comment: "" });

  const { data: reviews = [],  isLoading: reviewsLoading  } = useMyReviews();
  const { data: bookings = [], isLoading: bookingsLoading } = useMyBookings();

  const loading   = reviewsLoading || bookingsLoading;
  const delReview = useDeleteReview();
  const crtReview = useCreateReview();
  const updReview = useUpdateReview();
  const saving    = crtReview.isPending || updReview.isPending;
  const deleting  = delReview.variables ?? null;

  function handleDelete(reviewId) {
    if (!window.confirm(t("rv_confirm_delete"))) return;
    setError("");
    delReview.mutate(reviewId, {
      onError: (e) => setError(e.message || t("rv_delete_error")),
    });
  }

  function openCreateReview(booking) {
    setReviewModal({ mode: "create", booking });
    setReviewForm({ rating: 5, comment: "" });
    setError("");
  }

  function openEditReview(review) {
    setReviewModal({ mode: "edit", review });
    setReviewForm({ rating: review.rating || 5, comment: review.comment || "" });
    setError("");
  }

  function handleSaveReview() {
    if (!reviewModal) return;
    const normalizedComment = reviewForm.comment.trim() || null;
    setError("");
    if (reviewModal.mode === "create") {
      crtReview.mutate(
        { bookingId: reviewModal.booking.bookingId, rating: Number(reviewForm.rating), comment: normalizedComment },
        {
          onSuccess: () => { setReviewModal(null); setReviewForm({ rating: 5, comment: "" }); },
          onError: (e) => setError(e.message || t("rv_save_error")),
        }
      );
    } else {
      updReview.mutate(
        { reviewId: reviewModal.review.reviewId, rating: Number(reviewForm.rating), comment: normalizedComment },
        {
          onSuccess: () => { setReviewModal(null); setReviewForm({ rating: 5, comment: "" }); },
          onError: (e) => setError(e.message || t("rv_save_error")),
        }
      );
    }
  }

  const reviewedBookingIds = useMemo(
    () => new Set(reviews.map((review) => Number(review.bookingId))),
    [reviews],
  );

  const reviewableBookings = bookings.filter(
    (booking) => booking.status === "COMPLETED" && !reviewedBookingIds.has(Number(booking.bookingId)),
  );

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ color: "#1a1a1a", fontSize: 22, fontWeight: 800, marginBottom: 6 }}>{t("rv_title")}</h1>
        <p style={{ color: "#64748b", fontSize: 13, margin: 0 }}>{t("rv_subtitle")}</p>
      </div>

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 14, color: "#b91c1c", fontSize: 13, fontWeight: 700, marginBottom: 16, padding: "12px 14px" }}>
          {error}
        </div>
      )}

      {!loading && reviewableBookings.length > 0 && (
        <div style={{ background: "#fff", border: "1px solid #f1f5f9", borderRadius: 20, boxShadow: "0 10px 30px rgba(0,0,0,0.04)", marginBottom: 18, overflow: "hidden" }}>
          <div style={{ borderBottom: "1px solid #f1f5f9", padding: "16px 20px" }}>
            <div style={{ color: "#0f172a", fontSize: 16, fontWeight: 900 }}>{t("rv_reviewable_title")}</div>
            <div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>{t("rv_reviewable_sub")}</div>
          </div>
          {reviewableBookings.map((booking) => {
            const roomNames = booking.items?.map((item) => item.roomTypeName).join(", ") || t("rv_booking_fb");
            return (
              <div key={booking.bookingId} style={{ alignItems: "center", borderBottom: "1px solid #f8fafc", display: "flex", justifyContent: "space-between", gap: 16, padding: 20 }}>
                <div>
                  <div style={{ color: "#0f172a", fontSize: 15, fontWeight: 800 }}>Booking #{booking.bookingId}</div>
                  <div style={{ color: "#64748b", fontSize: 13, marginTop: 5 }}>{roomNames}</div>
                  <div style={{ alignItems: "center", color: "#94a3b8", display: "flex", fontSize: 12, gap: 6, marginTop: 6 }}>
                    <Calendar size={14} />
                    {fmtDate(booking.checkIn)} - {fmtDate(booking.checkOut)}
                  </div>
                </div>
                <button
                  onClick={() => openCreateReview(booking)}
                  style={{ alignItems: "center", background: "#BE1E2E", border: "none", borderRadius: 12, color: "#fff", cursor: "pointer", display: "flex", fontSize: 13, fontWeight: 800, gap: 8, padding: "10px 14px" }}
                >
                  <Plus size={15} /> {t("rv_write")}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ background: "#fff", border: "1px solid #f1f5f9", borderRadius: 20, boxShadow: "0 10px 30px rgba(0,0,0,0.04)", overflow: "hidden" }}>
        {loading ? (
          <div style={{ color: "#94a3b8", fontWeight: 700, padding: 40, textAlign: "center" }}>
            {t("rv_loading")}
          </div>
        ) : reviews.length === 0 ? (
          <div style={{ color: "#64748b", padding: 40, textAlign: "center" }}>
            <MessageSquare size={42} color="#cbd5e1" style={{ marginBottom: 12 }} />
            <div style={{ color: "#0f172a", fontSize: 16, fontWeight: 800, marginBottom: 6 }}>{t("rv_empty_title")}</div>
            <div style={{ fontSize: 13 }}>{t("rv_empty_sub")}</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {reviews.map((review) => (
              <div key={review.reviewId} style={{ borderBottom: "1px solid #f1f5f9", padding: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 12 }}>
                  <div>
                    <div style={{ color: "#0f172a", fontSize: 16, fontWeight: 800 }}>{review.hotelName || t("rv_hotel_fb")}</div>
                    <div style={{ alignItems: "center", color: "#64748b", display: "flex", fontSize: 12, gap: 6, marginTop: 5 }}>
                      <Calendar size={14} />
                      {fmtDate(review.checkIn)} - {fmtDate(review.checkOut)}
                    </div>
                  </div>
                  <div style={{ alignItems: "center", display: "flex", gap: 8 }}>
                    <button
                      onClick={() => openEditReview(review)}
                      style={{ alignItems: "center", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, color: "#1d4ed8", cursor: "pointer", display: "flex", fontSize: 12, fontWeight: 800, gap: 6, padding: "8px 10px" }}
                    >
                      <Edit3 size={14} />
                      {t("rv_edit")}
                    </button>
                    <button
                      disabled={deleting === review.reviewId}
                      onClick={() => handleDelete(review.reviewId)}
                      style={{ alignItems: "center", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, color: "#b91c1c", cursor: deleting === review.reviewId ? "not-allowed" : "pointer", display: "flex", fontSize: 12, fontWeight: 800, gap: 6, opacity: deleting === review.reviewId ? 0.7 : 1, padding: "8px 10px" }}
                    >
                      <Trash2 size={14} />
                      {deleting === review.reviewId ? t("rv_deleting") : t("rv_delete")}
                    </button>
                  </div>
                </div>
                <Stars value={review.rating} />
                {review.comment && (
                  <p style={{ color: "#334155", fontSize: 14, lineHeight: 1.7, margin: "12px 0 0" }}>
                    {review.comment}
                  </p>
                )}
                {review.partnerReply && (
                  <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 14, color: "#334155", fontSize: 13, lineHeight: 1.7, marginTop: 14, padding: "12px 14px" }}>
                    <strong>{t("rv_partner_reply")}</strong> {review.partnerReply}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {reviewModal && (
        <div style={{ alignItems: "center", background: "rgba(15,23,42,0.35)", display: "flex", inset: 0, justifyContent: "center", padding: 20, position: "fixed", zIndex: 300 }}>
          <div style={{ background: "#fff", borderRadius: 20, boxShadow: "0 24px 80px rgba(0,0,0,0.18)", maxWidth: 520, padding: 24, width: "100%" }}>
            <h2 style={{ color: "#0f172a", fontSize: 18, fontWeight: 900, margin: "0 0 16px" }}>
              {reviewModal.mode === "create" ? t("rv_modal_create") : t("rv_modal_edit")}
            </h2>
            <div style={{ marginBottom: 16 }}>
              <label style={{ color: "#64748b", display: "block", fontSize: 12, fontWeight: 800, marginBottom: 8 }}>{t("rv_rating_lbl")}</label>
              <select
                value={reviewForm.rating}
                onChange={(event) => setReviewForm((current) => ({ ...current, rating: Number(event.target.value) }))}
                style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, color: "#0f172a", fontSize: 14, fontWeight: 700, padding: "10px 12px", width: "100%" }}
              >
                {[5, 4, 3, 2, 1].map((rating) => (
                  <option key={rating} value={rating}>{rating} {t("rv_star")}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ color: "#64748b", display: "block", fontSize: 12, fontWeight: 800, marginBottom: 8 }}>{t("rv_comment_lbl")}</label>
              <textarea
                value={reviewForm.comment}
                onChange={(event) => setReviewForm((current) => ({ ...current, comment: event.target.value }))}
                placeholder={t("rv_comment_ph")}
                rows={5}
                style={{ border: "1px solid #e2e8f0", borderRadius: 12, boxSizing: "border-box", fontFamily: "inherit", fontSize: 14, lineHeight: 1.6, outline: "none", padding: 12, resize: "vertical", width: "100%" }}
              />
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 }}>
              <button
                onClick={() => setReviewModal(null)}
                style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, color: "#475569", cursor: "pointer", fontSize: 13, fontWeight: 800, padding: "10px 16px" }}
              >
                {t("rv_cancel")}
              </button>
              <button
                disabled={saving}
                onClick={handleSaveReview}
                style={{ background: "#BE1E2E", border: "none", borderRadius: 12, color: "#fff", cursor: saving ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 800, opacity: saving ? 0.7 : 1, padding: "10px 16px" }}
              >
                {saving ? t("rv_saving") : t("rv_save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
