import { test, expect } from '@playwright/test'

const owner = { id: 7, email: 'owner@example.test', role: 'TENANT_ADMIN', tenant_id: 42, subdomain: 'test-store' }
const staff = { id: 8, email: 'staff@example.test', role: 'STAFF', tenant_id: null }
const auth = (user, token = 'access-test') => ({ access_token: token, refresh_token: token + '-refresh', user_info: user })
const ok = (route, data) => route.fulfill({ json: { success: true, data } })

async function signIn(page, handle, user = owner) {
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url())
    if (!url.pathname.startsWith('/api/')) return route.continue()
    if (url.pathname === '/api/v1/auth/login') return ok(route, auth(user))
    if (url.pathname === '/api/v1/tenants/subscription/status') return ok(route, { status: 'ACTIVE' })
    if (url.pathname === '/api/v1/marketplace-connections/shopee') return ok(route, null)
    if (await handle(route, url, route.request().method())) return
    throw new Error('Unexpected API request: ' + route.request().method() + ' ' + url.pathname)
  })
  await page.goto('/auth/login')
  await page.getByLabel('Email address').fill(user.email)
  await page.getByLabel('Password', { exact: true }).fill('Example@123')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(user.tenant_id ? /\/merchant\/shops$/ : /\/merchant\/invitations$/)
}

test('owner sends and revokes an invitation for an existing STAFF account', async ({ page }) => {
  const base = '/api/v1/users/invitations'
  let invited
  await signIn(page, async (route, { pathname }, method) => {
    if (pathname === base && method === 'GET') { await ok(route, invited ? [invited] : []); return true }
    if (pathname === base && method === 'POST') {
      expect(route.request().postDataJSON()).toEqual({ email: staff.email, role: 'STAFF' })
      invited = { id: 15, invitedEmail: staff.email, status: 'PENDING' }
      await ok(route, invited)
      return true
    }
    if (pathname === base + '/15' && method === 'DELETE') { invited.status = 'CANCELLED'; await ok(route, null); return true }
    return false
  })
  await page.goto('/merchant/invitations')
  await page.getByLabel('Staff email address').fill(staff.email)
  await page.getByRole('button', { name: 'Send invitation' }).click()
  await page.getByRole('button', { name: 'Revoke invitation' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click()
  await expect(page.getByRole('cell', { name: 'CANCELLED' })).toBeVisible()
})

test('unassigned staff accepts an invitation and uses the new tenant token', async ({ page }) => {
  const base = '/api/v1/users/me/invitations'
  await signIn(page, async (route, { pathname }, method) => {
    if (pathname === base) { await ok(route, [{ id: 15, companyName: 'Demo Shop', status: 'PENDING' }]); return true }
    if (pathname === base + '/15/accept') {
      expect(method).toBe('POST')
      await ok(route, auth({ ...staff, tenant_id: 42, subdomain: 'test-store' }, 'joined-access'))
      return true
    }
    return false
  }, staff)
  await page.getByRole('button', { name: 'Accept invitation' }).click()
  const connection = page.waitForRequest(request => new URL(request.url()).pathname === '/api/v1/marketplace-connections/shopee')
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click()
  await expect(page).toHaveURL(/\/merchant\/shops$/)
  expect((await connection).headers().authorization).toBe('Bearer joined-access')
})

test('internal order actions use the order ID for status and marketplace reference for tracking', async ({ page }) => {
  const base = '/api/v1/orders'
  const order = { id: 17, platform: 'SHOPEE', platformOrderId: 'ORDER-17', status: 'PENDING', source: 'MANUAL' }
  await signIn(page, async (route, url, method) => {
    if (url.pathname === base) { await ok(route, { content: [order], totalPages: 1 }); return true }
    if (url.pathname === base + '/17') { await ok(route, order); return true }
    if (url.pathname === base + '/17/status') {
      expect(method).toBe('PATCH')
      expect(url.searchParams.get('status')).toBe('TO_SHIP')
      order.status = 'TO_SHIP'
      await ok(route, order)
      return true
    }
    if (url.pathname === base + '/tracking') {
      expect(method).toBe('PATCH')
      expect(route.request().postDataJSON()).toEqual({ platform: 'SHOPEE', platform_order_id: 'ORDER-17', tracking_number: 'TRACK-17' })
      order.trackingNumber = 'TRACK-17'
      await ok(route, order)
      return true
    }
    return false
  })
  await page.goto('/merchant/staff/orders')
  await page.getByRole('button', { name: 'View order details' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Mark ready to ship' }).click()
  await dialog.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(dialog.getByText('Status: TO_SHIP', { exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: 'Update tracking' }).click()
  await dialog.getByLabel('Tracking number').fill('TRACK-17')
  await dialog.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(dialog.getByText(/Tracking: TRACK-17/)).toBeVisible()
})

test('TikTok catalog runs auto-import and updates the selected SKU price', async ({ page }) => {
  const sku = { tiktokProductId: 'P1', tiktokSkuId: 'S1', productName: 'Tee', sellerSku: 'TEE', mapped: false, currentPrice: 100, currency: 'VND' }
  await signIn(page, async (route, { pathname }, method) => {
    if (pathname === '/api/v1/tiktok/catalog') { await ok(route, [sku]); return true }
    if (pathname === '/api/v1/tiktok/catalog/auto-import') {
      expect(method).toBe('POST')
      sku.mapped = true
      sku.localSkuCode = 'LOCAL-TEE'
      await ok(route, { status: 'COMPLETED', importedCount: 1, linkedExistingCount: 0, skippedCount: 0 })
      return true
    }
    if (pathname === '/api/v1/tiktok/products/price') {
      expect(method).toBe('PUT')
      expect(route.request().postDataJSON()).toEqual({ productId: 'P1', skuId: 'S1', originalPrice: 124 })
      sku.currentPrice = 124
      await ok(route, {})
      return true
    }
    return false
  })
  await page.goto('/merchant/staff/tiktok-catalog')
  await page.getByRole('button', { name: 'Run auto-import' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.getByRole('cell', { name: 'LOCAL-TEE' })).toBeVisible()
  await page.getByRole('button', { name: 'Edit SKU price' }).click()
  await page.getByLabel('New price (VND)').fill('124')
  await page.getByRole('button', { name: 'Confirm price change' }).click()
  await expect(page.getByRole('cell', { name: '124 VND' })).toBeVisible()
})

test('TikTok buyer cancellation is only approved after confirmation', async ({ page }) => {
  const base = '/api/v1/tiktok/cancellations'
  const cancellation = { cancel_id: 'C1', order_id: 'O1', cancel_status: 'CANCELLATION_REQUEST_PENDING' }
  let approvals = 0
  await signIn(page, async (route, { pathname }, method) => {
    if (pathname === '/api/v1/tiktok/aftersale/reasons') { await ok(route, { cancelStatuses: [{ code: cancellation.cancel_status }] }); return true }
    if (pathname === base) { await ok(route, { cancellations: [cancellation] }); return true }
    if (pathname === base + '/C1/approve') {
      expect(method).toBe('POST')
      approvals++
      cancellation.cancel_status = 'CANCELLATION_REQUEST_SUCCESS'
      await ok(route, { approved: true })
      return true
    }
    return false
  })
  await page.goto('/merchant/staff/tiktok-cancellations')
  await page.getByRole('button', { name: 'Approve cancellation' }).click()
  expect(approvals).toBe(0)
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.getByRole('cell', { name: 'CANCELLATION_REQUEST_SUCCESS' })).toBeVisible()
  expect(approvals).toBe(1)
})

test('internal return is created from an order and approved from the return list', async ({ page }) => {
  const order = { id: 17, platform: 'SHOPEE', platformOrderId: 'ORDER-17', status: 'COMPLETED', source: 'MANUAL' }
  let request
  await signIn(page, async (route, { pathname }, method) => {
    if (pathname === '/api/v1/orders') { await ok(route, { content: [order], totalPages: 1 }); return true }
    if (pathname === '/api/v1/orders/17') { await ok(route, order); return true }
    if (pathname === '/api/v1/returns' && method === 'POST') {
      expect(route.request().postDataJSON()).toEqual({ orderId: '17', reason: 'All items received' })
      request = { id: 80, order_id: 17, status: 'REQUESTED', reason: 'All items received' }
      await ok(route, request)
      return true
    }
    if (pathname === '/api/v1/returns') { await ok(route, { content: [request], totalPages: 1 }); return true }
    if (pathname === '/api/v1/returns/80/approve') { expect(method).toBe('POST'); request.status = 'COMPLETED'; await ok(route, request); return true }
    return false
  })
  await page.goto('/merchant/staff/orders')
  await page.getByRole('button', { name: 'View order details' }).click()
  await page.getByRole('button', { name: 'Create return request' }).click()
  await page.getByLabel('Return reason').fill('All items received')
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.getByText('Return request created.')).toBeVisible()
  await page.goto('/merchant/staff/returns?source=internal')
  await page.getByRole('button', { name: 'Approve and restock' }).click()
  await expect(page.getByRole('dialog').getByText(/restocks the order items/)).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.getByRole('cell', { name: 'COMPLETED' })).toBeVisible()
})

test('voucher page has no create button and still syncs vouchers', async ({ page }) => {
  const base = '/api/v1/tiktok/vouchers'
  const voucher = { id: 5, title: 'Weekend discount', discountType: 'PERCENT_OFF', discountValue: 15, status: 'ONGOING' }
  await signIn(page, async (route, { pathname }, method) => {
    if (pathname === base && method === 'GET') { await ok(route, [voucher]); return true }
    if (pathname === base + '/sync') { expect(method).toBe('POST'); await ok(route, [voucher]); return true }
    return false
  })
  await page.goto('/merchant/staff/tiktok-vouchers')
  await expect(page.getByRole('cell', { name: voucher.title })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Create voucher' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Sync vouchers' }).click()
  await expect(page.getByText('1 vouchers synchronized.')).toBeVisible()
})

test('TikTok buyer cancellation rejection sends the selected reason', async ({ page }) => {
  const base = '/api/v1/tiktok/cancellations'
  const cancellation = { cancel_id: 'C1', order_id: 'O1', cancel_status: 'CANCELLATION_REQUEST_PENDING' }
  let rejected
  await signIn(page, async (route, { pathname }) => {
    if (pathname === '/api/v1/tiktok/aftersale/reasons') { await ok(route, { cancelStatuses: [{ code: cancellation.cancel_status }] }); return true }
    if (pathname === '/api/v1/tiktok/aftersale/reject-reasons') { await ok(route, [{ name: 'REJECT_ALREADY_SHIPPED', text: 'Already shipped' }]); return true }
    if (pathname === base) { await ok(route, { cancellations: [cancellation] }); return true }
    if (pathname === base + '/C1/reject') { rejected = route.request().postDataJSON(); await ok(route, { rejected: true }); return true }
    return false
  })
  await page.goto('/merchant/staff/tiktok-cancellations')
  await page.getByRole('button', { name: 'Reject cancellation' }).click()
  await page.getByLabel('Reject reason (optional)').selectOption('REJECT_ALREADY_SHIPPED')
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.getByText('Cancellation rejected.')).toBeVisible()
  expect(rejected).toEqual({ rejectReason: 'REJECT_ALREADY_SHIPPED' })
})

test('TikTok catalog rejects fractional prices before calling the API', async ({ page }) => {
  const sku = { tiktokProductId: 'P1', tiktokSkuId: 'S1', productName: 'Tee', sellerSku: 'TEE', mapped: true, localSkuCode: 'LOCAL-TEE', currentPrice: 100, currency: 'VND' }
  let puts = 0
  await signIn(page, async (route, { pathname }) => {
    if (pathname === '/api/v1/tiktok/catalog') { await ok(route, [sku]); return true }
    if (pathname === '/api/v1/tiktok/products/price') { puts++; await ok(route, {}); return true }
    return false
  })
  await page.goto('/merchant/staff/tiktok-catalog')
  await page.getByRole('button', { name: 'Edit SKU price' }).click()
  const input = page.getByLabel('New price (VND)')
  await expect(input).toHaveAttribute('step', '1')
  await input.fill('124.5')
  await page.getByRole('button', { name: 'Confirm price change' }).click()
  expect(puts).toBe(0)
})

test('TikTok connection shows granted scopes and links to TikTok orders', async ({ page }) => {
  const shop = { shopId: 'S1', shopName: 'Demo', shopRegion: 'VN', status: 'CONNECTED', grantedScopes: ['order.read', 'product.read'] }
  await signIn(page, async (route, { pathname }) => {
    if (pathname === '/api/v1/marketplace-connections/tiktok-shop') { await ok(route, shop); return true }
    return false
  })
  await page.goto('/merchant/shops?marketplace=tiktok-shop')
  await expect(page.getByText('2 scopes granted')).toHaveAttribute('title', 'order.read, product.read')
  await expect(page.getByRole('link', { name: 'View orders' })).toHaveAttribute('href', '/merchant/staff/orders?source=tiktok')
})

test('TikTok connection warns when granted scopes are unknown', async ({ page }) => {
  await signIn(page, async (route, { pathname }) => {
    if (pathname === '/api/v1/marketplace-connections/tiktok-shop') { await ok(route, { shopId: 'S1', status: 'CONNECTED', grantedScopes: [] }); return true }
    return false
  })
  await page.goto('/merchant/shops?marketplace=tiktok-shop')
  await expect(page.getByText('Granted scopes are unknown.', { exact: false })).toBeVisible()
})

test('order hub opens the TikTok order screen from ?source=tiktok', async ({ page }) => {
  let tiktokCalls = 0
  await signIn(page, async (route, { pathname }) => {
    if (pathname === '/api/v1/tiktok/orders') { tiktokCalls++; await ok(route, { orders: [] }); return true }
    if (pathname === '/api/v1/marketplace-connections/tiktok-shop') { await ok(route, { status: 'CONNECTED' }); return true }
    return false
  })
  await page.goto('/merchant/staff/orders?source=tiktok')
  await expect(page.getByLabel('Nguồn đơn hàng')).toHaveValue('TIKTOK')
  await expect(page.getByRole('button', { name: 'Sync TikTok orders' })).toBeVisible()
  await expect.poll(() => tiktokCalls).toBeGreaterThan(0)
})
