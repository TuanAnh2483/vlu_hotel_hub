import { useQuery } from "@tanstack/react-query";
import { vnAdminService } from "../services/vnAdminService";

const ONE_DAY = 24 * 60 * 60 * 1000;

/**
 * Fetches all Vietnamese provinces from provinces.open-api.vn.
 * Cached for 24 h — stays current when the government updates the API.
 */
export function useVietnamProvinces() {
  return useQuery({
    queryKey: ["vn-admin", "provinces"],
    queryFn: vnAdminService.getProvinces,
    staleTime: ONE_DAY,
    gcTime: 7 * ONE_DAY,
    retry: 2,
  });
}

/**
 * Fetches districts for a province by its admin code.
 * Only runs when `provinceCode` is non-null (opt-in / lazy).
 */
export function useVietnamDistricts(provinceCode) {
  return useQuery({
    queryKey: ["vn-admin", "districts", provinceCode],
    queryFn: () => vnAdminService.getDistricts(provinceCode),
    enabled: provinceCode != null,
    staleTime: ONE_DAY,
    gcTime: 7 * ONE_DAY,
    retry: 2,
  });
}
