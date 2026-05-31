import { useState } from "react";
import { C } from "../lib/constants";
import MainNavbar from "../components/MainNavbar";
import Footer from "../components/Footer";
import { useStartOnboarding, useSubmitOnboarding } from "../hooks/usePartnerQueries";
import { useLang } from "../contexts/LanguageContext";
import "../styles/pages/BecomePartnerPage.css";

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

function Field({ label, required, children, hint }) {
  return (
    <div className="bp-field">
      <label className="bp-field-label">{label}{required && " *"}</label>
      {children}
      {hint && <div className="bp-field-hint">{hint}</div>}
    </div>
  );
}

export default function BecomePartnerPage({ navigate, user, onLogout }) {
  const { t } = useLang();
  const [step, setStep]   = useState(0);
  const [form, setForm]   = useState({ businessName: "", email: user?.email || "", phone: "", taxCode: "", propertyType: "" });
  const [error, setError] = useState("");
  const [appId, setAppId] = useState(null);

  const startOnboarding  = useStartOnboarding();
  const submitOnboarding = useSubmitOnboarding();
  const loading = startOnboarding.isPending || submitOnboarding.isPending;

  const upd = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  if (!user) {
    return (
      <div className="bp-root-auth">
        <MainNavbar active="become-partner" navigate={navigate} user={user} onLogout={onLogout} />
        <div className="bp-login-gate">
          <div className="bp-login-icon">🏨</div>
          <h2 className="bp-login-title">{t("bp_login_title")}</h2>
          <p className="bp-login-desc">{t("bp_login_desc")}</p>
          <button className="bp-login-btn" onClick={() => navigate("login")}>{t("bp_login_btn")}</button>
        </div>
      </div>
    );
  }

  function handleStartAndSubmit() {
    setError("");
    if (!form.businessName.trim() || !form.email.trim() || !form.phone.trim() || !form.taxCode.trim() || !form.propertyType) {
      setError(t("bp_err_required"));
      return;
    }
    if (form.phone.length < 8 || form.phone.length > 10) {
      setError(t("bp_err_phone"));
      return;
    }
    if (!/^\d{10}$/.test(form.taxCode)) {
      setError(t("bp_err_tax_code"));
      return;
    }
    startOnboarding.mutate(
      { businessName: form.businessName, email: form.email, phone: form.phone, taxCode: form.taxCode, propertyType: form.propertyType },
      {
        onSuccess: (app) => {
          const id = app.applicationId || app.id;
          submitOnboarding.mutate(id, {
            onSuccess: () => { setAppId(id); setStep(2); },
            onError: (e) => setError(e.message),
          });
        },
        onError: (e) => setError(e.message),
      },
    );
  }

  const benefits = [
    { icon: "📊", tkey_title: "bp_benefit_1_title", tkey_desc: "bp_benefit_1_desc" },
    { icon: "🌐", tkey_title: "bp_benefit_2_title", tkey_desc: "bp_benefit_2_desc" },
    { icon: "💰", tkey_title: "bp_benefit_3_title", tkey_desc: "bp_benefit_3_desc" },
    { icon: "🛡️", tkey_title: "bp_benefit_4_title", tkey_desc: "bp_benefit_4_desc" },
  ];

  return (
    <div className="bp-root">
      <MainNavbar active="become-partner" navigate={navigate} user={user} onLogout={onLogout} />

      {/* Hero */}
      <div className="bp-hero">
        <div className="bp-hero-icon">🏨</div>
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

            <Field label={t("bp_biz_name")} required hint={t("bp_biz_name_hint")}>
              <input className="bp-input" value={form.businessName} onChange={upd("businessName")} placeholder={t("bp_biz_name_ph")} />
            </Field>

            <Field label={t("bp_email")} required hint={t("bp_email_hint")}>
              <input className="bp-input" type="email" value={form.email} onChange={upd("email")} placeholder="business@example.com" />
            </Field>

            <Field label={t("bp_phone")} required hint={t("bp_phone_hint")}>
              <input className="bp-input" value={form.phone} onChange={upd("phone")} placeholder={t("bp_phone_ph")} maxLength={10} />
            </Field>

            <Field label={t("bp_tax_code")} required hint={t("bp_tax_code_hint")}>
              <input className="bp-input" value={form.taxCode} onChange={upd("taxCode")} placeholder={t("bp_tax_code_ph")} maxLength={10} />
            </Field>

            <Field label={t("bp_property_type")} required hint={t("bp_property_type_hint")}>
              <select className="bp-input" value={form.propertyType} onChange={upd("propertyType")}>
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
                  if (!form.businessName.trim() || !form.email.trim() || !form.phone.trim() || !form.taxCode.trim() || !form.propertyType) {
                    setError(t("bp_err_required"));
                    return;
                  }
                  if (form.phone.length < 8 || form.phone.length > 10) {
                    setError(t("bp_err_phone"));
                    return;
                  }
                  if (!/^\d{10}$/.test(form.taxCode)) {
                    setError(t("bp_err_tax_code"));
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

        {/* Step 2 — Success */}
        {step === 2 && (
          <div className="bp-card bp-card-success">
            <div className="bp-success-icon">🎉</div>
            <h2 className="bp-success-title">{t("bp_success_title")}</h2>
            <p className="bp-success-desc">
              {t("bp_success_desc")} <strong style={{ color: "#1a1a1a" }}>{form.email}</strong>
            </p>

            <div className="bp-success-id-box">
              <div className="bp-success-id-label">{t("bp_app_id_lbl")}</div>
              <div className="bp-success-id-val">#{appId || "—"}</div>
            </div>

            <button className="bp-home-btn" onClick={() => navigate("home")}>{t("bp_home_btn")}</button>
          </div>
        )}

        {/* Benefits */}
        {step === 0 && (
          <div className="bp-benefits">
            <h3 className="bp-benefits-title">{t("bp_benefits_title")}</h3>
            <div className="bp-benefits-grid">
              {benefits.map(b => (
                <div key={b.tkey_title} className="bp-benefit-card">
                  <div className="bp-benefit-icon">{b.icon}</div>
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
