import { test, expect } from '@playwright/test'
import { openWorkspacePage } from './helpers/workspace-navigation'

const base = '/api/v1/marketplace-connections/shopee'
const auth = { access_token: 'access-test', refresh_token: 'refresh-test', user_info: { id: 7, email: 'owner@example.test', fullName: 'API Owner', role: 'TENANT_ADMIN', tenant_id: 42, subdomain: 'test-store' } }
const shop = { id: 88, shopId: '727720655', shopName: 'Shopee Test Shop', shopRegion: 'VN', status: 'CONNECTED', needsReconnect: false }
const report = { runId: 105, status: 'completed_with_errors', counters: { pages: 2, productsSeen: 42, productsCreated: 10, productsUpdated: 30, productsFailed: 2, productsSkipped: 0, skusCreated: 65, skusLinked: 63, skusUnmatched: 2, skusConflicted: 0 }, skuLimitReached: true, items: [{ externalProductId: 'item-1', externalSkuId: 'sku-1', outcome: 'UNMATCHED', message: 'Missing seller SKU' }] }
const order = { id: 501, platformOrderId: 'SP1042', platform: 'SHOPEE', status: 'TO_SHIP', totalAmount: 450000, customerName: 'Buyer', trackingNumber: 'SPX123', slaDeadline: '2099-01-01T00:00:00Z' }

async function json(route, data, status = 200) { await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ success: status < 400, data, ...(status >= 400 ? { message: data.message } : {}) }) }) }
async function setup(page, handler = async () => false) {
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (!path.startsWith('/api/')) return route.continue()
    if (path === '/api/v1/tenants/subscription/status') return json(route, { isPro: false, planName: 'FREE' })
    if (await handler(route, path)) return
    if (path === '/api/v1/auth/login') return json(route, auth)
    if (path === base) return json(route, shop)
    if (path === base + '/products/import-runs') return json(route, [report])
    if (path === '/api/v1/orders') return json(route, { content: [order], totalPages: 1, totalElements: 1 })
    if (path === base + '/returns/enriched') return json(route, { returnList: [{ returnSn: 'RET1', orderSn: 'SP1042', status: 'REQUESTED', refundAmount: 100000 }], more: false, total: 1 })
    if (path === '/api/v1/returns') return json(route, { content: [], totalPages: 0 })
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

test('loads Shopee shipping channels on demand and retries a gateway failure', async ({ page }, testInfo) => {
  let requests = 0
  await setup(page, async (route, path) => {
    if (path !== base + '/logistics/channels') return false
    expect(route.request().method()).toBe('GET')
    requests += 1
    if (requests === 1) await json(route, { message: 'Route unavailable.' }, 404)
    else await json(route, [{ channelId: 5, channelName: 'Standard Express', enabled: true, codEnabled: false }])
    return true
  })
  await login(page)
  const open = page.getByRole('button', { name: 'View shipping channels' })
  await expect(open).toBeVisible()
  expect(requests).toBe(0)
  await page.setViewportSize({ width: 375, height: 812 })
  await open.click()
  const dialog = page.getByRole('dialog', { name: 'Shopee shipping channels' })
  await expect(dialog.getByRole('alert')).toHaveText('Route unavailable.')
  await dialog.getByRole('button', { name: 'Try again' }).click()
  const row = dialog.getByRole('row', { name: /Standard Express/ })
  await expect(row.getByRole('cell', { name: 'Standard Express' })).toBeVisible()
  await expect(row.getByRole('cell', { name: 'Enabled Cash on delivery unavailable' })).toBeVisible()
  await dialog.screenshot({ path: testInfo.outputPath('shopee-channels-mobile.png') })
})

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

for (const shopParam of ['shop_id', 'shopId']) {
  test(`authorization accepts ${shopParam} and exchanges the callback once`, async ({ page, baseURL }) => {
    let callbacks = 0
    await setup(page, async (route, path) => {
      if (path === base + '/authorization') {
        expect(route.request().headers().authorization).toBe('Bearer access-test')
        expect(route.request().postDataJSON()).toEqual({ redirect_uri: new URL('/merchant/channels/shopee/callback', baseURL).href })
        await json(route, { authorizationUrl: new URL(`/merchant/channels/shopee/callback?code=test-code&${shopParam}=727720655&state=test-state`, baseURL).href })
        return true
      }
      if (path === base + '/callback') {
        callbacks++
        expect(route.request().postDataJSON()).toEqual({ code: 'test-code', shop_id: '727720655', state: 'test-state' })
        await json(route, shop)
        return true
      }
      return false
    })
    await login(page)
    await page.getByRole('button', { name: 'Reconnect Shopee' }).click()
    await expect.poll(() => callbacks).toBe(1)
    await expect(page).toHaveURL(/\/merchant\/shops$/)
    expect(callbacks).toBe(1)
  })
}

test('updates the Shopee auto-import setting and reads the saved value', async ({ page }) => {
  let autoImportProducts = false
  await setup(page, async (route, path) => {
    if (path === base) {
      await json(route, { ...shop, autoImportProducts })
      return true
    }
    if (path !== base + '/settings') return false
    expect(route.request().method()).toBe('PATCH')
    expect(route.request().postDataJSON()).toEqual({ auto_import_products: true })
    autoImportProducts = true
    await json(route, { ...shop, autoImportProducts })
    return true
  })
  await login(page)
  const checkbox = page.getByRole('checkbox', { name: 'Automatically import products' })
  await expect(checkbox).not.toBeChecked()
  await checkbox.click()
  await expect(checkbox).toBeChecked()
})

test('submits a warehouse inspection by internal return ID and refreshes its result', async ({ page }) => {
  let inspected = false
  const pending = {
    id: 123, external_return_id: 'RET1', platform_order_id: 'SP1042',
    platform: 'SHOPEE', return_type: 'PHYSICAL_RETURN', status: 'REQUESTED',
    inspection_result: 'PENDING', restocked: false,
    items: [{ id: 1, sku_id: 7, item_name: 'Test item', quantity_returned: 2 }],
  }
  await setup(page, async (route, path) => {
    const current = inspected ? { ...pending, status: 'COMPLETED', inspection_result: 'MATCHED', restocked: true } : pending
    if (path === '/api/v1/returns') await json(route, { content: [current], totalPages: 1 })
    else if (path === '/api/v1/returns/123') await json(route, current)
    else if (path === '/api/v1/returns/123/inspection') {
      expect(route.request().postDataJSON()).toEqual({ result: 'MATCHED', video_evidence_url: 'https://example.test/video' })
      inspected = true
      await json(route, { ...current, status: 'COMPLETED', inspection_result: 'MATCHED', restocked: true })
    } else return false
    return true
  })
  await login(page)
  await openWorkspacePage(page, 'Orders', 'Returns & refunds')
  await page.getByRole('row', { name: /RET1/ }).getByRole('button', { name: 'Inspect' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('cell', { name: 'Test item' })).toBeVisible()
  await dialog.getByLabel('Inspection result').selectOption('MATCHED')
  await dialog.getByLabel('Video evidence URL (optional)').fill('https://example.test/video')
  await dialog.getByRole('button', { name: 'Confirm and restock' }).click()
  await expect(dialog.getByText('COMPLETED · Matched · Restocked')).toBeVisible()
  await expect(dialog.getByLabel('Inspection result')).toHaveCount(0)
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
    if (path === base && route.request().headers().authorization === 'Bearer access-test') {
      await route.fulfill({ status: 401, json: { success: false, message: 'Expired', code: 'TOKEN_EXPIRED' } })
      return true
    }
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

test('revoked access token clears the session without refreshing', async ({ page }) => {
  let refreshed = 0
  await setup(page, async (route, path) => {
    if (path === '/api/v1/auth/refresh') {
      refreshed++
      await json(route, { message: 'Session expired' }, 401)
      return true
    }
    if (path !== base) return false
    await route.fulfill({ status: 401, json: { success: false, message: 'Session revoked', code: 'TOKEN_REVOKED' } })
    return true
  })
  await page.goto('/auth/login')
  await page.getByLabel('Email address').fill('owner@example.test')
  await page.getByLabel('Password', { exact: true }).fill('Testing@123')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible()
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('smartomni.api-session.v1'))).toBeNull()
  expect(refreshed).toBe(0)
})

test('marketplace authorization error preserves the SmartOmni session', async ({ page }) => {
  let refreshed = 0
  await setup(page, async (route, path) => {
    if (path === '/api/v1/auth/refresh') {
      refreshed++
      await json(route, { message: 'Session expired' }, 401)
      return true
    }
    if (path !== base) return false
    await route.fulfill({ status: 401, json: { success: false, code: 'SHOPEE_AUTH_ERROR', message: 'Reconnect your Shopee shop.' } })
    return true
  })
  await login(page)
  await expect(page.getByRole('alert')).toContainText('Reconnect your Shopee shop.')
  expect(refreshed).toBe(0)
})

test('import consumes nested counters, per-item errors and plan limits', async ({ page }) => {
  let imports = 0
  await setup(page, async (route, path) => {
    if (path === base + '/products/import') { imports++; await json(route, report); return true }
    if (path === base + '/prices/sync') { await json(route, { considered: 65, applied: 63, heldAnomaly: 2, unchanged: 0, rejected: 0, missing: 0, fetchError: null }); return true }
    return false
  })
  await login(page)
  await openWorkspacePage(page, 'Catalog & stock', 'Product imports log')
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
  const nowSec = Math.floor(Date.now() / 1000)
  const shopeeOrder = {
    orderSn: 'SP1042',
    orderStatus: 'READY_TO_SHIP',
    currency: 'VND',
    totalAmount: 450000,
    buyerUsername: 'buyer_1',
    recipientAddress: { name: 'Buyer', phone: '090****889', fullAddress: '******, District 1, HCMC' },
    items: [{ itemId: 1001, itemName: 'Wireless Mouse', itemSku: 'WM-01', modelId: 0, modelName: '', modelSku: 'WM-01', quantityPurchased: 1, originalPrice: 450000, discountedPrice: 450000 }],
    shipByDate: nowSec + 7200,
    createTime: nowSec - 3600,
    updateTime: nowSec - 1800,
    shippingCarrier: 'SPX Express',
    trackingNo: 'SPX123',
  }
  await setup(page, async (route, path) => {
    if (path === base + '/orders') { await json(route, [shopeeOrder]); return true }
    if (path.endsWith('/shipping-parameter')) { await json(route, { pickupAddresses: [{ addressId: 901, address: '123 Hanoi', timeSlots: [{ pickupTimeId: 'morning', date: nowSec, timeText: '09:00–12:00' }] }], dropoffBranches: [] }); return true }
    if (path.endsWith('/ship')) { shipped = route.request().postDataJSON(); await json(route, { orderSn: 'SP1042', status: 'PROCESSED', trackingNumber: 'SPX123' }); return true }
    if (path.endsWith('/escrow')) { await json(route, { escrowAmount: -10, buyerTotalAmount: 450000, orderOriginalPrice: 450000, commissionFee: 18000, sellerTransactionFee: 9000 }); return true }
    if (path.endsWith('/shipping-document')) { await route.fulfill({ contentType: 'application/pdf', body: Buffer.from('%PDF-1.4\nmock shipping document') }); return true }
    return false
  })
  await login(page)
  await openWorkspacePage(page, 'Orders', 'Orders & shipping')
  await page.getByRole('button', { name: 'Prepare order', exact: true }).click()
  await page.getByLabel('Handover method').selectOption('pickup')
  await page.getByLabel('Pickup address').selectOption('901')
  await page.getByLabel('Pickup time slot').selectOption('morning')
  await page.getByRole('button', { name: 'Confirm shipment' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(shipped).toEqual({ shippingMode: 'pickup', addressId: 901, pickupTimeId: 'morning' })
  await page.getByRole('button', { name: 'View escrow' }).click()
  await expect(page.getByRole('dialog').getByText('Expected payout')).toBeVisible()
  await expect(page.getByRole('dialog').getByText('Expected payout').locator('..')).not.toContainText('-10')
  await page.keyboard.press('Escape')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Print label' }).click()
  expect((await download).suggestedFilename()).toBe('AWB-SP1042.pdf')
})

test('returns dispute sends reason ID, contact email and proof URL array', async ({ page }) => {
  let dispute
  await setup(page, async (route, path) => {
    if (path === base + '/returns/RET1/dispute-reasons') { await json(route, [{ disputeReasonId: 3, disputeName: 'EMPTY_PARCEL', disputeRequirement: 'Attach unboxing proof' }]); return true }
    if (path.endsWith('/RET1/dispute')) { dispute = route.request().postDataJSON(); await json(route, { disputed: true }); return true }
    return false
  })
  await login(page)
  await openWorkspacePage(page, 'Orders', 'Returns & refunds')
  await page.getByRole('button', { name: 'Review return' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Dispute return', exact: true }).click()
  await page.getByLabel('Shopee dispute reason').selectOption('3')
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
  await openWorkspacePage(page, 'Catalog & stock', 'Product imports log')
  await page.getByRole('button', { name: 'Import Shopee products', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText('Import already running')
})
