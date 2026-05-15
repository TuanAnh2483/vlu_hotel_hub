import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useVietnamProvinces } from "../../hooks/useVietnamAdmin";
import { stripProvincePrefix, nfc } from "../../services/vnAdminService";

function removeAccents(str) {
  return str
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

/**
 * Searchable province combobox backed by provinces.open-api.vn.
 *
 * Props:
 *   value      – currently selected province name string
 *   onChange   – called with { name, code } on selection, or { name: "", code: null } on clear
 *   hotelLocations – array of { province } from the hotel backend API (for hasHotels indicator)
 *   placeholder – input placeholder text
 */
export default function ProvinceCombobox({ value, onChange, hotelLocations = [], placeholder }) {
  const { data: adminProvinces, isLoading } = useVietnamProvinces();

  // Merge admin provinces with hotel API data
  const locations = useMemo(() => {
    if (!adminProvinces) {
      // Fallback: show provinces that have hotels while admin API loads
      return hotelLocations.map((h) => ({
        code: null,
        name: h.province,
        hasHotels: true,
      }));
    }
    const list = adminProvinces.map((p) => {
      const shortName = stripProvincePrefix(p.name); // already NFC-normalised
      const hasHotels = hotelLocations.some(
        (h) => nfc(h.province) === shortName || nfc(h.province) === nfc(p.name)
      );
      return { code: p.code, name: shortName, fullName: p.name, hasHotels };
    });
    // Append any hotel-province not matched in admin list (e.g. stored with a non-standard name)
    hotelLocations.forEach((h) => {
      const matched = list.some(
        (l) => l.name === nfc(h.province) || nfc(l.fullName) === nfc(h.province)
      );
      if (!matched) {
        list.push({ code: null, name: h.province, hasHotels: true });
      }
    });
    return list;
  }, [adminProvinces, hotelLocations]);

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(value || "");
  const [activeIdx, setActiveIdx] = useState(-1);
  const [dropPos, setDropPos] = useState({});
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const filtered = useMemo(() => {
    const q = removeAccents(search.trim().toLowerCase());
    if (!q) return locations;
    return locations.filter((loc) =>
      removeAccents(loc.name.toLowerCase()).includes(q)
    );
  }, [search, locations]);

  // Keep input text in sync with external value changes
  useEffect(() => {
    setSearch(value || "");
  }, [value]);

  // Compute fixed dropdown position aligned to the searchbar bottom
  useEffect(() => {
    if (!open) return;
    const compute = () => {
      if (!inputRef.current) return;
      const searchbarEl = inputRef.current.closest(".customer-homepage-searchbar");
      if (!searchbarEl) return;
      const sbRect = searchbarEl.getBoundingClientRect();
      const inputRect = inputRef.current.getBoundingClientRect();
      setDropPos({
        position: "fixed",
        top: sbRect.bottom + 6,
        left: Math.max(8, inputRect.left - 14),
        width: 300,
        zIndex: 9999,
      });
    };
    compute();
    window.addEventListener("scroll", compute, true);
    window.addEventListener("resize", compute);
    return () => {
      window.removeEventListener("scroll", compute, true);
      window.removeEventListener("resize", compute);
    };
  }, [open]);

  // Close on outside click, revert search text
  useEffect(() => {
    if (!open) return;
    const handleMouseDown = (e) => {
      const comboboxEl = inputRef.current?.closest(".province-combobox");
      if (
        !comboboxEl?.contains(e.target) &&
        !listRef.current?.contains(e.target)
      ) {
        setOpen(false);
        setSearch(value || "");
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [open, value]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (activeIdx >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll(".province-dropdown-item");
      items[activeIdx]?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIdx]);

  const select = (loc) => {
    onChange({ name: loc.name, code: loc.code });
    setSearch(loc.name);
    setOpen(false);
    setActiveIdx(-1);
  };

  const handleKeyDown = (e) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setOpen(true);
        setActiveIdx(0);
        e.preventDefault();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
      e.preventDefault();
    } else if (e.key === "ArrowUp") {
      setActiveIdx((i) => Math.max(i - 1, 0));
      e.preventDefault();
    } else if (e.key === "Enter") {
      if (activeIdx >= 0 && filtered[activeIdx]) {
        select(filtered[activeIdx]);
      }
      e.preventDefault();
    } else if (e.key === "Escape") {
      setOpen(false);
      setSearch(value || "");
    }
  };

  const hotCount = locations.filter((l) => l.hasHotels).length;

  return (
    <div className="province-combobox">
      <input
        ref={inputRef}
        type="text"
        className="customer-homepage-field-input province-combobox-input"
        placeholder={isLoading ? "Đang tải..." : placeholder}
        value={search}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => {
          const v = e.target.value;
          setSearch(v);
          setOpen(true);
          setActiveIdx(-1);
          if (!v) onChange({ name: "", code: null });
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
      />
      {open &&
        createPortal(
          <div className="province-dropdown" style={dropPos} ref={listRef}>
            {hotCount > 0 && (
              <div className="province-dropdown-legend">
                <span className="province-hotel-dot" />
                Có khách sạn
              </div>
            )}
            {filtered.length === 0 ? (
              <div className="province-dropdown-empty">
                Không tìm thấy tỉnh / thành phố
              </div>
            ) : (
              filtered.map((loc, i) => (
                <div
                  key={loc.code ?? loc.name}
                  className={[
                    "province-dropdown-item",
                    i === activeIdx ? "active" : "",
                    loc.hasHotels ? "has-hotels" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onMouseDown={() => select(loc)}
                  onMouseEnter={() => setActiveIdx(i)}
                >
                  {loc.hasHotels ? (
                    <span className="province-hotel-dot" />
                  ) : (
                    <span className="province-dot-placeholder" />
                  )}
                  <span>{loc.name}</span>
                </div>
              ))
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
