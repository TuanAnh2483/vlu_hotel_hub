# Payment Feature Spec V1

## Mục tiêu

Payment v1 là placeholder để chốt contract và state transition cho booking, chưa tích hợp cổng thanh toán thật.

Mục tiêu của v1:

- cho phép frontend gọi action thanh toán trên booking đã được tạo
- chuyển booking từ `PENDING_PAYMENT` sang `CONFIRMED` khi thanh toán thành công
- giữ booking ở `PENDING_PAYMENT` khi thanh toán thất bại để cho phép retry
- trả `expiresAt` để frontend biết thời hạn thanh toán của booking

## Scope

### In scope

- `POST /api/bookings/{bookingId}/pay`
- `GET /api/bookings/{bookingId}/payments`
- `GET /api/bookings/{bookingId}`
- request DTO đơn giản để mô phỏng success/fail
- trả `BookingResponse`
- chỉ cho owner của booking được thanh toán
- chỉ booking `PENDING_PAYMENT` mới được phép pay
- `PENDING_PAYMENT` có TTL 15 phút
- booking quá hạn sẽ bị chuyển `CANCELLED` và release inventory khi user chạm vào flow pay/list/cancel
- có background job quét booking hết hạn mỗi 60 giây
- lưu `payment transaction` cho từng lần gọi pay

### Out of scope

- payment gateway thật
- webhook
- refund flow thật
- auto-expiration scheduler

## Contract

### Endpoint

`POST /api/bookings/{bookingId}/pay`

### Auth

- role: `CUSTOMER`
- booking phải thuộc `userId` hiện tại

### Request

```json
{
  "simulateSuccess": true,
  "clientRequestId": "2f1f8733-4cb7-4c7e-b9a7-d5727168e9ae"
}
```

### Response success

- `200 OK`
- `ApiResponse<BookingResponse>`
- booking status = `CONFIRMED`
- `expiresAt = null`

### Response fail

- `409 CONFLICT`
- `error.code = CONFLICT`
- pay fail thông thường: booking vẫn giữ `PENDING_PAYMENT`
- expired path: booking chuyển `CANCELLED`

## Payment History API

### Endpoint

`GET /api/bookings/{bookingId}/payments`

### Auth

- role: `CUSTOMER`
- booking phải thuộc `userId` hiện tại

### Response success

- `200 OK`
- `ApiResponse<List<BookingPaymentTransactionResponse>>`
- sắp xếp theo `createdAt ASC`

### Response item

```json
{
  "paymentTransactionId": 1,
  "method": "SIMULATED",
  "status": "FAILED",
  "amount": 1700000.0,
  "providerReference": "SIM-0dd5f258-92a7-40e5-81f7-8a4f97d0c3a6",
  "failureReason": "Payment failed",
  "clientRequestId": "timeline-fail-1",
  "createdAt": "2026-04-19T14:20:00"
}
```

## Business Rules

1. Chỉ booking `PENDING_PAYMENT` mới được pay.
2. Nếu `simulateSuccess = true`:
   - update status thành `CONFIRMED`
   - không đụng inventory vì inventory đã reserve từ confirm flow
3. Nếu `simulateSuccess = false`:
   - không đổi status
   - trả lỗi `CONFLICT`
   - user có thể retry payment sau đó
4. Nếu booking đã quá `expiresAt`:
   - booking bị chuyển `CANCELLED`
   - release inventory
   - trả lỗi `CONFLICT`
5. Nếu booking đang ở:
   - `CONFIRMED`
   - `CANCELLED`
   - `COMPLETED`
   - `REFUNDED`
   thì reject với `CONFLICT`

## Payment Transaction Record V1

Mỗi lần gọi `POST /api/bookings/{bookingId}/pay`, backend sẽ lưu một `payment transaction`:

- `bookingId`
- `method = SIMULATED`
- `status = SUCCESS | FAILED`
- `amount = booking.totalPrice`
- `providerReference = SIM-<uuid>`
- `failureReason`
- `createdAt`

Rule:

- pay success -> lưu `SUCCESS`
- pay fail giả lập -> lưu `FAILED`
- pay khi booking đã hết hạn / không còn payable -> lưu `FAILED`
- booking not found thì không tạo record
- frontend có thể đọc toàn bộ timeline qua `GET /api/bookings/{bookingId}/payments`

## Idempotency V1

`POST /api/bookings/{bookingId}/pay` hiện yêu cầu `clientRequestId`.

Rule:

- key idempotent = `bookingId + clientRequestId`
- nếu request id này đã xử lý `SUCCESS` rồi:
  - trả lại `200 OK`
  - không tạo transaction mới
- nếu request id này đã xử lý `FAILED` rồi:
  - trả lại cùng lỗi `CONFLICT`
  - không tạo transaction mới
- chỉ request id mới mới được phép tạo thêm payment attempt

## Test Cases

1. Pay success:
   - booking từ `PENDING_PAYMENT` sang `CONFIRMED`
2. Pay fail:
   - response `409`
   - booking vẫn là `PENDING_PAYMENT`
3. Pay expired pending booking:
   - response `409`
   - booking chuyển `CANCELLED`
   - inventory được release
4. Pay non-pending booking:
   - response `409`
5. Payment timeline:
   - trả đủ failed + success attempts theo thứ tự tạo

## Booking Detail API

### Endpoint

`GET /api/bookings/{bookingId}`

### Auth

- role: `CUSTOMER`
- booking phải thuộc `userId` hiện tại

### Response success

- `200 OK`
- `ApiResponse<BookingResponse>`
- trước khi trả response sẽ chạy passive expiration nếu booking đã quá hạn

## Ghi chú cho phase sau

- V2 nên thêm `payment_attempt` hoặc `payment_transaction`
- expiration job hiện tại dùng scheduler nội bộ của Spring
- cấu hình mặc định:
  - quét mỗi `60000 ms`
  - property override: `app.booking.expiration.fixed-delay-ms`
- V2 có thể mở rộng `PaymentMethod` ra ngoài `SIMULATED`
- V2 có thể expose payment transactions qua API detail riêng nếu frontend cần timeline
