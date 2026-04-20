# Booking Flow Plan

## Mục tiêu

Booking flow cần đi từ trạng thái "create booking trực tiếp" sang trạng thái product-ready hơn:

1. Contract API sạch và đúng với business.
2. Domain flow tách rõ `quote` và `confirm`.
3. Booking status chuẩn bị sẵn cho payment.
4. Payment placeholder có thể gắn vào mà không phải viết lại booking core.
5. Customer có đủ read endpoints để refresh booking detail và payment timeline.

## Trạng thái hiện tại

Hiện tại backend đã có:

- `POST /api/bookings`
- `GET /api/bookings/me`
- `POST /api/bookings/{bookingId}/cancel`

Và flow hiện tại đã đúng ở các điểm:

- check room bookable theo whole stay
- dùng `DailyRate`/availability logic giống search
- reserve inventory khi create booking
- release inventory khi cancel
- trả `ApiResponse<BookingResponse>`

Nhưng vẫn còn các vấn đề thiết kế:

1. `CreateBookingRequest.contact` đang là list, trong khi business chỉ dùng 1 primary contact.
2. `create booking` đang làm luôn cả quote + reserve + persist.
3. Chưa có `quote -> confirm` flow.
4. Chưa có `PENDING_PAYMENT` flow và expiration policy rõ ràng.
5. Chưa có payment placeholder để chốt state transition.
6. Chưa có booking detail endpoint riêng cho customer flow.

## Nguyên tắc triển khai

1. Sửa contract sai trước khi mở rộng domain flow.
2. Tách quote khỏi confirm trước khi nói đến payment.
3. Không reserve inventory ở bước quote.
4. Booking status phải phản ánh đúng product state, không chỉ là storage detail.

## Phase 1 - Clean Contact Contract

### Trạng thái

- Done

### Mục tiêu

Đưa request về đúng business reality:

- một booking có đúng một primary contact
- không dùng `List<BookingContactItem>` nữa

### Thay đổi cần làm

1. Đổi `CreateBookingRequest.contact` từ:
   - `List<BookingContactItem>`
   thành:
   - `BookingContactRequest`
2. Bỏ `BookingContactItem` nếu không còn dùng.
3. Sửa `BookingServiceImpl` để lấy contact trực tiếp, không còn `get(0)`.
4. Sửa integration test và các test service liên quan.
5. Verify compile + booking tests + full suite.

### Definition of Done

- request contract đơn giản hơn
- service không còn logic chọn phần tử đầu tiên của contact list
- booking integration test pass với request body mới

## Phase 2 - Quote / Confirm Split

### Trạng thái

- In progress
- Đã có `POST /api/bookings/quote`
- `POST /api/bookings` hiện đóng vai trò confirm flow tạm thời

### Mục tiêu

Tách rõ 2 bước:

- quote: kiểm tra bookability và tính giá
- confirm: reserve inventory và persist booking

### Endpoint đề xuất

1. `POST /api/bookings/quote`
   - input: stay + room selection + contact optional
   - output:
     - room items hợp lệ
     - total price
     - hotel summary ngắn
   - không reserve inventory
   - không tạo booking

2. `POST /api/bookings/confirm`
   - input: quote-compatible request
   - reserve inventory
   - create booking
   - trả booking response

### Thay đổi cần làm

1. Tạo `BookingQuoteResponse`.
2. Tách logic common ra khỏi `createBooking`.
3. `createBooking` cũ sẽ trở thành `confirm` flow.
4. Thêm test:
   - quote success
   - quote reject closed/minStay
   - confirm success
   - confirm reject nếu inventory không còn

### Definition of Done

- quote không đụng inventory
- confirm mới reserve inventory
- logic price/bookability dùng chung source với availability service

### Tiến độ hiện tại

- `BookingQuoteRequest` đã tách riêng khỏi `CreateBookingRequest`
- `BookingQuoteResponse` đã có `hotelId`, `hotelName`, `checkIn`, `checkOut`, `totalPrice`, `items`
- service đã tách common preparation logic:
  - validate room requests
  - load room reservations
  - check single hotel
  - tính stay pricing
- quote hiện không reserve inventory và không persist booking
- integration test đã cover:
  - quote success
  - quote reject room closed
  - confirm vẫn pass sau khi tách flow

## Phase 3 - Pending Payment State

### Trạng thái

- Done
- confirm flow hiện tạo booking ở `PENDING_PAYMENT`

### Mục tiêu

Chuẩn bị booking state machine cho payment.

### Hướng triển khai

1. Thêm/chuẩn hóa `BookingStatus`:
   - `PENDING_PAYMENT`
   - `CONFIRMED`
   - `CANCELLED`
   - `COMPLETED`
   - `REFUNDED`
2. Confirm booking tạo booking ở `PENDING_PAYMENT` hoặc `CONFIRMED` tùy scope được chốt.
3. Chốt policy:
   - có TTL hay chưa
   - hết hạn thì release inventory thế nào

### Lưu ý

Schema legacy trong [legacy-bootstrap-postgres.sql](/D:/hotel-backend/docs/db/legacy-bootstrap-postgres.sql) đã có `PENDING_PAYMENT`, nên phase này nên bám đúng naming đó.

### Definition of Done

- status model rõ
- code không còn giả định create booking là trạng thái cuối

### Tiến độ hiện tại

- `BookingStatus` đã chuẩn hóa thành:
  - `PENDING_PAYMENT`
  - `CONFIRMED`
  - `CANCELLED`
  - `COMPLETED`
  - `REFUNDED`
- `POST /api/bookings` hiện tạo booking ở `PENDING_PAYMENT`
- integration test đã assert state mới

## Phase 4 - Payment Placeholder

### Trạng thái

- Done for V1
- đã có `POST /api/bookings/{bookingId}/pay`

### Mục tiêu

Có contract payment giả lập để chốt state transition mà chưa cần tích hợp cổng thanh toán thật.

### Endpoint đề xuất

1. `POST /api/bookings/{bookingId}/pay`
   - giả lập thanh toán thành công/thất bại
2. `GET /api/bookings/{bookingId}`
   - để frontend refresh trạng thái booking

### Rule tối thiểu

- `PENDING_PAYMENT -> CONFIRMED` khi pay success
- `PENDING_PAYMENT -> FAILED/CANCELLED` theo policy nếu pay fail hoặc expire

### Definition of Done

- backend có state transition rõ
- test cover được success/fail path

### Tiến độ hiện tại

- `pay` chỉ hoạt động với booking `PENDING_PAYMENT`
- `simulateSuccess = true`:
  - `PENDING_PAYMENT -> CONFIRMED`
- `simulateSuccess = false`:
  - trả `CONFLICT`
  - booking giữ nguyên `PENDING_PAYMENT`
- contract chi tiết được tách riêng ở [payment-feature-spec.md](/D:/hotel-backend/docs/payment-feature-spec.md)
- booking response đã có `expiresAt`
- `PENDING_PAYMENT` hiện có TTL 15 phút
- nếu booking quá hạn và user chạm vào `pay`, `cancel` hoặc `getMyBookings`:
  - booking sẽ bị chuyển `CANCELLED`
  - inventory được release

## Phase 5 - Payment Expiration

### Trạng thái

- Done for passive expiration

### Mục tiêu

- không giữ `PENDING_PAYMENT` vô hạn
- cho frontend biết deadline thanh toán
- release inventory đúng lúc nếu booking pending đã quá hạn

### Scope hiện tại

1. thêm `expiresAt` vào booking và booking response
2. set TTL 15 phút khi confirm tạo booking
3. passive expiration:
   - expire khi user gọi `pay`
   - expire khi user gọi `cancel`
   - expire khi user gọi `getMyBookings`
4. active expiration:
   - scheduler quét booking quá hạn mỗi 60 giây
   - job tự chuyển `CANCELLED` và release inventory

### Chưa làm trong phase này

- distributed locking khi chạy nhiều app instance
- payment transaction record

### Definition of Done

- booking mới có `expiresAt`
- pay booking quá hạn bị reject
- booking quá hạn chuyển `CANCELLED`
- inventory được release khi booking pending hết hạn
- scheduler nền chạy được mà không cần user action

## Phase 6 - Payment Transaction Record

### Trạng thái

- Done for V1

### Mục tiêu

- không để action pay chỉ đổi booking status mà không có audit trail
- lưu được mỗi lần pay success/fail để chuẩn bị nối gateway thật

### Scope hiện tại

1. thêm `PaymentTransaction` entity
2. lưu record cho từng lần gọi pay:
   - `SUCCESS`
   - `FAILED`
3. method mặc định:
   - `SIMULATED`
4. lưu:
   - amount
   - provider reference giả lập
   - failure reason
   - created time

### Chưa làm trong phase này

- payment transaction API riêng
- external gateway reference thật
- retry idempotency theo provider reference

### Definition of Done

- pay success có transaction record
- pay fail có transaction record
- payment flow có audit trail tối thiểu trong DB

## Phase 7 - Payment Idempotency

### Trạng thái

- Done for V1

### Mục tiêu

- client retry `pay` không được tạo nhiều payment record cho cùng một logical request
- success/fail đều phải replay được kết quả cũ

### Scope hiện tại

1. `BookingPaymentRequest` có `clientRequestId`
2. `PaymentTransaction` lưu `clientRequestId`
3. idempotent key:
   - `bookingId + clientRequestId`
4. cùng key:
   - success -> trả lại `200 OK` cũ
   - fail -> trả lại `CONFLICT` cũ
   - không tạo transaction mới

### Definition of Done

- retry pay success không nhân đôi `SUCCESS` transaction
- retry pay fail không nhân đôi `FAILED` transaction

## Phase 8 - Payment History API

### Trạng thái

- Done for V1

### Mục tiêu

- expose payment attempts ra ngoài API để frontend/admin debug flow pay
- tận dụng transaction record đã có thay vì chỉ để dữ liệu nằm trong DB

### Scope hiện tại

1. thêm `GET /api/bookings/{bookingId}/payments`
2. chỉ owner của booking được đọc
3. response trả:
   - method
   - status
   - amount
   - provider reference
   - failure reason
   - client request id
   - created time
4. sắp xếp theo `createdAt ASC`

### Definition of Done

- frontend đọc được timeline pay attempts của từng booking
- integration test cover được failed + success attempts trên cùng booking

## Phase 9 - Booking Detail API

### Trạng thái

- Done for V1

### Mục tiêu

- cho frontend refresh một booking cụ thể mà không phải gọi toàn bộ `GET /api/bookings/me`
- reuse `BookingResponse` và vẫn giữ passive expiration behavior

### Scope hiện tại

1. thêm `GET /api/bookings/{bookingId}`
2. chỉ owner của booking được đọc
3. response:
   - `BookingResponse`
4. trước khi trả response:
   - chạy passive expiration nếu booking vẫn đang `PENDING_PAYMENT`

### Definition of Done

- customer đọc được detail của booking mình
- booking không tồn tại hoặc không thuộc user hiện tại trả `404`

## Thứ tự triển khai chốt

1. Phase 1: clean contact contract
2. Phase 2: quote / confirm split
3. Phase 3: pending payment state
4. Phase 4: payment placeholder
5. Phase 5: payment expiration
6. Phase 6: payment transaction record
7. Phase 7: payment idempotency
8. Phase 8: payment history API
9. Phase 9: booking detail API

## Ghi chú kỹ thuật

- Mọi bước sau Phase 1 phải giữ source of truth pricing ở `HotelAvailabilityService`.
- Không tạo quote logic riêng rồi lệch với search/detail.
- Nếu thêm idempotency key cho confirm sau này, làm ở Phase 2 hoặc Phase 4, không chen trước Phase 1.
