import { useEffect, useRef, useState } from "react";
import { CheckCircle2, LoaderCircle, XCircle } from "lucide-react";
import { S, SubmitButton, ImgSide } from "../components/auth/AuthShared";
import { useVerifyEmail } from "../hooks/useAuthMutations";
import { useLang } from "../contexts/LanguageContext";

function formatVerifiedAt(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("vi-VN", {
    hour: "2-digit", minute: "2-digit",
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

function mapVerifyResult(data) {
  if (data?.message === "Email is already verified") return "alreadyVerified";
  return "success";
}

export default function VerifyEmailPage({ setPage }) {
  const { t } = useLang();
  const [status, setStatus] = useState("loading");
  const [verifiedAt, setVerifiedAt] = useState("");
  const hasRequested = useRef(false);

  const verifyEmail = useVerifyEmail();

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) { setStatus("error"); return; }
    if (hasRequested.current) return;
    hasRequested.current = true;

    verifyEmail.mutate({ token }, {
      onSuccess: (data) => {
        setStatus(mapVerifyResult(data));
        setVerifiedAt(formatVerifiedAt(data?.verifiedAt));
      },
      onError: () => setStatus("error"),
    });
  }, []);

  const statusCopy = {
    loading:        { title: t("verify_loading_title"),  message: t("verify_loading_msg") },
    success:        { title: t("verify_success_title"),  message: t("verify_success_msg") },
    alreadyVerified:{ title: t("verify_already_title"),  message: t("verify_already_msg") },
    error:          { title: t("verify_error_title"),    message: t("verify_error_msg") },
  };

  const copy = statusCopy[status];
  const isLoading = status === "loading";
  const isSuccess = status === "success" || status === "alreadyVerified";
  const Icon = isLoading ? LoaderCircle : isSuccess ? CheckCircle2 : XCircle;
  const iconColor = isLoading ? "#64748b" : isSuccess ? "#16a34a" : "#BE1E2E";

  return (
    <div style={S.authWrap}>
      <ImgSide />
      <div style={S.formSide}>
        <div style={{ ...S.formBox, textAlign: "center" }}>
          <div style={{
            width: 72, height: 72, borderRadius: "50%",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            background: isSuccess ? "#dcfce7" : isLoading ? "#f1f5f9" : "#fee2e2",
            color: iconColor, marginBottom: 20,
          }}>
            <Icon size={38} strokeWidth={2.2} className={isLoading ? "verify-email-spin" : ""} />
          </div>

          <h1 style={S.title}>{copy.title}</h1>
          <p style={{ ...S.sub, marginBottom: verifiedAt ? 10 : 24 }}>{copy.message}</p>

          {verifiedAt && (
            <p style={{ color: "#64748b", fontSize: 13, fontWeight: 700, margin: "0 0 24px" }}>
              {t("verify_time").replace("{time}", verifiedAt)}
            </p>
          )}

          {isLoading ? (
            <SubmitButton label={t("verify_loading_btn")} disabled />
          ) : (
            <SubmitButton
              label={isSuccess ? t("verify_login_btn") : t("verify_register_btn")}
              onClick={() => setPage(isSuccess ? "login" : "register")}
            />
          )}
        </div>
      </div>
    </div>
  );
}
