import { createElement, useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import MainNavbar from "../../components/MainNavbar";
import Footer from "../../components/Footer";
import PartnerSidebar from "../../components/partner/PartnerSidebar";
import {
  useProfile,
  useBilling,
  useNotifications,
  useUpdateProfile,
  useUploadAvatar,
  useMarkNotificationRead,
} from "../../hooks/useProfileQueries";
import { 
  Camera, User, Mail, Phone, MapPin, Shield, CheckCircle2, 
  Save, Trash2, Bell, CreditCard, Lock, Eye, EyeOff,
  Globe, Calendar, Award, Briefcase, LogOut, Settings, 
  Building2, FileText, PieChart, Users, Zap, Landmark
} from "lucide-react";
import "../../styles/pages/ProfilePage.css";

const P = "#BE1E2E";

const ROLE_CONFIG = {
  CUSTOMER: { 
    label: "Khách hàng thân thiết", 
    background: "#eff6ff", 
    color: "#1e40af", 
    accent: "#3b82f6",
    tabs: ["general", "security", "billing", "notify"]
  },
  PARTNER: { 
    label: "Đối tác kinh doanh", 
    background: "#FFF1F2", 
    color: "#BE1E2E", 
    accent: "#BE1E2E",
    tabs: ["business", "security", "billing", "notify"]
  },
  ADMIN: { 
    label: "Quản trị viên hệ thống", 
    background: "#fdf2f2", 
    color: "#991B1B", 
    accent: "#991B1B",
    tabs: ["general", "security", "notify"]
  },
};

const EMPTY_FORM = {
  fullName: "",
  email: "",
  phone: "",
  address: "",
  dob: "",
  bio: "",
  brandName: "",
  taxCode: "",
  representative: "",
  businessType: "",
  foundedDate: "",
  website: "",
};

function toDateInputValue(value) {
  return value ? String(value).slice(0, 10) : "";
}

function mapProfileToForm(profile, fallbackUser) {
  return {
    fullName: profile?.fullName || "",
    email: profile?.contactEmail || fallbackUser?.email || "",
    phone: profile?.phone || "",
    address: profile?.address || "",
    dob: toDateInputValue(profile?.dateOfBirth),
    bio: profile?.bio || "",
    brandName: profile?.brandName || "",
    taxCode: profile?.taxCode || "",
    representative: profile?.representativeName || "",
    businessType: profile?.businessType || "",
    foundedDate: toDateInputValue(profile?.foundedDate),
    website: profile?.website || "",
  };
}

function initialsFrom(value) {
  const text = (value || "").trim();
  if (!text) return "U";
  return text
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join("");
}

export default function ProfilePage({ navigate, onLogout }) {
  const { user } = useAuth();
  const [editing, setEditing]   = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [error, setError]       = useState("");
  const [message, setMessage]   = useState("");
  const [form, setForm]         = useState(() => ({ ...EMPTY_FORM, email: user?.email || "" }));
  const [selectedHotelId, setSelectedHotelId] = useState(() => {
    const saved = localStorage.getItem("partner_selected_hotel_id");
    return saved ? Number(saved) : null;
  });

  // ── Queries ───────────────────────────────────────────────────────
  const { data: profile, isLoading: pageLoading } = useProfile();
  const { data: rawBilling }        = useBilling();
  const { data: rawNotifications }  = useNotifications();

  const billing       = Array.isArray(rawBilling)        ? rawBilling        : [];
  const notifications = Array.isArray(rawNotifications)  ? rawNotifications  : [];
  const avatar        = profile?.avatarUrl || "";

  const effectiveUserType = profile?.userType || user?.userType;
  const isPartner = effectiveUserType === "PARTNER";
  const cfg       = ROLE_CONFIG[effectiveUserType] || ROLE_CONFIG.CUSTOMER;
  const accentColor = cfg.accent;
  const [activeTab, setActiveTab] = useState(isPartner ? "business" : "general");

  // Sync form when profile loads
  useEffect(() => {
    if (profile) {
      setForm(mapProfileToForm(profile, user));
      setActiveTab(profile.userType === "PARTNER" ? "business" : "general");
    }
  }, [profile]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Mutations ─────────────────────────────────────────────────────
  const updateProfile       = useUpdateProfile();
  const uploadAvatar        = useUploadAvatar();
  const markNotifRead       = useMarkNotificationRead();

  const loading              = updateProfile.isPending;
  const avatarLoading        = uploadAvatar.isPending;
  const markingNotification  = markNotifRead.variables ?? null;

  const handleCancel = () => {
    setForm(mapProfileToForm(profile, user));
    setEditing(false);
    setMessage("");
    setError("");
  };

  const handleSave = () => {
    setError("");
    setMessage("");
    updateProfile.mutate(
      {
        fullName: form.fullName,
        contactEmail: form.email,
        phone: form.phone,
        address: form.address,
        dateOfBirth: form.dob || null,
        bio: form.bio,
        brandName: form.brandName,
        taxCode: form.taxCode,
        representativeName: form.representative,
        businessType: form.businessType,
        foundedDate: form.foundedDate || null,
        website: form.website,
      },
      {
        onSuccess: () => { setEditing(false); setMessage("Đã lưu hồ sơ vào dữ liệu thật."); },
        onError:   (e) => setError(e.message || "Không thể lưu hồ sơ."),
      }
    );
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setError("");
    setMessage("");
    uploadAvatar.mutate(file, {
      onSuccess: () => setMessage("Đã cập nhật ảnh đại diện."),
      onError:   (err) => setError(err.message || "Không thể upload ảnh đại diện."),
    });
  };

  const handlePreferenceChange = (key, value) => {
    setError("");
    setMessage("");
    // Build a plain preferences object and reuse updateProfile
    updateProfile.mutate(
      {
        loginAlertEnabled:    key === "loginAlertEnabled"    ? value : profile?.loginAlertEnabled,
        bookingUpdateEnabled: key === "bookingUpdateEnabled" ? value : profile?.bookingUpdateEnabled,
      },
      {
        onSuccess: () => setMessage("Đã cập nhật tuỳ chọn thông báo."),
        onError:   (e) => setError(e.message || "Không thể cập nhật tuỳ chọn."),
      }
    );
  };

  const handleMarkNotificationRead = (notificationId) => {
    if (!notificationId) return Promise.resolve(false);
    setError("");
    setMessage("");
    return new Promise((resolve) => {
      markNotifRead.mutate(notificationId, {
        onSuccess: () => resolve(true),
        onError: (e) => { setError(e.message || "Không thể cập nhật thông báo."); resolve(false); },
      });
    });
  };

  const handleNotificationAction = async (notification) => {
    if (!notification?.actionUrl) return;
    if (notification.id && notification.read === false) {
      const marked = await handleMarkNotificationRead(notification.id);
      if (!marked) return;
    }

    if (notification.actionUrl === "/customer/reviews") {
      navigate("customer-reviews");
      return;
    }
    window.location.assign(notification.actionUrl);
  };

  const TABS = [
    { id: "general",  label: "Cá nhân", icon: User, hidden: isPartner },
    { id: "business", label: "Thông tin doanh nghiệp", icon: Building2, hidden: !isPartner },
    { id: "security", label: "Bảo mật tài khoản", icon: Lock },
    { id: "billing",  label: "Lịch sử thanh toán", icon: CreditCard, hidden: effectiveUserType === "ADMIN" || isPartner },
    { id: "notify",   label: "Thông báo", icon: Bell },
  ].filter(t => !t.hidden);

  const displayName = profile?.displayName || form.brandName || form.fullName || user?.email || "Tài khoản";
  const accountId = profile?.id || user?.id || "—";
  const bookingCount = profile?.bookingCount ?? 0;
  const hotelCount = profile?.hotelCount ?? 0;
  const tierLabel = profile?.tierLabel || "—";
  const partnerStatus = profile?.partnerApplicationStatus || profile?.status || "—";
  const passwordChangedAt = formatDateTime(profile?.passwordChangedAt);

  const profileContent = (
    <div style={{ flex: 1, paddingBottom: 80 }}>
        {/* Cover Photo */}
        <div style={{ height: 260, width: "100%", background: `linear-gradient(135deg, ${accentColor} 0%, #1e293b 100%)`, position: "relative" }}>
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent, rgba(0,0,0,0.5))" }} />
          <div style={{ maxWidth: 1140, margin: "0 auto", height: "100%", position: "relative" }}>
              <div style={{ position: "absolute", bottom: 40, left: 20, color: "#fff" }}>
                 <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.2)", backdropFilter: "blur(10px)", padding: "6px 14px", borderRadius: 100, fontSize: 11, fontWeight: 800, textTransform: "uppercase", marginBottom: 12 }}>
                    <Zap size={14} fill="#fff" /> {cfg.label}
                 </div>
                 <h1 style={{ fontSize: 36, fontWeight: 900, margin: 0, textShadow: "0 2px 4px rgba(0,0,0,0.3)" }}>
                   {displayName}
                 </h1>
              </div>

              <div style={{ position: "absolute", bottom: 40, right: 20, display: "flex", gap: 12 }}>
                {TABS.map(t => (
                  <button 
                    key={t.id} 
                    onClick={() => setActiveTab(t.id)}
                    className={`profile-tab-btn profile-tab-btn-header ${activeTab === t.id ? "profile-tab-btn-header-active" : ""}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
          </div>
        </div>

        <div style={{ maxWidth: 1140, margin: "-40px auto 0", padding: "0 20px", position: "relative", zIndex: 10 }}>
          
          <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 32, alignItems: "start" }}>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              
              <div style={{ background: "#fff", borderRadius: 32, padding: "32px", border: "1px solid #f1f5f9", boxShadow: "0 20px 40px -12px rgba(0,0,0,0.08)", textAlign: "center" }}>
                <div style={{ position: "relative", width: 140, height: 140, margin: "0 auto 20px" }}>
                  <div style={{
                    width: "100%",
                    height: "100%",
                    borderRadius: "50%",
                    background: avatar ? `url(${avatar}) center/cover` : `${accentColor}18`,
                    border: "6px solid #fff",
                    boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
                    overflow: "hidden",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: accentColor,
                    fontSize: 42,
                    fontWeight: 900,
                  }}>
                    {!avatar && initialsFrom(displayName)}
                  </div>
                  <label style={{ position: "absolute", bottom: 5, right: 5, width: 36, height: 36, borderRadius: "50%", background: accentColor, border: "3px solid #fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 4px 10px rgba(0,0,0,0.2)" }}>
                    <Camera size={16} color="#fff" />
                    <input type="file" style={{ display: "none" }} accept="image/*" onChange={handleAvatarChange} disabled={avatarLoading} />
                  </label>
                </div>

                <h2 style={{ fontSize: 20, fontWeight: 900, color: "#1e293b", margin: "0 0 4px" }}>
                  {isPartner ? "Tài khoản Doanh nghiệp" : displayName}
                </h2>
                <div style={{ fontSize: 13, color: "#64748b", fontWeight: 600, marginBottom: 24 }}>ID: #{accountId}</div>
                
                <div style={{ display: "flex", flexDirection: "column", gap: 12, borderTop: "1px solid #f1f5f9", paddingTop: 24 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: 13, color: "#94a3b8", fontWeight: 700 }}>{isPartner ? "Khách sạn" : "Đặt phòng"}</div>
                    <div style={{ fontSize: 14, fontWeight: 900, color: "#1e293b" }}>{isPartner ? `${hotelCount} Cơ sở` : `${bookingCount} Đã đặt`}</div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: 13, color: "#94a3b8", fontWeight: 700 }}>{isPartner ? "Hồ sơ" : "Hạng"}</div>
                    <div style={{ fontSize: 14, fontWeight: 900, color: accentColor }}>{isPartner ? partnerStatus : tierLabel}</div>
                  </div>
                </div>
              </div>

              <div className="profile-tabs">
                {TABS.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id)}
                    className={`profile-tab-btn profile-tab-btn-sidebar ${activeTab === t.id ? "profile-tab-btn-sidebar-active" : ""}`}
                  >
                    <t.icon size={18} /> {t.label}
                  </button>
                ))}
                {!isPartner && (
                  <>
                    <div className="profile-tabs-divider" />
                    <button
                      onClick={() => onLogout && onLogout()}
                      className="profile-logout-btn"
                    >
                      <LogOut size={18} /> Thoát tài khoản
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="profile-section-card">
              {pageLoading && (
                <div className="profile-bio-text" style={{ marginBottom: 18 }}>
                  Đang tải dữ liệu hồ sơ từ hệ thống...
                </div>
              )}

              {error && (
                <div style={{ background: "#fef2f2", color: "#b91c1c", borderRadius: 12, padding: "12px 14px", fontSize: 13, fontWeight: 700, marginBottom: 18 }}>
                  {error}
                </div>
              )}

              {message && (
                <div style={{ background: "#ecfdf5", color: "#047857", borderRadius: 12, padding: "12px 14px", fontSize: 13, fontWeight: 700, marginBottom: 18 }}>
                  {message}
                </div>
              )}
              
              <div className="profile-section-header">
                <div>
                  <h3 className="profile-section-title">
                    {TABS.find(t => t.id === activeTab).label}
                  </h3>
                  <div className="profile-section-desc">
                    {isPartner ? "Quản lý hồ sơ pháp lý và thông tin doanh nghiệp" : "Cập nhật thông tin cá nhân của bạn"}
                  </div>
                </div>
                {!editing ? (
                  <button onClick={() => setEditing(true)} className="profile-edit-btn">
                    <Settings size={18} /> Chỉnh sửa
                  </button>
                ) : (
                  <div className="profile-action-group">
                    <button onClick={handleCancel} className="profile-cancel-btn">Hủy</button>
                    <button onClick={handleSave} disabled={loading} className="profile-save-btn" style={{ backgroundColor: accentColor }}>
                      {loading ? "Đang lưu..." : <><Save size={18} /> Lưu hồ sơ</>}
                    </button>
                  </div>
                )}
              </div>

              {/* TAB: Business (Partner Only) */}
              {activeTab === "business" && (
                <div className="profile-tab-content">
                  <div className="profile-form-grid">
                    <InputBox label="Tên doanh nghiệp / Thương hiệu" value={form.brandName} icon={Landmark} editing={editing} accent={accentColor} onChange={v => setForm({...form, brandName: v})} />
                    <InputBox label="Mã số thuế (Tax Code)" value={form.taxCode} icon={FileText} editing={editing} accent={accentColor} onChange={v => setForm({...form, taxCode: v})} />
                    <InputBox label="Người đại diện pháp luật" value={form.representative} icon={UserCheck} editing={editing} accent={accentColor} onChange={v => setForm({...form, representative: v})} />
                    <InputBox label="Loại hình kinh doanh" value={form.businessType} icon={Briefcase} editing={editing} accent={accentColor} onChange={v => setForm({...form, businessType: v})} />
                    <InputBox label="Email doanh nghiệp" value={form.email} icon={Mail} editing={editing} accent={accentColor} onChange={v => setForm({...form, email: v})} />
                    <InputBox label="Hotline hỗ trợ" value={form.phone} icon={Phone} editing={editing} accent={accentColor} onChange={v => setForm({...form, phone: v})} />
                    
                    <div className="profile-full-width">
                      <InputBox label="Địa chỉ trụ sở chính" value={form.address} icon={MapPin} editing={editing} accent={accentColor} onChange={v => setForm({...form, address: v})} />
                    </div>

                    <div className="profile-full-width">
                      <div className="profile-input-label">Giới thiệu về doanh nghiệp</div>
                      {editing ? (
                        <textarea 
                          className="profile-textarea" 
                          value={form.bio} 
                          onChange={e => setForm({...form, bio: e.target.value})}
                        />
                      ) : (
                        <p className="profile-bio-text">{form.bio}</p>
                      )}
                    </div>
                  </div>

                  <div className="profile-stats-grid">
                    {[
                      { label: "Trạng thái hồ sơ", value: partnerStatus, icon: CheckCircle2, color: "#10b981" },
                      { label: "Ngày tạo tài khoản", value: formatDate(profile?.createdAt), icon: FileText, color: "#f59e0b" },
                      { label: "Phân hạng đối tác", value: tierLabel, icon: PieChart, color: "#8b5cf6" },
                    ].map((item, i) => (
                      <div key={i} className="profile-stat-card">
                        <item.icon size={20} color={item.color} style={{ marginBottom: 12 }} />
                        <div className="profile-stat-card-label">{item.label}</div>
                        <div className="profile-stat-card-value">{item.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB: General (Customer/Admin Only) */}
              {activeTab === "general" && (
                <div className="profile-tab-content">
                  <div className="profile-form-grid">
                    <InputBox label="Họ và tên" value={form.fullName} icon={User} editing={editing} accent={accentColor} onChange={v => setForm({...form, fullName: v})} />
                    <InputBox label="Email liên hệ" value={form.email} icon={Mail} editing={editing} accent={accentColor} onChange={v => setForm({...form, email: v})} />
                    <InputBox label="Số điện thoại" value={form.phone} icon={Phone} editing={editing} accent={accentColor} onChange={v => setForm({...form, phone: v})} />
                    <InputBox label="Ngày sinh" value={form.dob} icon={Calendar} editing={editing} accent={accentColor} type="date" onChange={v => setForm({...form, dob: v})} />
                    
                    <div className="profile-full-width">
                      <InputBox label="Địa chỉ" value={form.address} icon={MapPin} editing={editing} accent={accentColor} onChange={v => setForm({...form, address: v})} />
                    </div>

                    <div className="profile-full-width">
                      <div className="profile-input-label">Tiểu sử</div>
                      {editing ? (
                        <textarea 
                          className="profile-textarea" 
                          value={form.bio} 
                          onChange={e => setForm({...form, bio: e.target.value})}
                        />
                      ) : (
                        <p className="profile-bio-text">{form.bio}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: Security */}
              {activeTab === "security" && (
                <div className="profile-tab-content">
                  <div className="profile-security-box">
                    <div className="profile-security-header">
                      <div className="profile-security-info">
                        <div className="profile-security-icon-box">
                          <Shield size={26} color={accentColor} />
                        </div>
                        <div>
                          <div className="profile-security-title">Mật khẩu tài khoản</div>
                          <div className="profile-security-desc">Lần cập nhật gần nhất: {passwordChangedAt}</div>
                        </div>
                      </div>
                      <button className="profile-password-btn" style={{ backgroundColor: accentColor }}>Đổi mật khẩu</button>
                    </div>
                    
                    <div style={{ position: "relative" }}>
                      <input 
                        type={showPass ? "text" : "password"} 
                        className="profile-input"
                        value={showPass ? "Mật khẩu không hiển thị từ hệ thống" : "************"} readOnly 
                      />
                      <button onClick={() => setShowPass(!showPass)} className="profile-eye-btn">
                        {showPass ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                  </div>

                  <div className="profile-toggles">
                    <SecurityToggle
                      label="Cảnh báo đăng nhập lạ"
                      desc="Nhận email khi có hoạt động đăng nhập bất thường"
                      active={Boolean(profile?.loginAlertEnabled)}
                      accent={accentColor}
                      onChange={(value) => handlePreferenceChange("loginAlertEnabled", value)}
                    />
                    <SecurityToggle
                      label="Thông báo booking"
                      desc={isPartner ? "Nhận cập nhật khi booking hoặc hoàn tiền thay đổi" : "Nhận cập nhật khi booking của bạn thay đổi"}
                      active={Boolean(profile?.bookingUpdateEnabled)}
                      accent={accentColor}
                      onChange={(value) => handlePreferenceChange("bookingUpdateEnabled", value)}
                    />
                  </div>
                </div>
              )}

              {/* TAB: Billing */}
              {activeTab === "billing" && (
                <div className="profile-tab-content">
                  <div className="profile-billing-header">
                    <h4 className="profile-billing-title">
                      {isPartner ? "Phương thức nhận tiền" : "Thanh toán đã liên kết"}
                    </h4>
                    <button className="profile-billing-add-btn">
                      <CreditCard size={16} /> {isPartner ? "Quản lý tài khoản ngân hàng" : "Thêm thẻ mới"}
                    </button>
                  </div>
                  
                  <div className="profile-table-container">
                    <table className="profile-table">
                      <thead className="profile-table-head">
                        <tr>
                          <th className="profile-table-th">Mã GD</th>
                          <th className="profile-table-th">Ngày tháng</th>
                          <th className="profile-table-th">Nội dung</th>
                          <th className="profile-table-th" style={{ textAlign: "right" }}>Số tiền</th>
                        </tr>
                      </thead>
                      <tbody>
                        {billing.length === 0 && (
                          <tr>
                            <td className="profile-table-td" colSpan={4} style={{ textAlign: "center", color: "#94a3b8", padding: 32 }}>
                              Chưa có giao dịch nào.
                            </td>
                          </tr>
                        )}
                        {billing.map(tx => (
                          <tr key={tx.id} className="profile-billing-row">
                            <td className="profile-table-td">#{tx.id}</td>
                            <td className="profile-table-td">{formatDateTime(tx.createdAt)}</td>
                            <td className="profile-table-td" style={{ fontWeight: 600 }}>{tx.description || tx.hotelName || `Booking #${tx.bookingId}`}</td>
                            <td className="profile-table-td" style={{ textAlign: "right", color: accentColor, fontWeight: 900 }}>
                               {formatMoney(tx.amount, isPartner)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === "notify" && (
                <div className="profile-tab-content">
                  {notifications.length === 0 && (
                    <div className="profile-bio-text">Chưa có thông báo nào.</div>
                  )}
                  {notifications.map((n, index) => (
                    <div key={`${n.id || n.type}-${n.occurredAt}-${index}`} className="profile-notify-card" style={{ borderColor: n.read === false ? "#bfdbfe" : undefined }}>
                      <div className="profile-notify-icon" style={{ backgroundColor: n.type === "SECURITY" ? "#fef2f2" : "#f0f9ff" }}>
                        {n.type === "SECURITY" ? <Shield size={28} color="#ef4444" /> : <Bell size={28} color="#0ea5e9" />}
                      </div>
                      <div className="profile-notify-content">
                        <div className="profile-notify-header">
                          <div className="profile-notify-title">
                            {n.read === false && (
                              <span style={{ background: "#dbeafe", borderRadius: 999, color: "#1d4ed8", display: "inline-block", fontSize: 10, fontWeight: 900, marginRight: 8, padding: "3px 8px", textTransform: "uppercase" }}>
                                Mới
                              </span>
                            )}
                            {n.title}
                          </div>
                          <div className="profile-notify-time">{formatDateTime(n.occurredAt)}</div>
                        </div>
                        <p className="profile-notify-desc">{n.message}</p>
                        {n.id && n.read === false && (
                          <button
                            onClick={() => handleMarkNotificationRead(n.id)}
                            disabled={markingNotification === n.id}
                            style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, color: "#1d4ed8", cursor: markingNotification === n.id ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 800, marginTop: 10, opacity: markingNotification === n.id ? 0.7 : 1, padding: "7px 10px" }}
                          >
                            {markingNotification === n.id ? "Đang cập nhật..." : "Đánh dấu đã đọc"}
                          </button>
                        )}
                        {n.actionUrl && (
                          <button
                            onClick={() => handleNotificationAction(n)}
                            disabled={markingNotification === n.id}
                            style={{ background: "#BE1E2E", border: "none", borderRadius: 10, color: "#fff", cursor: markingNotification === n.id ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 800, marginLeft: n.id && n.read === false ? 8 : 0, marginTop: 10, opacity: markingNotification === n.id ? 0.7 : 1, padding: "7px 10px" }}
                          >
                            {n.type === "REVIEW" ? "Đánh giá ngay" : "Xem chi tiết"}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
  );

  if (isPartner) {
    return (
      <div style={{ display: "flex", minHeight: "100vh", background: "#f1f5f9", "--accent-color": accentColor }}>
        <PartnerSidebar
          selectedHotelId={selectedHotelId}
          onSelectHotel={(id) => {
            setSelectedHotelId(id);
            localStorage.setItem("partner_selected_hotel_id", id);
          }}
        />
        <div style={{ flex: 1, minWidth: 0, overflowY: "auto" }}>
          {profileContent}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #ffffff 0%, #fdf4f5 45%, #f7ebeb 100%)",
      display: "flex",
      flexDirection: "column",
      "--accent-color": accentColor
    }}>
      <MainNavbar active="profile" navigate={navigate} user={user} onLogout={onLogout} />
      {profileContent}
      <Footer navigate={navigate} />
    </div>
  );
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("vi-VN");
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMoney(value, isPartner) {
  const amount = Number(value || 0);
  const prefix = amount < 0 ? "-" : isPartner ? "+" : "-";
  return `${prefix}${new Intl.NumberFormat("vi-VN").format(Math.abs(amount))} ₫`;
}

function InputBox({ label, value, icon: Icon, editing, type = "text", onChange, accent }) {
  return (
    <div>
      <div className="profile-input-label">
        {createElement(Icon, { size: 14, color: accent })} {label}
      </div>
      {editing ? (
        <input 
          type={type}
          className="profile-input"
          value={value} 
          onChange={e => onChange(e.target.value)}
        />
      ) : (
        <div className="profile-value-text">{value || "—"}</div>
      )}
    </div>
  );
}

function SecurityToggle({ label, desc, active, accent, onChange }) {
  const isOn = Boolean(active);
  return (
    <div className="profile-security-toggle">
      <div>
        <div className="profile-toggle-label">{label}</div>
        <div className="profile-toggle-desc">{desc}</div>
      </div>
      <div 
        onClick={() => onChange?.(!isOn)}
        className={`profile-switch ${isOn ? "profile-switch-on" : ""}`}
        style={{ backgroundColor: isOn ? accent : "#e2e8f0" }}
      >
        <div className="profile-switch-thumb" style={{ left: isOn ? 27 : 3 }} />
      </div>
    </div>
  );
}

function UserCheck(props) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg>
  );
}
