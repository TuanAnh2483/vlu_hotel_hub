import { useState } from "react";
import { C } from "../lib/constants";
import MainNavbar from "../components/MainNavbar";
import Footer from "../components/Footer";
import { useStartOnboarding, useSubmitOnboarding, useMyApplication } from "../hooks/usePartnerQueries";
import { useAuth } from "../contexts/AuthContext";
import { useLang } from "../contexts/LanguageContext";
import { Building2, BarChart3, Globe, CircleDollarSign, ShieldCheck, CheckCircle2, XCircle, Clock } from "lucide-react";
import "../styles/pages/BecomePartnerPage.css";

const APP_ID_KEY = "partner_application_id";

const APP_STATUS_CFG = {
  SUBMITTED:    { label: "Đã nộp đơn",      color: "#f59e0b", bg: "#fffbeb", step: 1 },
  UNDER_REVIEW: { label: "Đang xét duyệt",  color: "#3b82f6", bg: "#eff6ff", step: 2 },
  APPROVED:     { label: "Đã được duyệt",   color: "#10b981", bg: "#ecfdf5", step: 3 },
  REJECTED:     { label: "Bị từ chối",      color: "#ef4444", bg: "#fef2f2", step: 3 },
};

function StepIndicator({ current }) {
  const { t } = useLang();
  const steps = [t("bp_step_info"), t("bp_step_confirm"), t("bp_step_done")];
  return (
    <div className="bp-stepper">
      {steps.map((label, i) => {
        const done   = i < current;
        const active = i === current;
        return (
          <div key={i} className="bp-step">
            <div className="bp-step-col">
              <div
                className="bp-step-circle"
                style={{
                  background: done || active ? C.primary : "#e5e7eb",
                  color: done || active ? "#fff" : "#9ca3af",
                }}
              >
                {done ? "✓" : i + 1}
              </div>
              <span
                className="bp-step-label"
                style={{
                  fontWeight: active ? 700 : 400,
                  color: active ? C.primary : done ? "#374151" : "#9ca3af",
                }}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className="bp-step-connector"
                style={{ background: done ? C.primary : "#e5e7eb" }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function Field({ label, required, children, hint, error }) {
  return (
    <div className="bp-field">
      <label className="bp-field-label">{label}{required && " *"}</label>
      {children}
      {error && <div className="bp-field-error">{error}</div>}
      {hint && !error && <div className="bp-field-hint">{hint}</div>}
    </div>
  );
}

export default function BecomePartnerPage({ navigate, user, onLogout }) {
  const { t } = useLang();
  const { refreshUser, logout } = useAuth();
  const savedAppId = localStorage.getItem(APP_ID_KEY);

  const [step, setStep]   = useState(savedAppId ? 2 : 0);
  const [form, setForm]   = useState({ businessName: "", email: user?.email || "", phone: "", taxCode: "", propertyType: "" });
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [appId, setAppId] = useState(savedAppId);
  const [refreshing, setRefreshing] = useState(false);

  const startOnboarding  = useStartOnboarding();
  const submitOnboarding = useSubmitOnboarding();
  const { data: application, refetch: refetchApp } = useMyApplication({ enabled: Boolean(savedAppId || appId) });
  const loading = startOnboarding.isPending || submitOnboarding.isPending;

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function validateField(key, value) {
    const v = typeof value === "string" ? value.trim() : value;
    switch (key) {
      case "businessName":
        if (!v) return t("bp_err_biz_name_required");
        if (v.length < 2) return t("bp_err_biz_name_min");
        if (v.length > 100) return t("bp_err_biz_name_max");
        return "";
      case "email":
        if (!v) return t("bp_err_email_required");
        if (!EMAIL_RE.test(v)) return t("bp_err_email_invalid");
        return "";
      case "phone":
        if (!v) return t("bp_err_phone_required");
        if (!/^\d+$/.test(v)) return t("bp_err_phone_digits");
        if (!/^0\d{9}$/.test(v)) return t("bp_err_phone_format");
        return "";
      case "taxCode":
        if (!v) return t("bp_err_tax_code_required");
        if (!/^\d{10}$/.test(v)) return t("bp_err_tax_code");
        return "";
      case "propertyType":
        if (!v) return t("bp_err_property_type");
        return "";
      default:
        return "";
    }
  }

  function validateAll() {
    const errs = {};
    for (const key of Object.keys(form)) {
      const msg = validateField(key, form[key]);
      if (msg) errs[key] = msg;
    }
    setFieldErrors(errs);
    setTouched({ businessName: true, email: true, phone: true, taxCode: true, propertyType: true });
    return Object.keys(errs).length === 0;
  }

  const upd = k => e => {
    const val = e.target.value;
    setForm(f => ({ ...f, [k]: val }));
    if (touched[k]) {
      setFieldErrors(prev => {
        const msg = validateField(k, val);
        if (msg) return { ...prev, [k]: msg };
        const { [k]: _, ...rest } = prev;
        return rest;
      });
    }
  };

  const onBlur = k => () => {
    setTouched(prev => ({ ...prev, [k]: true }));
    const msg = validateField(k, form[k]);
    setFieldErrors(prev => {
      if (msg) return { ...prev, [k]: msg };
      const { [k]: _, ...rest } = prev;
      return rest;
    });
  };

  const onPhoneInput = e => {
    const raw = e.target.value.replace(/\D/g, "");
    setForm(f => ({ ...f, phone: raw }));
    if (touched.phone) {
      const msg = validateField("phone", raw);
      setFieldErrors(prev => {
        if (msg) return { ...prev, phone: msg };
        const { phone: _, ...rest } = prev;
        return rest;
      });
    }
  };

  const onTaxCodeInput = e => {
    const raw = e.target.value.replace(/\D/g, "");
    setForm(f => ({ ...f, taxCode: raw }));
    if (touched.taxCode) {
      const msg = validateField("taxCode", raw);
      setFieldErrors(prev => {
        if (msg) return { ...prev, taxCode: msg };
        const { taxCode: _, ...rest } = prev;
        return rest;
      });
    }
  };

  async function handleRefreshStatus() {
    setRefreshing(true);
    try {
      await refetchApp();
      const freshUser = await refreshUser();
      if (freshUser?.userType === "PARTNER") {
        navigate("partner-dashboard");
      }
    } catch {}
    finally { setRefreshing(false); }
  }

  if (!user) {
    return (
      <div className="bp-root-auth">
        <MainNavbar active="become-partner" navigate={navigate} user={user} onLogout={onLogout} />
        <div className="bp-login-gate">
          <div className="bp-login-icon"><Building2 size={48} color="#BE1E2E" aria-hidden="true" /></div>
          <h2 className="bp-login-title">{t("bp_login_title")}</h2>
          <p className="bp-login-desc">{t("bp_login_desc")}</p>
          <button className="bp-login-btn" onClick={() => navigate("login")}>{t("bp_login_btn")}</button>
        </div>
      </div>
    );
  }

  function handleStartAndSubmit() {
    setError("");
    if (!validateAll()) return;
    startOnboarding.mutate(
      { businessName: form.businessName, email: form.email, phone: form.phone, taxCode: form.taxCode, propertyType: form.propertyType },
      {
        onSuccess: (app) => {
          const id = app.applicationId || app.id;
          submitOnboarding.mutate(id, {
            onSuccess: () => {
              localStorage.setItem(APP_ID_KEY, id);
              setAppId(id);
              setStep(2);
            },
            onError: (e) => setError(e.message),
          });
        },
        onError: (e) => setError(e.message),
      },
    );
  }

  const benefits = [
    { Icon: BarChart3,       tkey_title: "bp_benefit_1_title", tkey_desc: "bp_benefit_1_desc" },
    { Icon: Globe,           tkey_title: "bp_benefit_2_title", tkey_desc: "bp_benefit_2_desc" },
    { Icon: CircleDollarSign,tkey_title: "bp_benefit_3_title", tkey_desc: "bp_benefit_3_desc" },
    { Icon: ShieldCheck,     tkey_title: "bp_benefit_4_title", tkey_desc: "bp_benefit_4_desc" },
  ];

  return (
    <div className="bp-root">
      <MainNavbar active="become-partner" navigate={navigate} user={user} onLogout={onLogout} />

      {/* Hero */}
      <div className="bp-hero">
        <div className="bp-hero-icon"><Building2 size={56} color="#BE1E2E" aria-hidden="true" /></div>
        <h1 className="bp-hero-title">{t("bp_hero_title")}</h1>
        <p className="bp-hero-subtitle">{t("bp_hero_sub")}</p>
      </div>

      <div className="bp-content">
        <StepIndicator current={step} />

        {/* Step 0 — Fill form */}
        {step === 0 && (
          <div className="bp-card">
            <h2 className="bp-card-title">{t("bp_info_title")}</h2>
            <p className="bp-card-subtitle">{t("bp_info_sub")}</p>

            <Field label={t("bp_biz_name")} required hint={t("bp_biz_name_hint")} error={touched.businessName && fieldErrors.businessName}>
              <input
                className={`bp-input${touched.businessName && fieldErrors.businessName ? " bp-input-error" : ""}`}
                value={form.businessName}
                onChange={upd("businessName")}
                onBlur={onBlur("businessName")}
                placeholder={t("bp_biz_name_ph")}
                maxLength={100}
              />
            </Field>

            <Field label={t("bp_email")} required hint={t("bp_email_hint")} error={touched.email && fieldErrors.email}>
              <input
                className={`bp-input${touched.email && fieldErrors.email ? " bp-input-error" : ""}`}
                type="email"
                value={form.email}
                onChange={upd("email")}
                onBlur={onBlur("email")}
                placeholder="business@example.com"
              />
            </Field>

            <Field label={t("bp_phone")} required hint={t("bp_phone_hint")} error={touched.phone && fieldErrors.phone}>
              <input
                className={`bp-input${touched.phone && fieldErrors.phone ? " bp-input-error" : ""}`}
                value={form.phone}
                onChange={onPhoneInput}
                onBlur={onBlur("phone")}
                placeholder={t("bp_phone_ph")}
                maxLength={10}
                inputMode="numeric"
              />
            </Field>

            <Field label={t("bp_tax_code")} required hint={t("bp_tax_code_hint")} error={touched.taxCode && fieldErrors.taxCode}>
              <input
                className={`bp-input${touched.taxCode && fieldErrors.taxCode ? " bp-input-error" : ""}`}
                value={form.taxCode}
                onChange={onTaxCodeInput}
                onBlur={onBlur("taxCode")}
                placeholder={t("bp_tax_code_ph")}
                maxLength={10}
                inputMode="numeric"
              />
            </Field>

            <Field label={t("bp_property_type")} required hint={t("bp_property_type_hint")} error={touched.propertyType && fieldErrors.propertyType}>
              <select
                className={`bp-input${touched.propertyType && fieldErrors.propertyType ? " bp-input-error" : ""}`}
                value={form.propertyType}
                onChange={upd("propertyType")}
                onBlur={onBlur("propertyType")}
              >
                <option value="">{t("bp_property_type_ph")}</option>
                {["HOTEL","APARTMENT","RESORT","VILLA","HOMESTAY","HOSTEL","GUEST_HOUSE"].map(pt => (
                  <option key={pt} value={pt}>{t(`bp_pt_${pt}`)}</option>
                ))}
              </select>
            </Field>

            {error && <div className="bp-error-alert">{error}</div>}

            <div className="bp-form-actions">
              <button className="bp-back-btn" onClick={() => navigate("home")}>{t("bp_back")}</button>
              <button
                className="bp-next-btn"
                onClick={() => {
                  if (!validateAll()) {
                    setError(t("bp_err_required"));
                    return;
                  }
                  setError("");
                  setStep(1);
                }}
              >
                {t("bp_next")}
              </button>
            </div>
          </div>
        )}

        {/* Step 1 — Confirm */}
        {step === 1 && (
          <div className="bp-card">
            <h2 className="bp-card-title">{t("bp_confirm_title")}</h2>
            <p className="bp-card-subtitle">{t("bp_confirm_sub")}</p>

            {[
              { label: t("bp_field_biz_name"),       value: form.businessName },
              { label: t("bp_field_email"),           value: form.email },
              { label: t("bp_field_phone"),           value: form.phone },
              { label: t("bp_field_tax_code"),        value: form.taxCode },
              { label: t("bp_field_property_type"),   value: t(`bp_pt_${form.propertyType}`) },
            ].map(({ label, value }) => (
              <div key={label} className="bp-review-row">
                <span className="bp-review-key">{label}</span>
                <span className="bp-review-val">{value}</span>
              </div>
            ))}

            <div className="bp-success-note">{t("bp_review_note")}</div>

            {error && (
              <div className="bp-error-alert" style={{ marginTop: 16, marginBottom: 0 }}>{error}</div>
            )}

            <div className="bp-confirm-actions">
              <button className="bp-edit-btn" onClick={() => { setStep(0); setError(""); }}>{t("bp_edit")}</button>
              <button
                className="bp-submit-btn"
                onClick={handleStartAndSubmit}
                disabled={loading}
                style={{ background: loading ? "#ccc" : C.primary, cursor: loading ? "not-allowed" : "pointer" }}
              >
                {loading ? t("bp_submitting") : t("bp_submit")}
              </button>
            </div>
          </div>
        )}

        {/* Step 2 — Application status tracker */}
        {step === 2 && (() => {
          const status   = application?.status;
          const cfg      = APP_STATUS_CFG[status] || APP_STATUS_CFG.SUBMITTED;
          const isApproved  = status === "APPROVED";
          const isRejected  = status === "REJECTED";
          const needsRelogin = isApproved && user?.userType === "CUSTOMER";

          const TIMELINE = [
            { label: "Đã nộp đơn",     done: true },
            { label: "Đang xét duyệt", done: cfg.step >= 2 },
            { label: isRejected ? "Bị từ chối" : "Được duyệt", done: cfg.step >= 3, rejected: isRejected },
          ];

          return (
            <div className="bp-card">
              <div className="bp-success-icon">
                {isApproved ? <CheckCircle2 size={48} color="#059669" aria-hidden="true" /> : isRejected ? <XCircle size={48} color="#ef4444" aria-hidden="true" /> : <Clock size={48} color="#f59e0b" aria-hidden="true" />}
              </div>
              <h2 className="bp-success-title" style={{ color: isRejected ? "#ef4444" : "#111827" }}>
                {isApproved ? "Đơn đăng ký được duyệt!" : isRejected ? "Đơn bị từ chối" : "Đơn đang được xét duyệt"}
              </h2>

              {/* Status badge */}
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: cfg.bg, color: cfg.color, borderRadius: 20, fontSize: 13, fontWeight: 700, padding: "6px 14px", marginBottom: 20 }}>
                {cfg.label}
              </div>

              {/* Re-login banner */}
              {needsRelogin && (
                <div style={{ background: "#ecfdf5", border: "1px solid #bbf7d0", borderRadius: 12, padding: "14px 16px", marginBottom: 20, textAlign: "left" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#047857", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                    <CheckCircle2 size={16} aria-hidden="true" /> Tài khoản đã được nâng cấp lên Partner
                  </div>
                  <div style={{ fontSize: 13, color: "#065f46", marginBottom: 12 }}>
                    Vui lòng đăng xuất và đăng nhập lại để truy cập Partner Portal.
                  </div>
                  <button
                    onClick={async () => { localStorage.removeItem(APP_ID_KEY); await logout(); navigate("login"); }}
                    style={{ background: "#10b981", border: "none", borderRadius: 10, color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 800, padding: "10px 20px" }}
                  >
                    Đăng xuất & Đăng nhập lại
                  </button>
                </div>
              )}

              {/* Rejection reason */}
              {isRejected && application?.rejectionReason && (
                <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, color: "#b91c1c", fontSize: 13, padding: "12px 16px", marginBottom: 20, textAlign: "left" }}>
                  <strong>Lý do: </strong>{application.rejectionReason}
                </div>
              )}

              {/* Timeline */}
              <div style={{ display: "flex", flexDirection: "column", gap: 0, marginBottom: 24, textAlign: "left" }}>
                {TIMELINE.map((step, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <div style={{ width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, flexShrink: 0, background: step.done ? (step.rejected ? "#ef4444" : "#10b981") : "#e5e7eb", color: step.done ? "#fff" : "#9ca3af" }}>
                        {step.done ? (step.rejected ? "✕" : "✓") : (i + 1)}
                      </div>
                      {i < TIMELINE.length - 1 && (
                        <div style={{ width: 2, height: 28, background: TIMELINE[i + 1].done ? "#10b981" : "#e5e7eb" }} />
                      )}
                    </div>
                    <div style={{ paddingTop: 3, paddingBottom: i < TIMELINE.length - 1 ? 28 : 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: step.done ? "#111827" : "#9ca3af" }}>{step.label}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bp-success-id-box">
                <div className="bp-success-id-label">{t("bp_app_id_lbl")}</div>
                <div className="bp-success-id-val">#{appId || application?.id || "—"}</div>
              </div>

              {!isApproved && !isRejected && (
                <button
                  onClick={handleRefreshStatus}
                  disabled={refreshing}
                  style={{ background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 10, color: "#475569", cursor: refreshing ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 700, marginTop: 14, opacity: refreshing ? 0.6 : 1, padding: "10px 20px", width: "100%" }}
                >
                  {refreshing ? "Đang làm mới..." : "🔄 Làm mới trạng thái"}
                </button>
              )}

              {isRejected && (
                <button
                  onClick={() => { localStorage.removeItem(APP_ID_KEY); setAppId(null); setStep(0); setForm({ businessName: "", email: user?.email || "", phone: "", taxCode: "", propertyType: "" }); }}
                  style={{ background: C.primary, border: "none", borderRadius: 10, color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 800, marginTop: 14, padding: "10px 20px", width: "100%" }}
                >
                  Nộp đơn lại
                </button>
              )}

              <button className="bp-home-btn" style={{ marginTop: 10 }} onClick={() => navigate("home")}>{t("bp_home_btn")}</button>
            </div>
          );
        })()}

        {/* Benefits */}
        {step === 0 && (
          <div className="bp-benefits">
            <h3 className="bp-benefits-title">{t("bp_benefits_title")}</h3>
            <div className="bp-benefits-grid">
              {benefits.map(b => (
                <div key={b.tkey_title} className="bp-benefit-card">
                  <div className="bp-benefit-icon"><b.Icon size={28} color="#BE1E2E" aria-hidden="true" /></div>
                  <div className="bp-benefit-title">{t(b.tkey_title)}</div>
                  <div className="bp-benefit-desc">{t(b.tkey_desc)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <Footer navigate={navigate} />
    </div>
  );
}
