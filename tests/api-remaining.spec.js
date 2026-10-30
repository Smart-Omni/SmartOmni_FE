import { test, expect } from '@playwright/test'

const shopee = '/api/marketplace-connections/shopee'
const tiktok = '/api/marketplace-connections/tiktok-shop'
const ownerAuth = { access_token: 'api-access', refresh_token: 'api-refresh', user_info: { id: 7, email: 'owner@example.test', fullName: 'API Owner', role: 'TENANT_ADMIN', tenant_id: 42, subdomain: 'test-store' } }
const report = { runId: 8, status: 'completed', counters: { productsSeen: 2, productsCreated: 2, productsUpdated: 0, productsSkipped: 0, productsFailed: 0, skusCreated: 3, skusLinked: 3, skusUnmatched: 0, skusConflicted: 0 }, items: [] }
const product = { id: 88, name: 'Connected product', description: 'API description' }
const skus = [{ id: 91, skuCode: 'SKU-RED', variantName: 'Red', basePrice: 150000 }, { id: 92, skuCode: 'SKU-BLUE', variantName: 'Blue', basePrice: 160000 }]
const ok = (route, data) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data }) })
const fail = (route, status, message) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ success: false, message }) })

async function setup(page, handler, role = 'TENANT_ADMIN') {
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (!path.startsWith('/api/')) return route.continue()
    if (path === '/api/v1/auth/login') return ok(route, { ...ownerAuth, user_info: { ...ownerAuth.user_info, role, ...(role === 'SUPER_ADMIN' ? { tenant_id: null, subdomain: null } : {}) } })
    if (path === '/api/v1/users/me') return ok(route, { id: 7, email: 'owner@example.test', full_name: 'API Owner', role, status: 'ACTIVE' })
    if (path === shopee || path === tiktok) return ok(route, null)
    if (await handler(route, path)) return
    throw new Error('Unexpected API: ' + route.request().method() + ' ' + path)
  })
}
async function login(page) {
  await page.goto('/auth/login')
  await page.getByLabel('Email address').fill('owner@example.test')
  await page.getByLabel('Password', { exact: true }).fill('Testing@123')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/(merchant\/shops|admin\/profile)$/)
}

test('TikTok OAuth forwards code/state without Shopee shop_id and keeps the selected marketplace', async ({ page }) => {
  let callbacks = 0
  await setup(page, async (route, path) => {
    if (path === tiktok + '/authorization') { await ok(route, { authorizationUrl: 'http://127.0.0.1:5175/merchant/channels/tiktok/callback?code=tiktok-code&state=tiktok-state' }); return true }
    if (path === tiktok + '/callback') { callbacks++; expect(route.request().headers().authorization).toBe('Bearer api-access'); expect(route.request().postDataJSON()).toEqual({ code: 'tiktok-code', state: 'tiktok-state' }); await ok(route, { status: 'CONNECTED' }); return true }
    return false
  })
  await login(page)
  await page.getByRole('combobox', { name: 'Marketplace', exact: true }).selectOption('tiktok-shop')
  await page.getByRole('button', { name: 'Connect TikTok Shop', exact: true }).click()
  await expect.poll(() => callbacks).toBe(1)
  await expect(page).toHaveURL(/merchant\/shops\?marketplace=tiktok-shop$/)
  await expect(page.getByRole('combobox', { name: 'Marketplace', exact: true })).toHaveValue('tiktok-shop')
})

test('TikTok configuration error and callback denial stay visible without fake connection', async ({ page }) => {
  await setup(page, async (route, path) => {
    if (path === tiktok + '/authorization') { await fail(route, 503, 'TikTok authorization is not configured'); return true }
    return false
  })
  await login(page)
  await page.getByRole('combobox', { name: 'Marketplace', exact: true }).selectOption('tiktok-shop')
  await page.getByRole('button', { name: 'Connect TikTok Shop', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText('TikTok authorization is not configured')
  await page.goto('/merchant/channels/tiktok-shop/callback?error=access_denied')
  await expect(page.getByRole('alert')).toHaveText('access_denied')
  await page.goto('/merchant/channels/tiktok/callback?state=missing-code')
  await expect(page.getByRole('alert')).toContainText('Missing TikTok Shop callback parameters')
})

test('TikTok import/warehouse/price operations use only TikTok endpoints', async ({ page }) => {
  const called = []
  await setup(page, async (route, path) => {
    expect(path.startsWith(tiktok)).toBe(true)
    called.push(path)
    if (path.endsWith('/products/import-runs')) { await ok(route, [report]); return true }
    if (path.endsWith('/products/import')) { await ok(route, report); return true }
    if (path.endsWith('/warehouses/sync')) { await ok(route, { warehouses: 2 }); return true }
    if (path.endsWith('/prices/sync')) { await ok(route, { considered: 3, applied: 2, heldAnomaly: 1 }); return true }
    return false
  })
  await login(page)
  await page.goto('/merchant/staff/imports?marketplace=tiktok-shop')
  await page.getByRole('button', { name: 'Import TikTok Shop products' }).click()
  await expect(page.getByRole('heading', { name: 'Import #8' })).toBeVisible()
  await page.getByRole('button', { name: 'Sync warehouses' }).click()
  await expect(page.getByRole('status')).toHaveText('2 warehouses synchronized.')
  await page.getByRole('button', { name: 'Sync prices', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('1 anomalies flagged')
  expect(called).toContain(tiktok + '/products/import')
})

test('creates a product with two SKUs and retrieves the resulting product and SKU IDs', async ({ page }) => {
  let body
  await setup(page, async (route, path) => {
    if (path === '/api/products') { body = route.request().postDataJSON(); await ok(route, product); return true }
    if (path === '/api/products/88') { await ok(route, product); return true }
    if (path === '/api/products/88/skus') { await ok(route, skus); return true }
    return false
  })
  await login(page)
  await page.getByRole('link', { name: 'Products', exact: true }).click()
  await page.getByLabel('Product name', { exact: true }).fill('Connected product')
  await page.getByLabel('Product description').fill('API description')
  await page.getByLabel('SKU code', { exact: true }).fill('SKU-RED')
  await page.getByLabel('Variant name', { exact: true }).fill('Red')
  await page.getByLabel('Base price (VND)', { exact: true }).fill('150000')
  await page.getByRole('button', { name: 'Add SKU', exact: true }).click()
  await page.getByLabel('SKU code', { exact: true }).nth(1).fill('SKU-BLUE')
  await page.getByLabel('Variant name', { exact: true }).nth(1).fill('Blue')
  await page.getByLabel('Base price (VND)', { exact: true }).nth(1).fill('160000')
  await page.getByRole('button', { name: 'Create product', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Connected product' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'SKU-BLUE', exact: true })).toBeVisible()
  expect(body).toEqual({ name: 'Connected product', description: 'API description', skus: skus.map(({ skuCode, variantName, basePrice }) => ({ skuCode, variantName, basePrice })) })
})

test('product errors preserve entered data and invalid IDs never make a request', async ({ page }) => {
  let creates = 0
  await setup(page, async (route, path) => {
    if (path === '/api/products') { creates++; await fail(route, 409, 'SKU already exists'); return true }
    return false
  })
  await login(page)
  await page.getByRole('link', { name: 'Products', exact: true }).click()
  await page.getByLabel('Product ID', { exact: true }).fill('1/../../tenants')
  await page.getByRole('button', { name: 'Find product', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText('Enter a valid product ID.')
  await page.getByLabel('Product name', { exact: true }).fill('Unsaved product')
  await page.getByLabel('SKU code', { exact: true }).fill('TAKEN')
  await page.getByLabel('Base price (VND)', { exact: true }).fill('1000')
  await page.getByRole('button', { name: 'Create product', exact: true }).click()
  await expect(page.getByText('SKU already exists', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Product name', { exact: true })).toHaveValue('Unsaved product')
  expect(creates).toBe(1)
})

test('stock adjustment requires confirmation, clears stale confirmation and supports zero total', async ({ page }) => {
  let adjustments = 0
  await setup(page, async (route, path) => {
    if (path === '/api/inventory/91/adjust') { adjustments++; expect(new URL(route.request().url()).searchParams.get('quantity')).toBe('0'); expect(route.request().method()).toBe('POST'); await ok(route, null); return true }
    return false
  })
  await login(page)
  await page.getByRole('link', { name: 'Stock adjustment', exact: true }).click()
  await page.getByLabel('SKU ID', { exact: true }).fill('91')
  await page.getByLabel('New total quantity').fill('3')
  await page.getByRole('button', { name: 'Review stock adjustment' }).click()
  expect(adjustments).toBe(0)
  await page.getByLabel('New total quantity').fill('0')
  await expect(page.getByRole('button', { name: 'Confirm stock adjustment' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Review stock adjustment' }).click()
  await page.getByRole('button', { name: 'Confirm stock adjustment' }).click()
  await expect(page.getByRole('status')).toContainText('0 units')
  expect(adjustments).toBe(1)
})

test('admin tenant search/pagination/status and confirmed lock/unlock use documented requests', async ({ page }) => {
  let locked = false
  const queries = []
  await setup(page, async (route, path) => {
    if (path === '/api/v1/tenants') { const url = new URL(route.request().url()); queries.push(Object.fromEntries(url.searchParams)); await ok(route, { content: [{ id: 42, name: 'Tenant One', subdomain: 'tenant-one', status: locked ? 'LOCKED' : 'ACTIVE' }], totalElements: 21, totalPages: 2 }); return true }
    if (path.endsWith('/42/status')) { await ok(route, !locked); return true }
    if (path.endsWith('/42/lock')) { expect(route.request().postDataJSON()).toEqual({ reason: 'Requested review' }); locked = true; await ok(route, null); return true }
    if (path.endsWith('/42/unlock')) { locked = false; await ok(route, null); return true }
    return false
  }, 'SUPER_ADMIN')
  await login(page)
  await page.getByRole('link', { name: 'Tenants', exact: true }).click()
  await page.getByRole('button', { name: 'Next page', exact: true }).click()
  await expect.poll(() => queries.some(query => query.page === '1')).toBe(true)
  await page.getByLabel('Search tenants').fill('Tenant')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await expect.poll(() => queries.some(query => query.page === '0' && query.keyword === 'Tenant')).toBe(true)
  await page.getByRole('button', { name: 'Check status', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('active')
  await page.getByRole('button', { name: 'Lock tenant', exact: true }).click()
  expect(locked).toBe(false)
  await page.getByRole('textbox', { name: 'Lock reason' }).fill('Requested review')
  await page.getByRole('button', { name: 'Confirm lock' }).click()
  await expect(page.getByRole('cell', { name: 'LOCKED', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Unlock tenant', exact: true }).click()
  await page.getByRole('button', { name: 'Confirm unlock' }).click()
  await expect(page.getByRole('cell', { name: 'ACTIVE', exact: true })).toBeVisible()
})

test('merchant cannot call admin tenant APIs by opening admin routes', async ({ page }) => {
  await setup(page, async (_route, path) => { throw new Error('Unauthorized page made request to ' + path) })
  await login(page)
  await page.goto('/admin/tenants')
  await expect(page).toHaveURL(/\/merchant\/shops$/)
  await expect(page.getByRole('heading', { name: 'Tenant directory' })).toHaveCount(0)
})

test('AI reads real response rows, runs forecasts and surfaces dependency failures without mock results', async ({ page }) => {
  let runs = 0
  let broken = false
  await setup(page, async (route, path) => {
    if (path === '/api/ai/forecast/91') { await ok(route, [{ id: 1, forecastDate: '2026-11-01', predictedQuantity: 24, recommendedReorderQty: 12, modelVersionId: 3 }]); return true }
    if (path === '/api/ai/recommendations/91') { await ok(route, [{ id: 2, recommendedSkuId: 92, similarityScore: 0.87 }]); return true }
    if (path === '/api/ai/forecast/run') { runs++; if (broken) await fail(route, 503, 'AI service unavailable'); else await ok(route, null); return true }
    return false
  })
  await login(page)
  await page.getByRole('link', { name: 'AI insights', exact: true }).click()
  await page.getByLabel('SKU ID', { exact: true }).fill('91')
  await page.getByRole('button', { name: 'View insights' }).click()
  await expect(page.getByRole('cell', { name: '2026-11-01' })).toBeVisible()
  await expect(page.getByRole('cell', { name: '0.87' })).toBeVisible()
  await page.getByRole('button', { name: 'Run demand forecast' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Forecast request completed' })).toBeVisible()
  expect(runs).toBe(1)
  broken = true
  await page.getByRole('button', { name: 'Run demand forecast' }).click()
  await expect(page.getByRole('alert')).toHaveText('AI service unavailable')
  await expect(page.getByText('Forecast request completed. Refresh the selected SKU to view any available results.')).toHaveCount(0)
})

test('order lookup sends the marketplace and reference, clears previous result on failure', async ({ page }) => {
  let missing = false
  await setup(page, async (route, path) => {
    if (path === '/api/orders/track') {
      const params = new URL(route.request().url()).searchParams
      expect(params.get('platform')).toBe('TIKTOK_SHOP')
      expect(params.get('orderId')).toBe('TT-1042')
      if (missing) await fail(route, 404, 'Order not found')
      else await ok(route, { platformOrderId: 'TT-1042', platform: 'TIKTOK_SHOP', status: 'SHIPPED', customerName: 'Lookup Buyer', trackingNumber: 'TRACK1', totalAmount: 100000 })
      return true
    }
    return false
  })
  await login(page)
  await page.getByRole('link', { name: 'Order lookup', exact: true }).click()
  await page.getByRole('combobox', { name: 'Marketplace', exact: true }).selectOption('TIKTOK_SHOP')
  await page.getByLabel('Marketplace order reference').fill(' TT-1042 ')
  await page.getByRole('button', { name: 'Look up order', exact: true }).click()
  await expect(page.getByText('Lookup Buyer', { exact: true })).toBeVisible()
  missing = true
  await page.getByRole('button', { name: 'Look up order', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText('Order not found')
  await expect(page.getByText('Lookup Buyer', { exact: true })).toHaveCount(0)
})

for (const width of [375, 1440]) {
  test(`new merchant API pages remain usable without mock data at ${width}px`, async ({ page }) => {
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.setViewportSize({ width, height: 1000 })
    await setup(page, async (_route, path) => { throw new Error('An idle operation page should not fetch ' + path) })
    await login(page)
    for (const [label, heading] of [['Products', 'Find an internal product'], ['Stock adjustment', 'Adjust stock'], ['AI insights', 'Demand forecasts & product recommendations'], ['Order lookup', 'Look up a marketplace order']]) {
      await page.getByRole('link', { name: label, exact: true }).click()
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    }
    expect(errors).toEqual([])
  })
}
