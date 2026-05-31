import {
  Wifi, Waves, Car, Dumbbell, Sparkles, Utensils, Dog,
  Flame, Wine, Coffee, Bell, Clock, Briefcase, ArrowUpDown,
  Umbrella, Leaf, Layers, Users, Baby, Zap, Bus, Thermometer,
  Droplets, Hand, UtensilsCrossed,
  Wind, Tv, Bath, Layout, Box, Moon, Laptop, Shirt, VolumeX,
  ShowerHead, Mountain, WashingMachine, Armchair,
} from "lucide-react";

// ── Hotel Amenity Categories ──────────────────────────────────────────────────
export const HOTEL_AMENITY_CATEGORIES = [
  {
    label: "Kết nối & Di chuyển",
    items: [
      { key: "WIFI",            label: "WiFi miễn phí",    Icon: Wifi },
      { key: "PARKING",         label: "Bãi đỗ xe",        Icon: Car },
      { key: "EV_CHARGING",     label: "Sạc xe điện",      Icon: Zap },
      { key: "AIRPORT_SHUTTLE", label: "Đưa đón sân bay",  Icon: Bus },
    ],
  },
  {
    label: "Ăn uống",
    items: [
      { key: "RESTAURANT",         label: "Nhà hàng",         Icon: Utensils },
      { key: "BAR",                label: "Quầy bar",         Icon: Wine },
      { key: "CAFE",               label: "Cafe",             Icon: Coffee },
      { key: "BREAKFAST_INCLUDED", label: "Bữa sáng",         Icon: UtensilsCrossed },
      { key: "ROOM_SERVICE",       label: "Dịch vụ phòng",    Icon: Bell },
      { key: "BBQ_AREA",           label: "Khu BBQ",          Icon: Flame },
    ],
  },
  {
    label: "Thể thao & Vui chơi",
    items: [
      { key: "POOL",       label: "Hồ bơi",        Icon: Waves },
      { key: "GYM",        label: "Phòng gym",      Icon: Dumbbell },
      { key: "KIDS_POOL",  label: "Hồ bơi trẻ em", Icon: Baby },
      { key: "GAME_ROOM",  label: "Phòng game",     Icon: Sparkles },
    ],
  },
  {
    label: "Sức khỏe & Thư giãn",
    items: [
      { key: "SPA",     label: "Spa",          Icon: Sparkles },
      { key: "SAUNA",   label: "Phòng xông hơi", Icon: Thermometer },
      { key: "HOT_TUB", label: "Bể sục",       Icon: Droplets },
      { key: "MASSAGE", label: "Massage",       Icon: Hand },
    ],
  },
  {
    label: "Dịch vụ",
    items: [
      { key: "RECEPTION_24H",  label: "Lễ tân 24/7",      Icon: Clock },
      { key: "CONCIERGE",      label: "Concierge",         Icon: Bell },
      { key: "LAUNDRY",        label: "Giặt là",           Icon: WashingMachine },
      { key: "LUGGAGE_STORAGE", label: "Gửi hành lý",     Icon: Briefcase },
      { key: "ELEVATOR",       label: "Thang máy",         Icon: ArrowUpDown },
    ],
  },
  {
    label: "Không gian & Đặc biệt",
    items: [
      { key: "BEACH_ACCESS", label: "Ra biển trực tiếp", Icon: Umbrella },
      { key: "GARDEN",       label: "Sân vườn",           Icon: Leaf },
      { key: "ROOFTOP",      label: "Sân thượng",         Icon: Layers },
      { key: "MEETING_ROOM", label: "Phòng họp",          Icon: Users },
      { key: "KIDS_CLUB",    label: "Khu trẻ em",         Icon: Baby },
      { key: "PET_ALLOWED",  label: "Thú cưng",           Icon: Dog },
    ],
  },
];

// Flat list for backward-compat display (card chips, etc.)
export const HOTEL_AMENITIES_FLAT = HOTEL_AMENITY_CATEGORIES.flatMap(c => c.items);
export const HOTEL_AMENITY_KEYS = new Set(HOTEL_AMENITIES_FLAT.map(a => a.key));

// ── Room Amenity Categories ───────────────────────────────────────────────────
export const ROOM_AMENITY_CATEGORIES = [
  {
    label: "Tiện nghi cơ bản",
    items: [
      { key: "AIR_CONDITIONER", label: "Điều hòa",       Icon: Wind },
      { key: "HEATING",         label: "Sưởi ấm",         Icon: Thermometer },
      { key: "TV",              label: "TV",               Icon: Tv },
      { key: "CABLE_TV",        label: "TV cáp",           Icon: Tv },
      { key: "WIFI",            label: "WiFi",             Icon: Wifi },
    ],
  },
  {
    label: "Phòng tắm",
    items: [
      { key: "PRIVATE_BATHROOM", label: "Phòng tắm riêng", Icon: Bath },
      { key: "SHARED_BATHROOM",  label: "Phòng tắm chung", Icon: Bath },
      { key: "BATHTUB",          label: "Bồn tắm",          Icon: Bath },
      { key: "SHOWER",           label: "Vòi hoa sen",      Icon: ShowerHead },
      { key: "HAIR_DRYER",       label: "Máy sấy tóc",      Icon: Wind },
      { key: "HOT_WATER",        label: "Nước nóng",        Icon: Droplets },
      { key: "TOILETRIES",       label: "Đồ dùng vệ sinh",  Icon: Sparkles },
    ],
  },
  {
    label: "Nội thất",
    items: [
      { key: "WARDROBE",         label: "Tủ quần áo",      Icon: Box },
      { key: "SAFE_BOX",         label: "Két an toàn",     Icon: Box },
      { key: "BLACKOUT_CURTAINS",label: "Rèm chắn sáng",   Icon: Moon },
      { key: "SOFA",             label: "Ghế sofa",         Icon: Armchair },
      { key: "DESK",             label: "Bàn làm việc",    Icon: Layout },
      { key: "LAPTOP_WORKSPACE", label: "Góc làm việc",    Icon: Laptop },
      { key: "USB_CHARGING_PORT",label: "Cổng sạc USB",    Icon: Zap },
    ],
  },
  {
    label: "Bếp & Ăn uống",
    items: [
      { key: "MINI_BAR",   label: "Mini bar",         Icon: Coffee },
      { key: "REFRIGERATOR",label: "Tủ lạnh",         Icon: Box },
      { key: "KETTLE",     label: "Ấm đun nước",      Icon: Coffee },
      { key: "COFFEE_MAKER",label: "Máy pha cà phê",  Icon: Coffee },
      { key: "MICROWAVE",  label: "Lò vi sóng",        Icon: Zap },
      { key: "KITCHEN",    label: "Bếp nấu ăn",        Icon: UtensilsCrossed },
      { key: "DINING_AREA",label: "Khu vực ăn uống",  Icon: Utensils },
      { key: "FREE_WATER", label: "Nước uống miễn phí",Icon: Droplets },
      { key: "BREAKFAST",  label: "Bữa sáng",          Icon: Coffee },
    ],
  },
  {
    label: "View & Không gian",
    items: [
      { key: "BALCONY",       label: "Ban công",       Icon: Layout },
      { key: "TERRACE",       label: "Sân hiên",       Icon: Umbrella },
      { key: "WINDOW",        label: "Cửa sổ",          Icon: Layout },
      { key: "SEA_VIEW",      label: "Hướng biển",     Icon: Waves },
      { key: "MOUNTAIN_VIEW", label: "Hướng núi",      Icon: Mountain },
      { key: "POOL_VIEW",     label: "Hướng hồ bơi",   Icon: Waves },
    ],
  },
  {
    label: "Tiện ích khác",
    items: [
      { key: "WASHING_MACHINE", label: "Máy giặt",      Icon: WashingMachine },
      { key: "IRON",            label: "Bàn ủi",         Icon: Shirt },
      { key: "CRIB",            label: "Cũi trẻ em",    Icon: Baby },
      { key: "SOUNDPROOFING",   label: "Cách âm",        Icon: VolumeX },
    ],
  },
];

export const ROOM_AMENITIES_FLAT = ROOM_AMENITY_CATEGORIES.flatMap(c => c.items);
export const ROOM_AMENITY_KEYS = new Set(ROOM_AMENITIES_FLAT.map(a => a.key));
