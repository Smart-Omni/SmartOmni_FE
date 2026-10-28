import { test, expect } from '@playwright/test'

const base = '/api/marketplace-connections/shopee'
const auth = { access_token: 'access-test', refresh_token: 'refresh-test', user_info: { id: 7, email: 'owner@example.test', fullName: 'API Owner', role: 'TENANT_ADMIN', tenant_id: 42, subdomain: 'test-store' } }
const shop = { id: 88, shopId: '727720655', shopName: 'Shopee Test Shop', shopRegion: 'VN', status: 'CONNECTED', needsReconnect: false }
const report = { runId: 105, status: 'completed_with_errors', counters: { pages: 2, productsSeen: 42, productsCreated: 10, productsUpdated: 30, productsFailed: 2, productsSkipped: 0, skusCreated: 65, skusLinked: 63, skusUnmatched: 2, skusConflicted: 0 }, skuLimitReached: true, items: [{ externalProductId: 'item-1', externalSkuId: 'sku-1', outcome: 'UNMATCHED', message: 'Missing seller SKU' }] }
const order = { id: 501, platformOrderId: 'SP1042', platform: 'SHOPEE', status: 'TO_SHIP', totalAmount: 450000, customerName: 'Buyer', trackingNumber: 'SPX123', slaDeadline: '2099-01-01T00:00:00Z' }

async function json(route, data, status = 200) { await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ success: status < 400, data, ...(status >= 400 ? { message: data.message } : {}) }) }) }
async function setup(page, handler = async () => false) {
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (!path.startsWith('/api/')) return route.continue()
    if (await handler(route, path)) return
    if (path === '/api/v1/auth/login') return json(route, auth)
    if (path === base) return json(route, shop)
    if (path === base + '/products/import-runs') return json(route, [report])
    if (path === '/api/orders') return json(route, { content: [order], totalPages: 1, totalElements: 1 })
    if (path === base + '/returns') return json(route, { returnList: [{ returnSn: 'RET1', orderSn: 'SP1042', status: 'REQUESTED', refundAmount: 100000 }], more: false, total: 1 })
    throw new Error(`Unexpected API: ${route.request().method()} ${path}`)
  })
}
async function login(page) {
  await page.goto('/auth/login')
  await page.getByLabel('Email address').fill('owner@example.test')
  await page.getByLabel('Password', { exact: true }).fill('Testing@123')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/merchant\/shops$/)
}

test('real auth payload, role mapping and session survive reload without password storage', async ({ page }) => {
  let credentials
  await setup(page, async (route, path) => { if (path === '/api/v1/auth/login') { credentials = route.request().postDataJSON(); await json(route, auth); return true } return false })
  await login(page)
  expect(credentials).toEqual({ email: 'owner@example.test', password: 'Testing@123' })
  await expect(page.getByText('Shopee Test Shop')).toBeVisible()
  const stored = await page.evaluate(() => sessionStorage.getItem('smartomni.api-session.v1'))
  expect(stored).not.toContain('Testing@123')
  await page.reload()
  await expect(page.getByText('Shopee Test Shop')).toBeVisible()
})

test('authorization redirects and callback is exchanged once', async ({ page }) => {
  let callbacks = 0
  await setup(page, async (route, path) => {
    if (path === base + '/authorization') { expect(route.request().headers().authorization).toBe('Bearer access-test'); await json(route, { authorizationUrl: 'http://127.0.0.1:5175/merchant/channels/shopee/callback?code=test-code&shop_id=727720655&state=test-state' }); return true }
    if (path === base + '/callback') { callbacks++; expect(route.request().postDataJSON()).toEqual({ code: 'test-code', shop_id: '727720655', state: 'test-state' }); await json(route, shop); return true }
    return false
  })
  await login(page)
  await page.getByRole('button', { name: 'Reconnect Shopee' }).click()
  await expect.poll(() => callbacks).toBe(1)
  await expect(page).toHaveURL(/\/merchant\/shops$/)
  expect(callbacks).toBe(1)
})

test('callback cancellation and missing parameters never submit an exchange', async ({ page }) => {
  await setup(page)
  await login(page)
  await page.goto('/merchant/channels/shopee/callback?error=access_denied&error_description=Authorization%20cancelled')
  await expect(page.getByRole('alert')).toHaveText('Authorization cancelled')
  await page.goto('/merchant/channels/shopee/callback?code=only-code')
  await expect(page.getByRole('alert')).toContainText('Missing Shopee callback parameters')
})

test('expired session refreshes JWT and retries request', async ({ page }) => {
  let refreshed = 0
  await setup(page, async (route, path) => {
    if (path === '/api/v1/auth/refresh') { refreshed++; expect(route.request().postDataJSON()).toEqual({ refresh_token: 'refresh-test' }); await json(route, { ...auth, access_token: 'new-access', refresh_token: 'new-refresh' }); return true }
    if (path === base && route.request().headers().authorization === 'Bearer access-test') { await json(route, { message: 'Expired' }, 401); return true }
    return false
  })
  await login(page)
  await expect(page.getByText('Shopee Test Shop')).toBeVisible()
  expect(refreshed).toBe(1)
})

test('refresh failure clears session and returns to login', async ({ page }) => {
  await setup(page, async (route, path) => {
    if (path === base || path === '/api/v1/auth/refresh') { await json(route, { message: 'Session expired' }, 401); return true }
    return false
  })
  await page.goto('/auth/login')
  await page.getByLabel('Email address').fill('owner@example.test')
  await page.getByLabel('Password', { exact: true }).fill('Testing@123')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible()
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('smartomni.api-session.v1'))).toBeNull()
})

test('import consumes nested counters, per-item errors and plan limits', async ({ page }) => {
  let imports = 0
  await setup(page, async (route, path) => {
    if (path === base + '/products/import') { imports++; await json(route, report); return true }
    if (path === base + '/prices/sync') { await json(route, { considered: 65, applied: 63, heldAnomaly: 2, unchanged: 0, rejected: 0, missing: 0, fetchError: null }); return true }
    return false
  })
  await login(page)
  await page.getByRole('link', { name: 'Product imports', exact: true }).click()
  await page.getByRole('button', { name: 'Import Shopee products', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Import #105' })).toBeVisible()
  await expect(page.getByText('Missing seller SKU')).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('plan SKU limit')
  expect(imports).toBe(1)
  await page.getByRole('button', { name: 'Sync prices', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('2 anomalies flagged')
})

test('shipping uses pickup addresses/time slots, escrow is clamped, AWB is PDF', async ({ page }) => {
  let shipped
  await setup(page, async (route, path) => {
    if (path.endsWith('/shipping-parameter')) { await json(route, { pickupAddresses: [{ addressId: 901, address: '123 Hanoi', timeSlots: [{ pickupTimeId: 'morning', timeText: '09:00–12:00' }] }], dropoffBranches: [] }); return true }
    if (path.endsWith('/ship')) { shipped = route.request().postDataJSON(); await json(route, { orderSn: 'SP1042', status: 'shipped', trackingNumber: 'SPX123' }); return true }
    if (path.endsWith('/escrow')) { await json(route, { escrowAmount: -10, buyerTotalAmount: 450000, orderOriginalPrice: 450000, commissionFee: 18000, sellerTransactionFee: 9000 }); return true }
    if (path.endsWith('/shipping-document')) { await route.fulfill({ contentType: 'application/pdf', body: Buffer.from('%PDF-1.4\nmock shipping document') }); return true }
    return false
  })
  await login(page)
  await page.getByRole('link', { name: 'Orders & shipping' }).click()
  await page.getByRole('button', { name: 'Arrange shipment' }).click()
  await page.getByLabel('Shipping mode').selectOption('pickup')
  await page.getByLabel('Pickup address').selectOption('901')
  await page.getByLabel('Pickup time').selectOption('morning')
  await page.getByRole('button', { name: 'Confirm shipment' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(shipped).toEqual({ shippingMode: 'pickup', addressId: 901, pickupTimeId: 'morning' })
  await page.getByRole('button', { name: 'View escrow' }).click()
  await expect(page.getByRole('dialog').getByText('Net escrow')).toBeVisible()
  await expect(page.getByRole('dialog').getByText('Net escrow').locator('..')).not.toContainText('-10')
  await page.keyboard.press('Escape')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download AWB PDF' }).click()
  expect((await download).suggestedFilename()).toBe('AWB-SP1042.pdf')
})

test('returns dispute sends reason ID, contact email and proof URL array', async ({ page }) => {
  let dispute
  await setup(page, async (route, path) => {
    if (path === base + '/returns/RET1') { await json(route, { returnSn: 'RET1', orderSn: 'SP1042', status: 'REQUESTED', items: [], buyerProofImages: [] }); return true }
    if (path.endsWith('/RET1/dispute')) { dispute = route.request().postDataJSON(); await json(route, { disputed: true }); return true }
    return false
  })
  await login(page)
  await page.getByRole('link', { name: 'Returns & refunds' }).click()
  await page.getByRole('button', { name: 'Review return' }).click()
  await page.getByRole('button', { name: 'Dispute return', exact: true }).click()
  await page.getByLabel('Shopee dispute reason ID').fill('3')
  await page.getByLabel('Dispute explanation').fill('Returned empty box')
  await page.getByLabel('Contact email').fill('owner@example.test')
  await page.getByLabel('Proof image URLs').fill('https://example.test/proof.jpg')
  await page.getByRole('button', { name: 'Submit dispute', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(dispute).toEqual({ disputeReasonId: 3, disputeTextReason: 'Returned empty box', email: 'owner@example.test', proofImages: ['https://example.test/proof.jpg'] })
})

test('failed login and duplicate-import conflict display backend errors', async ({ page }) => {
  let failLogin = true
  await setup(page, async (route, path) => {
    if (path === '/api/v1/auth/login' && failLogin) { await json(route, { message: 'Email hoặc mật khẩu không chính xác' }, 401); return true }
    if (path.endsWith('/products/import')) { await json(route, { message: 'Import already running' }, 409); return true }
    return false
  })
  await page.goto('/auth/login')
  await page.getByLabel('Email address').fill('owner@example.test')
  await page.getByLabel('Password', { exact: true }).fill('Wrong@123')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Email hoặc mật khẩu không chính xác')
  failLogin = false
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.getByRole('link', { name: 'Product imports', exact: true }).click()
  await page.getByRole('button', { name: 'Import Shopee products', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText('Import already running')
})
