import { test, expect } from '@playwright/test'
import { openWorkspacePage } from './helpers/workspace-navigation'

const base = '/api/v1/tiktok/orders'
const logistics = '/api/v1/tiktok/logistics'
const auth = { access_token: 'access-test', refresh_token: 'refresh-test', user_info: { id: 7, email: 'owner@example.test', fullName: 'API Owner', role: 'TENANT_ADMIN', tenant_id: 42, subdomain: 'test-store' } }
const shop = { id: 88, shopId: '727720655', shopName: 'Shopee Test Shop', shopRegion: 'VN', status: 'CONNECTED', needsReconnect: false }
const tiktokOrder = (id, status = 'AWAITING_SHIPMENT') => ({ order_id: id, order_status: status, buyer_email: 'buyer@example.test', recipient_address: { name: `Buyer ${id}`, full_address: '1 Le Loi, Ho Chi Minh' }, payment: { currency: 'VND', total_amount: 445000 }, tracking_number: null })

async function json(route, data, status = 200) { await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ success: status < 400, data, ...(status >= 400 ? { message: data.message, code: data.code } : {}) }) }) }
async function setup(page, handler = async () => false) {
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (!path.startsWith('/api/')) return route.continue()
    if (await handler(route, path)) return
    if (path === '/api/v1/auth/login') return json(route, auth)
    if (path === '/api/v1/tenants/subscription/status') return json(route, { status: 'ACTIVE' })
    // Order Hub loads Shopee orders before switching to the TikTok channel.
    if (path === '/api/v1/marketplace-connections/shopee/orders') return json(route, [])
    if (path === '/api/v1/marketplace-connections/shopee') return json(route, shop)
    if (path === '/api/v1/marketplace-connections/tiktok-shop') return json(route, { status: 'DISCONNECTED' })
    if (path === '/api/v1/orders') return json(route, { content: [], totalPages: 0, totalElements: 0 })
    if (path === '/api/v1/tiktok/aftersale/reasons') return json(route, { sellerCancelReasons: [
      { name: 'OUT_OF_STOCK', text: 'Out of stock' }, { name: 'BUYER_REQUESTED', text: 'Buyer requested cancellation' },
    ] })
    if (path === '/api/v1/tiktok/cancellations') return json(route, { cancellations: [] })
    if (path === '/api/v1/tiktok/returns') return json(route, { returns: [] })
    throw new Error(`Unexpected API: ${route.request().method()} ${path}`)
  })
}
async function openTiktokOrders(page) {
  await page.goto('/auth/login')
  await page.getByLabel('Email address').fill('owner@example.test')
  await page.getByLabel('Password', { exact: true }).fill('Testing@123')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/merchant\/shops$/)
  await openWorkspacePage(page, 'Orders', 'Orders & shipping')
  await page.getByLabel('Order source').selectOption('TIKTOK')
}
const showTab = (page, name) => page.getByRole('tab', { name }).click()
const row = (page, id) => page.locator('tbody tr').filter({ hasText: id })

test('TikTok authorization sends this origin as redirect_uri and exchanges the callback once', async ({ page, baseURL }) => {
  const connection = '/api/v1/marketplace-connections/tiktok-shop'
  const callbackUrl = new URL('/merchant/channels/tiktok-shop/callback', baseURL).href
  let callbacks = 0
  await setup(page, async (route, path) => {
    if (path === '/api/v1/tenants/subscription/status') { await json(route, { isPro: false, planName: 'FREE' }); return true }
    if (path === connection + '/authorization') {
      expect(route.request().postDataJSON()).toEqual({ redirect_uri: callbackUrl })
      await json(route, { authorizationUrl: `${callbackUrl}?code=test-code&state=test-state&redirect_uri=${encodeURIComponent(callbackUrl)}` })
      return true
    }
    if (path === connection + '/callback') {
      callbacks++
      expect(route.request().postDataJSON()).toMatchObject({ code: 'test-code', state: 'test-state' })
      await json(route, { ...shop, shopName: 'TikTok Test Shop' })
      return true
    }
    return false
  })
  await page.goto('/auth/login')
  await page.getByLabel('Email address').fill('owner@example.test')
  await page.getByLabel('Password', { exact: true }).fill('Testing@123')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/merchant\/shops$/)
  await page.goto('/merchant/shops?marketplace=tiktok-shop')
  await page.getByRole('button', { name: 'Connect TikTok Shop' }).click()
  await expect.poll(() => callbacks).toBe(1)
  expect(callbacks).toBe(1)
})

test('shows TikTok orders in the shared hub with stage tabs, masked buyer data and token paging', async ({ page }) => {
  const requests = []
  await setup(page, async (route, path) => {
    if (path !== base) return false
    const params = new URL(route.request().url()).searchParams
    requests.push({ pageSize: params.get('pageSize'), pageToken: params.get('pageToken') })
    if (params.get('pageToken') === 'cursor-2') await json(route, { next_page_token: null, total_count: 3, orders: null, order_list: [tiktokOrder('TT3')] })
    else await json(route, { next_page_token: 'cursor-2', total_count: 3, orders: [
      { ...tiktokOrder('TT1'), recipient_address: { name: 'Buyer TT1', phone_number: '0903412889', full_address: '1 Le Loi, Ho Chi Minh' }, line_items: [
        { id: 'L1', sku_id: 'S1', seller_sku: 'SKU-A', product_name: 'Áo thun', sale_price: '150000' },
        { id: 'L2', sku_id: 'S1', seller_sku: 'SKU-A', product_name: 'Áo thun', sale_price: '150000' },
      ] },
      tiktokOrder('TT2', 'COMPLETED'),
    ] })
    return true
  })
  await openTiktokOrders(page)
  await expect(page.locator('tbody tr')).toHaveCount(1)
  await expect(row(page, 'TT1')).toContainText('TikTok Shop')
  await expect(row(page, 'TT1')).toContainText('090****889')
  await expect(row(page, 'TT1')).toContainText('2× Áo thun')
  await expect(page.getByRole('button', { name: /^Overdue/ })).toBeDisabled()
  await expect(page.getByRole('button', { name: /^Overdue/ })).toContainText('—')
  await showTab(page, /Completed/)
  await expect(row(page, 'TT2')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Previous page' })).toBeDisabled()
  await page.getByRole('button', { name: 'Next page' }).click()
  await showTab(page, /All orders/)
  await expect(row(page, 'TT3')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Next page' })).toBeDisabled()
  await page.getByRole('button', { name: 'Previous page' }).click()
  await expect(row(page, 'TT1')).toBeVisible()
  expect(requests[0]).toEqual({ pageSize: '50', pageToken: null })
  expect(requests.map(item => item.pageToken)).toContain('cursor-2')
})

test('pending buyer cancellations and returns get their own tabs and the seller can reject', async ({ page }) => {
  let rejected
  await setup(page, async (route, path) => {
    if (path === base) { await json(route, { orders: [tiktokOrder('TT1'), tiktokOrder('TT2', 'DELIVERED')] }); return true }
    if (path === '/api/v1/tiktok/cancellations') {
      expect(new URL(route.request().url()).searchParams.get('status')).toBe('CANCELLATION_REQUEST_PENDING')
      await json(route, { cancellations: [{ cancel_id: 'C1', order_id: 'TT1', cancel_status: 'CANCELLATION_REQUEST_PENDING' }] })
      return true
    }
    if (path === '/api/v1/tiktok/returns') { await json(route, { returns: [{ return_id: 'R1', order_id: 'TT2', return_status: 'RETURN_OR_REFUND_REQUEST_PENDING' }] }); return true }
    if (path === '/api/v1/tiktok/aftersale/reject-reasons') { await json(route, [{ name: 'REJECT_ALREADY_SHIPPED', text: 'Already shipped' }]); return true }
    if (path === '/api/v1/tiktok/cancellations/C1/reject') { rejected = route.request().postDataJSON(); await json(route, { rejected: true }); return true }
    return false
  })
  await openTiktokOrders(page)
  await expect(page.getByRole('tab', { name: /To prepare/ })).toContainText('0')
  await showTab(page, /Returns/)
  await expect(row(page, 'TT2')).toContainText('Return requested')
  await showTab(page, /Cancellation requests/)
  await expect(row(page, 'TT1').getByRole('button', { name: 'Prepare order' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Review cancellation' }).click()
  await page.getByLabel('Seller decision').selectOption('reject')
  await page.getByLabel('Rejection reason (optional)').selectOption('REJECT_ALREADY_SHIPPED')
  await page.getByRole('button', { name: 'Confirm decision' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(rejected).toEqual({ rejectReason: 'REJECT_ALREADY_SHIPPED' })
})

test('orders stay visible with a warning when cancellations cannot be loaded', async ({ page }) => {
  await setup(page, async (route, path) => {
    if (path === base) { await json(route, { orders: [tiktokOrder('TT1')] }); return true }
    if (path === '/api/v1/tiktok/cancellations') { await json(route, { message: 'boom' }, 500); return true }
    return false
  })
  await openTiktokOrders(page)
  await expect(row(page, 'TT1')).toBeVisible()
  await expect(page.getByText('Could not load cancellation requests from TikTok.', { exact: false })).toBeVisible()
})

test('order details show masked address, line items and eligibility', async ({ page }) => {
  await setup(page, async (route, path) => {
    if (path === base) { await json(route, { orders: [{ ...tiktokOrder('TT1'), line_items: [{ id: 'L1', product_name: 'Áo thun', seller_sku: 'AT-RED-M', sku_name: 'Đỏ, M', quantity: 2, sale_price: 150000 }] }] }); return true }
    if (path === '/api/v1/tiktok/aftersale/eligibility/TT1') { await json(route, { request_types: ['REFUND', 'RETURN_AND_REFUND'] }); return true }
    return false
  })
  await openTiktokOrders(page)
  await page.getByRole('button', { name: 'View details' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Áo thun')).toBeVisible()
  await expect(dialog.getByText('AT-RED-M · Đỏ, M')).toBeVisible()
  await expect(dialog).toContainText('******, Ho Chi Minh')
  await expect(dialog).not.toContainText('1 Le Loi')
  await dialog.getByRole('button', { name: 'Check after-sales eligibility' }).click()
  await expect(dialog.getByText('Allowed request types: REFUND, RETURN_AND_REFUND')).toBeVisible()
  await expect(dialog.getByRole('button', { name: /Update TikTok stock/ })).toHaveCount(0)
})

test('updates one TikTok SKU with the IDs from the order and a confirmed quantity', async ({ page }, testInfo) => {
  const productId = '1729382256910300001'
  const skuId = '1729382256910300002'
  const requests = []
  await setup(page, async (route, path) => {
    if (path === base) { await json(route, { orders: [{ ...tiktokOrder('TT1'), line_items: [{ id: 'L1', product_id: productId, sku_id: skuId, product_name: 'Áo thun', sku_name: 'Đỏ, M', quantity: 2 }] }] }); return true }
    if (path === '/api/v1/tiktok/products/stock') {
      requests.push({ method: route.request().method(), body: route.request().postDataJSON() })
      if (requests.length === 1) await json(route, { message: 'TikTok rejected this update.' }, 422)
      else await json(route, { productId, skuId, quantity: 0 })
      return true
    }
    return false
  })
  await openTiktokOrders(page)
  await page.setViewportSize({ width: 375, height: 812 })
  await page.getByRole('button', { name: 'View details' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: /Update TikTok stock/ }).click()
  const input = dialog.getByLabel('New TikTok stock quantity')
  const confirm = dialog.getByRole('button', { name: 'Confirm stock update' })
  await input.fill('-1')
  await expect(confirm).toBeDisabled()
  await input.fill('0')
  expect(requests).toHaveLength(0)
  await dialog.screenshot({ path: testInfo.outputPath('tiktok-stock-mobile.png') })
  await confirm.click()
  await expect(dialog.getByRole('alert')).toHaveText('TikTok rejected this update.')
  await expect(input).toHaveValue('0')
  await confirm.click()
  await expect(dialog.getByRole('status')).toHaveText(`TikTok stock updated for SKU ${skuId}.`)
  expect(requests).toEqual(Array.from({ length: 2 }, () => ({ method: 'PUT', body: { productId, skuId, quantity: 0 } })))
})

test('sync sends the last 7 days and reports queued order counts', async ({ page }) => {
  let body
  await setup(page, async (route, path) => {
    if (path === base) { await json(route, { orders: [] }); return true }
    if (path === base + '/sync') { body = route.request().postDataJSON(); await json(route, { totalFetched: 3, enqueuedCount: 2, failedCount: 1, createdCount: 0, updatedCount: 0 }); return true }
    return false
  })
  await openTiktokOrders(page)
  await page.getByRole('button', { name: 'Sync TikTok orders' }).click()
  await expect(page.getByText('Queued 2/3 TikTok orders for sync · Failed: 1.')).toBeVisible()
  expect(body.toDate - body.fromDate).toBe(7 * 86400)
  expect(Math.abs(body.toDate - Date.now() / 1000)).toBeLessThan(120)
})

test('prepare order reads packageId from order details and ships it', async ({ page }) => {
  let shipped
  let lists = 0
  await setup(page, async (route, path) => {
    if (path === base) { lists++; await json(route, { orders: [tiktokOrder('TT1'), tiktokOrder('TT2', 'UNPAID')] }); return true }
    if (path === base + '/TT1') { await json(route, [{ ...tiktokOrder('TT1'), package_list: [{ package_id: 'PKG1' }] }]); return true }
    if (path === logistics + '/shipping-providers') {
      expect(new URL(route.request().url()).searchParams.get('packageId')).toBe('PKG1')
      await json(route, [{ shippingProviderId: 'P1', shippingProviderName: 'Express', shippingServiceId: 'SVC1', shippingServiceName: 'Standard' }])
      return true
    }
    if (path === logistics + '/ship-package') { shipped = route.request().postDataJSON(); await json(route, { package_id: 'PKG1', tracking_number: 'VN123' }); return true }
    return false
  })
  await openTiktokOrders(page)
  await expect(page.getByRole('button', { name: 'Prepare order', exact: true })).toHaveCount(1)
  await page.getByRole('button', { name: 'Prepare order', exact: true }).click()
  await expect(page.getByRole('dialog').getByText('Package PKG1')).toBeVisible()
  await page.getByLabel('Shipping service').selectOption('SVC1')
  await page.getByLabel('Handover method').selectOption('DROP_OFF')
  await page.getByRole('button', { name: 'Confirm shipment' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByText('Shipment confirmed. Tracking number: VN123')).toBeVisible()
  expect(shipped).toEqual({ orderId: 'TT1', packageId: 'PKG1', shippingServiceId: 'SVC1', handoverMethod: 'DROP_OFF' })
  await expect.poll(() => lists).toBe(2)
})

test('prepare order is blocked when TikTok returns no package', async ({ page }) => {
  await setup(page, async (route, path) => {
    if (path === base) { await json(route, { orders: [tiktokOrder('TT1')] }); return true }
    if (path === base + '/TT1') { await json(route, [tiktokOrder('TT1')]); return true }
    return false
  })
  await openTiktokOrders(page)
  await page.getByRole('button', { name: 'Prepare order', exact: true }).click()
  await expect(page.getByRole('dialog').getByText('TikTok returned no package for this order.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Confirm shipment' })).toBeDisabled()
})

test('batch shipment ships every selected package', async ({ page }) => {
  const shipped = []
  await setup(page, async (route, path) => {
    if (path === base) { await json(route, { orders: ['TT1', 'TT2'].map(id => ({ ...tiktokOrder(id), package_id: `PKG-${id}` })) }); return true }
    if (path.startsWith(base + '/')) { const id = path.split('/').at(-1); await json(route, [{ ...tiktokOrder(id), package_id: `PKG-${id}` }]); return true }
    if (path === logistics + '/ship-package') { shipped.push(route.request().postDataJSON()); await json(route, {}); return true }
    return false
  })
  await openTiktokOrders(page)
  await page.getByRole('checkbox', { name: 'Select order TT1' }).check()
  await page.getByRole('checkbox', { name: 'Select order TT2' }).check()
  await page.getByRole('button', { name: 'Arrange shipment (2 orders)' }).click()
  await page.getByRole('button', { name: 'Confirm batch shipment' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByText('Arranged shipment for 2 orders on TikTok Shop.')).toBeVisible()
  expect(shipped.map(item => item.packageId).sort()).toEqual(['PKG-TT1', 'PKG-TT2'])
})

test('shipping label uses the row packageId and SHIPPING_LABEL', async ({ page }) => {
  let label
  await setup(page, async (route, path) => {
    if (path === base) { await json(route, { orders: [{ ...tiktokOrder('TT1', 'AWAITING_COLLECTION'), package_id: 'PKG1' }, tiktokOrder('TT2', 'DELIVERED')] }); return true }
    if (path === logistics + '/shipping-label/download') { label = Object.fromEntries(new URL(route.request().url()).searchParams); await route.fulfill({ contentType: 'application/pdf', body: Buffer.from('%PDF-1.4\nmock label') }); return true }
    return false
  })
  await openTiktokOrders(page)
  await showTab(page, /All orders/)
  await expect(page.getByRole('button', { name: 'Print label' })).toHaveCount(1)
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Print label' }).click()
  expect((await download).suggestedFilename()).toBe('AWB-TT1.pdf')
  expect(label).toEqual({ packageId: 'PKG1', documentType: 'SHIPPING_LABEL' })
})

test('shipping label falls back to the order ID when no package exists', async ({ page }) => {
  let label
  await setup(page, async (route, path) => {
    if (path === base) { await json(route, { orders: [tiktokOrder('TT1', 'IN_TRANSIT')] }); return true }
    if (path === base + '/TT1') { await json(route, [tiktokOrder('TT1', 'IN_TRANSIT')]); return true }
    if (path === logistics + '/shipping-label/download') {
      label = Object.fromEntries(new URL(route.request().url()).searchParams)
      await route.fulfill({ contentType: 'application/pdf', body: Buffer.from('%PDF-1.4\nmock label') })
      return true
    }
    return false
  })
  await openTiktokOrders(page)
  await showTab(page, /Shipping/)
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Print label' }).click()
  await download
  expect(label).toEqual({ orderId: 'TT1', documentType: 'SHIPPING_LABEL' })
})

for (const [name, response] of [
  ['empty PDF body', { contentType: 'application/pdf', body: '' }],
  ['empty body without PDF header', { status: 200, body: '' }],
  ['structured API error', { status: 502, json: { success: false, code: 'SHIPPING_LABEL_UNAVAILABLE' } }],
]) {
  test(`shipping label reports unavailable label on ${name}`, async ({ page }) => {
    let downloads = 0
    page.on('download', () => downloads++)
    await setup(page, async (route, path) => {
      if (path === base) { await json(route, { orders: [{ ...tiktokOrder('TT1', 'AWAITING_COLLECTION'), package_id: 'PKG1' }] }); return true }
      if (path === logistics + '/shipping-label/download') { await route.fulfill(response); return true }
      return false
    })
    await openTiktokOrders(page)
    await showTab(page, /Awaiting pickup/)
    await page.getByRole('button', { name: 'Print label' }).click()
    await expect(page.getByText('TikTok has no shipping label for this order yet. Please try again later.')).toBeVisible()
    expect(downloads).toBe(0)
  })
}

test('cancel order is offered before shipping and sends the selected reason', async ({ page }) => {
  let cancelled
  let lists = 0
  await setup(page, async (route, path) => {
    if (path === base) { lists++; await json(route, { orders: ['UNPAID', 'ON_HOLD', 'AWAITING_SHIPMENT', 'IN_TRANSIT', 'CANCELLED'].map((status, index) => tiktokOrder(`TT${index + 1}`, status)) }); return true }
    if (path === '/api/v1/tiktok/cancellations/cancel') { cancelled = route.request().postDataJSON(); await json(route, { orderId: cancelled.orderId, canceled: true }); return true }
    return false
  })
  await openTiktokOrders(page)
  await showTab(page, /All orders/)
  await expect(page.getByRole('button', { name: 'Cancel order' })).toHaveCount(2)
  await row(page, 'TT3').getByRole('button', { name: 'Cancel order' }).click()
  await expect(page.getByLabel('Cancellation reason')).toHaveValue('OUT_OF_STOCK')
  await page.getByLabel('Cancellation reason').selectOption('BUYER_REQUESTED')
  await page.getByRole('button', { name: 'Confirm cancellation' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByText('Order TT3 cancelled.')).toBeVisible()
  expect(cancelled).toEqual({ orderId: 'TT3', cancelReason: 'BUYER_REQUESTED' })
  await expect.poll(() => lists).toBe(2)
})

test('cancel order keeps the dialog open when TikTok refuses', async ({ page }) => {
  await setup(page, async (route, path) => {
    if (path === base) { await json(route, { orders: [tiktokOrder('TT1')] }); return true }
    if (path === '/api/v1/tiktok/cancellations/cancel') { await json(route, { orderId: 'TT1', canceled: false }); return true }
    return false
  })
  await openTiktokOrders(page)
  await page.getByRole('button', { name: 'Cancel order' }).click()
  await page.getByRole('button', { name: 'Confirm cancellation' }).click()
  await expect(page.getByRole('dialog').getByText('TikTok did not accept this cancellation.')).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(1)
})

test('TikTok order conflicts show a connection link only for the disconnected code', async ({ page }) => {
  let attempts = 0
  await setup(page, async (route, path) => {
    if (path !== base) return false
    attempts += 1
    const failure = attempts === 1
      ? { message: 'Another synchronization is in progress.', code: 'SYNC_IN_PROGRESS' }
      : { message: 'TikTok Shop is not connected', code: 'TIKTOK_NOT_CONNECTED' }
    await json(route, failure, 409)
    return true
  })
  await openTiktokOrders(page)
  await expect(page.getByRole('alert')).toHaveText('Another synchronization is in progress.')
  await expect(page.getByRole('button', { name: 'Connect TikTok Shop' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByText('TikTok Shop is not connected. Connect your shop to view orders.')).toBeVisible()
  await page.getByRole('button', { name: 'Connect TikTok Shop' }).click()
  await expect(page).toHaveURL(/\/merchant\/shops\?marketplace=tiktok-shop$/)
})

test('ship deadlines from rts_sla_time fill the TikTok SLA cards like Shopee', async ({ page }) => {
  const nowSec = Math.floor(Date.now() / 1000)
  const due = (id, hours, status) => ({ ...tiktokOrder(id, status), rts_sla_time: nowSec + hours * 3600 })
  await setup(page, async (route, path) => {
    if (path !== '/api/v1/tiktok/orders') return false
    await json(route, { orders: [due('LATE', -2), due('SOON', 3), due('TODAY', 20), due('LATER', 40), due('SHIPPED', -5, 'IN_TRANSIT'), tiktokOrder('NODATE')] })
    return true
  })
  await openTiktokOrders(page)
  const card = name => page.getByRole('button', { name })
  await expect(card(/^Overdue/).locator('span').nth(1)).toHaveText('1')
  await expect(card(/^Urgent/).locator('span').nth(1)).toHaveText('1')
  await expect(card(/^Due within 24h/).locator('span').nth(1)).toHaveText('3')
  await expect(page.locator('tbody tr').first()).toContainText('LATE')
  await card(/^Due within 24h/).click()
  await expect(page.locator('tbody tr')).toHaveCount(3)
  await page.getByRole('button', { name: 'Select urgent orders (< 6h)' }).click()
  await expect(page.getByText('Selected 2 urgent orders to process now.')).toBeVisible()
})
