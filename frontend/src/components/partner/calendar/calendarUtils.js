// Shared pure utilities for the calendar module — no React, no side effects

export function toIsoDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}

export function fmtCurrency(v) {
  if (v == null || isNaN(Number(v))) return "—";
  return Number(v).toLocaleString("vi-VN") + " ₫";
}

export function fmtCompact(v) {
  if (v == null || isNaN(Number(v))) return "—";
  const n = Number(v);
  if (n >= 1_000_000) {
    const val = n / 1_000_000;
    const str = val % 1 === 0
      ? String(Math.round(val))
      : val.toFixed(1).replace(".", ",");
    return `${str}tr ₫`;
  }
  return new Intl.NumberFormat("vi-VN").format(Math.round(n)) + " ₫";
}

export function fmtDate(v) {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString("vi-VN");
}

export function fmtDateTime(v) {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime()) ? String(v) : d.toLocaleString("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function buildMonthCells(year, month, itemsByDate) {
  const firstDay  = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push({ key: `e${i}`, empty: true });
  for (let day = 1; day <= totalDays; day++) {
    const date = new Date(year, month, day);
    const dow  = date.getDay();
    const iso  = toIsoDate(date);
    cells.push({ key: iso, empty: false, day, dow, weekend: dow === 0 || dow === 6, iso, item: itemsByDate.get(iso) ?? null });
  }
  return cells;
}

export function getWeekendRanges(year, month) {
  const totalDays = new Date(year, month + 1, 0).getDate();
  const ranges = [];
  for (let day = 1; day <= totalDays; day++) {
    const d = new Date(year, month, day);
    if (d.getDay() !== 0 && d.getDay() !== 6) continue;
    const iso = toIsoDate(d);
    const prev = ranges[ranges.length - 1];
    if (prev) {
      const nxt = new Date(prev.endDate);
      nxt.setDate(nxt.getDate() + 1);
      if (toIsoDate(nxt) === iso) { prev.endDate = iso; continue; }
    }
    ranges.push({ startDate: iso, endDate: iso });
  }
  return ranges;
}

export function calcOccPct(bookedRooms, defaultQuantity) {
  if (!defaultQuantity || defaultQuantity <= 0) return 0;
  return Math.min(100, Math.round(((bookedRooms || 0) / defaultQuantity) * 100));
}

export function getCellClass(occPct, closed, past) {
  if (past)   return "pc-cell-past";
  if (closed) return "pc-cell-closed";
  if (occPct === 0)  return "pc-cell-occ-empty";
  if (occPct <= 30)  return "pc-cell-occ-low";
  if (occPct <= 60)  return "pc-cell-occ-mid";
  if (occPct <= 80)  return "pc-cell-occ-high";
  if (occPct < 100)  return "pc-cell-occ-full";
  return "pc-cell-occ-sold";
}
