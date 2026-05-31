# Hotel Frontend

Frontend React + Vite cho `hotel-backend`, đã chỉnh lại các màn customer chính để gọi backend thật thay vì bám mock cũ.

## Cấu trúc đang dùng

- Frontend: `C:\Users\tuana\Downloads\hotel_backend-master\hotel_backend-master\hotel_frontend`
- Backend: `D:\hotel-backend`
- Vite proxy: `/api` -> `http://localhost:8080`

## Command chạy local

### 1. Chạy backend

Mở terminal tại `D:\hotel-backend`:

```powershell
.\mvnw.cmd spring-boot:run
```

Nếu bạn dùng profile/env riêng thì set trước khi chạy. Ví dụ:

```powershell
$env:MAIL_ENABLED="false"
$env:MAIL_EXPOSE_DEBUG_TOKENS="true"
.\mvnw.cmd spring-boot:run
```

### 2. Chạy frontend

Mở terminal tại `C:\Users\tuana\Downloads\hotel_backend-master\hotel_backend-master\hotel_frontend`:

```powershell
npm install
npm run dev
```

Frontend dev mặc định chạy qua Vite và tự proxy request `/api` sang backend `localhost:8080`.

### 3. Build frontend

```powershell
npm run build
```

### 4. Xem bản build local

```powershell
npm run preview
```

## Luồng đã ráp với backend thật

- `register` chỉ gửi đúng `email`, `password`, `confirmPassword`
- `reset password` gọi `POST /api/auth/reset-password`
- `search hotels` dùng `GET /api/hotels/search`
- `hotel detail` dùng `GET /api/hotels/{id}`
- `available rooms` dùng `GET /api/hotels/{id}/available-rooms`
- `hotel reviews` dùng `GET /api/hotels/{id}/reviews`
- `my bookings` dùng `GET /api/bookings/me`
- `booking detail` dùng `GET /api/bookings/{id}`
- `cancel booking` dùng `POST /api/bookings/{id}/cancel`
- `payment` gọi `POST /api/bookings/{id}/pay` theo cơ chế simulated hiện tại của backend

## Lưu ý quan trọng khi test

- Backend hiện yêu cầu xác minh email sau đăng ký.
- Flow partner đúng là: tạo tài khoản thường -> verify email -> login -> vào `Đăng ký đối tác`.
- Payment chưa phải cổng thanh toán thật. Màn thanh toán vẫn đi vào API simulated của backend.
- Trang `Đánh giá của tôi` đã bỏ mock, nhưng backend hiện chưa có endpoint lấy danh sách review riêng của user.
- Các màn admin trong frontend cũ vẫn nhiều chỗ vượt quá scope backend hiện tại; không nên dùng chúng làm tiêu chí go-live nếu chưa ráp tiếp.

## Command kiểm tra nhanh

Kiểm tra frontend build:

```powershell
cd C:\Users\tuana\Downloads\hotel_backend-master\hotel_backend-master\hotel_frontend
npm run build
```

Kiểm tra backend compile/test:

```powershell
cd D:\hotel-backend
.\mvnw.cmd test
```

## Gợi ý smoke test tối thiểu

1. Đăng ký tài khoản mới.
2. Verify email.
3. Login.
4. Search khách sạn theo tỉnh có dữ liệu.
5. Mở chi tiết khách sạn, xem ảnh và phòng trống.
6. Tạo booking.
7. Mở chi tiết booking.
8. Thanh toán simulated.
9. Kiểm tra `My Bookings`.
