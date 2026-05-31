// ══════════════════════════════════════════════════════════════════
//  QUẢN LÝ TOÀN BỘ ẢNH CỦA ỨNG DỤNG
//  Đặt file ảnh vào thư mục này (src/assets/images/) rồi import,
//  hoặc dán link URL bên ngoài trực tiếp vào từng trường.
// ══════════════════════════════════════════════════════════════════

// ── Ảnh bìa trang chủ (Hero) ──────────────────────────────────────
export const IMG_HERO =
  "https://images.unsplash.com/photo-1615880484746-a134be9a6ecf?auto=format&fit=crop&w=1920&q=80";

// ── Ảnh điểm đến thịnh hành ───────────────────────────────────────
export const IMG_DESTINATIONS = {
  DA_NANG: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=640&q=80",
  NHA_TRANG: "https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=640&q=80",
  HUE: "https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=640&q=80",
  NINH_BINH: "https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?auto=format&fit=crop&w=640&q=80",
  CAN_THO: "https://images.unsplash.com/photo-1528181304800-259b08848526?auto=format&fit=crop&w=640&q=80",
  PHU_QUOC: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=640&q=80",
};

export const IMG_DEST_PRIMARY    = IMG_DESTINATIONS.DA_NANG;
export const IMG_DEST_SECONDARY1 = IMG_DESTINATIONS.NHA_TRANG;
export const IMG_DEST_SECONDARY2 = IMG_DESTINATIONS.HUE;

// ── Ảnh loại chỗ nghỉ ──────────────────────────────────────────────
export const IMG_PROPERTY_TYPES = {
  HOTEL: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=720&q=80",
  APARTMENT: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=720&q=80",
  RESORT: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=720&q=80",
  VILLA: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=720&q=80",
  HOMESTAY: "https://images.unsplash.com/photo-1510798831971-661eb04b3739?auto=format&fit=crop&w=720&q=80",
  HOSTEL: "https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=720&q=80",
};

// ── Ảnh khách sạn nổi bật ─────────────────────────────────────────
// Mảng ảnh theo thứ tự thẻ khách sạn (bỏ trống = placeholder)
export const IMG_HOTELS = [
  IMG_PROPERTY_TYPES.HOTEL,
  IMG_PROPERTY_TYPES.APARTMENT,
  IMG_PROPERTY_TYPES.RESORT,
  IMG_PROPERTY_TYPES.VILLA,
];
