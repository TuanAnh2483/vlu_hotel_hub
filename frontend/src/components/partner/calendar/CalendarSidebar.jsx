import { useMemo } from "react";
import { TrendingDown, Moon, CheckCircle2, AlertCircle } from "lucide-react";
import { calcOccPct } from "./calendarUtils";

const LEGEND = [
  { dot: "#93c5fd", label: "Chưa có đặt (0%)" },
  { dot: "#e2e8f0", label: "Thấp (1 – 30%)" },
  { dot: "#fde047", label: "Trung bình (31 – 60%)" },
  { dot: "#fb923c", label: "Cao (61 – 80%)" },
  { dot: "#f87171", label: "Gần kín (81 – 99%)" },
  { dot: "#BE1E2E", label: "Hết phòng (100%)" },
  { dot: "#cbd5e1", label: "Đóng bán" },
];

function useInsights(items, todayIso, defaultQuantity) {
  return useMemo(() => {
    if (!items.length || !defaultQuantity) return [];

    const future = items.filter(i => !i.closed && i.date >= todayIso);
    const result = [];

    const slowDays = future.filter(
      i => calcOccPct(i.blockedRooms || 0, defaultQuantity) < 30,
    ).length;
    if (slowDays >= 5) result.push({
      icon: TrendingDown, color: "#D97706", bg: "#FFFBEB", border: "#FDE68A",
      text: `${slowDays} ngày sắp tới bán chậm — dưới 30% công suất`,
    });

    const weakWeekends = future.filter(i => {
      const dow = new Date(i.date).getDay();
      return (dow === 0 || dow === 6) &&
        calcOccPct(i.blockedRooms || 0, defaultQuantity) < 50;
    }).length;
    if (weakWeekends > 0) result.push({
      icon: Moon, color: "#7C3AED", bg: "#F5F3FF", border: "#DDD6FE",
      text: `${weakWeekends} cuối tuần còn nhiều phòng trống — cân nhắc điều chỉnh giá`,
    });

    const hotDays = future.filter(
      i => calcOccPct(i.blockedRooms || 0, defaultQuantity) >= 80,
    ).length;
    if (hotDays > 0) result.push({
      icon: CheckCircle2, color: "#059669", bg: "#ECFDF5", border: "#A7F3D0",
      text: `${hotDays} ngày sắp kín phòng — có thể tăng giá tối ưu doanh thu`,
    });

    const closedCount = items.filter(i => i.closed && i.date >= todayIso).length;
    if (closedCount > 0) result.push({
      icon: AlertCircle, color: "#DC2626", bg: "#FEF2F2", border: "#FECACA",
      text: `${closedCount} ngày đang đóng bán — kiểm tra lại nếu cần`,
    });

    return result;
  }, [items, todayIso, defaultQuantity]);
}

export default function CalendarSidebar({ items, todayIso, defaultQuantity }) {
  const insights = useInsights(items, todayIso, defaultQuantity);

  return (
    <div className="pcal-sidebar">

      {/* ── Legend ── */}
      <div className="pcal-sb-card">
        <div className="pcal-sb-title">Chú thích màu</div>
        <div className="pcal-sb-legend">
          {LEGEND.map(({ dot, label }) => (
            <div key={label} className="pcal-sb-legend-item">
              <span className="pcal-sb-dot" style={{ background: dot }} />
              <span className="pcal-sb-legend-lbl">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Operational insights ── */}
      {insights.length > 0 && (
        <div className="pcal-sb-card">
          <div className="pcal-sb-title">Nhận xét vận hành</div>
          <div className="pcal-sb-insights">
            {insights.map((a, i) => {
              const Icon = a.icon;
              return (
                <div
                  key={i}
                  className="pcal-sb-insight"
                  style={{ background: a.bg, borderColor: a.border, color: a.color }}
                >
                  <Icon size={12} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>{a.text}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
