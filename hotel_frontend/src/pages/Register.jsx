import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { C, S, EyeOpen, EyeOff, SubmitButton, ImgSide } from "../components/auth/AuthShared";
import { useRegister } from "../hooks/useAuthMutations";
import { useLang } from "../contexts/LanguageContext";

const errStyle = { color: C.primary, fontSize: 12, margin: "4px 0 0" };
const inputErr = { border: "1.5px solid #BE1E2E", background: "#fff5f5" };

export default function Register({ setPage }) {
  const { t } = useLang();
  const [showPw, setShowPw] = useState(false);
  const [showCf, setShowCf] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [serverError, setServerError] = useState("");
  const [registeredEmail, setRegisteredEmail] = useState("");

  const schema = z.object({
    email: z.string()
      .min(1, t("register_err_email_empty"))
      .email(t("register_err_email_invalid")),
    pw: z.string()
      .min(1, t("register_err_pw_empty"))
      .min(8, t("register_err_pw_min"))
      .regex(/(?=.*[A-Za-z])(?=.*\d)/, t("register_err_pw_format")),
    cf: z.string().min(1, t("register_err_cf")),
  }).refine((data) => data.pw === data.cf, {
    message: t("register_err_cf"),
    path: ["cf"],
  });

  const {
    register,
    handleSubmit,
    setFocus,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    mode: "onBlur",
  });

  const registerMutation = useRegister();

  const onSubmit = (data) => {
    if (!agreed) return;
    setServerError("");
    registerMutation.mutate(
      { email: data.email, password: data.pw, confirmPassword: data.cf },
      {
        onSuccess: (result) => {
          if (result?.verificationToken) {
            window.location.href = `/verify-email?token=${encodeURIComponent(result.verificationToken)}`;
            return;
          }
          setRegisteredEmail(data.email);
        },
        onError: (err) => setServerError(err.message),
      },
    );
  };

  const onValidationError = (errs) => {
    const first = Object.keys(errs)[0];
    if (first) setFocus(first);
  };

  if (registeredEmail) {
    return (
      <div style={S.authWrap}>
        <ImgSide />
        <div style={S.formSide}>
          <div style={S.formBox}>
            <h1 style={S.title}>{t("register_success_title")}</h1>
            <p style={S.sub}>{t("register_success_sub").replace("{email}", registeredEmail)}</p>
            <div style={{
              background: "#eafaf1", border: "1.5px solid #27ae60",
              borderRadius: 10, padding: "16px 18px", marginBottom: 22,
              fontSize: 13, lineHeight: 1.6, color: "#1a5c38",
            }}>
              {t("register_success_note")}
            </div>
            <SubmitButton label={t("register_goto_login")} onClick={() => setPage("login")} />
            <p style={S.bottomTxt}>
              {t("register_no_email")}{" "}
              <button
                type="button"
                onClick={() => setRegisteredEmail("")}
                style={{ background: "none", border: "none", color: "#BE1E2E", cursor: "pointer", fontWeight: 700, padding: 0 }}
              >
                {t("register_retry")}
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={S.authWrap}>
      <ImgSide />
      <div style={S.formSide}>
        <form style={S.formBox} onSubmit={handleSubmit(onSubmit, onValidationError)} noValidate>
          <h1 style={S.title}>{t("register_title")}</h1>
          <p style={S.sub}>{t("register_sub")}</p>

          <div style={{ display: "grid", gap: 16, marginBottom: 20 }}>
            <div>
              <label style={S.label}>{t("register_email_label")}</label>
              <input
                {...register("email")}
                style={{ ...S.input, ...(errors.email ? inputErr : {}) }}
                type="email"
                placeholder="example@email.com"
                autoComplete="email"
              />
              {errors.email && <p style={errStyle}>{errors.email.message}</p>}
            </div>

            <div>
              <label style={S.label}>{t("auth_password")}</label>
              <div style={S.inputWrap}>
                <input
                  {...register("pw")}
                  style={{ ...S.input, ...(errors.pw ? inputErr : {}) }}
                  type={showPw ? "text" : "password"}
                  placeholder={t("register_pw_ph")}
                  autoComplete="new-password"
                />
                <button type="button" style={S.eyeBtn} onClick={() => setShowPw(!showPw)}>
                  {showPw ? <EyeOff /> : <EyeOpen />}
                </button>
              </div>
              {errors.pw && <p style={errStyle}>{errors.pw.message}</p>}
            </div>

            <div>
              <label style={S.label}>{t("auth_password_cf")}</label>
              <div style={S.inputWrap}>
                <input
                  {...register("cf")}
                  style={{ ...S.input, ...(errors.cf ? inputErr : {}) }}
                  type={showCf ? "text" : "password"}
                  placeholder={t("register_cf_ph")}
                  autoComplete="new-password"
                />
                <button type="button" style={S.eyeBtn} onClick={() => setShowCf(!showCf)}>
                  {showCf ? <EyeOff /> : <EyeOpen />}
                </button>
              </div>
              {errors.cf && <p style={errStyle}>{errors.cf.message}</p>}
            </div>
          </div>

          <div style={{ ...S.checkRow, marginTop: 0 }}>
            <input style={S.checkBox} type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            <span style={S.checkLabel}>
              {t("register_terms")} <a style={S.redLink}>{t("register_terms_link")}</a>{" "}
              {t("register_privacy")} <a style={S.redLink}>{t("register_privacy_link")}</a>
            </span>
          </div>

          {serverError && (
            <p style={{ ...errStyle, textAlign: "center", marginBottom: 10, fontSize: 13 }}>{serverError}</p>
          )}

          <SubmitButton
            label={registerMutation.isPending ? t("register_loading") : t("register_submit")}
            onClick={undefined}
            disabled={!agreed || registerMutation.isPending}
          />

          <p style={S.bottomTxt}>
            {t("register_has_account")}{" "}
            <button
              type="button"
              onClick={() => setPage("login")}
              style={{ background: "none", border: "none", color: "#BE1E2E", cursor: "pointer", fontWeight: 700, padding: 0 }}
            >
              {t("register_login_link")}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
