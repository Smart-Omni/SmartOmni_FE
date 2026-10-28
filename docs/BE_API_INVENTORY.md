# API hiện có trên SmartOmni_BE develop

Đối chiếu controller và implementation trong `D:\SmartOmni_BE` ngày 28/10/2026. Chỉ kiểm tra source; không sửa BE. Base URL chạy local: `http://127.0.0.1:8080`. FE Vite proxy `/api` tới gateway.

“Có endpoint” nghĩa là tìm thấy mapping trong controller đang build. Không đồng nghĩa mọi nghiệp vụ đã hoàn chỉnh hoặc đã kiểm thử live. Các TODO/giới hạn đã thấy được ghi bên dưới. Không dùng đường dẫn chỉ xuất hiện trong Nginx như bằng chứng rằng API đã có controller.

## Auth — đã nối FE

Base: `/api/v1/auth` hoặc alias `/api/auth`.

- `POST /login`: email/password và tùy chọn subdomain/tenant_id → access_token, refresh_token, user_info.
- `POST /refresh`: refresh_token → phiên JWT mới.
- `POST /logout`: thu hồi access token/refresh token.
- `POST /forgot-password`: tạo token đặt lại mật khẩu trong DB nếu có user.
- `POST /reset-password`: token/newPassword → đổi mật khẩu.

Chưa có đăng ký user (`/register`), xác minh email, Google login, API đọc/sửa profile user hoặc đổi mật khẩu khi đang đăng nhập. Onboarding tenant không thay thế đăng ký user. `forgotPassword()` hiện không gọi dịch vụ gửi email, nên chưa có luồng nhận mail reset hoàn chỉnh. Login cần user có sẵn trong database; không giới hạn chỉ tài khoản local, nhưng tài khoản khác phải được provision trong DB trước.

Nguồn: `smartomni-service-auth/.../controller/AuthController.java`, `.../service/impl/AuthServiceImpl.java`.

## Tenant và storefront — đã nối hồ sơ storefront và settings

Base: `/api/v1/tenants` hoặc alias `/api/tenants`.

- `GET /check-subdomain?subdomain=...`: kiểm tra subdomain.
- `GET /public/by-subdomain/{subdomain}`: cấu hình storefront công khai của một tenant.
- `POST /onboarding`: tạo tenant và gói theo request.
- `GET /me`: hồ sơ tenant hiện tại.
- `PUT /storefront`: cập nhật tên shop, logo, banner, màu, điện thoại, địa chỉ.
- `GET ?keyword=...&page=0&size=20`: danh sách tenant có phân trang.
- `POST /{tenantId}/lock`: khóa tenant, body có reason.
- `POST /{tenantId}/unlock`: mở khóa tenant.
- `GET /{tenantId}/status`: kiểm tra tenant đang active.

Giới hạn: onboarding có trường adminPassword trong DTO nhưng implementation hiện không tạo user/password hash; một số thông tin contact/storefront được giữ trong Map bộ nhớ của TenantService, cần kiểm chứng persistence trước khi coi là cấu hình lưu bền vững. Không có API public liệt kê toàn bộ shop.

FE hiện đã gọi public/by-subdomain, me và PUT storefront. Smoke test xác nhận guest hiện nhận 404 do RLS; Owner của đúng tenant xem được bằng JWT trong chế độ workspace preview. FE không sửa/bypass policy BE. Các API onboarding và quản trị tenant còn lại chưa nối.

Nguồn: `smartomni-service-tenant/.../controller/TenantController.java`, `.../service/impl/TenantServiceImpl.java`.

## Sản phẩm nội bộ — chưa nối FE

Base: `/api/products`.

- `POST /`: tạo sản phẩm và SKU, payload name/description/skus.
- `GET /{productId}`: đọc một sản phẩm theo ID.
- `GET /{productId}/skus`: đọc SKU của sản phẩm.

Chưa có GET danh sách/tìm kiếm sản phẩm, cập nhật/xóa sản phẩm, upload ảnh hoặc danh sách sản phẩm công khai cho storefront. ProductService còn TODO kiểm tra giới hạn SKU khi tạo trực tiếp. Import sản phẩm Shopee đi qua API integration riêng.

Nguồn: `smartomni-service-catalog/.../controller/ProductController.java`.

## Tồn kho — chưa nối FE

Base: `/api/inventory`.

- `POST /{skuId}/adjust?quantity=...`: đặt tồn kho về số lượng mới, không phải cộng delta.
- `POST /{skuId}/deduct?quantity=...`: trừ tồn.
- `POST /{skuId}/restock?quantity=...`: cộng trả tồn.

Chưa có GET danh sách/chi tiết tồn kho hoặc API lịch sử điều chỉnh. Outbox còn TODO lấy đầy đủ các platform liên kết, hiện có đoạn tạo event Shopee cố định. Không gọi deduct/restock từ FE để thay thế luồng xử lý đơn nền; cần tránh thực hiện nghiệp vụ trùng.

Nguồn: `smartomni-service-inventory/.../controller/InventoryController.java`, `.../service/InventoryService.java`.

## Đơn hàng và hoàn trả nội bộ — FE đã nối danh sách đơn

- `GET /api/orders?page=0&size=20`: danh sách đơn tenant.
- `PATCH /api/orders/{orderId}/status?status=...`: cập nhật trạng thái theo logic service hiện có.
- `PATCH /api/orders/tracking`: cập nhật tracking.
- `POST /api/orders/returns`: xử lý hoàn/trả theo ProcessReturnRequest.
- `GET /api/orders/track?platform=...&orderId=...`: tra cứu đơn; không mặc định coi là public chỉ vì comment controller ghi public, cần đối chiếu security hiện tại.
- `POST /api/returns`: tạo yêu cầu hoàn/hủy.
- `POST /api/returns/{refundId}/approve`: duyệt hoàn trả.

Chưa có mapping `/api/v1/orders` trong OrderController; dùng `/api/orders`. List nhận Pageable, chưa có query filter platform/status trong controller. ReturnRefundService còn TODO gọi cộng trả tồn trong luồng approve; không coi luồng đó đã hoàn tất dù tên message có nhắc restock. Các API hoàn/trả này khác với API return trực tiếp trên Shopee bên dưới.

Nguồn: `smartomni-service-order/.../controller/OrderController.java`, `ReturnRefundController.java`, `.../service/ReturnRefundService.java`.

## Shopee — đã có adapter FE

Base: `/api/marketplace-connections/shopee`.

Kết nối shop:

- `GET /`: trạng thái kết nối.
- `POST /authorization`: bắt đầu OAuth.
- `POST /callback`: đổi code/shop_id/state, lưu connection.
- `POST /disconnect`: ngắt kết nối.

Catalog:

- `POST /products/import`: import sản phẩm/SKU.
- `GET /products/import-runs?limit=10`: lịch sử import.
- `POST /warehouses/sync`: đồng bộ kho.
- `POST /prices/sync`: đồng bộ giá/kiểm tra anomaly.

Đơn Shopee:

- `GET /orders?timeFrom=...&timeTo=...&pageSize=20&cursor=...&orderStatus=...`: đọc đơn trực tiếp từ sàn.
- `POST /orders/{orderSn}/sync`: ingest một đơn.
- `POST /orders/batch-sync`: ingest nhiều đơn; có timeFrom/timeTo/orderStatus/pageSize.
- `POST /orders/{orderSn}/cancel`: gửi hủy đơn, body cancelReason.
- `POST /orders/{orderSn}/handle-cancellation`: xử lý buyer cancellation, body operation.

Vận chuyển:

- `GET /logistics/channels`: danh sách kênh vận chuyển.
- `GET /orders/{orderSn}/shipping-parameter`: địa chỉ pickup/time slots/điểm dropoff.
- `POST /orders/{orderSn}/ship`: xác nhận pickup/dropoff.
- `GET /orders/{orderSn}/shipping-document`: PDF vận đơn.

Tài chính và hoàn trả:

- `GET /orders/{orderSn}/escrow`: đối soát tiền/fees.
- `GET /returns?pageNo=1&pageSize=20&status=...`: danh sách return.
- `GET /returns/{returnSn}`: chi tiết/evidence.
- `POST /returns/{returnSn}/confirm`: chấp nhận return/refund.
- `POST /returns/{returnSn}/dispute`: gửi dispute bằng reason ID/text/email/proof URL.

Đã smoke test live: đăng nhập, OAuth/consent/callback, đọc connection, import và đọc history, warehouse sync, price sync, đọc orders/returns. Shipping/PDF/escrow/cancel/refund/dispute đã có adapter và test response mô phỏng theo DTO; chưa thực hiện các thao tác đó trên đơn Simulator thật vì dữ liệu lúc kiểm tra không có đơn/return. Logistics channels có trong adapter nhưng chưa có control riêng sử dụng trên FE.

Giới hạn: order list không trả nextCursor/more dù nhận cursor, chưa thể phân trang toàn bộ sàn qua response hiện tại. Chưa có API upload proof image, danh sách dispute reason, list/approve price anomaly hoặc lịch sử warehouse. Sai khác payload handoff/implementation được ghi trong `API_INTEGRATION.md`.

Nguồn: các `Shopee*Controller.java` trong `smartomni-service-integration`.

## TikTok Shop — có API, chưa nối FE

Base: `/api/marketplace-connections/tiktok-shop`.

- `GET /`: trạng thái kết nối.
- `POST /authorization`: bắt đầu OAuth.
- `POST /callback`: xử lý code/state.
- `POST /disconnect`: ngắt kết nối.
- `POST /products/import`: import sản phẩm.
- `GET /products/import-runs?limit=10`: lịch sử import.
- `POST /warehouses/sync`: đồng bộ kho.
- `POST /prices/sync`: đồng bộ giá.

Cần cấu hình app key/secret, authorization URL và callback TikTok. Không mặc định đã hoạt động vì source có controller. Chưa có các controller tương đương ShopeeOrders/Logistics/Finance/Returns dành cho TikTok trong checkout này.

Có thêm `POST /api/marketplace-connections` cho kết nối marketplace dạng generic; không thay thế OAuth flow.

Nguồn: `TiktokConnectionController.java`, `TiktokCatalogController.java`, `MarketplaceConnectionController.java`.

## AI — có API, chưa nối FE

- `POST /api/ai/forecast/run`: chạy dự báo cho tenant.
- `GET /api/ai/forecast/{skuId}`: đọc dự báo đã lưu.
- `GET /api/ai/recommendations/{skuId}`: đọc cache gợi ý, fallback gọi Python AI.

Cần Python FastAPI riêng khi chạy forecast hoặc khi recommendation cache chưa có. Java AI container chạy không đồng nghĩa mô hình Python đã chạy. Chưa có API chatbot/advisor hội thoại như các màn demo FE.

Nguồn: `smartomni-service-ai/.../controller/DemandForecastController.java`, `RecommendationController.java`.

## API nền, không phải API màn hình FE

- `POST /webhook/{tenantId}/{platform}`: webhook sàn, có xác minh chữ ký.
- `POST /api/v1/integrations/tiktok/webhooks`: webhook TikTok.
- Các `/internal/jobs/*` cho Quartz đồng bộ đơn/giá/outbox bị gateway chặn, không dùng từ FE.
- Auth có endpoint evict session tenant phục vụ tác vụ hệ thống; không đưa thành nút thao tác người dùng thông thường.

## Chưa tìm thấy controller cho các màn FE sau

Đăng ký/xác minh user; Team/invitation/quyền Staff; profile user; Customer loyalty/claim/tier/voucher; quản lý gói dịch vụ/billing/invoice/payment; dashboard doanh thu/lợi nhuận/chi phí; inbox hội thoại/complaint/dispute tổng quát; notification/audit/security log UI; public store directory và public product catalog; chatbot/advisor.

Nginx có một số prefix như `/api/subscription-plans`, `/api/support-tickets`, `/api/promotions` và `/api/price-sync` nhưng không tìm thấy controller tương ứng trong build đang dùng. Các prefix `/api/v1/...` cũng không tự rewrite thành `/api/...`; FE phải dùng mapping thực tế của controller.

Swagger chưa được cài/bật trong BE hiện tại. Có thể dùng danh sách này, controller/DTO và handoff để kiểm tra API mà không chỉnh BE.
