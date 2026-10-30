# Account APIs — FE integration, 30/10/2026

This document supersedes older account/onboarding limitations in the 28/10 API inventory. Contracts are based on the API review of BE develop `41aafb7` already provided in this chat. This implementation changes FE only.

## Connected routes

- `/auth/register/customer`: `POST /api/v1/auth/register`, sending `full_name`, `email`, `password`, optional phone and a store subdomain. The response supplies `access_token`, `refresh_token`, `user_info`; the user opens `/customer/profile`. Registration creates a CUSTOMER, not a workspace administrator or staff member.
- `/merchant/profile`, `/admin/profile`, `/customer/profile`: `GET /api/v1/users/me`; save the profile via `PUT /api/v1/users/me` (`full_name`, `phone`, `avatar`), or save just contact fields via `PATCH /api/v1/users/me` (`phone`, `avatar`). API errors preserve the draft. Profile responses update the session display without replacing JWTs.
- The profile page submits `POST /api/v1/auth/change-password` with `current_password`, `new_password`, `confirm_password`. New passwords allow 6–100 characters. The success screen offers a fresh sign-in and clears password fields.
- `/merchant/users`: `GET /api/v1/users` with `keyword`, `status`, `role`, `page`, `size`, `sortBy`, `sortDir`. Pagination uses `total_pages` and `total_elements`, separate from Spring Page responses used by tenant APIs.
- Create account: `POST /api/v1/users`, with `email`, `password`, `full_name`, `phone`, `avatar`, `role`. The UI requires an initial password so a randomly generated, undisclosed password does not leave the new user unable to sign in.
- Edit account: `PUT /api/v1/users/{id}`, with profile fields. Role assignment has a separate confirmation using `PUT /api/v1/users/{id}/roles` and `{ "roles": ["MANAGER"] }`. Only one role is sent.
- Disable/enable account: confirmed `PATCH /api/v1/users/{id}/status` with `ACTIVE` or `DISABLED`. Canceling the dialog makes no request. Changing one's own role or disabling one's own account clears the local session.

## Contract compatibility

- Auth reads `user_info.full_name`, with a fallback for the older `fullName` response. Phone and avatar are retained in the session. Passwords are not persisted to browser storage.
- Reset password now sends `token`, `new_password`, `confirm_password` and accepts new passwords of 6–100 characters.
- Admin tenant provisioning uses the new `POST /api/v1/tenants` alias. It includes administrator email/password (`adminEmail`, `adminPassword`) as well as existing company/subdomain/contact/plan fields. Administrator credentials are cleared on success, never persisted to browser storage, and never included in success messages.
- Self-service Staff/Owner registration remains unavailable: public register creates CUSTOMER accounts. Workspace account creation is available to the roles accepted by the management API.

## BE authorization limitation

The reviewed UserController uses `hasAnyRole('ADMIN','TENANT_OWNER')` for all five user-management endpoints. FE checks the original backend role, not the display role (TENANT_ADMIN and ADMIN are both displayed as Tenant Owner elsewhere). Therefore TENANT_ADMIN, MANAGER, CUSTOMER and SUPER_ADMIN do not receive user-management navigation, and opening the URL does not fetch that API. Backend authorization remains authoritative; denied requests display the server error. If other roles should have access, the BE contract needs to change first.

## Validation

Playwright tests in `tests/api-accounts.spec.js` cover registration/conflict, authenticated profile GET/PUT/PATCH, unchanged JWTs, error draft retention, password confirmation, snake_case requests and pagination, user mutations, confirmation before status changes, forbidden-role navigation, and 375px/1440px layouts. Existing tenant tests now verify administrator provisioning via the new alias and credential clearing.

These tests use mocked HTTP responses. An attempted live check on 30/10/2026 could not reach `http://127.0.0.1:8080` (`ECONNREFUSED`), so the new APIs have not been verified against a running backend during this implementation.

Completed checks: ESLint without warnings; Vite production build; all 44 API browser tests passed. Profile/user directory screenshots were inspected at 375px and 1440px.
