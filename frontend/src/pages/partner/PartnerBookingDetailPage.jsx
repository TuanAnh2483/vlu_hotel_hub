import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  usePartnerBookingDetail, useCompleteBooking, useCheckinBooking,
  useHotelRoomUnits, useBookingRoomUnits, useAssignBookingRoomUnits,
} from "../../hooks/usePartnerQueries";
import { PageHeader, Card, Badge, Modal, Btn } from "../../components/admin/AdminLayout";
import { useLang } from "../../contexts/LanguageContext";
import {
  ArrowLeft, Calendar, User, Users, Building2, CreditCard,
  Clock, CheckCircle2, BedDouble, LogIn, AlertTriangle, Pencil,
} from "lucide-react";
import "../../styles/pages/PartnerBookingDetailPage.css";

// ── helpers ────────────────────────────────────────────────────────────────

function fmtPrice(n) {
  return new Intl.NumberFormat("vi-VN").format(n) + " ₫";
}
function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function fmtDateTime(d) {
  if (!d) return "—";
  return new Date(d).toLocaleString("vi-VN");
}
function canCheckoutBooking(booking, occupiedCount = 0) {
  const status = booking?.status;
  if ((status !== "CONFIRMED" && status !== "CHECKED_IN") || !booking.checkIn) return false;
  const ci = new Date(`${booking.checkIn}T00:00:00`);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (today < ci) return false;
  // Khách đã check-in → cho phép early checkout
  if (occupiedCount > 0) return true;
  // Chưa check-in → chỉ hiện checkout khi đến/qua ngày trả phòng
  if (!booking.checkOut) return false;
  const co = new Date(`${booking.checkOut}T00:00:00`);
  return !isNaN(co) && co <= today;
}
function isCheckinDay(booking) {
  if (booking?.status !== "CONFIRMED" || !booking.checkIn) return false;
  const ci = new Date(`${booking.checkIn}T00:00:00`);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return !isNaN(ci) && today >= ci;
}

// ── unit status config ─────────────────────────────────────────────────────

const UNIT_CFG = {
  AVAILABLE:   { label: "Trống",     color: "#10b981", bg: "#d1fae5" },
  RESERVED:    { label: "Đã đặt",    color: "#8b5cf6", bg: "#ede9fe" },
  OCCUPIED:    { label: "Có khách",  color: "#3b82f6", bg: "#dbeafe" },
  CLEANING:    { label: "Dọn phòng", color: "#f59e0b", bg: "#fef3c7" },
  MAINTENANCE: { label: "Bảo trì",   color: "#ef4444", bg: "#fee2e2" },
};

function UnitBadge({ status }) {
  const cfg = UNIT_CFG[status] || { label: status, color: "#64748b", bg: "#f1f5f9" };
  return (
    <span className="pbd-unit-badge" style={{ background: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  );
}

// ── AssignRoomModal ────────────────────────────────────────────────────────
// Chọn phòng vật lý cho booking. Gán theo ĐÚNG khoảng ngày check-in→check-out;
// backend chặn nếu phòng đã bận một đêm bất kỳ trong kỳ.

function AssignRoomModal({ booking, allUnits, assignedUnitIds, customerName, onConfirm, onClose, loading }) {
  const items = booking?.items ?? [];

  const [selected, setSelected] = useState(() => {
    const init = {};
    items.forEach(item => {
      const pre = allUnits
        .filter(u => u.roomId === item.roomTypeId && assignedUnitIds.has(u.id))
        .map(u => u.id);
      init[item.roomTypeId] = new Set(pre);
    });
    return init;
  });

  const toggle = (roomId, unitId) => {
    setSelected(prev => {
      const s = new Set(prev[roomId] || []);
      s.has(unitId) ? s.delete(unitId) : s.add(unitId);
      return { ...prev, [roomId]: s };
    });
  };

  const isValid = items.every(item => (selected[item.roomTypeId]?.size ?? 0) >= item.quantity);

  function confirm() {
    const ids = [];
    items.forEach(item => { for (const id of (selected[item.roomTypeId] ?? [])) ids.push(id); });
    onConfirm(ids);
  }

  return (
    <Modal title={`Gán phòng: ${customerName}`} onClose={onClose} width={520}>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 6 }}>
        Chọn phòng vật lý giữ cho booking trong khoảng{" "}
        <strong>{fmtDate(booking.checkIn)} → {fmtDate(booking.checkOut)}</strong>.
      </p>
      <p style={{ fontSize: 12.5, color: "#94a3b8", marginBottom: 20 }}>
        Danh sách hiện phòng trống trong ngày nhận phòng. Nếu phòng bận một đêm khác trong kỳ,
        hệ thống sẽ báo khi lưu.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {items.map((item) => {
          const typeName  = item.roomTypeName || "Phòng";
          const available = allUnits.filter(u =>
            u.roomId === item.roomTypeId &&
            (u.status === "AVAILABLE" || assignedUnitIds.has(u.id))
          );
          const sel      = selected[item.roomTypeId] || new Set();
          const needed   = item.quantity;
          const selCount = sel.size;

          return (
            <div key={item.roomTypeId}>
              <div className="pbd-modal-type-header">
                <span className="pbd-room-type-name">{typeName}</span>
                <span className="pbd-modal-count" style={{ color: selCount >= needed ? "#10b981" : "#f59e0b" }}>
                  {selCount}/{needed} đã chọn
                </span>
              </div>

              {available.length === 0 ? (
                <p className="pbd-unit-hint pbd-unit-hint--warn">
                  <AlertTriangle size={13} /> Không có phòng trống cho loại này trong ngày nhận phòng.
                </p>
              ) : (
                <div className="pbd-unit-checklist">
                  {available.map(u => {
                    const checked  = sel.has(u.id);
                    const disabled = !checked && selCount >= needed;
                    return (
                      <label
                        key={u.id}
                        className={`pbd-unit-check-row${disabled ? " disabled" : ""}${checked ? " checked" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={disabled}
                          onChange={() => toggle(item.roomTypeId, u.id)}
                          style={{ accentColor: "#BE1E2E" }}
                        />
                        <BedDouble size={14} color="#64748b" />
                        <span>
                          {u.roomNumber ? `Phòng ${u.roomNumber}` : `Phòng #${u.id}`}
                          {u.floor != null ? ` · Tầng ${u.floor}` : ""}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 24 }}>
        <Btn variant="ghost" onClick={onClose} disabled={loading}>Hủy</Btn>
        <Btn onClick={confirm} disabled={!isValid || loading} loading={loading}>
          <BedDouble size={14} /> Xác nhận Gán phòng
        </Btn>
      </div>
    </Modal>
  );
}

// ── RoomPhysicalSection ────────────────────────────────────────────────────

function RoomPhysicalSection({ booking, items, assignments, onAssign, onCheckin, checkinDay }) {
  const isConfirmed   = booking?.status === "CONFIRMED" || booking?.status === "CHECKED_IN";
  const derivedStatus = booking?.status === "CHECKED_IN" ? "OCCUPIED" : "RESERVED";
  const hasAssigned   = assignments.length > 0;

  return (
    <Card title={
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <BedDouble size={16} color="#64748b" />
        <span>Phòng vật lý</span>
      </div>
    }>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {items.map((item) => {
          const typeName = item.roomTypeName || "Phòng";
          const assigned = assignments.filter(a => a.roomId === item.roomTypeId);

          return (
            <div key={item.roomTypeId} className="pbd-room-type-block">
              <div className="pbd-room-type-header">
                <span className="pbd-room-type-name">{typeName}</span>
                <span className="pbd-room-type-qty">× {item.quantity}</span>
              </div>

              {assigned.length > 0 ? (
                <div className="pbd-unit-list">
                  {assigned.map(a => (
                    <div key={a.id} className="pbd-unit-row">
                      <BedDouble size={14} color="#64748b" />
                      <span className="pbd-unit-number">
                        {a.roomNumber ? `Phòng ${a.roomNumber}` : `#${a.roomUnitId}`}
                        {a.floor != null ? ` · Tầng ${a.floor}` : ""}
                      </span>
                      <UnitBadge status={derivedStatus} />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="pbd-unit-hint pbd-unit-hint--warn">
                  <AlertTriangle size={13} style={{ flexShrink: 0 }} />
                  Chưa gán phòng cụ thể.
                </p>
              )}
            </div>
          );
        })}
      </div>

      {isConfirmed && (
        <div className="pbd-room-actions">
          <button className="pbd-assign-btn" onClick={onAssign}>
            <Pencil size={14} />
            {hasAssigned ? "Thay đổi phòng" : "Gán phòng"}
          </button>

          {checkinDay && (
            <button className="pbd-checkin-btn" onClick={onCheckin}>
              <LogIn size={14} /> Check-in khách
            </button>
          )}
        </div>
      )}

      {isConfirmed && !checkinDay && booking?.status !== "CHECKED_IN" && (
        <p className="pbd-unit-hint" style={{ marginTop: 10 }}>
          Check-in mở vào ngày {fmtDate(booking.checkIn)}.
        </p>
      )}
    </Card>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────

export default function PartnerBookingDetailPage() {
  const { t } = useLang();
  const { bookingId } = useParams();
  const navigate = useNavigate();

  const [actionError,   setActionError]   = useState("");
  const [actionMessage, setActionMessage] = useState("");
  // modal: null | "assign" | "confirmCheckout"
  const [modalMode, setModalMode] = useState(null);

  const { data: booking, isLoading: loading, error } = usePartnerBookingDetail(bookingId);
  // Trạng thái phòng tính cho ngày nhận phòng của booking → "Trống" nghĩa là rảnh kỳ này
  const { data: allUnits = [] }    = useHotelRoomUnits(booking?.hotelId, booking?.checkIn);
  const { data: assignments = [] } = useBookingRoomUnits(booking?.bookingId);

  const assignBooking   = useAssignBookingRoomUnits();
  const completeBooking = useCompleteBooking();
  const checkinBooking  = useCheckinBooking();

  const completing = completeBooking.isPending || checkinBooking.isPending;
  const modalBusy  = assignBooking.isPending;

  const customerName = booking?.customerName
    || booking?.contact?.fullName
    || booking?.contact?.email
    || "khách hàng";

  const items           = booking?.items ?? [];
  const assignedUnitIds = new Set(assignments.map(a => a.roomUnitId));

  // ── gán phòng (theo khoảng ngày booking) ──────────────────────────────────
  async function handleAssign(unitIds) {
    try {
      await assignBooking.mutateAsync({ bookingId: booking.bookingId, unitIds });
      setModalMode(null);
      setActionMessage(unitIds.length > 0
        ? `Đã gán ${unitIds.length} phòng cho ${customerName}.`
        : "Đã gỡ phòng đã gán.");
      setActionError("");
    } catch (e) {
      setActionError(e.message || "Gán phòng thất bại.");
    }
  }

  // ── check-in (CONFIRMED → CHECKED_IN); phòng đã gán tự thành "Có khách" ────
  async function handleCheckin() {
    try {
      await checkinBooking.mutateAsync(booking.bookingId);
      setActionMessage(`Đã check-in cho ${customerName}.`);
      setActionError("");
    } catch (e) {
      setActionError(e.message || "Check-in thất bại.");
    }
  }

  // ── complete (checkout) ────────────────────────────────────────────────────
  function handleComplete() {
    if (booking) setModalMode("confirmCheckout");
  }

  async function executeComplete() {
    setModalMode(null);
    setActionError(""); setActionMessage("");
    try {
      await completeBooking.mutateAsync(booking.bookingId);
      // Backend tự chuyển phòng đã gán sang Dọn phòng + giải phóng assignment
      setActionMessage(
        assignments.length > 0
          ? `${t("pt_bk_checkout_done")} · ${assignments.length} phòng chuyển sang Dọn phòng.`
          : t("pt_bk_checkout_done")
      );
    } catch (e) {
      setActionError(e.message || t("pt_bk_err_checkout"));
    }
  }

  // ── guards ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>{t("pt_loading")}</div>
  );
  if (error || !booking) return (
    <div style={{ padding: 40, textAlign: "center", color: "#ef4444" }}>
      {error?.message || t("pt_bk_err_detail")}
    </div>
  );

  const isCheckedIn    = booking?.status === "CHECKED_IN";
  const occupiedCount  = isCheckedIn ? 1 : 0;
  const showCheckout   = canCheckoutBooking(booking, occupiedCount);
  const checkinDay     = isCheckinDay(booking) && !isCheckedIn && !showCheckout;
  const isEarlyCheckout = (() => {
    if (!booking?.checkOut) return false;
    const co = new Date(`${booking.checkOut}T00:00:00`);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return today < co;
  })();

  return (
    <div>
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#94a3b8", marginBottom: 16, flexWrap: "wrap" }}>
        <button
          onClick={() => navigate("/partner/bookings")}
          style={{ background: "none", border: "none", color: "#64748b", fontWeight: 600, fontSize: 13, cursor: "pointer", padding: 0 }}
        >
          {t("pt_bk_title")}
        </button>
        <span aria-hidden="true">/</span>
        <span style={{ color: "#1e293b", fontWeight: 700 }}>#{booking.bookingId}</span>
      </nav>

      <div style={{ marginBottom: 24 }}>
        <button onClick={() => navigate("/partner/bookings")} className="partner-booking-detail-back-btn">
          <ArrowLeft size={18} /> {t("pt_bk_back")}
        </button>
      </div>

      <PageHeader
        title={t("pt_bk_detail_title").replace("#{id}", booking.bookingId)}
        subtitle={t("pt_bk_detail_subtitle").replace("{name}", customerName)}
        action={
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <Badge status={booking.status} />
            {isCheckedIn && (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                background: "#dbeafe", color: "#1d4ed8",
                borderRadius: 999, padding: "4px 10px",
                fontSize: 12, fontWeight: 800,
              }}>
                <LogIn size={12} /> Đang lưu trú
              </span>
            )}
          </div>
        }
      />

      <div className="pbd-grid">

        {/* ── Left ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

          {/* Hotel + room types */}
          <Card title={t("pt_bk_section_hotel_rooms")}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", gap: 12 }}>
                <Building2 size={18} color="#64748b" style={{ marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>{t("pt_bk_col_hotel")}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>{booking.hotelName}</div>
                </div>
              </div>
              <div style={{ height: 1, background: "#f1f5f9" }} />
              <div>
                <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, marginBottom: 12 }}>
                  {t("pt_bk_section_rooms")}
                </div>
                {booking.items?.map((item, i) => (
                  <div key={i} style={{
                    background: "#f8fafc", borderRadius: 10, padding: "12px 16px",
                    marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}>
                    <div>
                      <div style={{ fontWeight: 700, color: "#1e293b" }}>
                        {item.roomTypeName || "Phòng"}
                      </div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>
                        {t("pt_bk_room_qty").replace("{n}", item.quantity)}
                      </div>
                    </div>
                    <div style={{ fontWeight: 800, color: "#BE1E2E" }}>{fmtPrice(item.stayPrice)}</div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Physical room assignment */}
          <RoomPhysicalSection
            booking={booking}
            items={items}
            assignments={assignments}
            checkinDay={checkinDay}
            onAssign={() => setModalMode("assign")}
            onCheckin={handleCheckin}
          />

          {/* Customer */}
          <Card title={t("pt_bk_section_customer")}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <div style={{ display: "flex", gap: 12 }}>
                <User size={18} color="#64748b" />
                <div>
                  <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>{t("pt_bk_customer_name")}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#1e293b" }}>{customerName}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <CreditCard size={18} color="#64748b" />
                <div>
                  <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>{t("pt_bk_contact")}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#1e293b" }}>
                    {booking.contact?.email || booking.contact?.phone || "—"}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <Users size={18} color="#64748b" />
                <div>
                  <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>{t("pt_bk_guests")}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#1e293b" }}>
                    {booking.guests != null ? `${booking.guests} ${t("pt_bk_guests_unit")}` : "—"}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* ── Right ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

          {/* Cost + actions */}
          <Card style={{ background: "#FFF1F2", border: "1px solid #FFE4E6" }}>
            <div style={{ fontSize: 12, color: "#BE1E2E", fontWeight: 700, marginBottom: 16 }}>
              {t("pt_bk_section_cost")}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>{t("pt_bk_total_label")}</span>
              <span style={{ fontSize: 20, fontWeight: 800, color: "#BE1E2E" }}>{fmtPrice(booking.totalPrice)}</span>
            </div>

            {(actionError || actionMessage) && (
              <div style={{
                marginTop: 14, padding: "10px 12px", borderRadius: 10,
                fontSize: 12, fontWeight: 700, lineHeight: 1.5,
                background: actionError ? "#fff" : "#ecfdf5",
                border: `1px solid ${actionError ? "#fecaca" : "#bbf7d0"}`,
                color: actionError ? "#b91c1c" : "#047857",
              }}>
                {actionError || actionMessage}
              </div>
            )}

            {showCheckout && (
              <button
                onClick={handleComplete}
                disabled={completing}
                style={{
                  alignItems: "center", background: "#10b981", border: "none",
                  borderRadius: 10, color: "#fff", cursor: completing ? "not-allowed" : "pointer",
                  display: "flex", fontSize: 13, fontWeight: 800, gap: 8,
                  justifyContent: "center", marginTop: 16, opacity: completing ? 0.7 : 1,
                  padding: "12px 14px", width: "100%",
                }}
              >
                <CheckCircle2 size={16} />
                {completing ? t("pt_bk_checking_out") : t("pt_bk_checkout_open")}
              </button>
            )}
          </Card>

          {/* Dates */}
          <Card title={t("pt_bk_section_time")}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Planned booking dates */}
              <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, letterSpacing: "0.08em" }}>
                {t("pt_bk_planned_dates")}
              </div>
              {[
                [t("pt_bk_col_checkin"),  fmtDate(booking.checkIn)],
                [t("pt_bk_col_checkout"), fmtDate(booking.checkOut)],
              ].map(([label, val]) => (
                <div key={label} style={{ display: "flex", gap: 12 }}>
                  <Calendar size={18} color="#64748b" />
                  <div>
                    <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>{label}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>{val}</div>
                  </div>
                </div>
              ))}

              {/* Actual timestamps — only shown after action */}
              {(booking.checkedInAt || booking.checkedOutAt) && (
                <>
                  <div style={{ height: 1, background: "#f1f5f9" }} />
                  <div style={{ fontSize: 10, color: "#1d4ed8", fontWeight: 700, letterSpacing: "0.08em" }}>
                    {t("pt_bk_actual_times")}
                  </div>
                </>
              )}

              {booking.checkedInAt && (
                <div style={{ display: "flex", gap: 12 }}>
                  <LogIn size={18} color="#1d4ed8" />
                  <div>
                    <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>{t("pt_bk_actual_checkin")}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#1d4ed8" }}>{fmtDateTime(booking.checkedInAt)}</div>
                  </div>
                </div>
              )}

              {booking.checkedOutAt && (
                <div style={{ display: "flex", gap: 12 }}>
                  <CheckCircle2 size={18} color="#059669" />
                  <div>
                    <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>{t("pt_bk_actual_checkout")}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#059669" }}>{fmtDateTime(booking.checkedOutAt)}</div>
                  </div>
                </div>
              )}

              <div style={{ height: 1, background: "#f1f5f9" }} />
              <div style={{ display: "flex", gap: 12 }}>
                <Clock size={18} color="#64748b" />
                <div>
                  <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>{t("pt_bk_created_at")}</div>
                  <div style={{ fontSize: 14, color: "#64748b" }}>{fmtDateTime(booking.createdAt)}</div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Modal: gán phòng */}
      {modalMode === "assign" && (
        <AssignRoomModal
          booking={booking}
          allUnits={allUnits}
          assignedUnitIds={assignedUnitIds}
          customerName={customerName}
          loading={modalBusy}
          onConfirm={handleAssign}
          onClose={() => setModalMode(null)}
        />
      )}

      {modalMode === "confirmCheckout" && (
        <Modal title={t("pt_bk_confirm_checkout_title") || "Xác nhận hoàn tất"} onClose={() => setModalMode(null)} width={420}>
          <p style={{ fontSize: 14, color: "#475569", lineHeight: 1.65, margin: "0 0 16px" }}>
            {t("pt_bk_confirm_checkout") || `Xác nhận checkout cho khách ${customerName}? Các phòng đã gán sẽ chuyển sang trạng thái Dọn phòng.`}
          </p>
          {isEarlyCheckout && (
            <div style={{
              display: "flex", gap: 8, alignItems: "flex-start",
              background: "#fffbeb", border: "1px solid #fde68a",
              borderRadius: 10, padding: "10px 12px", marginBottom: 16,
              fontSize: 13, color: "#92400e", lineHeight: 1.5,
            }}>
              <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>Khách trả phòng sớm hơn dự kiến. Ngày trả phòng đã đặt: <strong>{fmtDate(booking.checkOut)}</strong>.</span>
            </div>
          )}
          <div style={{ display: "flex", gap: 12 }}>
            <Btn variant="ghost" style={{ flex: 1 }} onClick={() => setModalMode(null)} disabled={completing}>
              {t("pt_cancel") || "Hủy"}
            </Btn>
            <Btn style={{ flex: 1, background: "#10b981" }} onClick={executeComplete} loading={completing}>
              <CheckCircle2 size={15} /> {t("pt_bk_checkout_btn")}
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
