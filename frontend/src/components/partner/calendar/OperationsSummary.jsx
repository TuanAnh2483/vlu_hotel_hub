import { useMemo } from "react";
import { TrendingDown, Moon, AlertCircle, CheckCircle2 } from "lucide-react";
import { calcOccPct } from "./calendarUtils";

export default function OperationsSummary({ items, todayIso, defaultQuantity }) {
  const insights = useMemo(() => {
    if (!items.length || !defaultQuantity) return [];

    const future = items.filter(i => !i.closed && i.date >= todayIso);
    const result = [];

    // Slow sales: future days with occupancy < 30%
    const slowDays = future.filter(i => calcOccPct(i.bookedRooms || 0, defaultQuantity) < 30).length;
    if (slowDays >= 5) {
      result.push({
        icon: TrendingDown,
        color: "#D97706",
        bg: "#FFFBEB",
        border: "#FDE68A",
        text: `${slowDays} ngày sắp tới bán chậm — dưới 30% công suất`,
      });
    }

    // Weekend underperformance
    const weakWeekends = future.filter(i => {
      const dow = new Date(i.date).getDay();
      return (dow === 0 || dow === 6) && calcOccPct(i.bookedRooms || 0, defaultQuantity) < 50;
    }).length;
    if (weakWeekends > 0) {
      result.push({
        icon: Moon,
        color: "#7C3AED",
        bg: "#F5F3FF",
        border: "#DDD6FE",
        text: `${weakWeekends} cuối tuần còn nhiều phòng trống — cân nhắc điều chỉnh giá`,
      });
    }

    // Nearly full days (positive alert)
    const hotDays = future.filter(i => calcOccPct(i.bookedRooms || 0, defaultQuantity) >= 80).length;
    if (hotDays > 0) {
      result.push({
        icon: CheckCircle2,
        color: "#059669",
        bg: "#ECFDF5",
        border: "#A7F3D0",
        text: `${hotDays} ngày sắp kín phòng — có thể tăng giá để tối ưu doanh thu`,
      });
    }

    // Closed sell days warning
    const closedCount = items.filter(i => i.closed && i.date >= todayIso).length;
    if (closedCount > 0) {
      result.push({
        icon: AlertCircle,
        color: "#DC2626",
        bg: "#FEF2F2",
        border: "#FECACA",
        text: `${closedCount} ngày đang đóng bán — kiểm tra lại nếu không có lý do`,
      });
    }

    return result;
  }, [items, todayIso, defaultQuantity]);

  if (!insights.length) return null;

  return (
    <div className="pco-root">
      {insights.map((a, i) => {
        const Icon = a.icon;
        return (
          <div
            key={i}
            className="pco-alert"
            style={{ background: a.bg, borderColor: a.border, color: a.color }}
          >
            <Icon size={13} style={{ flexShrink: 0 }} />
            <span>{a.text}</span>
          </div>
        );
      })}
    </div>
  );
}
