import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { C, S, SubmitButton, ImgSide } from "../components/auth/AuthShared";
import { useForgotPassword } from "../hooks/useAuthMutations";
import { useLang } from "../contexts/LanguageContext";

const errStyle = { color: C.primary, fontSize: 12, margin: "4px 0 0" };
const inputErr = { border: "1.5px solid #BE1E2E", background: "#fff5f5" };

const ForgotPassword = ({ setPage }) => {
  const { t } = useLang();
  const [sent, setSent] = useState(false);
  const [sentEmail, setSentEmail] = useState("");
  const [serverError, setServerError] = useState("");

  const schema = z.object({
    email: z.string()
      .min(1, t("forgot_err_email_required"))
      .email(t("forgot_err_email_invalid")),
  });

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    mode: "onBlur",
  });

  const forgotMutation = useForgotPassword();

  const onSubmit = (data) => {
    setServerError("");
    forgotMutation.mutate({ email: data.email }, {
      onSuccess: () => { setSentEmail(data.email); setSent(true); },
      onError: (err) => setServerError(err.message),
    });
  };

  return (
    <div style={S.authWrap}>
      <ImgSide />
      <div style={S.formSide}>
        <div style={S.formBox}>
          <h1 style={S.title}>{t("forgot_title")}</h1>
          <p style={S.sub}>{t("forgot_sub")}</p>

          {sent ? (
            <div style={{ background: "#eafaf1", border: "1.5px solid #27ae60", borderRadius: 10, padding: "22px 24px", textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
              <div style={{ fontWeight: 700, color: "#27ae60", marginBottom: 4 }}>{t("forgot_sent_title")}</div>
              <div style={{ fontSize: 13, color: "#555" }}>{t("forgot_sent_msg").replace("{email}", sentEmail)}</div>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              <div style={{ ...S.fg, marginBottom: 22 }}>
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

              {serverError && (
                <p style={{ ...errStyle, textAlign: "center", marginBottom: 10, fontSize: 13 }}>{serverError}</p>
              )}

              <SubmitButton
                label={forgotMutation.isPending ? t("forgot_loading") : t("forgot_submit")}
                onClick={undefined}
                disabled={forgotMutation.isPending}
              />
            </form>
          )}

          <p style={{ ...S.bottomTxt, marginBottom: 22 }}>
            <a style={S.redLink} onClick={() => setPage("login")}>{t("auth_back_login")}</a>
          </p>

          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 10 }}>{t("auth_support")}</p>
            <div style={S.supportRow}>
              <button type="button" style={S.supportBtn}>❓</button>
              <button type="button" style={S.supportBtn}>🔗</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
