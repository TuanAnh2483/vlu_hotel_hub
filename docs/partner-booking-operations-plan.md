# Partner Booking Operations Plan

## Mục tiêu

Cho partner nhìn thấy và tra cứu booking thuộc các hotel mình sở hữu trước khi mở rộng sang action vận hành như `check-in` hoặc `check-out`.

## Scope V1

### Endpoint

1. `GET /api/partner/bookings`
2. `GET /api/partner/bookings/{bookingId}`

### Auth

- role: `PARTNER`
- partner chỉ thấy booking thuộc hotel mình sở hữu

## `GET /api/partner/bookings`

### Query params

- `hotelId`: optional
- `status`: optional
- `checkInFrom`: optional, `yyyy-MM-dd`
- `checkInTo`: optional, `yyyy-MM-dd`
- `page`: optional, default `1`
- `size`: optional, default `10`

### Response

`ApiResponse<PartnerBookingPageResponse>`

Mỗi item summary trả:

- `bookingId`
- `hotelId`
- `hotelName`
- `customerName`
- `checkIn`
- `checkOut`
- `totalPrice`
- `status`
- `createdAt`
- `expiresAt`

### Rule

- chỉ trả booking của hotel thuộc partner hiện tại
- support filter theo `hotelId`, `status`, `checkInFrom`, `checkInTo`
- sort mặc định theo `createdAt DESC`
- trước khi query list sẽ chạy expiration để dashboard không giữ booking `PENDING_PAYMENT` quá hạn

## `GET /api/partner/bookings/{bookingId}`

### Response

`ApiResponse<PartnerBookingDetailResponse>`

Trả:

- `bookingId`
- `hotelId`
- `hotelName`
- `customerId`
- `checkIn`
- `checkOut`
- `totalPrice`
- `status`
- `createdAt`
- `updatedAt`
- `expiresAt`
- `items`
- `contact`

### Rule

- nếu booking không thuộc partner hiện tại -> `404`
- trước khi trả detail sẽ chạy passive expiration trên booking đó

## Out of Scope V1

- partner payment timeline API
- partner action `check-in`
- partner action `check-out`
- pagination/sorting nâng cao

## Bước tiếp theo

Sau V1 read APIs, phase kế tiếp nên là lifecycle actions:

1. chốt lại `BookingStatus` cho `CHECKED_IN`
2. thêm `POST /api/partner/bookings/{id}/check-in`
3. thêm `POST /api/partner/bookings/{id}/check-out`
