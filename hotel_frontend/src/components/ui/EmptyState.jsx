import { C } from "../auth/AuthShared";

export default function EmptyState({ icon, title, description, action }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "56px 24px", textAlign: "center",
    }}>
      {icon && (
        <div style={{ marginBottom: 20, opacity: 0.35 }}>
          {icon}
        </div>
      )}
      {title && (
        <p style={{ fontSize: 16, fontWeight: 800, color: "#1a1a1a", margin: "0 0 8px" }}>
          {title}
        </p>
      )}
      {description && (
        <p style={{ fontSize: 13, color: "#888", margin: "0 0 24px", maxWidth: 320, lineHeight: 1.6 }}>
          {description}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          style={{
            background: C.primary, color: "#fff", border: "none",
            borderRadius: 10, padding: "11px 28px",
            fontSize: 14, fontWeight: 700, cursor: "pointer",
            transition: "background 0.18s",
          }}
          onMouseEnter={e => e.currentTarget.style.background = "#a31825"}
          onMouseLeave={e => e.currentTarget.style.background = C.primary}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
