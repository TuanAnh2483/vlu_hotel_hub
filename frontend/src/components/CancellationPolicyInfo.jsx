import { ShieldCheck, Clock, ShieldOff } from "lucide-react";
import { useLang } from "../contexts/LanguageContext";

// ─────────────────────────────────────────────────────────────────────
// Hiển thị chính sách hủy & hoàn tiền theo chuẩn các trang đặt phòng lớn.
//
//  • Có `checkIn` + `total`  → bản CỤ THỂ theo đơn: tính sẵn ngày deadline
//    thật từ ngày nhận phòng và số tiền hoàn thật theo tổng đơn.
//  • Không có                → bản CHUNG (bảng %): dùng ở trang khách sạn,
//    nơi chưa có đơn cụ thể.
//
// Đây CHỈ là phần hiển thị (info-only). Số tiền hoàn thật vẫn đi qua luồng
// yêu cầu hoàn tiền + duyệt thủ công như hiện tại.
// ─────────────────────────────────────────────────────────────────────

// Giờ nhận phòng mặc định dùng để tính mốc "trước 24h / 7 ngày".
const CHECK_IN_HOUR = 14;
const DAY = 86400000;

const POLICY_CFG = {
  FLEXIBLE: { Icon: ShieldCheck, color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0", nameKey: "cpi_name_flexible" },
  MODERATE: { Icon: Clock,       color: "#d97706", bg: "#fffbeb", border: "#fde68a", nameKey: "cpi_name_moderate" },
  STRICT:   { Icon: ShieldOff,   color: "#dc2626", bg: "#fff1f2", border: "#fecdd3", nameKey: "cpi_name_strict"   },
};

// Màu + nhãn cho từng mức hoàn tiền.
const REFUND_STYLE = {
  100: { color: "#16a34a", key: "cpi_refund_full" },
  50:  { color: "#d97706", key: "cpi_refund_half" },
  0:   { color: "#dc2626", key: "cpi_refund_none" },
};

function fmtMoney(n) {
  return (Math.max(0, Math.round(n || 0))).toLocaleString("vi-VN") + "₫";
}

function fmtDateTime(date, lang) {
  return date.toLocaleString(lang === "en" ? "en-GB" : "vi-VN", {
    hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric",
  });
}

function fill(str, vars) {
  return str.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? vars[k] : `{${k}}`));
}

// Build danh sách bậc hoàn tiền + mức áp dụng hiện tại.
function buildRows(policy, checkInISO, total, t, lang) {
  const concrete = !!checkInISO && total != null;
  const amt = pct => fmtMoney((total || 0) * pct / 100);

  let checkIn = null;
  let freeUntil = null;
  if (concrete) {
    checkIn = new Date(checkInISO);
    if (Number.isNaN(checkIn.getTime())) return null;
    checkIn.setHours(CHECK_IN_HOUR, 0, 0, 0);
  }

  let rows = [];
  let currentPct = 0;

  if (policy === "STRICT") {
    rows = [{ text: t("cpi_g_strict_1"), pct: 0 }];
    currentPct = 0;
  } else if (policy === "FLEXIBLE") {
    if (concrete) {
      freeUntil = new Date(checkIn.getTime() - DAY);
      rows = [
        { text: fill(t("cpi_c_flex_1"), { d: fmtDateTime(freeUntil, lang) }), pct: 100, amount: amt(100) },
        { text: fill(t("cpi_c_flex_2"), { d: fmtDateTime(freeUntil, lang) }), pct: 0,   amount: amt(0)   },
      ];
      currentPct = Date.now() <= freeUntil.getTime() ? 100 : 0;
    } else {
      rows = [
        { text: t("cpi_g_flex_1"), pct: 100 },
        { text: t("cpi_g_flex_2"), pct: 0 },
      ];
    }
  } else { // MODERATE
    if (concrete) {
      freeUntil = new Date(checkIn.getTime() - 7 * DAY);
      rows = [
        { text: fill(t("cpi_c_mod_1"), { d: fmtDateTime(freeUntil, lang) }), pct: 100, amount: amt(100) },
        { text: fill(t("cpi_c_mod_2"), { d: fmtDateTime(checkIn, lang) }),   pct: 50,  amount: amt(50)  },
        { text: t("cpi_c_mod_3"), pct: 0, amount: amt(0) },
      ];
      const now = Date.now();
      currentPct = now <= freeUntil.getTime() ? 100 : (now < checkIn.getTime() ? 50 : 0);
    } else {
      rows = [
        { text: t("cpi_g_mod_1"), pct: 100 },
        { text: t("cpi_g_mod_2"), pct: 50 },
        { text: t("cpi_g_mod_3"), pct: 0 },
      ];
    }
  }

  return { rows, concrete, freeUntil, currentAmount: amt(currentPct), currentPct };
}

export default function CancellationPolicyInfo({ policy = "MODERATE", checkIn, total }) {
  const { t, lang } = useLang();
  const pKey = (policy || "MODERATE").toUpperCase();
  const cfg = POLICY_CFG[pKey] || POLICY_CFG.MODERATE;
  const Icon = cfg.Icon;

  const data = buildRows(pKey, checkIn, total, t, lang);
  if (!data) return null;

  return (
    <div>
      {/* Header badge */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, background: cfg.bg, border: `1px solid ${cfg.border}`, marginBottom: 12 }}>
        <Icon size={18} color={cfg.color} aria-hidden="true" style={{ flexShrink: 0 }} />
        <span style={{ fontWeight: 800, fontSize: 14, color: cfg.color }}>{t(cfg.nameKey)}</span>
      </div>

      {/* Tier rows */}
      <div>
        {data.rows.map((row, i) => {
          const rs = REFUND_STYLE[row.pct];
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "9px 0", borderTop: i === 0 ? "none" : "1px solid #f1f5f9" }}>
              <span style={{ fontSize: 13, color: "#374151", lineHeight: 1.5 }}>{row.text}</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: rs.color, whiteSpace: "nowrap", textAlign: "right" }}>
                {t(rs.key)}{data.concrete && row.amount != null ? <><br /><span style={{ fontWeight: 700, color: "#64748b" }}>{row.amount}</span></> : null}
              </span>
            </div>
          );
        })}
      </div>

      {/* Số tiền hoàn nếu hủy hôm nay (chỉ bản cụ thể) */}
      {data.concrete && (
        <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <span style={{ fontSize: 13, color: "#475569", fontWeight: 600 }}>{t("cpi_current")}</span>
          <span style={{ fontSize: 16, fontWeight: 900, color: REFUND_STYLE[data.currentPct].color, whiteSpace: "nowrap" }}>{data.currentAmount}</span>
        </div>
      )}

      <p style={{ margin: "12px 0 0", fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>{t("cpi_note")}</p>
    </div>
  );
}
