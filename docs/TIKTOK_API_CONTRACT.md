# Hợp đồng API TikTok Shop (đơn, giao hàng, hủy, hoàn trả, tài chính, giá/tồn)

Viết lại theo backend `SmartOmni_Platform` `origin/develop` @ `f9495df` (25/11/2026), thay cho bản cũ theo BE `8a557bf`. Kế hoạch nối FE: [TIKTOK_BE_INTEGRATION_PLAN.md](TIKTOK_BE_INTEGRATION_PLAN.md).

## Quy ước chung

- **Envelope:** `{ success, message, data, timestamp }`. Tải tem trả PDF nhị phân.
- **Tên trường:** DTO đơn, gói, hoàn trả dùng snake_case. DTO tài chính, catalog, kết nối dùng camelCase.
- **Thời gian:** các trường `*_time`, `fromDate`, `toDate` là Unix giây.
- **Không cần gửi `shopId`:** BE lấy kết nối TikTok của tenant từ JWT (trừ `POST /catalog/auto-import?shopId=` tùy chọn).
- **Lỗi:** `409 TIKTOK_NOT_CONNECTED` khi chưa kết nối; `400 TIKTOK_PRICE_INVALID` khi giá không phải số nguyên VND; `409 TIKTOK_CANCEL_NOT_ALLOWED` khi hủy đơn không ở `UNPAID`/`AWAITING_SHIPMENT`; `501 TIKTOK_VOUCHER_CREATE_UNSUPPORTED`; `502 SHIPPING_LABEL_UNAVAILABLE` khi chưa có tem.

## Bảng endpoint

Base nghiệp vụ là `/api/v1/tiktok`. Base kết nối là `/api/v1/marketplace-connections/tiktok-shop`. Quyền chung là `TENANT_ADMIN, MANAGER`. Authorize, callback và disconnect chỉ cho `TENANT_ADMIN`.

| Nhóm | Endpoint | Ghi chú thay đổi so với contract cũ |
|---|---|---|
| Kết nối | `GET /`, `POST /authorization`, `/callback`, `/disconnect` | `TiktokConnectionDto` có thêm `needsReconnect`, `grantedScopes`, `sellerType`, `refreshTokenExpiresAt` |
| Import / đồng bộ | `POST /products/products/import`, `GET /products/products/import-runs`, `POST /products/warehouses/sync`, `POST /products/prices/sync` | Không đổi. Dùng chung `ImportReport` và kiểu `Result` của price sync với Shopee. Import dừng với `stopped_sku_limit` khi chạm giới hạn SKU theo gói |
| Giá / tồn SKU | `PUT /products/stock`, `PUT /products/price` | Giá phải là số nguyên VND, sai thì 400 `TIKTOK_PRICE_INVALID`. Có nhận `salePrice` |
| Catalog | `GET /catalog`, `POST /catalog/auto-import?shopId=` | `TiktokCatalogItemDto` trả mapping và `currentPrice`. `TiktokAutoImportReportDto` trả `importedCount`/`linkedExistingCount`/`skippedCount`/`status` (có `STOPPED_SKU_LIMIT`) |
| Đơn | `GET /orders` (lọc `orderId` đã chạy), `GET /orders/{id}`, `POST /orders/sync` | Từ `79ed616`, sync **đẩy đơn vào hàng đợi** `order.incoming`, order-service tạo/cập nhật bất đồng bộ. `TiktokOrderSyncResponse` trả `totalFetched`/`enqueuedCount`/`failedCount`; `createdCount`/`updatedCount` luôn 0 |
| Vận chuyển | `GET /logistics/shipping-providers` | Trả **danh sách** `TiktokShippingProviderDto`, không còn `documentTypes` |
| | `POST /logistics/ship-package` | Nhận `shippingServiceId` và `handoverMethod` (`PICKUP`/`DROP_OFF`) |
| | `GET /logistics/shipping-label/download` | `documentType` mặc định `SHIPPING_LABEL`, `SL_PDF`/`WAYBILL_PDF` cũng được đổi thành `SHIPPING_LABEL`. Lỗi trả 502 với mã `SHIPPING_LABEL_UNAVAILABLE` |
| Hủy | `GET /cancellations`, `POST /cancellations/cancel`, `POST /{id}/approve`, `POST /{id}/reject` (body `rejectReason`) | Shop chỉ hủy được khi đơn `UNPAID` hoặc `AWAITING_SHIPMENT`, khác thì 409 `TIKTOK_CANCEL_NOT_ALLOWED` |
| Hoàn trả | `GET /returns`, `GET /returns/{id}`, **`GET /returns/{id}/records`** (mới), `POST /{id}/approve`, `POST /{id}/reject` | `refund_amount` giờ là object `TiktokRefundAmount` `{currency, refund_subtotal, refund_shipping_fee, refund_tax, refund_total}`, giá trị dạng chuỗi. `TiktokReturnRecord` có `create_time, description, event, note, reason_text, role` |
| Hậu mãi | `GET /aftersale/reasons`, `/reject-reasons`, `/eligibility/{orderId}` | `reasons` có thêm `returnStatuses` |
| Tài chính | `GET /finance/escrow/{orderId}` | `TiktokEscrowDetail` là chi tiết giá đơn (`source=ORDER_PRICE_DETAIL`). Các field escrow và phí là **null**. Có thêm `order` và `lineItems` (kiểu `PriceBreakdown`) |
| | `GET /finance/settlements` | `TiktokSettlementListResult` là **ước tính** từ đơn COMPLETED (`estimated=true`, `source=ESTIMATED_FROM_ORDERS`, có `totals`). Backend bỏ qua `pageSize` và `pageToken` |
| Voucher | `GET /vouchers`, `POST /vouchers/sync?title=` | `POST /vouchers` luôn trả 501 `TIKTOK_VOUCHER_CREATE_UNSUPPORTED` |
| Lối tắt dev/demo | `POST /api/v1/tiktok/connect` | Không nối vào FE (xem mục 5.3) |
| Nền (không phải màn FE) | `POST /api/v1/integrations/tiktok/webhooks`, polling đơn, hoàn trả và hủy | |

**Backend chưa có (đã chốt: FE bỏ qua, chỉ ghi chú):**
- `PATCH /settings` để bật/tắt auto-import, như Shopee.
- Endpoint dispute hoàn trả riêng.

## Ghi chú nối FE

- **Sync đơn:** FE hiện `Fetched`/`Queued`/`Failed` từ `enqueuedCount`/`failedCount`, rồi nhắc người dùng refresh sau vài giây.
- **OAuth:** FE gửi `redirect_uri` là callback của chính origin đang mở (local), để callback đọc được session của tab. Backend chỉ nhận URI đã đăng ký (`TIKTOK_REDIRECT_URI`, `TIKTOK_ALLOWED_REDIRECT_URIS`).

- **Hoàn trả:** `refund_amount` là object `{currency, refund_subtotal, refund_shipping_fee, refund_tax, refund_total}` (chuỗi). FE đọc `refund_total`. Lịch sử xử lý lấy từ `GET /returns/{id}/records`.
- **Vận chuyển:** `ship-package` nhận `shippingServiceId` và `handoverMethod` (`PICKUP`/`DROP_OFF`) là hai lựa chọn riêng. Tải tem luôn gửi `documentType=SHIPPING_LABEL`.
- **Escrow:** phí sàn và `escrowAmount` luôn null. FE hiện "Not available".
- **Settlements:** số ước tính từ đơn COMPLETED, FE hiện badge "Estimated". Backend bỏ qua `pageSize` và `pageToken`.
- **Voucher:** FE chỉ có "Sync vouchers"; không có nút tạo.
- **Hai đường import:** `/products/products/import` là nhập đầy đủ có lịch sử chạy (màn Import). `/catalog/auto-import` là luồng WF-01, chạy nhanh từ màn Catalog/Products.
- **`POST /tiktok/connect`:** lối tắt dev/demo liên kết shop trực tiếp, FE không dùng. FE dùng OAuth `/authorization` và `/callback`.
