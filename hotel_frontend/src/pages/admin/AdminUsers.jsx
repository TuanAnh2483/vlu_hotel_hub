import { useState, useRef } from "react";
import AdminLayout, {
  AP, PageHeader, Card, Badge, Btn, SearchInput,
  Table, Modal, FormField, Input, Select,
} from "../../components/admin/AdminLayout";
import { useAdminUsers, useToggleUserStatus, useCreateAdminUser } from "../../hooks/useAdminQueries";
import { Users, CheckCircle, Lock, Unlock, Handshake } from "lucide-react";
import { useLang } from "../../contexts/LanguageContext";
import "../../styles/pages/admin/AdminUsers.css";

const EMPTY_FORM = { email: "", password: "", confirmPassword: "", userType: "CUSTOMER", avatarPreview: null };

export default function AdminUsers({ navigate, user, onLogout }) {
  const { t } = useLang();

  function validateField(key, value, form) {
    if (key === "email") {
      if (!value) return t("adm_users_err_email_empty");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return t("adm_users_err_email_invalid");
    }
    if (key === "password") {
      if (!value) return t("adm_users_err_pass_empty");
      if (value.length < 8) return t("adm_users_err_pass_min");
      if (!/(?=.*[A-Za-z])(?=.*\d)/.test(value)) return t("adm_users_err_pass_format");
    }
    if (key === "confirmPassword") {
      if (value !== form.password) return t("adm_users_err_pass_cf");
    }
    return "";
  }
  const [search, setSearch]     = useState("");
  const [modal, setModal]       = useState(false);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [error, setError]       = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const avatarInputRef = useRef(null);

  const { data: users = [], isLoading: loading } = useAdminUsers(search);
  const toggleStatus  = useToggleUserStatus();
  const createUser    = useCreateAdminUser();
  const saving        = createUser.isPending;

  const filtered = users.filter(u =>
    !search || u.email.toLowerCase().includes(search.toLowerCase())
  );

  const counts = {
    total:    users.length,
    active:   users.filter(u => u.status === "ACTIVE").length,
    locked:   users.filter(u => u.status !== "ACTIVE").length,
    partners: users.filter(u => u.userType === "PARTNER").length,
  };

  const handleToggle = (userId) => {
    toggleStatus.mutate(userId, {
      onError: (e) => alert(e.message),
    });
  };

  const handleCreate = () => {
    const errs = {
      email: validateField("email", form.email, form),
      password: validateField("password", form.password, form),
      confirmPassword: validateField("confirmPassword", form.confirmPassword, form),
    };
    setFieldErrors(errs);
    if (Object.values(errs).some(Boolean)) return;

    setError("");
    createUser.mutate(
      { email: form.email, password: form.password, userType: form.userType },
      {
        onSuccess: () => { setModal(false); setForm(EMPTY_FORM); setFieldErrors({}); },
        onError: (e) => setError(e.message || t("adm_users_err_generic")),
      },
    );
  };

  const upd = k => e => {
    const val = e.target.value;
    const next = { ...form, [k]: val };
    setForm(next);
    setFieldErrors(prev => ({ ...prev, [k]: validateField(k, val, next) }));
  };

  const handleAvatarChange = e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setForm(prev => ({ ...prev, avatarPreview: ev.target.result }));
    reader.readAsDataURL(file);
  };

  return (
    <AdminLayout page="admin-users" navigate={navigate} user={user} onLogout={onLogout}>
      <PageHeader
        title={t("adm_users_title")}
        subtitle={t("adm_users_subtitle")}
        action={
          <Btn onClick={() => { setForm(EMPTY_FORM); setError(""); setFieldErrors({}); setModal(true); }}>
            {t("adm_users_add_btn")}
          </Btn>
        }
      />

      {/* Summary cards */}
      <div className="admin-users-summary-grid">
        {[
          { label: t("adm_users_total"),    value: counts.total,    icon: <Users size={24} color={AP} /> },
          { label: t("adm_users_active"),   value: counts.active,   icon: <CheckCircle size={24} color={AP} /> },
          { label: t("adm_users_locked"),   value: counts.locked,   icon: <Lock size={24} color={AP} /> },
          { label: t("adm_users_partners"), value: counts.partners, icon: <Handshake size={24} color={AP} /> },
        ].map(c => (
          <div key={c.label} className="admin-users-summary-card">
            <div className="admin-users-summary-icon">{c.icon}</div>
            <div>
              <div className="admin-users-summary-value">{c.value}</div>
              <div className="admin-users-summary-label">{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      <Card>
        <div className="admin-users-toolbar">
          <SearchInput value={search} onChange={setSearch} placeholder={t("adm_users_search_ph")} />
          <span className="admin-users-count">{t("adm_users_count").replace("{count}", filtered.length)}</span>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 48, color: "#bbb" }}>{t("adm_loading")}</div>
        ) : (
          <>
            <Table
              headers={[t("adm_id"), t("adm_email"), t("adm_users_col_type"), t("adm_status"), t("adm_created_at"), t("adm_actions")]}
              rows={filtered.slice((page - 1) * pageSize, page * pageSize).map(u => [
              <span className="admin-users-cell-id">#{u.id}</span>,
              <div className="admin-users-cell-email">{u.email}</div>,
              <Badge status={u.userType} />,
              <Badge status={u.status} />,
              <span className="admin-users-cell-date">{u.createdAt || "—"}</span>,
              <Btn
                small
                variant="action"
                disabled={toggleStatus.isPending && toggleStatus.variables === u.id || u.userType === "ADMIN"}
                onClick={() => handleToggle(u.id)}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
                  {toggleStatus.isPending && toggleStatus.variables === u.id ? "..." : u.status === "ACTIVE" ? t("adm_users_lock") : t("adm_users_unlock")}
                </div>
              </Btn>,
            ])}
              empty={t("adm_users_empty")}
            />

            {/* Pagination */}
            {filtered.length > pageSize && (
              <div className="ui-pagination">
                {[...Array(Math.ceil(filtered.length / pageSize))].map((_, i) => (
                  <button
                    key={i}
                    onClick={() => { setPage(i + 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                    className={`ui-page-btn${page === i + 1 ? " active" : ""}`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </Card>

      {/* Add user modal */}
      {modal && (
        <Modal title={t("adm_users_modal_title")} onClose={() => setModal(false)}>
          {error && (
            <div style={{ background: "#ffebee", color: "#c62828", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
              ⚠️ {error}
            </div>
          )}

          {/* Avatar picker */}
          <div className="admin-users-modal-avatar-wrap">
            <div
              onClick={() => avatarInputRef.current?.click()}
              className={`admin-users-modal-avatar${form.avatarPreview ? " has-preview" : ""}`}
            >
              {form.avatarPreview
                ? <img src={form.avatarPreview} alt="avatar" />
                : <span style={{ fontSize: 32, color: "#fff" }}>👤</span>
              }
              <div className="admin-users-modal-avatar-overlay">📷</div>
            </div>
            <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatarChange} />
            <div className="admin-users-modal-avatar-hint">
              {form.avatarPreview ? t("adm_users_avatar_click") : t("adm_users_avatar_ph")}
            </div>
            {form.avatarPreview && (
              <button
                onClick={() => setForm(prev => ({ ...prev, avatarPreview: null }))}
                className="admin-users-modal-avatar-remove-btn"
              >
                {t("adm_users_avatar_del")}
              </button>
            )}
          </div>

          <FormField label={t("adm_email")} required>
            <Input value={form.email} onChange={upd("email")} type="email" placeholder="example@email.com" />
            {fieldErrors.email && <div style={{ color: "#c62828", fontSize: 12, marginTop: 4 }}>{fieldErrors.email}</div>}
          </FormField>
          <FormField label={t("adm_users_password")} required>
            <Input value={form.password} onChange={upd("password")} type="password" placeholder={t("adm_users_password_hint")} />
            {fieldErrors.password && <div style={{ color: "#c62828", fontSize: 12, marginTop: 4 }}>{fieldErrors.password}</div>}
          </FormField>
          <FormField label={t("adm_users_password_cf")} required>
            <Input value={form.confirmPassword} onChange={upd("confirmPassword")} type="password" placeholder={t("adm_users_password_ph")} />
            {fieldErrors.confirmPassword && <div style={{ color: "#c62828", fontSize: 12, marginTop: 4 }}>{fieldErrors.confirmPassword}</div>}
          </FormField>
          <FormField label={t("adm_users_col_type")} required>
            <Select value={form.userType} onChange={upd("userType")}>
              <option value="CUSTOMER">{t("adm_users_role_customer")}</option>
              <option value="PARTNER">{t("adm_users_role_partner")}</option>
            </Select>
          </FormField>
          <div className="admin-users-modal-actions">
            <Btn variant="ghost" onClick={() => setModal(false)}>{t("adm_cancel")}</Btn>
            <Btn disabled={saving || !form.email || !form.password || Object.values(fieldErrors).some(Boolean)} onClick={handleCreate}>
              {saving ? t("adm_processing") : t("adm_users_submit")}
            </Btn>
          </div>
        </Modal>
      )}
    </AdminLayout>
  );
}
