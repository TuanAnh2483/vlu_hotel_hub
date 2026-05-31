import { useState } from "react";
import { Check, Plus, X } from "lucide-react";

/**
 * AmenityPicker
 *
 * Props:
 *  - categories: [{ label, items: [{ key, label, Icon }] }]
 *  - selected: string[]          — enum keys currently checked
 *  - customAmenities: string[]   — free-text amenities
 *  - onChange: (selected, customAmenities) => void
 */
export default function AmenityPicker({ categories, selected = [], customAmenities = [], onChange }) {
  const [inputValue, setInputValue] = useState("");

  function toggle(key) {
    const next = selected.includes(key)
      ? selected.filter(k => k !== key)
      : [...selected, key];
    onChange(next, customAmenities);
  }

  function addCustom() {
    const trimmed = inputValue.trim();
    if (!trimmed || customAmenities.includes(trimmed) || trimmed.length > 100) return;
    onChange(selected, [...customAmenities, trimmed]);
    setInputValue("");
  }

  function removeCustom(val) {
    onChange(selected, customAmenities.filter(a => a !== val));
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") { e.preventDefault(); addCustom(); }
  }

  return (
    <div>
      {categories.map(cat => (
        <div key={cat.label} style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#94a3b8", letterSpacing: 0.5, marginBottom: 10, textTransform: "uppercase" }}>
            {cat.label}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {cat.items.map(({ key, label, Icon }) => {
              const active = selected.includes(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggle(key)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "7px 12px", borderRadius: 20,
                    border: active ? "1.5px solid #BE1E2E" : "1.5px solid #e2e8f0",
                    background: active ? "#fff5f5" : "#f8fafc",
                    cursor: "pointer", fontSize: 12, fontWeight: 600,
                    color: active ? "#BE1E2E" : "#475569",
                    transition: "all 0.12s",
                  }}
                >
                  {active && <Check size={11} strokeWidth={3} />}
                  <Icon size={13} />
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Custom amenities */}
      <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 16, marginTop: 4 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: "#94a3b8", letterSpacing: 0.5, marginBottom: 10, textTransform: "uppercase" }}>
          Tiện ích khác (tự nhập)
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <input
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder='Ví dụ: "Bể bơi vô cực", "Phòng xông hơi đá muối"...'
            maxLength={100}
            style={{
              flex: 1, padding: "8px 12px", border: "1.5px solid #e2e8f0",
              borderRadius: 10, fontSize: 13, outline: "none",
              background: "#f8fafc", color: "#334155",
            }}
          />
          <button
            type="button"
            onClick={addCustom}
            disabled={!inputValue.trim()}
            style={{
              padding: "8px 14px", borderRadius: 10, border: "none",
              background: inputValue.trim() ? "#BE1E2E" : "#e2e8f0",
              color: inputValue.trim() ? "#fff" : "#94a3b8",
              cursor: inputValue.trim() ? "pointer" : "not-allowed",
              display: "flex", alignItems: "center", gap: 4, fontSize: 13, fontWeight: 700,
            }}
          >
            <Plus size={14} /> Thêm
          </button>
        </div>

        {customAmenities.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {customAmenities.map(val => (
              <span
                key={val}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "5px 10px", borderRadius: 20,
                  background: "#fef3c7", border: "1.5px solid #fde68a",
                  fontSize: 12, fontWeight: 600, color: "#92400e",
                }}
              >
                {val}
                <button
                  type="button"
                  onClick={() => removeCustom(val)}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }}
                >
                  <X size={11} color="#92400e" />
                </button>
              </span>
            ))}
          </div>
        )}
        <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 8 }}>
          Admin sẽ xem xét và có thể thêm các tiện ích phổ biến vào danh sách chính thức.
        </p>
      </div>
    </div>
  );
}
