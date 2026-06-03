import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { C, S, SubmitButton, ImgSide } from "../components/auth/AuthShared";
import { useResetPassword } from "../hooks/useAuthMutations";
import { useLang } from "../contexts/LanguageContext";

export default function ResetPasswordPage({ setPage }) {
  const { t } = useLang();
  const [sp] = useSearchParams();
  const token = sp.get("token") || "";

  const [form, setForm]   = useState({ password: "", confirm: "" });
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const resetMutation = useResetPassword();

  const upd = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const resetErrorMessage = (message = "") => {
    if (
      message.includes("Reset token") ||
      message.includes("Liên kết đặt lại mật khẩu")
    ) {
      return t("reset_err_token");
    }
    return message || t("reset_err_generic");
  };

  const handleReset = () => {
    setError("");
    if (!form.password || form.password.length < 8) { setError(t("reset_err_min")); return; }
    if (!/(?=.*[A-Za-z])(?=.*\d)/.test(form.password)) { setError(t("reset_err_format")); return; }
    if (form.password !== form.confirm) { setError(t("reset_err_cf")); return; }
    if (!token) { setError(t("reset_err_no_token")); return; }

    resetMutation.mutate(
      { token, newPassword: form.password, confirmPassword: form.confirm },
      {
        onSuccess: () => setSuccess(true),
        onError: (err) => setError(resetErrorMessage(err.message)),
      },
    );
  };

  const inp = {
    width: "100%", padding: "11px 14px", border: "1.5px solid #ddd", borderRadius: 9,
    fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit",
    transition: "border-color 0.2s",
  };
  const lbl = { fontSize: 13, fontWeight: 600, color: "#444", display: "block", marginBottom: 6 };

  if (!token) {
    return (
      <div style={S.authWrap}>
        <ImgSide />
        <div style={S.formSide}>
          <div style={S.formBox}>
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: "#1a1a1a", marginBottom: 8 }}>{t("reset_invalid_title")}</h2>
              <p style={{ fontSize: 14, color: "#888", marginBottom: 24 }}>{t("reset_invalid_desc")}</p>
              <button
                onClick={() => setPage("forgot")}
                style={{ background: C.primary, color: "#fff", border: "none", borderRadius: 9, padding: "11px 28px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
              >
                {t("reset_request_new")}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div style={S.authWrap}>
        <ImgSide />
        <div style={S.formSide}>
          <div style={S.formBox}>
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <CheckCircle2 size={48} color="#2e7d32" style={{ marginBottom: 16 }} aria-hidden="true" />
              <h2 style={{ fontSize: 20, fontWeight: 700, color: "#1a1a1a", marginBottom: 8 }}>{t("reset_success_title")}</h2>
              <p style={{ fontSize: 14, color: "#888", lineHeight: 1.6, marginBottom: 28 }}>{t("reset_success_desc")}</p>
              <button
                onClick={() => setPage("login")}
                style={{ background: C.primary, color: "#fff", border: "none", borderRadius: 9, padding: "12px 36px", fontSize: 15, fontWeight: 800, cursor: "pointer" }}
              >
                {t("reset_login_now")}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={S.authWrap}>
      <ImgSide />
      <div style={S.formSide}>
        <div style={S.formBox}>
          <h1 style={S.title}>{t("reset_title")}</h1>
          <p style={S.sub}>{t("reset_sub")}</p>

          <div style={{ marginBottom: 18 }}>
            <label style={lbl}>{t("reset_new_pw")}</label>
            <input
              style={inp}
              type="password"
              placeholder={t("reset_pw_ph")}
              value={form.password}
              onChange={upd("password")}
              onFocus={e => (e.target.style.borderColor = C.primary)}
              onBlur={e => (e.target.style.borderColor = "#ddd")}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={lbl}>{t("reset_cf_pw")}</label>
            <input
              style={inp}
              type="password"
              placeholder={t("reset_cf_ph")}
              value={form.confirm}
              onChange={upd("confirm")}
              onFocus={e => (e.target.style.borderColor = C.primary)}
              onBlur={e => (e.target.style.borderColor = "#ddd")}
            />
          </div>

          {error && (
            <div style={{ background: "#fff5f5", border: "1px solid #ffcdd2", borderRadius: 8, padding: "10px 14px", color: C.primary, fontSize: 13, marginBottom: 18 }}>
              {error}
            </div>
          )}

          <SubmitButton
            label={resetMutation.isPending ? t("reset_loading") : t("reset_submit")}
            onClick={handleReset}
            disabled={resetMutation.isPending}
          />

          <div style={{ textAlign: "center", marginTop: 18, fontSize: 13, color: "#888" }}>
            {t("reset_remember")}{" "}
            <button
              onClick={() => setPage("login")}
              style={{ background: "none", border: "none", color: C.primary, fontWeight: 700, cursor: "pointer", padding: 0, fontSize: 13 }}
            >
              {t("reset_login_link")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
