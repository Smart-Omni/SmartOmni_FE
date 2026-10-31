import { test, expect } from '@playwright/test'

const base = '/api/marketplace-connections/tiktok/returns'
const auth = { access_token: 'access-test', refresh_token: 'refresh-test', user_info: { id: 7, email: 'owner@example.test', fullName: 'API Owner', role: 'TENANT_ADMIN', tenant_id: 42, subdomain: 'test-store' } }
const shop = { id: 88, shopId: '727720655', shopName: 'Shopee Test Shop', shopRegion: 'VN', status: 'CONNECTED', needsReconnect: false }
const tiktokReturn = (id, status = 'RETURN_OR_REFUND_REQUEST_PENDING') => ({ return_id: id, order_id: `O-${id}`, return_status: status, return_type: 'RETURN_AND_REFUND', return_reason: 'ecom_wrong_item', return_reason_text: 'Wrong item', refund_amount: 150000, create_time: 1761800000 })

async function json(route, data, status = 200) { await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ success: status < 400, data, ...(status >= 400 ? { message: data.message } : {}) }) }) }
async function setup(page, handler = async () => false) {
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (!path.startsWith('/api/')) return route.continue()
    if (await handler(route, path)) return
    if (path === '/api/v1/auth/login') return json(route, auth)
    if (path === '/api/marketplace-connections/shopee') return json(route, shop)
    if (path === '/api/marketplace-connections/tiktok-shop') return json(route, { status: 'DISCONNECTED' })
    if (path === '/api/marketplace-connections/shopee/returns') return json(route, { returnList: [{ returnSn: 'RET1', orderSn: 'SP1042', status: 'REQUESTED', refundAmount: 100000 }], more: false, total: 1 })
    throw new Error(`Unexpected API: ${route.request().method()} ${path}`)
  })
}
async function openTiktokReturns(page) {
  await page.goto('/auth/login')
  await page.getByLabel('Email address').fill('owner@example.test')
  await page.getByLabel('Password', { exact: true }).fill('Testing@123')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/merchant\/shops$/)
  await page.getByRole('link', { name: 'Returns & refunds' }).click()
  await expect(page.getByRole('cell', { name: /RET1/ })).toBeVisible()
  await page.getByLabel('Marketplace').selectOption('tiktok-shop')
  await expect(page).toHaveURL(/marketplace=tiktok-shop/)
}

test('lists TikTok returns with status/order filters and token paging', async ({ page }) => {
  const requests = []
  await setup(page, async (route, path) => {
    if (path !== base) return false
    const params = new URL(route.request().url()).searchParams
    requests.push({ status: params.get('status'), orderId: params.get('orderId'), pageToken: params.get('pageToken') })
    if (params.get('pageToken') === 'cursor-2') await json(route, { next_page_token: null, return_list: [tiktokReturn('R3', 'SOME_NEW_STATUS')] })
    else await json(route, { next_page_token: 'cursor-2', total_count: 3, returns: [tiktokReturn('R1'), tiktokReturn('R2')] })
    return true
  })
  await openTiktokReturns(page)
  await expect(page.getByRole('cell', { name: /R1/ }).first()).toBeVisible()
  await expect(page.getByText('Wrong item').first()).toBeVisible()
  await page.getByRole('button', { name: 'Next page' }).click()
  await expect(page.getByText('SOME_NEW_STATUS')).toBeVisible()
  await page.getByRole('button', { name: 'Previous page' }).click()
  await page.getByLabel('Return status').selectOption('AWAITING_BUYER_SHIP')
  await page.getByLabel('Order ID').fill(' O-R1 ')
  await page.getByRole('button', { name: 'Search returns' }).click()
  await expect.poll(() => requests.at(-1)).toEqual({ status: 'AWAITING_BUYER_SHIP', orderId: 'O-R1', pageToken: null })
  expect(requests.map(item => item.pageToken)).toContain('cursor-2')
})

test('approve return confirms first, then reloads the list', async ({ page }) => {
  let approved = 0
  let lists = 0
  await setup(page, async (route, path) => {
    if (path === base) { lists++; await json(route, { returns: [tiktokReturn('R1')] }); return true }
    if (path === base + '/R1') { await json(route, { ...tiktokReturn('R1'), return_line_items: [{ return_item_id: 'I1', seller_sku: 'AT-RED-M', quantity: 1, refund_amount: 150000 }] }); return true }
    if (path === base + '/R1/approve') { approved++; await json(route, { returnId: 'R1', approved: true }); return true }
    return false
  })
  await openTiktokReturns(page)
  await page.getByRole('button', { name: 'Review return' }).click()
  await expect(page.getByRole('dialog').getByText('AT-RED-M')).toBeVisible()
  await page.getByRole('button', { name: 'Approve return' }).click()
  expect(approved).toBe(0)
  await page.getByRole('button', { name: 'Confirm approval' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByText('Return approved.')).toBeVisible()
  expect(approved).toBe(1)
  await expect.poll(() => lists).toBe(2)
})

for (const [reason, expected] of [['Item was used', { rejectReason: 'Item was used' }], ['   ', null]]) {
  test(`reject return ${expected ? 'sends the reason' : 'sends no body when the reason is blank'}`, async ({ page }) => {
    let body = 'not called'
    await setup(page, async (route, path) => {
      if (path === base) { await json(route, { returns: [tiktokReturn('R1')] }); return true }
      if (path === base + '/R1') { await json(route, tiktokReturn('R1')); return true }
      if (path === base + '/R1/reject') { body = route.request().postData() ? route.request().postDataJSON() : null; await json(route, { returnId: 'R1', rejected: true }); return true }
      return false
    })
    await openTiktokReturns(page)
    await page.getByRole('button', { name: 'Review return' }).click()
    await page.getByRole('button', { name: 'Reject return' }).click()
    await expect(page.getByLabel('Reject reason (optional)')).toHaveAttribute('maxlength', '200')
    await page.getByLabel('Reject reason (optional)').fill(reason)
    await page.getByRole('button', { name: 'Confirm rejection' }).click()
    await expect(page.getByText('Return rejected.')).toBeVisible()
    expect(body).toEqual(expected)
  })
}

test('decisions are hidden outside the pending status and refusals keep the dialog open', async ({ page }) => {
  await setup(page, async (route, path) => {
    if (path === base) { await json(route, { returns: [tiktokReturn('R1'), tiktokReturn('R2', 'AWAITING_BUYER_SHIP')] }); return true }
    if (path === base + '/R1') { await json(route, tiktokReturn('R1')); return true }
    if (path === base + '/R2') { await json(route, tiktokReturn('R2', 'AWAITING_BUYER_SHIP')); return true }
    if (path === base + '/R1/approve') { await json(route, { returnId: 'R1', approved: false }); return true }
    return false
  })
  await openTiktokReturns(page)
  await page.getByRole('button', { name: 'Review return' }).nth(1).click()
  await expect(page.getByRole('dialog').getByText(/AWAITING_BUYER_SHIP/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Approve return' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Reject return' })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Review return' }).first().click()
  await page.getByRole('button', { name: 'Approve return' }).click()
  await page.getByRole('button', { name: 'Confirm approval' }).click()
  await expect(page.getByRole('dialog').getByText('TikTok did not accept this request.')).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(1)
})

test('409 not connected links to TikTok shop connection', async ({ page }) => {
  await setup(page, async (route, path) => {
    if (path === base) { await json(route, { message: 'TikTok Shop is not connected' }, 409); return true }
    return false
  })
  await openTiktokReturns(page)
  await expect(page.getByText('TikTok Shop is not connected. Connect your TikTok shop to view its returns.')).toBeVisible()
  await page.getByRole('button', { name: 'Connect TikTok Shop' }).click()
  await expect(page).toHaveURL(/\/merchant\/shops\?marketplace=tiktok-shop$/)
})
