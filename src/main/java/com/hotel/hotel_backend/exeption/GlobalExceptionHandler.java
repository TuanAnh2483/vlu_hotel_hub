package com.hotel.hotel_backend.exeption;


import com.hotel.hotel_backend.dto.response.ApiError;
import com.hotel.hotel_backend.dto.response.ApiResponse;

import lombok.extern.slf4j.Slf4j;
import jakarta.persistence.OptimisticLockException;

import org.springframework.http.ResponseEntity;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.validation.BindException;
import org.springframework.validation.BindingResult;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;

import org.springframework.web.bind.annotation.RestControllerAdvice;

import org.springframework.security.core.AuthenticationException;

import java.util.List;





@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {


    @ExceptionHandler(ApiException.class)

    public ResponseEntity<ApiResponse<Void>> handleApiException(ApiException ex) {
        log.warn("ApiException: code={}, message={}", ex.getCode(), ex.getMessage(), ex);
        ErrorCode code = ex.getCode();
        String message = ex.getMessage();
        if (message == null || message.isBlank()) {
            message = code.name();
        }
        ApiError err = new ApiError(code.name(), message, List.of());
        return ResponseEntity.status(code.status).body(ApiResponse.fail(err));
    }

    public ResponseEntity<ApiResponse<Void>>badRequest(BindingResult bindingResult) {
        List<ApiError.FieldErrorItem> details = bindingResult.getFieldErrors()
                .stream()
                .map(this::toFieldError)
                .toList();
        ApiError err = new ApiError(
                ErrorCode.VALIDATION_ERROR.name(),
                "Dữ liệu không hợp lệ",
                details
        );
        return ResponseEntity.badRequest().body(ApiResponse.fail(err));
    }
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidation(MethodArgumentNotValidException exception) {
        return badRequest(exception.getBindingResult());
    }

    @ExceptionHandler({
            ObjectOptimisticLockingFailureException.class,
            OptimisticLockException.class
    })
    public ResponseEntity<ApiResponse<Void>> handleOptimisticLock(Exception ex) {
        log.warn("Optimistic lock conflict", ex);
        ApiError err = new ApiError(
                ErrorCode.CONFLICT.name(),
                "Phòng vừa được người khác đặt, vui lòng thử lại",
                List.of()
        );
        return ResponseEntity.status(ErrorCode.CONFLICT.status).body(ApiResponse.fail(err));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleOther(Exception ex) {
        log.error("Unhandled exception", ex); // <-- QUAN TRỌNG: in stacktrace ra console
        ApiError err = new ApiError(
                ErrorCode.INTERNAL_ERROR.name(),
                "Có lỗi xảy ra, vui lòng thử lại",
                List.of()
        );
        return ResponseEntity.status(ErrorCode.INTERNAL_ERROR.status).body(ApiResponse.fail(err));
    }

    private ApiError.FieldErrorItem toFieldError(FieldError fe) {
        return new ApiError.FieldErrorItem(fe.getField(), fe.getDefaultMessage());
    }

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ApiResponse<Void>> handleAuth(AuthenticationException ex) {
        ApiError err = new ApiError(
                ErrorCode.UNAUTHORIZED.name(),
                "Chưa đăng nhập hoặc token không hợp lệ",
                List.of()
        );
        return ResponseEntity.status(ErrorCode.UNAUTHORIZED.status).body(ApiResponse.fail(err));
    }


    @ExceptionHandler(org.springframework.security.access.AccessDeniedException.class)
    public ResponseEntity<ApiResponse<Void>> handleDenied(org.springframework.security.access.AccessDeniedException ex) {
        ApiError err = new ApiError(
                ErrorCode.FORBIDDEN.name(),
                "Bạn không có quyền truy cập",
                List.of()
        );
        return ResponseEntity.status(ErrorCode.FORBIDDEN.status).body(ApiResponse.fail(err));
    }

    @ExceptionHandler(BadRequestException.class)
    public ResponseEntity<ApiResponse<Void>> handleBadRequest(BadRequestException ex) {
        ApiError err = new ApiError(ErrorCode.VALIDATION_ERROR.name(), ex.getMessage(), List.of());

        return ResponseEntity.status(ErrorCode.VALIDATION_ERROR.status).body(ApiResponse.fail(err));
    }

    @ExceptionHandler(BindException.class)
    public ResponseEntity<ApiResponse<Void>> handleBind(BindException exception) {
        return badRequest(exception.getBindingResult());
    }


}
