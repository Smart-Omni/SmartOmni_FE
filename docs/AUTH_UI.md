# Authentication and tenant registration flow

## Current flow

Tenant Owner account registration ends before workspace setup:

1. `/auth/register/owner`: full name, email, password, confirmation. No store details, plan, connection or import stepper.
2. Completion preview: explains that account creation is not connected and offers **Continue to sign in**. This does not authenticate or create a tenant.
3. `/auth/login?setup=1`: the existing sign-in form. A successful Owner demo sign-in opens setup; other roles retain their own destinations.
4. `/merchant/setup/plan`: choose a temporary Free/Pro plan.
5. `/merchant/setup/channels`: configure store name/subdomain, save details, connect and explicitly confirm demo shops.
6. `/merchant/setup/import`: explicitly start the import preview and inspect a simulated result.
7. `/merchant/setup/welcome`: review the setup, then open the existing demo dashboard.

The registration form retains the existing compact AuthLayout, FormField, PasswordField and Button styles. Store configuration retains the wider wizard layout. No new mobile styling or dark theme is introduced.

## Routing and prerequisites

The setup subtree requires an existing ACTIVE Tenant Owner demo session. Suspended tenants are routed to their existing access screen. Guests go to sign-in; Customer, Staff and Admin do not enter Owner setup. The old `/auth/register/owner/plan`, `/channels`, `/import` and `/welcome` URLs redirect to the corresponding guarded setup route.

Plan selection is required before configuration. Valid saved store details and at least one confirmed demo shop are required before import. Only a COMPLETED import preview unlocks Welcome. Free permits one shop total across marketplaces. Pro's fixture connections do not define production limits. Partial/failed outcomes require retry and do not unlock Welcome.

Changing plan clears connections and import progress. Editing saved store details also clears connections/import, while retaining the chosen plan. Unsaved store edits disable continuing to import. Restart clears setup fields and progress, retaining the signed-in identity. Refresh or leaving setup discards the reducer state. History entries recheck session and prerequisites, including after sign-out.

## Prototype boundaries

There is no new account store, registration API, email verification, credential persistence, DNS provisioning, payment, OAuth connection or live import. Registration passwords remain component-local and are cleared on valid submission. Registered form values are not passed to sign-in or treated as working credentials. Use the existing Owner fixture documented in README to explore setup.

Account sessions continue using the existing demo authentication mechanism. Normal `/auth/login` destinations are preserved; `setup=1` opts an Owner into the setup preview. The fixture Owner already has a workspace: opening its dashboard does not apply preview plan/catalog selections or create an additional tenant.

Domain format and availability checks reuse the existing local demo-domain validator. `.smartomni.example` is a preview address and is never reserved. Connection and import scenarios remain explicit fixtures with no API calls. Credentials, profile submissions and import progress are not written to storage by this flow.

Staff and Customer registration behavior is unchanged. Route guards demonstrate frontend navigation only; production authorization and registration remain backend responsibilities.

## Verification

`tests/onboarding.spec.js` covers account-only registration, validation and credential clearing, sign-in before setup, guest and role guards, old URLs, plan/configuration/import prerequisites, invalidation, logout/history and desktop screenshots. Existing Staff/role-selection coverage is retained. `tests/public-uc-completion.spec.js` checks the moved domain configuration and preserves public assistant/customer scenarios. Customer and storefront regression suites verify existing entry points.
