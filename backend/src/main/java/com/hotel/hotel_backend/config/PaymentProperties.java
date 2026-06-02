package com.hotel.hotel_backend.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "app.payment")
public class PaymentProperties {

    /*
     * Nhóm cấu hình cho flow thanh toán miễn phí bằng VietQR/SePay.
     *
     * Các giá trị này có default trong application.yaml để chạy local,
     * nhưng khi test thật nên override bằng biến môi trường. Đặc biệt
     * webhookApiKey phải trùng chính xác với API Key đã nhập trên SePay.
     */
    private String provider = "sepay-vietqr";
    private String transferPrefix = "HHB";
    private String qrImageUrl = "";
    private Bank bank = new Bank();
    private Sepay sepay = new Sepay();

    public String normalizedQrImageUrl() {
        if (!StringUtils.hasText(qrImageUrl)) {
            return "";
        }
        return qrImageUrl.startsWith("/") ? qrImageUrl : "/" + qrImageUrl;
    }

    public String normalizedTransferPrefix() {
        if (!StringUtils.hasText(transferPrefix)) {
            return "HHB";
        }
        return transferPrefix.trim().toUpperCase().replaceAll("[^A-Z0-9]", "");
    }

    @Getter
    @Setter
    public static class Bank {
        private String accountNo = "";
        private String accountName = "";
        private String bankName = "";
        /** VietQR bank BIN code (e.g. 970422 for MB Bank). Required for QR generation. */
        private String bankBin = "";
    }

    @Getter
    @Setter
    public static class Sepay {
        private String webhookApiKey = "hhb_sepay_webhook_2026";
    }
}
