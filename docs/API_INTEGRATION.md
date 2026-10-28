# Chạy FE với backend develop và Shopee Simulator

FE mặc định dùng API. Chạy `npm install` rồi `npm run dev`, mở **http://127.0.0.1:5174/auth/login**. Vite proxy `/api` tới `http://localhost:8080`; backend phải chạy trước. `.env.example` ghi các biến cấu hình. Production cần reverse proxy `/api` tới gateway hoặc đặt `VITE_API_BASE_URL` và cấu hình CORS trên BE.

Backend local ở `D:\SmartOmni_BE`, nhánh `develop`. Chạy `docker compose up -d --build` tại đó. `.env` chứa secret ngẫu nhiên riêng cho local, không commit. Cấu hình Auth trong Compose cần `SPRING_DATA_REDIS_HOST: redis` để login/refresh/logout hoạt động trong container. `SHOPEE_REDIRECT_URI` local phải là `http://127.0.0.1:5174/merchant/channels/shopee/callback`; không đổi qua `localhost` giữa đăng nhập và callback vì sessionStorage tách theo origin.

Database mới không có tài khoản. Một Tenant Owner local đã được provision để kiểm tra; thông tin đăng nhập được lưu ở **`artifacts/local-api-credentials.json`**, là file ignored. Các tài khoản `@smartomni.demo` chỉ hoạt động ở chế độ demo. API onboarding hiện tạo tenant nhưng không tạo user từ `adminPassword`; FE không dùng nó để giả lập đăng ký tài khoản thành công.

## Các luồng đã nối

- Login, refresh JWT một lần khi gặp 401, logout, forgot/reset password. Token lưu trong sessionStorage để phục vụ reload và redirect OAuth trong cùng tab; không lưu mật khẩu. Mật khẩu reset đi qua API thật, việc gửi email phụ thuộc cấu hình BE.
- `/merchant/shops` (alias `/merchant/channels`): đọc trạng thái connection, authorize, redirect Shopee, callback exchange, reconnect, disconnect có bước xác nhận. Trạng thái được tải lại khi tab được focus và mỗi 60 giây. Staff chỉ xem connection; backend kiểm tra quyền mọi thao tác.
- `/merchant/channels/shopee/callback`: xử lý cancel/error/missing params, giữ đường quay về khi cần đăng nhập, gửi code/shop_id/state bằng JWT, chặn effect exchange trùng trong React StrictMode. Thành công quay về shops và đọc lại trạng thái từ BE. Callback lỗi phải bắt đầu một authorization mới; không tự gửi lại code dùng một lần.
- `/merchant/staff/imports` và `/merchant/staff/products`: trigger import, history, counters, item outcomes, SKU limit, lỗi và trạng thái running; refresh history mỗi 5 giây khi đang chạy. Import là request đồng bộ; UI không tạo job giả. Có nút sync warehouse và giá.
- `/merchant/staff/prices`: sync giá và hiển thị các số considered/applied/heldAnomaly/unchanged/rejected/missing do BE trả; `fetchError` hiển thị thành lỗi. Chưa có endpoint để đọc chi tiết/duyệt anomaly hoặc lịch sử warehouse.
- `/merchant/staff/orders`: đơn đã ingest trong SmartOmni có phân trang, tìm/lọc trên trang hiện tại; có nguồn Shopee trực tiếp (tối đa 50), batch/single sync, cancel, xử lý buyer cancellation, pickup/dropoff, tracking/SLA, escrow, tải AWB PDF bằng request có JWT. Backend là nơi quyết định tính hợp lệ của thao tác và xử lý tồn kho.
- `/merchant/staff/returns`: list/detail, buyer evidence, confirm refund có bước xác nhận, dispute bằng reason ID + text + email + proof URL array. API chưa có upload ảnh hoặc danh sách dispute reasons nên UI nhận HTTPS URL và reason ID từ Shopee, không giả vờ upload file.

## Hợp đồng được đối chiếu với code thực tế

Tài liệu nguồn: `D:\SmartOmni_BE\docs\shopee-integration-fe-handoff.md`. Adapter ở `src/services/api/shopee.js` dùng controller trên `develop`, vì một số ví dụ handoff khác với implementation:

- Order Service là **`/api/orders`**, chưa có mapping `/api/v1/orders` hoặc query filter platform/status. Shipping/escrow/returns dùng namespace `/api/marketplace-connections/shopee`.
- Import trả **`runId` + `counters`**; item trả `externalProductId`, `externalSkuId`, `outcome`, `message`. Adapter chuẩn hóa để hiển thị.
- Price sync trả **`considered`, `heldAnomaly`, `unchanged`, `rejected`, `missing`, `fetchError`**, khác `compared`/`anomalies` trong handoff.
- Shipping parameters trả **`pickupAddresses[].timeSlots` / `dropoffBranches`**, không phải `pickup.addressList`.
- Escrow trả `buyerTotalAmount`, `orderOriginalPrice`, `shopeeShippingRebate`, `sellerTransactionFee`, `reverseShippingFee`, `sellerReturnRefund`. Chỉ net escrow được clamp ở mức 0 khi hiển thị.
- Dispute service thực sự sử dụng **`disputeReasonId`**, `disputeTextReason`, `email`, `proofImages`; không chỉ `disputeReason` dạng chuỗi như ví dụ handoff.
- Shopee order list controller không trả `nextCursor`/`more` nên FE ghi rõ giới hạn 50, không giả lập phân trang toàn bộ sàn.

API mode dùng khung portal/token/component hiện có cho các chức năng đã nối. Các trang business/admin/customer chưa có API tương ứng không đọc dữ liệu demo như dữ liệu thật. Python AI và webhooks từ Render về localhost cần cấu hình riêng; FE không tự tạo tunnel hay đăng ký webhook.

## Storefront và Store settings

- `/store/:storeSlug` gọi `GET /api/v1/tenants/public/by-subdomain/{subdomain}` để đọc tên cửa hàng, logo, banner, màu, điện thoại, địa chỉ và trạng thái. Không dùng publicStores/catalog fixture trong API mode. Product detail/flash sale/assistant chưa có API công khai nên hiển thị trạng thái chưa có chức năng, không dựng dữ liệu demo.
- `/stores` nhận subdomain để mở shop; không gọi danh sách tenant quản trị để giả lập public directory. Không còn liệt kê sáu shop fixture ở API mode.
- `/merchant/settings/profile`: Owner đọc `GET /api/v1/tenants/me`, lưu bằng `PUT /api/v1/tenants/storefront`, và mở preview theo subdomain trong response. Chỉ gửi sáu trường BE hỗ trợ: storeName, logoUrl, bannerUrl, primaryColor, supportPhone, address. Không lưu cấu hình vào localStorage để giả vờ ghi BE thành công.
- Smoke test với backend đang chạy cho thấy **guest không có JWT nhận 404 ngay cả với local-store đang tồn tại**. Repository áp RLS nhưng public endpoint chưa thiết lập context đọc public. FE gửi request public không JWT trước; nếu 404 và phiên hiện tại thuộc đúng subdomain đó, cho phép workspace preview bằng JWT của chính user. Không gửi JWT để thử xem shop của tenant khác. Không bypass RLS hoặc sửa BE. Logout xóa dữ liệu preview khỏi màn hình.
- Cấu hình storefront/contact hiện có trường JPA `@Transient` và được giữ trong Map của TenantService; có thể mất khi BE restart. UI ghi rõ giới hạn này.
- Đã kiểm thử live: Owner lưu tên shop qua FE, mở storefront đọc lại từ BE, khôi phục cấu hình ban đầu; kiểm tra giao diện 375px/1440px và trạng thái guest 404. `tests/api-storefront.spec.js` kiểm tra response public, inactive/not-found/retry, tenant isolation, logout, payload settings và không hiển thị mock.

## Kiểm thử

`npm run test:api` chạy kiểm thử browser với HTTP response mô phỏng theo DTO thực tế trên cổng 5175. Bao phủ JWT refresh/rejection, lỗi login/import, session reload, OAuth redirect/callback, import counters/limit, pickup slots, escrow, PDF và dispute payload.

`npm run test:e2e` giữ bộ kiểm thử demo trên cổng 5176 với `VITE_DATA_SOURCE=demo`. Muốn chạy lại preview offline trong lúc phát triển, tạo `.env.local` với `VITE_DATA_SOURCE=demo`, rồi restart Vite. Mặc định chạy thật không fallback sang fixture khi API lỗi.

Smoke test local đã xác nhận login JWT, FE proxy qua Nginx và OAuth end-to-end qua trang consent của Shopee Simulator: shop mock `727720655` đã CONNECTED. Import lần đầu xử lý 4 sản phẩm, tạo 7 SKU, có một `PRICE_HELD_ANOMALY`; FE hiển thị đúng `completed_with_errors`. Sync 2 warehouse thành công. Price sync và đọc orders/returns trả success; simulator hiện không có đơn/return để thử các thao tác shipping/refund thật. Các test mock không thay thế kiểm tra webhook/outbox thực tế; chưa cấu hình tunnel public về localhost.
