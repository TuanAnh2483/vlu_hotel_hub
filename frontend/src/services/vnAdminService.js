import axios from "axios";

const vn = axios.create({ baseURL: "https://provinces.open-api.vn/api" });

/**
 * Strip "Thành phố" / "Tỉnh" / "Thị xã" prefix and NFC-normalise.
 * NFC ensures consistent byte representation across data sources
 * (e.g. API returns "Hoà Bình" while DB may store "Hòa Bình").
 */
export function stripProvincePrefix(name = "") {
  return name
    .normalize("NFC")
    .replace(/^(Thành phố|Tỉnh|Thị xã)\s+/i, "")
    .trim();
}

/** NFC-normalise a string for reliable equality checks. */
export function nfc(str = "") {
  return str.normalize("NFC");
}

export const vnAdminService = {
  /** Returns all provinces. Names include division prefix (e.g. "Thành phố Hà Nội"). */
  getProvinces: () =>
    vn.get("/p/").then((r) => r.data),

  /** Returns all districts for a given province code. */
  getDistricts: (provinceCode) =>
    vn.get(`/p/${provinceCode}?depth=2`).then((r) => r.data.districts || []),
};
