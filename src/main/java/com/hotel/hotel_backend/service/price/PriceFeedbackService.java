package com.hotel.hotel_backend.service.price;


import com.hotel.hotel_backend.entity.PriceFeedback;
import com.hotel.hotel_backend.exeption.ApiException;
import com.hotel.hotel_backend.exeption.ErrorCode;
import com.hotel.hotel_backend.repository.PriceFeedbackRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Slf4j
public class PriceFeedbackService {
    private final PriceFeedbackRepository feedbackRepository;

    // APPLIED        : partner áp dụng đúng giá đề xuất
    // APPLIED_PLUS5  : partner thấy giá đề xuất thấp, tự tăng thêm ~5%
    // APPLIED_MINUS5 : partner thấy giá đề xuất cao, tự giảm ~5%
    // SKIPPED        : partner bỏ qua, không áp dụng
    private static final Set<String> VALID_OUTCOMES =
            Set.of("APPLIED", "APPLIED_PLUS5", "APPLIED_MINUS5", "SKIPPED");

    public void record(
            Long roomId,
            String date,
            Long suggested,
            Long appliedPrice,
            String outcome,
            long ownerId
    ) {
        if (!VALID_OUTCOMES.contains(outcome)) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR,
                    "outcome phải là APPLIED, APPLIED_PLUS5, APPLIED_MINUS5 hoặc SKIPPED");
        }

        PriceFeedback priceFeedback = new PriceFeedback();
        priceFeedback.setRoomId(roomId);
        priceFeedback.setDate(date);
        priceFeedback.setSuggestedPrice(suggested);
        priceFeedback.setAppliedPrice(appliedPrice);
        priceFeedback.setOutcome(outcome);
        priceFeedback.setPartnerId(ownerId);
        priceFeedback.setCreatedAt(LocalDateTime.now());

        feedbackRepository.save(priceFeedback);

        // log de dev theo doi

        log.info(
                "PriceFeedback saved: roomId={} date={} suggested={} applied={} outcome={} partner={}",
                roomId,
                date,
                suggested,
                appliedPrice,
                outcome,
                ownerId
        );
    }

}
