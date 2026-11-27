# SmartOmni — MASTER PLAN

Ngày: 2026-10-12 (Asia/Saigon). Trạng thái: Planning baseline để review trước implementation.

Tài liệu hợp nhất quyết định Product Owner (PO) đã phê duyệt với tài liệu hiện có. Phê duyệt baseline nghiệp vụ không đồng nghĩa mọi recommendation kỹ thuật, chi tiết contract hoặc decision còn mở trong tài liệu này đã được duyệt. Lượt công việc hiện tại chỉ được tạo/cập nhật file này.

## 1. Executive Product Summary

**APPROVED REQUIREMENT** — SmartOmni là nền tảng retail SaaS Multi-tenant, Multi-channel. Frontend đi theo chiến lược merchant-first; MVP hỗ trợ Shopee và TikTok Shop. Customer (Guest) dùng Storefront để Discovery → Compare → Redirect, lựa chọn offer của cùng SKU rồi mua tại marketplace.

Tenant Owner tạo Tenant, chọn Free/Pro, kết nối ít nhất một shop và hoàn tất initial product sync trước khi vào Merchant Dashboard. Tenant Manager tự đăng ký, chỉ có Merchant access sau khi chấp nhận invitation và có TenantMembership ACTIVE; một Manager chỉ thuộc một Tenant.

Stack cố định: ReactJS, JavaScript, JSX, Vite, Tailwind CSS, shadcn/ui, React Router, Lucide React. Không dùng TypeScript. Giai đoạn phát triển đầu dùng mock APIs/data nhưng có boundary để tích hợp backend thật sau này.

**DOCUMENTED REQUIREMENT** — Mục tiêu kinh doanh trong tài liệu cũ là giảm thao tác vận hành phân tán, hạn chế overselling, thống nhất Catalog/Orders/Inventory, và về sau bổ sung AI Forecasting/Recommendation. Mock frontend không chứng minh hiệu quả đồng bộ hoặc khả năng chống overselling của hệ thống thật.

**RECOMMENDATION** — Một frontend codebase với các layout theo portal, chia feature theo domain. Hoàn thành luồng Owner, Manager và Merchant trước; Storefront comparison vẫn nằm trong phạm vi MVP, không bị bỏ qua do thứ tự merchant-first.

## 2. Requirements Authority

### 2.1. Thứ tự thẩm quyền và nhãn

**APPROVED REQUIREMENT** — Thứ tự giải quyết requirements:

1. Quyết định PO trong prompt phê duyệt baseline mới nhất, ký hiệu `PO-01` đến `PO-18` tương ứng mục 1–18 của prompt; stack tại Product Baseline.
2. Approved UC/FR baseline; các nội dung nguồn chưa có xác nhận độc lập được ghi DOCUMENTED REQUIREMENT, không tự nâng thành quyết định PO mới.
3. Navigation/Activity Flows là supporting references.
4. Architecture/UX recommendations.

Các nhãn trong tài liệu:

- **APPROVED REQUIREMENT**: được PO chốt trực tiếp.
- **DOCUMENTED REQUIREMENT**: có trong nguồn cũ; được bảo tồn, có thể bị override hoặc còn cần reconcile.
- **RECOMMENDATION**: phương án đề xuất, không phải business rule đã duyệt.
- **ASSUMPTION**: giả định phục vụ planning; phải xác nhận trước khi ảnh hưởng hành vi.
- **TBD / PRODUCT OWNER DECISION REQUIRED**: chưa có rule đủ rõ; tham chiếu `D01`–`D24` ở mục 32.

Không lấy độ dài/độ chi tiết hay timestamp file làm bằng chứng một tài liệu thay thế tài liệu khác. Phase của frontend không thay đổi priority gốc của FR. Requirement bị PO loại khỏi scope được ghi override; requirement triển khai sau được ghi deferred, không xóa.

### 2.2. Nguồn đã kiểm tra

- `SRC-OV` — [SmartOmni_Project_Overview.docx](./SmartOmni_Project_Overview.docx): business scope, actors, portals, plans, architecture, AI; có nội dung Việt/Anh.
- `SRC-BASE` — [SmartOmmi_Nen_Tang_Ban_Le_Da_Kenh.docx](./SmartOmmi_Nen_Tang_Ban_Le_Da_Kenh.docx): nền tảng SaaS, integration, plans, AI, roles.
- `SRC-UC` — [SmartOmni_UC_Specification.docx](./SmartOmni_UC_Specification.docx): UC-01–UC-43, FR-001–FR-093.
- `SRC-NAV` — [SmartOmni_Workflows_Navigation.docx](./SmartOmni_Workflows_Navigation.docx): screen groups, SCR identifiers, 7 navigation flows, role matrix.
- `SRC-FLOW` — [SmartOmni_All_Flows_Detailed.docx](./SmartOmni_All_Flows_Detailed.docx): activity flows 1–15, thêm 3b; Luồng 16 được liệt kê trong tổng quan nhưng chưa thấy phần mô tả chi tiết tương ứng.
- `SRC-UX` — [evon ui-ux SKILL.md](../.agents/skills/ui-ux/SKILL.md), nguồn `evondev/evondevKit` theo `skills-lock.json`; workflow ở `references/design-process.md`.

Audit workspace: có 5 DOCX và skill; chưa có package.json/frontend/backend/schema/API contracts; không có Git metadata tại thư mục kiểm tra. Những câu trong DOCX nói một bảng DB “đã tồn tại” không được xem là implementation evidence.

### 2.3. Legacy conflicts đã được PO giải quyết

- `LC01` — Tên cũ `Tenant Admin` trong SRC-UC/NAV/FLOW được thay bằng Tenant Owner; role thành viên của tenant gọi là Tenant Manager theo PO-01. Quyền của role `Manager` cũ không được kế thừa một cách máy móc.
- `LC02` — UC-19/FR-040 tạo Manager trực tiếp và cấp quyền không còn là flow chuẩn. PO-01/02 yêu cầu Manager self-register + invitation acceptance + ACTIVE membership; chỉ một Tenant cho Manager.
- `LC03` — UC-06, FR-014/FR-015 và SCR-23 có Customer tracking; SRC-FLOW Luồng 2 bỏ tracking. PO-01/10 giải quyết: không account/login/cart/checkout/lookup/tracking/purchase history cho Customer.
- `LC04` — UC-07/UC-36 dùng Cart/Checkout, SRC-OV/BASE dùng Cart/Purchase interactions. PO-10 loại Cart/Checkout khỏi Storefront; Recommendation AI deferred và phải sửa lại nguồn dữ liệu trước P2.
- `LC05` — UC-22, FR-046/FR-047, Navigation onboarding cho chọn auto-import và bỏ qua connection. PO-03/05/06 thay bằng mandatory connection, auto-start sync, chỉ sync COMPLETED mới mở Dashboard.
- `LC06` — SRC-FLOW Luồng 1 kết thúc onboarding sau khi trigger async import; SRC-NAV chờ progress 100%. PO-03/06 xác nhận phải COMPLETED, nhưng không yêu cầu API luôn có phần trăm.
- `LC07` — Pro/Premium và Free “1 sàn” trong nguồn cũ. PO-04 xác định Free/Pro, Free tối đa 1 shop connection, không đếm số platform. Pro limits vẫn TBD; không kế thừa “unlimited” từ nguồn cũ.
- `LC08` — SRC-BASE nói chưa cần payment thật, SRC-FLOW Luồng 8/11 gắn nâng gói với payment. PO-04/12 không suy payment từ plan selection; real billing/payment nằm P2.
- `LC09` — Cách hiểu Product = một link sàn không phù hợp PO-08/10/11: Master Product → Variant → SKU → nhiều ChannelListings, so giá cùng SKU, Customer tự chọn.
- `LC10` — FR-087/UC-42 upsert theo SKU không đủ để tự gộp mọi listings trùng chuỗi SKU. PO-09 chỉ cho auto-map với reliable identifier; mapping chưa chắc phải review.
- `LC11` — React/Next.js/SSR là đề xuất cũ. Stack PO cố định React + JSX + Vite và các thư viện đã nêu; SEO/deployment strategy còn D19, không tự chuyển framework.

### 2.4. Contradictions/gaps chưa được giải quyết

- `UCX01` — UC-10/FR-024 cho cập nhật trạng thái nội bộ; SRC-FLOW Luồng 3b/15 giới hạn trạng thái từ marketplace và mô tả arrange/cancel cụ thể. Chưa có mapping hai loại status/transition được duyệt → D15.
- `UCX02` — UC-13/FR-030 mô tả hoàn/hủy và cộng kho; Luồng 9 phân biệt Refund Only, kiểm hàng, dispute, write-off; hoàn tiền do marketplace xử lý. Chưa chốt trigger restock và Returns trong MVP → D16/D17.
- `UCX03` — SRC-NAV có physical/available/reserved; Luồng 3 trừ physical stock khi nhận đơn. Chưa có reservation lifecycle hoặc công thức đồng nhất → D17.
- `UCX04` — UC-23 cho manual price và bật/tắt sync; UC-43 nói giá luôn khớp sàn dù lỗi API giữ giá cũ hoặc chênh lệch lớn cần duyệt. Cần nguồn giá, validity và display rule → D06/D14.
- `UCX05` — UC-21 yêu cầu xóa bớt tài nguyên trước downgrade; Luồng 11 cho xóa/ẩn. Chưa biết hidden SKU có giảm quota; chưa rõ plan definition thay đổi tác động Tenant đang dùng → D07/D24.
- `UCX06` — UC-20/FR-041 có Revenue/CTR/RMSE; Revenue gồm Storefront dù không checkout; Luồng 15 loại cancelled/returned khỏi Gross Revenue, Luồng 3b thêm Expected Net Payout. Chưa có công thức/timing/attribution → D18.
- `UCX07` — SRC-NAV role matrix, UC-16/FR-034 và UC-23 khác mức quyền ghi Promotion/Price Sync. Đổi tên role không giải quyết được action permissions → D11.
- `UCX08` — UC-02 cho client xóa JWT hoặc revoke nhưng hậu điều kiện nói token vô hiệu; FR-004 yêu cầu vô hiệu hóa; Luồng 10 có jti revocation/refresh. Cơ chế session chưa thống nhất → D13.
- `UCX09` — UC-40/FR-080 phân biệt retry lỗi tạm thời/vĩnh viễn; Luồng 4 có cutoff “Retry Count > 3”. Không dùng cutoff này cho initial sync; các retry policies cần quyết định riêng → D03.
- `UCX10` — Recommendation cold-start trả rỗng hoặc bestseller trong UC-07; Navigation chọn bestseller cùng category; Forecasting có skip SKU hoặc category/industry fallback trong Flow. AI scope/eligibility, threshold và metric chưa đồng nhất → D22.
- `UCX11` — SRC-OV vừa ghi 2 vừa 3 AI cores và thêm Chatbot; Chatbot chưa có UC/FR tương ứng. Purchase Orders có tên Luồng 16 nhưng thiếu flow chi tiết → D22; không tự mở rộng P0.
- `UCX12` — UC-18/FR-038 thiên về App Key/Secret; Flow có OAuth/API và khác nhau giữa hiển thị Webhook URL với tự đăng ký Webhook. PO chốt outcome authentication + shop confirmation, chưa chốt integration mechanism → D09.
- `UCX13` — SRC-NAV thiếu main screens cho một số UC như price sync, invitations, support; SCR-19 chỉ xuất hiện trong role matrix, một số modal chỉ xuất hiện trong flow. Route map mới là recommendation, không được coi screen inventory cũ đã đầy đủ → D11/D21/D23.

Technical inconsistencies cần phối hợp backend: Spring Boot đi cùng Hangfire; PostgreSQL RLS nhưng có lựa chọn SQL Server; nơi xác thực HMAC khác nhau giữa Gateway/Controller; một diagram tách fast ACK khỏi enqueue độc lập hoặc vẽ transaction commit trước các inventory steps. Giữ các outcome yêu cầu tin cậy, không sao chép diagram thành transaction design. Backend lead xác minh trong integration design, PO xác nhận SLA ở D20.

## 3. Official Role Model

**APPROVED REQUIREMENT — PO-01**

- **Tenant Owner**: self-register, initialize Tenant, chọn plan, connect/manage shops, quản lý products/inventory/orders, invite Manager, quản lý membership/permissions và Tenant settings.
- **Tenant Manager**: self-register độc lập; trước ACTIVE membership chỉ Notifications, Personal Profile/Account, Logout; sau đó chỉ dùng Merchant features theo permission được cấp. Không có multi-Tenant switching cho Manager.
- **Customer (Guest)**: product discovery và marketplace offer comparison; không có SmartOmni account hoặc nghiệp vụ mua/tra cứu đơn của Customer.
- **Super Admin**: quản trị platform; advanced monitoring không thuộc core MVP.

**TBD** — Action-level RBAC, Owner cardinality và core Super Admin scope: D11/D12/D21. Không có route đăng ký Super Admin công khai trong đề xuất này.

## 4. User / Tenant / Membership Model

**APPROVED REQUIREMENT — PO-02** — Identity và membership là hai concept riêng:

- User: id, profile, accountRole.
- Tenant: cửa hàng/doanh nghiệp trong SaaS; có lifecycle, plan và shop connections.
- TenantMembership: userId, tenantId, role, status, permissions.
- Invitation: lời mời cần review/accept, không đồng nhất với một membership ACTIVE.

INVITED/ACTIVE/REVOKED là bộ membership states được đề xuất trong baseline, chưa là enum/schema cuối cùng. Điều kiện ACTIVE để Manager vào Merchant đã được phê duyệt. INVITED không cấp business data access.

**RECOMMENDATION** — Giữ invitation state riêng vì lời mời có thể còn hiệu lực hoặc không còn hiệu lực mà account vẫn tồn tại. Resolve access từ session + membership + Tenant status + onboarding/entitlements; không chỉ đọc accountRole. Notifications cá nhân phải đọc được khi chưa có tenant context.

**TBD** — Các states declined/expired, invitation revocation, thay đổi Tenant sau khi membership bị revoke và quan hệ Owner–membership: D10/D12. Không tự cho Manager có nhiều ACTIVE memberships.

## 5. Tenant Owner Onboarding Flow

**APPROVED REQUIREMENT — PO-03/04/05/06**

Register → Select Tenant Owner → Personal information → Initialize Tenant → Select Free/Pro → Connect Marketplace → Authenticate → Confirm shop → Auto-start Initial Sync → Sync COMPLETED → Complete onboarding → Merchant Dashboard.

- Thành công authentication chưa đủ: phải confirm shop.
- Không có skip connection/skip sync hoặc auto-import yes/no.
- Sync pending/running/partially completed/failed đều chặn Merchant Dashboard và business routes; direct URL không bypass.
- Giữ Owner trong onboarding/recovery nếu connection hoặc sync thất bại.
- Chỉ authoritative COMPLETED mới mở gate; progress 100% ở UI không tự xác lập thành công.

**RECOMMENDATION** — Onboarding progress là resumable server state. Refresh, Back hoặc login lại phải resolve bước còn thiếu; không tạo Tenant/connection/job trùng chỉ vì page remount. Onboarding recovery cần hiển thị job details và action có thể thực hiện ngay trong flow.

**TBD** — Successful zero-item sync; unresolved mapping có chặn COMPLETED không; cách xử lý quota mà không cần vào Merchant; completion khi nhiều job/connection liên quan: D01/D02. Không có exemption cho gate trong lúc chờ quyết định.

## 6. Tenant Manager Registration + Invitation Flow

**APPROVED REQUIREMENT — PO-01/02**

Register → Select Tenant Manager → Personal information → Merchant Portal shell → Locked Dashboard.

Notifications → Open invitation → Review → Accept → TenantMembership ACTIVE → Merchant Dashboard unlocks.

- Khi chưa ACTIVE, chỉ Notifications, Personal Profile/Account và Logout khả dụng.
- Không tải dashboard business data/products/orders/inventory/channels/analytics/store management sau một UI khóa giả.
- Không có Manager Tenant switcher.
- Owner gửi invitation từ Manager Management sau khi có Merchant access.

**RECOMMENDATION** — Invitation review trình bày Tenant được mời và quyền dự kiến; accept chỉ mở gate sau response/membership refresh xác nhận ACTIVE. Nếu membership bị revoke giữa phiên, hủy business requests đang chờ, xóa tenant cache và quay về shell hạn chế. Không tự accept hoặc gắn Tenant từ URL/email.

**TBD** — Inviting chưa có account, email matching, expiry, decline, nhiều invitations đồng thời và conflict khi đã có membership: D10. Chấp nhận invitation phải enforce one-Tenant invariant phía API, không chỉ disable button.

## 7. Customer Storefront Flow

**APPROVED REQUIREMENT — PO-10/11**

Visit Storefront → Browse Catalog → Product Detail → Select/View Variant/SKU → Offers của cùng SKU → Compare current selling prices → Manual offer selection → External listing redirect.

Không có Customer registration/login/account/cart/checkout/order lookup/order tracking/SmartOmni purchase history. Storefront không phát sinh đơn bán hàng trong SmartOmni.

**DOCUMENTED REQUIREMENT** — Tenant-specific branding/catalog và subdomain resolution: UC-04, FR-008/FR-009. View/outbound click events: FR-010/FR-013. Không thu thập Cart event vì không có Cart.

**RECOMMENDATION** — Giữ SKU selection trong URL để reload/deep link đúng context; validation SKU phải thuộc Product và Tenant hiện tại. Redirect dùng đúng listingUrl của offer được chọn, không tự thay bằng offer rẻ hơn. Event capture không được tạo duplicate do re-render.

## 8. SaaS Plan Flow

**APPROVED REQUIREMENT — PO-04** — Initialize Tenant → Select Free/Pro → Marketplace connection → Initial sync → Dashboard.

- Free: tối đa 1 shop connection, gồm cả trường hợp hai shop cùng platform.
- Shopee và TikTok Shop đều được hỗ trợ trong MVP; một Free Tenant chỉ kết nối một shop.
- Pro resource limits chưa được phê duyệt; không dùng “unlimited”.
- Plan selection không suy ra charge, trial, payment success hoặc billing cycle.

**DOCUMENTED REQUIREMENT** — Free 100 SKU trong UC-08/UC-42 và SRC-OV/BASE; vẫn ghi nhận, chưa xác định cách đếm Product/Variant/SKU/hidden/review items theo model mới (D07). Forecasting/Recommendation gating theo paid plan là requirement cũ; chức năng tương ứng deferred.

**RECOMMENDATION** — Plan/entitlement/usage được đọc từ service contract, không rải Free/Pro checks trong components. Mock Pro có thể thể hiện nhiều listings bằng fixture đã gắn nhãn scenario; fixture không xác lập hạn mức thật. Plan selection ban đầu và thay đổi subscription sau onboarding là hai use cases khác nhau.

**TBD** — P0 entitlement matrix D08; upgrade/downgrade/trial và policy áp dụng plan changes D24.

## 9. Marketplace Connection Flow

**APPROVED REQUIREMENT — PO-05**

Select marketplace → Authenticate → Retrieve available shop/account → Confirm shop → Connection success → Trigger Initial Sync.

Conceptual connection states: pending/success/failed. Authentication substeps và confirmation result cần phân biệt; success chỉ sau cả authentication và confirm shop.

Failed authentication/confirmation giữ Owner trong onboarding, báo nguyên nhân, cho retry và không tạo sync job. Free second shop bị chặn kể cả khác hay cùng marketplace.

**RECOMMENDATION** — Mock flow có interaction xác thực và xác nhận shop rõ ràng. API/backend quản lý provider credentials, shop ownership, token lifecycle và quota enforcement. Frontend không giữ App Secret trong browser persistence hoặc Vite environment như một secret backend. Không mặc định chọn shop đầu tiên nếu provider trả nhiều shop.

**DOCUMENTED REQUIREMENT** — FR-038/FR-039: mã hóa secret và tenant-specific Webhook URL là backend dependencies. **TBD D09**: OAuth hay credential workflow, duplicate shop connection, re-auth/disconnect và hành vi khi connection mất sau onboarding.

## 10. Initial Synchronization Flow

**APPROVED REQUIREMENT — PO-06/07**

Connection confirmed → pending → running → completed hoặc partially completed/failed.

- Auto-start ngay sau connection success.
- Có processed/successful/failed counts, quota failures, retry eligibility và progress khi API cung cấp.
- Không biết total thì không tự tính percent; dùng progress indeterminate và counts có dữ liệu.
- Partial/failed giữ items thành công; báo rejected/failed items và controlled retry cho eligible failures.
- Không rollback toàn job; không retry toàn job tự động hoặc lặp vô hạn.
- Dashboard gate chỉ mở với COMPLETED. Partial data tồn tại không có nghĩa onboarding hoàn tất.

**RECOMMENDATION** — Tách job status, từng item outcome và mapping review status. Retry trả job/attempt reference và kết quả tích lũy có ý nghĩa rõ; không cộng counts hai lần. Transport failure khi poll chưa chứng minh job failed. Sau mất mạng, truy vấn lại authoritative job trước khi cho tạo retry.

**DOCUMENTED REQUIREMENT** — UC-42/FR-084–FR-089 yêu cầu batch/pagination, imported fields, quota handling và error logs; upsert phải tuân theo reliable identifier rule mới. Backend thực hiện công việc import, frontend thể hiện tiến trình.

**TBD D01/D02/D03/D06** — Định nghĩa COMPLETED khi có zero items hoặc mapping review; quota remediation; retry policy; incremental overwrite rules. Không tự dùng retry cutoff của Outbox cho initial sync.

## 11. Product Aggregation Model

**APPROVED REQUIREMENT — PO-08** — Master Product → Variant → SKU → ChannelListing. Một SKU có nhiều ChannelListings; Product không tương đương listing.

- Master Product: nhận diện sản phẩm trong catalog SmartOmni.
- Variant: variation concept của sản phẩm.
- SKU: đơn vị nội bộ dùng liên kết listings và tham chiếu inventory/order lines.
- ChannelListing: thông tin bán cụ thể gắn với channel/shop và external identifiers.

**RECOMMENDATION** — Module catalog quản lý cấu trúc nội bộ; channel-listings quản lý projection marketplace; product-mapping quản lý linkage và quyết định review. External price/availability/syncStatus giữ tại listing. Một lỗi sync trên TikTok Shop không biến toàn Product thành failed hay làm mất Shopee offer hợp lệ.

**TBD D05** — Cardinality Variant–SKU, simple product không options, units/bundles, khả năng đổi SKU, uniqueness scope của identifiers và nhiều listing trong cùng shop. Đây chưa phải DB schema/API schema cuối cùng.

## 12. Product Mapping Model

**APPROVED REQUIREMENT — PO-09** — Chỉ auto-map khi có reliable identifier; không merge chỉ vì tên tương tự. Uncertain mapping phải đánh dấu để Owner hoặc authorized Manager review/resolve.

Conceptual mapping outcomes: AUTO_MAPPED, REVIEW_REQUIRED, CONFIRMED hoặc tên tương đương. Không bắt buộc enum cuối cùng.

**RECOMMENDATION** — Review surface hiển thị imported listing, identifier evidence, candidates và reason cần review. Hành động quyết định mapping phải có authoritative response, xử lý stale review/conflict và giữ audit trail. Catalog views không giả định mọi imported item đã mapped.

**TBD D04/D06** — Reliable identifiers, confidence rules, người được approve, duplicate/unlink/remap rules, và ảnh hưởng khi Product đã có Orders/Inventory. **D01** — Nếu review chặn sync completion, cần recovery surface trong onboarding; không chuyển Owner vào Merchant Mapping Review để bypass gate.

## 13. ChannelListing / Offer Comparison Model

**APPROVED REQUIREMENT — PO-08/11** — Listing concepts gồm channel, shop, externalProductId, externalVariantId, regularPrice, salePrice, currency, availability, listingUrl, syncStatus, lastSyncedAt. Đây là vocabulary để lập contract, không phải final payload.

Lowest price được xác định trên:

1. Cùng SKU đang chọn.
2. Current selling price.
3. Listings hiện available/in stock.

Hiển thị mọi relevant available offers, marketplace/shop, current selling price; đánh dấu giá thấp nhất. Customer có thể chọn bất kỳ available offer và redirect bằng URL của listing đó. Không auto-redirect, không gọi lowest price là “best offer”. Out-of-stock không tham gia xác định lowest price.

**RECOMMENDATION** — API cung cấp giá hiện hành đã resolve và compare eligibility; frontend không mặc định `salePrice` luôn còn hiệu lực hoặc zero price là missing. Regular/sale price chỉ là nguồn thông tin; validity, precision và currency cần contract. Khi chưa có đủ dữ liệu để khẳng định current price, UI biểu diễn unknown/stale state, không gắn nhãn cheapest vô căn cứ.

**TBD D14** — Multi-currency, sale validity, stale cutoff, equal-price indicator/order, hidden hay disabled out-of-stock listings, giá thiếu, refresh và availability thay đổi trước redirect. Các quyết định này không được làm mất quyền manual selection đã chốt.

## 14. Orders Scope

**APPROVED REQUIREMENT — PO-12** — Orders là P0 Merchant feature; Owner quản lý Orders, Manager theo quyền được cấp. Guest không tra cứu hoặc tạo Order.

**DOCUMENTED REQUIREMENT — UC-10/12/13/32/33/34; FR-023–FR-030** — Danh sách đa kênh theo Tenant, filters, detail, history, trạng thái xử lý nội bộ; shipping label PDF; idempotency Webhook/Polling; hoàn/hủy và stock effects. SRC-FLOW Luồng 15 bổ sung Arrange Shipment, pickup/drop-off, cancel và batch operations; chưa tự coi mọi bổ sung này đã được phê duyệt cho MVP.

**RECOMMENDATION** — P0 chuẩn bị list/detail/history và integration state. Model phân biệt external order status, internal fulfillment progress và sync status. Actions được mô tả bằng capabilities từ API; không cung cấp dropdown sửa tùy ý marketplace status. Mutation có pending/result/error, không giả thành công trước backend.

**TBD D15/D16** — Chốt action matrix, exact transitions, batch partial success, label formats, cancellation, Returns boundary và offline order scope trước coding các mutations. Đơn trên hai marketplaces cùng external order ID không được xem là một order chỉ vì ID trùng; canonical identity cần integration contract.

## 15. Inventory Scope

**APPROVED REQUIREMENT — PO-12** — Inventory là P0; Owner và authorized Manager thao tác theo quyền.

**DOCUMENTED REQUIREMENT — UC-11/33/40; FR-026–FR-028, FR-078–FR-080** — Xem/điều chỉnh tồn SKU, xử lý concurrent writes, đồng bộ ra sàn qua Outbox. Navigation mô tả physical/available/reserved và adjustment reasons.

**RECOMMENDATION** — UI hiển thị internal quantity và channel sync outcomes riêng; local save thành công không đồng nghĩa tất cả sàn đã cập nhật. Adjustment có version/conflict feedback, pending state và history. Refetch khi conflict; không âm thầm ghi đè. Listing availability không thay thế inventory ledger.

**TBD D17** — Quantity meanings/formula, reservation/release/deduct/restock timing, negative stock/oversell resolution, absolute versus delta adjustment, warehouses và units. Không tự tạo công thức available = physical − reserved như một rule đã duyệt.

## 16. Merchant Dashboard Scope

**APPROVED REQUIREMENT — PO-12** — Merchant Dashboard thuộc P0 nhưng chỉ mở khi access context hợp lệ; Manager chưa ACTIVE chỉ có locked shell, Owner chưa sync COMPLETED ở onboarding.

**RECOMMENDATION** — Dashboard vận hành ưu tiên việc cần làm: sync issues, mapping review, order/inventory tasks theo permission và dữ liệu có thật từ mock contract. Feature đã hoàn thành onboarding có thể còn subsequent sync progress; không áp lại initial gate tùy tiện khi job thường kỳ thất bại.

Notifications/Profile/Logout cần hoạt động cho Manager chưa gắn Tenant. Không đưa Revenue, profit hoặc KPI chưa có định nghĩa vào dashboard như số liệu kinh doanh đã chốt. Count cards nếu có phải chỉ rõ đối tượng được đếm và không suy tổng từ một trang phân trang.

**DOCUMENTED REQUIREMENT** — SCR-10/UC-20 trước đây là BI Dashboard. Full Revenue/CTR/RMSE dashboard được giữ trong backlog, advanced Analytics thuộc P1; nội dung P0 dashboard và công thức metrics → D18, notification types → D23.

## 17. Storefront Scope

**APPROVED REQUIREMENT — PO-10/11/12** — Catalog, Product Detail, Variant/SKU selection, marketplace offers, lowest-price indication, manual redirect là phần của frontend MVP.

**DOCUMENTED REQUIREMENT** — Branding theo Tenant, unavailable Product/Tenant not found và suspended Tenant behavior: UC-04/26, FR-008/FR-053. Customer tracking requirements bị override, không chuyển ngầm sang backlog để tự bật lại.

**RECOMMENDATION** — Storefront có layout và public data projection riêng; không nhận Manager fields, permissions, secrets, buyer PII, cost/internal stock history qua public catalog contract. UI ưu tiên màn hẹp; Catalog search/filter mechanics và copy theo brief được duyệt.

Recommendation AI/Chatbot deferred P2. Landing page marketing trong SCR-00 được bảo tồn nhưng không tự mở rộng thành deliverable lớn của P0; minimum public entry theo authentication/onboarding, full marketing scope xem D19.

## 18. Super Admin Scope

**APPROVED REQUIREMENT — PO-01/12** — Role quản trị platform tách khỏi Tenant; advanced monitoring deferred P2, không phải core frontend MVP mặc định.

**DOCUMENTED REQUIREMENT — UC-25–UC-31; FR-050–FR-060** — Tenant directory, usage, lock/unlock, plan definitions, RLS/security monitoring, APM, support và AI model history được bảo tồn.

**RECOMMENDATION** — Giữ feature boundary/layout/access group platform-admin; không coi Super Admin mặc nhiên là Tenant Owner hay cho vào Merchant bằng Tenant impersonation. Consumer app phải biểu diễn Tenant suspended kể cả khi màn thao tác lock chưa được làm.

**TBD D21** — Minimum Super Admin delivery: chỉ role/access foundation hay bao gồm tenant list/detail/lock và plan definitions. Không tự cam kết các màn đó trong core P0 khi chưa có quyết định.

## 19. MVP / P1 / P2 Scope

**APPROVED REQUIREMENT — PO-12** — Phân kỳ dùng cho frontend delivery, không xóa các documented FR.

### 19.1. P0 / Core MVP

- Authentication mock; registration/role selection; personal account.
- Owner onboarding, Free/Pro selection, mandatory Shopee/TikTok Shop connection UX, confirm shop, initial sync và recovery states.
- Manager self-registration, locked Dashboard, Notifications, invitation review/acceptance, ACTIVE membership và revocation handling.
- Merchant Dashboard; Products, Variants, SKU, Product Mapping Review, ChannelListings.
- Orders, Inventory, Channel Connections, User/Manager Management.
- RBAC foundation và Free/Pro feature gating; exact permissions/entitlements là D08/D11.
- Storefront Catalog/Product Detail, SKU-aware offers, lowest current available price, manual redirect.

P0 completion bao gồm Storefront discovery flow. Mock connection/sync là hành vi mô phỏng, không là real marketplace integration. Các screen mutations còn TBD chỉ được triển khai sau khi action rule tương ứng được chốt; không tự coi read-only screens đã hoàn thành đầy đủ requirement quản lý.

### 19.2. P1 / Later

- Advanced Analytics.
- Extended Subscription/Trial UX; “Trial” chưa xác lập duration, eligibility hoặc billing rules.
- Forecasting, kèm dependency Promotion/alerts/model data theo scope được duyệt.
- Returns nếu không được đưa vào final MVP baseline; placement còn D16, không mặc định xóa FR-030.

### 19.3. P2 / Deferred

- Recommendation AI, Chatbot, Purchase Orders.
- Real billing/payment integration.
- Support Center enhancements.
- Advanced Super Admin monitoring.

**RECOMMENDATION** — Backend integration là delivery track riêng sau mock frontend, không tự gắn tất cả backend work vào P2. MVP production cần real authorization, tenant isolation, integrations và operations readiness, không chỉ mock UI.

## 20. Route Map

**RECOMMENDATION** — Các path dưới đây là đề xuất information architecture, chưa có route implementation. D19 chốt host/subdomain và public URLs; đề xuất hiện dùng một codebase, layout tách biệt.

### 20.1. Public / Authentication

- `/` — public entry trên platform host; full marketing landing scope TBD.
- `/auth/register` — account registration và role selection Owner/Manager.
- `/auth/register/profile` — personal information; giữ role choice trong registration flow.
- `/auth/login` — Owner/Manager authentication.
- `/auth/forgot-password`, `/auth/reset-password` — documented recovery flow, delivery chi tiết D13.
- `/account` — personal profile/account cho user đã đăng nhập, kể cả Manager chưa membership.
- `/notifications` — personal notifications; không yêu cầu ACTIVE TenantMembership.
- `/notifications/invitations/:invitationId` — invitation review/accept; ownership check riêng, không yêu cầu membership ACTIVE trước khi accept.

### 20.2. Tenant Owner Onboarding

- `/onboarding/tenant` — initialize Tenant.
- `/onboarding/plan` — select Free/Pro.
- `/onboarding/marketplace` — chọn marketplace, authentication handoff.
- `/onboarding/marketplace/confirm` — review/confirm retrieved shop.
- `/onboarding/sync/:jobId` — progress, results, failures, controlled retry/recovery.
- `/onboarding/complete` — chỉ đạt được khi initial sync authoritative COMPLETED.

Recovery mapping/quota actions nên nằm trong onboarding khi chúng cần để hoàn tất sync; có thể là subview của sync route, chưa thêm Merchant access exemption. Exact recovery actions chờ D01/D02.

### 20.3. Tenant Manager Pending Access

- `/merchant/pending-access` — locked shell giải thích chưa có quyền vào cửa hàng, links tới Notifications/Account và Logout.
- `/merchant` hoặc mọi business deep link từ Manager chưa ACTIVE được điều hướng về shell này; không fetch business data.

Không có Tenant chooser/switcher cho Manager. Logout là session action, không cần một business page riêng.

### 20.4. Merchant Portal — P0

- `/merchant` — operational Dashboard.
- `/merchant/products` — Catalog list.
- `/merchant/products/new`, `/merchant/products/:productId`, `/merchant/products/:productId/edit` — product management theo capabilities.
- `/merchant/products/:productId/variants` — Variant/SKU workspace; SKU selection có thể dùng query parameter.
- `/merchant/products/:productId/listings` — ChannelListings theo SKU/shop.
- `/merchant/mapping-reviews`, `/merchant/mapping-reviews/:reviewId` — mapping queue/detail.
- `/merchant/orders`, `/merchant/orders/:orderId` — Orders list/detail/history và approved actions.
- `/merchant/inventory` — SKU inventory; adjustment dialog không bắt buộc route riêng.
- `/merchant/sync-jobs`, `/merchant/sync-jobs/:jobId` — subsequent sync/result visibility; sync log type phân biệt với initial job.
- `/merchant/channels`, `/merchant/channels/:connectionId` — connection management.
- `/merchant/manager` — invitations/memberships/permissions theo quyền; không phải global users directory.
- `/merchant/settings/store` — Tenant settings; exact fields D19.
- `/merchant/settings/plan` — current plan, entitlements, usage; P0 không tự thêm billing checkout hoặc downgrade transaction.

### 20.5. Storefront — P0

Production candidate theo tài liệu cũ: Tenant host `/` và `/products/:productId?sku=:skuId`. Local mock candidate: `/store/:storeSlug` và `/store/:storeSlug/products/:productId?sku=:skuId`.

Hai dạng là deployment adapters cho cùng Storefront feature, không là quyết định tạo hai app. Không có `/cart`, `/checkout`, `/orders/lookup` hoặc Customer account route. Customer chọn offer tại detail; redirect ra external listing.

### 20.6. Platform Admin / Future Routes

- `/platform/login` — authentication context riêng của Super Admin.
- `/platform`, `/platform/tenants`, `/platform/tenants/:tenantId`, `/platform/plans` — candidates, scope D21.
- `/merchant/analytics`, `/merchant/forecasting`, `/merchant/promotions` — P1 candidates, chưa active ở P0.
- `/merchant/returns`, `/merchant/returns/:returnId` — conditional P0/P1, D16.
- `/platform/monitoring`, `/platform/security`, `/platform/support`, `/platform/models` — deferred candidates, không làm menu “hoàn chỉnh” giả trong P0.

Route-level states cần có: unauthorized, forbidden, Tenant suspended, resource not found, unknown Tenant, application error. Page/modal boundary sẽ chốt tại UX brief.

## 21. Access-Control Strategy

**APPROVED REQUIREMENT — PO-14** — Frontend guards phục vụ UX; backend là authority về authorization và business rules. Context gồm session, account role, membership, invitation, onboarding, plan/entitlement và Tenant status.

**RECOMMENDATION** — Resolve theo thứ tự để tránh flash dữ liệu và redirect loop:

1. Xác định public/authenticated route group; Storefront đọc public Tenant context, không cần Customer session.
2. Resolve session trước khi tải business queries; unresolved session là loading, không tạm coi user là authorized.
3. Kiểm tra role phù hợp portal. Không dùng tenantId từ query string như bằng chứng quyền.
4. Với Manager, unresolved/không ACTIVE membership chỉ cho restricted shell, Notifications và Account; invitation ownership kiểm tra riêng.
5. Với Owner, chưa đủ connection + initial sync COMPLETED thì về bước onboarding/recovery.
6. Merchant access còn phải đáp ứng Tenant active, permission và feature entitlement. ACTIVE membership không bỏ qua Tenant suspension.
7. Resource/action authorization được áp dụng cả khi truy cập direct URL và gọi mutation; backend xác nhận lại.

Do not implement một mega-guard không phân biệt route group: Owner onboarding cần đọc Tenant config dù chưa được vào Merchant; Manager cần nhận invitation dù chưa có Tenant. Quota chặn hành động tạo/kết nối, không tự xóa quyền đọc data đã có.

Khi logout, session expiry không khôi phục được, membership revoked hoặc Tenant context thay đổi: hủy requests, clear scoped cache, bỏ privileged UI. Không tái dùng delayed response của session cũ cho session mới. Sau invitation accepted/plan updated, refetch authoritative access/entitlements thay vì chỉ đổi local boolean.

**TBD D10/D11/D12/D13** — Membership/Owner/auth lifecycle chi tiết; không thiết kế Manager Tenant switching như recovery shortcut.

## 22. Frontend Architecture

**APPROVED REQUIREMENT — Product Baseline, PO-13** — Một React + JavaScript + JSX + Vite frontend; Tailwind CSS, shadcn/ui, React Router, Lucide React. Không TypeScript, không scaffold trong lượt này.

**RECOMMENDATION**

- `app`: composition root, routing configuration, providers, portal layouts, access resolution, global error boundaries.
- `features`: domain modules chứa pages, feature components, hooks, API adapters/mappers và client validation liên quan.
- `shared`: UI primitives, common feedback patterns, formatting utilities, tokens; không chứa một shared object bao toàn business state.
- `services`: HTTP transport, session/access gateway, contract/error normalization, integration boundary dùng chung.
- `mocks`: scenario fixtures, handlers, simulated jobs và test support; chỉ tải trong mock/dev/test mode.

Data flow đề xuất: Page → feature hook/service → HTTP boundary → mock handler hoặc real API → response mapper → feature view model. Component không import trực tiếp fixture; chuyển backend không yêu cầu viết lại flow/component.

Feature dependencies:

- auth → identity/session; membership và tenant tạo access context.
- onboarding phối hợp tenant + subscription + marketplace-connections + sync; không nhét tất cả business logic vào một wizard component.
- sync trả import outcomes; product-mapping xác lập linkage; catalog và channel-listings cung cấp product/offer views.
- storefront tiêu thụ public catalog/offer contracts, không import Merchant pages hoặc private DTOs.
- orders và inventory dùng SKU identity; mutation outcome và async sync status riêng.
- notifications hỗ trợ user-scope không Tenant và tenant-scope sau membership; platform-admin có boundary riêng.

Cross-feature access qua public module interfaces/service contracts; tránh import sâu vào internals và circular dependencies. Lazy-load theo route group để Guest không cần tải toàn Merchant/Platform interface. Đây là optimization, không phải security boundary.

shadcn/ui components được cấu hình/generate dạng JavaScript/JSX; không giữ `.ts`/`.tsx` source do template sinh ra. CSS tokens và component recipes được thống nhất theo evon và stack đã chốt. Package versions sẽ kiểm tra tính tương thích khi được phép scaffold/install, chưa pin versions tại planning.

Optional tooling recommendations: một server-state query cache library, mock HTTP interception library, component/integration test runner và browser E2E runner. Không bổ sung chúng thành fixed approved stack hoặc cài đặt trong lượt này; chọn ở bước technical setup review.

## 23. Proposed Folder Structure

**RECOMMENDATION** — Cây dưới đây chỉ là kế hoạch, chưa tạo thư mục/file:

```text
src/
  app/
    router/
    providers/
    access/
    layouts/
  features/
    auth/
    onboarding/
    tenant/
    membership/
    notifications/
    marketplace-connections/
    sync/
    catalog/
    product-mapping/
    channel-listings/
    orders/
    inventory/
    analytics/                 [P1]
    subscription/
    storefront/
    platform-admin/            [scope D21; advanced P2]
  shared/
    ui/
    components/
    hooks/
    lib/
    styles/
  services/
    http/
    contracts/
  mocks/
    handlers/
    fixtures/
    scenarios/
    jobs/
tests/
  integration/
  e2e/
docs/
  MASTER_PLAN.md
```

Mỗi feature có thể chứa `pages/`, `components/`, `hooks/`, `api/`, `model/`, `validation/` và tests liên quan khi có nhu cầu thực; không tạo boilerplate rỗng cho tất cả. Source `.js`/`.jsx`, CSS và documented contracts; JSDoc nếu hữu ích, không TypeScript. Contract descriptions là giao ước frontend provisional, không DB schema.

## 24. State-Management Strategy

**APPROVED REQUIREMENT — PO-15** — Không có một global state object cho toàn app. Phân biệt session, active membership, onboarding, connections, sync jobs, catalog, mapping reviews, listings, orders, inventory, subscription/features và storefront offers.

**RECOMMENDATION**

- Server state: cache theo resource/query, Tenant và session visibility khi cần; authoritative access/entitlements không lưu như boolean vĩnh viễn.
- Session context: identity, session resolution status và access snapshot nhỏ; không chứa Catalog/Orders arrays.
- URL state: search, filters, pagination, sorting; selected SKU khi deep-link cần thiết. Dùng canonical parameters và validate khi parse.
- Local state: modal open, selected row IDs, draft fields, offer selection và temporary form errors; reset khi parent resource/context đổi.
- Onboarding: persisted step/progress từ API; form draft chỉ là local transient state đến khi save.
- Sync: job status/polling/subscription tách khỏi connection status; dừng polling khi terminal result theo contract, không retry mutation từ query retry logic.
- Public offer cache: key gồm resolved Tenant, Product và SKU; không tái dùng response của SKU trước sau khi Customer đổi SKU.

Các mutations mang tính quyền hoặc external side effects như invitation accept, shop confirmation, sync retry, order cancel, inventory adjustment nên chờ authoritative result. Không optimistic unlock Dashboard, không optimistic restock. Invalidate/refetch resource liên quan có mục tiêu; không reload mọi feature sau mỗi mutation.

Browser persistence chỉ dùng preferences không nhạy cảm nếu cần; session storage/cookie strategy chờ D13. Không lưu credential/token giả theo cách khiến production vô tình kế thừa mô hình lưu secret không phù hợp. Mock session có nhãn và boundary riêng.

## 25. Mock API Strategy

**APPROVED REQUIREMENT — PO-16** — P0 dùng mock APIs/data, gồm happy path, failures, partial results và membership/access states. Chưa build mocks ở planning.

### 25.1. Contract design principles

**RECOMMENDATION** — Contract-first ở mức operations, inputs, outcomes, error semantics và asynchronous lifecycle. Các concept dưới đây chưa là final JSON schema, HTTP path hay database structure. Khi backend thiết kế API, adapters nhận trách nhiệm đổi transport shape.

- Read operations hỗ trợ loading/empty/error và pagination metadata khi cần.
- Mutations trả authoritative result/capabilities và validation errors; không trả generic success cho mọi action.
- Error vocabulary phân biệt validation, unauthenticated, forbidden, Tenant suspended, quota exceeded, stale/conflict, provider failure, network uncertainty và item-level rejection.
- Các HTTP statuses 401/403/404/409/429/5xx là recommendation cho adapter; domain error code giúp phân biệt feature locked với permission denied. Backend contract cuối cùng quyết định mapping.
- Async operation trả reference/status để theo dõi, counts chỉ có semantics khi total/cumulative/attempt scope được định nghĩa.
- Request identity/version/idempotency semantics được ghi trong contract proposal cho mutations có side effects; không suy correlation ID tự bảo đảm idempotency.
- Deterministic fixtures, virtual clock hoặc scenario-controlled progression để QA lặp lại. Không dùng random failures làm acceptance khó tái hiện.
- Scenarios có dữ liệu Tenant A/B riêng; manager chỉ thuộc một Tenant. Account switching để QA không là Tenant switching feature.
- Mock state reset/persistence phục vụ QA được ghi rõ; nếu simulate reload-resume phải giữ job/onboarding state đủ lâu, nhưng không coi đó là backend durability.

### 25.2. Contract catalogue

**RECOMMENDATION** — Các contract IDs dùng để trace UI/test, chưa là endpoint đã chốt:

- `MC01 Identity & Session`: register/login/logout/reset/request session; input account role/profile/credentials phù hợp; output identity/session status, validation/recovery result. Customer không có registration operation.
- `MC02 Membership & Invitations`: read personal invitations, invitation detail, accept, read current membership; Owner invite/revoke/permission operations theo D10/D11. Output membership status/permissions và conflicts khi không đáp ứng one-Tenant invariant.
- `MC03 Tenant & Onboarding`: initialize/read progress, save allowed step, resolve eligibility; output completed/missing steps, initial job reference, Tenant status và reason bị block. Client không gửi `completed=true` để bypass checks.
- `MC04 Plans & Entitlements`: read Free/Pro catalogue, select initial plan, read current usage/entitlements. Free shop limit = 1; Pro limits chưa biết phải thể hiện unknown/configurable scenario, không định nghĩa unlimited. Không có real payment operation ở P0.
- `MC05 Marketplace Connections`: begin simulated authentication, retrieve authorized shop candidates, confirm shop, read connection. Output connection result và initial job reference sau success; failed confirmation không tạo job. Reconnect/disconnect details chờ D09.
- `MC06 Initial Sync & Recovery`: read job status/progress/item outcomes; request eligible retry. Input job/attempt/items theo retry policy; output success/failed/rejected counts, reasons, retry eligibility và completion eligibility. Backend/mocks chứ không UI quyết định kết quả authoritative.
- `MC07 Catalog`: list/read/create/update/visibility, Variants/SKU và image operations theo permissions; output internal structure, validation, quota/duplicate errors. Không dùng một Product price đại diện toàn bộ channel prices.
- `MC08 Product Mapping`: review queue/detail, evidence/candidates, submit resolution; output mapping result, conflicts và item linkage; allowed decisions D04. Uncertain item được đánh dấu thay vì merge tự động.
- `MC09 ChannelListings & Public Offers`: read listings theo SKU/shop; public offer view chỉ có data phục vụ discovery/comparison. Output current selling price/availability/freshness hoặc dữ liệu chưa xác định; compare eligibility D14. Internal sync errors có thể cần public-safe projection.
- `MC10 Orders`: list/detail/history, read action capabilities và submit approved action; output external/internal/sync status riêng, per-order result cho batch khi được duyệt. PDF là mock asset/result có nhãn; không gọi provider thật.
- `MC11 Inventory`: read quantities/history, submit approved adjustment, read outbound sync outcome; input expected version nếu contract chọn optimistic concurrency; output authoritative quantity hoặc conflict. Không mock success bằng cách tự cộng kho từ component.
- `MC12 Dashboard & Notifications`: read operational summaries theo permission, personal/tenant notifications, read invitation reference; output counts/available actions và freshness. Unaffiliated Manager chỉ nhận personal access context, không tenant business summary.
- `MC13 Platform`: session/role separation và suspended-Tenant scenarios; management contracts cụ thể khi D21 được duyệt. Advanced monitoring nằm future contract backlog.

### 25.3. Required scenario catalogue

**APPROVED REQUIREMENT** — Baseline scenario types; IDs và cách tổ chức là recommendation:

- `MO01`: Owner hoàn tất register → plan → shop confirmed → sync COMPLETED → Dashboard.
- `MO02`: marketplace authentication failed; meaningful reason/retry, không tiến tới sync.
- `MO03`: authentication thành công nhưng shop chưa confirm hoặc confirmation thất bại; vẫn block.
- `MO04`: connection success, sync pending/running; counts tăng theo mock job, direct Dashboard blocked.
- `MO05`: job unknown total; indeterminate progress; không giả percent.
- `MO06`: partial success; giữ imported items, failed items rõ, Dashboard blocked.
- `MO07`: quota exceeded; giữ success, rejected items, controlled recovery; không tự chọn sản phẩm ưu tiên.
- `MO08`: sync failed rồi eligible retry thành công; thành công cũ không mất/nhân đôi.
- `MO09`: retry không eligible hoặc provider vẫn lỗi; không retry vô hạn, không mở Dashboard.
- `MO10`: refresh/network loss giữa sync; resume job hoặc unresolved state, không create duplicate.
- `MO11`: Free shop thứ hai cùng platform hoặc khác platform đều không được kết nối.
- `MS01`: Manager mới không Tenant, Dashboard locked, chỉ Notifications/Account/Logout.
- `MS02`: pending invitation → review → accept → ACTIVE → business access theo permissions.
- `MS03`: accept error/conflict hoặc invitation không còn hợp lệ; không mở Dashboard bằng local state.
- `MS04`: membership revoked giữa phiên; privileged cache/UI bị clear, trở lại restricted access.
- `MS05`: attempt nhận Tenant thứ hai bị từ chối theo policy one-Tenant, chi tiết D10.
- `MCAT01`: reliable identifier → mapped đúng; không dựa vào similar name.
- `MCAT02`: uncertain linkage → REVIEW_REQUIRED; review authorized, conflict khi dữ liệu đổi.
- `MCAT03`: một SKU có nhiều ChannelListings, khác shop/platform/price/availability/syncStatus.
- `MCAT04`: import lặp lại không tự silent merge; overwrite/upsert outcome theo rule được duyệt.
- `MSF01`: một offer available → manual redirect đúng URL.
- `MSF02`: nhiều offers cùng SKU → lowest available current selling price highlighted.
- `MSF03`: equal prices → behavior D14; không chọn ngầm một “winner”.
- `MSF04`: offer giá rẻ hơn nhưng out of stock → không tham gia lowest-price calculation.
- `MSF05`: stale listing, thiếu giá hoặc partial channel sync → thể hiện uncertainty theo D14.
- `MSF06`: không available offer → empty/disabled purchase action, không SmartOmni checkout.
- `MSF07`: đổi SKU → chỉ so offers SKU mới; delayed response SKU cũ không hiển thị lẫn.

**RECOMMENDATION** — Bổ sung `MX01` cross-Tenant resource denial/cache isolation; `MX02` expired session/forbidden/Tenant suspended; `MX03` stale order/inventory mutation; `MX04` pagination/filter empty; `MX05` unknown Tenant/product; `MX06` bulk partial result nếu D15 duyệt bulk. Đây là verification frontend, không thay thế RLS/integration tests backend.

## 26. Error / Loading / Empty / Partial States

**APPROVED REQUIREMENT — PO-17** — Important screens có loading, empty, error, success, disabled và partial-data states.

**RECOMMENDATION** — State inventory cần đưa vào UX brief:

- Authentication: submitting, invalid input, generic credential error, session resolving, expired/reset token, account/Tenant locked theo contract.
- Connection: provider pending, awaiting shop confirmation, failed auth/confirm, quota blocked, success; success không đồng nghĩa sync completed.
- Sync: pending/running, known/unknown total, partial/failed/completed, per-item reasons, retry pending/rejected, connection lost, stale progress. Giữ kết quả thành công và không hiển thị nút vào Dashboard khi gate chưa mở.
- Manager pending: không invitation, có invitation, accepting, acceptance failed, ACTIVE vừa xác nhận, membership revoked; không show business skeleton như đang chuẩn bị cấp data khi biết user không có quyền.
- Catalog/Mapping: chưa có item, filter không kết quả, item chưa mapped, evidence thiếu, save validation/conflict, quota/upload failure, one-channel failure.
- Orders/Inventory: loading/empty, unauthorized action, stale record, API failure, save pending, sync pending/failed sau local save; không trộn trạng thái giao dịch với trạng thái đồng bộ.
- Storefront: Tenant not found/suspended, Product unavailable, SKU chưa chọn, no offers, out-of-stock, stale price, equal price, partial channels; chỉ highlight khi so sánh có cơ sở theo approved rule.
- Plan/features: loading entitlements, unavailable feature, exceeded quota và unknown policy; không dùng unknown như unlimited hoặc allowed.

Copy nói rõ điều gì đã thành công, điều gì còn lỗi và action nào khả dụng. Không biến timeout đọc trạng thái thành mutation failed chắc chắn. Error boundary giữ layout/navigation khả dụng khi phù hợp permission; retry chỉ hiện nếu operation có rule cho retry.

## 27. UI/UX Process — evon:ui-ux

**APPROVED REQUIREMENT — PO-17** — Dùng installed evon skill; Requirements baseline → screen objectives/UX brief → PO approval → 2–3 wireframe alternatives cho important flows → chọn hướng → implementation → responsive QA → state/error QA.

**DOCUMENTED REQUIREMENT — SRC-UX** — Nhánh U của skill: audit stack/components/style trước brief; U1 brief + U2 screen objectives là gate đầu; U3 lựa chọn wireframe là gate tiếp; U4 dựng và kiểm tra trực quan. Gate thiết kế này áp dụng ở bước UX sau, không cản việc viết MASTER_PLAN đã được user cho phép.

Audit hiện tại: chưa có components/styles để reuse; stack do PO chốt. Khi implementation được cho phép, audit lại trước khi dùng templates. Không tự đổi sang TypeScript dù example/template có TS.

**RECOMMENDATION** — Brief theo từng flow ghi actor, source requirement, primary task, thông tin để quyết định, primary action, access context, states và acceptance criteria. Không bịa research/persona hoặc nâng visual convention thành business rule.

Ưu tiên khám phá UX:

1. Owner onboarding: thấy điều kiện còn thiếu trước khi vào Merchant.
2. Marketplace connection: phân biệt authentication với shop confirmation.
3. Initial sync: progress, partial/quota failure và controlled recovery, không có bypass.
4. Manager Pending Store Access: giải thích rõ chưa gắn cửa hàng, Notifications dễ tìm.
5. Invitation acceptance: review Tenant/quyền và outcome ACTIVE.
6. Merchant Dashboard: tác vụ vận hành có quyền truy cập, không KPI giả chưa định nghĩa.
7. Product Mapping Review: evidence/candidates và quyết định cần con người.
8. Storefront detail/offers: SKU selection, marketplace/shop, price comparison và manual selection.

Mỗi alternative khác bố cục/phân cấp nhiệm vụ, không chỉ đổi màu. Skill mạnh về app screens; landing/storefront ecommerce nằm ngoài nhóm đã dạy đầy đủ, nên cần review riêng ở brief. Với Storefront chỉ Discovery/Compare/Redirect, không dùng checkout template kéo thêm scope.

Visual direction chưa được PO chốt: dùng flat làm recommendation khởi đầu của skill, đồng bộ tokens/component recipes, không coi màu/font mẫu là SmartOmni brand đã duyệt. UI primitives thuộc shared; business logic trong feature/service layer. QA dùng browser thực, screenshot, responsive ở 375px và desktop; kiểm overflow, chữ dài, empty/error/partial states. Accessibility target và yêu cầu keyboard/focus cần chốt D20, không tuyên bố chuẩn đạt được chỉ từ dùng shadcn/ui.

## 28. Implementation Roadmap

**RECOMMENDATION** — Roadmap theo dependency/milestone; chưa gán lịch ngày công khi chưa biết team capacity và decisions. Mỗi phase chỉ bắt đầu sau approval implementation phù hợp.

### Phase 0 — Baseline & Contract Readiness

Output: review MASTER_PLAN, decisions log cập nhật trong chính plan, scope P0 rõ, role/action matrix, Order/Inventory transitions và sync/mapping recovery rules. Ưu tiên D01–D11, D14–D17 trước các feature tương ứng; những D còn lại được giải quyết trước milestone phụ thuộc. Chốt provisional API semantics và acceptance scenarios. Exit: không còn ambiguity làm thay đổi hành vi của flow sắp dựng; không buộc mọi P2 decision phải xong mới bắt đầu P0.

### Phase 1 — UX Direction & Technical Foundation

Brief/wireframes theo mục 27; PO chọn hướng. Sau approval riêng mới scaffold đúng fixed stack, thiết lập shared components/tokens, routing/layout skeleton, access resolution, HTTP boundary và mock scenario harness. Exit: JavaScript/JSX only; layout và access skeleton được review, chưa claim feature complete.

### Phase 2 — Owner Onboarding Vertical Flow

Auth/role/profile → Tenant → Free/Pro → Shopee/TikTok authentication mock → shop confirmation → sync lifecycle/recovery → completed gate. Exit: happy path và every blocking state đạt AC ở mục 29; refresh/direct URL/retry không bypass hoặc duplicate work. Phụ thuộc quyết định quota/mapping recovery D01/D02/D03.

### Phase 3 — Manager Access & Merchant Foundation

Notifications, Manager locked shell, invitation review/acceptance, memberships/permissions và Dashboard operational shell; User/Manager Management. Exit: one-Tenant invariant, ACTIVE gate, revoked/forbidden states và account-scoped notifications đạt criteria.

### Phase 4 — Merchant Operations

Catalog → Variants/SKU → mapping review → listings → channels/subsequent sync → Orders/Inventory. Duyệt từng action trước implementation. Exit: coherent mock vertical flows, conflict/partial/quota feedback, correct role/plan gates. Có thể dựng Catalog trước Orders nhưng không đánh đồng hoàn thành Catalog với hoàn thành merchant MVP.

### Phase 5 — Storefront Core & P0 Acceptance

Public Tenant projection, Catalog/detail, selected SKU, offers, lowest price và manual redirect. Exit: không Customer commerce/account routes, scenarios MSF01–MSF07 đạt, P0 cả merchant và Storefront được nghiệm thu.

### Phase 6 — Backend Integration Readiness / Integration

Backend team phê duyệt concrete contracts; thay mock transport, giữ feature boundaries. Xác minh real auth, Tenant isolation, marketplace lifecycle, actual sync, concurrency, upload/PDF và provider errors; vận hành/observability cần thiết cho launch. Exit: integrated environment được test; không dùng mock success làm chứng cứ production readiness. Đây là kế hoạch future work, không permission viết backend trong task hiện tại.

### Phase 7 — P1 / P2 Delivery

Theo phase scope mục 19 và decisions tương ứng. Returns placement phải được chốt trước khi nghiệm thu Orders MVP. AI, billing, support và monitoring có briefs/contracts/acceptance riêng, không tự kích hoạt từ menu placeholders.

## 29. Acceptance Criteria by Major Feature

Các criteria từ PO được ghi **APPROVED REQUIREMENT**. Verification details là **RECOMMENDATION**. Criteria phụ thuộc TBD phải chốt trước khi test feature đó; không dùng assumption để cho test pass.

### AC01 — Identity, Roles & Membership

**APPROVED REQUIREMENT** — Role vocabulary chỉ gồm Tenant Owner, Tenant Manager, Customer (Guest), Super Admin. Manager registration thành công không tự tạo ACTIVE TenantMembership. Guest không có SmartOmni authentication flow.

**RECOMMENDATION** — Session resolving không flash business data; account role và membership có fixtures riêng; các user/session khác nhau không dùng chung tenant cache.

### AC02 — Owner Onboarding Gate

**APPROVED REQUIREMENT** — Owner phải đi qua initialize Tenant → plan → successful connection → initial sync COMPLETED. Pending/running/partial/failed không mở Dashboard; không có skip. Authentication success khi chưa confirm shop không đủ điều kiện.

**RECOMMENDATION** — Kiểm deep link, refresh, logout/login lại, Back và delayed responses; không action nào tự đặt onboarding complete ở client.

### AC03 — Plans & Shop Quota

**APPROVED REQUIREMENT** — Plan names Free/Pro; plan chọn trước connection. Free có 1 shop thì không thể thêm shop thứ hai, dù cùng hay khác platform. Có UX cho Shopee và TikTok Shop. Pro không được quảng bá unlimited khi chưa được duyệt.

**RECOMMENDATION** — Backend/mock quota failure được hiển thị đúng dù UI usage snapshot cũ; unknown entitlement không tự unlock. SKU quota counting chờ D07.

### AC04 — Connection Confirmation

**APPROVED REQUIREMENT** — Retrieve shop/account sau authentication, user confirm shop, sau đó connection mới success và auto-start initial sync. Auth/confirm failure có error/retry và không trigger sync.

**RECOMMENDATION** — Repeated UI submit/page remount không tạo trùng connections/jobs; nhiều shop candidates không bị chọn âm thầm.

### AC05 — Initial Sync & Recovery

**APPROVED REQUIREMENT** — Đủ pending/running/partially completed/completed/failed. Giữ successfully imported items khi partial/quota failure; hiển thị failures/rejections và controlled retry. Không whole-job rollback hoặc infinite auto-retry. Chỉ COMPLETED mở gate.

**RECOMMENDATION** — Unknown total không có fabricated percent; network failure khi đọc progress không đổi job thành failed chắc chắn; retry không nhân đôi success count/items. Zero-item/review/quota terminal outcomes chờ D01–D03.

### AC06 — Manager Restricted Access & Invitations

**APPROVED REQUIREMENT** — Manager chưa ACTIVE chỉ Notifications/Account/Logout; business data/features khóa kể cả direct URL. Invitation được nhận/review/accept qua Notifications; chỉ authoritative ACTIVE mới mở Merchant. Một Manager không thuộc nhiều Tenant; không Tenant switcher.

**RECOMMENDATION** — Accept failure không unlock; revoked membership mất business access và cached data; hai concurrent accepts không vượt one-Tenant invariant (mock contract scenario, backend test riêng sau).

### AC07 — Catalog Aggregation & Mapping

**APPROVED REQUIREMENT** — Product/Variant/SKU/Listing phân biệt; một SKU nhiều listings. Similar names không đủ auto-map; uncertain item có review state; authorized human xác nhận mapping.

**DOCUMENTED REQUIREMENT** — Catalog creation/edit/hide, SKU uniqueness trong Tenant, image management và mapping links còn được giữ (FR-018–FR-022, FR-032/FR-033), chi tiết D04–D07.

**RECOMMENDATION** — View mẫu có hai SKU trong một Product và nhiều listings trong một SKU để phát hiện việc gộp sai giá. Review conflict không silent overwrite; field ownership khi reimport được kiểm theo D06.

### AC08 — ChannelListings & Offer Comparison

**APPROVED REQUIREMENT** — So sánh đúng selected SKU/current selling price/available in-stock listings. Out-of-stock dù rẻ hơn không là lowest. Mỗi offer nhận diện marketplace/shop. Guest tự chọn bất kỳ available offer; redirect đúng listingUrl đó; không cheapest auto-redirect hoặc “best offer” label.

**RECOMMENDATION** — Kiểm một/nhiều offers, equal price, stale/missing price, no offers, đổi SKU và partial sync. Không tự quyết conversion/staleness rules; áp D14 sau duyệt.

### AC09 — Orders

**APPROVED REQUIREMENT** — Orders trong Merchant P0, gated theo role/membership/onboarding/Tenant/permission. Guest không lookup Orders.

**DOCUMENTED REQUIREMENT** — Danh sách/detail/history và các nghiệp vụ documented ở mục 14 phải được trace. **RECOMMENDATION** — Mutations chỉ theo action matrix D15; denied external action không báo thành công hay restock. Batch phải nêu per-item result nếu được đưa vào scope. Mock shipping label cần phân biệt asset demo với vận đơn thật.

### AC10 — Inventory

**APPROVED REQUIREMENT** — Inventory là Merchant P0, permission-gated.

**DOCUMENTED REQUIREMENT** — Quantity adjustment, conflict handling và outbound sync visibility. **RECOMMENDATION** — Stale update không overwrite âm thầm; internal save và channel sync có trạng thái riêng; formulas/stock effects chỉ test sau D17.

### AC11 — Dashboard / Notifications / Manager Management

**APPROVED REQUIREMENT** — Dashboard, Notifications và User/Manager Management trong P0. Manager chưa membership vẫn xem personal notifications để nhận invitation.

**RECOMMENDATION** — Không request tenant business summary cho restricted Manager; Tenant Owner invite/manage permissions theo D10/D11. Summary và CTA chỉ dùng approved metrics/capabilities; unread/read và notifications scope theo D23.

### AC12 — Storefront Boundary

**APPROVED REQUIREMENT** — Catalog → Product Detail → SKU-aware comparison → Redirect hoạt động end-to-end với mock data. Không xuất hiện Customer login/account/cart/checkout/tracking/history trong navigation, routes hoặc CTA.

**RECOMMENDATION** — Public response không chứa Merchant/private fields; unavailable Tenant/Product và no-offer UX rõ. View/click tracking không được dùng để khẳng định đã có marketplace purchase.

### AC13 — Access & Feature Gating

**APPROVED REQUIREMENT** — Frontend guards dùng access context đủ, backend authoritative. Free quota shop=1 và ACTIVE membership/onboarding gates được enforce trong scenarios.

**RECOMMENDATION** — Kiểm loading/forbidden/expired/revoked/suspended; changing fixture/session không làm lộ Tenant A data cho Tenant B. QA mock chỉ xác minh client/mock boundary, không chứng nhận RLS.

### AC14 — Frontend Technical & UX Quality

**APPROVED REQUIREMENT** — Đúng fixed stack và JavaScript/JSX, không TypeScript; mock-first có đường chuyển backend. Wireframe direction được chọn trước UI implementation; important states được thiết kế.

**RECOMMENDATION** — UI không import fixtures; mock mode không enable ngoài environment cho phép; primary flows có integration/E2E evidence, responsive review 375px/desktop và state/error review. Targets accessibility/performance ở D20.

### AC15 — Platform Boundary

**APPROVED REQUIREMENT** — Super Admin là role riêng; advanced monitoring deferred.

**RECOMMENDATION** — Không cấp platform access cho Owner/Manager, không mặc định platform role là Tenant member. Acceptance screens cụ thể được bổ sung khi D21 chốt minimum scope.

## 30. Risks and Dependencies

### 30.1. Product / UX risks

- **Onboarding deadlock**: quota hoặc mapping review có thể chặn COMPLETED trong khi Merchant tools còn khóa. Cần recovery trong onboarding, không shortcut bypass. D01/D02 là quyết định ưu tiên cao.
- **Mapping sai**: merge nhầm làm sai catalog, offers, order lines và inventory. Reliable identity/review boundary là prerequisite, D04–D06.
- **Price comparison gây hiểu nhầm**: stale/khác currency/khác SKU/missing sale validity. Same-SKU/in-stock rule đã chốt; remaining policies D14.
- **Permissions suy từ tên role cũ**: có thể mở quá quyền cho Manager. Cần action matrix, không copy role matrix legacy trực tiếp; D11.
- **Một Free shop không có cross-marketplace comparison**: đây là outcome hợp lệ, không lỗi UI. Demo nhiều offers dùng approved scenario context phù hợp, không lách Free quota.
- **Phase cut bị hiểu là xóa FR**: traceability mục 31 phải được cập nhật khi đổi scope; sign-off P0 không có nghĩa mọi FR/backend đã hoàn tất.

### 30.2. Backend / external dependencies

**DOCUMENTED REQUIREMENT** — Real system phụ thuộc auth/session, Tenant resolution/isolation, entitlements/usage, invitation acceptance, marketplace authorization/shop data, product APIs, async jobs, order webhooks/polling, inventory/Outbox, Cloud Storage/PDF và về sau AI/payment/APM.

**RECOMMENDATION** — Trước integration cần:

- Concrete API specifications, error semantics, pagination/filter conventions, ID/version/idempotency contract và public/private projections.
- Marketplace credentials/sandbox permissions và xác nhận provider capabilities/rate limits; chưa có bằng chứng tích hợp thật trong repository.
- Async delivery strategy: polling/SSE/websocket theo backend capabilities; không cam kết real-time SLA chỉ bằng frontend animation.
- Tenant isolation và authorization tests phía server; hostname, URL parameter hoặc cache key client không phải security boundary.
- Secret management/encryption server-side; frontend không thực thi HMAC Webhook, RLS, RabbitMQ, Redis locks hay Outbox transaction.
- Upload/PDF access contracts và provider job outcomes; constraints media/storage ở D20.

Các con số legacy như Webhook ACK 1–3 giây, Polling 2–5 phút và marketplace SLA trong diagrams là documented targets/examples, chưa xác minh với provider/current integration contract. Không biến chúng thành bảo đảm frontend.

### 30.3. Planning assumptions

**ASSUMPTION A01** — Merchant chủ yếu desktop, Storefront ưu tiên mobile; phải kiểm trong UX brief, không có user research xác nhận trong repo.

**ASSUMPTION A02** — Một app đáp ứng nhu cầu hiện tại; chưa có yêu cầu triển khai độc lập từng portal đủ mạnh để tách app. Domain/SEO decision D19 có thể làm thay đổi delivery configuration nhưng không tự thay fixed stack.

**ASSUMPTION A03** — Dữ liệu demo là synthetic, không cần secret thật hoặc marketplace account thật. Mock amounts/products không là business policy; quota/pricing rules trong fixtures phải chỉ rõ nguồn đã duyệt hoặc TBD scenario.

**ASSUMPTION A04** — Chưa có backend contract/schema/code ngoài các DOCX được cung cấp. Nếu bổ sung nguồn mới, reconcile theo authority, không mặc định frontend provisional contracts thắng backend/PO.

## 31. Deferred Scope & Requirements Traceability

### 31.1. Deferred khác với overridden

**APPROVED REQUIREMENT** — P1/P2 theo mục 19; giữ mọi FR documented để quản lý thay đổi. Customer account/cart/checkout/tracking không nằm trong current product scope vì PO đã loại bỏ, không chỉ là “chưa làm”. Optional onboarding import/skip và unlimited Pro legacy cũng không tự quay lại ở phase sau.

**RECOMMENDATION** — Mỗi backlog item sau này có source UC/FR, PO override nếu có, delivery phase, dependency, acceptance criterion và decision link. Những mục chưa được gán P0/P1/P2 rõ ràng được giữ scope TBD, không âm thầm loại bỏ.

Deferred documented capabilities cụ thể:

- Full BI/advanced Analytics: P1, D18.
- Forecasting/AI alerts/Promotion inputs: P1, D22; model training thuộc backend/AI track.
- Recommendation/Chatbot/Purchase Orders: P2; phải đặc tả lại data inputs và UC còn thiếu trước triển khai.
- Subscription changes/trial UX: P1; payment gateway thật P2; exact billing rules D24.
- Returns: conditional P0/P1, D16; không nghiệm thu FR-030 chỉ bằng cách có tab “Returns”.
- Support workflow/escalation và advanced platform monitoring/security/model history: P2, D21/D23.
- Scheduled price sync configuration/history: vẫn là documented requirement, UI phase D06/D14; giá listing/comparison cần ở P0 nhưng không đồng nghĩa đã có scheduler thật.
- Product images lifecycle: documented và liên quan Catalog P0; exact constraints D20, actual cloud integration ở integration track.
- Minimal Super Admin Tenant/plan management: scope D21; advanced monitoring đã được đưa P2.
- Real auth/email, queue/webhook/polling, transactional inventory/Outbox, RLS, provider calls: backend integration track, không phải functionality frontend mock đã hoàn thành.

### 31.2. UC coverage register

**DOCUMENTED REQUIREMENT** — Toàn bộ 43 UC được trace dưới đây; tên roles đọc theo PO-01:

- UC-01, UC-02, UC-03: auth/login/logout/password recovery; P0 mock foundation, security details D13, real service integration sau.
- UC-04, UC-05: Catalog/redirect, P0 được mở rộng bởi PO thành SKU-aware comparison.
- UC-06: Customer order tracking bị PO override, không build.
- UC-07: Recommendation P2; Cart/Checkout context bị override.
- UC-08, UC-09: Catalog/mapping P0, theo hierarchy và reliable-identifier rule mới.
- UC-10, UC-11: Orders/Inventory P0, action/quantity semantics D15/D17.
- UC-12: PDF labels documented, chốt scope/order action D15.
- UC-13: Returns/cancellation, D15/D16; restock rules D17.
- UC-14, UC-16: Forecasting alerts/Promotion, P1 scope D22.
- UC-15: Catalog images; frontend contract/scenarios, storage integration sau, D20.
- UC-17, UC-18: onboarding/connection P0, overridden ordering/gates/confirmation theo PO.
- UC-19: thay direct Manager account provisioning bằng self-registration/invitation membership P0.
- UC-20: full BI/Analytics P1; Dashboard P0 không tự có mọi KPI, D18.
- UC-21: initial plan selection P0 theo PO; subscription changes P1, D24.
- UC-22: optional initial import bị override; mandatory initial sync P0.
- UC-23: price sync control documented; phase/field source D06/D14.
- UC-24: quota alert documented; threshold/notification delivery D07/D23; quota blocking P0.
- UC-25, UC-26, UC-29: platform Tenant/plan management scope D21; Tenant suspended access scenario P0.
- UC-27, UC-28, UC-30, UC-31: advanced security/support/APM/model history deferred P2, chi tiết D21/D22/D23.
- UC-32, UC-33, UC-34: backend order ingestion/polling; frontend P0 mô phỏng outcomes, không implement workers.
- UC-35: Forecasting P1 UI, backend AI dependency.
- UC-36: Recommendation computation P2; sửa behavioral inputs theo Guest model mới.
- UC-37: AI training/rollback deferred cùng AI features; Forecasting dependency P1, Recommendation dependency P2.
- UC-38, UC-39: real RLS/security testing thuộc backend integration; frontend/mock isolation tests bổ trợ.
- UC-40: inventory Outbox dependency; P0 visibility/mock outcomes, transaction/worker ở backend.
- UC-41: P0 feature/permission/quota UX và mock enforcement; real middleware integration sau.
- UC-42: mandatory initial sync P0 UX/mock; reliable mapping bổ sung; real imports sau.
- UC-43: channel prices/availability display P0; real scheduled updates và configuration details D06/D14/integration track.

### 31.3. FR coverage register

Priority “Bắt buộc/Nên có/Có thể có” giữ nguyên ở SRC-UC. Danh sách này mô tả cách xử lý/delivery, không viết lại priority gốc. Các ranges bao phủ liên tục FR-001 đến FR-093.

- **FR-001–FR-006**: auth/JWT/locked-Tenant/logout/reset/hash. Frontend mock/session/recovery scope; revoke semantics D13; JWT issuance/password hashing phải ở backend. Không coi mock là fulfillment của backend requirements.
- **FR-007**: brute-force protection documented “Nên có”; mock locked state có thể cover, enforcement/threshold D13/integration.
- **FR-008–FR-009**: Tenant Catalog/Product Detail, giữ P0, bổ sung hierarchy/offer projection theo PO.
- **FR-010**: View events giữ trace; capture contract P0 recommendation, Recommendation consumption P2; privacy/identity D22.
- **FR-011–FR-013**: marketplace choice/redirect/click event, giữ P0 theo same-SKU/manual-selection rule; CTR formula D18.
- **FR-014–FR-015**: Customer order lookup và lookup errors bị PO override; không build route/UI.
- **FR-016–FR-017**: Recommendation/top 3/paid entitlement documented, deferred P2; exact entitlements D08/D22, Cart context không còn.
- **FR-018–FR-022**: Catalog/SKU/visibility/duplicates/quota/listing links/domain validation giữ P0, identifier/counting/URL capabilities D04–D07/D09.
- **FR-023–FR-025**: Order list/internal status/idempotency giữ; P0 UI + mock, transition D15, true idempotency integration dependency.
- **FR-026–FR-028**: Inventory view/adjust/concurrency/outbound sync giữ; P0 UI + mock outcomes, D17 và backend integration.
- **FR-029**: PDF labels documented “Nên có”; placement D15, không âm thầm coi mandatory hay bỏ.
- **FR-030**: Returns/cancel/restock documented “Bắt buộc”; phase/rules D15/D16/D17, không xóa theo roadmap.
- **FR-031**: AI inventory alerts documented “Bắt buộc”, deferred P1 cùng Forecasting; không đổi priority gốc.
- **FR-032–FR-033**: image lifecycle và tenant-specific cloud storage; Catalog frontend scope, D20 và real storage dependency.
- **FR-034**: Promotion input documented “Nên có”; P1 Forecasting scope/rules D22; Manager write permission D11.
- **FR-035–FR-037**: self-service Tenant/unique subdomain/tenant identity giữ P0 onboarding, allocation/enforcement backend authoritative.
- **FR-038–FR-039**: provider credentials encryption/Webhook URL giữ technical intent; actual authentication/shop confirmation theo PO, mechanism D09 và backend dependency.
- **FR-040**: direct Manager account creation overridden bởi Manager self-registration + invite/accept + ACTIVE membership; P0 replacement theo PO-01/02.
- **FR-041–FR-042**: full BI Revenue/CTR/RMSE/filtering documented, advanced Analytics P1; Dashboard P0 subset D18, không tự đánh dấu toàn FR-041 complete.
- **FR-043–FR-044**: upgrade/downgrade/resource checks giữ documented; P1 subscription UX D24, initial plan selection P0 không thay thế hoàn toàn các FR này.
- **FR-045**: quota threshold alerts giữ, threshold D07/D23; không hardcode ví dụ 90% như approved rule.
- **FR-046–FR-047**: optional onboarding import/config bị PO override; mandatory auto-start sync thay thế, không có checkbox yes/no.
- **FR-048–FR-049**: price sync enable/schedule/manual controls giữ documented; scope/ownership/timing D06/D14, không suy từ initial mandatory import thành mọi price sync đều bắt buộc.
- **FR-050–FR-052**: Tenant directory/filter/lock giữ documented, core platform scope D21.
- **FR-053**: locked Tenant access denial giữ, P0 state/access mocks và real enforcement integration dependency.
- **FR-054–FR-055**: RLS audit/support UI giữ, advanced/security/support deferred P2; không nhầm client logs với real RLS monitoring.
- **FR-056–FR-057**: plan definitions/affected-Tenant warning giữ, D21/D24; plan selection P0 không bằng plan-definition administration.
- **FR-058–FR-060**: APM/alert thresholds/AI model history deferred, advanced console P2; model metadata backend AI track, D21/D22.
- **FR-061–FR-068**: Tenant resolution/HMAC/ACK/queue/consumer/retry/polling/backoff thuộc backend integration; frontend P0 chỉ mô phỏng trạng thái/kết quả có liên quan. Giữ documented targets, chưa bảo đảm thực thi.
- **FR-069–FR-071**: Forecasting/RMSE/reorder suggestions documented, P1 AI feature/backend track; không suy thành Purchase Order creation P1.
- **FR-072**: Recommendation similarity computation deferred P2.
- **FR-073–FR-074**: per-Tenant training/rollback/model registry giữ, AI integration theo P1 Forecasting/P2 Recommendation; evaluation rule D22.
- **FR-075–FR-077**: RLS/database scope/cross-Tenant tests giữ, bắt buộc server validation khi integration; mock isolation không thay thế.
- **FR-078–FR-080**: transaction Outbox/publisher/retry classification giữ, backend inventory integration; frontend status visibility, retry policy D03.
- **FR-081–FR-083**: feature limits/errors/cache refresh giữ; P0 frontend/mock + backend enforcement sau; không chỉ ẩn button.
- **FR-084–FR-089**: product fetch/map/pagination/upsert/quota/errors giữ và điều chỉnh theo PO mandatory sync/reliable identifiers/preserve success/controlled retry; completion/recovery D01–D07.
- **FR-090–FR-093**: scheduled price fetch/channel-specific prices/anomaly review/history giữ; channel price projection P0, automatic sync/control/history scope D06/D14/integration. Ví dụ giảm hơn 50% chưa là threshold đã duyệt.

### 31.4. PO additions chưa có UC/FR tương ứng đầy đủ

Account–membership separation, Manager self-registration/Notifications invitation gate/one-Tenant rule, Owner initial sync COMPLETED gate, Free one-shop quota, reliable mapping review và SKU-aware offer comparison phải có acceptance coverage độc lập AC01–AC08. Không đợi nguồn DOCX cũ bổ sung mã mới mới xem chúng là approved requirements.

## 32. PRODUCT OWNER DECISIONS REQUIRED

Các quyết định sau chưa được prompt mới chốt. Chúng không mở lại các rule đã duyệt như mandatory connection, sync COMPLETED gate, one-Tenant Manager, no Customer commerce, Free one-shop hay same-SKU in-stock lowest price. “Trước P0 feature” nghĩa là trước implementation/acceptance của feature liên quan, không ngăn viết kế hoạch hiện tại.

### D01 — Initial sync completion & onboarding recovery

**TBD / PRODUCT OWNER DECISION REQUIRED — Trước Owner flow.** Job nhập 0 items có được COMPLETED không? Mapping REVIEW_REQUIRED có chặn COMPLETED không? Nếu có, Owner resolve mapping ở recovery flow như thế nào khi Merchant còn khóa? Job/attempt nào quyết định initial completion sau retry, và completion có cần toàn bộ eligible imported items thành công? Không tự convert partial sang completed hoặc loại items lỗi để mở gate.

### D02 — Quota recovery & import prioritization

**TBD / PRODUCT OWNER DECISION REQUIRED — Trước sync recovery.** Khi quá quota, chọn/prioritize products ra sao; có được chọn subset, thay đổi plan hoặc loại rejected items khỏi requested scope trong onboarding không? Điều kiện nào sau remediation cho phép job hoàn tất? Giữ success và gate COMPLETED là rules đã chốt; recovery action chưa chốt.

### D03 — Retry policy & async lifecycle

**TBD / PRODUCT OWNER DECISION REQUIRED — Trước sync mutations.** Eligible errors/items, manual/automatic retry, số lần/delay/cancel/resume policy và quyền retry; cách counts tích lũy qua attempts. Chốt policy riêng cho initial product sync, price sync, Outbox và order ingestion; reconcile retry cutoff trong Luồng 4 với FR-080. Polling interval là technical choice cần backend SLA, không copy máy móc từ order polling sang product sync UI.

### D04 — Reliable identifiers & mapping decisions

**TBD / PRODUCT OWNER DECISION REQUIRED — Trước import/mapping.** Identifier nào đủ tin cậy; namespace/uniqueness; confidence rule; approved review actions (link/create/reject/remap/unlink), collision handling và audit expectations. Similar product name đơn lẻ đã bị cấm làm tiêu chí auto-merge.

### D05 — Product / Variant / SKU cardinality

**TBD / PRODUCT OWNER DECISION REQUIRED — Trước Catalog contract.** Variant–SKU relationship, simple products, bundles/units nếu có, SKU uniqueness/auto-generation/change, channel external ID scope và nhiều listings cùng shop. Không tự đưa multi-warehouse/bundle vào scope vì tên SKU.

### D06 — Import ownership, upsert & price-sync controls

**TBD / PRODUCT OWNER DECISION REQUIRED — Trước Catalog editing/reimport.** Fields nào do internal catalog hay marketplace làm source of truth; overwrite manual edits khi import lại; deletion/delisting handling; price sync toggle/schedule/manual trigger/history có phase nào? Mandatory initial sync không tự giải quyết ongoing sync policy.

### D07 — Free SKU/storage quota & counting

**TBD / PRODUCT OWNER DECISION REQUIRED — Trước quota acceptance.** Xác nhận áp dụng Free 100 SKU documented vào model mới; đếm SKU active/hidden/review/imported thế nào, có trừ quota khi hide/delete không; storage quota và warning threshold nào được duyệt? Free 1 shop connection đã chốt, không cần quyết định lại platform-versus-shop.

### D08 — Pro limits & feature entitlements

**TBD / PRODUCT OWNER DECISION REQUIRED — Trước plan gating.** Shop/SKU/storage limits và feature permissions của Pro; entitlement matrix Free/Pro cho P0/P1/P2. Không kế thừa unlimited Pro từ tài liệu cũ, không invent price hoặc trial.

### D09 — Marketplace authorization & connection lifecycle

**TBD / PRODUCT OWNER DECISION REQUIRED — Trước connection contract, phối hợp integration lead.** Provider flow OAuth/credential cụ thể, shop ownership/duplicate shop policy, same shop ở nhiều Tenant có được phép không, reconnect/disconnect/token expiry và mất connection sau onboarding xử lý access thế nào? Authentication + shop confirmation để connection success đã chốt.

### D10 — Invitation & membership lifecycle

**TBD / PRODUCT OWNER DECISION REQUIRED — Trước Manager flow.** Invitation đến account đã có/chưa có, email identity matching, expiry/decline/cancel/revoke, nhiều invitations pending, concurrent acceptance và membership revoked có được nhận Tenant khác không? Rule Manager một Tenant và không Tenant switching giữ nguyên; cần phân biệt một ACTIVE Tenant tại thời điểm hay giới hạn suốt vòng đời account.

### D11 — Action-level RBAC

**TBD / PRODUCT OWNER DECISION REQUIRED — Trước Merchant mutations.** Permissions mặc định/custom của Manager cho Catalog, Mapping Review, Channels, Sync Retry, Orders, Inventory, Manager Management, Notifications, Analytics, Price Sync và Promotion. Ai có quyền approve mapping/bulk actions? Owner có Tenant management capabilities đã chốt, không đồng nghĩa Manager kế thừa toàn bộ.

### D12 — Owner account & Tenant cardinality

**TBD / PRODUCT OWNER DECISION REQUIRED — Trước Owner membership/session contract.** Một Owner có bao nhiêu Tenant; mỗi Tenant có bao nhiêu Owner; Owner có TenantMembership record theo model chung không; Owner/Manager roles có thể đổi hoặc cùng tồn tại trên một account không; ownership transfer nếu cần thuộc phase nào? Không thiết kế Owner Tenant switcher cho đến khi có requirement.

### D13 — Authentication/session lifecycle

**TBD / PRODUCT OWNER DECISION REQUIRED — Trước auth acceptance, phối hợp backend lead.** Email verification, email uniqueness/case normalization, reset/login lock rules, expiry/refresh/revocation, sign-out semantics và session behavior khi Tenant khóa. Backend chọn secure session transport/storage cụ thể; mock session không xác lập production security policy.

### D14 — Current selling price & exceptional offer comparison

**TBD / PRODUCT OWNER DECISION REQUIRED — Trước Storefront comparison acceptance.** Cách resolve regular/sale/current price và validity; currency scope/conversion nếu có; stale threshold; equal-lowest display/order; thiếu giá; out-of-stock hiển thị hay ẩn; refresh/revalidation khi redirect; price anomaly approval. Cùng SKU, chỉ available/in-stock và Customer tự chọn là rules đã chốt. Không tự gộp shipping/voucher vào một “best offer”.

### D15 — Orders state/action matrix

**TBD / PRODUCT OWNER DECISION REQUIRED — Trước Orders actions.** External/internal status mapping, allowed transitions, Arrange Shipment/pickup/drop-off/cancel/batch actions, PDF/batch print scope, partial batch result, source of SLA/deadline, manual/offline orders có nằm MVP không. Reconcile UC-10/FR-024 với Luồng 3b/15; không cho phép đổi trạng thái marketplace tùy ý như workaround.

### D16 — Returns/cancellation boundary & MVP placement

**TBD / PRODUCT OWNER DECISION REQUIRED — Trước final Orders MVP sign-off.** Returns vào P0 hay P1; partial returns, Refund Only, physical inspection, dispute/evidence/video và refund responsibility. Chốt triggers restock cùng D17; không biến mọi return event thành cộng kho tự động. Marketplace windows trong diagram cần xác minh provider, không mặc định một SLA cho mọi sàn.

### D17 — Inventory semantics

**TBD / PRODUCT OWNER DECISION REQUIRED — Trước Inventory mutations.** Physical/available/reserved formula; reservation/deduction/release/restock timing; absolute/delta adjustment; warehouse/unit scope; negative stock/oversell resolution; cancellation/return effects và reconciliation. Concurrency mechanics do backend lead chọn sau khi business semantics rõ.

### D18 — Dashboard metrics, BI & attribution

**TBD / PRODUCT OWNER DECISION REQUIRED — Trước Dashboard metrics; full BI trước P1.** P0 widgets/operational counts; Revenue/Gross/Net Payout/CTR formulas, order states/time basis, returns/fees/taxes treatment, Storefront attribution, analytics timezone và reporting freshness. Không coi outbound click là purchase hoặc Storefront revenue.

### D19 — Deployment, Storefront presentation & localization

**TBD / PRODUCT OWNER DECISION REQUIRED — Trước public route/UX sign-off.** Host/subdomain strategy, SEO expectations với Vite, tenant branding/settings fields, ngôn ngữ UI/currency display/timezone locale, Catalog discovery filters và full landing page scope. Không chuyển sang Next.js/TypeScript để tự giải quyết yêu cầu này.

### D20 — Non-functional targets & media constraints

**TBD / PRODUCT OWNER DECISION REQUIRED — Trước QA targets; phối hợp tech/backend leads.** Supported browsers/devices, performance/data volume targets, accessibility target, image/video limits/formats/storage, sync freshness/SLA, upload/PDF retention/access và audit expectations. Chọn backend runtime/provider ở integration design; không triển khai chúng trong frontend plan task.

### D21 — Minimum Super Admin MVP

**TBD / PRODUCT OWNER DECISION REQUIRED — Trước platform implementation.** P0 chỉ role/access foundation hay có Tenant list/detail/lock-unlock/plan definitions? Actions ảnh hưởng Tenant cần permissions/reason/audit scope. Advanced monitoring đã deferred P2, không hỏi lại việc đó.

### D22 — AI/Recommendation/Chatbot/Purchase Orders details

**TBD / PRODUCT OWNER DECISION REQUIRED — Trước P1 Forecasting hoặc P2 feature tương ứng.** Forecasting eligibility/cold-start/threshold/model metrics và Promotion rules; Guest interaction identity/consent và purchase attribution cho Recommendation sau khi bỏ Cart; Chatbot knowledge scope/entitlements; Purchase Orders flow/actors chưa được đặc tả. Không tự dựng PO module từ tên Luồng 16.

### D23 — Notifications & support behavior

**TBD / PRODUCT OWNER DECISION REQUIRED — Invitation notifications trước P0; mở rộng sau.** Ngoài invitation, loại notification nào trong MVP; personal versus Tenant recipients, read/unread/actions/retention/delivery timing, email hay in-app; quota/sync/order alerts có policy nào? Support SLA/escalation và ticket workflow thuộc deferred scope. Invitation qua Notifications là requirement đã chốt.

### D24 — Subscription changes / trial / billing policies

**TBD / PRODUCT OWNER DECISION REQUIRED — Nếu dùng plan change cho quota recovery thì trước flow đó; còn lại trước P1/P2.** Upgrade/downgrade effect time, resource cleanup/hide/delete, active jobs khi hạ gói, plan definition changes với Tenant đang dùng, trial eligibility/duration, pricing/cycles/refunds/proration. Real payment P2; chọn Free/Pro ban đầu không tự yêu cầu payment.

## 33. Definition of Done

### 33.1. Done cho planning deliverable hiện tại

- Chỉ `docs/MASTER_PLAN.md` được tạo/cập nhật; không thay DOCX, skills, packages hoặc app source.
- Có đủ 33 nhóm nội dung yêu cầu; approved/documented/recommendation/assumption/TBD phân biệt rõ.
- PO baseline mới override requirements cũ xung đột và terminology được chuẩn hóa.
- UC-01–UC-43 và FR-001–FR-093 có coverage register; deferred khác overridden.
- Architecture, route groups, access/state boundaries, mock contract/scenario catalogue, roadmap và acceptance criteria đều ở mức planning.
- Unresolved contradictions có source và decision IDs; không tự invent missing rules hoặc mở gate đã bị PO cấm.
- Dừng sau bàn giao plan để PO review và phê duyệt trước implementation.

### 33.2. Proposed DoD cho frontend MVP sau khi được phép triển khai

**RECOMMENDATION** — P0 có scope sign-off và các decisions ảnh hưởng behavior đã được giải quyết; triển khai đúng fixed stack, không TypeScript; important flows qua brief/wireframe approval của evon workflow.

- AC01–AC15 được nghiệm thu theo scope đã duyệt, kể cả conditional actions; không đánh dấu complete khi một business rule vẫn TBD.
- Owner onboarding/Manager invitation/Merchant/Storefront chạy end-to-end với mock contracts và deterministic scenarios; đầy đủ loading/empty/error/disabled/partial states.
- Có meaningful automated checks cho gates, scoped data, mapping review và price comparison; browser E2E cho Owner và Manager cùng Guest offer selection; visual/responsive QA. Không lấy test mirror implementation làm bằng chứng nghiệp vụ đúng.
- Feature components không phụ thuộc trực tiếp mock fixtures; transport có thể đổi sang real API qua documented adapters; mock mode được kiểm soát.
- Không Customer commerce/tracking, Manager multi-Tenant switcher, onboarding skip, unlimited Pro claim hay auto-merge name-only.
- Backlog/deferred FR còn được trace; demo data và mock capabilities được ghi rõ, không trình bày như kết nối marketplace/AI/payment thật.

### 33.3. Production readiness là gate riêng

**RECOMMENDATION** — Cần real backend authorization/tenant isolation/session behavior, provider integration, reliable sync/idempotency/concurrency, operational monitoring cần thiết, performance/security/acceptance evidence theo agreed targets. Frontend mock DoD không thay thế backend/RLS tests và không chứng nhận hệ thống sẵn sàng vận hành thương mại.
