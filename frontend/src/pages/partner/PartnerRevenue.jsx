import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { useQueries } from "@tanstack/react-query";
import { useMyHotels } from "../../hooks/usePartnerQueries";
import { partnerService } from "../../services/partnerService";
import { PageHeader, Card } from "../../components/admin/AdminLayout";
import { useLang } from "../../contexts/LanguageContext";
import {
  AlertTriangle, CheckCircle2, XCircle, TrendingUp,
  Calendar, Download, Filter, BedDouble
} from "lucide-react";
import "../../styles/pages/PartnerRevenue.css";

// --- Helpers ---
function fmtPrice(n) {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + " tỷ";
  if (n >= 1_000_000)     return (n / 1_000_000).toFixed(1) + " tr";
  return new Intl.NumberFormat("vi-VN").format(n);
}

const MONTH_NAMES = ["T1","T2","T3","T4","T5","T6","T7","T8","T9","T10","T11","T12"];

function buildMonthRanges(year) {
  return MONTH_NAMES.map((label, i) => {
    const m = i + 1;
    const from = `${year}-${String(m).padStart(2, "0")}-01`;
    const lastDay = new Date(year, m, 0).getDate();
    const to = `${year}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    const key = `${year}-${String(m).padStart(2, "0")}`;
    return { label, key, from, to };
  });
}

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2].map(String);

export default function PartnerRevenue() {
  const { t } = useLang();
  const { selectedHotelId: ctxHotelId, setSelectedHotelId: setCtxHotelId } = useOutletContext() || {};
  const [year, setYear] = useState(CURRENT_YEAR);
  const [filterHotelId, setFilterHotelId] = useState(ctxHotelId ? String(ctxHotelId) : "");

  const { data: hotels = [] } = useMyHotels();

  useEffect(() => {
    setFilterHotelId(ctxHotelId ? String(ctxHotelId) : "");
  }, [ctxHotelId]);

  const monthRanges = buildMonthRanges(year);

  const monthQueries = useQueries({
    queries: monthRanges.map(({ from, to }) => ({
      queryKey: ["partner", "analytics", { checkInFrom: from, checkInTo: to, hotelId: filterHotelId || undefined }],
      queryFn:  () => partnerService.getAnalyticsSummary({ checkInFrom: from, checkInTo: to, hotelId: filterHotelId || undefined }),
      staleTime: 2 * 60 * 1000,
    })),
  });

  const loading = monthQueries.some(q => q.isLoading);

  const months = monthRanges.map(({ label, key }, i) => {
    const d = monthQueries[i]?.data;
    const revenue = d?.netRevenue ?? 0;
    const count   = (d?.confirmedBookings ?? 0) + (d?.completedBookings ?? 0);
    return { label, key, revenue, count };
  });

  const totalRevenue    = months.reduce((s, m) => s + m.revenue, 0);
  const maxRevenue      = Math.max(...months.map(m => m.revenue), 1);
  const totalConfirmed  = monthQueries.reduce((s, q) => s + (q.data?.confirmedBookings ?? 0) + (q.data?.completedBookings ?? 0), 0);
  const totalCancelled  = monthQueries.reduce((s, q) => s + (q.data?.cancelledBookings ?? 0), 0);
  const totalAll        = monthQueries.reduce((s, q) => s + (q.data?.totalBookings ?? 0), 0);
  const cancellationRateNum = totalAll > 0 ? (totalCancelled / totalAll) * 100 : 0;
  const cancellationRate = `${cancellationRateNum.toFixed(1)}%`;
  const adr = totalConfirmed > 0 ? Math.round(totalRevenue / totalConfirmed) : 0;

  const handleExport = () => {
    const activeMonths = months.filter(m => m.revenue > 0 || m.count > 0);
    if (!activeMonths.length) return;
    const headers = [t("pt_rev_col_month"), t("pt_rev_col_bookings"), t("pt_rev_col_revenue"), t("pt_rev_col_avg")];
    const rows = activeMonths.map(m => [
      `${m.label}/${year}`,
      m.count,
      m.revenue,
      m.count > 0 ? Math.round(m.revenue / m.count) : 0,
    ]);
    const csv = [headers, ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `revenue_${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const hasData = months.some(m => m.revenue > 0 || m.count > 0);

  return (
    <div style={{ paddingBottom: 60 }}>
      <PageHeader
        title={t("pt_rev_title")}
        subtitle={t("pt_rev_subtitle")}
        action={
          <button
            onClick={handleExport}
            disabled={loading || !hasData}
            style={{
              padding: "10px 18px", borderRadius: 10, background: "#fff", color: "#475569",
              border: "1px solid #e2e8f0", fontWeight: 700, fontSize: 13,
              cursor: loading || !hasData ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", gap: 8,
              opacity: loading || !hasData ? 0.5 : 1,
            }}
          >
            <Download size={16} /> {t("pt_rev_export")}
          </button>
        }
      />

      {/* Summary Cards */}
      <div className="partner-revenue-stat-grid">
        {[
          {
            label: t("pt_rev_total"), value: fmtPrice(totalRevenue) + " ₫",
            sub: t("pt_rev_total_sub"), Icon: TrendingUp, color: "#7C3AED", bg: "#F5F3FF"
          },
          {
            label: t("pt_rev_completed"), value: totalConfirmed,
            sub: t("pt_rev_completed_sub"), Icon: CheckCircle2, color: "#059669", bg: "#ecfdf5"
          },
          {
            label: t("pt_rev_cancel_rate"), value: cancellationRate,
            sub: t("pt_rev_cancel_sub").replace("{n}", totalCancelled), Icon: XCircle,
            color: cancellationRateNum > 30 ? "#ef4444" : "#64748b",
            bg: cancellationRateNum > 30 ? "#fef2f2" : "#f8fafc"
          },
          {
            label: "ADR", value: adr > 0 ? fmtPrice(adr) + " ₫" : "—",
            sub: t("pt_rev_adr_sub") || "Giá phòng trung bình / đêm", Icon: BedDouble, color: "#0ea5e9", bg: "#f0f9ff"
          },
        ].map((c) => (
          <div key={c.label} style={{
            background: "#fff", borderRadius: 20, padding: "24px", border: "1px solid #f1f5f9",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)", position: "relative", overflow: "hidden"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 800, letterSpacing: 0.5 }}>{c.label}</div>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: c.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <c.Icon size={18} color={c.color} />
              </div>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#1e293b", marginBottom: 8 }}>{c.value}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#94a3b8" }}>
              {c.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Warning bar - tỷ lệ hủy cao */}
      {cancellationRateNum > 30 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", marginBottom: 24,
          background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 14,
        }}>
          <AlertTriangle size={18} color="#d97706" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <span style={{ fontWeight: 700, color: "#92400e", fontSize: 14 }}>
              {t("pt_rev_cancel_warning") || `Tỷ lệ hủy ${cancellationRate} đang cao bất thường.`}
            </span>
            <span style={{ color: "#78350f", fontSize: 13, marginLeft: 6 }}>
              {t("pt_rev_cancel_suggestion") || "Kiểm tra chính sách hủy hoặc điều chỉnh giá phòng để cải thiện."}
            </span>
          </div>
        </div>
      )}

      {/* Main Chart Card */}
      <Card style={{ marginBottom: 32, padding: 32 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 40 }}>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: "#1e293b", margin: 0 }}>{t("pt_rev_chart_title")}</h3>
            <p style={{ fontSize: 14, color: "#64748b", marginTop: 4 }}>{t("pt_rev_chart_sub").replace("{year}", year)}</p>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {hotels.length > 1 && (
              <select
                style={{ padding: "8px 12px", border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 13, outline: "none", background: "#f8fafc", cursor: "pointer", fontWeight: 600 }}
                value={filterHotelId}
                onChange={e => {
                  const val = e.target.value;
                  setFilterHotelId(val);
                  setCtxHotelId?.(val ? Number(val) : null);
                }}
              >
                <option value="">Tất cả cơ sở</option>
                {hotels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            )}
            <div style={{ position: "relative" }}>
              <Calendar size={14} color="#64748b" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
              <select
                style={{ padding: "8px 12px 8px 34px", border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 13, outline: "none", background: "#f8fafc", cursor: "pointer", fontWeight: 600 }}
                value={year}
                onChange={e => setYear(Number(e.target.value))}
              >
                {YEAR_OPTIONS.map(y => <option key={y} value={y}>{t("pt_rev_year").replace("{year}", y)}</option>)}
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>{t("pt_rev_analyzing")}</div>
        ) : (
          <div className="partner-revenue-chart-container">
            <div className="partner-revenue-chart-grid">
              <div style={{ position: "absolute", inset: "0 0 30px 0", display: "flex", flexDirection: "column", justifyContent: "space-between", pointerEvents: "none" }}>
                {[0, 1, 2, 3].map(i => <div key={i} className="partner-revenue-grid-line" />)}
              </div>

              {months.map((m) => {
                const pct = maxRevenue > 0 ? (m.revenue / maxRevenue) * 210 : 0;
                const isActive = m.revenue > 0;
                return (
                  <div key={m.key} className="partner-revenue-chart-column">
                    {isActive && (
                      <div className="partner-revenue-bar-label">
                        {fmtPrice(m.revenue)}
                      </div>
                    )}
                    <div
                      className="partner-revenue-chart-bar"
                      style={{
                        height: Math.max(pct, 6),
                        background: isActive ? "linear-gradient(to top, #BE1E2E, #EF4444)" : "#f1f5f9"
                      }}
                    />
                    <span className={`partner-revenue-month-label ${isActive ? "partner-revenue-month-label-active" : ""}`}>
                      {m.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      {/* Detailed Table */}
      <div className="partner-revenue-table-wrapper">
        <div className="partner-revenue-table-header">
          <h3 className="partner-revenue-table-title">{t("pt_rev_table_title")}</h3>
          <div className="partner-revenue-table-filter">
            <Filter size={14} /> {t("pt_rev_filter")}
          </div>
        </div>
        <div className="ui-table-wrap"><table className="partner-revenue-table">
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              {[t("pt_rev_col_month"), t("pt_rev_col_bookings"), t("pt_rev_col_revenue"), t("pt_rev_col_avg")].map(h => (
                <th key={h} style={{ padding: "14px 24px", textAlign: "left", fontWeight: 700, color: "#94a3b8", fontSize: 11, letterSpacing: 0.5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {months.filter(m => m.revenue > 0 || m.count > 0).map((m) => (
              <tr key={m.key} className="partner-revenue-table-row" style={{ borderBottom: "1px solid #f8fafc" }}>
                <td style={{ padding: "16px 24px", fontWeight: 700, color: "#1e293b" }}>{m.label} / {year}</td>
                <td style={{ padding: "16px 24px", color: "#475569" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#BE1E2E" }} />
                    {m.count} {t("pt_rev_col_bookings").toLowerCase()}
                  </div>
                </td>
                <td style={{ padding: "16px 24px", color: "#BE1E2E", fontWeight: 800 }}>
                  {new Intl.NumberFormat("vi-VN").format(m.revenue)} ₫
                </td>
                <td style={{ padding: "16px 24px", color: "#475569", fontWeight: 600 }}>
                  {m.count > 0 ? fmtPrice(Math.round(m.revenue / m.count)) + " ₫" : "—"}
                </td>
              </tr>
            ))}
            {months.every(m => m.revenue === 0 && m.count === 0) && !loading && (
              <tr>
                <td colSpan={4} style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>
                  {t("pt_rev_empty_month") !== "—" ? t("pt_rev_empty_month") : `Chưa có dữ liệu giao dịch cho năm ${year}`}
                </td>
              </tr>
            )}
          </tbody>
        </table></div>
      </div>
    </div>
  );
}
