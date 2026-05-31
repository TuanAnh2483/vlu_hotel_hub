import { fmtCompact, calcOccPct, getCellClass } from "./calendarUtils";

// Color for the occupancy progress bar fill — derived from class
const BAR_COLORS = {
  "pc-cell-occ-low":   "#93c5fd",
  "pc-cell-occ-mid":   "#fde047",
  "pc-cell-occ-high":  "#fb923c",
  "pc-cell-occ-full":  "#f87171",
  "pc-cell-occ-sold":  "#BE1E2E",
};

function CalendarCell({ cell, todayIso, calendar, onCellClick }) {
  if (cell.empty) return <div className="partner-calendar-empty-cell" />;

  const { item, iso, day, weekend } = cell;
  const isToday   = iso === todayIso;
  const isPast    = !isToday && iso < todayIso;
  const isClosed  = Boolean(item?.closed);
  const totalQ    = calendar?.defaultQuantity || 0;
  const basePrice = calendar?.basePrice;
  const price     = item?.price ?? basePrice;
  const booked    = item?.blockedRooms ?? 0;
  const sellable  = item?.sellableRooms ?? 0;
  const occPct    = calcOccPct(booked, totalQ);
  const cellCls   = getCellClass(occPct, isClosed, isPast);
  const isSoldOut = !isClosed && !isPast && totalQ > 0 && sellable === 0;
  const isNearFull = !isClosed && !isPast && !isSoldOut && occPct >= 80;
  const hasCustomRate = Boolean(item?.hasCustomRate);
  const barColor  = BAR_COLORS[cellCls] || "#e2e8f0";

  return (
    <button
      type="button"
      className={`partner-calendar-cell ${cellCls}${isToday ? " pc-today" : ""}${weekend && !isPast ? " partner-calendar-cell-weekend" : ""}`}
      onClick={() => !isPast && onCellClick(cell)}
      disabled={isPast}
      aria-label={`Ngày ${day}${isPast ? " (đã qua)" : " — click để chỉnh giá"}`}
      title={isPast ? "Ngày đã qua" : "Click để chỉnh giá / tình trạng phòng"}
    >
      {/* Row 1: day number + status badge */}
      <div className="pc-day-row">
        <div className={`pc-day-num${isToday ? " pc-day-num--today" : ""}${weekend && !isToday && !isPast ? " pc-day-num--weekend" : ""}`}>
          {day}
        </div>
        {!isPast && !isClosed && (
          isSoldOut ? (
            <span className="pc-badge pc-badge--sold">Hết phòng</span>
          ) : isNearFull ? (
            <span className="pc-badge pc-badge--hot">Gần kín</span>
          ) : hasCustomRate ? (
            <span className="pc-badge pc-badge--custom">Giá riêng</span>
          ) : null
        )}
        {!isPast && isClosed && (
          <span className="pc-badge pc-badge--closed">Đóng bán</span>
        )}
      </div>

      {/* Row 2: price */}
      <div className={`pc-price${isClosed ? " pc-price--muted" : isPast ? " pc-price--past" : ""}`}>
        {isPast ? "—" : isClosed ? "Không nhận đặt" : fmtCompact(price)}
      </div>

      {/* Row 3: occupancy bar + counts (future non-closed only) */}
      {!isPast && !isClosed && totalQ > 0 && (
        <>
          <div className="pc-occ-track">
            <div
              className="pc-occ-fill"
              style={{ width: `${occPct}%`, background: barColor }}
            />
          </div>
          <div className="pc-room-row">
            <span className="pc-booked-count">{booked} đặt</span>
            <span className="pc-room-sep">·</span>
            <span className="pc-total-count">{Math.max(0, totalQ - booked)} trống</span>
          </div>
        </>
      )}

      {/* Row 4: min stay pill */}
      {!isPast && (item?.minStay || 0) > 1 && (
        <div className="pc-minstay">⏱ {item.minStay} đêm</div>
      )}
    </button>
  );
}

export default function CalendarGrid({
  monthCells, todayIso, calendar, calendarLoading, selectedRoomId, dayNames, onCellClick,
}) {
  if (!selectedRoomId) {
    return (
      <div className="pc-empty-state">
        <div className="pc-empty-icon">📅</div>
        <div className="pc-empty-title">Chưa chọn loại phòng</div>
        <div className="pc-empty-desc">Chọn khách sạn và loại phòng phía trên để xem lịch vận hành</div>
      </div>
    );
  }

  if (calendarLoading) {
    return (
      <div className="partner-calendar-loading">
        <div className="partner-calendar-spinner" />
        Đang tải lịch phòng...
      </div>
    );
  }

  return (
    <div className="pc-grid-wrap">
      {/* Info strip */}
      <div className="pc-info-strip">
        <span className="pc-info-chip">
          Giá cơ bản: <strong>{fmtCompact(calendar?.basePrice)}</strong>
        </span>
        <span className="pc-info-chip">
          Tổng inventory: <strong>{calendar?.defaultQuantity ?? "—"} phòng</strong>
        </span>
        <span className="pc-info-chip pc-info-chip--hint">
          💡 Click vào ô ngày để chỉnh giá hoặc đóng phòng
        </span>
      </div>

      {/* Calendar */}
      <div className="pc-scroll-wrap">
        <div className="pc-scroll-inner">
          <div className="partner-calendar-grid">
            {dayNames.map((name, i) => (
              <div
                key={name}
                className={`partner-calendar-day-header${i === 0 || i === 6 ? " partner-calendar-day-header-weekend" : ""}`}
              >
                {name}
              </div>
            ))}
          </div>
          <div className="partner-calendar-days-grid">
            {monthCells.map(cell => (
              <CalendarCell
                key={cell.key}
                cell={cell}
                todayIso={todayIso}
                calendar={calendar}
                onCellClick={onCellClick}
              />
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
