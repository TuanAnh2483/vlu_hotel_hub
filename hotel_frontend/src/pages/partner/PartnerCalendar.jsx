import { useEffect, useMemo, useState } from "react";
import {
  useMyHotels, usePartnerRooms, useRoomCalendar, useUpdateRoomCalendar,
  usePartnerRefunds, useApproveRefund, useRejectRefund, usePriceSuggestions,
} from "../../hooks/usePartnerQueries";
import { Badge, Btn, Card, Modal, PageHeader, Table } from "../../components/admin/AdminLayout";
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  DoorOpen,
  Hotel,
  Info,
  Layers3,
  RefreshCcw,
  Sparkles,
  XCircle,
} from "lucide-react";
import "../../styles/pages/PartnerCalendar.css";
import { useLang } from "../../contexts/LanguageContext";

function toIsoDate(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function buildMonthCells(year, month, itemsByDate) {
  const firstDay = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const cells = [];

  for (let i = 0; i < firstDay; i += 1) {
    cells.push({ key: `empty-${i}`, empty: true });
  }

  for (let day = 1; day <= totalDays; day += 1) {
    const date = new Date(year, month, day);
    const dayOfWeek = date.getDay();
    const iso = toIsoDate(date);
    cells.push({
      key: iso,
      empty: false,
      day,
      dayOfWeek,
      weekend: dayOfWeek === 0 || dayOfWeek === 6,
      iso,
      item: itemsByDate.get(iso) ?? null,
    });
  }

  return cells;
}

function formatCurrency(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "—";
  }
  return Number(value).toLocaleString("vi-VN") + " ₫";
}

function formatCompactCurrency(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "—";
  }

  const amount = Number(value);
  if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(amount % 1_000_000 === 0 ? 0 : 1)}tr đ`;
  }
  if (amount >= 1_000) {
    return `${new Intl.NumberFormat("vi-VN").format(Math.round(amount))}đ`;
  }
  return `${amount}đ`;
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("vi-VN");
}

function formatDateTime(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getWeekendDateRanges(year, month) {
  const totalDays = new Date(year, month + 1, 0).getDate();
  const weekendDates = [];

  for (let day = 1; day <= totalDays; day += 1) {
    const date = new Date(year, month, day);
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      weekendDates.push(date);
    }
  }

  const ranges = [];
  for (const date of weekendDates) {
    const iso = toIsoDate(date);
    const previousRange = ranges[ranges.length - 1];

    if (previousRange && toIsoDate(addDays(new Date(previousRange.endDate), 1)) === iso) {
      previousRange.endDate = iso;
    } else {
      ranges.push({ startDate: iso, endDate: iso });
    }
  }

  return ranges;
}

function metricCard(icon, label, value, hint, tone) {
  return { icon, label, value, hint, tone };
}

const METRIC_TONES = {
  red: { bg: "#FFF1F2", fg: "#BE1E2E" },
  green: { bg: "#ECFDF5", fg: "#059669" },
  amber: { bg: "#FFFBEB", fg: "#D97706" },
  blue: { bg: "#EFF6FF", fg: "#2563EB" },
};

const chipStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "4px 8px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 800,
  lineHeight: 1,
};

// Shared AI suggestion color schemes (matches PartnerForecast DEMAND_STYLE)
const AI_DEMAND_SCHEME = {
  HIGH:   { bg: "#FFF1F2", border: "#FECDD3", accent: "#BE1E2E", textDark: "#9f1239", label: "Nhu cầu cao" },
  MEDIUM: { bg: "#FFFBEB", border: "#FDE68A", accent: "#D97706", textDark: "#92400E", label: "Nhu cầu vừa" },
  LOW:    { bg: "#F0FDF4", border: "#A7F3D0", accent: "#059669", textDark: "#065f46", label: "Nhu cầu thấp" },
};

function getAiDemandKey(suggestedPrice, currentPriceStr) {
  const cur = Number(currentPriceStr) || 0;
  if (!suggestedPrice || cur <= 0) return "MEDIUM";
  const pct = (suggestedPrice - cur) / cur * 100;
  return pct >= 12 ? "HIGH" : pct >= -5 ? "MEDIUM" : "LOW";
}

const EMPTY_RATE_FORM = {
  startDate: "",
  endDate: "",
  price: "",
  minStay: "",
  availableRooms: "",
  closed: false,
  applyWeekendInMonth: false,
};

function WarningModal({ available, total, onClose }) {
  const { t } = useLang();
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(15,23,42,0.55)",
      backdropFilter: "blur(3px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20,
    }}>
      <div style={{
        background: "#fff",
        borderRadius: 24,
        padding: "36px 32px 28px",
        maxWidth: 420, width: "100%",
        boxShadow: "0 32px 80px -12px rgba(0,0,0,0.28)",
        animation: "warnIn 0.18s ease",
      }}>
        {/* Icon */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 22 }}>
          <div style={{
            width: 76, height: 76, borderRadius: "50%",
            background: "linear-gradient(135deg,#FEF3C7,#FDE68A)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 8px 24px rgba(217,119,6,0.22)",
          }}>
            <AlertTriangle size={38} color="#D97706" strokeWidth={2.2} />
          </div>
        </div>

        {/* Title */}
        <div style={{ textAlign: "center", fontSize: 20, fontWeight: 900, color: "#0f172a", marginBottom: 10 }}>
          {t("pt_cal_warn_title")}
        </div>

        {/* Message */}
        <div style={{ textAlign: "center", color: "#64748b", fontSize: 13.5, lineHeight: 1.75, marginBottom: 20 }}
          dangerouslySetInnerHTML={{ __html: t("pt_cal_warn_msg")
            .replace("{available}", `<span style="font-weight:900;color:#BE1E2E">${available}</span>`)
            .replace("{total}", `<span style="font-weight:900;color:#0f172a">${total}</span>`) }}
        />

        {/* Info box */}
        <div style={{
          display: "flex", alignItems: "flex-start", gap: 10,
          background: "#FFFBEB", border: "1px solid #FDE68A",
          borderRadius: 14, padding: "12px 14px", marginBottom: 28,
        }}>
          <Info size={15} color="#D97706" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ margin: 0, fontSize: 12.5, color: "#92400E", lineHeight: 1.65, fontWeight: 600 }}>
            {t("pt_cal_warn_hint").replace("{total}", total)}
          </p>
        </div>

        <button
          onClick={onClose}
          style={{
            width: "100%", padding: "14px 0", borderRadius: 14,
            border: "none", background: "#BE1E2E",
            color: "#fff", fontWeight: 800, fontSize: 15,
            cursor: "pointer", fontFamily: "inherit",
            boxShadow: "0 6px 18px rgba(190,30,46,0.3)",
          }}
        >
          {t("pt_cal_warn_ok")}
        </button>
      </div>
    </div>
  );
}

export default function PartnerCalendar() {
  const { t } = useLang();
  const DAY_NAMES = [t("pt_cal_sun"), t("pt_cal_mon"), t("pt_cal_tue"), t("pt_cal_wed"), t("pt_cal_thu"), t("pt_cal_fri"), t("pt_cal_sat")];
  const MONTH_NAMES = [
    t("pt_cal_m1"), t("pt_cal_m2"), t("pt_cal_m3"), t("pt_cal_m4"),
    t("pt_cal_m5"), t("pt_cal_m6"), t("pt_cal_m7"), t("pt_cal_m8"),
    t("pt_cal_m9"), t("pt_cal_m10"), t("pt_cal_m11"), t("pt_cal_m12"),
  ];
  const TABS = [
    { key: "CALENDAR", label: t("pt_cal_tab_calendar"), icon: CalendarIcon },
    { key: "REFUNDS",  label: t("pt_cal_tab_refunds"),  icon: RefreshCcw },
  ];
  const REFUND_FILTERS = [
    { value: "",         label: t("pt_cal_rf_all") },
    { value: "PENDING",  label: t("pt_cal_rf_pending") },
    { value: "APPROVED", label: t("pt_cal_rf_approved") },
    { value: "REJECTED", label: t("pt_cal_rf_rejected") },
  ];
  const now = new Date();
  const [activeTab, setActiveTab] = useState("CALENDAR");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedHotelId, setSelectedHotelId] = useState("");
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [calendarError, setCalendarError] = useState("");
  const [rateModal, setRateModal] = useState(null);
  const [rateForm, setRateForm] = useState(EMPTY_RATE_FORM);
  const [aiParams, setAiParams] = useState(null);
  const [refundStatusFilter, setRefundStatusFilter] = useState("");
  const [refundDetail, setRefundDetail] = useState(null);
  const [warnModal, setWarnModal] = useState(null);

  const calFrom = toIsoDate(new Date(year, month, 1));
  const calTo   = toIsoDate(new Date(year, month + 1, 0));

  const { data: hotels = [] } = useMyHotels();
  const { data: rooms = [] }  = usePartnerRooms(selectedHotelId, { enabled: Boolean(selectedHotelId) });
  const { data: calendar, isLoading: calendarLoading, error: calendarQueryError } = useRoomCalendar(
    selectedRoomId,
    { from: calFrom, to: calTo },
  );
  const { data: refundsData, isLoading: refundsLoading } = usePartnerRefunds(
    { hotelId: selectedHotelId || undefined, status: refundStatusFilter || undefined },
    { enabled: activeTab === "REFUNDS" },
  );
  const refunds = Array.isArray(refundsData) ? refundsData : [];

  const { data: aiRaw, isFetching: aiLoading } = usePriceSuggestions(
    selectedRoomId,
    aiParams?.from,
    aiParams?.to,
    { enabled: Boolean(aiParams && selectedRoomId) },
  );

  const aiSuggestionData = useMemo(() => {
    if (!aiRaw) return null;
    const items = (aiRaw?.items || []).filter((i) => i.suggestedPrice > 0);
    if (!items.length) return null;
    const avg = Math.round(items.reduce((s, i) => s + i.suggestedPrice, 0) / items.length / 1000) * 1000;
    const low = Math.min(...items.map((i) => i.priceLow || i.suggestedPrice));
    const high = Math.max(...items.map((i) => i.priceHigh || i.suggestedPrice));
    return {
      suggestedPrice: items.length === 1 ? items[0].suggestedPrice : avg,
      priceLow: low,
      priceHigh: high,
      reason: items.length === 1 ? items[0].reason : null,
      confidence: items[0].confidence,
      aiGenerated: items.some((i) => i.aiGenerated),
      count: items.length,
    };
  }, [aiRaw]);

  const updateCalendar = useUpdateRoomCalendar();
  const approveRefund  = useApproveRefund();
  const rejectRefund   = useRejectRefund();

  const savingRate    = updateCalendar.isPending;
  const actingRefundId = (approveRefund.isPending && approveRefund.variables) ||
                         (rejectRefund.isPending && rejectRefund.variables) || null;

  const selectedHotel = hotels.find((hotel) => String(hotel.id) === String(selectedHotelId)) || null;
  const selectedRoom  = rooms.find((room) => String(room.id) === String(selectedRoomId)) || null;

  // Auto-select first hotel when hotels load
  useEffect(() => {
    if (!hotels.length) return;
    setSelectedHotelId((cur) => {
      if (cur && hotels.some((h) => String(h.id) === String(cur))) return cur;
      return String(hotels[0].id);
    });
  }, [hotels]);

  // Auto-select first room when hotel changes or rooms load
  useEffect(() => {
    if (!selectedHotelId) { setSelectedRoomId(""); return; }
    setSelectedRoomId((cur) => {
      if (cur && rooms.some((r) => String(r.id) === String(cur))) return cur;
      return rooms[0] ? String(rooms[0].id) : "";
    });
  }, [selectedHotelId, rooms]);

  const calendarItems = useMemo(() => calendar?.items || [], [calendar]);

  const itemsByDate = useMemo(() => {
    return new Map(calendarItems.map((item) => [item.date, item]));
  }, [calendarItems]);

  const monthCells = useMemo(() => {
    return buildMonthCells(year, month, itemsByDate);
  }, [itemsByDate, month, year]);

  const todayIso = toIsoDate(now);

  const calendarMetrics = useMemo(() => {
    if (calendarItems.length === 0) {
      return [
        metricCard(CalendarIcon, "Ngày trong tháng", 0, "Chưa có dữ liệu", "red"),
        metricCard(DoorOpen, "TB phòng còn trống", "—", "Trung bình theo ngày", "green"),
        metricCard(AlertCircle, "Ngày tạm đóng", 0, "Không nhận đặt phòng mới", "amber"),
        metricCard(Layers3, "Ngày giá riêng", 0, "Khác giá cơ bản", "blue"),
      ];
    }

    const totalDays = calendarItems.length;
    const closedDays = calendarItems.filter((item) => item.closed).length;
    const customRateDays = calendarItems.filter((item) => item.hasCustomRate).length;
    const avgSellableRooms = Math.round(
      calendarItems.reduce((sum, item) => sum + (item.sellableRooms ?? 0), 0) / totalDays,
    );

    const minPrice = Math.min(...calendarItems.map((item) => Number(item.price || 0)).filter(Boolean));

    return [
      metricCard(CalendarIcon, "Ngày trong tháng", totalDays, selectedRoom?.name || "Phòng đã chọn", "red"),
      metricCard(DoorOpen, "TB phòng còn trống", avgSellableRooms, `Giá thấp nhất ${formatCompactCurrency(minPrice)}`, "green"),
      metricCard(AlertCircle, "Ngày tạm đóng", closedDays, "Không nhận đặt phòng mới", "amber"),
      metricCard(Layers3, "Ngày giá riêng", customRateDays, "Khác giá cơ bản", "blue"),
    ];
  }, [calendarItems, selectedRoom]);

  const refundMetrics = useMemo(() => {
    const pendingCount = refunds.filter((refund) => refund.status === "PENDING").length;
    const approvedTotal = refunds
      .filter((refund) => refund.status === "APPROVED")
      .reduce((sum, refund) => sum + Number(refund.amount || 0), 0);
    const rejectedCount = refunds.filter((refund) => refund.status === "REJECTED").length;

    return [
      metricCard(Clock3, "Chờ xử lý", pendingCount, "Cần phản hồi từ đối tác", "amber"),
      metricCard(CircleDollarSign, "Đã hoàn", formatCurrency(approvedTotal), "Tổng tiền đã duyệt", "green"),
      metricCard(XCircle, "Từ chối", rejectedCount, "Yêu cầu không đạt điều kiện", "red"),
      metricCard(RefreshCcw, "Tổng yêu cầu", refunds.length, selectedHotel?.name || "Toàn bộ khách sạn", "blue"),
    ];
  }, [refunds, selectedHotel]);

  function handleRefundAction(refundId, action) {
    if (action === "approve" && !window.confirm("Duyệt yêu cầu hoàn tiền này?")) return;
    if (action === "reject" && !window.confirm("Từ chối yêu cầu hoàn tiền này?")) return;
    const mutate = action === "approve" ? approveRefund.mutate : rejectRefund.mutate;
    mutate(refundId, {
      onSuccess: (updated) => {
        setRefundDetail((current) => (current?.id === refundId ? updated : current));
      },
    });
  }

  function closeRateModal() {
    setRateModal(null);
    setAiParams(null);
  }

  function openDayRateModal(cell) {
    if (!selectedRoomId || cell.empty) {
      return;
    }

    const item = cell.item;
    setCalendarError("");
    setRateForm({
      startDate: cell.iso,
      endDate: cell.iso,
      price: String(item?.price ?? calendar?.basePrice ?? ""),
      minStay: item?.minStay ? String(item.minStay) : "",
      availableRooms: item?.availableRooms !== null && item?.availableRooms !== undefined
        ? String(item.availableRooms)
        : "",
      closed: Boolean(item?.closed),
      applyWeekendInMonth: false,
    });
    setRateModal({
      scope: "day",
      title: `Cập nhật giá ngày ${formatDate(cell.iso)}`,
      startDate: cell.iso,
      endDate: cell.iso,
      weekend: Boolean(cell.weekend),
    });
    setAiParams({ from: cell.iso, to: cell.iso });
  }

  function openRangeRateModal() {
    if (!selectedRoomId) {
      return;
    }

    const startDate = toIsoDate(new Date(year, month, 1));
    const endDate = toIsoDate(new Date(year, month + 1, 0));
    setCalendarError("");
    setRateForm({
      startDate,
      endDate,
      price: String(calendar?.basePrice ?? selectedRoom?.price ?? ""),
      minStay: "",
      availableRooms: "",
      closed: false,
      applyWeekendInMonth: false,
    });
    setRateModal({
      scope: "range",
      title: "Cập nhật giá theo khoảng ngày",
      startDate,
      endDate,
      weekend: false,
    });
    setAiParams({ from: startDate, to: endDate });
  }

  function openMonthRateModal() {
    if (!selectedRoomId) {
      return;
    }

    const startDate = toIsoDate(new Date(year, month, 1));
    const endDate = toIsoDate(new Date(year, month + 1, 0));
    setCalendarError("");
    setRateForm({
      startDate,
      endDate,
      price: String(calendar?.basePrice ?? selectedRoom?.price ?? ""),
      minStay: "",
      availableRooms: "",
      closed: false,
      applyWeekendInMonth: false,
    });
    setRateModal({
      scope: "month",
      title: `Cập nhật giá ${MONTH_NAMES[month]} ${year}`,
      startDate,
      endDate,
      weekend: false,
    });
    setAiParams({ from: startDate, to: endDate });
  }

  async function handleSaveRate() {
    if (!rateModal || !selectedRoomId) {
      return;
    }

    const price = rateForm.price === "" ? null : Number(rateForm.price);
    const minStay = rateForm.minStay === "" ? null : Number(rateForm.minStay);
    const availableRooms = rateForm.availableRooms === "" ? null : Number(rateForm.availableRooms);
    const startDate = rateForm.startDate || rateModal.startDate;
    const endDate = rateForm.endDate || rateModal.endDate;

    if (!startDate || !endDate) {
      setCalendarError("Vui lòng chọn đủ từ ngày và đến ngày.");
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      setCalendarError("Đến ngày phải bằng hoặc sau từ ngày.");
      return;
    }
    if (price !== null && (!Number.isFinite(price) || price < 0)) {
      setCalendarError("Giá phải là số lớn hơn hoặc bằng 0.");
      return;
    }
    if (minStay !== null && (!Number.isInteger(minStay) || minStay < 1)) {
      setCalendarError("Min stay phải là số nguyên từ 1 trở lên.");
      return;
    }
    if (availableRooms !== null && (!Number.isInteger(availableRooms) || availableRooms < 0)) {
      setCalendarError("Số phòng cho phép đặt phải là số nguyên từ 0 trở lên.");
      return;
    }

    const payload = {
      startDate,
      endDate,
      price,
      minStay,
      closed: rateForm.closed,
      availableRooms,
    };

    const totalRooms = calendar?.defaultQuantity;
    if (availableRooms !== null && totalRooms != null && availableRooms > totalRooms) {
      setWarnModal({
        available: availableRooms,
        total: totalRooms,
        onClose: () => setWarnModal(null),
      });
      return;
    }

    executeSave(payload);
  }

  async function executeSave(payload) {
    setCalendarError("");
    try {
      if (rateForm.applyWeekendInMonth && rateModal?.weekend) {
        const weekendRanges = getWeekendDateRanges(year, month);
        await Promise.all(
          weekendRanges.map((range) =>
            updateCalendar.mutateAsync({ roomId: selectedRoomId, ...payload, startDate: range.startDate, endDate: range.endDate }),
          ),
        );
      } else {
        await updateCalendar.mutateAsync({ roomId: selectedRoomId, ...payload });
      }
      closeRateModal();
    } catch (error) {
      setCalendarError(error.message || "Không thể cập nhật giá phòng.");
    }
  }

  function prevMonth() {
    if (month === 0) {
      setYear((value) => value - 1);
      setMonth(11);
      return;
    }
    setMonth((value) => value - 1);
  }

  function nextMonth() {
    if (month === 11) {
      setYear((value) => value + 1);
      setMonth(0);
      return;
    }
    setMonth((value) => value + 1);
  }

  const calAiScheme = aiSuggestionData
    ? AI_DEMAND_SCHEME[getAiDemandKey(aiSuggestionData.suggestedPrice, rateForm.price)]
    : AI_DEMAND_SCHEME.MEDIUM;

  return (
    <div style={{ paddingBottom: 80 }}>
      <PageHeader
        title={t("pt_cal_title")}
        subtitle={t("pt_cal_subtitle")}
      />

      <div
        style={{
          display: "inline-flex",
          gap: 10,
          padding: 8,
          marginBottom: 28,
          borderRadius: 18,
          background: "#fff",
          border: "1px solid #f1f5f9",
          boxShadow: "0 8px 30px rgba(15, 23, 42, 0.05)",
        }}
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = tab.key === activeTab;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                padding: "12px 18px",
                borderRadius: 14,
                border: "none",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 800,
                background: active ? "#BE1E2E" : "transparent",
                color: active ? "#fff" : "#64748b",
                boxShadow: active ? "0 10px 24px rgba(190, 30, 46, 0.2)" : "none",
              }}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "CALENDAR" ? (
        <section>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 18,
              marginBottom: 24,
            }}
          >
            {calendarMetrics.map((metric) => {
              const tone = METRIC_TONES[metric.tone];
              const Icon = metric.icon;
              return (
                <Card
                  key={metric.label}
                  style={{
                    borderRadius: 22,
                    padding: 22,
                    display: "flex",
                    gap: 16,
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 16,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: tone.bg,
                      color: tone.fg,
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={24} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 800, marginBottom: 4 }}>
                      {metric.label}
                    </div>
                    <div style={{ fontSize: 24, color: "#0f172a", fontWeight: 900, lineHeight: 1.15 }}>
                      {metric.value}
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 5 }}>{metric.hint}</div>
                  </div>
                </Card>
              );
            })}
          </div>

          {(calendarError || calendarQueryError) && (
            <div className="partner-calendar-error">
              {calendarError || calendarQueryError?.message || "Không thể tải lịch phòng."}
            </div>
          )}

          <Card style={{ borderRadius: 26, padding: 0, overflow: "hidden" }}>
            <div
              style={{
                padding: "22px 24px",
                borderBottom: "1px solid #f1f5f9",
                display: "flex",
                flexWrap: "wrap",
                gap: 16,
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
                <div style={{ position: "relative" }}>
                  <Building2
                    size={16}
                    color="#94a3b8"
                    style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }}
                  />
                  <select
                    value={selectedHotelId}
                    onChange={(event) => setSelectedHotelId(event.target.value)}
                    style={{
                      minWidth: 240,
                      padding: "11px 14px 11px 42px",
                      borderRadius: 14,
                      border: "1px solid #e2e8f0",
                      background: "#f8fafc",
                      fontSize: 14,
                      fontWeight: 700,
                      color: "#0f172a",
                      outline: "none",
                    }}
                  >
                    {!hotels.length && <option value="">{t("pt_cal_no_hotels")}</option>}
                    {hotels.map((hotel) => (
                      <option key={hotel.id} value={hotel.id}>
                        {hotel.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ position: "relative" }}>
                  <Hotel
                    size={16}
                    color="#94a3b8"
                    style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }}
                  />
                  <select
                    value={selectedRoomId}
                    onChange={(event) => setSelectedRoomId(event.target.value)}
                    style={{
                      minWidth: 220,
                      padding: "11px 14px 11px 42px",
                      borderRadius: 14,
                      border: "1px solid #e2e8f0",
                      background: "#f8fafc",
                      fontSize: 14,
                      fontWeight: 700,
                      color: "#0f172a",
                      outline: "none",
                    }}
                  >
                    {!rooms.length && <option value="">{t("pt_cal_no_rooms")}</option>}
                    {rooms.map((room) => (
                      <option key={room.id} value={room.id}>
                        {room.name}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={openMonthRateModal}
                  disabled={!selectedRoomId || calendarLoading}
                  className="partner-calendar-month-rate-btn"
                >
                  <CircleDollarSign size={16} />
                  Cập nhật giá tháng
                </button>

                <button
                  type="button"
                  onClick={openRangeRateModal}
                  disabled={!selectedRoomId || calendarLoading}
                  className="partner-calendar-range-rate-btn"
                >
                  <CalendarIcon size={16} />
                  Theo khoảng ngày
                </button>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: 8,
                  borderRadius: 16,
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                }}
              >
                <button type="button" onClick={prevMonth} style={monthNavButtonStyle}>
                  <ChevronLeft size={18} />
                </button>
                <div style={{ minWidth: 180, textAlign: "center", fontSize: 16, fontWeight: 900, color: "#0f172a" }}>
                  {MONTH_NAMES[month]} {year}
                </div>
                <button type="button" onClick={nextMonth} style={monthNavButtonStyle}>
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>

            {!selectedRoomId ? (
              <div style={{ padding: 48, color: "#64748b", textAlign: "center" }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#334155", marginBottom: 6 }}>
                  Chưa có phòng để hiển thị lịch
                </div>
                <div style={{ fontSize: 13 }}>Hãy chọn khách sạn có loại phòng khả dụng.</div>
              </div>
            ) : calendarLoading ? (
              <div className="partner-calendar-loading">
                <div className="partner-calendar-spinner" />
                Đang tải lịch phòng...
              </div>
            ) : (
              <div style={{ padding: 24 }}>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 10,
                    marginBottom: 18,
                    alignItems: "center",
                    color: "#64748b",
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  <span style={{ ...chipStyle, background: "#F8FAFC", color: "#475569" }}>
                    Giá cơ bản: {formatCurrency(calendar?.basePrice)}
                  </span>
                  <span style={{ ...chipStyle, background: "#F8FAFC", color: "#475569" }}>
                    Tổng số phòng: {calendar?.defaultQuantity ?? "—"}
                  </span>
                  <span style={{ ...chipStyle, background: "#FFF7ED", color: "#C2410C" }}>
                    <Info size={12} />
                    Click vào ô ngày để chỉnh giá hoặc đóng phòng
                  </span>
                </div>

                <div style={{ overflowX: "auto" }}>
                  <div style={{ minWidth: 900 }}>
                    <div className="partner-calendar-grid">
                      {DAY_NAMES.map((dayName, dayIndex) => (
                        <div
                          key={dayName}
                          className={`partner-calendar-day-header${dayIndex === 0 || dayIndex === 6 ? " partner-calendar-day-header-weekend" : ""}`}
                        >
                          {dayName}
                        </div>
                      ))}
                    </div>

                    <div className="partner-calendar-days-grid">
                      {monthCells.map((cell) => {
                        if (cell.empty) {
                          return <div key={cell.key} className="partner-calendar-empty-cell" />;
                        }

                        const item = cell.item;
                        const isToday = cell.iso === todayIso;
                        const isPast = !isToday && cell.iso < todayIso;
                        const isClosed = Boolean(item?.closed);
                        const isWeekend = Boolean(cell.weekend);
                        const hasCustomRate = Boolean(item?.hasCustomRate);
                        const displayedPrice = item?.price ?? calendar?.basePrice;
                        const sellable = item?.sellableRooms ?? 0;
                        const booked = item?.bookedRooms ?? 0;
                        const totalRooms = calendar?.defaultQuantity ?? 0;
                        const availPct = totalRooms > 0 ? Math.round((sellable / totalRooms) * 100) : 0;
                        // Palette: #BE1E2E (low) → #F87171 (mid) → #FECDD3 (high)
                        const barColor = isClosed || isPast ? "#e2e8f0"
                          : sellable === 0   ? "#cbd5e1"
                          : availPct <= 30   ? "#BE1E2E"
                          : availPct <= 60   ? "#F87171"
                          :                    "#FECDD3";
                        const numColor = sellable === 0 ? "#94a3b8"
                          : availPct <= 30   ? "#BE1E2E"
                          : availPct <= 60   ? "#F87171"
                          :                    "#BE1E2E";

                        return (
                          <div
                            key={cell.key}
                            className={`partner-calendar-cell${isWeekend && !isPast ? " partner-calendar-cell-weekend" : ""}`}
                            onClick={() => !isPast && openDayRateModal(cell)}
                            title={isPast ? "Ngày đã qua" : "Click để chỉnh giá / tình trạng phòng"}
                            style={{
                              "--cell-bg": isPast
                                ? "#f8fafc"
                                : isToday
                                ? "#FFF1F2"
                                : isClosed
                                ? "#fafafa"
                                : undefined,
                              "--cell-border": isPast
                                ? "1px solid #e2e8f0"
                                : isToday
                                ? "1.5px solid #FECDD3"
                                : isClosed
                                ? "1px solid #e2e8f0"
                                : undefined,
                              "--cell-accent": isPast
                                ? "transparent"
                                : isToday
                                ? "#BE1E2E"
                                : isClosed
                                ? "#e2e8f0"
                                : hasCustomRate
                                ? "#F87171"
                                : isWeekend
                                ? "#F87171"
                                : "#f1f5f9",
                              opacity: isPast ? 0.42 : 1,
                              cursor: isPast ? "default" : "pointer",
                              pointerEvents: isPast ? "none" : undefined,
                            }}
                          >
                            {/* Row 1: ngày + badge trạng thái */}
                            <div className="pc-day-row">
                              <div
                                className="pc-day-num"
                                style={{
                                  background: isToday ? "#BE1E2E" : "transparent",
                                  color: isToday ? "#fff"
                                    : isPast ? "#94a3b8"
                                    : isClosed ? "#94a3b8"
                                    : isWeekend ? "#BE1E2E"
                                    : "#0f172a",
                                  fontWeight: isWeekend && !isToday ? 900 : 900,
                                }}
                              >
                                {cell.day}
                              </div>

                              {!isPast && (
                                isClosed ? (
                                  <span className="pc-badge" style={{ background: "#FFF1F2", color: "#BE1E2E" }}>
                                    Tạm đóng
                                  </span>
                                ) : hasCustomRate ? (
                                  <span className="pc-badge" style={{ background: "#FECDD3", color: "#9f1239" }}>
                                    Giá riêng
                                  </span>
                                ) : isWeekend ? (
                                  <span className="pc-badge" style={{ background: "#FFF1F2", color: "#BE1E2E", opacity: 0.7 }}>
                                    Cuối tuần
                                  </span>
                                ) : null
                              )}
                            </div>

                            {/* Row 2: giá */}
                            <div
                              className="pc-price"
                              style={{
                                color: isPast
                                  ? "#cbd5e1"
                                  : isClosed
                                  ? "#94a3b8"
                                  : "#0f172a",
                              }}
                            >
                              {isPast
                                ? "—"
                                : isClosed
                                ? "Không nhận đặt"
                                : formatCompactCurrency(displayedPrice)}
                            </div>

                            {/* Divider */}
                            {!isPast && <div className="pc-divider" />}

                            {/* Row 3: tình trạng phòng */}
                            {!isPast && totalRooms > 0 && (
                              <>
                                <div className="pc-avail-label">Phòng trống</div>
                                <div className="pc-avail-track">
                                  <div
                                    className="pc-avail-fill"
                                    style={{ width: `${availPct}%`, background: barColor }}
                                  />
                                </div>
                                <div className="pc-avail-nums">
                                  <span>
                                    <span style={{ color: numColor, fontWeight: 800, fontSize: 13 }}>
                                      {isClosed ? "—" : sellable}
                                    </span>
                                    <span style={{ color: "#94a3b8" }}> / {totalRooms} phòng</span>
                                  </span>
                                  {!isClosed && booked > 0 && (
                                    <span style={{ color: "#BE1E2E", fontWeight: 700, fontSize: 10 }}>
                                      {booked} đã đặt
                                    </span>
                                  )}
                                </div>
                              </>
                            )}

                            {/* Row 4: lưu trú tối thiểu */}
                            {!isPast && item?.minStay > 1 && (
                              <div className="pc-minstay">
                                ⏱ Lưu trú tối thiểu {item.minStay} đêm
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </section>
      ) : (
        <section>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 18,
              marginBottom: 24,
            }}
          >
            {refundMetrics.map((metric) => {
              const tone = METRIC_TONES[metric.tone];
              const Icon = metric.icon;
              return (
                <Card
                  key={metric.label}
                  style={{
                    borderRadius: 22,
                    padding: 22,
                    display: "flex",
                    gap: 16,
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 16,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: tone.bg,
                      color: tone.fg,
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={24} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 800, marginBottom: 4 }}>
                      {metric.label}
                    </div>
                    <div style={{ fontSize: typeof metric.value === "string" ? 20 : 24, color: "#0f172a", fontWeight: 900, lineHeight: 1.15 }}>
                      {metric.value}
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 5 }}>{metric.hint}</div>
                  </div>
                </Card>
              );
            })}
          </div>

          <Card style={{ borderRadius: 26 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
                marginBottom: 18,
              }}
            >
              <div>
                <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a" }}>{t("pt_cal_rf_title")}</div>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <select
                  value={selectedHotelId}
                  onChange={(event) => setSelectedHotelId(event.target.value)}
                  style={selectFilterStyle}
                >
                  {!hotels.length && <option value="">{t("pt_cal_no_hotels")}</option>}
                  {hotels.map((hotel) => (
                    <option key={hotel.id} value={hotel.id}>
                      {hotel.name}
                    </option>
                  ))}
                </select>

                <select
                  value={refundStatusFilter}
                  onChange={(event) => setRefundStatusFilter(event.target.value)}
                  style={selectFilterStyle}
                >
                  {REFUND_FILTERS.map((option) => (
                    <option key={option.value || "all"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {refundsLoading ? (
              <div style={{ padding: 48, textAlign: "center", color: "#64748b" }}>{t("pt_cal_rf_loading")}</div>
            ) : (
              <Table
                headers={["Mã", "Booking", t("pt_cal_rf_col_hotel"), t("pt_cal_rf_col_guest"), t("pt_cal_rf_col_amount"), t("adm_status"), t("adm_actions")]}
                rows={refunds.map((refund) => [
                  <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#64748b" }}>#{refund.id}</span>,
                  <span style={{ fontWeight: 800, color: "#BE1E2E" }}>#{refund.bookingId}</span>,
                  <span style={{ fontWeight: 700, color: "#0f172a" }}>{refund.hotelName}</span>,
                  <span style={{ color: "#475569" }}>{refund.userEmail}</span>,
                  <span style={{ fontWeight: 800, color: "#0f172a" }}>{formatCurrency(refund.amount)}</span>,
                  <Badge status={refund.status} />,
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <Btn small variant="ghost" onClick={() => setRefundDetail(refund)}>
                      {t("adm_detail")}
                    </Btn>
                    {refund.status === "PENDING" && (
                      <>
                        <Btn
                          small
                          variant="success"
                          loading={actingRefundId === refund.id}
                          onClick={() => handleRefundAction(refund.id, "approve")}
                        >
                          {t("adm_approve")}
                        </Btn>
                        <Btn
                          small
                          variant="danger"
                          loading={actingRefundId === refund.id}
                          onClick={() => handleRefundAction(refund.id, "reject")}
                        >
                          {t("adm_reject")}
                        </Btn>
                      </>
                    )}
                  </div>,
                ])}
                empty={t("pt_cal_rf_empty")}
              />
            )}
          </Card>
        </section>
      )}

      {rateModal && (
        <Modal title={rateModal.title} onClose={closeRateModal} width={560}>
          <div className="partner-calendar-rate-form">
            <div className="partner-calendar-rate-summary">
              <div>
                <div className="partner-calendar-rate-label">Phòng</div>
                <div className="partner-calendar-rate-value">{selectedRoom?.name || calendar?.roomName || "—"}</div>
              </div>
              <div>
                <div className="partner-calendar-rate-label">Khoảng ngày</div>
                <div className="partner-calendar-rate-value">
                  {formatDate(rateForm.startDate || rateModal.startDate)} - {formatDate(rateForm.endDate || rateModal.endDate)}
                </div>
              </div>
            </div>

            {/* AI Price Suggestion */}
            {(aiLoading || aiSuggestionData) && (
              <div style={{ marginBottom: 16 }}>
                {aiLoading ? (
                  <div style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "11px 14px", background: "#f8fafc",
                    borderRadius: 12, border: "1px solid #e2e8f0",
                    color: "#94a3b8", fontSize: 13,
                  }}>
                    <Sparkles size={13} style={{ opacity: 0.4, flexShrink: 0 }} />
                    Đang tải đề xuất giá AI...
                  </div>
                ) : aiSuggestionData && (
                  <div style={{
                    borderRadius: 14,
                    background: calAiScheme.bg,
                    border: `1.5px solid ${calAiScheme.border}`,
                    overflow: "hidden",
                  }}>
                    {/* Row 1: header + apply btn */}
                    <div style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "12px 16px 0",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Sparkles size={13} color={calAiScheme.accent} />
                        <span style={{ fontSize: 11, fontWeight: 900, color: calAiScheme.accent, letterSpacing: 0.3 }}>
                          {aiSuggestionData.aiGenerated ? "GEMINI AI" : "THỐNG KÊ"}
                          {aiSuggestionData.count > 1 && ` · TB ${aiSuggestionData.count} ngày`}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setRateForm((f) => ({ ...f, price: String(aiSuggestionData.suggestedPrice) }))}
                        style={{
                          padding: "5px 14px", borderRadius: 8, border: "none",
                          background: calAiScheme.accent, color: "#fff",
                          fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
                          boxShadow: `0 3px 8px ${calAiScheme.accent}44`,
                        }}
                      >
                        Áp dụng
                      </button>
                    </div>

                    {/* Row 2: suggested price */}
                    <div style={{ padding: "8px 16px 4px", fontSize: 22, fontWeight: 900, color: calAiScheme.accent, lineHeight: 1.1 }}>
                      {formatCurrency(aiSuggestionData.suggestedPrice)}
                    </div>

                    {/* Row 3: range + demand label */}
                    <div style={{
                      padding: "0 16px 12px",
                      display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
                    }}>
                      <span style={{ fontSize: 12, color: calAiScheme.textDark, opacity: 0.75 }}>
                        Khoảng: {formatCompactCurrency(aiSuggestionData.priceLow)} – {formatCompactCurrency(aiSuggestionData.priceHigh)}
                      </span>
                      <span style={{
                        padding: "2px 8px", borderRadius: 99,
                        background: calAiScheme.border, color: calAiScheme.accent,
                        fontSize: 10, fontWeight: 900,
                      }}>
                        {calAiScheme.label}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="partner-calendar-rate-grid">
              {rateModal.scope === "range" && (
                <>
                  <label className="partner-calendar-rate-field">
                    <span>{t("pt_cal_start_date")}</span>
                    <input
                      type="date"
                      value={rateForm.startDate}
                      onChange={(event) => setRateForm((current) => ({ ...current, startDate: event.target.value }))}
                    />
                  </label>

                  <label className="partner-calendar-rate-field">
                    <span>{t("pt_cal_end_date")}</span>
                    <input
                      type="date"
                      value={rateForm.endDate}
                      onChange={(event) => setRateForm((current) => ({ ...current, endDate: event.target.value }))}
                    />
                  </label>
                </>
              )}

              <label className="partner-calendar-rate-field">
                <span>{t("pt_cal_price")}</span>
                <input
                  type="number"
                  min="0"
                  step="10000"
                  value={rateForm.price}
                  onChange={(event) => setRateForm((current) => ({ ...current, price: event.target.value }))}
                  placeholder={t("pt_cal_price_ph")}
                />
              </label>

              <label className="partner-calendar-rate-field">
                <span>{t("pt_cal_min_stay")}</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={rateForm.minStay}
                  onChange={(event) => setRateForm((current) => ({ ...current, minStay: event.target.value }))}
                  placeholder={t("pt_cal_min_stay_ph")}
                />
              </label>

              <label className="partner-calendar-rate-field">
                <span>{t("pt_cal_available")}</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={rateForm.availableRooms}
                  onChange={(event) => setRateForm((current) => ({ ...current, availableRooms: event.target.value }))}
                  placeholder={t("pt_cal_available_ph")}
                />
              </label>

              <label className="partner-calendar-rate-toggle">
                <input
                  type="checkbox"
                  checked={rateForm.closed}
                  onChange={(event) => setRateForm((current) => ({ ...current, closed: event.target.checked }))}
                />
                <span>{t("pt_cal_closed")}</span>
              </label>

              {rateModal.weekend && (
                <label className="partner-calendar-rate-toggle partner-calendar-rate-toggle-weekend">
                  <input
                    type="checkbox"
                    checked={rateForm.applyWeekendInMonth}
                    onChange={(event) => setRateForm((current) => ({ ...current, applyWeekendInMonth: event.target.checked }))}
                  />
                  <span>{t("pt_cal_apply_weekend")}</span>
                </label>
              )}
            </div>

            <div className="partner-calendar-rate-note">
              {rateForm.applyWeekendInMonth && rateModal.weekend
                ? "Thao tác này chỉ áp dụng cho các ngày thứ 7 và chủ nhật trong tháng đang xem."
                : rateModal.scope === "month"
                  ? "Thao tác này áp dụng cho toàn bộ tháng đang xem. Các ngày chưa từng chỉnh sẽ chuyển sang dùng giá mới."
                  : rateModal.scope === "range"
                    ? "Thao tác này áp dụng liên tục từ ngày bắt đầu đến ngày kết thúc đã chọn."
                    : "Ngày chưa có giá riêng sẽ dùng giá mặc định của loại phòng. Lưu ở đây sẽ tạo giá riêng cho ngày được chọn."}
            </div>

            <div className="partner-calendar-rate-actions">
              <Btn variant="ghost" onClick={closeRateModal}>
                {t("adm_cancel")}
              </Btn>
              <Btn loading={savingRate} onClick={handleSaveRate}>
                {savingRate ? t("pt_cal_saving") : t("pt_cal_save")}
              </Btn>
            </div>
          </div>
        </Modal>
      )}

      {refundDetail && (
        <Modal title={`Yêu cầu hoàn tiền #${refundDetail.id}`} onClose={() => setRefundDetail(null)} width={620}>
          <div style={{ display: "grid", gap: 18 }}>
            <div
              style={{
                padding: 18,
                borderRadius: 18,
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
              }}
            >
              <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 800, marginBottom: 5 }}>KHÁCH SẠN</div>
              <div style={{ fontSize: 20, color: "#0f172a", fontWeight: 900 }}>{refundDetail.hotelName}</div>
              <div style={{ fontSize: 14, color: "#475569", marginTop: 4 }}>{refundDetail.userEmail}</div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
              {[
                ["Booking", `#${refundDetail.bookingId}`],
                ["Số tiền", formatCurrency(refundDetail.amount)],
                ["Check-in", formatDate(refundDetail.checkIn)],
                ["Check-out", formatDate(refundDetail.checkOut)],
                ["Yêu cầu lúc", formatDateTime(refundDetail.requestedAt)],
                ["Đã xử lý lúc", formatDateTime(refundDetail.reviewedAt)],
              ].map(([label, value]) => (
                <div
                  key={label}
                  style={{
                    padding: 14,
                    borderRadius: 14,
                    border: "1px solid #e2e8f0",
                    background: "#fff",
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#94a3b8", marginBottom: 5 }}>{label}</div>
                  <div style={{ fontSize: 14, color: "#0f172a", fontWeight: 800 }}>{value}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, color: "#64748b", fontWeight: 700 }}>Trạng thái:</span>
              <Badge status={refundDetail.status} />
            </div>

            <div
              style={{
                padding: 18,
                borderRadius: 18,
                background: "#FFF7ED",
                border: "1px solid #FED7AA",
              }}
            >
              <div style={{ fontSize: 12, color: "#C2410C", fontWeight: 900, marginBottom: 8 }}>LÝ DO</div>
              <div style={{ fontSize: 14, color: "#7C2D12", lineHeight: 1.7 }}>{refundDetail.reason || "—"}</div>
              {refundDetail.note && (
                <>
                  <div style={{ fontSize: 12, color: "#C2410C", fontWeight: 900, marginTop: 14, marginBottom: 8 }}>
                    GHI CHÚ
                  </div>
                  <div style={{ fontSize: 14, color: "#7C2D12", lineHeight: 1.7 }}>{refundDetail.note}</div>
                </>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <Btn variant="ghost" onClick={() => setRefundDetail(null)}>
                {t("adm_close")}
              </Btn>
              {refundDetail.status === "PENDING" && (
                <>
                  <Btn
                    variant="danger"
                    loading={actingRefundId === refundDetail.id}
                    onClick={() => handleRefundAction(refundDetail.id, "reject")}
                  >
                    {t("adm_reject")}
                  </Btn>
                  <Btn
                    loading={actingRefundId === refundDetail.id}
                    onClick={() => handleRefundAction(refundDetail.id, "approve")}
                  >
                    {t("adm_approve")}
                  </Btn>
                </>
              )}
            </div>
          </div>
        </Modal>
      )}

      {warnModal && (
        <WarningModal
          available={warnModal.available}
          total={warnModal.total}
          onClose={warnModal.onClose}
        />
      )}
    </div>
  );
}

const monthNavButtonStyle = {
  width: 40,
  height: 40,
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  background: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#475569",
  cursor: "pointer",
};

const selectFilterStyle = {
  minWidth: 190,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  background: "#fff",
  fontSize: 14,
  fontWeight: 700,
  color: "#0f172a",
  outline: "none",
};
