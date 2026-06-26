package com.hotel.hotel_backend.controller;

import com.hotel.hotel_backend.dto.request.StartPartnerRequest;
import com.hotel.hotel_backend.dto.response.ApiResponse;
import com.hotel.hotel_backend.dto.response.MyPartnerApplicationResponse;
import com.hotel.hotel_backend.dto.response.PartnerApplicationResponse;
import com.hotel.hotel_backend.entity.PartnerApplication;
import com.hotel.hotel_backend.entity.User;
import com.hotel.hotel_backend.exception.ApiException;
import com.hotel.hotel_backend.exception.ErrorCode;
import com.hotel.hotel_backend.service.PartnerOnboardingService;
import com.hotel.hotel_backend.service.SecurityService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import io.swagger.v3.oas.annotations.tags.Tag;

@Tag(name = "Partner Onboarding", description = "Submit and track partner registration applications")
@RestController
@RequestMapping({"/api/v1/partner-onboarding", "/api/partner-onboarding"})
@RequiredArgsConstructor
public class PartnerOnboardingController {

    private final PartnerOnboardingService partnerOnboardingService;
    private final SecurityService securityService;


    /**
     */
    @PostMapping("/start")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ApiResponse<PartnerApplicationResponse> startPartnerOnboarding(
            @Valid @RequestBody StartPartnerRequest request
    ) {
        User currentUser = securityService.getCurrentUser();
        PartnerApplication application = partnerOnboardingService.startPartnerApplication(
                currentUser,
                request.businessName(),
                request.email(),
                request.phone(),
                request.taxCode(),
                request.propertyType()
        );
        return ApiResponse.ok(new PartnerApplicationResponse(
                application.getId(),
                application.getStatus().name(),
                application.getBusinessName()
        ));
    }

    /**
     */
    @PostMapping("/{applicationId}/submit")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ApiResponse<PartnerApplicationResponse> submitPartnerApplication(
            @PathVariable Long applicationId
    ) {
        User currentUser = securityService.getCurrentUser();
        PartnerApplication application = partnerOnboardingService.submitPartnerApplication(currentUser, applicationId);
        return ApiResponse.ok(new PartnerApplicationResponse(
                application.getId(),
                application.getStatus().name(),
                application.getBusinessName()
        ));
    }

    /**
     * Đơn đăng ký partner mới nhất của tài khoản đang đăng nhập, kèm status thật.
     * Trả 404 nếu tài khoản chưa từng nộp đơn (frontend coi 404 = chưa có đơn → hiện form).
     */
    @GetMapping("/my")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<MyPartnerApplicationResponse> getMyApplication() {
        User currentUser = securityService.getCurrentUser();
        PartnerApplication application = partnerOnboardingService.findLatestApplication(currentUser)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "No partner application"));
        return ApiResponse.ok(new MyPartnerApplicationResponse(
                application.getId(),
                application.getStatus().name(),
                application.getBusinessName(),
                application.getRejectReason()
        ));
    }
}

