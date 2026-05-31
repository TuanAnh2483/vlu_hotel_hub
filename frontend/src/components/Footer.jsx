import { useState } from "react";
import { C } from "../lib/constants";
import { LOGO_IMG } from "./auth/AuthShared";
import { useLang } from "../contexts/LanguageContext";

const H4 = { fontSize: 15, fontWeight: 800, color: "#111", marginBottom: 24, textTransform: "uppercase", letterSpacing: 1 };

function FooterLink({ text, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <p
      style={{ fontSize: 14, color: hov ? C.primary : "#555", marginBottom: 16, cursor: "pointer", lineHeight: 1.5, transition: "all 0.2s ease", transform: hov ? "translateX(4px)" : "none" }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={onClick}
    >{text}</p>
  );
}

export default function Footer({ navigate }) {
  const { t } = useLang();
  return (
    <footer style={{ background: "#fcfcfc", marginTop: "auto", borderTop: "1px solid #eaeaea", fontFamily: "'Segoe UI', 'Be Vietnam Pro', sans-serif" }}>
      {/* ── Top Section: Links ── */}
      <div style={{ maxWidth: 1300, margin: "0 auto", padding: "60px 40px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 40, boxSizing: "border-box" }}>
        <div>
          <h4 style={H4}>{t("footer_support")}</h4>
          {[t("footer_contact"), t("footer_trips"), t("footer_security")].map(text => <FooterLink key={text} text={text} />)}
        </div>
        <div>
          <h4 style={H4}>{t("footer_terms")}</h4>
          {[t("footer_seasonal"), t("footer_privacy"), t("footer_tos"), t("footer_complaints")].map(text => <FooterLink key={text} text={text} />)}
        </div>
        <div>
          <h4 style={H4}>{t("footer_policy")}</h4>
          <FooterLink text={t("footer_list_property")} onClick={() => navigate && navigate("become-partner")} />
          <FooterLink text={t("footer_partner_help")} />
          <FooterLink text={t("footer_accessibility")} />
        </div>
        <div>
          <h4 style={H4}>{t("footer_about")}</h4>
          <FooterLink text="Email: abc@gmail.com" />
          <FooterLink text="Hotline: 0000000000" />
          
          <div style={{ display: "flex", gap: 14, marginTop: 24 }}>
            {[
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>,
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path><rect x="2" y="9" width="4" height="12"></rect><circle cx="4" cy="4" r="2"></circle></svg>,
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
            ].map((icon, i) => (
              <div key={i} style={{ width: 40, height: 40, borderRadius: "50%", background: "#fff", border: "1px solid #e0e0e0", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.2s ease", color: "#666" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = C.primary; e.currentTarget.style.color = C.primary; e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(190,30,46,0.15)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "#e0e0e0"; e.currentTarget.style.color = "#666"; e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}
              >{icon}</div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ width: "calc(100% - 120px)", margin: "0 auto", height: 1, background: "linear-gradient(90deg, transparent, #ddd, transparent)" }} />

      {/* ── Bottom Section: Branding ── */}
      <div style={{ padding: "48px 20px 40px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
        <img src={LOGO_IMG} alt="VLU Hotel Hub" style={{ height: 140, objectFit: "contain", marginBottom: 32, filter: "drop-shadow(0 8px 16px rgba(0,0,0,0.06))" }} />
        
        <h3 style={{ fontSize: 22, fontWeight: 800, color: C.primary, margin: "0 0 12px", letterSpacing: 0.5, textTransform: "uppercase" }}>
          {t("footer_tagline")}
        </h3>

        <p style={{ fontSize: 13, color: "#888", margin: 0, fontWeight: 500 }}>
          {t("footer_copyright")}
        </p>
      </div>
    </footer>
  );
}
