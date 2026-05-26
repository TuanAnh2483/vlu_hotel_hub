import { useState, useEffect } from "react";
import MainNavbar from "../components/MainNavbar";
import Footer from "../components/Footer";
import { useBookingDetail, useCreatePaymentSession } from "../hooks/useBookingQueries";
import { useLang } from "../contexts/LanguageContext";
import { C } from "../lib/constants";
import {
  ChevronLeft, CreditCard, Wallet,
  ShieldCheck, Lock, ArrowRight, Check,
  QrCode, Sparkles
} from "lucide-react";

const P = C.primary;

// --- Helpers ---
function fmt(n) { return (n || 0).toLocaleString("vi-VN") + " ₫"; }
function fmtDate(s) {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d) ? s : d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function nightsBetween(a, b) {
  const diff = (new Date(b) - new Date(a)) / 86400000;
  return diff > 0 ? Math.round(diff) : 0;
}
function formatCardNum(v) {
  return v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
}
function formatExpiry(v) {
  const n = v.replace(/\D/g, "").slice(0, 4);
  return n.length >= 3 ? n.slice(0, 2) + "/" + n.slice(2) : n;
}

// --- Components ---

function Stepper() {
  const { t } = useLang();
  const steps = [t("step_room"), t("step_confirm"), t("step_payment"), t("step_done")];
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
      {steps.map((s, i) => {
        const done   = i < 2;
        const active = i === 2;
        return (
          <div key={s} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%", display: "flex",
                alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800,
                background: active ? P : done ? "#10b981" : "rgba(255,255,255,0.1)",
                color: "#fff",
                border: active ? "none" : done ? "none" : "1px solid rgba(255,255,255,0.2)",
                boxShadow: active ? `0 0 0 4px ${P}33` : "none"
              }}>
                {done ? <Check size={14} strokeWidth={3} /> : i + 1}
              </div>
              <span style={{ fontSize: 13, fontWeight: active ? 800 : 600, color: active ? "#fff" : done ? "#10b981" : "rgba(255,255,255,0.4)" }}>{s}</span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ width: 40, height: 2, background: done ? "#10b981" : "rgba(255,255,255,0.1)", borderRadius: 2 }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function MethodCard({ method, active, onSelect }) {
  const Icon = method.icon;
  const disabled = method.disabled;
  return (
    <button 
      onClick={() => !disabled && onSelect(method.id)}
      disabled={disabled}
      style={{
        flex: 1, padding: "24px 20px", borderRadius: 24, border: "2.5px solid",
        borderColor: active ? P : "#f1f5f9",
        background: active ? "#fff" : "#f8fafc",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
        cursor: disabled ? "not-allowed" : "pointer", transition: "all 0.3s ease",
        boxShadow: active ? `0 12px 24px ${P}15` : "none",
        opacity: disabled ? 0.55 : 1
      }}
    >
       <div style={{ width: 48, height: 48, borderRadius: 16, background: active ? P : "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.3s" }}>
          <Icon size={24} color={active ? "#fff" : "#64748b"} />
       </div>
       <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: active ? "#1e293b" : "#64748b", marginBottom: 4 }}>{method.label}</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8" }}>{method.sub}</div>
       </div>
    </button>
  );
}

const METHODS = [
  { id: "bank",   label: "VietQR", icon: QrCode, sub: "Chuyển khoản ngân hàng" },
  { id: "card",   label: "Thẻ Quốc Tế", icon: CreditCard, sub: "Sẽ hỗ trợ sau", disabled: true },
  { id: "wallet", label: "Ví Điện Tử",   icon: Wallet,   sub: "Sẽ hỗ trợ sau", disabled: true },
];

export default function PaymentPage({ navigate, user, params = {}, onLogout }) {
  const { bookingId } = params;

  const isPending = (data) => data?.status === "PENDING_PAYMENT";

  const [method, setMethod]         = useState("bank");
  const [card, setCard]             = useState({ number: "", name: "", expiry: "", cvv: "" });
  const [paying, setPaying]         = useState(false);
  const [error, setError]           = useState("");
  const [paymentSession, setPaymentSession] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionError, setSessionError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  // Poll every 5 s while booking is PENDING_PAYMENT
  const {
    data: booking,
    isLoading: loading,
    error: bookingError,
    refetch: refetchBooking,
  } = useBookingDetail(bookingId, {
    refetchInterval: (query) => (isPending(query.state.data) ? 5000 : false),
  });

  // H-01: onError bị xoá trong React Query v5 — dùng useEffect thay thế
  useEffect(() => {
    if (bookingError) setError(bookingError.message || "Không thể tải đơn đặt phòng để thanh toán.");
  }, [bookingError]);

  const createPaymentSession = useCreatePaymentSession();

  // Create payment session once when booking arrives and is PENDING_PAYMENT
  useEffect(() => {
    if (!booking || !isPending(booking) || paymentSession || sessionLoading) return;
    setSessionLoading(true);
    setSessionError("");
    createPaymentSession.mutate(bookingId, {
      onSuccess: (session) => setPaymentSession(session),
      onError:   (err)     => setSessionError(err.message || "Không thể tạo phiên thanh toán chuyển khoản."),
      onSettled: ()        => setSessionLoading(false),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking?.status, bookingId]);

  // Navigate when status changes from poll
  useEffect(() => {
    if (!booking) return;
    if (booking.status === "CONFIRMED") {
      navigate("payment-success", { bookingId, amount: booking.totalPrice, hotelName: booking.hotelName });
    }
    if (booking.status === "CANCELLED") {
      navigate("payment-failed", { bookingId, errorMessage: "Phiên thanh toán đã hết hạn." });
    }
  }, [booking?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const nights    = booking ? nightsBetween(booking.checkIn, booking.checkOut) : 0;
  const total     = booking?.totalPrice || 0;
  const qrImageUrl = paymentSession?.qrImageUrl || null;

  const handlePay = async () => {
    setPaying(true); setError(""); setStatusMessage("");
    try {
      /*
       * Nút "Tôi đã chuyển khoản" chỉ kiểm tra lại trạng thái mới nhất.
       * Không gọi API giả lập /pay và không tự đổi booking sang CONFIRMED,
       * vì nguồn xác nhận thật phải là webhook SePay ở backend.
       */
      const { data: latest } = await refetchBooking();
      if (latest?.status === "CONFIRMED") {
        navigate("payment-success", { bookingId, amount: latest.totalPrice, hotelName: latest.hotelName });
        return;
      }
      if (latest?.status === "CANCELLED") {
        navigate("payment-failed", { bookingId, errorMessage: "Phiên thanh toán đã hết hạn." });
        return;
      }
      setStatusMessage("Chưa nhận được giao dịch. Vui lòng kiểm tra đúng số tiền và nội dung chuyển khoản.");
    } catch (err) {
      setError(err.message || "Không thể kiểm tra trạng thái thanh toán. Vui lòng thử lại.");
    } finally { setPaying(false); }
  };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #ffffff 0%, #fdf4f5 45%, #f7ebeb 100%)", display: "flex", flexDirection: "column" }}>
      <MainNavbar active="payment" navigate={navigate} user={user} onLogout={onLogout} />

      {/* --- Immersive Header --- */}
      <div style={{ 
        background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)", 
        padding: "40px 20px 80px", textAlign: "center", position: "relative", overflow: "hidden" 
      }}>
        <div style={{ position: "relative", zIndex: 1, maxWidth: 1140, margin: "0 auto" }}>
           <Stepper />
           <h1 style={{ color: "#fff", fontSize: 32, fontWeight: 900, marginTop: 32, marginBottom: 8 }}>Hoàn tất thanh toán</h1>
           <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 16 }}>An toàn · Bảo mật · Nhanh chóng</p>
        </div>
        <div style={{ position: "absolute", top: -100, left: -100, width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(190,30,46,0.15) 0%, transparent 70%)" }} />
      </div>

      <div style={{ flex: 1, maxWidth: 1140, margin: "-60px auto 40px", width: "100%", padding: "0 20px", display: "grid", gridTemplateColumns: "1fr 380px", gap: 32, position: "relative", zIndex: 2 }}>
        
        {/* --- Left Column --- */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          
          {/* Back Button */}
          <button 
            onClick={() => navigate("booking-detail", { bookingId })} 
            style={{ 
              display: "flex", alignItems: "center", gap: 10, padding: "10px 18px", 
              background: "#fff", border: "1px solid #e2e8f0", borderRadius: 100, 
              color: "#64748b", fontWeight: 700, fontSize: 13, cursor: "pointer", 
              transition: "all 0.2s", boxShadow: "0 2px 4px rgba(0,0,0,0.03)", width: "fit-content"
            }} 
          >
            <ChevronLeft size={18} /> Quay lại chi tiết đặt phòng
          </button>

          {/* Payment Methods Selection */}
          <div style={{ background: "#fff", borderRadius: 32, padding: "32px", boxShadow: "0 10px 30px rgba(0,0,0,0.03)", border: "1px solid #f1f5f9" }}>
             <h3 style={{ fontSize: 18, fontWeight: 800, color: "#1e293b", marginBottom: 24 }}>Phương thức thanh toán</h3>
             <div style={{ display: "flex", gap: 16, marginBottom: 32 }}>
                {METHODS.map(m => (
                  <MethodCard key={m.id} method={m} active={method === m.id} onSelect={setMethod} />
                ))}
             </div>

             {/* Form Area based on method */}
             <div style={{ padding: "32px", borderRadius: 24, background: "#f8fafc", border: "1px solid #f1f5f9" }}>
                {method === "card" && (
                  <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 40, alignItems: "center" }}>
                     <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                        <div>
                           <label style={labelSt}>SỐ THẺ</label>
                           <div style={{ position: "relative" }}>
                              <input style={inputSt} placeholder="0000 0000 0000 0000" value={card.number} onChange={e => setCard(p => ({ ...p, number: formatCardNum(e.target.value) }))} />
                              <CreditCard size={20} color="#94a3b8" style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)" }} />
                           </div>
                        </div>
                        <div>
                           <label style={labelSt}>TÊN CHỦ THẺ</label>
                           <input style={inputSt} placeholder="NGUYEN VAN A" value={card.name} onChange={e => setCard(p => ({ ...p, name: e.target.value.toUpperCase() }))} />
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                           <div>
                              <label style={labelSt}>HẾT HẠN</label>
                              <input style={inputSt} placeholder="MM/YY" value={card.expiry} onChange={e => setCard(p => ({ ...p, expiry: formatExpiry(e.target.value) }))} />
                           </div>
                           <div>
                              <label style={labelSt}>CVV</label>
                              <input style={inputSt} placeholder="•••" type="password" maxLength={4} value={card.cvv} onChange={e => setCard(p => ({ ...p, cvv: e.target.value.replace(/\D/g, "").slice(0, 4) }))} />
                           </div>
                        </div>
                     </div>
                     
                     {/* Visa Visual */}
                     <div style={{ background: "linear-gradient(135deg, #1e293b 0%, #334155 100%)", borderRadius: 24, padding: "28px", color: "#fff", position: "relative", overflow: "hidden", aspectRatio: "1.58/1", boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }}>
                        <div style={{ position: "absolute", top: -20, right: -20, width: 120, height: 120, background: "rgba(255,255,255,0.05)", borderRadius: "50%" }} />
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 40 }}>
                           <Sparkles size={24} color="rgba(255,255,255,0.4)" />
                           <div style={{ fontSize: 20, fontWeight: 900, fontStyle: "italic", opacity: 0.8 }}>VISA</div>
                        </div>
                        <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: 3, marginBottom: 32, fontFamily: "monospace" }}>{card.number || "•••• •••• •••• ••••"}</div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                           <div>
                              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>CHỦ THẺ</div>
                              <div style={{ fontSize: 13, fontWeight: 700 }}>{card.name || "NGUYEN VAN A"}</div>
                           </div>
                           <div style={{ textAlign: "right" }}>
                              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>HẾT HẠN</div>
                              <div style={{ fontSize: 13, fontWeight: 700 }}>{card.expiry || "MM/YY"}</div>
                           </div>
                        </div>
                     </div>
                  </div>
                )}

                {method === "bank" && (
                   <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
                      {/* QR — chỉ hiện khi đã có URL thật; không dùng QR tĩnh để tránh user quét nhầm */}
                      <div style={{ background: "#fff", padding: "24px", borderRadius: 24, border: "1.5px solid #f1f5f9", boxShadow: "0 4px 12px rgba(0,0,0,0.05)", marginBottom: 24 }}>
                         <div style={{ width: 200, height: 200, background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 12 }}>
                            {qrImageUrl ? (
                              <img
                                src={qrImageUrl}
                                alt="QR chuyển khoản"
                                style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: 10 }}
                              />
                            ) : (
                              <QrCode size={80} color="#cbd5e1" strokeWidth={1} />
                            )}
                         </div>
                         <p style={{ marginTop: 12, fontSize: 13, fontWeight: 800, color: "#1e293b" }}>Mã QR VietQR</p>
                      </div>
                      {sessionLoading && (
                        <div style={{ color: "#64748b", fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Đang tạo mã thanh toán...</div>
                      )}
                      {sessionError && (
                        <div style={{ background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: 14, color: "#be123c", fontSize: 13, lineHeight: 1.6, marginBottom: 14, padding: "12px 14px", maxWidth: 460 }}>
                          {sessionError}
                        </div>
                      )}
                      {/* Chỉ hiện thông tin CK khi session đã load thành công */}
                      {paymentSession ? (
                        <div style={{ maxWidth: 400, width: "100%" }}>
                           <div style={rowSt}><span>Ngân hàng:</span> <strong>{paymentSession.bankName}</strong></div>
                           <div style={rowSt}><span>Số tài khoản:</span> <strong>{paymentSession.bankAccountNo}</strong></div>
                           <div style={rowSt}><span>Chủ tài khoản:</span> <strong>{paymentSession.bankAccountName}</strong></div>
                           <div style={rowSt}><span>Số tiền:</span> <strong>{fmt(paymentSession.amount)}</strong></div>
                           <div style={rowSt}><span>Nội dung CK:</span> <strong style={{ color: P }}>{paymentSession.transferContent}</strong></div>
                        </div>
                      ) : !sessionLoading && !sessionError && (
                        <div style={{ color: "#94a3b8", fontSize: 13, fontWeight: 600 }}>Thông tin chuyển khoản sẽ hiện khi mã được tạo.</div>
                      )}
                      <p style={{ margin: "16px 0 0", color: "#64748b", fontSize: 12, lineHeight: 1.7, maxWidth: 440 }}>
                        SePay sẽ tự xác nhận khi giao dịch vào tài khoản. Trang này kiểm tra trạng thái mỗi vài giây.
                      </p>
                   </div>
                )}

                {method === "wallet" && (
                   <div style={{ textAlign: "center" }}>
                      <p style={{ fontSize: 15, fontWeight: 700, color: "#475569", marginBottom: 24 }}>Chọn ứng dụng để quét mã</p>
                      <div style={{ display: "flex", justifyContent: "center", gap: 32 }}>
                         {["MoMo", "ZaloPay", "VNPay"].map(w => (
                            <div key={w} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                               <div style={{ width: 64, height: 64, borderRadius: 16, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(0,0,0,0.05)", cursor: "pointer" }}>
                                  <Wallet size={32} color={w === "MoMo" ? "#ae2070" : w === "ZaloPay" ? "#0068ff" : "#d80027"} />
                                </div>
                                <span style={{ fontSize: 12, fontWeight: 700, color: "#1e293b" }}>{w}</span>
                            </div>
                         ))}
                      </div>
                   </div>
                )}
             </div>

             {/* Safety info */}
             <div style={{ display: "flex", justifyContent: "center", gap: 40, marginTop: 32 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#10b981", fontSize: 13, fontWeight: 700 }}>
                   <ShieldCheck size={20} /> Bảo mật SSL 256-bit
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#3b82f6", fontSize: 13, fontWeight: 700 }}>
                   <Lock size={20} /> Thanh toán an toàn PCI-DSS
                </div>
             </div>
          </div>
        </div>

        {/* --- Right Column (Summary) --- */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          
          <div style={{ background: "#fff", borderRadius: 32, padding: "32px", boxShadow: "0 20px 40px rgba(0,0,0,0.06)", border: "1px solid #f1f5f9", position: "sticky", top: 20 }}>
             <h3 style={{ fontSize: 18, fontWeight: 900, color: "#1e293b", marginBottom: 24 }}>Chi tiết đơn hàng</h3>
             {loading && (
               <div style={{ color: "#94a3b8", fontSize: 14, marginBottom: 20 }}>Đang tải thông tin thanh toán...</div>
             )}
             {!loading && !booking && (
               <div style={{ background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: 16, color: "#be123c", fontSize: 13, lineHeight: 1.7, marginBottom: 20, padding: "14px 16px" }}>
                 {error || "Không tìm thấy đơn đặt phòng để thanh toán."}
               </div>
             )}
             
             <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
                <div style={{ width: 80, height: 80, borderRadius: 16, background: "#f8fafc", overflow: "hidden" }}>
                   <img src="https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&q=80&w=200" style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="hotel" />
                </div>
                <div style={{ flex: 1 }}>
                   <div style={{ fontSize: 15, fontWeight: 800, color: "#1e293b", marginBottom: 4 }}>{booking?.hotelName || t("bkd_title_fallback")}</div>
                   <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>{nights} đêm · {fmtDate(booking?.checkIn)}</div>
                </div>
             </div>

             <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 24 }}>
                {booking?.items?.map((item, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "#64748b", fontWeight: 500 }}>
                     <span>{item.roomTypeName} × {item.quantity}</span>
                     <span style={{ fontWeight: 700, color: "#1e293b" }}>{fmt(item.stayPrice)}</span>
                  </div>
                ))}
                <div style={{ height: 1, background: "#f1f5f9", margin: "8px 0" }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                   <span style={{ fontSize: 15, fontWeight: 800, color: "#1e293b" }}>Tổng thanh toán</span>
                   <span style={{ fontSize: 24, fontWeight: 900, color: P }}>{fmt(total)}</span>
                </div>
             </div>

             <button
               disabled={paying || loading || sessionLoading || !booking || booking.status !== "PENDING_PAYMENT"}
               onClick={handlePay}
               style={primaryBtnSt}
             >
               {paying ? "Đang kiểm tra..." : "Tôi đã chuyển khoản"} <ArrowRight size={20} />
             </button>

             {error && booking && (
               <div style={{ marginTop: 16, padding: "14px 16px", background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: 16, color: "#be123c", fontSize: 12, lineHeight: 1.6, fontWeight: 700 }}>
                 {error}
               </div>
             )}

             {statusMessage && (
               <div style={{ marginTop: 16, padding: "14px 16px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 16, color: "#92400e", fontSize: 12, lineHeight: 1.6, fontWeight: 700 }}>
                 {statusMessage}
               </div>
             )}

             {booking?.status && booking.status !== "PENDING_PAYMENT" && (
               <div style={{ marginTop: 16, padding: "14px 16px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 16, color: "#475569", fontSize: 12, lineHeight: 1.6, fontWeight: 700 }}>
                 Trạng thái hiện tại: {booking.status}
               </div>
             )}
          </div>

          <div style={{ background: "#f0fdf4", borderRadius: 24, padding: "24px", border: "1px solid #bbf7d0" }}>
             <div style={{ display: "flex", gap: 12, marginBottom: 8 }}>
                <Sparkles size={18} color="#10b981" />
                <h4 style={{ fontSize: 13, fontWeight: 800, color: "#166534", margin: 0 }}>Tích lũy điểm thưởng</h4>
             </div>
             <p style={{ fontSize: 12, color: "#15803d", margin: 0, fontWeight: 500 }}>Hoàn tất thanh toán ngay để nhận thêm <strong>120 điểm</strong> thưởng vào ví của bạn.</p>
          </div>
        </div>

      </div>

      <Footer navigate={navigate} />
    </div>
  );
}

const labelSt = { fontSize: 11, fontWeight: 800, color: "#94a3b8", letterSpacing: 1.5, marginBottom: 8, display: "block" };
const inputSt = { width: "100%", padding: "14px 16px", borderRadius: 14, border: "1.5px solid #e2e8f0", fontSize: 14, outline: "none", background: "#fff", fontWeight: 600, color: "#1e293b", transition: "border-color 0.2s" };
const rowSt   = { display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid #f1f5f9", fontSize: 14, color: "#475569" };

const primaryBtnSt = {
   width: "100%", padding: "18px", borderRadius: 20, background: P, color: "#fff", 
   border: "none", fontWeight: 800, fontSize: 16, cursor: "pointer", 
   display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
   boxShadow: `0 10px 25px ${P}44`, transition: "all 0.3s ease"
};
