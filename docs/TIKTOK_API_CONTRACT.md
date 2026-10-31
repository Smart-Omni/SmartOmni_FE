# Hợp đồng API TikTok Shop (đơn, giao hàng, hủy, hoàn trả, tài chính, giá/tồn)

Đọc từ source **SmartOmni_BE nhánh `develop` ngày 31/10/2026** (commit `8a557bf`): controller trong `smartomni-service-integration/.../controller/Tiktok*Controller.java` và DTO trong `.../dto/tiktok/`, `.../client/tiktok/TiktokFinanceClient.java`. Chưa gọi thử API live. Khi BE đổi code, cần đối chiếu lại.

Phần **kết nối** (`/api/marketplace-connections/tiktok-shop`, authorization/callback/disconnect) và **import/đồng bộ giá/kho** đã nối FE, xem `BE_API_INVENTORY.md`. File này chỉ mô tả các endpoint FE **chưa nối**.

## Quy ước chung

- **Đường dẫn:** mỗi controller nhận 3 prefix tương đương. FE nên dùng prefix `/api/marketplace-connections/tiktok/...` cho đồng bộ với Shopee. Nginx đã route cả `/api/tiktok/` và `/api/marketplace-connections/`.

  | Nhóm | Prefix FE nên dùng | Alias |
  |---|---|---|
  | Đơn | `/api/marketplace-connections/tiktok/orders` | `/api/tiktok/orders`, `/api/v1/tiktok/orders` |
  | Giao hàng | `/api/marketplace-connections/tiktok/logistics` | `/api/tiktok/logistics` |
  | Hủy đơn | `/api/marketplace-connections/tiktok/cancellations` | `/api/tiktok/cancellations` |
  | Hoàn trả | `/api/marketplace-connections/tiktok/returns` | `/api/tiktok/returns` |
  | Tài chính | `/api/marketplace-connections/tiktok/finance` | `/api/tiktok/finance` |
  | Giá/tồn 1 SKU | `/api/marketplace-connections/tiktok-shop` (chú ý: `tiktok-shop`) | `/api/tiktok/products` |

- **Quyền:** `TENANT_ADMIN`, `ADMIN`, `MANAGER`, `STAFF` (Owner và Staff trên FE). Header `Authorization: Bearer <JWT>`.
- **Không cần gửi `shopId`:** BE tự lấy kết nối TikTok của tenant từ JWT. Một số body có trường `shopId` nhưng BE **không dùng**; gửi hay không đều được.
- **Envelope:** `{ "success": true, "message": "...", "data": ..., "timestamp": "..." }`. Riêng tải tem trả PDF nhị phân.
- **Tên trường:** DTO đơn/gói/hoàn trả dùng **snake_case** (`order_id`, `order_status`…). DTO tài chính và kết quả thao tác dùng **camelCase** (`escrowAmount`, `canceled`…).
- **Ví dụ JSON:** tên trường lấy đúng từ DTO của BE; **giá trị** chỉ là minh họa (một số mã trạng thái/lý do theo TikTok Open API), không phải dữ liệu thật.
- **Thời gian:** các trường `*_time`, `fromDate`, `toDate`, `createTimeFrom/To` là **Unix giây** (Long).
- **Lỗi thường gặp** (body `{ success: false, message }`, **chưa có `errorCode`**, phân biệt bằng HTTP status):

  | HTTP | message | Khi nào | FE nên |
  |---|---|---|---|
  | 409 | `TikTok Shop is not connected` | Tenant chưa kết nối TikTok | Hiện thông báo + nút tới `/merchant/shops?marketplace=tiktok-shop` |
  | 403 | `Only Tenant Admin, Manager, or Staff can access TikTok operations` | Role khác (CUSTOMER…) | Ẩn chức năng |
  | 401 | `Authentication required` | Hết phiên | Client đã tự refresh |
  | 4xx/5xx khác | lỗi từ TikTok API | TikTok từ chối | Hiện `message` |

---

## 1. Đơn hàng

### 1.1. GET `/api/marketplace-connections/tiktok/orders`

Danh sách đơn lấy **trực tiếp từ TikTok** (không phải đơn đã lưu trong SmartOmni).

Query (đều tùy chọn):

| Tham số | Kiểu | Mặc định | Ghi chú |
|---|---|---|---|
| `orderStatus` | string | — | Trạng thái TikTok, ví dụ `UNPAID`, `ON_HOLD`, `AWAITING_SHIPMENT`, `AWAITING_COLLECTION`, `IN_TRANSIT`, `DELIVERED`, `COMPLETED`, `CANCELLED` (các giá trị BE đang xử lý trong `TiktokOrderStatusMapper`) |
| `createTimeFrom`, `createTimeTo` | Long (giây) | — | Lọc theo ngày tạo |
| `pageSize` | int | 20 | |
| `pageToken` | string | — | Lấy từ `next_page_token` của trang trước |
| `orderId` | string | — | ⚠️ BE nhận nhưng **không dùng** (xem mục 8) |

Response `data`:

```json
{
  "next_page_token": "abc123",
  "total_count": 42,
  "orders": [ /* TiktokOrder, xem 1.2 */ ],
  "order_list": null
}
```

FE đọc `orders ?? order_list ?? []`. Phân trang kiểu con trỏ: có `next_page_token` thì hiện nút "Trang sau", không có số trang.

### 1.2. GET `/api/marketplace-connections/tiktok/orders/{orderId}`

Chi tiết một đơn. `data` là **mảng** (thường 1 phần tử): đọc `data[0]`.

`TiktokOrder`:

```json
{
  "order_id": "576461413038785752",
  "order_status": "AWAITING_SHIPMENT",
  "buyer_user_id": "7494...",
  "buyer_email": "buyer@example.test",
  "create_time": 1761800000,
  "update_time": 1761803600,
  "paid_time": 1761800100,
  "cancel_reason": null,
  "cancel_user": null,
  "tracking_number": null,
  "shipping_provider": null,
  "shipping_type": "TIKTOK",
  "fulfillment_type": "FULFILLMENT_BY_SELLER",
  "package_id": "1152...",
  "package_list": [ { "package_id": "1152...", "package_status": "TO_FULFILL" } ],
  "payment": {
    "currency": "VND",
    "sub_total": 450000, "shipping_fee": 15000,
    "seller_discount": 0, "platform_discount": 20000,
    "total_amount": 445000, "original_total_product_price": 450000, "tax": 0
  },
  "recipient_address": {
    "name": "Nguyễn Văn A", "phone_number": "(+84)90*****67",
    "full_address": "...", "address_line1": "...", "address_line2": "",
    "city": "...", "state": "...", "district": "...", "postal_code": "", "region_code": "VN"
  },
  "line_items": [
    {
      "id": "5770...", "product_id": "1729...", "product_name": "Áo thun",
      "sku_id": "1729...", "seller_sku": "AT-RED-M", "sku_name": "Đỏ, M", "sku_image": "https://...",
      "quantity": 1, "sale_price": 150000, "original_price": 180000,
      "package_id": "1152...", "package_status": "TO_FULFILL"
    }
  ]
}
```

`package_id` (hoặc `package_list[0].package_id`) cần cho giao hàng và tải tem.

### 1.3. POST `/api/marketplace-connections/tiktok/orders/sync`

Body:

```json
{ "fromDate": 1761600000, "toDate": 1761800000 }
```

Response: `message: "Orders synced successfully"`, `data` cùng dạng 1.1 (tối đa 50 đơn).

⚠️ Theo code hiện tại, endpoint này **chỉ đọc lại danh sách đơn từ TikTok**, không ghi đơn vào SmartOmni (đơn vào SmartOmni qua webhook/polling của BE). FE hiển thị "Đã lấy N đơn từ TikTok" và tải lại danh sách, không khẳng định đã lưu vào `/api/orders`.

---

## 2. Giao hàng

### 2.1. GET `/api/marketplace-connections/tiktok/logistics/shipping-providers`

Response `data`:

```json
{ "connectionId": 12, "platform": "TIKTOK_SHOP", "shopId": null, "documentTypes": ["SL_PDF", "WAYBILL_PDF"] }
```

⚠️ Hiện **chỉ trả loại tài liệu tem** (`documentTypes`), chưa trả danh sách đơn vị vận chuyển thật. FE dùng để cho chọn loại tem khi tải; không làm ô chọn đơn vị vận chuyển.

### 2.2. POST `/api/marketplace-connections/tiktok/logistics/ship-package`

Body:

```json
{ "orderId": "576461413038785752", "packageId": "1152..." }
```

`packageId` **bắt buộc** về mặt nghiệp vụ (lấy từ chi tiết đơn). `shippingServiceId` có trong DTO nhưng BE **không dùng**.

Response `data` (`TiktokPackage`):

```json
{
  "package_id": "1152...", "tracking_number": "VN123...", "shipping_provider_name": "J&T Express",
  "shipping_provider_id": "...", "status": "...", "package_status": "PROCESSING",
  "order_id_list": ["5764..."], "shipping_type": "TIKTOK", "delivery_option_name": "Standard",
  "create_time": 1761800000, "update_time": 1761803600
}
```

Hiện nút "Xác nhận giao" khi `order_status` là `AWAITING_SHIPMENT`.

### 2.3. GET `/api/marketplace-connections/tiktok/logistics/shipping-label/download`

Query: `packageId` (ưu tiên) hoặc `orderId`; `documentType` = `SL_PDF` (mặc định) hoặc `WAYBILL_PDF`.

Response: `Content-Type: application/pdf`, nhị phân. Gọi như `shopeeApi.awb` (`{ blob: true }`).

⚠️ Khi BE không tải được tem từ TikTok, nó **vẫn trả HTTP 200 với body rỗng**. FE phải kiểm tra `blob.size === 0` và báo "Chưa lấy được tem vận đơn, thử lại sau", không tải về file rỗng.

---

## 3. Hủy đơn

### 3.1. POST `/api/marketplace-connections/tiktok/cancellations/cancel` (shop hủy đơn)

Body:

```json
{ "orderId": "576461413038785752", "cancelReason": "OUT_OF_STOCK" }
```

`cancelReason` là mã lý do của TikTok (FE cho chọn: hết hàng / khách yêu cầu…, gửi mã tương ứng).

Response `data`: `{ "orderId": "5764...", "canceled": true }`. Nếu `canceled === false` thì báo TikTok không chấp nhận (giống xử lý Shopee).

### 3.2. POST `.../cancellations/{cancelId}/approve` (đồng ý yêu cầu hủy của khách)

Không có body. Response `data`: `{ "cancelId": "...", "approved": true }`.

### 3.3. POST `.../cancellations/{cancelId}/reject` (từ chối yêu cầu hủy)

Body (tùy chọn): `{ "rejectReason": "..." }`. Thiếu thì BE dùng `REJECTED_BY_SELLER`.
Response `data`: `{ "cancelId": "...", "rejected": true }`.

⚠️ Chưa có API **liệt kê** yêu cầu hủy của khách, nên FE chưa biết `cancelId`. Tạm thời chỉ làm 3.1; 3.2/3.3 cần BE bổ sung API danh sách (mục 8).

---

## 4. Hoàn/trả

### 4.1. GET `/api/marketplace-connections/tiktok/returns`

Query (tùy chọn): `status` (trạng thái trả của TikTok), `orderId`, `pageSize` (20), `pageToken`.

Response `data`:

```json
{ "next_page_token": "...", "total_count": 3, "returns": [ /* TiktokReturn */ ], "return_list": null }
```

FE đọc `returns ?? return_list ?? []`.

### 4.2. GET `.../returns/{returnId}`

Response `data` (`TiktokReturn`):

```json
{
  "return_id": "4035...", "order_id": "5764...",
  "return_status": "RETURN_OR_REFUND_REQUEST_PENDING",
  "return_type": "RETURN_AND_REFUND", "return_role": "BUYER",
  "return_reason": "ecom_order_delivered_refund_and_return_reason_wrong_item",
  "return_reason_text": "Giao sai hàng",
  "tracking_number": null, "return_tracking_number": null,
  "refund_amount": 150000, "refund_currency": "VND",
  "create_time": 1761800000, "update_time": 1761803600,
  "return_line_items": [
    { "return_item_id": "...", "order_line_item_id": "...", "product_id": "...", "sku_id": "...",
      "seller_sku": "AT-RED-M", "quantity": 1, "refund_amount": 150000 }
  ]
}
```

### 4.3. POST `.../returns/{returnId}/approve`

Không có body. Response `data`: `{ "returnId": "...", "approved": true }`.

### 4.4. POST `.../returns/{returnId}/reject`

Body (tùy chọn): `{ "rejectReason": "..." }` (mặc định `REJECTED_BY_SELLER`).
Response `data`: `{ "returnId": "...", "rejected": true }`.

Gợi ý UI: màn Hoàn trả thêm chọn sàn; với TikTok, nút "Đồng ý"/"Từ chối" chỉ hiện khi trạng thái đang chờ người bán xử lý. Từ chối nên hỏi lý do và xác nhận trước khi gửi.

---

## 5. Tài chính

### 5.1. GET `/api/marketplace-connections/tiktok/finance/escrow/{orderId}`

Response `data` (camelCase):

```json
{
  "orderId": "5764...", "escrowAmount": 398000, "buyerTotalAmount": 445000,
  "orderOriginalPrice": 450000, "platformDiscount": 20000, "sellerDiscount": 0,
  "commissionFee": 22500, "serviceFee": 9000, "transactionFee": 4500,
  "shippingFee": 15000, "refundAmount": 0, "currency": "VND", "paymentMethod": "COD"
}
```

Hiển thị như hộp thoại "Escrow breakdown" của Shopee.

### 5.2. GET `/api/marketplace-connections/tiktok/finance/settlements`

Query (tùy chọn): `fromDate`, `toDate` (giây), `pageSize` (20), `pageToken`.

Response `data`:

```json
{
  "settlements": [
    { "statementId": "...", "statementTime": 1761800000, "settlementAmount": 12500000,
      "currency": "VND", "status": "PAID", "paidTime": 1761900000 }
  ],
  "nextPageToken": "...",
  "total": 12
}
```

---

## 6. Sửa giá / tồn một SKU lên TikTok

### 6.1. PUT `/api/marketplace-connections/tiktok-shop/stock`

Body: `{ "productId": "1729...", "skuId": "1729...", "quantity": 25 }` (id là id **của TikTok**, lấy từ import/catalog mapping).
Response `data`: `{ "productId": "...", "skuId": "...", "quantity": 25 }`.

### 6.2. PUT `/api/marketplace-connections/tiktok-shop/price`

Body: `{ "productId": "...", "skuId": "...", "originalPrice": 180000, "salePrice": 150000 }`.
Response `data`: `{ "productId": "...", "skuId": "...", "price": 180000 }`.

Lưu ý nghiệp vụ: đồng bộ giá hàng loạt (`POST .../prices/sync`) có chặn biến động giá > 50% (FR-092); hai API sửa từng SKU này **không có** kiểm tra đó, nên FE cần hộp xác nhận khi giá mới lệch > 50% giá cũ.

---

## 7. Hoàn tiền nội bộ SmartOmni (không phải TikTok)

### 7.1. POST `/api/returns`

Body: `{ "orderId": 501, "reason": "Khách trả hàng" }` (`orderId` là id **nội bộ** trong `/api/orders`, `reason` bắt buộc).
Response `data`: `{ "id": 9, "orderId": 501, "triggerType": "CUSTOMER_REQUEST", "reason": "...", "status": "REQUESTED", "restocked": false }`.

### 7.2. POST `/api/returns/{refundId}/approve`

Duyệt và cộng trả tồn kho. Response `data` như 7.1 với `status: "APPROVED"`, `restocked: true`.

⚠️ Chưa có API **liệt kê** yêu cầu hoàn tiền nội bộ: FE chỉ duyệt được yêu cầu vừa tạo trong phiên (giữ `id` trả về từ 7.1).

---

## 8. Hạn chế phía BE (gửi team BE, FE không tự sửa)

1. `GET .../tiktok/orders`: tham số `orderId` được nhận nhưng không truyền xuống TikTok.
2. `POST .../tiktok/orders/sync`: chỉ đọc danh sách, không ghi đơn vào SmartOmni; `shopId` không dùng.
3. `GET .../logistics/shipping-providers`: chưa trả đơn vị vận chuyển thật.
4. `POST .../logistics/ship-package`: bỏ qua `shippingServiceId`.
5. `GET .../logistics/shipping-label/download`: lỗi vẫn trả 200 + body rỗng; nên trả 4xx/5xx có message.
6. Thiếu API liệt kê yêu cầu hủy của khách (để có `cancelId`) và yêu cầu hoàn tiền nội bộ.
7. Body lỗi chưa có `errorCode` (`BusinessException` đã có `TIKTOK_NOT_CONNECTED`, `CATALOG_SYNC_FORBIDDEN` nhưng `GlobalExceptionHandler` không gửi ra).
8. Chưa có API liệt kê catalog/mapping SKU TikTok (productId, skuId của TikTok theo SKU nội bộ), nên FE chưa làm sửa giá/tồn từng SKU (mục 6).
9. Chưa có API đọc giá hiện tại của SKU trên TikTok để FE kiểm tra lệch giá > 50% trước khi sửa.
