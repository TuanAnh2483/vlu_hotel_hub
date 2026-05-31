/**
 * metricsCalculator.js
 * Pure helper functions for hospitality industry KPIs.
 * All monetary values are in VND.
 */

/** ADR — Average Daily Rate = Revenue / Room Nights Sold */
export function calcADR(totalRevenue, totalRoomNights) {
  if (!totalRoomNights || totalRoomNights <= 0) return 0;
  return totalRevenue / totalRoomNights;
}

/**
 * Occupancy Rate = Booked Nights / Total Available Room Nights × 100
 * @param {number} bookedNights  - sum of (checkOut - checkIn) in days for confirmed bookings
 * @param {number} totalRooms    - total physical room count (quantity sum)
 * @param {number} periodDays    - number of days in the measured period
 */
export function calcOccupancyRate(bookedNights, totalRooms, periodDays) {
  const available = totalRooms * periodDays;
  if (!available) return 0;
  return Math.min((bookedNights / available) * 100, 100);
}

/** RevPAR — Revenue Per Available Room = ADR × (OccupancyRate / 100) */
export function calcRevPAR(adr, occupancyRatePct) {
  return adr * (occupancyRatePct / 100);
}

/**
 * Sum booking nights from a list of booking objects.
 * Expects { checkIn: "YYYY-MM-DD", checkOut: "YYYY-MM-DD", status: string }
 */
export function sumBookingNights(bookings, statusFilter = ["CONFIRMED", "COMPLETED"]) {
  return bookings.reduce((acc, b) => {
    if (statusFilter.length && !statusFilter.includes(b.status)) return acc;
    if (!b.checkIn || !b.checkOut) return acc;
    const ms = new Date(b.checkOut) - new Date(b.checkIn);
    const nights = Math.max(0, Math.round(ms / 86_400_000));
    return acc + nights;
  }, 0);
}

/** Days in a date range (inclusive start, exclusive end) */
export function periodDays(fromIso, toIso) {
  const ms = new Date(toIso) - new Date(fromIso);
  return Math.max(1, Math.round(ms / 86_400_000) + 1);
}

/** Format a KPI number nicely */
export function fmtMetric(value, type = "currency") {
  const v = Number(value || 0);
  if (type === "percent") return v.toFixed(1) + "%";
  if (type === "currency") {
    if (v >= 1_000_000_000) return (v / 1_000_000_000).toFixed(1) + " tỷ ₫";
    if (v >= 1_000_000)     return (v / 1_000_000).toFixed(1) + " tr ₫";
    return new Intl.NumberFormat("vi-VN").format(Math.round(v)) + " ₫";
  }
  return v.toLocaleString("vi-VN");
}