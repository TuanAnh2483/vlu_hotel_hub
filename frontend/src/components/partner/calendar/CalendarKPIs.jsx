import { useMemo } from "react";
import { BedDouble, CheckCircle2, Wrench, CircleDollarSign } from "lucide-react";
import { fmtCompact } from "./calendarUtils";

const TONES = {
  red:   { bg: "#FFF1F2", fg: "#BE1E2E" },
  green: { bg: "#ECFDF5", fg: "#059669" },
  blue:  { bg: "#EFF6FF", fg: "#2563EB" },
  amber: { bg: "#FFFBEB", fg: "#D97706" },
};

function KpiCard({ icon: Icon, tone, label, value, sub, loading }) {
  const t = TONES[tone];
  return (
    <div className="pck-card">
      <div className="pck-icon" style={{ background: t.bg, color: t.fg }}>
        <Icon size={20} />
      </div>
      <div className="pck-body">
        <div className="pck-label">{label}</div>
        <div className="pck-value" style={{ color: t.fg }}>
          {loading ? <span className="pck-skeleton" /> : value}
        </div>
        {sub && <div className="pck-hint">{loading ? "" : sub}</div>}
      </div>
    </div>
  );
}

export default function CalendarKPIs({ items, defaultQuantity, basePrice, todayIso, loading, roomUnits }) {
  const m = useMemo(() => {
    if (!items.length || !defaultQuantity) return null;

    const open         = items.filter(i => !i.closed);
    const bookedNights = open.reduce((s, i) => s + (i.blockedRooms || 0), 0);
    const totalSlots   = open.length * defaultQuantity;
    const avgOcc       = totalSlots > 0 ? Math.round(bookedNights / totalSlots * 100) : 0;
    const estRev       = items.reduce((s, i) => {
      const booked = i.blockedRooms || 0;
      return s + booked * (i.price || basePrice || 0);
    }, 0);
    const adr = bookedNights > 0 ? Math.round(estRev / bookedNights) : 0;

    const todayItem = items.find(i => i.date === todayIso);
    const hasRealUnits = Array.isArray(roomUnits) && roomUnits.length > 0;

    let todayVacant = null;
    if (hasRealUnits) {
      todayVacant = roomUnits.filter(u => u.status === "AVAILABLE").length;
    } else if (todayItem && !todayItem.closed) {
      todayVacant = todayItem.sellableRooms ?? Math.max(0, defaultQuantity - (todayItem.blockedRooms || 0));
    }

    const maintenance = hasRealUnits
      ? roomUnits.filter(u => u.status === "MAINTENANCE" || u.status === "CLEANING").length
      : null;

    return { bookedNights, totalSlots, avgOcc, estRev, adr, totalDays: items.length, todayVacant, maintenance };
  }, [items, defaultQuantity, basePrice, todayIso, roomUnits]);

  return (
    <div className="pck-grid">
      <KpiCard
        icon={BedDouble} tone="red" label="Phòng đã đặt" loading={loading}
        value={m ? String(m.bookedNights) : "—"}
        sub={m ? `Trong ${m.totalDays} ngày của tháng` : undefined}
      />
      <KpiCard
        icon={CheckCircle2} tone="green" label="Phòng trống hôm nay" loading={loading}
        value={m ? (m.todayVacant !== null ? String(m.todayVacant) : "—") : "—"}
        sub={m ? (m.todayVacant !== null ? `Trên tổng ${defaultQuantity || 0} phòng` : "Hôm nay không thuộc tháng này") : undefined}
      />
      <KpiCard
        icon={Wrench} tone="blue" label="Phòng đang bảo trì" loading={loading}
        value={m ? (m.maintenance !== null ? String(m.maintenance) : "—") : "—"}
        sub={m ? (m.maintenance !== null ? "Bảo trì + dọn phòng hôm nay" : "Chưa có dữ liệu phòng vật lý") : undefined}
      />
      <KpiCard
        icon={CircleDollarSign} tone="amber" label="Doanh thu ước tính" loading={loading}
        value={m ? fmtCompact(m.estRev) : "—"}
        sub={m && m.adr > 0 ? `ADR ${fmtCompact(m.adr)}` : "Chưa có đặt phòng"}
      />
    </div>
  );
}
