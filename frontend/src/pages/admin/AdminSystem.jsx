import AdminLayout, { AP, PageHeader, Card, Badge, Btn, Table } from "../../components/admin/AdminLayout";
import { useAdminSystem } from "../../hooks/useAdminQueries";
import { useLang } from "../../contexts/LanguageContext";

const ERROR_COLORS = {
  PAYMENT_FAILED:   "#c62828",
  EMAIL_ERROR:      "#e65100",
  BOOKING_CONFLICT: "#1565c0",
  AUTH_ANOMALY:     "#6a1b9a",
};

const SERVICES = [
  { name: "API Server",    status: "ONLINE",  latency: "12ms",  icon: "🌐" },
  { name: "Database",      status: "ONLINE",  latency: "4ms",   icon: "🗄️" },
  { name: "Payment Gate",  status: "ONLINE",  latency: "230ms", icon: "💳" },
  { name: "Email Service", status: "ONLINE",  latency: "85ms",  icon: "📧" },
  { name: "File Storage",  status: "ONLINE",  latency: "18ms",  icon: "📁" },
  { name: "Cache Layer",   status: "ONLINE",  latency: "2ms",   icon: "⚡" },
];

export default function AdminSystem({ navigate, user, onLogout }) {
  const { t } = useLang();
  const { data, isLoading: loading } = useAdminSystem();

  const handleResolve = async flagId => {
    navigate("admin-refunds", { refundId: flagId });
  };

  return (
    <AdminLayout page="admin-system" navigate={navigate} user={user} onLogout={onLogout}>
      <PageHeader title={t("adm_sys_title")} subtitle={t("adm_sys_subtitle")} />

      {/* Service status grid */}
      <Card style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, color: "#1a1a1a", margin: 0 }}>{t("adm_sys_services")}</h2>
          <span style={{ background: "#e8f5e9", color: "#2e7d32", padding: "4px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
            🟢 {t("adm_sys_all_ok")}
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
          {SERVICES.map(svc => (
            <div key={svc.name} style={{
              padding: "14px 16px", borderRadius: 10,
              border: "1px solid #e8f5e9", background: "#f9fef9",
              display: "flex", alignItems: "center", gap: 12,
            }}>
              <span style={{ fontSize: 20 }}>{svc.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a" }}>{svc.name}</div>
                <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>{t("adm_sys_latency")}: {svc.latency}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                <div style={{ width: 9, height: 9, borderRadius: "50%", background: "#4caf50", boxShadow: "0 0 6px #4caf5080" }} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {loading ? (
        <div style={{ textAlign: "center", padding: 48, color: "#bbb" }}>{t("adm_loading")}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

          {/* Flagged bookings */}
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 800, color: "#1a1a1a", margin: 0 }}>{t("adm_sys_flagged")}</h2>
                <p style={{ fontSize: 12, color: "#888", marginTop: 4, marginBottom: 0 }}>{t("adm_sys_flagged_sub")}</p>
              </div>
              <span style={{
                background: data.flaggedBookings.length > 0 ? "#ffebee" : "#e8f5e9",
                color:      data.flaggedBookings.length > 0 ? "#c62828" : "#2e7d32",
                padding: "4px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700,
              }}>
                {data.flaggedBookings.length > 0 ? `⚠️ ${t("adm_sys_issues").replace("{count}", data.flaggedBookings.length)}` : `✓ ${t("adm_sys_no_issues")}`}
              </span>
            </div>
            <Table
              headers={[t("adm_sys_col_booking"), t("adm_sys_col_severity"), t("adm_sys_col_reason"), t("adm_sys_col_reported"), t("adm_actions")]}
              rows={data.flaggedBookings.map(f => [
                <span style={{ fontWeight: 700, fontFamily: "monospace" }}>#B{f.bookingId}</span>,
                <Badge status={f.severity} />,
                <span style={{ fontSize: 12, color: "#555" }}>{f.reason}</span>,
                <span style={{ fontSize: 12, color: "#888" }}>{f.reportedAt}</span>,
                <Btn small variant="action" onClick={() => handleResolve(f.id)}>
                  {t("adm_sys_resolve")}
                </Btn>,
              ])}
              empty={`✓ ${t("adm_sys_flagged_empty")}`}
            />
          </Card>

          {/* Recent errors */}
          <Card>
            <div style={{ marginBottom: 18 }}>
              <h2 style={{ fontSize: 15, fontWeight: 800, color: "#1a1a1a", margin: 0 }}>{t("adm_sys_errors")}</h2>
              <p style={{ fontSize: 12, color: "#888", marginTop: 4, marginBottom: 0 }}>{t("adm_sys_errors_sub")}</p>
            </div>

            {data.recentErrors.length === 0 ? (
              <div style={{ textAlign: "center", padding: 32, color: "#bbb", fontSize: 13 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
                {t("adm_sys_errors_empty")}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {data.recentErrors.map(err => (
                  <div key={err.id} style={{
                    display: "flex", alignItems: "flex-start", gap: 14,
                    padding: "12px 16px", borderRadius: 10,
                    background: "#fafafa", border: "1px solid #f0f0f0",
                  }}>
                    <div style={{
                      width: 10, height: 10, borderRadius: "50%", marginTop: 5, flexShrink: 0,
                      background: ERROR_COLORS[err.type] || "#888",
                    }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{
                          fontSize: 11, fontWeight: 700, color: ERROR_COLORS[err.type] || "#888",
                          fontFamily: "monospace", background: `${ERROR_COLORS[err.type] || "#888"}18`,
                          padding: "2px 8px", borderRadius: 4,
                        }}>
                          {err.type}
                        </span>
                        <span style={{ fontSize: 11, color: "#bbb" }}>{err.timestamp}</span>
                      </div>
                      <div style={{ fontSize: 13, color: "#444", marginTop: 5 }}>{err.message}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </AdminLayout>
  );
}
