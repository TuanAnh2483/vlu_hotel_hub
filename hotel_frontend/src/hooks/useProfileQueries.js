import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { profileService } from "../services/profileService";

export const profileKeys = {
  profile:       () => ["profile"],
  billing:       () => ["profile", "billing"],
  notifications: () => ["profile", "notifications"],
};

export function useProfile(options = {}) {
  return useQuery({
    queryKey: profileKeys.profile(),
    queryFn:  () => profileService.getProfile(),
    staleTime: 5 * 60 * 1000,
    gcTime:    15 * 60 * 1000,
    ...options,
  });
}

export function useBilling(options = {}) {
  return useQuery({
    queryKey: profileKeys.billing(),
    queryFn:  () => profileService.getBilling(),
    staleTime: 5 * 60 * 1000,
    ...options,
  });
}

export function useNotifications(options = {}) {
  return useQuery({
    queryKey: profileKeys.notifications(),
    queryFn:  () => profileService.getNotifications(),
    staleTime: 60 * 1000,
    gcTime:    5 * 60 * 1000,
    ...options,
  });
}

export function useUpdateProfile(options = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => profileService.updateProfile(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: profileKeys.profile() }),
    ...options,
  });
}

export function useUploadAvatar(options = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file) => profileService.uploadAvatar(file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: profileKeys.profile() }),
    ...options,
  });
}

export function useMarkNotificationRead(options = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notificationId) => profileService.markNotificationRead(notificationId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: profileKeys.notifications() }),
    ...options,
  });
}

export function useUpdatePreferences(options = {}) {
  return useMutation({
    mutationFn: (data) => profileService.updatePreferences(data),
    ...options,
  });
}

export function useChangePassword(options = {}) {
  return useMutation({
    mutationFn: (data) => profileService.changePassword(data),
    ...options,
  });
}
