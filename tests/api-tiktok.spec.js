import { test, expect } from '@playwright/test'

const base = '/api/marketplace-connections/tiktok/orders'
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
  await expect(page.getByRole('button', { name: 'Arrange shipment' })).toHaveCount(0)
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
