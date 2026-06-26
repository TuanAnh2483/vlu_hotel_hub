package com.hotel.hotel_backend.service;

import com.hotel.hotel_backend.entity.HotelType;
import com.hotel.hotel_backend.entity.PartnerApplication;
import com.hotel.hotel_backend.entity.PartnerApplicationStatus;
import com.hotel.hotel_backend.entity.User;
import com.hotel.hotel_backend.entity.UserType;
import com.hotel.hotel_backend.exception.ApiException;
import com.hotel.hotel_backend.exception.ErrorCode;
import com.hotel.hotel_backend.repository.PartnerApplicationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.EnumSet;

@Service
@RequiredArgsConstructor
@Transactional
public class PartnerOnboardingService {

    //Status to start
    private static final EnumSet<PartnerApplicationStatus> BLOCKING_STATUSES = EnumSet.of(
            PartnerApplicationStatus.DRAFT,
            PartnerApplicationStatus.SUBMITTED,
            PartnerApplicationStatus.UNDER_REVIEW,
            PartnerApplicationStatus.APPROVED
    );

    private final PartnerApplicationRepository partnerApplicationRepository;

    /**
     */
    public PartnerApplication startPartnerApplication(
            User currentUser,
            String businessName,
            String email,
            String phone,
            String taxCode,
            HotelType propertyType
    ) {
        assertVerifiedCustomer(currentUser);

        if (partnerApplicationRepository.existsByUserIdAndStatusIn(currentUser.getId(), BLOCKING_STATUSES)) {
            throw new ApiException(
                    ErrorCode.PARTNER_APPLICATION_EXISTS,
                    "You already have an active partner application"
            );
        }

        boolean taxCodeInUse = partnerApplicationRepository.findByTaxCode(taxCode).stream()
                .anyMatch(a -> BLOCKING_STATUSES.contains(a.getStatus()));
        if (taxCodeInUse) {
            throw new ApiException(ErrorCode.CONFLICT, "Tax code already exist");
        }

        PartnerApplication partnerApplication = new PartnerApplication();
        partnerApplication.setUser(currentUser);
        partnerApplication.setEmail(email);
        partnerApplication.setBusinessName(businessName);
        partnerApplication.setPhoneNumber(phone);
        partnerApplication.setStatus(PartnerApplicationStatus.DRAFT);
        partnerApplication.setTaxCode(taxCode);
        partnerApplication.setPropertyType(propertyType);

        return partnerApplicationRepository.save(partnerApplication);
    }


    /**
     */
    public PartnerApplication submitPartnerApplication(User currentUser, Long applicationId) {
        assertVerifiedCustomer(currentUser);

        PartnerApplication partnerApplication = partnerApplicationRepository.findByIdAndUserId(applicationId, currentUser.getId())
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Partner application not found"));

        if (partnerApplication.getStatus() != PartnerApplicationStatus.DRAFT) {
            throw new ApiException(
                    ErrorCode.PARTNER_APPLICATION_INVALID_STATE,
                    "Only draft application can be submitted"
            );
        }
        partnerApplication.setStatus(PartnerApplicationStatus.SUBMITTED);
        return partnerApplicationRepository.save(partnerApplication);
    }

    /**
     * Đơn đăng ký partner mới nhất của tài khoản hiện tại (mọi trạng thái).
     * Rỗng nếu tài khoản chưa từng nộp đơn → controller trả 404 để frontend hiện form.
     */
    @Transactional(readOnly = true)
    public java.util.Optional<PartnerApplication> findLatestApplication(User currentUser) {
        return partnerApplicationRepository.findTopByUserIdOrderByIdDesc(currentUser.getId());
    }

    private void assertVerifiedCustomer(User currentUser) {
        if (currentUser.getUserType() != UserType.CUSTOMER) {
            throw new ApiException(ErrorCode.FORBIDDEN, "Only customers can start partner onboarding");
        }
        if (!currentUser.isEmailVerified()) {
            throw new ApiException(
                    ErrorCode.EMAIL_NOT_VERIFIED,
                    "Please verify your email before starting partner onboarding"
            );
        }
    }
}
