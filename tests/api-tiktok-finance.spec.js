import { test, expect } from '@playwright/test'

const finance = '/api/marketplace-connections/tiktok/finance'
const owner = { access_token: 'access-test', refresh_token: 'refresh-test', user_info: { id: 7, email: 'owner@example.test', fullName: 'API Owner', role: 'TENANT_ADMIN', tenant_id: 42, subdomain: 'test-store' } }
const staff = { ...owner, user_info: { ...owner.user_info, id: 9, email: 'staff@example.test', fullName: 'API Staff', role: 'MANAGER' } }
const shop = { id: 88, shopId: '727720655', shopName: 'Shopee Test Shop', shopRegion: 'VN', status: 'CONNECTED', needsReconnect: false }
const tiktokOrder = (id, status) => ({ order_id: id, order_status: status, recipient_address: { name: `Buyer ${id}` }, payment: { total_amount: 445000 } })
const statement = id => ({ statementId: id, statementTime: 1761800000, settlementAmount: 12500000, currency: 'VND', status: 'PAID', paidTime: 1761900000 })

async function json(route, data, status = 200) { await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ success: status < 400, data, ...(status >= 400 ? { message: data.message } : {}) }) }) }
async function setup(page, handler = async () => false, auth = owner) {
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
async function login(page, email = 'owner@example.test') {
  await page.goto('/auth/login')
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password', { exact: true }).fill('Testing@123')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/merchant\/shops$/)
}
const settlementQuery = route => Object.fromEntries([...new URL(route.request().url()).searchParams].map(([key, value]) => [key, key.endsWith('Date') || key === 'pageSize' ? Number(value) : value]))

test('escrow is offered except for unpaid orders and shows negative net escrow as-is', async ({ page }) => {
  await setup(page, async (route, path) => {
    if (path === '/api/marketplace-connections/tiktok/orders') { await json(route, { orders: [tiktokOrder('TT1', 'UNPAID'), tiktokOrder('TT2', 'DELIVERED')] }); return true }
    if (path === finance + '/escrow/TT2') { await json(route, { orderId: 'TT2', escrowAmount: -12000, buyerTotalAmount: 445000, orderOriginalPrice: 450000, platformDiscount: 20000, sellerDiscount: 0, commissionFee: 22500, serviceFee: 9000, transactionFee: 4500, shippingFee: 15000, refundAmount: 0, currency: 'VND', paymentMethod: 'COD' }); return true }
    return false
  })
  await login(page)
  await page.getByRole('link', { name: 'Orders & shipping' }).click()
  await page.getByLabel('Order source').selectOption('tiktok')
  await expect(page.getByRole('button', { name: 'View escrow' })).toHaveCount(1)
  await page.getByRole('button', { name: 'View escrow' }).click()
  const dialog = page.getByRole('dialog')
  for (const label of ['Original product price', 'Buyer total', 'Platform discount', 'Seller discount', 'Shipping fee', 'Commission fee', 'Service fee', 'Transaction fee', 'Refund amount']) await expect(dialog.getByText(label, { exact: true })).toBeVisible()
  const net = dialog.getByText('Net escrow').locator('..').locator('dd')
  await expect(net).toContainText('-12.000')
  await expect(net).toHaveClass(/error/)
  await expect(dialog.getByText('Currency').locator('..')).toContainText('VND')
  await expect(dialog.getByText('Payment method').locator('..')).toContainText('COD')
})

test('settlements default to the last 30 days, apply custom ranges and page with nextPageToken', async ({ page }) => {
  const queries = []
  await setup(page, async (route, path) => {
    if (path !== finance + '/settlements') return false
    const query = settlementQuery(route)
    queries.push(query)
    if (query.pageToken === 'cursor-2') await json(route, { settlements: [statement('S3')], nextPageToken: null, total: 3 })
    else await json(route, { settlements: [statement('S1'), statement('S2')], nextPageToken: 'cursor-2', total: 3 })
    return true
  })
  await login(page)
  await page.getByRole('link', { name: 'TikTok settlements' }).click()
  await expect(page.getByRole('cell', { name: 'S1', exact: true })).toBeVisible()
  expect(queries[0].toDate - queries[0].fromDate).toBe(30 * 86400 - 1)
  await page.getByRole('button', { name: 'Next page' }).click()
  await expect(page.getByRole('cell', { name: 'S3', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Previous page' }).click()
  await page.getByLabel('From date').fill('2026-10-01')
  await page.getByLabel('To date').fill('2026-10-02')
  await page.getByRole('button', { name: 'Apply' }).click()
  const fromDate = await page.evaluate(() => Math.floor(new Date('2026-10-01T00:00:00').getTime() / 1000))
  await expect.poll(() => queries.at(-1)).toEqual({ fromDate, toDate: fromDate + 2 * 86400 - 1, pageSize: 20 })
  const count = queries.length
  await page.getByLabel('From date').fill('2026-10-05')
  await page.getByRole('button', { name: 'Apply' }).click()
  await expect(page.getByText('From date must be on or before To date.')).toBeVisible()
  expect(queries.length).toBe(count)
})

test('settlements 409 links to TikTok shop connection', async ({ page }) => {
  await setup(page, async (route, path) => {
    if (path === finance + '/settlements') { await json(route, { message: 'TikTok Shop is not connected' }, 409); return true }
    return false
  })
  await login(page)
  await page.getByRole('link', { name: 'TikTok settlements' }).click()
  await page.getByRole('button', { name: 'Connect TikTok Shop' }).click()
  await expect(page).toHaveURL(/\/merchant\/shops\?marketplace=tiktok-shop$/)
})

test('Staff cannot see or open TikTok settlements', async ({ page }) => {
  let settlementCalls = 0
  await setup(page, async (route, path) => {
    if (path === finance + '/settlements') { settlementCalls++; await json(route, { settlements: [] }); return true }
    return false
  }, staff)
  await login(page, 'staff@example.test')
  await expect(page.getByRole('link', { name: 'Returns & refunds' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'TikTok settlements' })).toHaveCount(0)
  await page.goto('/merchant/staff/settlements')
  await expect(page.getByRole('heading', { name: 'Owner access required' })).toBeVisible()
  expect(settlementCalls).toBe(0)
})
