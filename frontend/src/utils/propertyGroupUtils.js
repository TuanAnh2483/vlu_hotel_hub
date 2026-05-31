export const PROPERTY_GROUPS = {
  HOTEL:       "hotel",
  RESORT:      "hotel",
  HOSTEL:      "hotel",
  VILLA:       "villa",
  APARTMENT:   "villa",
  HOMESTAY:    "homestay",
  GUEST_HOUSE: "homestay",
};

/**
 * Derive bookingMode mặc định từ hotelType.
 * VILLA, APARTMENT → "ENTIRE"; tất cả còn lại → "BY_ROOM".
 * Homestay có thể linh hoạt (partner chọn), default là BY_ROOM.
 */
export function getDefaultBookingMode(hotelType) {
  if (hotelType === "VILLA" || hotelType === "APARTMENT") return "ENTIRE";
  return "BY_ROOM";
}

export function getPropertyGroup(hotelType) {
  return PROPERTY_GROUPS[hotelType] || "hotel";
}

export const GROUP_COLORS = {
  hotel:    "#3b82f6",
  villa:    "#8b5cf6",
  homestay: "#f59e0b",
};

export const TYPE_LABELS = {
  vi: {
    HOTEL:       "Khách sạn",
    RESORT:      "Resort",
    HOSTEL:      "Hostel",
    VILLA:       "Villa",
    APARTMENT:   "Căn hộ",
    HOMESTAY:    "Homestay",
    GUEST_HOUSE: "Nhà nghỉ",
  },
  en: {
    HOTEL:       "Hotel",
    RESORT:      "Resort",
    HOSTEL:      "Hostel",
    VILLA:       "Villa",
    APARTMENT:   "Apartment",
    HOMESTAY:    "Homestay",
    GUEST_HOUSE: "Guest House",
  },
};

export function getTypeLabel(hotelType, lang = "vi") {
  return TYPE_LABELS[lang]?.[hotelType] || hotelType || "";
}

export function getGroupColor(hotelType) {
  return GROUP_COLORS[getPropertyGroup(hotelType)] || "#64748b";
}