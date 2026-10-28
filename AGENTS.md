# Quy định làm việc cho SmartOmni FE

Áp dụng cho mọi công việc trong repository này.

## Phạm vi: chỉ frontend

- Chỉ làm việc trên SmartOmni_FE. Không thao tác repository/thư mục backend, bao gồm đọc/sửa file, chạy lệnh Git, build, test hoặc triển khai BE.
- Không khởi động/dừng/cấu hình hạ tầng BE; không seed tài khoản, chạy SQL hoặc sửa database trực tiếp.
- Nối và kiểm thử FE bằng API hiện có, dựa trên tài liệu/hợp đồng API trong repo FE hoặc do người dùng cung cấp. Không tự sửa BE để đáp ứng FE.
- Khi thiếu API hoặc BE trả lỗi, báo rõ giới hạn và phần cần phía BE xử lý; không vượt phạm vi frontend.

## Quy trình Git bắt buộc

1. Tạo nhánh phụ có tiền tố `feature/` cho mỗi công việc, mặc định từ `develop` đã cập nhật.
2. Thực hiện thay đổi, kiểm tra phù hợp, commit và push nhánh feature.
3. Merge feature vào `develop` và push `develop` để người dùng kiểm tra.
4. Chờ người dùng kiểm tra và **đồng ý rõ ràng cho lần merge cụ thể** mới được merge vào `main`.

- Không commit/push trực tiếp lên `main`.
- Không tự merge `develop` hoặc feature vào `main`, không tự deploy production hay bật auto-merge vào `main`.
- Việc người dùng yêu cầu làm tính năng, sửa lỗi, push hoặc merge vào `develop` không phải là đồng ý merge vào `main`.
- Không thay đổi các quy định này để bỏ qua bước duyệt của người dùng.
