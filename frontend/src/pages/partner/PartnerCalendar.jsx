import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Calendar as CalendarIcon, RefreshCcw } from "lucide-react";
import { PageHeader } from "../../components/admin/AdminLayout";
import {
  useMyHotels, usePartnerRooms, useRoomCalendar, useUpdateRoomCalendar,
  usePartnerRefunds, useApproveRefund, useRejectRefund, usePriceSuggestions,
  usePartnerBookings, useHotelRoomUnits,
} from "../../hooks/usePartnerQueries";
import { useLang } from "../../contexts/LanguageContext";
import {
  toIsoDate, buildMonthCells, getWeekendRanges,
} from "../../components/partner/calendar/calendarUtils";
import CalendarKPIs        from "../../components/partner/calendar/CalendarKPIs";
import CalendarSidebar     from "../../components/partner/calendar/CalendarSidebar";
import CalendarToolbar     from "../../components/partner/calendar/CalendarToolbar";
import CalendarGrid        from "../../components/partner/calendar/CalendarGrid";
import DayOccupancyModal   from "../../components/partner/calendar/DayOccupancyModal";
import PricingModal        from "../../components/partner/calendar/PricingModal";
import RefundDashboard     from "../../components/partner/calendar/RefundDashboard";
import "../../styles/pages/PartnerCalendar.css";

const EMPTY_FORM = {
  startDate: "", endDate: "", price: "", minStay: "", availableRooms: "",
  closed: false, closeReason: "", applyWeekendInMonth: false,
};

export default function PartnerCalendar() {
  const { t } = useLang();
  const { selectedHotelId: ctxHotelId, setSelectedHotelId: setCtxHotelId } = useOutletContext() || {};

  const DAY_NAMES = [
    t("pt_cal_sun"), t("pt_cal_mon"), t("pt_cal_tue"), t("pt_cal_wed"),
    t("pt_cal_thu"), t("pt_cal_fri"), t("pt_cal_sat"),
  ];
  const MONTH_NAMES = [
    t("pt_cal_m1"),  t("pt_cal_m2"),  t("pt_cal_m3"),  t("pt_cal_m4"),
    t("pt_cal_m5"),  t("pt_cal_m6"),  t("pt_cal_m7"),  t("pt_cal_m8"),
    t("pt_cal_m9"),  t("pt_cal_m10"), t("pt_cal_m11"), t("pt_cal_m12"),
  ];

  const now = new Date();
  const todayIso = toIsoDate(now);

  const [activeTab,          setActiveTab]          = useState("CALENDAR");
  const [year,               setYear]               = useState(now.getFullYear());
  const [month,              setMonth]              = useState(now.getMonth());
  const [selectedHotelId,    setSelectedHotelId]    = useState(ctxHotelId ? String(ctxHotelId) : "");
  const [selectedRoomId,     setSelectedRoomId]     = useState("");

  // day occupancy modal (first click on a cell)
  const [dayModal,           setDayModal]           = useState(null); // { iso, item, weekend }

  // pricing modal (from toolbar bulk actions or "Chỉnh giá" button in day modal)
  const [rateModal,          setRateModal]          = useState(null);
  const [rateForm,           setRateForm]           = useState(EMPTY_FORM);
  const [calError,           setCalError]           = useState("");
  const [aiParams,           setAiParams]           = useState(null);
  const [warnModal,          setWarnModal]          = useState(null);
  const [refundStatusFilter, setRefundStatusFilter] = useState("");

  const calFrom = toIsoDate(new Date(year, month, 1));
  const calTo   = toIsoDate(new Date(year, month + 1, 0));

  const { data: hotels = [] } = useMyHotels();
  const { data: rooms  = [] } = usePartnerRooms(selectedHotelId, { enabled: Boolean(selectedHotelId) });
  const { data: calendar, isLoading: calendarLoading, error: calendarQueryError } = useRoomCalendar(
    selectedRoomId,
    { from: calFrom, to: calTo },
  );

  // Preload month bookings for the DayOccupancyModal guest list
  const { data: monthBookingsPage, isLoading: bookingsLoading } = usePartnerBookings(
    { hotelId: selectedHotelId ? Number(selectedHotelId) : undefined, checkInFrom: calFrom, checkInTo: calTo, size: 50 },
    { enabled: activeTab === "CALENDAR" && Boolean(selectedHotelId) },
  );
  const monthBookings = useMemo(
    () => monthBookingsPage?.items ?? monthBookingsPage ?? [],
    [monthBookingsPage],
  );

  const { data: allUnitData = [] } = useHotelRoomUnits(selectedHotelId);
  const roomUnits = useMemo(
    () => (Array.isArray(allUnitData) ? allUnitData : []).filter(u => String(u.roomId) === String(selectedRoomId)),
    [allUnitData, selectedRoomId],
  );

  const { data: refundsData, isLoading: refundsLoading } = usePartnerRefunds(
    { hotelId: selectedHotelId || undefined, status: refundStatusFilter || undefined },
    { enabled: activeTab === "REFUNDS" },
  );
  const refunds = Array.isArray(refundsData) ? refundsData : [];

  const { data: aiRaw, isFetching: aiLoading } = usePriceSuggestions(
    selectedRoomId, aiParams?.from, aiParams?.to,
    { enabled: Boolean(aiParams && selectedRoomId) },
  );

  const aiData = useMemo(() => {
    if (!aiRaw) return null;
    const items = (aiRaw?.items || []).filter(i => i.suggestedPrice > 0);
    if (!items.length) return null;
    const avg = Math.round(items.reduce((s, i) => s + i.suggestedPrice, 0) / items.length / 1000) * 1000;
    return {
      suggestedPrice: items.length === 1 ? items[0].suggestedPrice : avg,
      priceLow:    Math.min(...items.map(i => i.priceLow  || i.suggestedPrice)),
      priceHigh:   Math.max(...items.map(i => i.priceHigh || i.suggestedPrice)),
      aiGenerated: items.some(i => i.aiGenerated),
      count:       items.length,
    };
  }, [aiRaw]);

  const updateCalendar = useUpdateRoomCalendar();
  const approveRefund  = useApproveRefund();
  const rejectRefund   = useRejectRefund();

  const selectedRoom   = rooms.find(r => String(r.id) === String(selectedRoomId)) || null;
  const calendarItems  = useMemo(() => calendar?.items || [], [calendar]);
  const itemsByDate    = useMemo(() => new Map(calendarItems.map(i => [i.date, i])), [calendarItems]);
  const monthCells     = useMemo(() => buildMonthCells(year, month, itemsByDate), [year, month, itemsByDate]);

  // ── Effects ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!hotels.length) return;
    setSelectedHotelId(cur => {
      if (cur && hotels.some(h => String(h.id) === String(cur))) return cur;
      return String(hotels[0].id);
    });
  }, [hotels]);

  useEffect(() => {
    if (!ctxHotelId) return;
    setSelectedHotelId(String(ctxHotelId));
  }, [ctxHotelId]);

  useEffect(() => {
    if (!selectedHotelId) { setSelectedRoomId(""); return; }
    setSelectedRoomId(cur => {
      if (cur && rooms.some(r => String(r.id) === String(cur))) return cur;
      return rooms[0] ? String(rooms[0].id) : "";
    });
  }, [selectedHotelId, rooms]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  function handleHotelChange(id) {
    setSelectedHotelId(id);
    setCtxHotelId?.(id ? Number(id) : null);
  }

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }

  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  }

  function goToday() {
    setYear(now.getFullYear());
    setMonth(now.getMonth());
  }

  // Clicking a calendar cell → DayOccupancyModal (with edit tab ready)
  function openDayModal(cell) {
    if (!selectedRoomId || cell.empty) return;
    setCalError("");
    setRateForm({
      startDate:           cell.iso,
      endDate:             cell.iso,
      price:               String(cell.item?.price ?? calendar?.basePrice ?? ""),
      minStay:             cell.item?.minStay ? String(cell.item.minStay) : "",
      availableRooms:      cell.item?.availableRooms != null ? String(cell.item.availableRooms) : "",
      closed:              Boolean(cell.item?.closed),
      closeReason:         cell.item?.closeReason || "",
      applyWeekendInMonth: false,
    });
    setDayModal({ iso: cell.iso, item: cell.item, weekend: Boolean(cell.weekend) });
  }

  function closeRateModal() {
    setRateModal(null);
    setDayModal(null);
    setAiParams(null);
    setCalError("");
  }

  function openRangeRateModal() {
    if (!selectedRoomId) return;
    setCalError("");
    setRateForm({
      startDate: calFrom, endDate: calTo,
      price: String(calendar?.basePrice ?? selectedRoom?.price ?? ""),
      minStay: "", availableRooms: "", closed: false, applyWeekendInMonth: false,
    });
    setRateModal({ scope: "range", startDate: calFrom, endDate: calTo, weekend: false });
    setAiParams({ from: calFrom, to: calTo });
  }

  function openMonthRateModal() {
    if (!selectedRoomId) return;
    setCalError("");
    setRateForm({
      startDate: calFrom, endDate: calTo,
      price: String(calendar?.basePrice ?? selectedRoom?.price ?? ""),
      minStay: "", availableRooms: "", closed: false, applyWeekendInMonth: false,
    });
    setRateModal({ scope: "month", startDate: calFrom, endDate: calTo, weekend: false });
    setAiParams({ from: calFrom, to: calTo });
  }

  async function handleSaveRate(form, modal) {
    if (!modal || !selectedRoomId) return;

    const price          = form.price          === "" ? null : Number(form.price);
    const minStay        = form.minStay        === "" ? null : Number(form.minStay);
    const availableRooms = form.availableRooms === "" ? null : Number(form.availableRooms);
    const startDate      = form.startDate || modal.startDate;
    const endDate        = form.endDate   || modal.endDate;

    if (!startDate || !endDate) { setCalError("Vui lòng chọn đủ từ ngày và đến ngày."); return; }
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (new Date(startDate) < today) { setCalError("Từ ngày không được là ngày trong quá khứ."); return; }
    if (new Date(endDate) < new Date(startDate)) { setCalError("Đến ngày phải bằng hoặc sau từ ngày."); return; }
    if (price !== null && (!Number.isFinite(price) || price < 0)) { setCalError("Giá phải là số ≥ 0."); return; }
    if (price !== null && price > 0 && price < 10000) { setCalError("Giá phải từ 10.000 ₫ trở lên."); return; }
    if (minStay !== null && (!Number.isInteger(minStay) || minStay < 1)) { setCalError("Min stay phải là số nguyên từ 1 trở lên."); return; }
    if (minStay !== null && minStay > 365) { setCalError("Min stay tối đa là 365 đêm."); return; }
    if (availableRooms !== null && (!Number.isInteger(availableRooms) || availableRooms < 0)) { setCalError("Số phòng cho phép đặt phải là số nguyên từ 0 trở lên."); return; }

    const totalRooms = calendar?.defaultQuantity;
    if (availableRooms !== null && totalRooms != null && availableRooms > totalRooms) {
      setWarnModal({ available: availableRooms, total: totalRooms });
      return;
    }

    const closeReason = form.closed ? (form.closeReason?.trim() || null) : null;
    const payload = { startDate, endDate, price, minStay, closed: form.closed, availableRooms, closeReason };
    setCalError("");
    try {
      if (form.applyWeekendInMonth && modal.weekend) {
        const ranges = getWeekendRanges(year, month);
        await Promise.all(
          ranges.map(r => updateCalendar.mutateAsync({ roomId: selectedRoomId, ...payload, startDate: r.startDate, endDate: r.endDate })),
        );
      } else {
        await updateCalendar.mutateAsync({ roomId: selectedRoomId, ...payload });
      }
      closeRateModal();
    } catch (err) {
      const fieldErrors = err.details?.map(d => `${d.field}: ${d.message}`).join("; ");
      setCalError(fieldErrors ? `${err.message} (${fieldErrors})` : err.message || "Không thể cập nhật giá phòng.");
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  const TABS = [
    { key: "CALENDAR", label: t("pt_cal_tab_calendar"), icon: CalendarIcon },
    { key: "REFUNDS",  label: t("pt_cal_tab_refunds"),  icon: RefreshCcw  },
  ];

  return (
    <div className="pcal-root">
      <PageHeader title={t("pt_cal_title")} subtitle={t("pt_cal_subtitle")} />

      <div className="pcal-tabs">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            className={`pcal-tab${activeTab === key ? " pcal-tab--active" : ""}`}
            onClick={() => setActiveTab(key)}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {activeTab === "CALENDAR" ? (
        <section>
          <CalendarKPIs
            items={calendarItems}
            defaultQuantity={calendar?.defaultQuantity}
            basePrice={calendar?.basePrice}
            todayIso={todayIso}
            loading={calendarLoading && Boolean(selectedRoomId)}
            roomUnits={roomUnits}
          />

          {(calError || calendarQueryError) && (
            <div className="partner-calendar-error">
              {calError || calendarQueryError?.message || "Không thể tải lịch phòng."}
            </div>
          )}

          <div className="pcal-content-row">
            <div className="pcal-grid-card">
              <CalendarGrid
                monthCells={monthCells}
                todayIso={todayIso}
                calendar={calendar}
                calendarLoading={calendarLoading}
                selectedRoomId={selectedRoomId}
                dayNames={DAY_NAMES}
                onCellClick={openDayModal}
              />
            </div>
            <div className="pcal-sidebar">
              <CalendarToolbar
                hotels={hotels}
                rooms={rooms}
                selectedHotelId={selectedHotelId}
                selectedRoomId={selectedRoomId}
                onHotelChange={handleHotelChange}
                onRoomChange={setSelectedRoomId}
                year={year}
                month={month}
                monthNames={MONTH_NAMES}
                todayMonth={now.getMonth()}
                todayYear={now.getFullYear()}
                onPrevMonth={prevMonth}
                onNextMonth={nextMonth}
                onToday={goToday}
                onMonthUpdate={openMonthRateModal}
                onRangeUpdate={openRangeRateModal}
                disabled={!selectedRoomId || calendarLoading}
              />
              <CalendarSidebar
                items={calendarItems}
                todayIso={todayIso}
                defaultQuantity={calendar?.defaultQuantity}
              />
            </div>
          </div>

          {/* Day occupancy + pricing modal — two tabs in one */}
          <DayOccupancyModal
            key={dayModal?.iso}
            modal={dayModal}
            calendar={calendar}
            bookings={monthBookings}
            bookingsLoading={bookingsLoading}
            onClose={closeRateModal}
            form={rateForm}
            onChange={setRateForm}
            onSave={handleSaveRate}
            saving={updateCalendar.isPending}
            error={calError}
            aiData={aiData}
            aiLoading={aiLoading}
            onEditTabOpen={() => dayModal && setAiParams({ from: dayModal.iso, to: dayModal.iso })}
            roomUnits={roomUnits}
            warnModal={warnModal}
            onWarnClose={() => setWarnModal(null)}
          />

          {/* Pricing modal — opened from toolbar OR from DayOccupancyModal */}
          <PricingModal
            modal={rateModal}
            form={rateForm}
            onChange={setRateForm}
            onSave={handleSaveRate}
            onClose={closeRateModal}
            saving={updateCalendar.isPending}
            error={calError}
            aiData={aiData}
            aiLoading={aiLoading}
            selectedRoom={selectedRoom}
            calendar={calendar}
            year={year}
            month={month}
            monthNames={MONTH_NAMES}
            warnModal={warnModal}
            onWarnClose={() => setWarnModal(null)}
            t={t}
          />
        </section>
      ) : (
        <RefundDashboard
          hotels={hotels}
          selectedHotelId={selectedHotelId}
          onHotelChange={handleHotelChange}
          refunds={refunds}
          refundsLoading={refundsLoading}
          statusFilter={refundStatusFilter}
          onStatusFilter={setRefundStatusFilter}
          approveRefund={approveRefund}
          rejectRefund={rejectRefund}
          t={t}
        />
      )}
    </div>
  );
}
