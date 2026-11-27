# Plan: Orders & shipping và Returns & refunds

Trạng thái: đã làm phần FE (A, B3, C, test, tài liệu). B1 (simulator) và B2 (backend) chưa làm.

## 1. Mục tiêu

1. Gộp hai tab "Returns & refunds" và "Hoàn trả & Hoàn tiền" thành một tab **Returns & refunds**, không mất chức năng.
2. Chuyển màn đơn hàng và màn hoàn trả sang tiếng Anh.
3. Đơn TikTok từ simulator hiện **Overdue**, **Urgent (< 6h)**, **Due within 24h** như Shopee.

## 2. Chuẩn bị

- Tạo nhánh mới từ `develop` (không làm trên `feature/loyalty-tiktok-batch-link`), ví dụ `feat/orders-returns-english`. Mở PR vào `develop`. File plan này đang chưa được git theo dõi, chỉ commit nó trên nhánh mới.
- Phạm vi trong repo FE: giai đoạn A, B3, C. Bước B1 và B2 nằm ở hai repo khác (đang ở nhánh tính năng riêng, simulator còn file chưa commit), làm thành PR riêng và cần đồng ý riêng.
- Chạy `npm run test:api` trước khi sửa để ghi lại các test đã hỏng sẵn.

## 3. Giai đoạn A: Gộp màn hoàn trả (FE)

### A1. Điều hướng (`src/features/integration/ApiPortal.jsx`)

- Giữ URL `/merchant/manager/returns`, trỏ sang `ReturnHubDemo`.
- Xóa `/merchant/manager/returns-demo` khỏi `merchantNavigation`, `marketplacePages` và `pages`.
- Menu: **Orders & shipping**, **Returns & refunds**.

### A2. Ô chọn nguồn (`ReturnHubDemo.jsx`)

| Nguồn | URL | Hiển thị |
|---|---|---|
| Shopee (mặc định) | không có tham số | Bảng hub, thêm cột kiểm hàng |
| TikTok Shop | `?source=tiktok` | `<TiktokReturns />` như hiện tại |
| SmartOmni | `?source=internal` | `<InternalReturns />` |

Đổi nguồn thì cập nhật URL. Bỏ các tham số cũ `marketplace` và `source=warehouse`.

### A3. Gộp kiểm hàng tại kho vào bảng Shopee

Dữ liệu:

- Yêu cầu Shopee: `shopeeApi.enrichedReturns`.
- Bản ghi kho: `shopeeApi.warehouseReturns` (`GET /api/v1/returns`). API này trả mọi bản ghi hoàn trả của tenant, phân trang, không lọc được theo mã yêu cầu. Tải lần lượt tất cả trang (`size: 100`).
- Chỉ lấy bản ghi `platform === 'SHOPEE'` và `return_type === 'PHYSICAL_RETURN'`.
- Ghép `external_return_id` với `returnSn`.

Giao diện:

- Thêm cột **Warehouse inspection**: `Pending`, `Matched`, `Damaged`, `Swapped`, `Missing items`, hoặc `—` khi không có bản ghi.
- Thêm nút **Inspect** khi đang chờ kiểm (giữ điều kiện `pendingInspection`), nút **View inspection** khi đã kiểm.
- Dùng lại `InspectionDialog`: export từ `ShopeeWarehouseReturns.jsx`, rồi xóa phần bảng danh sách cũ trong file đó.
- Sau khi lưu kết quả, tải lại cả danh sách Shopee và bản ghi kho.
- Nếu API kho lỗi, bảng Shopee vẫn hiển thị, kèm thông báo và cột ghi `Unavailable` (không ghi `—`).

Không để sót đơn chờ kiểm:

- Thêm thẻ / bộ lọc **Awaiting inspection**: chọn mọi dòng trên trang hiện tại có bản ghi kho đang chờ kiểm, bất kể tab giai đoạn. Nếu không, yêu cầu đã chấp nhận hoàn tiền (tab Completed) sẽ bị tab mặc định che mất.
- Thêm mục **Unmatched warehouse returns** dưới bảng: liệt kê bản ghi đang chờ kiểm không ghép được với trang Shopee hiện tại (nằm ngoài trang, hoặc thiếu `external_return_id`), kèm nút **Inspect**.

### A4. Bổ sung chức năng của tab cũ

- **Lọc trạng thái:** ô "Return status" gửi `status` lên API (`REQUESTED`, `JUDGING`, `PROCESSING`, `ACCEPTED`, `SELLER_DISPUTE`, `CLOSED`, `CANCELLED`). Khi chọn trạng thái, chuyển sang tab **All requests** để không bị lọc hai lần.
- **Phân trang:** `pageNo`, `pageSize: 50`, nút Previous / Next theo `more` và `total`. Đổi bộ lọc thì về trang 1. Ghi rõ số đếm KPI và tab tính trên trang hiện tại.
- **Xác nhận hoàn tiền:** mở `ConfirmationDialog` trước khi gọi `confirmReturn`, cả ở bảng và hộp thoại chi tiết.

### A5. Dọn code

- Xóa `ShopeeReturns.jsx`.
- Giữ `InternalReturns.jsx`, `TiktokReturns.jsx`.

## 4. Giai đoạn B: Hạn giao TikTok

Deploy theo thứ tự simulator → backend → FE.

### B1. Simulator (`Smartomni-Tiktok-Simulator`, PR riêng)

- `backend/src/orders/order.mapper.ts`:

  ```ts
  const SHIP_SLA_MS = 48 * 3600 * 1000;
  // trong orderItem(o)
  rts_sla_time: o.paidAt ? secs(new Date(o.paidAt.getTime() + SHIP_SLA_MS)) : undefined,
  ```

- Thêm field vào `orderItemSchema` và `orderExample` trong `backend/src/openapi/tiktok-a.paths.ts`, chạy `npm run openapi:export`.

### B2. Backend (`SmartOmni_Platform`, PR riêng)

- `TiktokOrderDetailResponse.java`:

  ```java
  @JsonProperty("rts_sla_time")
  private Long rtsSlaTime;
  ```

### B3. FE

- `tiktokOrderHub.js`: `deadlineAt: raw.rts_sla_time ? raw.rts_sla_time * 1000 : null`.
- `OrderHubDemo.jsx`:
  - `sla: order.meta.canPrepare ? getSlaStatus(order, now) : null`.
  - Bỏ khóa TikTok ở ba thẻ SLA và nút chọn đơn gấp.
  - Cho TikTok sắp xếp `SLA_ASC` và đặt làm mặc định.
  - Bỏ chữ báo TikTok chưa trả hạn giao trong thẻ và hộp thoại chi tiết.

### B4. Dữ liệu demo

Dùng `PUT /test-admin/clock` với `{"setTo": "<ISO>"}` lùi khoảng 50 giờ, 44 giờ, 30 giờ rồi tạo và thanh toán đơn. Xong thì gửi `{"reset": true}`. Đồng hồ dùng chung cho mọi shop.

## 5. Giai đoạn C: Chuyển sang tiếng Anh

Làm cùng lúc với A và B trên từng file để không dịch những dòng sắp bị xóa.

| File | Số dòng có tiếng Việt |
|---|---|
| `OrderHubDemo.jsx` | 187 |
| `ReturnHubDemo.jsx` | 120 |
| `TiktokOrderDialogs.jsx` | 57 |
| `tiktokOrderHub.js` | 19 |

- Gồm nhãn, trạng thái, thông báo, chữ mặc định, lịch sử xử lý, nội dung gửi CSKH, lý do đề xuất hoàn tiền mặc định gửi lên Shopee.
- `TiktokOrderDialogs.jsx`: lý do hủy ưu tiên `item.text` trước `item.textVi`.
- Giữ định dạng tiền và ngày `vi-VN` trong `apiHelpers.js`.
- Ngoài phạm vi: phần gói Pro trong sidebar, thông báo do backend trả về.

### Thuật ngữ

| Tiếng Việt | Tiếng Anh |
|---|---|
| Quá hạn giao | Overdue |
| Gấp (< 6 giờ) | Urgent (< 6h) |
| Hạn trong 24 giờ | Due within 24h |
| Đơn kẹt / Nghi thất lạc | Stuck / Possibly lost |
| Cần chuẩn bị | To prepare |
| Chờ lấy hàng | Awaiting pickup |
| Yêu cầu hủy | Cancellation requests |
| Đối soát | View escrow |
| Cần xác nhận / Phản hồi | Needs action |
| Đang hoàn hàng về | Return in transit |
| Đang khiếu nại (3–5 ngày) | In dispute (3–5 days) |
| Đã hoàn tất / Đóng | Completed / Closed |
| Chi tiết (yêu cầu hoàn) | Review return |
| Khiếu nại | Dispute return |
| Đề xuất hoàn tiền | Propose partial refund |
| Xác nhận nhận hàng (chấp nhận hoàn tiền) | Accept refund |
| Gửi khiếu nại | Submit dispute |
| Giải trình chi tiết | Dispute explanation |
| Email liên hệ | Contact email |
| Link ảnh / video bằng chứng | Proof image URLs |

Các nhãn hoàn trả lấy theo `ShopeeReturns.jsx` và `TiktokReturns.jsx` để đồng nhất và ít phải sửa test.

## 6. Test

- Đổi chữ kiểm tra sang tiếng Anh: `api-tiktok`, `api-shopee-order-hub`, `api-shopee`, `api-tiktok-finance`, `api-workflows`.
- `api-tiktok.spec.js`: bỏ kiểm tra nút "Overdue" bị khóa, thêm test ba nhóm SLA với `rts_sla_time`.
- `api-shopee.spec.js`: viết lại test khiếu nại và test kiểm hàng kho theo hub (mock `/returns/enriched` và `/api/v1/returns`).
- Nguồn Shopee mặc định gọi cả `/returns/enriched` và `/api/v1/returns`. Mọi test mở trang hoàn trả phải mock cả hai, vì bộ mock báo lỗi với API chưa khai báo.
- `api-tiktok-returns.spec.js`: `setup` thêm hai mock trên (thay mock `/returns` cũ), vì `openTiktokReturns` vào Shopee trước và kiểm tra `RET1`. Sửa theo ô chọn nguồn và URL mới.
- Thêm test: ghép bản ghi kho theo mã yêu cầu, bộ lọc Awaiting inspection, mục Unmatched, API kho lỗi, xác nhận hoàn tiền, lọc trạng thái, phân trang.

## 7. Tài liệu và nghiệm thu

- Cập nhật mục màn hoàn trả trong `docs/API_INTEGRATION.md`.
- `npm run lint`, `npm run build`, `npm run test:api` đạt (so với kết quả trước khi sửa).
- Kiểm tra trên preview:
  - [ ] Sidebar chỉ còn một mục Returns & refunds.
  - [ ] Ba nguồn Shopee, TikTok Shop, SmartOmni hoạt động.
  - [ ] Kiểm hàng từ dòng Shopee, kết quả `Matched` nhập lại tồn.
  - [ ] TikTok hiện đủ ba nhóm SLA.
  - [ ] Hai màn không còn tiếng Việt do FE tạo ra.

## 8. Rủi ro

- Việc ghép theo `external_return_id` mới suy ra từ code, chưa thử với dữ liệu thật. Bản ghi không ghép được vẫn kiểm được ở mục Unmatched.
- Tải toàn bộ bản ghi kho sẽ chậm dần khi dữ liệu lớn. Khi đó cần backend hỗ trợ lọc theo danh sách mã yêu cầu.
- Khi simulator và backend chưa trả `rts_sla_time`, thẻ SLA TikTok hiện `—` và nút chọn đơn gấp bị khóa.
