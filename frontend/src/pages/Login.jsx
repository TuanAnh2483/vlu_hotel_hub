import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { C, S, EyeOpen, EyeOff, SubmitButton, ImgSide } from "../components/auth/AuthShared";
import { useLogin, useGoogleLogin } from "../hooks/useAuthMutations";
import { useLang } from "../contexts/LanguageContext";

const errStyle = { color: C.primary, fontSize: 12, margin: "4px 0 0" };
const inputErr = { border: "1.5px solid #BE1E2E", background: "#fff5f5" };

const Login = ({ setPage, onSuccess }) => {
  const { t } = useLang();
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(false);
  const [serverError, setServerError] = useState("");
  const googleButtonRef = useRef(null);
  const googleInitializedRef = useRef(false);

  const schema = z.object({
    email: z.string()
      .min(1, t("login_err_email_required"))
      .email(t("login_err_email_invalid")),
    pw: z.string().min(1, t("login_err_pw_required")),
  });

  const {
    register,
    handleSubmit,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    mode: "onBlur",
  });

  const loginMutation = useLogin();
  const googleLoginMutation = useGoogleLogin();
  const loading = loginMutation.isPending || googleLoginMutation.isPending || isSubmitting;

  const onSubmit = (data) => {
    setServerError("");
    loginMutation.mutate({ email: data.email, password: data.pw }, {
      onSuccess: (res) => { if (onSuccess) onSuccess(res.user, res.accessToken); },
      onError: (err) => setServerError(err.message),
    });
  };

  const onValidationError = (errs) => {
    const first = Object.keys(errs)[0];
    if (first) setFocus(first);
  };

  const handleGoogleLogin = (credential) => {
    setServerError("");
    googleLoginMutation.mutate({ credential }, {
      onSuccess: (res) => { if (onSuccess) onSuccess(res.user, res.accessToken); },
      onError: (err) => setServerError(err.message),
    });
  };

  useEffect(() => {
    if (googleInitializedRef.current || !window.google || !googleButtonRef.current) return;
    googleInitializedRef.current = true;
    window.google.accounts.id.initialize({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      callback: (response) => handleGoogleLogin(response.credential),
    });
    window.google.accounts.id.renderButton(googleButtonRef.current, {
      theme: "outline", size: "large", width: 260, text: "signin_with",
    });
  }, []);

  return (
    <div style={S.authWrap}>
      <ImgSide />
      <div style={S.formSide}>
        <form style={S.formBox} onSubmit={handleSubmit(onSubmit, onValidationError)} noValidate>
          <h1 style={S.title}>{t("login_title")}</h1>
          <p style={S.sub}>{t("login_sub")}</p>

          <div style={S.fg}>
            <label style={S.label}>{t("auth_email")}</label>
            <input
              {...register("email")}
              style={{ ...S.input, ...(errors.email ? inputErr : {}) }}
              type="email"
              placeholder="concierge@luminous.com"
              autoComplete="email"
            />
            {errors.email && <p style={errStyle}>{errors.email.message}</p>}
          </div>

          <div style={{ ...S.fg, marginBottom: 10 }}>
            <label style={S.label}>{t("auth_password")}</label>
            <div style={S.inputWrap}>
              <input
                {...register("pw")}
                style={{ ...S.input, ...(errors.pw ? inputErr : {}) }}
                type={showPw ? "text" : "password"}
                placeholder={t("auth_password_ph")}
                autoComplete="current-password"
              />
              <button type="button" style={S.eyeBtn} onClick={() => setShowPw(!showPw)}>
                {showPw ? <EyeOff /> : <EyeOpen />}
              </button>
            </div>
            {errors.pw && <p style={errStyle}>{errors.pw.message}</p>}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: C.textMuted, cursor: "pointer" }}>
              <input style={S.checkBox} type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />
              {t("login_remember")}
            </label>
            <a style={S.redLink} onClick={() => setPage("forgot")}>{t("login_forgot")}</a>
          </div>

          {serverError && (
            <p style={{ ...errStyle, textAlign: "center", marginBottom: 10, fontSize: 13 }}>{serverError}</p>
          )}

          <SubmitButton
            label={loading ? t("login_loading") : t("login_submit")}
            onClick={undefined}
            disabled={loading}
          />

          <div style={S.orRow}><div style={S.divLine} /><span>{t("login_or")}</span><div style={S.divLine} /></div>
          <div style={S.socialRow}>
            <div ref={googleButtonRef} />
            <button type="button" style={S.socialBtn}>
              <svg width="22" height="22" viewBox="0 0 48 48">
                <path fill="#3b5998" d="M44 24C44 12.95 35.05 4 24 4S4 12.95 4 24c0 9.98 7.31 18.26 16.88 19.76V29.69h-5.08V24h5.08v-4.41c0-5.02 2.99-7.79 7.57-7.79 2.19 0 4.49.39 4.49.39v4.93H30.4c-2.49 0-3.27 1.55-3.27 3.13V24h5.57l-.89 5.69h-4.68v14.07C36.69 42.26 44 33.98 44 24z"/>
              </svg>
            </button>
          </div>

          <p style={S.bottomTxt}>
            {t("login_no_account")}{" "}
            <a style={S.redLink} onClick={() => setPage("register")}>{t("login_register_link")}</a>
          </p>
        </form>
      </div>
    </div>
  );
};

export default Login;
