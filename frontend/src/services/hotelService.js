import apiClient from "./apiClient";

const AMENITY_MAP = {
  WIFI:        { icon: "📶", label: "WiFi miễn phí" },
  POOL:        { icon: "🏊", label: "Hồ bơi" },
  PARKING:     { icon: "🅿️", label: "Đỗ xe miễn phí" },
  GYM:         { icon: "💪", label: "Phòng Gym" },
  SPA:         { icon: "💆", label: "Spa & Thư giãn" },
  RESTAURANT:  { icon: "🍽️", label: "Ẩm thực" },
  PET_ALLOWED: { icon: "🐾", label: "Cho phép thú cưng" },
};

const HOTEL_TYPE_MAP = {
  HOTEL:       "Khách sạn",
  APARTMENT:   "Căn hộ",
  RESORT:      "Resort",
  VILLA:       "Biệt thự",
  HOMESTAY:    "Homestay",
  HOSTEL:      "Hostel",
  GUEST_HOUSE: "Nhà nghỉ",
};

function isoDate(dt) {
  return dt.toISOString().split("T")[0];
}

function defaultCheckIn() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return isoDate(d);
}

function defaultCheckOut() {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  return isoDate(d);
}

function nightsBetween(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 1;
  const diff = (new Date(checkOut) - new Date(checkIn)) / 86400000;
  return diff > 0 ? diff : 1;
}

function buildQuery(params) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v)) v.forEach((item) => q.append(k, item));
    else q.append(k, String(v));
  }
  return q.toString();
}

function normalizeImageList(imageUrls, coverImageUrl) {
  const list = Array.isArray(imageUrls) ? imageUrls.filter(Boolean) : [];
  if (coverImageUrl && !list.includes(coverImageUrl)) {
    return [coverImageUrl, ...list];
  }
  return list;
}

function normalizeHotel(h) {
  const images = normalizeImageList(h.imageUrls, h.coverImageUrl);
  return {
    id:                 h.hotelId,
    name:               h.name,
    address:            h.address || [h.district, h.province].filter(Boolean).join(", "),
    rating:             Number(h.ratingAvg) || 0,
    ratingCount:        h.ratingCount || 0,
    price:              h.minPrice || 0,
    availableRoomTypes: Number(h.availableRoomTypes) || 0,
    availableUnits:     Number(h.availableUnits) || 0,
    imageUrl:           h.coverImageUrl || images[0] || "",
    imageUrls:          images,
    amenities:          [],
    hotelType:          HOTEL_TYPE_MAP[h.hotelType] || h.hotelType || "Khách sạn",
  };
}

function normalizeRoom(r, nights) {
  const pricePerNight = nights > 0 ? Math.round(r.stayPrice / nights) : r.stayPrice;
  const images = normalizeImageList(r.imageUrls, r.coverImageUrl);
  const availableUnits = Number(r.availableUnits) || 0;
  return {
    id:             r.roomId,
    name:           r.name,
    price:          pricePerNight,
    stayPrice:      r.stayPrice,
    beds:           `${r.capacity} khách tối đa`,
    size:           "",
    tags:           [],
    availableUnits,
    available:      availableUnits > 0,
    capacity:       r.capacity,
    imageUrl:       r.coverImageUrl || images[0] || "",
    imageUrls:      images,
    description:    r.description || "",
    roomCategory:   r.roomCategory || null,
    bedType:        r.bedType || null,
    amenities:      Array.isArray(r.amenities) ? r.amenities : Array.from(r.amenities || []),
    customAmenities: Array.isArray(r.customAmenities) ? r.customAmenities : Array.from(r.customAmenities || []),
  };
}

const EMPTY_PAGE = { hotels: [], totalItems: 0, totalPages: 0, page: 1 };

function normalizeLocationOption(item) {
  return {
    province: (item.province || "").trim(),
    districts: Array.isArray(item.districts)
      ? item.districts.map((d) => (d || "").trim()).filter(Boolean)
      : [],
  };
}

export const hotelService = {
  async getLocations() {
    try {
      const data = await apiClient.get("/api/hotels/locations");
      return Array.isArray(data) ? data.map(normalizeLocationOption).filter((item) => item.province) : [];
    } catch {
      return [];
    }
  },

  async searchHotels(params = {}) {
    const query = buildQuery({
      province:       params.province  || "",
      district:       params.district  || "",
      checkIn:        params.checkIn   || defaultCheckIn(),
      checkOut:       params.checkOut  || defaultCheckOut(),
      adults:         params.guests    || params.adults || 2,
      rooms:          params.rooms     || 1,
      page:           params.page      || 1,
      size:           params.size      || 10,
      sort:           params.sort      || "price_asc",
      hotelTypes:     params.hotelTypes || params.hotelType || "",
      roomCategories: params.roomCategories || "",
      bedTypes:       params.bedTypes  || "",
      hotelAmenities: params.hotelAmenities || "",
      roomAmenities:  params.roomAmenities  || "",
    });
    try {
      const data = await apiClient.get(`/api/hotels/search?${query}`);
      const items = data.items || [];
      return {
        hotels:     items.map(normalizeHotel),
        totalItems: data.totalItems ?? items.length,
        totalPages: data.totalPages ?? 1,
        page:       data.page       ?? 1,
      };
    } catch {
      return EMPTY_PAGE;
    }
  },

  async getHotelDetail(id) {
    if (!id) return null;
    try {
      const data = await apiClient.get(`/api/hotels/${id}`);
      if (!data || !data.hotelId) return null;
      const images = normalizeImageList(data.imageUrls, data.coverImageUrl);
      const rawAmenities = Array.isArray(data.amenities) ? data.amenities : [];
      const amenities = rawAmenities.map((a) => AMENITY_MAP[a]).filter(Boolean);
      return {
        id:          data.hotelId,
        name:        data.name,
        address:     data.address || [data.district, data.province].filter(Boolean).join(", "),
        province:    data.province  || "",
        district:    data.district  || "",
        description: data.description || "",
        rating:      Number(data.ratingAvg) || 0,
        ratingCount: data.ratingCount || 0,
        hotelType:   HOTEL_TYPE_MAP[data.hotelType] || data.hotelType || "Khách sạn",
        starLevel:   data.starLevel || 3,
        amenities,
        imageUrl:    data.coverImageUrl || images[0] || "",
        imageUrls:   images,
        bookingMode: data.bookingMode || "BY_ROOM",
        cancellationPolicy: data.cancellationPolicy || "MODERATE",
      };
    } catch {
      return null;
    }
  },

  async getAvailableRooms(hotelId, { checkIn, checkOut, adults = 1, rooms = 1 } = {}) {
    if (!hotelId || !checkIn || !checkOut) return [];
    const nights = nightsBetween(checkIn, checkOut);
    const query  = buildQuery({ checkIn, checkOut, adults, rooms });
    try {
      const data = await apiClient.get(`/api/hotels/${hotelId}/available-rooms?${query}`);
      const list = Array.isArray(data) ? data : [];
      return list.map((r) => normalizeRoom(r, nights));
    } catch {
      return [];
    }
  },
};
