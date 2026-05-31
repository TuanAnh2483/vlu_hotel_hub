import { createContext, useContext, useState, useCallback } from "react";
import { vi, en } from "../translations";

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem("lang") || "vi");

  const toggleLang = useCallback(() => {
    setLang(prev => {
      const next = prev === "vi" ? "en" : "vi";
      localStorage.setItem("lang", next);
      return next;
    });
  }, []);

  const t = useCallback((key) => {
    const dict = lang === "en" ? en : vi;
    return dict[key] ?? vi[key] ?? key;
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  return useContext(LanguageContext);
}
