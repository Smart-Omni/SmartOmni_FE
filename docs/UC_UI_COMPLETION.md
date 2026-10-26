# Các màn hình UC nội bộ đã bổ sung

Phạm vi: hoàn thiện frontend còn thiếu theo `UC.txt` ngày 26/10/2026. Không triển khai các tác nhân tích hợp Email Service, Payment Gateway hoặc Marketplace. Giữ React/JSX, Vite, CSS Modules, component Button/Dialog và phong cách light hiện có.

## Xác thực: UC 1.2 và 9.3

- `/auth/reset-password?account=admin`: reset Super Admin.
- `/auth/reset-password?account=owner`: reset Tenant Owner.
- `/auth/reset-password` hoặc `?account=staff`: giữ luồng Staff.
- Forgot password nhận biết loại tài khoản từ email đã nhập. Có bộ chọn loại tài khoản khi mở trực tiếp trang recovery.
- Link một lần, hết hạn sau 10 phút; cấp link mới vô hiệu link cũ. Token và mật khẩu mới chỉ ở bộ nhớ SPA; reload phục hồi fixture. Không thay role/membership/quyền và không ghi mật khẩu ra browser storage hay gửi email.

## Staff: UC 2.25–2.39

Dùng `staff.active@smartomni.demo` / `Demo@123`. Tài khoản có membership ACTIVE và quyền được cấp bởi Owner. Các route bên dưới nằm dưới `/merchant/staff/`.

- **2.25, 2.26, 2.27 — `conversations`**: tìm/lọc hội thoại, xem tin nhắn/ảnh/tệp, soạn trả lời, chọn tối đa 3 tệp PNG/JPEG/PDF/text (mỗi tệp ≤1 MB), xem queued/sent/delivered/failed và retry demo. Tệp đính kèm được lưu cục bộ bằng data URL; không gửi qua marketplace.
- **2.28 — `sales-events`**: nhập/xem/xóa sự kiện bán hàng. Quyền ghi `planning:write` tách khỏi quyền đọc.
- **2.29 — `forecasts`**: dùng cùng bảng và biểu đồ dự báo minh họa của Owner; thay đổi sự kiện cập nhật chung scenario của tenant.
- **2.30, 2.39 — `returns`**: tìm/lọc phiếu trả, xem chi tiết và lịch sử; ghi nhận nhận hàng → đánh giá tình trạng/ghi chú/chọn video → xác nhận đưa vào kho. Hàng tốt có thể vào sellable; hàng hỏng bắt buộc quarantine. Quarantine không cộng available stock. Mỗi phiếu được restock một lần; phiếu sửa cũ bị chặn; tồn bán được cập nhật ledger và queue sync như nhập kho thông thường.
- **Video kiểm định**: chọn MP4/WebM/MOV ≤20 MB và xem preview bằng object URL. Demo lưu metadata tên/loại/dung lượng, không lưu nội dung video; đóng màn sẽ bỏ preview. Không mô tả metadata là video đã upload lên server.
- **2.31 — `business`**: số liệu mẫu, xu hướng bán hàng theo ngày, tiến độ đơn, việc cần xử lý và hoạt động Staff. Nhãn phân biệt số liệu kinh doanh mẫu với trạng thái đơn/kho cục bộ.
- **2.32 — `costs`** và **2.35 — `profit`**: dùng chung ledger tenant với Owner; form/action sửa/xóa theo quyền `finance:write`, xem theo `finance:read`. Profit vẫn là ước tính minh họa, không phải số liệu đã đối soát.
- **2.33 — `advisor`**: hỏi đáp template local; lịch sử Staff chỉ hiện câu hỏi do chính tài khoản đó tạo và còn được phép đọc. Câu hỏi về tài chính/kế hoạch kiểm tra thêm quyền đọc nguồn dữ liệu.
- **2.34 — `strategy`**: tư vấn mẫu, chỉ hiển thị nguồn/link Staff được cấp quyền.
- **2.36 — `disputes`**: tìm/lọc, xem chi tiết, tiền tranh chấp, deadline và timeline snapshot. Không gửi phản hồi/tài liệu lên sàn.
- **2.37, 2.38 — `complaints`**: xem nội dung gốc, phân loại mẫu/confidence/lý do; đánh dấu resolved kèm ghi chú; trạng thái lưu qua reload.

### Phân quyền và dữ liệu

- Owner quản lý quyền mới tại `/merchant/team`.
- `conversations:read/reply`, `returns:read/process`, `disputes:read`, `complaints:read/resolve`, `business:read`, `planning:read/write`, `finance:read/write`, `advisor:use`.
- Restock cần thêm `inventory:receive`. Mọi mutation kiểm tra lại session, membership, tenant, domain yêu cầu và quyền; ẩn nút không phải là kiểm tra duy nhất.
- Các quyền mới được seed cho Sam khi fixture được tạo lần đầu. Membership đã lưu từ bản trước không tự được nâng quyền: Owner cần bật các quyền tương ứng trong Team. Không xóa dữ liệu hoặc cấp lại quyền đã bị thu hồi.
- Support data ở `smartomni.staff-operations-demo.v1`, chuẩn hóa tương thích dữ liệu cũ. Sự kiện, chi phí và advisor dùng chung `smartomni.owner-workspace-demo.v1`; hoạt động có tên actor thực của fixture. Billing, cấu hình shop và phát voucher Owner vẫn chặn Staff.
- Điều hướng desktop chia nhóm liên quan; mobile dùng bộ chọn workspace và bộ chọn hội thoại, tránh hiển thị toàn bộ menu trước nội dung.

## Tenant onboarding: UC 3.2

`/auth/register/owner` bổ sung phần Store address setup: hostname minh họa, kiểm tra slug 3–63 ký tự, reserved names và xung đột với tenant demo cục bộ, trạng thái khả dụng, xác nhận địa chỉ khi tiếp tục. Màn welcome hiển thị địa chỉ đã chọn. `.smartomni.example` là hostname minh họa; không cấp DNS hoặc tài khoản thật. Quy tắc này chỉ áp dụng cho demo frontend, không khẳng định chính sách domain production đã được chốt.

## Guest/Customer

- **4.4 — `/store/everyday-studio/assistant`**: chatbot sản phẩm cho Guest và Customer; gợi ý theo tên/category/ngân sách, liên kết tới chi tiết sản phẩm, chính sách cửa hàng, xử lý câu ngoài phạm vi, clear chat. Lịch sử nằm trong sessionStorage, tách Guest/từng account; không gọi model AI.
- **5.8 — `/customer/vouchers`**: giữ actor Customer theo xác nhận của người dùng. Chọn tier/phần trăm giảm → preview người nhận đủ điều kiện/skipped → xác nhận → xem kết quả/mã demo. Dữ liệu người nhận hoàn toàn hư cấu, campaign lưu theo account ở `smartomni.customer-voucher-lab.v1`. Chặn Guest, không ghi vào chiến dịch Owner và không tạo discount/voucher thật.
- **4.5 — giới hạn dữ liệu hiện có**: giao diện chọn offer/nút View on marketplace và trạng thái thiếu link đã có. Catalog fixture vẫn chưa có URL listing thật; không bịa link sản phẩm. Đích mở trang thật cần được cung cấp từ dữ liệu tích hợp marketplace, nằm ngoài phần tích hợp của đợt này.

## Review và kiểm chứng

- Có kiểm thử cho reset Admin/Owner, quyền Staff và tenant binding, chia sẻ ledger với Owner, read-only actions, hội thoại/tệp/status, nhận–kiểm định–restock, hàng cách ly, chống restock trùng, khiếu nại, dispute, chatbot, voucher Customer tách biệt và domain preview.
- Test mới: `account-recovery.spec.js`, `staff-support.spec.js`, `staff-business.spec.js`, `public-uc-completion.spec.js`. Bộ onboarding hiện có được cập nhật nhãn mô tả domain cho hành vi mới.
- Chụp giao diện mới ở 375px/1440px và các modal nghiệp vụ. Probe cho màn recovery và hội thoại; các lỗi tương phản placeholder/điều hướng mobile phát hiện trong review đã sửa. Giữ viền và sidebar cuộn theo hệ thống giao diện hiện có; không thay theme hoặc thêm dark mode.
- Màu/font vẫn chỉnh tại `src/styles/index.css`, Button tại `src/shared/ui/button.jsx`. Nội dung số liệu, classification, dự báo và AI đều là demo.

Kết quả cuối: `npm run lint` đạt; `npm run build` đạt; toàn bộ **152/152 Playwright test đạt** với 2 workers (3,9 phút), gồm 21 test mới. Các ca thất bại trong lúc sửa code đã được chẩn đoán/sửa và bộ tổng đã chạy lại thành công. Đây là hoàn thiện màn hình frontend, không xác nhận hệ thống backend sẵn sàng production.
