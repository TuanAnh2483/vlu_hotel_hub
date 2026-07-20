# hotel_backend (Hotel Hub)

Đây là backend của dự án Hotel Hub — hệ thống quản lý và đặt phòng khách sạn.

**Main URL**: https://www.hotelhub.online

---

## Mục lục

- [Mô tả](#mô-tả)
- [Yêu cầu trước khi cài đặt](#yêu-cầu-trước-khi-cài-đặt)
- [Cài đặt](#cài-đặt)
- [Cấu hình môi trường](#cấu-hình-môi-trường)
- [Khởi động ứng dụng](#khởi-động-ứng-dụng)
- [Cơ sở dữ liệu và di cư (migrations)](#cơ-sở-dữ-liệu-và-di-cư-migrations)
- [API chính](#api-chính)
- [Kiểm thử](#kiểm-thử)
- [Triển khai](#triển-khai)
- [Góp phần (Contributing)](#góp-phần-contributing)
- [Liên hệ](#liên-hệ)

---

## Mô tả

Backend cung cấp API cho quản lý khách sạn, đặt phòng, người dùng, và thanh toán. Frontend (nếu có) sẽ gọi các endpoint RESTful của backend để hiển thị dữ liệu và xử lý tương tác.

## Yêu cầu trước khi cài đặt

- Node.js (phiên bản 16+ hoặc phiên bản mà dự án yêu cầu)
- npm hoặc yarn
- Một cơ sở dữ liệu (PostgreSQL / MySQL / MongoDB — tùy theo cấu hình dự án)
- Git


## Cài đặt

1. Clone repository:

   git clone https://github.com/TuanAnh2483/vlu_hotel_hub.git
   cd vlu_hotel_hub

2. Cài các package:

   npm install
   # hoặc
   yarn install

## Cấu hình môi trường

Tạo file `.env` ở thư mục gốc (hoặc sao chép từ `.env.example` nếu có) và thiết lập các biến môi trường quan trọng, ví dụ:

- PORT=3000
- NODE_ENV=development
- DATABASE_URL=postgresql://user:password@host:port/database
- JWT_SECRET=your_jwt_secret
- EMAIL_SERVICE_USER=...
- EMAIL_SERVICE_PASS=...

Lưu ý: Thay giá trị phù hợp cho môi trường của bạn.

## Khởi động ứng dụng

- Chạy ở môi trường phát triển:

  npm run dev
  # hoặc
  yarn dev

- Chạy bản build (production):

  npm run build
  npm start
  # hoặc tương đương với yarn

Ứng dụng sẽ lắng nghe trên cổng được chỉ định trong `.env` (mặc định 3000 nếu chưa thay đổi).

## Cơ sở dữ liệu và di cư (migrations)

Nếu dự án sử dụng ORM (ví dụ: TypeORM, Sequelize, Prisma):

- Thiết lập `DATABASE_URL` trong `.env`.
- Chạy lệnh migration:

  npm run migrate
  # hoặc theo script tương ứng (ví dụ: prisma migrate deploy)

Nếu cần seed dữ liệu mẫu, chạy script seed (nếu có):

  npm run seed

## API chính

Tài liệu API nên có ở một file riêng (ví dụ: docs/API.md) hoặc sử dụng OpenAPI/Swagger. Dưới đây là ví dụ các endpoint thường có:

- POST /auth/register — đăng ký người dùng
- POST /auth/login — đăng nhập
- GET /hotels — lấy danh sách khách sạn
- GET /hotels/:id — thông tin chi tiết khách sạn
- POST /bookings — tạo đặt phòng
- GET /bookings/:id — lấy thông tin đặt phòng
- PUT /bookings/:id — cập nhật đặt phòng
- DELETE /bookings/:id — hủy đặt phòng

Lưu ý: Kiểm tra file route/controller để biết đầy đủ các endpoint và yêu cầu (body params, headers, authentication).

## Kiểm thử

Nếu repo có cấu hình unit/integration tests, chạy:

  npm test
  # hoặc
  yarn test

Thêm cờ coverage nếu cần:

  npm run test:coverage

## Triển khai

Một số hướng dẫn triển khai phổ biến:

- Triển khai lên Heroku:
  - Thiết lập biến môi trường trên dashboard Heroku
  - Đẩy code lên Heroku remote hoặc cấu hình CI/CD

- Triển khai lên VPS (DigitalOcean, AWS EC2):
  - Cài Node.js, cấu hình reverse-proxy (nginx), dùng PM2 để quản lý process

- Triển khai với Docker:
  - Tạo Dockerfile và docker-compose.yml (nếu cần DB)
  - Xây image và chạy container

## Góp phần (Contributing)

Chào mừng mọi đóng góp! Vui lòng:

1. Fork repo
2. Tạo branch feature/fix: `git checkout -b feature/<tên>`
3. Commit và push
4. Tạo Pull Request mô tả thay đổi

Thêm file CONTRIBUTING.md nếu cần quy tắc chi tiết về code style, lint, và testing.

## Liên hệ

Nếu cần trợ giúp hoặc muốn báo lỗi, liên hệ:

- Email: your-email@example.com
- GitHub: https://github.com/TuanAnh2483

---

Chúc bạn phát triển dự án tốt! Nếu bạn muốn, tôi có thể: thêm hướng dẫn cấu hình cụ thể cho loại cơ sở dữ liệu bạn dùng, tạo file .env.example, hoặc tạo tài liệu API (OpenAPI/Swagger).