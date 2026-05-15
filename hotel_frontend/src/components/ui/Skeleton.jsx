export default function Skeleton({ width, height, borderRadius = "8px", className = "", style = {} }) {
  return (
    <div
      className={`animate-shimmer ${className}`}
      style={{
        width: width || "100%",
        height: height || "1rem",
        borderRadius,
        ...style,
      }}
    />
  );
}

export function SkeletonCard() {
  return (
    <div style={{ background: "#fff", borderRadius: 16, border: "1.5px solid #edd8da", padding: "14px 16px", flex: "0 0 260px" }}>
      <Skeleton height="180px" borderRadius="12px" style={{ marginBottom: 14 }} />
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
        <Skeleton width="60%" height="16px" />
        <Skeleton width="20%" height="16px" />
      </div>
      <Skeleton width="40%" height="12px" style={{ marginBottom: 16 }} />
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <Skeleton width="50%" height="20px" />
        <Skeleton width="30px" height="30px" borderRadius="6px" />
      </div>
    </div>
  );
}

export function SkeletonRow({ cols = 5 }) {
  return (
    <tr style={{ borderBottom: "1px solid #f5f5f5" }}>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} style={{ padding: "16px 14px" }}>
          <Skeleton width="80%" height="14px" />
        </td>
      ))}
    </tr>
  );
}

export function SkeletonBookingCard() {
  return (
    <div style={{
      background: "#fff", borderRadius: 14, border: "1.5px solid #eee",
      padding: "20px 24px", marginBottom: 16,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <div style={{ flex: 1 }}>
          <Skeleton width="38%" height="12px" style={{ marginBottom: 8 }} />
          <Skeleton width="55%" height="16px" />
        </div>
        <Skeleton width="88px" height="26px" borderRadius="20px" style={{ marginLeft: 16, flexShrink: 0 }} />
      </div>
      <Skeleton width="65%" height="13px" style={{ marginBottom: 16 }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Skeleton width="28%" height="20px" />
        <Skeleton width="100px" height="36px" borderRadius="8px" />
      </div>
    </div>
  );
}

export function SkeletonTableRows({ rows = 5, cols = 6 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} cols={cols} />
      ))}
    </>
  );
}

export function PageLoader() {
  return (
    <>
      <style>{`
        @keyframes page-loader-slide {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, height: 3,
        background: "#f0d8da", zIndex: 9999, overflow: "hidden",
      }}>
        <div style={{
          height: "100%", width: "40%",
          background: "linear-gradient(90deg, transparent, #BE1E2E, transparent)",
          animation: "page-loader-slide 1.2s ease-in-out infinite",
        }} />
      </div>
    </>
  );
}
