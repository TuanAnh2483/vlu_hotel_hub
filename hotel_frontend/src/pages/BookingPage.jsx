import { useState } from "react";
import { C, ActionBtn } from "../components/auth/AuthShared";
import MainNavbar from "../components/MainNavbar";
import Footer from "../components/Footer";
import { useCreateBooking } from "../hooks/useBookingQueries";
import { useLang } from "../contexts/LanguageContext";
import { ChevronLeft } from "lucide-react";
import "../styles/pages/BookingPage.css";

const P = "#BE1E2E";

const ICON_PATHS = {
  calendar: "M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z",
  moon:     "M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z",
  people:   "M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z",
  bed:      "M7 13c1.66 0 3-1.34 3-3S8.66 7 7 7s-3 1.34-3 3 1.34 3 3 3zm12-6h-8v7H3V5H1v15h2v-3h18v3h2v-9c0-2.21-1.79-4-4-4z",
  person:   "M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z",
  phone:    "M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z",
  email:    "M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z",
  shield:   "M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z",
  check:    "M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z",
  info:     "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z",
};

function SvgIcon({ k, size = 16, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} className="bkp-svg-icon">
      <path d={ICON_PATHS[k]} />
    </svg>
  );
}

function fmt(n) { return (n || 0).toLocaleString("vi-VN") + "₫"; }

function fmtDate(s) {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d) ? s : d.toLocaleDateString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" });
}

// ── Stepper ─────────────────────────────────────────────────────────
function Stepper({ current }) {
  const { t } = useLang();
  const steps = [t("step_room"), t("step_confirm"), t("step_payment"), t("step_done")];
  return (
    <div className="bkp-stepper">
      {steps.map((s, i) => {
        const done   = i < current;
        const active = i === current;
        return (
          <div key={s} className="bkp-step">
            <div className="bkp-step-col">
              <div
                className="bkp-step-circle"
                style={{ background: done || active ? P : "#e8e8e8" }}
              >
                {done
                  ? <SvgIcon k="check" size={16} color="#fff" />
                  : <span className="bkp-step-num" style={{ color: active ? "#fff" : "#bbb" }}>{i + 1}</span>
                }
              </div>
              <span
                className="bkp-step-label"
                style={{ fontWeight: active ? 700 : 400, color: active ? P : done ? "#555" : "#bbb" }}
              >
                {s}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className="bkp-step-connector" style={{ background: done ? P : "#e8e8e8" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Info row ─────────────────────────────────────────────────────────
function InfoRow({ icon, label, value, valueColor }) {
  return (
    <div className="bkp-info-row">
      <div className="bkp-info-row-icon">
        <SvgIcon k={icon} size={16} color={P} />
      </div>
      <div className="bkp-info-row-body">
        <div className="bkp-info-row-label">{label}</div>
        <div className="bkp-info-row-value" style={valueColor ? { color: valueColor } : undefined}>{value}</div>
      </div>
    </div>
  );
}

// ── Section card ─────────────────────────────────────────────────────
function Card({ title, icon, children }) {
  return (
    <div className="bkp-card">
      {title && (
        <div className="bkp-card-title-row">
          {icon && <SvgIcon k={icon} size={18} color={P} />}
          <h3 className="bkp-card-title">{title}</h3>
        </div>
      )}
      {children}
    </div>
  );
}

// ── Input field ──────────────────────────────────────────────────────
function Field({ label, icon, children }) {
  return (
    <div>
      <label className="bkp-field-label">
        {icon && <SvgIcon k={icon} size={13} color="#aaa" />}
        {label}
      </label>
      {children}
    </div>
  );
}

export default function BookingPage({ navigate, user, params = {}, onLogout }) {
  const { t } = useLang();
  const { hotelId, hotelName, room, checkin, checkout, guests = 1, nights = 1 } = params;

  const [contact, setContact] = useState({ fullName: "", email: user?.email || "", phone: "" });
  const [error, setError]     = useState("");
  const [focusField, setFocusField] = useState(null);

  const createBooking = useCreateBooking();

  const upd = k => e => setContact(p => ({ ...p, [k]: e.target.value }));

  const roomPrice = room?.price || 0;
  const subtotal  = roomPrice * nights;
  const tax       = Math.round(subtotal * 0.1);
  const total     = subtotal + tax;

  const hasContact = contact.fullName.trim() && contact.email.trim() && contact.phone.trim();

  const handleConfirm = async () => {
    if (!hasContact) { setError("Vui lòng điền đầy đủ thông tin liên hệ."); return; }
    if (!room?.id)   { setError("Thiếu thông tin phòng. Vui lòng quay lại và chọn phòng."); return; }
    setError("");
    createBooking.mutate(
      {
        checkIn:  checkin,
        checkOut: checkout,
        rooms:    [{ roomTypeId: room.id, quantity: 1 }],
        contact:  { fullName: contact.fullName, email: contact.email, phone: contact.phone },
      },
      {
        onSuccess: (res) => navigate("booking-detail", { bookingId: res.bookingId, hotelName }),
        onError:   (err) => setError(err.message || "Đặt phòng thất bại. Vui lòng thử lại."),
      }
    );
  };
  const loading = createBooking.isPending;

  const inp = focused => ({
    border: `1.5px solid ${focused ? P : "#e8e8e8"}`,
    background: focused ? "#fff" : "#fafafa",
  });

  if (!user) {
    return (
      <div className="bkp-root">
        <MainNavbar active="search" navigate={navigate} user={user} onLogout={onLogout} />
        <div className="bkp-login-center">
          <div className="bkp-login-content">
            <div className="bkp-login-avatar">
              <SvgIcon k="person" size={32} color={P} />
            </div>
            <p className="bkp-login-text">{t("booking_login_msg")}</p>
            <ActionBtn onClick={() => navigate("login")} style={{ padding: "12px 36px" }}>{t("booking_login_btn")}</ActionBtn>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bkp-root">
      <MainNavbar active="search" navigate={navigate} user={user} onLogout={onLogout} />

      {/* Stepper bar */}
      <div className="bkp-stepper-bar">
        <div className="bkp-stepper-bar-inner">
          <Stepper current={1} />
        </div>
      </div>

      <div className="bkp-layout">

        {/* ── LEFT ── */}
        <div className="bkp-left">
          {/* Back */}
          <button className="bkp-back-btn" onClick={() => navigate("hotel", { hotelId })}>
            <ChevronLeft size={18} /> {t("booking_back")}
          </button>

          <h1 className="bkp-page-title">{t("booking_title")}</h1>

          {/* Booking summary card */}
          <Card title={t("booking_info_title")} icon="bed">
            {hotelName && <div className="bkp-hotel-name">{hotelName}</div>}
            <div className="bkp-room-name">{room?.name || t("booking_room_selected")}</div>

            <InfoRow icon="calendar" label={t("booking_checkin_full")} value={fmtDate(checkin)} />
            <InfoRow icon="calendar" label={t("booking_checkout_full")} value={fmtDate(checkout)} />
            <InfoRow icon="moon"     label={t("booking_duration")} value={`${nights}${t("night")}`} />
            <InfoRow icon="people"   label={t("booking_guests")}   value={`${guests}${t("guests")}`} />
            {room?.beds && (
              <InfoRow icon="bed" label={t("booking_bed")} value={room.beds} />
            )}
          </Card>

          {/* Contact form */}
          <Card title={t("booking_contact")} icon="person">
            <p className="bkp-contact-note">
              {t("booking_contact_note")}
            </p>
            <div className="bkp-contact-form">
              <Field label={t("booking_name")} icon="person">
                <input
                  className="bkp-input"
                  style={inp(focusField === "fullName")}
                  placeholder={t("booking_name_ph")}
                  value={contact.fullName}
                  onChange={upd("fullName")}
                  onFocus={() => setFocusField("fullName")}
                  onBlur={() => setFocusField(null)}
                />
              </Field>
              <div className="bkp-contact-grid">
                <Field label={t("booking_email")} icon="email">
                  <input
                    className="bkp-input"
                    style={inp(focusField === "email")}
                    type="email"
                    placeholder="email@example.com"
                    value={contact.email}
                    onChange={upd("email")}
                    onFocus={() => setFocusField("email")}
                    onBlur={() => setFocusField(null)}
                  />
                </Field>
                <Field label={t("booking_phone")} icon="phone">
                  <input
                    className="bkp-input"
                    style={inp(focusField === "phone")}
                    placeholder={t("booking_phone_ph")}
                    value={contact.phone}
                    onChange={upd("phone")}
                    onFocus={() => setFocusField("phone")}
                    onBlur={() => setFocusField(null)}
                  />
                </Field>
              </div>
            </div>
          </Card>

          {/* Cancellation policy */}
          <Card>
            <div className="bkp-policy-row">
              <div className="bkp-policy-icon">
                <SvgIcon k="shield" size={18} color="#2e7d32" />
              </div>
              <div>
                <div className="bkp-policy-title">{t("booking_cancel_policy_title")}</div>
                <div className="bkp-policy-text">{t("booking_cancel_policy_text")}</div>
              </div>
            </div>
          </Card>
        </div>

        {/* ── RIGHT — sticky ── */}
        <div className="bkp-right">
          {/* Price breakdown */}
          <div className="bkp-price-box">
            <h3 className="bkp-price-title">{t("booking_price_title")}</h3>

            {roomPrice > 0 ? (
              <>
                <div className="bkp-price-row">
                  <span>{fmt(roomPrice)} × {nights}{t("night")}</span>
                  <span className="bkp-price-row-val">{fmt(subtotal)}</span>
                </div>
                <div className="bkp-price-row bkp-price-row-tax">
                  <span>{t("booking_tax")}</span>
                  <span className="bkp-price-row-val">{fmt(tax)}</span>
                </div>
                <div className="bkp-price-total-row">
                  <span className="bkp-price-total-label">{t("booking_total")}</span>
                  <span className="bkp-price-total-value">{fmt(total)}</span>
                </div>
              </>
            ) : (
              <p className="bkp-price-empty">{t("booking_no_price")}</p>
            )}

            {/* Payment note */}
            <div className="bkp-payment-note">
              <SvgIcon k="info" size={14} color="#aaa" />
              <span>{t("booking_payment_note")}</span>
            </div>
          </div>

          {error && <div className="bkp-error">{error}</div>}

          <ActionBtn
            onClick={handleConfirm}
            disabled={loading}
            style={{ width: "100%", padding: "15px", fontSize: 15, borderRadius: 12, boxSizing: "border-box" }}
          >
            {loading ? t("booking_processing") : `${t("booking_confirm_btn")} →`}
          </ActionBtn>

          <p className="bkp-terms">
            Bằng cách xác nhận, bạn đồng ý với<br />Điều khoản &amp; Chính sách của VLU HotelHub.
          </p>
        </div>
      </div>

      <Footer navigate={navigate} />
    </div>
  );
}
