import { CheckCircle, XCircle, Info, AlertTriangle, X } from "lucide-react";
import "./Toast.css";

const TYPE_STYLES = {
  success: { borderColor: "var(--success)", iconColor: "var(--success)", textColor: "#065f46", bg: "var(--success-bg)", icon: <CheckCircle size={18} /> },
  error:   { borderColor: "var(--danger)",  iconColor: "var(--danger)",  textColor: "#991b1b", bg: "var(--danger-bg)",  icon: <XCircle size={18} /> },
  info:    { borderColor: "var(--info)",    iconColor: "var(--info)",    textColor: "#1e40af", bg: "var(--info-bg)",    icon: <Info size={18} /> },
  warning: { borderColor: "var(--warning)", iconColor: "var(--warning)", textColor: "#92400e", bg: "var(--warning-bg)", icon: <AlertTriangle size={18} /> },
};

export default function ToastContainer({ toasts, onRemove }) {
  return (
    <div className="toast-container" role="region" aria-label="Thông báo" aria-live="polite">
      {toasts.map(t => {
        const s = TYPE_STYLES[t.type] || TYPE_STYLES.info;
        return (
          <div
            key={t.id}
            className="toast-item"
            style={{ borderLeftColor: s.borderColor, background: s.bg }}
            role="alert"
          >
            <div className="toast-icon" style={{ color: s.iconColor }}>{s.icon}</div>
            <div className="toast-message" style={{ color: s.textColor }}>{t.message}</div>
            <button
              onClick={() => onRemove(t.id)}
              aria-label="Đóng thông báo"
              className="toast-close"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
