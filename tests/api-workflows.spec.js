import { test, expect } from '@playwright/test'

const owner = { id: 7, email: 'owner@example.test', role: 'TENANT_ADMIN', tenant_id: 42, subdomain: 'test-store' }
const manager = { id: 8, email: 'manager@example.test', role: 'MANAGER', tenant_id: null }
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

test('owner sends and revokes an invitation for an existing MANAGER account', async ({ page }) => {
  const base = '/api/v1/users/invitations'
  let invited
  await signIn(page, async (route, { pathname }, method) => {
    if (pathname === base && method === 'GET') { await ok(route, invited ? [invited] : []); return true }
    if (pathname === base && method === 'POST') {
      expect(route.request().postDataJSON()).toEqual({ email: manager.email, role: 'MANAGER' })
      invited = { id: 15, invitedEmail: manager.email, status: 'PENDING' }
      await ok(route, invited)
      return true
    }
    if (pathname === base + '/15' && method === 'DELETE') { invited.status = 'CANCELLED'; await ok(route, null); return true }
    return false
  })
  await page.goto('/merchant/invitations')
  await page.getByLabel('Manager email address').fill(manager.email)
  await page.getByRole('button', { name: 'Send invitation' }).click()
  await page.getByRole('button', { name: 'Revoke invitation' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click()
  await expect(page.getByRole('cell', { name: 'CANCELLED' })).toBeVisible()
})

test('unassigned manager accepts an invitation and uses the new tenant token', async ({ page }) => {
  const base = '/api/v1/users/me/invitations'
  await signIn(page, async (route, { pathname }, method) => {
    if (pathname === base) { await ok(route, [{ id: 15, companyName: 'Demo Shop', status: 'PENDING' }]); return true }
    if (pathname === base + '/15/accept') {
      expect(method).toBe('POST')
      await ok(route, auth({ ...manager, tenant_id: 42, subdomain: 'test-store' }, 'joined-access'))
      return true
    }
    return false
  }, manager)
  await page.getByRole('button', { name: 'Accept invitation' }).click()
  const connection = page.waitForRequest(request => new URL(request.url()).pathname === '/api/v1/marketplace-connections/shopee')
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click()
  await expect(page).toHaveURL(/\/merchant\/shops$/)
  expect((await connection).headers().authorization).toBe('Bearer joined-access')
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
  await page.goto('/merchant/manager/tiktok-cancellations')
  await page.getByRole('button', { name: 'Approve cancellation' }).click()
  expect(approvals).toBe(0)
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.getByRole('cell', { name: 'CANCELLATION_REQUEST_SUCCESS' })).toBeVisible()
  expect(approvals).toBe(1)
})

test('voucher page has no create button and still syncs vouchers', async ({ page }) => {
  const base = '/api/v1/tiktok/vouchers'
  const voucher = { id: 5, title: 'Weekend discount', discountType: 'PERCENT_OFF', discountValue: 15, status: 'ONGOING' }
  await signIn(page, async (route, { pathname }, method) => {
    if (pathname === base && method === 'GET') { await ok(route, [voucher]); return true }
    if (pathname === base + '/sync') { expect(method).toBe('POST'); await ok(route, [voucher]); return true }
    return false
  })
  await page.goto('/merchant/manager/tiktok-vouchers')
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
  await page.goto('/merchant/manager/tiktok-cancellations')
  await page.getByRole('button', { name: 'Reject cancellation' }).click()
  await page.getByLabel('Reject reason (optional)').selectOption('REJECT_ALREADY_SHIPPED')
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.getByText('Cancellation rejected.')).toBeVisible()
  expect(rejected).toEqual({ rejectReason: 'REJECT_ALREADY_SHIPPED' })
})

test('TikTok connection shows granted scopes and links to TikTok orders', async ({ page }) => {
  const shop = { shopId: 'S1', shopName: 'Demo', shopRegion: 'VN', status: 'CONNECTED', grantedScopes: ['order.read', 'product.read'] }
  await signIn(page, async (route, { pathname }) => {
    if (pathname === '/api/v1/marketplace-connections/tiktok-shop') { await ok(route, shop); return true }
    return false
  })
  await page.goto('/merchant/shops?marketplace=tiktok-shop')
  await expect(page.getByText('2 scopes granted')).toHaveAttribute('title', 'order.read, product.read')
  await expect(page.getByRole('link', { name: 'View orders' })).toHaveAttribute('href', '/merchant/manager/orders?source=tiktok')
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
    if (pathname === '/api/v1/tiktok/cancellations') { await ok(route, { cancellations: [] }); return true }
    if (pathname === '/api/v1/tiktok/returns') { await ok(route, { returns: [] }); return true }
    if (pathname === '/api/v1/marketplace-connections/tiktok-shop') { await ok(route, { status: 'CONNECTED' }); return true }
    return false
  })
  await page.goto('/merchant/manager/orders?source=tiktok')
  await expect(page.getByLabel('Order source')).toHaveValue('TIKTOK')
  await expect(page.getByRole('button', { name: 'Sync TikTok orders' })).toBeVisible()
  await expect.poll(() => tiktokCalls).toBeGreaterThan(0)
})
