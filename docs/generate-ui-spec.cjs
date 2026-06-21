/* eslint-disable */
/**
 * Sinh file Word (.docx) "Phụ lục 2 - Đặc tả chi tiết giao diện người dùng"
 * cho dự án VLU Hotel Hub. Không phụ thuộc thư viện ngoài (chỉ dùng zlib built-in).
 *
 * Chạy:  node docs/generate-ui-spec.cjs
 */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

/* ----------------------------- DỮ LIỆU ĐẶC TẢ ----------------------------- */
/* Mỗi màn hình: { title, sections: [{ sub?, rows: [[ten, loai, chucnang, rangbuoc], ...] }] } */

const SCREENS = [
  {
    title: "Đăng ký tài khoản",
    sections: [{ rows: [
      ["Email", "Ô nhập liệu (Text Input)", "Nhập email đăng ký tài khoản.", "Bắt buộc nhập. Đúng định dạng email."],
      ["Mật khẩu", "Ô nhập mật khẩu (Password)", "Nhập mật khẩu cho tài khoản mới.", "Bắt buộc. Tối thiểu 8 ký tự, phải có ít nhất 1 chữ cái và 1 chữ số."],
      ["Nút hiện/ẩn mật khẩu", "Nút biểu tượng (Icon Button)", "Bật/tắt hiển thị nội dung mật khẩu.", "Không ràng buộc."],
      ["Xác nhận mật khẩu", "Ô nhập mật khẩu (Password)", "Nhập lại mật khẩu để xác nhận.", "Bắt buộc. Phải trùng khớp với ô Mật khẩu."],
      ["Đồng ý điều khoản", "Hộp kiểm (Checkbox)", "Xác nhận đồng ý Điều khoản dịch vụ và Chính sách bảo mật.", "Bắt buộc tick trước khi đăng ký."],
      ["Nút \"Đăng ký\"", "Nút nhấn (Button)", "Gửi thông tin đăng ký tài khoản.", "Chỉ bật khi đã tick đồng ý điều khoản; bị khóa khi đang xử lý."],
      ["Liên kết \"Đăng nhập\"", "Liên kết (Link)", "Chuyển sang màn hình đăng nhập.", "Không ràng buộc."],
    ]}],
  },
  {
    title: "Đăng nhập",
    sections: [{ rows: [
      ["Email", "Ô nhập liệu (Text Input)", "Nhập email tài khoản.", "Bắt buộc. Đúng định dạng email."],
      ["Mật khẩu", "Ô nhập mật khẩu (Password)", "Nhập mật khẩu đăng nhập.", "Bắt buộc nhập."],
      ["Nút hiện/ẩn mật khẩu", "Nút biểu tượng (Icon Button)", "Bật/tắt hiển thị mật khẩu.", "Không ràng buộc."],
      ["Ghi nhớ đăng nhập", "Hộp kiểm (Checkbox)", "Ghi nhớ phiên đăng nhập.", "Tùy chọn."],
      ["Liên kết \"Quên mật khẩu?\"", "Liên kết (Link)", "Chuyển sang màn hình quên mật khẩu.", "Không ràng buộc."],
      ["Nút \"Đăng nhập\"", "Nút nhấn (Button)", "Gửi thông tin đăng nhập.", "Bị khóa khi đang xử lý."],
      ["Đăng nhập Google", "Nút OAuth (Button)", "Đăng nhập bằng tài khoản Google.", "Do Google SDK cung cấp."],
      ["Liên kết \"Đăng ký\"", "Liên kết (Link)", "Chuyển sang màn hình đăng ký.", "Không ràng buộc."],
    ]}],
  },
  {
    title: "Quên mật khẩu",
    sections: [{ rows: [
      ["Email", "Ô nhập liệu (Text Input)", "Nhập email cần khôi phục mật khẩu.", "Bắt buộc. Đúng định dạng email."],
      ["Nút \"Gửi yêu cầu\"", "Nút nhấn (Button)", "Gửi email đặt lại mật khẩu.", "Bị khóa khi đang xử lý."],
      ["Liên kết \"Quay lại đăng nhập\"", "Liên kết (Link)", "Trở về màn hình đăng nhập.", "Không ràng buộc."],
    ]}],
  },
  {
    title: "Đặt lại mật khẩu",
    sections: [{ rows: [
      ["Mật khẩu mới", "Ô nhập mật khẩu (Password)", "Nhập mật khẩu mới.", "Bắt buộc. Tối thiểu 8 ký tự, có ít nhất 1 chữ cái và 1 chữ số."],
      ["Xác nhận mật khẩu", "Ô nhập mật khẩu (Password)", "Nhập lại mật khẩu mới.", "Bắt buộc. Phải trùng khớp với mật khẩu mới."],
      ["Nút \"Đặt lại mật khẩu\"", "Nút nhấn (Button)", "Lưu mật khẩu mới.", "Yêu cầu token hợp lệ trên URL; bị khóa khi đang xử lý."],
      ["Liên kết \"Yêu cầu liên kết mới\"", "Liên kết (Link)", "Quay lại trang quên mật khẩu khi token hết hạn.", "Chỉ hiển thị khi token không hợp lệ."],
    ]}],
  },
  {
    title: "Tìm kiếm / Danh sách khách sạn",
    sections: [{ rows: [
      ["Loại hình lưu trú", "Nhóm chọn (Radio)", "Lọc theo loại: Khách sạn, Căn hộ, Resort, Villa, Homestay, Hostel.", "Chọn một giá trị."],
      ["Hạng sao", "Nhóm chọn (Radio)", "Lọc theo số sao tối thiểu (1–5 sao).", "Chọn một giá trị."],
      ["Loại phòng", "Nhóm chọn (Radio)", "Lọc theo hạng phòng: Standard, Deluxe, Suite, Family.", "Chọn một giá trị."],
      ["Tiện ích", "Hộp kiểm nhiều lựa chọn (Checkbox)", "Lọc theo tiện ích (WiFi, Hồ bơi, Bãi đỗ, Spa...).", "Cho phép chọn nhiều."],
      ["Khoảng giá", "Thanh trượt (Range Slider)", "Đặt ngân sách tối đa.", "Từ 1.000.000₫ đến 10.000.000₫, bước 100.000₫."],
      ["Nút \"Áp dụng bộ lọc\"", "Nút nhấn (Button)", "Áp dụng các tiêu chí lọc.", "Chỉ bật khi có thay đổi bộ lọc."],
      ["Nút \"Đặt lại\"", "Nút nhấn (Button)", "Xóa toàn bộ bộ lọc.", "Chỉ hiển thị khi đang có bộ lọc."],
      ["Nút \"Định vị tôi\"", "Nút nhấn (Button)", "Lấy vị trí GPS và tìm khách sạn gần đây.", "Bị khóa khi đang lấy vị trí; cần HTTPS/localhost."],
      ["Hiện/Ẩn bản đồ", "Nút nhấn (Button)", "Bật/tắt bản đồ kết quả.", "Không ràng buộc."],
      ["Bán kính tìm kiếm", "Nhóm nút (Button Group)", "Chọn bán kính 1/2/5/10 km khi tìm theo bản đồ.", "Mặc định 2km; chỉ hiện khi bật bản đồ."],
      ["Nút \"Xem chi tiết\"", "Nút nhấn (Button)", "Mở trang chi tiết khách sạn.", "Không ràng buộc."],
      ["Phân trang", "Nhóm nút (Pagination)", "Chuyển trang kết quả.", "Hiển thị tối đa 7 nút trang."],
    ]}],
  },
  {
    title: "Đặt phòng",
    sections: [{ rows: [
      ["Họ và tên", "Ô nhập liệu (Text Input)", "Nhập tên người đặt phòng.", "Bắt buộc nhập."],
      ["Email", "Ô nhập liệu (Email)", "Email liên hệ, tự điền từ tài khoản.", "Bắt buộc. Đúng định dạng email."],
      ["Số điện thoại", "Ô nhập liệu (Text Input)", "Số điện thoại liên hệ.", "Bắt buộc nhập."],
      ["Xác nhận chính sách hủy nghiêm ngặt", "Hộp kiểm (Checkbox)", "Xác nhận hiểu điều khoản hủy STRICT.", "Chỉ hiện khi chính sách = STRICT; bắt buộc tick để đặt."],
      ["Nút \"Xác nhận đặt phòng\"", "Nút nhấn (Button)", "Gửi yêu cầu đặt phòng.", "Chỉ bật khi: đủ thông tin liên hệ, đã chọn ≥ 1 phòng, số khách ≤ sức chứa, và đã tick chính sách STRICT (nếu có)."],
    ]}],
  },
  {
    title: "Thanh toán",
    sections: [{ rows: [
      ["VietQR (Chuyển khoản)", "Nút chọn (Radio)", "Chọn thanh toán bằng VietQR.", "Được chọn mặc định."],
      ["Thẻ Quốc tế", "Nút chọn (Radio)", "Thanh toán bằng thẻ (tính năng tương lai).", "Bị vô hiệu hóa."],
      ["Ví Điện tử", "Nút chọn (Radio)", "Thanh toán bằng ví điện tử (tương lai).", "Bị vô hiệu hóa."],
      ["Mã QR thanh toán", "Hình ảnh (Display)", "Hiển thị mã QR và thông tin chuyển khoản.", "Chỉ hiện khi chọn VietQR."],
      ["Nút \"Tôi đã chuyển khoản\"", "Nút nhấn (Button)", "Xác nhận đã chuyển khoản để đối soát.", "Chỉ bật khi đơn ở trạng thái PENDING_PAYMENT; bị khóa khi đang kiểm tra."],
    ]}],
  },
  {
    title: "Yêu cầu hoàn tiền",
    sections: [{ rows: [
      ["Lý do hoàn tiền", "Danh sách thả xuống (Dropdown)", "Chọn lý do hoàn tiền (đổi kế hoạch, lỗi thanh toán, đặt nhầm, vấn đề dịch vụ, khác).", "Bắt buộc chọn một lý do."],
      ["Ghi chú chi tiết", "Vùng văn bản (Text Area)", "Mô tả cụ thể vấn đề gặp phải.", "Tùy chọn."],
      ["Nút \"Gửi yêu cầu hoàn tiền\"", "Nút nhấn (Button)", "Gửi yêu cầu hoàn tiền.", "Chỉ bật khi đã chọn lý do; bị khóa khi đang xử lý."],
    ]}],
  },
  {
    title: "Đánh giá khách sạn",
    sections: [{ rows: [
      ["Số sao đánh giá", "Danh sách thả xuống (Dropdown)", "Chọn mức đánh giá 1–5 sao.", "Mặc định 5 sao."],
      ["Nội dung đánh giá", "Vùng văn bản (Text Area)", "Viết nhận xét về khách sạn.", "Tùy chọn (có thể để trống)."],
      ["Nút \"Lưu đánh giá\"", "Nút nhấn (Button)", "Lưu đánh giá (tạo mới hoặc chỉnh sửa).", "Bị khóa khi đang lưu."],
      ["Nút \"Viết đánh giá\"", "Nút nhấn (Button)", "Mở form đánh giá cho đơn đã hoàn tất.", "Chỉ hiện với đơn trạng thái COMPLETED và chưa được đánh giá."],
      ["Nút \"Chỉnh sửa\"", "Nút nhấn (Button)", "Mở form sửa đánh giá đã có.", "Chỉ hiện khi đã có đánh giá."],
      ["Nút \"Xóa\"", "Nút nhấn (Button)", "Xóa đánh giá hiện có.", "Yêu cầu xác nhận; bị khóa khi đang xóa."],
    ]}],
  },
  {
    title: "Hồ sơ cá nhân",
    sections: [
      { sub: "Tab Cá nhân", rows: [
        ["Họ và tên", "Ô nhập liệu (Text Input)", "Tên người dùng.", "Chỉ sửa được ở chế độ chỉnh sửa."],
        ["Email liên hệ", "Ô nhập liệu (Text Input)", "Email liên hệ.", "Chỉ sửa được ở chế độ chỉnh sửa."],
        ["Số điện thoại", "Ô nhập liệu (Text Input)", "Số điện thoại.", "Chỉ sửa được ở chế độ chỉnh sửa."],
        ["Ngày sinh", "Ô chọn ngày (Date Picker)", "Ngày sinh của người dùng.", "Tùy chọn."],
        ["Địa chỉ", "Ô nhập liệu (Text Input)", "Địa chỉ cư trú.", "Chỉ sửa được ở chế độ chỉnh sửa."],
        ["Tiểu sử", "Vùng văn bản (Text Area)", "Giới thiệu bản thân.", "Tùy chọn."],
      ]},
      { sub: "Tab Bảo mật", rows: [
        ["Nút \"Đổi mật khẩu\"", "Nút nhấn (Button)", "Mở chức năng đổi mật khẩu.", "Không ràng buộc."],
        ["Cảnh báo đăng nhập lạ", "Công tắc (Switch)", "Bật/tắt email cảnh báo đăng nhập bất thường.", "Không ràng buộc."],
        ["Thông báo booking", "Công tắc (Switch)", "Bật/tắt thông báo khi booking thay đổi.", "Không ràng buộc."],
      ]},
      { sub: "Điều khiển chung", rows: [
        ["Ảnh đại diện", "Tải tệp (File Input)", "Tải lên ảnh đại diện.", "Chỉ nhận file ảnh (image/*)."],
        ["Nút \"Chỉnh sửa\"", "Nút nhấn (Button)", "Bật chế độ chỉnh sửa hồ sơ.", "Ẩn khi đang ở chế độ chỉnh sửa."],
        ["Nút \"Lưu hồ sơ\"", "Nút nhấn (Button)", "Lưu thay đổi hồ sơ.", "Bị khóa khi đang lưu."],
        ["Nút \"Hủy\"", "Nút nhấn (Button)", "Hủy chỉnh sửa, bỏ thay đổi.", "Chỉ hiện ở chế độ chỉnh sửa."],
      ]},
    ],
  },
  {
    title: "Đăng ký làm đối tác",
    sections: [
      { sub: "Bước 1 — Thông tin đăng ký", rows: [
        ["Tên doanh nghiệp", "Ô nhập liệu (Text Input)", "Tên cơ sở/doanh nghiệp.", "Bắt buộc. Từ 2 đến 100 ký tự."],
        ["Email", "Ô nhập liệu (Email)", "Email liên hệ xác minh.", "Bắt buộc. Đúng định dạng email."],
        ["Số điện thoại", "Ô nhập số (Numeric)", "Số điện thoại 10 chữ số.", "Bắt buộc. Định dạng 0XXXXXXXXX (^0\\d{9}$)."],
        ["Mã số thuế", "Ô nhập số (Numeric)", "Mã số thuế doanh nghiệp.", "Bắt buộc. Đúng 10 chữ số."],
        ["Loại hình lưu trú", "Danh sách thả xuống (Dropdown)", "Chọn loại: Hotel, Apartment, Resort, Villa, Homestay, Hostel, Guest House.", "Bắt buộc chọn."],
        ["Nút \"Tiếp tục\"", "Nút nhấn (Button)", "Kiểm tra hợp lệ và sang bước xác nhận.", "Chỉ bật khi mọi trường hợp lệ."],
      ]},
      { sub: "Bước 2 — Xác nhận & theo dõi", rows: [
        ["Bảng thông tin xác nhận", "Hiển thị (Display)", "Hiển thị lại 5 trường đã nhập để rà soát.", "Chỉ đọc."],
        ["Nút \"Nộp đơn\"", "Nút nhấn (Button)", "Gửi đơn đăng ký để xét duyệt.", "Bị khóa khi đang nộp."],
        ["Nút \"Làm mới trạng thái\"", "Nút nhấn (Button)", "Tải lại trạng thái xét duyệt đơn.", "Bị khóa khi đang làm mới."],
        ["Lý do từ chối", "Hiển thị (Display)", "Hiển thị lý do nếu đơn bị từ chối.", "Chỉ hiện khi trạng thái = REJECTED."],
      ]},
    ],
  },
  {
    title: "Thêm cơ sở lưu trú (Wizard nhiều bước)",
    sections: [
      { sub: "Bước 1 — Chọn loại hình", rows: [
        ["Lưới loại hình", "Nhóm nút (Button Group)", "Chọn loại: Hotel, Villa, Homestay, Resort, Apartment, Hostel, Guest House.", "Bắt buộc chọn đúng một loại."],
      ]},
      { sub: "Bước 2 — Thông tin cơ bản", rows: [
        ["Tên cơ sở", "Ô nhập liệu (Text Input)", "Tên khách sạn/villa/homestay.", "Bắt buộc. Từ 5 đến 100 ký tự."],
        ["Địa chỉ", "Ô nhập liệu (Text Input)", "Địa chỉ đường phố.", "Bắt buộc. Tối thiểu 5 ký tự."],
        ["Tỉnh/Thành phố", "Danh sách thả xuống (Dropdown)", "Chọn tỉnh/thành.", "Bắt buộc. Mở khóa ô Quận/Huyện."],
        ["Quận/Huyện", "Danh sách thả xuống (Dropdown)", "Chọn quận/huyện theo tỉnh.", "Bắt buộc. Khóa đến khi chọn tỉnh."],
        ["Ghim bản đồ", "Bản đồ (Map Picker)", "Chọn vị trí trên bản đồ (kinh/vĩ độ).", "Tùy chọn."],
        ["Số điện thoại", "Ô nhập liệu (Text Input)", "Số điện thoại liên hệ.", "Bắt buộc. Định dạng ^(\\+84|0)[3-9]\\d{8}$."],
        ["Email / Website", "Ô nhập liệu (Text Input)", "Email và website cơ sở.", "Tùy chọn."],
        ["Nút \"Tiếp tục\"", "Nút nhấn (Button)", "Sang bước chi tiết.", "Chỉ bật khi các trường bắt buộc hợp lệ."],
      ]},
      { sub: "Bước 3 — Chi tiết (theo loại hình)", rows: [
        ["Tổng số phòng", "Ô nhập số (Number)", "Tổng số phòng (khách sạn).", "Bắt buộc. Tối thiểu 1."],
        ["Giờ nhận/trả phòng", "Ô chọn giờ (Time)", "Giờ check-in/check-out.", "Mặc định 14:00 / 12:00."],
        ["Thẻ loại phòng (lặp lại)", "Cụm trường (Fieldset)", "Tên, số lượng, sức chứa, giá/đêm, hạng phòng, loại giường.", "Giá 10.000–100.000.000₫; tổng số phòng các loại ≤ tổng số phòng."],
        ["Số phòng ngủ / phòng tắm / diện tích / sức chứa", "Ô nhập số (Number)", "Thông số cho Villa/Homestay.", "Bắt buộc với Villa; tối thiểu 1."],
        ["Mô tả / Nội quy", "Vùng văn bản (Text Area)", "Mô tả hoặc nội quy nhà.", "Bắt buộc nội quy với Homestay."],
      ]},
      { sub: "Bước 4 — Tiện ích", rows: [
        ["Tiện ích có sẵn", "Hộp kiểm nhiều lựa chọn (Checkbox)", "Chọn tiện ích từ danh mục.", "Tùy chọn, chọn nhiều."],
        ["Tiện ích tự nhập", "Ô nhập liệu + Nút thêm", "Thêm tiện ích ngoài danh mục.", "Tối đa 100 ký tự; nút thêm khóa khi ô trống."],
      ]},
      { sub: "Bước 5 — Hình ảnh", rows: [
        ["Tải ảnh", "Tải tệp (File Input)", "Tải ảnh cơ sở (kéo-thả hoặc chọn).", "Định dạng png/jpeg/webp/gif; tối đa 10MB/ảnh; nên ≥ 3 ảnh."],
        ["Lưới ảnh", "Hiển thị (Display)", "Xem trước ảnh; ảnh đầu là ảnh đại diện.", "Có nút xóa từng ảnh."],
      ]},
      { sub: "Bước 6 — Giá & Chính sách", rows: [
        ["Giá cơ bản / đêm", "Ô nhập tiền (VND)", "Giá thuê cơ bản (Villa/Homestay).", "Bắt buộc. Từ 10.000 đến 100.000.000₫."],
        ["Phụ thu cuối tuần", "Ô nhập số (%)", "Tỷ lệ tăng giá cuối tuần.", "Tùy chọn. 0–200%."],
        ["Chính sách hủy", "Nhóm chọn (Radio)", "FLEXIBLE / MODERATE / STRICT.", "Mặc định MODERATE."],
        ["Cho phép trẻ em / thú cưng", "Hộp kiểm (Checkbox)", "Quy định khách đi cùng.", "Mặc định: trẻ em bật, thú cưng tắt."],
        ["Nút \"Hoàn tất\"", "Nút nhấn (Button)", "Tạo cơ sở trong hệ thống.", "Bị khóa khi đang lưu."],
      ]},
    ],
  },
  {
    title: "Quản lý cơ sở lưu trú (Partner)",
    sections: [
      { sub: "Danh sách cơ sở", rows: [
        ["Nút \"Thêm cơ sở\"", "Nút nhấn (Button)", "Mở Wizard thêm cơ sở mới.", "Không ràng buộc."],
        ["Ô tìm kiếm", "Ô nhập liệu (Text Input)", "Lọc cơ sở theo tên/tỉnh/quận/địa chỉ.", "Tùy chọn, không phân biệt hoa thường."],
        ["Thẻ cơ sở (lặp lại)", "Thẻ (Card)", "Hiển thị ảnh, loại hình, trạng thái, tên, đánh giá, vị trí, tiện ích.", "Chỉ đọc."],
        ["Nút \"Dashboard\" / \"Phòng\"", "Nút nhấn (Button)", "Mở dashboard hoặc quản lý phòng của cơ sở.", "Không ràng buộc."],
        ["Nút \"Sửa\" / \"Xóa\"", "Nút biểu tượng (Icon Button)", "Mở form sửa hoặc hộp thoại xác nhận xóa.", "Không ràng buộc."],
      ]},
      { sub: "Form chỉnh sửa cơ sở", rows: [
        ["Tên cơ sở", "Ô nhập liệu (Text Input)", "Tên cơ sở.", "Bắt buộc. Từ 5 đến 100 ký tự."],
        ["Tỉnh/Thành & Quận/Huyện", "Danh sách thả xuống (Dropdown)", "Vị trí hành chính.", "Bắt buộc; quận/huyện theo tỉnh."],
        ["Địa chỉ", "Ô nhập liệu (Text Input)", "Địa chỉ đường phố.", "Bắt buộc. Tối thiểu 5 ký tự."],
        ["Chính sách hủy", "Nhóm chọn (Radio)", "FLEXIBLE / MODERATE / STRICT.", "Mặc định MODERATE."],
        ["Quản lý ảnh", "Tải tệp + Lưới ảnh", "Tải ảnh, đặt ảnh bìa, xóa ảnh.", "Click ảnh để đặt làm ảnh bìa."],
        ["Nút \"Lưu\"", "Nút nhấn (Button)", "Lưu thay đổi cơ sở.", "Bị khóa khi thiếu tên hoặc đang lưu."],
      ]},
      { sub: "Hộp thoại xóa", rows: [
        ["Nút \"Xác nhận xóa\"", "Nút nhấn (Button)", "Xóa vĩnh viễn cơ sở và dữ liệu liên quan.", "Bị khóa khi đang xử lý."],
      ]},
    ],
  },
  {
    title: "Quản lý phòng (Partner)",
    sections: [
      { sub: "Danh sách loại phòng", rows: [
        ["Nút \"Thêm phòng\"", "Nút nhấn (Button)", "Mở form thêm loại phòng.", "Chỉ hiện khi đã chọn cơ sở."],
        ["Chọn cơ sở", "Nhóm chip (Chip Buttons)", "Chọn cơ sở để xem phòng.", "Không ràng buộc."],
        ["Ô tìm kiếm", "Ô nhập liệu (Text Input)", "Lọc phòng theo tên.", "Tùy chọn."],
        ["Lọc theo hạng phòng", "Danh sách thả xuống (Dropdown)", "Lọc Standard/Deluxe/Suite/Family.", "Tùy chọn."],
        ["Thẻ loại phòng (lặp lại)", "Thẻ (Card)", "Ảnh, hạng, giá, sức chứa, số lượng, tình trạng phòng vật lý.", "Chỉ đọc."],
        ["Menu thao tác", "Nút menu (•••)", "Nhân bản / Tạm ngừng / Xóa loại phòng.", "Không ràng buộc."],
      ]},
      { sub: "Form thêm/sửa loại phòng", rows: [
        ["Tên loại phòng", "Ô nhập liệu (Text Input)", "Tên loại phòng.", "Bắt buộc. Từ 2 đến 100 ký tự."],
        ["Hạng phòng / Loại giường", "Danh sách thả xuống (Dropdown)", "Chọn hạng phòng và loại giường.", "Tùy chọn."],
        ["Sức chứa", "Ô nhập số (Number)", "Số khách tối đa mỗi phòng.", "Tối thiểu 1."],
        ["Số lượng phòng", "Ô nhập số (Number)", "Số phòng vật lý của loại này.", "Từ 1 đến 500 (bằng 1 nếu cho thuê nguyên căn)."],
        ["Giá / đêm", "Ô nhập số (Number)", "Giá mỗi đêm (₫).", "Tối thiểu 0; nếu > 0 thì ≥ 10.000; tối đa 100.000.000."],
        ["Gợi ý giá AI", "Thẻ (Card)", "Đề xuất giá từ Gemini/thống kê + nút áp dụng.", "Chỉ hiện khi có dữ liệu gợi ý."],
        ["Nút \"Lưu\"", "Nút nhấn (Button)", "Tạo/cập nhật loại phòng.", "Bị khóa khi thiếu tên hoặc đang lưu."],
      ]},
      { sub: "Bảng phòng vật lý", rows: [
        ["Số phòng", "Ô nhập liệu (Text Input)", "Số/định danh phòng (vd 101, 2A).", "Tối đa 20 ký tự; tự lưu khi đổi."],
        ["Trạng thái phòng", "Danh sách thả xuống (Dropdown)", "AVAILABLE/RESERVED/OCCUPIED/CLEANING/MAINTENANCE.", "Bắt buộc; tự lưu khi đổi."],
        ["Ghi chú", "Vùng văn bản (Text Area)", "Ghi chú nội bộ.", "Tối đa 500 ký tự."],
      ]},
    ],
  },
  {
    title: "Lịch & Giá (Partner)",
    sections: [
      { sub: "Tab Lịch", rows: [
        ["Chọn cơ sở", "Danh sách thả xuống (Dropdown)", "Chọn cơ sở.", "Bắt buộc để mở phần còn lại."],
        ["Chọn phòng", "Danh sách thả xuống (Dropdown)", "Chọn loại phòng theo cơ sở.", "Bắt buộc để mở lịch."],
        ["Điều hướng tháng", "Nhóm nút (Button Group)", "Tháng trước / Hôm nay / Tháng sau.", "Không ràng buộc."],
        ["Lưới lịch", "Bảng (Calendar Grid)", "Hiển thị giá/tình trạng từng ngày; click mở chi tiết.", "Không ràng buộc."],
      ]},
      { sub: "Modal cập nhật giá (PricingModal)", rows: [
        ["Ngày bắt đầu / kết thúc", "Ô chọn ngày (Date)", "Khoảng ngày áp dụng (khi cập nhật theo khoảng).", "Bắt buộc với phạm vi khoảng ngày."],
        ["Giá", "Ô nhập số (Number)", "Giá áp dụng (₫).", "Tối thiểu 0; nếu > 0 thì ≥ 10.000; tối đa 100.000.000."],
        ["Số phòng mở bán", "Ô nhập số (Number)", "Số phòng có thể đặt.", "Tối thiểu 0."],
        ["Số đêm tối thiểu", "Ô nhập số (Number)", "Số đêm tối thiểu khi đặt.", "Từ 1 đến 365."],
        ["Đóng bán", "Hộp kiểm (Checkbox)", "Đánh dấu ngày đóng/không mở bán.", "Mặc định tắt."],
        ["Gợi ý giá AI", "Thẻ (Card)", "Đề xuất giá + nút áp dụng.", "Chỉ hiện khi có dữ liệu gợi ý."],
        ["Nút \"Lưu\"", "Nút nhấn (Button)", "Lưu thay đổi giá/tồn kho.", "Bị khóa khi đang lưu hoặc có lỗi xác thực."],
      ]},
    ],
  },
  {
    title: "Duyệt đối tác (Admin)",
    sections: [
      { sub: "Danh sách đơn", rows: [
        ["Thẻ thống kê", "Hiển thị (Display)", "Đếm số đơn Chờ duyệt / Đã duyệt / Từ chối.", "Chỉ đọc."],
        ["Bộ lọc trạng thái", "Nhóm nút (Button Group)", "Lọc ALL/SUBMITTED/UNDER_REVIEW/APPROVED/REJECTED.", "Không ràng buộc."],
        ["Bảng đơn đăng ký", "Bảng (Table)", "Cột: ID, Tên DN, Email, SĐT, Trạng thái, Thao tác.", "Chỉ đọc."],
        ["Nút \"Xem\"", "Nút biểu tượng (Icon Button)", "Mở chi tiết đơn.", "Không ràng buộc."],
        ["Nút \"Duyệt\" / \"Từ chối\"", "Nút biểu tượng (Icon Button)", "Duyệt hoặc mở hộp thoại từ chối.", "Chỉ hiện với đơn đang chờ xét duyệt."],
      ]},
      { sub: "Hộp thoại từ chối", rows: [
        ["Lý do từ chối", "Vùng văn bản (Text Area)", "Nhập lý do gửi cho đối tác.", "Bắt buộc nhập."],
        ["Nút \"Xác nhận từ chối\"", "Nút nhấn (Button)", "Gửi quyết định từ chối kèm lý do.", "Chỉ bật khi đã nhập lý do; bị khóa khi đang xử lý."],
      ]},
    ],
  },
];

/* ----------------------------- SINH OOXML ----------------------------- */
const COLW = [560, 1900, 2000, 2480, 2480]; // tổng ~9420 twips

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function runs(text, { bold = false, italic = false, color = null, size = null } = {}) {
  let rpr = "";
  if (bold) rpr += "<w:b/>";
  if (italic) rpr += "<w:i/>";
  if (size) rpr += `<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>`;
  if (color) rpr += `<w:color w:val="${color}"/>`;
  const rprXml = rpr ? `<w:rPr>${rpr}</w:rPr>` : "";
  return `<w:r>${rprXml}<w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;
}

function para(text, opts = {}) {
  const { align = null, spaceAfter = 120, ...runOpts } = opts;
  let ppr = `<w:spacing w:after="${spaceAfter}"/>`;
  if (align) ppr += `<w:jc w:val="${align}"/>`;
  return `<w:p><w:pPr>${ppr}</w:pPr>${runs(text, runOpts)}</w:p>`;
}

function cell(text, w, { bold = false, fill = null, align = null } = {}) {
  let tcpr = `<w:tcW w:w="${w}" w:type="dxa"/>`;
  if (fill) tcpr += `<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>`;
  tcpr += `<w:vAlign w:val="center"/>`;
  let ppr = `<w:spacing w:after="0"/>`;
  if (align) ppr += `<w:jc w:val="${align}"/>`;
  return `<w:tc><w:tcPr>${tcpr}</w:tcPr><w:p><w:pPr>${ppr}</w:pPr>${runs(text, { bold })}</w:p></w:tc>`;
}

function spanCell(text, { bold = true, fill = "E8E8E8" } = {}) {
  const total = COLW.reduce((a, b) => a + b, 0);
  const tcpr = `<w:tcW w:w="${total}" w:type="dxa"/><w:gridSpan w:val="5"/>`
    + `<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/><w:vAlign w:val="center"/>`;
  return `<w:tc><w:tcPr>${tcpr}</w:tcPr><w:p><w:pPr><w:spacing w:after="0"/></w:pPr>${runs(text, { bold })}</w:p></w:tc>`;
}

function tableForScreen(screen) {
  const borders = `<w:tblBorders>
    <w:top w:val="single" w:sz="4" w:space="0" w:color="999999"/>
    <w:left w:val="single" w:sz="4" w:space="0" w:color="999999"/>
    <w:bottom w:val="single" w:sz="4" w:space="0" w:color="999999"/>
    <w:right w:val="single" w:sz="4" w:space="0" w:color="999999"/>
    <w:insideH w:val="single" w:sz="4" w:space="0" w:color="999999"/>
    <w:insideV w:val="single" w:sz="4" w:space="0" w:color="999999"/>
  </w:tblBorders>`;
  const grid = `<w:tblGrid>${COLW.map((w) => `<w:gridCol w:w="${w}"/>`).join("")}</w:tblGrid>`;
  const tblPr = `<w:tblPr><w:tblW w:w="${COLW.reduce((a, b) => a + b, 0)}" w:type="dxa"/>${borders}</w:tblPr>`;

  // header
  const headers = ["STT", "Tên đối tượng", "Loại đối tượng", "Mô tả / Chức năng", "Ràng buộc nghiệp vụ"];
  let rows = `<w:tr>${headers.map((h, i) => cell(h, COLW[i], { bold: true, fill: "D9D9D9", align: i === 0 ? "center" : null })).join("")}</w:tr>`;

  let stt = 1;
  for (const sec of screen.sections) {
    if (sec.sub) {
      rows += `<w:tr>${spanCell(sec.sub)}</w:tr>`;
    }
    for (const r of sec.rows) {
      const cells = [
        cell(String(stt++), COLW[0], { align: "center" }),
        cell(r[0], COLW[1]),
        cell(r[1], COLW[2]),
        cell(r[2], COLW[3]),
        cell(r[3], COLW[4]),
      ].join("");
      rows += `<w:tr>${cells}</w:tr>`;
    }
  }
  return `<w:tbl>${tblPr}${grid}${rows}</w:tbl>`;
}

function buildDocument() {
  let body = "";
  // Trang tiêu đề
  body += para("PHỤ LỤC 2", { align: "center", bold: true, size: 32, spaceAfter: 120 });
  body += para("BIỂU MẪU ĐẶC TẢ CHI TIẾT GIAO DIỆN NGƯỜI DÙNG", { align: "center", bold: true, size: 28, spaceAfter: 80 });
  body += para("(UI SPECIFICATION TEMPLATE)", { align: "center", bold: true, size: 24, spaceAfter: 120 });
  body += para("Dự án: VLU Hotel Hub", { align: "center", italic: true, spaceAfter: 480 });

  SCREENS.forEach((screen, idx) => {
    body += para(`Giao diện số ${idx + 1}: ${screen.title}`, { bold: true, size: 28, spaceAfter: 120 });
    body += para("A. Hình ảnh thiết kế", { bold: true, spaceAfter: 60 });
    body += para("(Sinh viên chụp ảnh màn hình giao diện và chèn vào đây)", { italic: true, color: "808080", spaceAfter: 160 });
    body += para("B. Bảng đặc tả thành phần và tính năng", { bold: true, spaceAfter: 80 });
    body += tableForScreen(screen);
    // ngắt trang sau mỗi giao diện (trừ cái cuối)
    if (idx < SCREENS.length - 1) {
      body += `<w:p><w:r><w:br w:type="page"/></w:r></w:p>`;
    }
  });

  const sectPr = `<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>`;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>${body}${sectPr}</w:body></w:document>`;
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:rPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
</w:styles>`;

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const DOC_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

/* ----------------------------- ZIP WRITER (no deps) ----------------------------- */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function zip(files) {
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const f of files) {
    const nameBuf = Buffer.from(f.name, "utf8");
    const data = Buffer.from(f.content, "utf8");
    const comp = zlib.deflateRawSync(data);
    const crc = crc32(data);

    const lfh = Buffer.alloc(30);
    lfh.writeUInt32LE(0x04034b50, 0);
    lfh.writeUInt16LE(20, 4);
    lfh.writeUInt16LE(0x0800, 6); // UTF-8 flag
    lfh.writeUInt16LE(8, 8); // deflate
    lfh.writeUInt16LE(0, 10);
    lfh.writeUInt16LE(0, 12);
    lfh.writeUInt32LE(crc, 14);
    lfh.writeUInt32LE(comp.length, 18);
    lfh.writeUInt32LE(data.length, 22);
    lfh.writeUInt16LE(nameBuf.length, 26);
    lfh.writeUInt16LE(0, 28);

    chunks.push(lfh, nameBuf, comp);

    const cdh = Buffer.alloc(46);
    cdh.writeUInt32LE(0x02014b50, 0);
    cdh.writeUInt16LE(20, 4);
    cdh.writeUInt16LE(20, 6);
    cdh.writeUInt16LE(0x0800, 8);
    cdh.writeUInt16LE(8, 10);
    cdh.writeUInt16LE(0, 12);
    cdh.writeUInt16LE(0, 14);
    cdh.writeUInt32LE(crc, 16);
    cdh.writeUInt32LE(comp.length, 20);
    cdh.writeUInt32LE(data.length, 24);
    cdh.writeUInt16LE(nameBuf.length, 28);
    cdh.writeUInt16LE(0, 30);
    cdh.writeUInt16LE(0, 32);
    cdh.writeUInt16LE(0, 34);
    cdh.writeUInt16LE(0, 36);
    cdh.writeUInt32LE(0, 38);
    cdh.writeUInt32LE(offset, 42);
    central.push(Buffer.concat([cdh, nameBuf]));

    offset += lfh.length + nameBuf.length + comp.length;
  }
  const centralBuf = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);
  return Buffer.concat([...chunks, centralBuf, eocd]);
}

/* ----------------------------- MAIN ----------------------------- */
const files = [
  { name: "[Content_Types].xml", content: CONTENT_TYPES },
  { name: "_rels/.rels", content: RELS },
  { name: "word/_rels/document.xml.rels", content: DOC_RELS },
  { name: "word/document.xml", content: buildDocument() },
  { name: "word/styles.xml", content: STYLES },
];

const outPath = path.join(__dirname, "dac-ta-giao-dien-vlu-hotel-hub.docx");
fs.writeFileSync(outPath, zip(files));
console.log("OK -> " + outPath);
console.log("Số giao diện: " + SCREENS.length);
