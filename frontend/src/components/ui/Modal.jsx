import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import "./Modal.css";

export default function Modal({ title, children, onClose, width = 460 }) {
  const titleId = useRef(`modal-title-${Math.random().toString(36).slice(2)}`).current;

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", handler);
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="ui-modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="ui-modal-box" style={{ width }}>
        <div className="ui-modal-header">
          <h3 id={titleId} className="ui-modal-title">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Đóng"
            className="ui-modal-close"
          ><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
