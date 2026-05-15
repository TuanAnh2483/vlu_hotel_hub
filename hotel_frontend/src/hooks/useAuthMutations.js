import { useMutation } from "@tanstack/react-query";
import { authService } from "../services/authService";

export function useLogin(options = {}) {
  return useMutation({
    mutationFn: (credentials) => authService.login(credentials),
    ...options,
  });
}

export function useGoogleLogin(options = {}) {
  return useMutation({
    mutationFn: (payload) => authService.googleLogin(payload),
    ...options,
  });
}

export function useRegister(options = {}) {
  return useMutation({
    mutationFn: (data) => authService.register(data),
    ...options,
  });
}

export function useForgotPassword(options = {}) {
  return useMutation({
    mutationFn: (data) => authService.forgotPassword(data),
    ...options,
  });
}

export function useResetPassword(options = {}) {
  return useMutation({
    mutationFn: (data) => authService.resetPassword(data),
    ...options,
  });
}

export function useVerifyEmail(options = {}) {
  return useMutation({
    mutationFn: (data) => authService.verifyEmail(data),
    ...options,
  });
}

export function useResendVerification(options = {}) {
  return useMutation({
    mutationFn: (data) => authService.resendVerification(data),
    ...options,
  });
}
