# Kế hoạch nối FE SmartOmni với API TikTok Shop của backend

> Trạng thái: chờ duyệt phần sửa code (mục 3). Đối chiếu với `SmartOmni_Platform` origin/develop @ `f9495df`, ngày 25/11/2026.

> **Quy ước ngôn ngữ:** tài liệu này viết bằng tiếng Việt. Giao diện FE dùng **toàn bộ tiếng Anh**. Mọi tên DTO, field, hàm, nhãn, nút, tiêu đề và thông báo trên UI trong tài liệu này đều ghi đúng bằng tiếng Anh, như sẽ xuất hiện trong code.

## 0. Bối cảnh

- Tài liệu `docs/TIKTOK_API_CONTRACT.md` và mục TikTok trong `docs/BE_API_INVENTORY.md` viết theo BE cũ (`8a557bf`). Backend đã đổi nhiều thứ từ đó.
- **Nguồn đối chiếu:** repo `SmartOmni_Platform`, ref `origin/develop` @ `f9495df`.
- Bản checkout local đang ở nhánh `fix/inventory-import-initial-stock`, chậm khoảng 20 commit TikTok. Cần `git pull` develop trước khi smoke test.
- **Mục tiêu:**
  1. FE gọi đúng mọi API TikTok backend đang có, đọc đúng field.
  2. Không hiển thị số liệu sai (NaN, 0 ₫ cho giá trị không biết, "statement" cho số ước tính).
  3. Bỏ hoặc thay các nút mà backend luôn từ chối.

## 1. Hiện trạng API backend (origin/develop)

Base nghiệp vụ là `/api/v1/tiktok`. Base kết nối là `/api/v1/marketplace-connections/tiktok-shop`. Quyền chung là `TENANT_ADMIN, STAFF`. Authorize, callback và disconnect chỉ cho `TENANT_ADMIN`.

| Nhóm | Endpoint | Ghi chú thay đổi so với contract cũ |
|---|---|---|
| Kết nối | `GET /`, `POST /authorization`, `/callback`, `/disconnect` | `TiktokConnectionDto` có thêm `needsReconnect`, `grantedScopes`, `sellerType`, `refreshTokenExpiresAt` |
| Import / đồng bộ | `POST /products/products/import`, `GET /products/products/import-runs`, `POST /products/warehouses/sync`, `POST /products/prices/sync` | Không đổi. Dùng chung `ImportReport` và kiểu `Result` của price sync với Shopee. Import dừng với `stopped_sku_limit` khi chạm giới hạn SKU theo gói |
| Giá / tồn SKU | `PUT /products/stock`, `PUT /products/price` | Giá phải là số nguyên VND, sai thì 400 `TIKTOK_PRICE_INVALID`. Có nhận `salePrice` |
| Catalog | `GET /catalog`, `POST /catalog/auto-import?shopId=` | `TiktokCatalogItemDto` trả mapping và `currentPrice`. `TiktokAutoImportReportDto` trả `importedCount`/`linkedExistingCount`/`skippedCount`/`status` (có `STOPPED_SKU_LIMIT`) |
| Đơn | `GET /orders` (lọc `orderId` đã chạy), `GET /orders/{id}`, `POST /orders/sync` | Sync **đã lưu** đơn, `TiktokOrderSyncResponse` trả `totalFetched`/`createdCount`/`updatedCount` |
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

## 2. Các điểm FE đang lệch với backend

Các mục được sắp theo mức ảnh hưởng.

| # | Lỗi | Vị trí | Hậu quả |
|---|---|---|---|
| 1 | `money(item.refund_amount)` nhận vào một object | `TiktokReturns.jsx:38,60,61` | Hiện "NaN ₫" |
| 2 | Escrow hiện null thành 0 ₫, "Net escrow" luôn 0 | `ShopeeOrders.jsx` ~172 | Số liệu sai |
| 3 | Settlements gọi là "statement", bỏ qua `estimated`/`source`/`totals`, phân trang chết | `TiktokSettlements.jsx` | Gây hiểu nhầm |
| 4 | Dialog tạo voucher luôn lỗi 501, sync không truyền `title` | `TiktokVouchers.jsx`, `tiktok.js:55-56` | Nút hỏng |
| 5 | Nút hủy hiện cả khi đơn `ON_HOLD` | `ShopeeOrders.jsx:73` | Bấm vào bị 409 |
| 6 | `shippingDocumentTypes` đọc `data.documentTypes`, field này không còn tồn tại | `tiktok.js:22`, `ShopeeOrders.jsx:191,231` | Ô chọn loại tem chỉ có 1 lựa chọn giả |
| 7 | `handoverMethod` chỉ được gửi khi `shippingServiceId` trùng tên `PICKUP`/`DROP_OFF` | `ShopeeOrders.jsx:202` | Luôn là `PICKUP`, không có lựa chọn `DROP_OFF` |
| 8 | Ô giá cho nhập số lẻ (step 0.01) | `TiktokCatalog.jsx:69` | Bấm vào bị 400 |
| 9 | Từ chối hủy không gửi lý do | `tiktok.js:32`, `TiktokCancellations.jsx` | Luôn dùng `REJECTED_BY_SELLER` |
| 10 | Bộ lọc trạng thái hoàn trả viết cứng | `TiktokReturns.jsx:14` | Có thể lệch `returnStatuses` của backend |
| 11 | Thiếu hàm gọi `/returns/{id}/records` | `tiktok.js` | Không xem được lịch sử xử lý |
| 12 | Trùng khóa `autoImport` | `tiktok.js:46,53` | `shopId` không được gửi |
| 13 | Đọc `res.syncedCount`, backend không trả field này | `ProductsPage.jsx:236` | Thông báo sai |
| 14 | Màn đơn luôn mở ở nguồn `local`, không đọc URL. Màn kết nối ẩn link "View orders" với TikTok | `ShopeeOrders.jsx:32`, `ShopeeConnection.jsx:51` | Không đi thẳng từ kết nối TikTok sang đơn TikTok được |

## 3. Kế hoạch thực hiện

Các bước dưới đây chỉ làm sau khi bạn đồng ý. Mỗi bước có thể commit riêng trên nhánh `feature/tiktok-be-alignment` cắt từ `develop`. Chi tiết cách làm cho các điểm từng còn bỏ ngỏ nằm ở mục 5.

### Bước 1. Client API (`src/services/api/tiktok.js`)
- Gộp hai khóa `autoImport` thành một (mục 5.3).
- `shippingProviders` giữ nguyên, backend trả mảng.
- Xóa `shippingDocumentTypes`. `shippingLabel` luôn gửi `documentType: 'SHIPPING_LABEL'` (mục 5.1).
- Thêm `returnRecords: (returnId, signal) => GET /returns/{id}/records`.
- `decideCancellation(id, decision, rejectReason)` gửi `{ rejectReason }` khi reject.
- Xóa `createVoucher`. `syncVouchers` giữ nguyên, không thêm `title` (bản tối thiểu, mục 5.5).
- `settlements`: trả thêm `estimated` và `source`.

### Bước 2. Hoàn trả (`TiktokReturns.jsx`)
- Thêm helper `refundTotal(r) = r?.refund_amount?.refund_total ?? r?.refund_amount`, để vẫn chạy khi gặp số scalar cũ. Dùng ở 3 chỗ.
- Trong dialog chi tiết, thêm bảng **"Processing history"** từ `returnRecords`, các cột `Time`, `Role`, `Event`, `Details` (`description`/`note`/`reason_text`).
- Bộ lọc trạng thái lấy từ `aftersaleReasons().returnStatuses`, giống `TiktokCancellations.jsx:35`. Hằng số hiện tại giữ làm fallback.

### Bước 3. Đơn, vận chuyển, hủy (`ShopeeOrders.jsx`)
- Nút hủy TikTok chỉ hiện khi đơn `UNPAID` hoặc `AWAITING_SHIPMENT`.
- Dialog giao hàng có hai ô chọn tách riêng: `Shipping service` (`shippingServiceId`) và `Handover method` (`PICKUP`/`DROP_OFF`).
- Tải tem: chỉ một nút, bỏ ô chọn loại tem (mục 5.1).
- Dialog escrow TikTok: giữ nguyên khung, chỉ thay 0 ₫ bằng "Not available" cho giá trị null (bản tối thiểu, mục 5.2).
- Màn đơn đọc nguồn từ `?source=` trên URL (mục 5.4).

### Bước 4. Tài chính (`TiktokSettlements.jsx`): bản tối thiểu
- Chỉ đổi chữ và thêm badge "Estimated", giữ nguyên bố cục, cột và phân trang (mục 5.5).
- **Giữ chặn STAFF** như hiện tại. Ghi chú cho backend cân nhắc siết quyền.

### Bước 5. Voucher (`TiktokVouchers.jsx`): bản tối thiểu
- Chỉ ẩn nút "Create voucher" và bỏ dialog tạo. Nút "Sync vouchers" giữ nguyên (mục 5.5).

### Bước 6. Catalog và sản phẩm
- `TiktokCatalog.jsx`: ô giá đặt `step=1`, chặn số lẻ trước khi gửi.
- `ProductsPage.jsx:236`: sửa thông báo (mục 5.3).

### Bước 7. Hủy đơn của khách (`TiktokCancellations.jsx`)
- Khi từ chối, mở hộp chọn lý do từ `rejectReasons(id)`, giống luồng reject hoàn trả.

### Bước 8. Màn kết nối (`ShopeeConnection.jsx`)
- Hiện số quyền đã cấp và link "View orders" cho TikTok (mục 5.4).

### Bước 9. Tài liệu
- Viết lại `docs/TIKTOK_API_CONTRACT.md` theo `origin/develop` @ `f9495df` (nội dung bảng mục 1).
- Cập nhật mục TikTok trong `docs/BE_API_INVENTORY.md`.
- Xóa các "hạn chế BE" đã được sửa. Giữ lại hai mục backend chưa có.
- Ghi rõ hai đường import và vai trò của `/tiktok/connect` (mục 5.3).

## 4. Kiểm thử

**Mock test (Playwright):** `npm run test:api`. Sửa mock trong các file sau cho khớp backend:
- `tests/api-tiktok-returns.spec.js`
  - `refund_amount` đổi thành object.
  - Thêm mock `/records` và kiểm tra bảng "Processing history".
- `tests/api-tiktok-finance.spec.js`
  - Settlement có `estimated`/`source`. Assert tiêu đề, badge "Estimated" và dòng chú thích.
  - Escrow có field null. Bỏ test "negative net escrow". Assert các dòng null hiện "Not available" và có dòng chú thích phí sàn (mục 5.2).
  - Giữ test chặn STAFF.
- `tests/api-tiktok.spec.js`
  - `shipping-providers` trả mảng provider, không còn `{documentTypes}`.
  - Tải tem gửi `documentType=SHIPPING_LABEL`.
  - Bỏ hack `shippingServiceId:'DROP_OFF'` và kiểm tra ô chọn `Handover method`.
  - Số nút hủy là 2: không có `ON_HOLD`.
- Thêm spec mới:
  - Voucher: không có nút "Create voucher", nút "Sync vouchers" vẫn chạy.
  - Cancellations: reject gửi lý do.
  - Catalog: chặn giá lẻ.
  - Màn kết nối TikTok: hiện số quyền, cảnh báo khi rỗng, link đơn có `?source=tiktok`.
  - Màn đơn mở đúng nguồn từ URL.

Chạy thêm `npm run lint` và `npm run build`.

**Smoke test local:**
1. Pull `develop` của `SmartOmni_Platform`, chạy gateway, integration service và TikTok Simulator.
2. Chạy `npm run dev` (cổng 5174).
3. Đăng nhập Owner, kết nối TikTok qua Simulator, rồi thử từng màn:
   - Đơn: sync, giao hàng `PICKUP`/`DROP_OFF`, tải tem.
   - Hủy đơn.
   - Duyệt hoặc từ chối hoàn trả, xem lịch sử xử lý.
   - Escrow breakdown hiện "Not available" cho phí null.
   - TikTok settlements có badge "Estimated".
   - Vouchers không còn nút tạo, sync vẫn chạy.
   - Sửa giá/tồn.
   - Đi từ màn kết nối sang đơn TikTok bằng link "View orders".
4. Đăng nhập Staff để kiểm tra màn đối soát vẫn bị chặn.

## 5. Giải pháp cho các điểm từng còn bỏ ngỏ

Các điểm này đã được đối chiếu với cách Shopee đang nối, trên code FE và backend `origin/develop`.

### 5.1. Loại tem vận đơn: làm giống Shopee, chỉ một nút

**Đối chiếu:**
- Shopee chỉ có một nút tải AWB, không có ô chọn loại tem. Backend Shopee không nhận tham số loại tem.
- Backend TikTok dồn mọi giá trị về `SHIPPING_LABEL` (`normalizeDocumentType` trong `TiktokFulfillmentClient`).

**Giải pháp:**
- `tiktok.js`:
  - Xóa `shippingDocumentTypes`.
  - `shippingLabel` luôn gửi `documentType: 'SHIPPING_LABEL'` (gửi `packageId`, không có thì gửi `orderId`).
  - Giữ xử lý lỗi `SHIPPING_LABEL_UNAVAILABLE`. Bỏ nhánh kiểm tra `status === 200`, vì backend giờ trả 502.
- `ShopeeOrders.jsx`:
  - Dialog `tiktok-label` bỏ ô chọn "Label type" (dòng 231) và lệnh gọi ở dòng 191.
  - Chỉ còn nút **"Download shipping label"**. Có thể bỏ hẳn dialog, bấm nút trong bảng là tải luôn như AWB của Shopee.
- Nếu sau này cần `PACKING_SLIP`, chỉ cần thêm một nút, backend không phải sửa.

### 5.2. Escrow: bản tối thiểu, giữ dialog "Escrow breakdown"

**Đối chiếu:**
- Shopee có số escrow thật: tạm tính, người mua trả, trợ giá ship, phí hoa hồng/giao dịch/dịch vụ, phí ship hoàn, tiền hoàn, Net escrow.
- TikTok không có API statement. `TiktokEscrowDetail` chỉ có giá đơn, các phí (`commissionFee`, `serviceFee`, `transactionFee`, `refundAmount`) và `escrowAmount` luôn null. Hiện FE dùng `money(null)` nên hiện 0 ₫, sai nghĩa.

**Giải pháp (`TiktokEscrow` trong `ShopeeOrders.jsx` ~168-174):**
- **Giữ nguyên** nút "View escrow", tiêu đề "Escrow breakdown", danh sách dòng và thứ tự dòng.
- Thêm helper `amountOrUnknown = value => value == null ? 'Not available' : money(value)`. Dùng thay `money(value)` cho mọi dòng trong danh sách.
- Dòng "Net escrow": hiện `amountOrUnknown(escrow.escrowAmount)`. Chỉ tô đỏ (`styles.error`) khi có giá trị và âm.
- **Phí sàn:** nếu `commissionFee`, `serviceFee`, `transactionFee` và `escrowAmount` đều null, thêm một dòng chú thích dưới danh sách:
  > **"Platform fees and net payout: not provided by TikTok via API."**
- "Payment method" và "Currency" đã hiện "—" khi trống, giữ nguyên.
- **Không làm** ở bản này: đổi tên dialog, bảng tổng theo `order`, bảng `lineItems`. Để làm sau nếu cần.

### 5.3. Import/sync và `POST /tiktok/connect`

**Import/sync: giữ nguyên.**
- Màn Import và Price sync có `?marketplace=tiktok-shop` đã gọi đúng `importProducts`, `importRuns`, `syncWarehouses`, `syncPrices` của TikTok, qua `marketplaces.js` → `ShopeeCatalog.jsx`.
- Dữ liệu trả về giống Shopee (`ImportReport`, `Result` của price sync), và cả hai đường import đều chặn giới hạn SKU theo gói.

**Dọn chỗ trùng:**
- `tiktok.js`: gộp hai khóa `autoImport` thành `autoImport: shopId => request(catalogBase + '/auto-import', { method: 'POST', params: shopId ? { shopId } : undefined })`.
- `ProductsPage.jsx:236`: thông báo đổi thành `` `TikTok Shop import ${status}: ${importedCount} imported, ${linkedExistingCount} linked, ${skippedCount} skipped.` ``. Nếu `status === 'STOPPED_SKU_LIMIT'` thì thêm `" Plan SKU limit reached."`. Cách đọc field giống `TiktokCatalog.jsx:17`.
- Ghi vào tài liệu:
  - `/products/products/import`: nhập đầy đủ, có lịch sử chạy, dùng cho màn Import như Shopee.
  - `/catalog/auto-import`: luồng WF-01, chạy nhanh từ màn Catalog/Products.

**`POST /tiktok/connect`: không nối.**
- Endpoint này:
  - Kiểm tra giới hạn số kết nối theo gói.
  - Có `code` thì xử lý như callback.
  - Backend đã cấu hình OAuth và không có `shopId` thì giống `/authorization`.
  - Còn lại thì **liên kết shop trực tiếp, bỏ qua OAuth**: lối tắt dev/demo.
- FE giữ luồng OAuth `/authorization` và `/callback` như Shopee. Hai endpoint này đã kiểm tra giới hạn gói.
- Đề xuất cho backend (FE không làm): chặn nhánh liên kết trực tiếp ở production, ví dụ bằng cờ cấu hình.

### 5.4. Màn kết nối shop (`ShopeeConnection.jsx`)

**Đối chiếu:**
- `TiktokConnectionDto` và `ShopeeConnectionDto` gần như giống nhau. Shopee có `autoImportProducts`. TikTok có `sellerType` và `grantedScopes`. Cả hai có `refreshTokenExpiresAt`.
- Màn dùng chung hiện tên shop, trạng thái, `needsReconnect`, lỗi gần nhất, ngày kết nối và hạn token. FE không hiện `refreshTokenExpiresAt` cho cả Shopee.

**Giải pháp:**
- **Quyền đã cấp (chỉ TikTok):** trong ô "Status", khi `provider === 'tiktok-shop'`:
  - `grantedScopes?.length` > 0: hiện **"N scopes granted"**, di chuột vào (`title`) thì hiện danh sách.
  - `grantedScopes` rỗng hoặc null: hiện cảnh báo **"Granted scopes are unknown. If an action fails with a permission error, reconnect the shop."**

  Backend coi scope thiếu là "không biết", nên chỉ cảnh báo, không chặn thao tác.
- **Không hiện** `refreshTokenExpiresAt` và `sellerType`, để giống Shopee.
- **Link "View orders" cho TikTok:**
  - `ShopeeOrders.jsx:32`: `const [source, setSource] = useState(() => ['local', 'shopee', 'tiktok'].includes(searchParams.get('source')) ? searchParams.get('source') : 'local')`, dùng `useSearchParams`. Kiểm tra lại value của option Shopee trong ô chọn nguồn (dòng 67) cho khớp.
  - `ShopeeConnection.jsx:51`: bỏ điều kiện chỉ Shopee, link tới `/merchant/staff/orders?source=${provider === 'shopee' ? 'shopee' : 'tiktok'}`.
- **Auto-import (`PATCH /settings`):** giữ như đã chốt. Ô bật/tắt chỉ hiện cho Shopee, TikTok không có field này nên không sửa gì.

### 5.5. Settlements và Vouchers: bản tối thiểu

Hai màn này giữ nguyên bố cục, chỉ sửa những chỗ đang sai nghĩa hoặc đang hỏng.

**Settlements (`TiktokSettlements.jsx`):**
- **Đối chiếu:** backend giờ trả số **ước tính** từ đơn COMPLETED (`estimated=true`, `source=ESTIMATED_FROM_ORDERS`). Mỗi dòng là một đơn: `statementId` là mã đơn, `status` là `ESTIMATED`, `paidTime` là null. FE vẫn gọi là "statement".
- **Giải pháp, chỉ đổi chữ:**
  - Giữ tiêu đề panel "TikTok settlements". Khi `estimated` thì thêm badge **"Estimated"** cạnh tiêu đề, dùng class badge có sẵn trong `OwnerWorkspace.module.css` nếu có, không thì dùng `<strong>`.
  - Khi `source === 'ESTIMATED_FROM_ORDERS'`, thêm một dòng chú thích dưới bộ lọc: **"Estimated from completed orders. TikTok does not provide settlement statements via API."**
  - Nhãn bảng `"TikTok settlement statements"` → **`"TikTok estimated settlements"`**. Cột `'Statement'` → **`'Order ID'`**.
  - Chữ phân trang `` `${total} statements` `` → **`` `${total} orders` ``**.
- **Giữ nguyên:** các cột còn lại ("Statement time", "Amount", "Status", "Paid time"). "Paid time" null đã hiện "—" nhờ `dateTime`. Phân trang giữ nguyên: backend trả `nextPageToken` null nên nút "Next page" tự tắt.
- **Không làm** ở bản này: khối tổng từ `totals`, bỏ phân trang, bỏ cột.

**Vouchers (`TiktokVouchers.jsx`):**
- **Đối chiếu:** `POST /vouchers` luôn trả 501 `TIKTOK_VOUCHER_CREATE_UNSUPPORTED`, nên nút "Create voucher" luôn lỗi.
- **Giải pháp, chỉ ẩn nút:**
  - Xóa nút "Create voucher", state `creating`/`created` và component `VoucherDialog`.
  - Xóa các import không còn dùng (`useRef`, `Dialog*`, `newIdempotencyKey`…) để `npm run lint` sạch.
  - Nút "Sync vouchers" và bảng voucher giữ nguyên.
- **Không làm** ở bản này: ô "Batch title", sync theo `title`, dòng hướng dẫn tạo trên Seller Center.
