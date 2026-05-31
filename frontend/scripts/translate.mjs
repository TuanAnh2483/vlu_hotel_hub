/**
 * Dịch tự động phần `en` trong translations/index.js qua DeepL API.
 *
 * Cách dùng:
 *   DEEPL_KEY=<api-key> node scripts/translate.mjs           -- preview kết quả
 *   DEEPL_KEY=<api-key> node scripts/translate.mjs --write   -- ghi thẳng vào file
 */

import fs   from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const WRITE_MODE = process.argv.includes("--write");
const DEEPL_KEY  = process.env.DEEPL_KEY;

if (!DEEPL_KEY) {
  console.error("Thiếu API key.\nCách chạy: DEEPL_KEY=your-key node scripts/translate.mjs");
  process.exit(1);
}

// ── 1. Đọc object vi từ file dịch ─────────────────────────────────────
const { vi } = await import("../src/translations/index.js");

const keys  = Object.keys(vi);
const texts = Object.values(vi);

// ── 2. Bảo toàn khoảng trắng đầu/cuối (DeepL hay trim) ───────────────
// Ví dụ: " đêm", " khách", " sao trở lên"
const leadingSpaces  = texts.map(t => t.match(/^(\s*)/)[1]);
const trailingSpaces = texts.map(t => t.match(/(\s*)$/)[1]);
const trimmed        = texts.map(t => t.trim());

// ── 3. Gọi DeepL (1 request batch cho toàn bộ) ───────────────────────
console.log(`Đang gửi ${keys.length} chuỗi đến DeepL...`);

const res = await fetch("https://api-free.deepl.com/v2/translate", {
  method:  "POST",
  headers: {
    "Authorization": `DeepL-Auth-Key ${DEEPL_KEY}`,
    "Content-Type":  "application/json",
  },
  body: JSON.stringify({
    text:        trimmed,
    source_lang: "VI",
    target_lang: "EN-US",
    // Giữ nguyên ký tự định dạng đặc biệt
    tag_handling: "html",
    ignore_tags:  [],
  }),
});

if (!res.ok) {
  const err = await res.text();
  console.error("Lỗi DeepL:", err);
  process.exit(1);
}

const data = await res.json();

// ── 4. Ghép lại khoảng trắng + ghi đè thủ công ──────────────────────
// Các chuỗi DeepL dịch sai ngữ cảnh hoặc sai kỹ thuật
const MANUAL_OVERRIDES = {
  // Placeholder — không dịch
  booking_name_ph:  "John Doe",
  booking_phone_ph: "0901234567",

  // Lỗi nghiêm trọng
  detail_star:          " STARS",            // DeepL dịch "SAO" = "WHY" (tại sao)
  filter_rating_suffix: " stars or more",    // DeepL tự thêm số "2"
  detail_tax:           "Taxes & service charges (10%)",  // &amp; → &
  booking_tax:          "Taxes & fees (10%)",             // &amp; → &
  booking_confirm_btn:  "Confirm & Proceed to Payment",   // &amp; → &

  // Số ít / số nhiều
  nav_hotels:    "Hotels",
  nav_reviews:   "Reviews",
  nav_mybookings: "My Bookings",
  rating_count:  " reviews",
  card_rooms:    " rooms available",
  guests:        " guests",
  stays:         "stays",

  // Ngữ cảnh ngành khách sạn
  nav_dashboard:     "Dashboard",
  card_badge:        "Recommended",
  card_per_night:    "/night",
  detail_per_night:  "/night",
  detail_per_night_lbl: "/night",
  per_night:         "/night",
  banner_feat_2:     "Instant booking",
  booking_title:     "Complete your booking",
  detail_confirm_btn: "Confirm booking",
  detail_amenities:  "Top amenities",
  detail_refresh:    "🔄 Refresh rooms",
  detail_full:       "Fully booked",
  detail_guest:      "Guest",
  detail_partner_reply: "Response from hotel",
  filter_show_less:  "Show less ‹",
  prop_villa:        "Villas",
  contact:           "Contact",
  room_cat_deluxe:   "Deluxe",
  footer_accessibility: "Accessibility",
};

const en = {};
keys.forEach((key, i) => {
  if (key in MANUAL_OVERRIDES) {
    en[key] = MANUAL_OVERRIDES[key];
    return;
  }
  // Ghép lại khoảng trắng đầu/cuối (DeepL hay trim)
  en[key] = leadingSpaces[i] + data.translations[i].text + trailingSpaces[i];
});

// ── 5. Preview ────────────────────────────────────────────────────────
console.log("\n=== PREVIEW (toàn bộ) ===");
keys.forEach(k => {
  console.log(`  ${k.padEnd(32)} ${JSON.stringify(vi[k]).padEnd(52)}  →  ${JSON.stringify(en[k])}`);
});
console.log(`\nTổng: ${keys.length} chuỗi\n`);

if (!WRITE_MODE) {
  console.log("Kiểm tra xong? Chạy lại với --write để ghi vào file:");
  console.log(`  DEEPL_KEY=${DEEPL_KEY} node scripts/translate.mjs --write\n`);
  process.exit(0);
}

// ── 6. Ghi đè phần `en` trong translations/index.js ──────────────────
const filePath = path.join(__dirname, "../src/translations/index.js");
const content  = fs.readFileSync(filePath, "utf8");

// Tìm vị trí bắt đầu của "export const en"
const splitPoint = content.indexOf("\nexport const en = ");
if (splitPoint === -1) {
  console.error("Không tìm thấy 'export const en' trong file.");
  process.exit(1);
}

// Giữ nguyên phần vi + header, thay toàn bộ phần en
const viSection = content.substring(0, splitPoint);

// Format en object với comment ngắn gọn
const enLines = [];
let lastSection = "";
for (const [key, value] of Object.entries(en)) {
  // Tự động thêm dòng trống khi đổi nhóm key (nav_, footer_, v.v.)
  const section = key.split("_")[0];
  if (section !== lastSection && enLines.length > 0) enLines.push("");
  lastSection = section;
  enLines.push(`  ${key}: ${JSON.stringify(value)},`);
}

const updated =
  viSection +
  "\nexport const en = {\n" +
  enLines.join("\n") +
  "\n};\n";

fs.writeFileSync(filePath, updated, "utf8");
console.log("Đã cập nhật src/translations/index.js");
console.log("Hãy kiểm tra lại file và chạy lại app để xác nhận.");
