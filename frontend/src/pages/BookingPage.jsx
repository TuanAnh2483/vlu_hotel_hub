import { useState, useMemo } from "react";
import { C } from "../lib/constants";
import { ActionBtn } from "../components/auth/AuthShared";
import MainNavbar from "../components/MainNavbar";
import Footer from "../components/Footer";
import { useCreateBooking } from "../hooks/useBookingQueries";
import { useLang } from "../contexts/LanguageContext";
import BookingStepper from "../components/ui/BookingStepper";
import {
  Bed, Calendar, ChevronLeft, Clock, Info, Mail, Moon,
  Phone, Shield, ShieldCheck, ShieldOff, User, Users,
} from "lucide-react";
import CancellationPolicyInfo from "../components/CancellationPolicyInfo";
import "../styles/pages/BookingPage.css";


// ── Session persistence ──────────────────────────────────────────────
// Khi user refresh trang /book, location.state bị mất. sessionStorage giữ
// params lại để trang có thể tự khôi phục thay vì hiển thị "phiên hết hạn".
const SESSION_KEY = "vlu_bkp_draft";

function getEffectiveParams(incoming) {
  if (incoming.hotelId && incoming.rooms?.length > 0) {
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(incoming)); } catch { /* storage unavailable */ }
    return incoming;
  }
  try {
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (saved) return JSON.parse(saved);
  } catch { /* storage unavailable */ }
  return incoming;
}

const ICONS = {
  calendar: Calendar,
  moon:     Moon,
  people:   Users,
  bed:      Bed,
  person:   User,
  phone:    Phone,
  email:    Mail,
  shield:   Shield,
  info:     Info,
};

const POLICY_CFG = {
  FLEXIBLE: { Icon: ShieldCheck, color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0" },
  MODERATE: { Icon: Clock,       color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
  STRICT:   { Icon: ShieldOff,   color: "#dc2626", bg: "#fff1f2", border: "#fecdd3" },
};

function SvgIcon({ k, size = 16, color = "currentColor" }) {
  const Icon = ICONS[k];
  return Icon ? <Icon size={size} color={color} className="bkp-svg-icon" /> : null;
}

function fmt(n) { return (n || 0).toLocaleString("vi-VN") + "₫"; }

function fmtDate(s) {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d) ? s : d.toLocaleDateString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" });
}

// ── Info row ─────────────────────────────────────────────────────────
function InfoRow({ icon, label, value, valueColor }) {
  return (
    <div className="bkp-info-row">
      <div className="bkp-info-row-icon">
        <SvgIcon k={icon} size={16} color={C.primary} />
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
          {icon && <SvgIcon k={icon} size={18} color={C.primary} />}
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const effectiveParams = useMemo(() => getEffectiveParams(params), []);
  const { hotelId, hotelName, rooms = [], checkin, checkout, guests = 1, nights = 1, cancellationPolicy = "MODERATE" } = effectiveParams;

  const [contact, setContact]           = useState({ fullName: "", email: user?.email || "", phone: "" });
  const [error, setError]               = useState("");
  const [focusField, setFocusField]     = useState(null);
  const [strictAcknowledged, setStrictAcknowledged] = useState(false);

  const createBooking = useCreateBooking();

  const upd = k => e => setContact(p => ({ ...p, [k]: e.target.value }));

  const total = rooms.reduce((s, r) => s + (r.price || 0) * (r.quantity || 1) * nights, 0);
  // Tổng sức chứa các phòng đã chọn — dùng để chặn khi số khách vượt quá.
  const totalCapacity = rooms.reduce((s, r) => s + (r.capacity || 0) * (r.quantity || 1), 0);

  const hasContact = contact.fullName.trim() && contact.email.trim() && contact.phone.trim();

  const handleConfirm = async () => {
    if (!hasContact)     { setError(t("booking_err_contact")); return; }
    if (rooms.length === 0) { setError(t("booking_err_no_rooms")); return; }
    if (totalCapacity > 0 && guests > totalCapacity) { setError(t("booking_err_capacity")); return; }
    if (cancellationPolicy === "STRICT" && !strictAcknowledged) {
      setError(t("booking_strict_ack_required")); return;
    }
    setError("");
    createBooking.mutate(
      {
        checkIn:  checkin,
        checkOut: checkout,
        rooms:    rooms.map(r => ({ roomTypeId: r.id, quantity: r.quantity || 1 })),
        contact:  { fullName: contact.fullName, email: contact.email, phone: contact.phone },
        guests,
      },
      {
        onSuccess: (res) => {
          try { sessionStorage.removeItem(SESSION_KEY); } catch { /* storage unavailable */ }
          navigate("booking-detail", { bookingId: res.bookingId, hotelName });
        },
        onError:   (err) => setError(err.message || t("booking_err_failed")),
      }
    );
  };
  const loading = createBooking.isPending;

  const inp = focused => ({
    border: `1.5px solid ${focused ? C.primary: "#e8e8e8"}`,
    background: focused ? "#fff" : "#fafafa",
  });

  if (!user) {
    return (
      <div className="bkp-root">
        <MainNavbar active="search" navigate={navigate} user={user} onLogout={onLogout} />
        <div className="bkp-login-center">
          <div className="bkp-login-content">
            <div className="bkp-login-avatar">
              <SvgIcon k="person" size={32} color={C.primary} />
            </div>
            <p className="bkp-login-text">{t("booking_login_msg")}</p>
            <ActionBtn onClick={() => navigate("login")} style={{ padding: "12px 36px" }}>{t("booking_login_btn")}</ActionBtn>
          </div>
        </div>
      </div>
    );
  }

  if (!hotelId || rooms.length === 0) {
    return (
      <div className="bkp-root">
        <MainNavbar active="search" navigate={navigate} user={user} onLogout={onLogout} />
        <div className="bkp-login-center">
          <div className="bkp-login-content">
            <div className="bkp-login-avatar">
              <SvgIcon k="info" size={32} color={C.primary} />
            </div>
            <p className="bkp-login-text">{t("booking_err_expired")}</p>
            <ActionBtn
              onClick={() => hotelId ? navigate("hotel", { hotelId }) : navigate("home")}
              style={{ padding: "12px 36px" }}
            >
              {t("booking_back_select")}
            </ActionBtn>
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
          <BookingStepper current={1} />
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
            {rooms.map((r, i) => (
              <div key={r.id ?? i} className="bkp-room-name" style={{ marginBottom: 2 }}>
                {r.name}{r.quantity > 1 ? ` × ${r.quantity}` : ""}
              </div>
            ))}

            <InfoRow icon="calendar" label={t("booking_checkin_full")} value={fmtDate(checkin)} />
            <InfoRow icon="calendar" label={t("booking_checkout_full")} value={fmtDate(checkout)} />
            <InfoRow icon="moon"     label={t("booking_duration")} value={`${nights}${t("night")}`} />
            <InfoRow icon="people"   label={t("booking_guests")}   value={`${guests}${t("guests")}`} />
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
          {(() => {
            const pKey = (cancellationPolicy || "MODERATE").toUpperCase();
            const cfg  = POLICY_CFG[pKey] || POLICY_CFG.MODERATE;
            const PolicyIcon = cfg.Icon;
            return (
              <Card>
                <div
                  className="bkp-policy-box"
                  style={{ background: cfg.bg, border: `1.5px solid ${cfg.border}`, borderRadius: 12, padding: "14px 16px" }}
                >
                  <div className="bkp-policy-row" style={{ marginBottom: 6 }}>
                    <PolicyIcon size={18} color={cfg.color} style={{ flexShrink: 0 }} />
                    <div className="bkp-policy-title" style={{ color: cfg.color }}>
                      {t(`booking_cancel_policy_title_${cancellationPolicy.toLowerCase()}`)}
                    </div>
                  </div>
                  <div className="bkp-policy-text" style={{ marginBottom: 14 }}>
                    {t(`booking_cancel_policy_text_${cancellationPolicy.toLowerCase()}`)}
                  </div>
                  <CancellationPolicyInfo policy={cancellationPolicy} checkIn={checkin} total={total} />
                  {pKey === "STRICT" && (
                    <label className="bkp-strict-ack">
                      <input
                        type="checkbox"
                        checked={strictAcknowledged}
                        onChange={e => { setStrictAcknowledged(e.target.checked); setError(""); }}
                        style={{ width: 16, height: 16, accentColor: cfg.color, flexShrink: 0, marginTop: 1 }}
                      />
                      <span style={{ fontSize: 13, color: "#374151", lineHeight: 1.5 }}>
                        {t("booking_strict_ack")}
                      </span>
                    </label>
                  )}
                </div>
              </Card>
            );
          })()}
        </div>

        {/* ── RIGHT — sticky ── */}
        <div className="bkp-right">
          {/* Price breakdown */}
          <div className="bkp-price-box">
            <h3 className="bkp-price-title">{t("booking_price_title")}</h3>

            {total > 0 ? (
              <>
                {rooms.map((r, i) => (
                  <div key={r.id ?? i} className="bkp-price-row">
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginRight: 8 }}>
                      {r.name}{r.quantity > 1 ? ` × ${r.quantity}` : ""} × {nights}{t("night")}
                    </span>
                    <span className="bkp-price-row-val">{fmt((r.price || 0) * (r.quantity || 1) * nights)}</span>
                  </div>
                ))}
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

          <p className="bkp-terms">{t("booking_terms_agree")}</p>
        </div>
      </div>

      <Footer navigate={navigate} />
    </div>
  );
}
