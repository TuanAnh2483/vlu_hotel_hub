import { useState, useEffect } from "react";
import {
  useMyHotels, usePartnerRooms, usePriceSuggestions, useRevenueAnalytics,
  useSubmitPriceFeedback, useUpdateRoomCalendar, useTriggerTraining,
} from "../../hooks/usePartnerQueries";
import { PageHeader, Card } from "../../components/admin/AdminLayout";
import { useLang } from "../../contexts/LanguageContext";
import {
  Activity, Sparkles, Gift, Building2, Hotel,
  ArrowDownRight, Minus, CheckCircle2, Brain, Zap,
  CircleDollarSign, TrendingUp, BarChart2,
} from "lucide-react";

// ── helpers ──────────────────────────────────────────────────────────
function toIso(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function fmtCurrency(v) {
  if (v == null || v === "" || Number.isNaN(Number(v))) return "—";
  return Number(v).toLocaleString("vi-VN") + " ₫";
}

function fmtPct(v) {
  if (v == null) return "—";
  const sign = v >= 0 ? "+" : "";
  return `${sign}${Number(v).toFixed(1)}%`;
}

// ── constants (style-only; labels are computed inside components with useLang) ─
const DEMAND_STYLE = {
  HIGH:   { bg: "#FFF1F2", color: "#BE1E2E", border: "#FECDD3" },
  MEDIUM: { bg: "#FFFBEB", color: "#D97706", border: "#FDE68A" },
  LOW:    { bg: "#F0FDF4", color: "#059669", border: "#A7F3D0" },
};

// Derive demand from price delta instead of raw occupancy.
// Occupancy for future dates is always near 0 (no bookings yet), which
// incorrectly shows LOW demand even when AI recommends a price increase.
function effectiveDemand(deltaPct) {
  if (deltaPct == null) return "MEDIUM";
  if (deltaPct >= 12) return "HIGH";
  if (deltaPct >= -5) return "MEDIUM";
  return "LOW";
}
const CONF_STYLE = {
  HIGH:   { color: "#059669" },
  MEDIUM: { color: "#D97706" },
  LOW:    { color: "#94a3b8" },
};

// ── LineChart ─────────────────────────────────────────────────────────
function LineChart({ items }) {
  const { t } = useLang();
  const DEMAND_CFG = {
    HIGH:   { ...DEMAND_STYLE.HIGH,   label: t("pt_fc_demand_high") },
    MEDIUM: { ...DEMAND_STYLE.MEDIUM, label: t("pt_fc_demand_medium") },
    LOW:    { ...DEMAND_STYLE.LOW,    label: t("pt_fc_demand_low") },
  };
  if (!items.length) return null;
  const W = 800, H = 180, PAD = 32;
  const pts = items.map((it, i) => ({
    x: PAD + (i * (W - 2 * PAD)) / Math.max(items.length - 1, 1),
    y: H - PAD - (it.occupancy ?? 0) * (H - 2 * PAD),
    color: (DEMAND_CFG[effectiveDemand(it.deltaPct)] ?? DEMAND_CFG.MEDIUM).color,
  }));
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const area = `${path} L ${pts.at(-1).x} ${H - PAD} L ${pts[0].x} ${H - PAD} Z`;

  return (
    <div style={{ background: "#fff", borderRadius: 16, padding: "20px 16px", border: "1px solid #f1f5f9", marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>{t("pt_fc_chart_title")}</span>
        <div style={{ display: "flex", gap: 14 }}>
          {Object.entries(DEMAND_CFG).map(([k, v]) => (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#64748b" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: v.color }} /> {v.label}
            </div>
          ))}
        </div>
      </div>
      <div style={{ overflowX: "auto" }}>
        <svg width={W} height={H} style={{ overflow: "visible", minWidth: W }}>
          <defs>
            <linearGradient id="fcGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#BE1E2E" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#BE1E2E" stopOpacity="0" />
            </linearGradient>
          </defs>
          <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="#f1f5f9" />
          <line x1={PAD} y1={PAD} x2={W - PAD} y2={PAD} stroke="#f1f5f9" />
          <text x={PAD - 4} y={H - PAD + 4} fontSize="9" fill="#94a3b8" textAnchor="end">0%</text>
          <text x={PAD - 4} y={PAD + 4} fontSize="9" fill="#94a3b8" textAnchor="end">100%</text>
          <path d={area} fill="url(#fcGrad)" />
          <path d={path} fill="none" stroke="#BE1E2E" strokeWidth="2.5" strokeLinejoin="round" />
          {pts.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="4" fill="#fff" stroke={p.color} strokeWidth="2" />
          ))}
          {items.map((it, i) => i % 2 === 0 && (
            <text key={i} x={pts[i].x} y={H - 8} fontSize="9" fill="#94a3b8" textAnchor="middle">
              {it.displayDate}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────
export default function PartnerForecast() {
  const { t } = useLang();
  const DEMAND_CFG = {
    HIGH:   { ...DEMAND_STYLE.HIGH,   label: t("pt_fc_demand_high") },
    MEDIUM: { ...DEMAND_STYLE.MEDIUM, label: t("pt_fc_demand_medium") },
    LOW:    { ...DEMAND_STYLE.LOW,    label: t("pt_fc_demand_low") },
  };
  const CONF_CFG = {
    HIGH:   { ...CONF_STYLE.HIGH,   label: t("pt_fc_conf_high") },
    MEDIUM: { ...CONF_STYLE.MEDIUM, label: t("pt_fc_conf_medium") },
    LOW:    { ...CONF_STYLE.LOW,    label: t("pt_fc_conf_low") },
  };
  const [selectedHotelId, setSelectedHotelId] = useState("");
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [daysCount, setDaysCount] = useState(14);
  const [applied, setApplied] = useState({});
  const [trainMsg, setTrainMsg] = useState("");
  const [feedbackPending, setFeedbackPending] = useState({});

  const today = new Date();
  const from = toIso(today);
  const to   = toIso(new Date(today.getFullYear(), today.getMonth(), today.getDate() + daysCount));

  const { data: hotels = [] } = useMyHotels();
  const { data: rooms = [] }  = usePartnerRooms(selectedHotelId, { enabled: Boolean(selectedHotelId) });
  const {
    data: suggestions,
    isLoading: sugLoading,
    error: sugError,
  } = usePriceSuggestions(selectedRoomId, from, to);
  const {
    data: analytics,
    isLoading: anaLoading,
    error: anaError,
  } = useRevenueAnalytics(selectedRoomId);

  const loading = sugLoading || anaLoading;
  const error = (sugError && anaError)
    ? t("pt_fc_err_load")
    : sugError ? t("pt_fc_err_suggestions")
    : anaError ? t("pt_fc_err_analytics")
    : "";

  const triggerTraining   = useTriggerTraining();
  const submitFeedback    = useSubmitPriceFeedback();
  const updateCalendar    = useUpdateRoomCalendar();
  const trainLoading      = triggerTraining.isPending;

  // Auto-select first hotel
  useEffect(() => {
    if (!hotels.length) return;
    setSelectedHotelId((cur) => {
      if (cur && hotels.some((h) => String(h.id) === String(cur))) return cur;
      return String(hotels[0].id);
    });
  }, [hotels]);

  // Auto-select first room when hotel/rooms change
  useEffect(() => {
    if (!selectedHotelId) { setSelectedRoomId(""); return; }
    setSelectedRoomId((cur) => {
      if (cur && rooms.some((r) => String(r.id) === String(cur))) return cur;
      return rooms[0] ? String(rooms[0].id) : "";
    });
  }, [selectedHotelId, rooms]);

  function handleTrain() {
    if (!selectedRoomId) return;
    setTrainMsg("");
    triggerTraining.mutate(selectedRoomId, {
      onSuccess: (result) => setTrainMsg(result.hasSufficientData
        ? t("pt_fc_train_done").replace("{round}", result.trainingRound).replace("{n}", result.trainingDataPoints)
        : t("pt_fc_train_no_data")),
      onError: (e) => setTrainMsg(e.message || t("pt_fc_train_err")),
    });
  }

  async function handleFeedback(item, outcome) {
    const appliedPrice =
      outcome === "APPLIED"          ? item.suggestedPrice
      : outcome === "APPLIED_MINUS5" ? Math.round(item.suggestedPrice * 0.95)
      : null;

    setFeedbackPending((prev) => ({ ...prev, [item.date]: true }));
    try {
      await submitFeedback.mutateAsync({
        roomId: selectedRoomId,
        date: item.date,
        suggested: item.suggestedPrice,
        appliedPrice,
        outcome,
      });
      if (appliedPrice != null) {
        await updateCalendar.mutateAsync({
          roomId: selectedRoomId,
          startDate: item.date,
          endDate: item.date,
          price: appliedPrice,
          minStay: null,
          closed: false,
          availableRooms: null,
        });
      }
      setApplied((prev) => ({ ...prev, [item.date]: { outcome, appliedPrice } }));
    } catch (e) {
      alert(e.message || t("pt_fc_err_feedback"));
    } finally {
      setFeedbackPending((prev) => ({ ...prev, [item.date]: false }));
    }
  }

  const items = suggestions?.items ?? [];
  const highCount = items.filter(it => effectiveDemand(it.deltaPct) === "HIGH").length;

  return (
    <div style={{ paddingBottom: 80 }}>
      <PageHeader
        title={t("pt_fc_title")}
        subtitle={t("pt_fc_subtitle")}
      />

      {/* Selector bar */}
      <Card style={{ padding: "16px 20px", marginBottom: 20, borderRadius: 20 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
          <div style={{ position: "relative" }}>
            <Building2 size={15} color="#94a3b8" style={iconOverlay} />
            <select value={selectedHotelId} onChange={e => setSelectedHotelId(e.target.value)} style={selectSt}>
              {!hotels.length && <option>{t("pt_fc_no_hotels")}</option>}
              {hotels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          </div>
          <div style={{ position: "relative" }}>
            <Hotel size={15} color="#94a3b8" style={iconOverlay} />
            <select value={selectedRoomId} onChange={e => setSelectedRoomId(e.target.value)} style={selectSt}>
              {!rooms.length && <option>{t("pt_fc_no_rooms")}</option>}
              {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
            {[7, 14, 21, 30].map(d => (
              <button key={d} onClick={() => setDaysCount(d)} style={{
                padding: "8px 14px", borderRadius: 10, fontFamily: "inherit",
                border: daysCount === d ? "1.5px solid #BE1E2E" : "1px solid #e2e8f0",
                background: daysCount === d ? "#FFF1F2" : "#f8fafc",
                color: daysCount === d ? "#BE1E2E" : "#64748b",
                fontSize: 12, fontWeight: 800, cursor: "pointer",
              }}>
                {t("pt_fc_n_days").replace("{n}", d)}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {error && (
        <div style={{ marginBottom: 16, padding: "12px 16px", borderRadius: 12, background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", fontSize: 13, fontWeight: 700 }}>
          {error}
        </div>
      )}

      {!selectedRoomId ? (
        <Card style={{ textAlign: "center", padding: "80px 0", borderRadius: 24 }}>
          <Brain size={44} color="#e2e8f0" style={{ marginBottom: 16 }} />
          <div style={{ fontSize: 15, fontWeight: 800, color: "#334155", marginBottom: 6 }}>{t("pt_fc_suggestions")}</div>
          <div style={{ fontSize: 13, color: "#94a3b8" }}>{t("pt_fc_subtitle")}</div>
        </Card>
      ) : loading ? (
        <div style={{ textAlign: "center", padding: "100px 0" }}>
          <Activity size={40} color="#BE1E2E" style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 14, color: "#64748b", fontWeight: 600 }}>{t("pt_rev_analyzing")}</div>
        </div>
      ) : (
        <>
          {/* Metrics */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 20 }}>
            <MetricCard
              icon={CircleDollarSign} tone="#7C3AED"
              label={t("pt_fc_metric_rev7")}
              value={fmtCurrency(analytics?.revenue7Days)}
              sub={analytics ? `${fmtPct(analytics.weeklyGrowthPct)} ${t("pt_fc_vs_last_week")}` : t("pt_fc_no_data")}
              subColor={analytics?.weeklyGrowthPct >= 0 ? "#059669" : "#BE1E2E"}
            />
            <MetricCard
              icon={BarChart2} tone="#0EA5E9"
              label={t("pt_fc_metric_rev28")}
              value={fmtCurrency(analytics?.revenue28Days)}
              sub={t("pt_fc_last_4weeks")}
            />
            <MetricCard
              icon={TrendingUp} tone="#BE1E2E"
              label={t("pt_fc_metric_highdays")}
              value={t("pt_fc_n_days").replace("{n}", highCount)}
              valueColor="#BE1E2E"
              sub={t("pt_fc_in_next_days").replace("{n}", daysCount)}
            />
            <MetricCard
              icon={Sparkles} tone="#D97706"
              label={t("pt_fc_metric_ai_rate")}
              value={analytics ? `${Number(analytics.acceptanceRate).toFixed(1)}%` : "—"}
              sub={analytics
                ? t("pt_fc_proposals").replace("{applied}", analytics.appliedCount).replace("{total}", analytics.feedbackTotal)
                : t("pt_fc_no_data")}
            />
          </div>

          {/* Model status */}
          {suggestions && (
            <div style={{
              marginBottom: 16, padding: "12px 16px", borderRadius: 14,
              background: suggestions.hasSufficientData ? "#F0FDF4" : "#FFFBEB",
              border: `1px solid ${suggestions.hasSufficientData ? "#A7F3D0" : "#FDE68A"}`,
              fontSize: 12,
            }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                <Brain size={16} color={suggestions.hasSufficientData ? "#059669" : "#D97706"} />
                <span style={{ fontWeight: 800, color: suggestions.hasSufficientData ? "#059669" : "#D97706" }}>
                  {suggestions.hasSufficientData ? t("pt_fc_model_trained") : t("pt_fc_model_learning")}
                </span>
                <Sep />
                <span style={{ color: "#64748b" }}>{t("pt_fc_model_round").replace("{n}", suggestions.trainingRound)}</span>
                <Sep />
                <span style={{ color: "#64748b" }}>{t("pt_fc_model_points").replace("{n}", suggestions.trainingDataPoints)}</span>
                <Sep />
                <span style={{ color: "#64748b" }}>{t("pt_fc_model_flex")} {(suggestions.priceAggressiveness * 100).toFixed(0)}%</span>
                <Sep />
                <span style={{ color: "#64748b" }}>{t("pt_fc_model_accept")} {(suggestions.lastAcceptanceRate * 100).toFixed(0)}%</span>
                <div style={{ marginLeft: "auto", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
                  <button
                    onClick={handleTrain}
                    disabled={trainLoading}
                    title="AI sẽ xem lại các quyết định giá bạn đã thực hiện và tự điều chỉnh để đề xuất phù hợp hơn với phong cách định giá của bạn. Nên dùng sau khi bạn đã phản hồi ít nhất 5 đề xuất giá."
                    style={trainBtnSt(trainLoading)}
                  >
                    <Zap size={12} /> {trainLoading ? t("pt_fc_improving") : t("pt_fc_improve")}
                  </button>
                  <span style={{ fontSize: 9, color: "#94a3b8", fontStyle: "italic" }}>
                    {t("pt_fc_train_hint")}
                  </span>
                </div>
              </div>
              {trainMsg && (
                <div style={{ marginTop: 8, fontSize: 11, color: "#475569", fontWeight: 600 }}>{trainMsg}</div>
              )}
            </div>
          )}

          {/* Chart */}
          {items.length > 0 && <LineChart items={items} />}

          {/* Suggestion list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4, padding: "0 2px" }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>{t("pt_fc_daily_details")}</span>
              <span style={{ fontSize: 12, color: "#94a3b8" }}>{t("pt_fc_n_days").replace("{n}", items.length)}</span>
            </div>

            {items.length === 0 && (
              <Card style={{ textAlign: "center", padding: "48px 0", borderRadius: 20 }}>
                <div style={{ fontSize: 13, color: "#94a3b8" }}>{t("pt_fc_no_data_range")}</div>
              </Card>
            )}

            {items.map(item => {
              const d    = DEMAND_CFG[effectiveDemand(item.deltaPct)] ?? DEMAND_CFG.MEDIUM;
              const conf = CONF_CFG[item.confidence] ?? CONF_CFG.MEDIUM;
              const fb   = applied[item.date];
              const busy = Boolean(feedbackPending[item.date]);
              const minus5Price = item.suggestedPrice ? Math.round(item.suggestedPrice * 0.95) : null;

              return (
                <div key={item.date} style={{ ...dayCardSt, border: fb ? "1.5px solid #A7F3D0" : "1px solid #f1f5f9" }}>

                  {/* Date */}
                  <div style={dateColSt}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: item.isWeekend ? "#BE1E2E" : "#94a3b8", textTransform: "uppercase" }}>
                      {item.dayName}
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 900, color: "#0f172a", marginTop: 2 }}>{item.displayDate}</div>
                    {item.isHoliday && (
                      <div style={{ marginTop: 4, fontSize: 9, color: "#D97706", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 2 }}>
                        <Gift size={9} /> {t("pt_fc_holiday")}
                      </div>
                    )}
                  </div>

                  {/* Demand + occupancy */}
                  <div style={demandSectionSt}>
                    <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 99, marginBottom: 8, background: d.bg, border: `1px solid ${d.border}`, color: d.color, fontSize: 11, fontWeight: 800 }}>
                      {t("pt_fc_demand_prefix")} {d.label}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1, height: 5, background: "#f1f5f9", borderRadius: 99, overflow: "hidden" }}>
                        <div style={{ width: `${Math.round((item.occupancy ?? 0) * 100)}%`, height: "100%", background: d.color }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 800, color: d.color, minWidth: 34 }}>
                        {Math.round((item.occupancy ?? 0) * 100)}%
                      </span>
                    </div>
                    <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 4 }}>
                      {t("pt_fc_bookings_rooms").replace("{booked}", item.activeBookings).replace("{total}", item.totalRooms)}
                    </div>
                    <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>
                      {item.velocity > 0 && (
                        <span style={{ color: "#D97706", fontWeight: 700 }}>
                          {t("pt_fc_new_in_7d").replace("{n}", item.velocity)} ·{" "}
                        </span>
                      )}
                      {item.daysUntil === 0 ? t("pt_fc_today") : t("pt_fc_days_left").replace("{n}", item.daysUntil)}
                    </div>
                  </div>

                  {/* Price */}
                  <div style={priceSectionSt}>
                    <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 800, marginBottom: 4, textTransform: "uppercase" }}>{t("pt_fc_price_label")}</div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 11, color: "#94a3b8", textDecoration: "line-through" }}>{fmtCurrency(item.currentPrice)}</span>
                      <span style={{ fontSize: 20, fontWeight: 900, color: d.color }}>
                        {fmtCurrency(item.suggestedPrice)}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 800, color: d.color }}>{fmtPct(item.deltaPct)}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3, display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                      <span>{t("pt_fc_range")} {fmtCurrency(item.priceLow)} – {fmtCurrency(item.priceHigh)}</span>
                      <span style={{ color: conf.color, fontWeight: 700 }}>{conf.label}</span>
                      {item.aiGenerated && (
                        <span style={{ padding: "1px 6px", borderRadius: 4, background: "#EFF6FF", color: "#2563EB", fontWeight: 800, fontSize: 10 }}>AI</span>
                      )}
                    </div>
                  </div>

                  {/* Reason */}
                  <div style={reasonSectionSt}>
                    {item.reason}
                    {item.factors?.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                        {item.factors.map((f, fi) => (
                          <span key={fi} style={{ padding: "2px 8px", borderRadius: 6, background: "#f8fafc", border: "1px solid #e2e8f0", fontSize: 10, fontWeight: 700, color: "#475569" }}>
                            {f}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={actionsSectionSt}>
                    {fb ? (
                      <div style={appliedBadgeSt}>
                        <CheckCircle2 size={16} color="#059669" />
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 800, color: "#059669" }}>
                            {fb.outcome === "SKIPPED" ? t("pt_fc_ignored") : t("pt_fc_applied")}
                          </div>
                          {fb.appliedPrice && <div style={{ fontSize: 10, color: "#64748b" }}>{fmtCurrency(fb.appliedPrice)}</div>}
                        </div>
                      </div>
                    ) : (
                      <>
                        <button onClick={() => handleFeedback(item, "APPLIED")} disabled={busy || item.suggestedPrice == null}
                          style={{ ...actionBtn, background: "#BE1E2E", color: "#fff", opacity: busy ? 0.6 : 1 }}>
                          <CheckCircle2 size={13} /> {t("pt_fc_apply")} {fmtCurrency(item.suggestedPrice)}
                        </button>
                        <button onClick={() => handleFeedback(item, "APPLIED_MINUS5")} disabled={busy || item.suggestedPrice == null}
                          style={{ ...actionBtn, background: "#0f172a", color: "#fff", opacity: busy ? 0.6 : 1 }}>
                          <ArrowDownRight size={13} /> {t("pt_fc_apply_minus5")} ({fmtCurrency(minus5Price)})
                        </button>
                        <button onClick={() => handleFeedback(item, "SKIPPED")} disabled={busy}
                          style={{ ...actionBtn, background: "#f8fafc", color: "#64748b", border: "1px solid #e2e8f0", opacity: busy ? 0.6 : 1 }}>
                          <Minus size={13} /> {t("pt_fc_ignore")}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Weekly revenue breakdown */}
          {analytics?.weeklyRevenue?.length > 0 && (
            <Card style={{ marginTop: 24, padding: 24, borderRadius: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", marginBottom: 16 }}>{t("pt_fc_weekly_title")}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
                {analytics.weeklyRevenue.map((w, i) => (
                  <div key={i} style={weeklyCardSt}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", marginBottom: 6 }}>{w.label}</div>
                    <div style={{ fontSize: 16, fontWeight: 900, color: "#0f172a" }}>{fmtCurrency(w.revenue)}</div>
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 3 }}>{t("pt_fc_booking_count").replace("{n}", w.bookingCount)}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ── sub-components ────────────────────────────────────────────────────
function MetricCard({ icon: Icon, tone, label, value, valueColor, sub, subColor }) {
  return (
    <Card style={{ padding: 20, borderRadius: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</span>
        <Icon size={16} color={tone} />
      </div>
      <div style={{ fontSize: 22, fontWeight: 900, color: valueColor ?? "#0f172a", marginBottom: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: subColor ?? "#64748b", fontWeight: 600 }}>{sub}</div>}
    </Card>
  );
}

function Sep() {
  return <span style={{ color: "#e2e8f0" }}>·</span>;
}

// ── styles ────────────────────────────────────────────────────────────
const iconOverlay = {
  position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none",
};

const selectSt = {
  padding: "10px 12px 10px 36px", borderRadius: 12, border: "1px solid #e2e8f0",
  background: "#f8fafc", fontSize: 13, fontWeight: 700, color: "#0f172a",
  outline: "none", minWidth: 200, fontFamily: "inherit", cursor: "pointer",
};

const actionBtn = {
  display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
  padding: "8px 10px", borderRadius: 10, border: "none",
  fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", width: "100%",
};

const dayCardSt = {
  background: "#fff", borderRadius: 16, padding: "16px 20px",
  display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start",
};

const dateColSt = {
  width: 62, flexShrink: 0, textAlign: "center",
  borderRight: "1px solid #f1f5f9", paddingRight: 16,
};

const demandSectionSt = { minWidth: 120, flexShrink: 0 };

const priceSectionSt = { flex: 1, minWidth: 180 };

const reasonSectionSt = { flex: 2, minWidth: 200, fontSize: 12, color: "#64748b", lineHeight: 1.65 };

const actionsSectionSt = { flexShrink: 0, display: "flex", flexDirection: "column", gap: 6, minWidth: 155 };

const appliedBadgeSt = {
  display: "flex", alignItems: "center", gap: 8,
  padding: "10px 14px", borderRadius: 12,
  background: "#F0FDF4", border: "1px solid #A7F3D0",
};

const weeklyCardSt = { padding: 14, borderRadius: 14, background: "#f8fafc", border: "1px solid #e2e8f0" };

const trainBtnSt = (loading) => ({
  display: "flex", alignItems: "center", gap: 5,
  padding: "6px 14px", borderRadius: 8, border: "none",
  background: "#0f172a", color: "#fff", fontSize: 11, fontWeight: 700,
  cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1,
  fontFamily: "inherit",
});
