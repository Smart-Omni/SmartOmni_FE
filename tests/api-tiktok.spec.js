import { test, expect } from '@playwright/test'

const base = '/api/marketplace-connections/tiktok/orders'
const logistics = '/api/marketplace-connections/tiktok/logistics'
const auth = { access_token: 'access-test', refresh_token: 'refresh-test', user_info: { id: 7, email: 'owner@example.test', fullName: 'API Owner', role: 'TENANT_ADMIN', tenant_id: 42, subdomain: 'test-store' } }
const shop = { id: 88, shopId: '727720655', shopName: 'Shopee Test Shop', shopRegion: 'VN', status: 'CONNECTED', needsReconnect: false }
const tiktokOrder = (id, status = 'AWAITING_SHIPMENT') => ({ order_id: id, order_status: status, buyer_email: 'buyer@example.test', recipient_address: { name: `Buyer ${id}`, full_address: '1 Le Loi, Ho Chi Minh' }, payment: { currency: 'VND', total_amount: 445000 }, tracking_number: null })

async function json(route, data, status = 200) { await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ success: status < 400, data, ...(status >= 400 ? { message: data.message } : {}) }) }) }
async function setup(page, handler = async () => false) {
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (!path.startsWith('/api/')) return route.continue()
    if (await handler(route, path)) return
    if (path === '/api/v1/auth/login') return json(route, auth)
    if (path === '/api/marketplace-connections/shopee') return json(route, shop)
    if (path === '/api/marketplace-connections/tiktok-shop') return json(route, { status: 'DISCONNECTED' })
    if (path === '/api/orders') return json(route, { content: [], totalPages: 0, totalElements: 0 })
    throw new Error(`Unexpected API: ${route.request().method()} ${path}`)
  })
}
async function openTiktokOrders(page) {
  await page.goto('/auth/login')
  await page.getByLabel('Email address').fill('owner@example.test')
  await page.getByLabel('Password', { exact: true }).fill('Testing@123')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/merchant\/shops$/)
  await page.getByRole('link', { name: 'Orders & shipping' }).click()
  await page.getByLabel('Order source').selectOption('tiktok')
}

test('lists TikTok orders, filters by status and pages with next_page_token', async ({ page }) => {
  const requests = []
  await setup(page, async (route, path) => {
    if (path !== base) return false
    const params = new URL(route.request().url()).searchParams
    requests.push({ orderStatus: params.get('orderStatus'), pageToken: params.get('pageToken') })
    if (params.get('pageToken') === 'cursor-2') await json(route, { next_page_token: null, total_count: 3, orders: null, order_list: [tiktokOrder('TT3')] })
    else await json(route, { next_page_token: 'cursor-2', total_count: 3, orders: [tiktokOrder('TT1'), tiktokOrder('TT2')] })
    return true
  })
  await openTiktokOrders(page)
  await expect(page.getByText('Orders are read directly from TikTok and are not saved to SmartOmni yet.')).toBeVisible()
  await expect(page.getByRole('cell', { name: /TT1/ })).toBeVisible()
  await expect(page.getByText('Buyer TT2 · TIKTOK')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sync order', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Previous page' })).toBeDisabled()
  await page.getByRole('button', { name: 'Next page' }).click()
  await expect(page.getByRole('cell', { name: /TT3/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Next page' })).toBeDisabled()
  await page.getByRole('button', { name: 'Previous page' }).click()
  await expect(page.getByRole('cell', { name: /TT1/ })).toBeVisible()
  await page.getByLabel('Order status').selectOption('AWAITING_SHIPMENT')
  await expect.poll(() => requests.at(-1)).toEqual({ orderStatus: 'AWAITING_SHIPMENT', pageToken: null })
  expect(requests.map(item => item.pageToken)).toContain('cursor-2')
})

test('order details read data[0] and show line items', async ({ page }) => {
  await setup(page, async (route, path) => {
    if (path === base) { await json(route, { orders: [tiktokOrder('TT1')] }); return true }
    if (path === base + '/TT1') { await json(route, [{ ...tiktokOrder('TT1'), line_items: [{ id: 'L1', product_name: 'Áo thun', seller_sku: 'AT-RED-M', sku_name: 'Đỏ, M', quantity: 2, sale_price: 150000 }] }]); return true }
    return false
  })
  await openTiktokOrders(page)
  await page.getByRole('button', { name: 'View order details' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Áo thun')).toBeVisible()
  await expect(dialog.getByText('AT-RED-M · Đỏ, M')).toBeVisible()
  await expect(dialog.getByText('1 Le Loi, Ho Chi Minh')).toBeVisible()
})

test('sync fetches the last 7 days and only reports fetched orders', async ({ page }) => {
  let body
  await setup(page, async (route, path) => {
    if (path === base) { await json(route, { orders: [] }); return true }
    if (path === base + '/sync') { body = route.request().postDataJSON(); await json(route, { orders: [tiktokOrder('TT1'), tiktokOrder('TT2')] }); return true }
    return false
  })
  await openTiktokOrders(page)
  await page.getByRole('button', { name: 'Sync TikTok orders' }).click()
  await expect(page.getByText('Fetched 2 orders from TikTok.')).toBeVisible()
  expect(body.toDate - body.fromDate).toBe(7 * 86400)
  expect(Math.abs(body.toDate - Date.now() / 1000)).toBeLessThan(120)
})

test('arrange shipment reads packageId from order details and ships it', async ({ page }) => {
  let shipped
  let lists = 0
  await setup(page, async (route, path) => {
    if (path === base) { lists++; await json(route, { orders: [tiktokOrder('TT1'), tiktokOrder('TT2', 'UNPAID')] }); return true }
    if (path === base + '/TT1') { await json(route, [{ ...tiktokOrder('TT1'), package_list: [{ package_id: 'PKG1' }] }]); return true }
    if (path === logistics + '/ship-package') { shipped = route.request().postDataJSON(); await json(route, { package_id: 'PKG1', tracking_number: 'VN123' }); return true }
    return false
  })
  await openTiktokOrders(page)
  await expect(page.getByRole('button', { name: 'Arrange shipment' })).toHaveCount(1)
  await page.getByRole('button', { name: 'Arrange shipment' }).click()
  await expect(page.getByRole('dialog').getByText('Package PKG1')).toBeVisible()
  await page.getByRole('button', { name: 'Confirm shipment' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByText('Shipment confirmed. Tracking: VN123')).toBeVisible()
  expect(shipped).toEqual({ orderId: 'TT1', packageId: 'PKG1' })
  await expect.poll(() => lists).toBe(2)
})

test('arrange shipment is blocked when TikTok returns no package', async ({ page }) => {
  await setup(page, async (route, path) => {
    if (path === base) { await json(route, { orders: [tiktokOrder('TT1')] }); return true }
    if (path === base + '/TT1') { await json(route, [tiktokOrder('TT1')]); return true }
    return false
  })
  await openTiktokOrders(page)
  await page.getByRole('button', { name: 'Arrange shipment' }).click()
  await expect(page.getByRole('dialog').getByText('TikTok did not return a package for this order.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Confirm shipment' })).toBeDisabled()
})

test('shipping label uses the row packageId and selected document type', async ({ page }) => {
  let label
  await setup(page, async (route, path) => {
    if (path === base) { await json(route, { orders: [{ ...tiktokOrder('TT1', 'AWAITING_COLLECTION'), package_id: 'PKG1' }, tiktokOrder('TT2', 'DELIVERED')] }); return true }
    if (path === logistics + '/shipping-providers') { await json(route, { documentTypes: ['SL_PDF', 'WAYBILL_PDF'] }); return true }
    if (path === logistics + '/shipping-label/download') { label = Object.fromEntries(new URL(route.request().url()).searchParams); await route.fulfill({ contentType: 'application/pdf', body: Buffer.from('%PDF-1.4\nmock label') }); return true }
    return false
  })
  await openTiktokOrders(page)
  await expect(page.getByRole('button', { name: 'Download shipping label' })).toHaveCount(1)
  await page.getByRole('button', { name: 'Download shipping label' }).click()
  await page.getByLabel('Label type').selectOption('WAYBILL_PDF')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download label' }).click()
  expect((await download).suggestedFilename()).toBe('TikTok-WAYBILL_PDF-TT1.pdf')
  expect(label).toEqual({ packageId: 'PKG1', documentType: 'WAYBILL_PDF' })
})

test('shipping label loads packageId from details and never falls back to orderId', async ({ page }) => {
  let details = 0
  await setup(page, async (route, path) => {
    if (path === base) { await json(route, { orders: [{ ...tiktokOrder('TT1', 'IN_TRANSIT') }, { ...tiktokOrder('TT2'), tracking_number: 'VN9' }] }); return true }
    if (path === base + '/TT1') { details++; await json(route, [{ ...tiktokOrder('TT1'), line_items: [{ id: 'L1', package_id: 'PKG-LINE' }] }]); return true }
    if (path === base + '/TT2') { details++; await json(route, [tiktokOrder('TT2')]); return true }
    if (path === logistics + '/shipping-providers') { await json(route, { documentTypes: ['SL_PDF'] }); return true }
    if (path === logistics + '/shipping-label/download') throw new Error('Label must not be requested here')
    return false
  })
  await openTiktokOrders(page)
  await page.getByRole('button', { name: 'Download shipping label' }).first().click()
  await expect(page.getByRole('dialog').getByText('Package PKG-LINE')).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Download shipping label' }).nth(1).click()
  await expect(page.getByRole('dialog').getByText('TikTok did not return a package for this order.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Download label' })).toBeDisabled()
  expect(details).toBe(2)
})

for (const [name, response] of [['empty PDF body', { contentType: 'application/pdf', body: '' }], ['empty body without PDF header', { status: 200, body: '' }]]) {
  test(`shipping label reports unavailable label on ${name}`, async ({ page }) => {
    let downloads = 0
    page.on('download', () => downloads++)
    await setup(page, async (route, path) => {
      if (path === base) { await json(route, { orders: [{ ...tiktokOrder('TT1', 'AWAITING_COLLECTION'), package_id: 'PKG1' }] }); return true }
      if (path === logistics + '/shipping-providers') { await json(route, { documentTypes: ['SL_PDF'] }); return true }
      if (path === logistics + '/shipping-label/download') { await route.fulfill(response); return true }
      return false
    })
    await openTiktokOrders(page)
    await page.getByRole('button', { name: 'Download shipping label' }).click()
    await page.getByRole('button', { name: 'Download label' }).click()
    await expect(page.getByRole('dialog').getByText('Shipping label is not available from TikTok yet. Please try again later.')).toBeVisible()
    expect(downloads).toBe(0)
  })
}

test('cancel order is offered before shipping and sends the selected reason', async ({ page }) => {
  let cancelled
  let lists = 0
  await setup(page, async (route, path) => {
    if (path === base) { lists++; await json(route, { orders: ['UNPAID', 'ON_HOLD', 'AWAITING_SHIPMENT', 'IN_TRANSIT', 'CANCELLED'].map((status, index) => tiktokOrder(`TT${index + 1}`, status)) }); return true }
    if (path === '/api/marketplace-connections/tiktok/cancellations/cancel') { cancelled = route.request().postDataJSON(); await json(route, { orderId: cancelled.orderId, canceled: true }); return true }
    return false
  })
  await openTiktokOrders(page)
  await expect(page.getByRole('button', { name: 'Cancel order' })).toHaveCount(3)
  await page.getByRole('button', { name: 'Cancel order' }).nth(1).click()
  await expect(page.getByLabel('Cancellation reason')).toHaveValue('OUT_OF_STOCK')
  await page.getByLabel('Cancellation reason').selectOption('CUSTOMER_REQUEST')
  await page.getByRole('button', { name: 'Confirm cancellation' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByText('Order cancelled.')).toBeVisible()
  expect(cancelled).toEqual({ orderId: 'TT2', cancelReason: 'CUSTOMER_REQUEST' })
  await expect.poll(() => lists).toBe(2)
})

test('cancel order keeps the dialog open when TikTok refuses', async ({ page }) => {
  await setup(page, async (route, path) => {
    if (path === base) { await json(route, { orders: [tiktokOrder('TT1')] }); return true }
    if (path === '/api/marketplace-connections/tiktok/cancellations/cancel') { await json(route, { orderId: 'TT1', canceled: false }); return true }
    return false
  })
  await openTiktokOrders(page)
  await page.getByRole('button', { name: 'Cancel order' }).click()
  await page.getByRole('button', { name: 'Confirm cancellation' }).click()
  await expect(page.getByRole('dialog').getByText('TikTok did not accept this cancellation.')).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(1)
})

test('409 not connected shows a link to TikTok shop connection', async ({ page }) => {
  await setup(page, async (route, path) => {
    if (path === base) { await json(route, { message: 'TikTok Shop is not connected' }, 409); return true }
    return false
  })
  await openTiktokOrders(page)
  await expect(page.getByText('TikTok Shop is not connected. Connect your TikTok shop to view its orders.')).toBeVisible()
  await page.getByRole('button', { name: 'Connect TikTok Shop' }).click()
  await expect(page).toHaveURL(/\/merchant\/shops\?marketplace=tiktok-shop$/)
})
