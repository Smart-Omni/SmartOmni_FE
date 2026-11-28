import { test, expect } from '@playwright/test'
import { openWorkspacePage } from './helpers/workspace-navigation'

const base = '/api/v1/tiktok/returns'
const auth = { access_token: 'access-test', refresh_token: 'refresh-test', user_info: { id: 7, email: 'owner@example.test', fullName: 'API Owner', role: 'TENANT_ADMIN', tenant_id: 42, subdomain: 'test-store' } }
const shop = { id: 88, shopId: '727720655', shopName: 'Shopee Test Shop', shopRegion: 'VN', status: 'CONNECTED', needsReconnect: false }
const tiktokReturn = (id, status = 'RETURN_OR_REFUND_REQUEST_PENDING') => ({ return_id: id, order_id: `O-${id}`, return_status: status, return_type: 'RETURN_AND_REFUND', return_reason: 'ecom_wrong_item', return_reason_text: 'Wrong item', refund_amount: { currency: 'VND', refund_total: '150000' }, create_time: 1761800000 })

async function json(route, data, status = 200) { await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ success: status < 400, data, ...(status >= 400 ? { message: data.message } : {}) }) }) }
async function setup(page, handler = async () => false) {
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (!path.startsWith('/api/')) return route.continue()
    if (await handler(route, path)) return
    if (path === '/api/v1/auth/login') return json(route, auth)
    if (path === '/api/v1/tenants/subscription/status') return json(route, { status: 'ACTIVE' })
    if (path === '/api/v1/tiktok/aftersale/reasons') return json(route, { returnStatuses: [] })
    if (/\/api\/v1\/tiktok\/returns\/[^/]+\/records$/.test(path)) return json(route, [])
    if (path === '/api/v1/marketplace-connections/shopee') return json(route, shop)
    if (path === '/api/v1/marketplace-connections/tiktok-shop') return json(route, { status: 'DISCONNECTED' })
    if (path === '/api/v1/marketplace-connections/shopee/returns/enriched') return json(route, { returnList: [{ returnSn: 'RET1', orderSn: 'SP1042', status: 'REQUESTED', refundAmount: 100000 }], more: false, total: 1 })
    if (path === '/api/v1/returns') return json(route, { content: [], totalPages: 0 })
    throw new Error(`Unexpected API: ${route.request().method()} ${path}`)
  })
}
async function openTiktokReturns(page) {
  await page.goto('/auth/login')
  await page.getByLabel('Email address').fill('owner@example.test')
  await page.getByLabel('Password', { exact: true }).fill('Testing@123')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/merchant\/shops$/)
  await openWorkspacePage(page, 'Orders', 'Returns & refunds')
  await expect(page.getByRole('cell', { name: /RET1/ })).toBeVisible()
  await page.getByLabel('Return source').selectOption('tiktok')
  await expect(page).toHaveURL(/source=tiktok/)
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
  await expect(page.getByRole('cell', { name: /SOME_NEW_STATUS/ })).toBeVisible()
  await page.getByRole('button', { name: 'Previous page' }).click()
  await page.getByLabel('Return status').selectOption('AWAITING_BUYER_SHIP')
  await page.getByLabel('Quick search').fill(' O-FAR ')
  await page.getByRole('button', { name: 'Search all pages for order ID O-FAR' }).click()
  await expect.poll(() => requests.at(-1)).toEqual({ status: 'AWAITING_BUYER_SHIP', orderId: 'O-FAR', pageToken: null })
  expect(requests.map(item => item.pageToken)).toContain('cursor-2')
})

test('approve return confirms first, then reloads the list', async ({ page }) => {
  let approved = 0
  let lists = 0
  await setup(page, async (route, path) => {
    if (path === base) { lists++; await json(route, { returns: [tiktokReturn('R1')] }); return true }
    if (path === base + '/R1') { await json(route, { ...tiktokReturn('R1'), return_line_items: [{ return_item_id: 'I1', seller_sku: 'AT-RED-M', quantity: 1, refund_amount: { currency: 'VND', refund_total: '150000' } }] }); return true }
    if (path === base + '/R1/records') { await json(route, [{ create_time: 1761800000, role: 'BUYER', event: 'REQUEST', description: 'Buyer asked', note: '', reason_text: 'Wrong item' }]); return true }
    if (path === base + '/R1/approve') { approved++; await json(route, { returnId: 'R1', approved: true }); return true }
    return false
  })
  await openTiktokReturns(page)
  await page.getByRole('button', { name: 'Review return' }).click()
  await expect(page.getByRole('dialog').getByText('AT-RED-M')).toBeVisible()
  await expect(page.getByRole('dialog').getByRole('row', { name: /AT-RED-M/ })).toContainText('150.000')
  await expect(page.getByRole('dialog').getByText('Processing history')).toBeVisible()
  await expect(page.getByRole('dialog').getByRole('cell', { name: 'BUYER', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Approve return' }).click()
  expect(approved).toBe(0)
  await page.getByRole('button', { name: 'Confirm approval' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByText('Return approved.')).toBeVisible()
  expect(approved).toBe(1)
  await expect.poll(() => lists).toBe(2)
})

for (const [reason, expected] of [['ITEM_USED_OR_DAMAGED', { rejectReason: 'ITEM_USED_OR_DAMAGED' }], ['', null]]) {
  test(`reject return ${expected ? 'sends the reason' : 'sends no body when the reason is blank'}`, async ({ page }) => {
    let body = 'not called'
    await setup(page, async (route, path) => {
      if (path === base) { await json(route, { returns: [tiktokReturn('R1')] }); return true }
      if (path === base + '/R1') { await json(route, tiktokReturn('R1')); return true }
      if (path === '/api/v1/tiktok/aftersale/reject-reasons') {
        expect(new URL(route.request().url()).searchParams.get('returnOrCancelId')).toBe('R1')
        await json(route, [{ name: 'ITEM_USED_OR_DAMAGED', text: 'Item was used or damaged' }])
        return true
      }
      if (path === base + '/R1/reject') { body = route.request().postData() ? route.request().postDataJSON() : null; await json(route, { returnId: 'R1', rejected: true }); return true }
      return false
    })
    await openTiktokReturns(page)
    await page.getByRole('button', { name: 'Review return' }).click()
    await page.getByRole('button', { name: 'Reject return' }).click()
    await expect(page.getByRole('option', { name: 'Item was used or damaged' })).toBeAttached()
    await page.getByLabel('Reject reason (optional)').selectOption(reason)
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
    if (path === base + '/R1/records') { await json(route, [{ create_time: 1761800000, role: 'BUYER', event: 'REQUEST', description: 'Buyer asked', note: '', reason_text: 'Wrong item' }]); return true }
    if (path === base + '/R1/approve') { await json(route, { returnId: 'R1', approved: false }); return true }
    return false
  })
  await openTiktokReturns(page)
  await page.getByRole('tab', { name: /All requests/ }).click()
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

test('groups tabs by status and confirms receipt of a shipped parcel from the row', async ({ page }) => {
  let approved = 0
  await setup(page, async (route, path) => {
    if (path === base) {
      await json(route, { returns: [tiktokReturn('R1'), tiktokReturn('R2', 'BUYER_SHIPPED_ITEM'), { ...tiktokReturn('R3'), arbitration_status: 'IN_ARBITRATION' }, tiktokReturn('R4', 'RETURN_OR_REFUND_REQUEST_COMPLETE')] })
      return true
    }
    if (path === base + '/R2/approve') { approved++; await json(route, { returnId: 'R2', approved: true }); return true }
    return false
  })
  await openTiktokReturns(page)
  for (const [tab, count] of [['Needs action', 1], ['Return in transit', 1], ['In arbitration', 1], ['Completed / Closed', 1], ['All requests', 4]]) {
    await expect(page.getByRole('tab', { name: new RegExp(tab) })).toContainText(String(count))
  }
  await page.getByRole('tab', { name: /Return in transit/ }).click()
  await page.getByRole('button', { name: 'Confirm receipt & refund' }).click()
  expect(approved).toBe(0)
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.getByText('TikTok return R2 approved.')).toBeVisible()
  expect(approved).toBe(1)
})

test('records a TikTok warehouse inspection without promising a restock', async ({ page }) => {
  const record = { id: 5, external_return_id: 'R1', platform: 'TIKTOK_SHOP', return_type: 'RETURN_AND_REFUND', status: 'APPROVED', marketplace_status: 'BUYER_SHIPPED_ITEM', inspection_result: 'PENDING', restocked: false, items: [{ id: 1, item_name: 'Shirt', quantity_returned: 1 }] }
  let body
  await setup(page, async (route, path) => {
    if (path === base) { await json(route, { returns: [tiktokReturn('R1', 'BUYER_SHIPPED_ITEM')] }); return true }
    if (path === '/api/v1/returns') { await json(route, { content: [record], totalPages: 1 }); return true }
    if (path === '/api/v1/returns/5') { await json(route, record); return true }
    if (path === '/api/v1/returns/5/inspection') { body = route.request().postDataJSON(); await json(route, record); return true }
    return false
  })
  await openTiktokReturns(page)
  await page.getByRole('button', { name: /^Awaiting inspection/ }).click()
  await page.getByRole('button', { name: 'Inspect', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('recorded only')
  await page.getByLabel('Inspection result').selectOption('MATCHED')
  await page.getByRole('button', { name: 'Save inspection' }).click()
  await expect(page.getByText('Inspection saved.')).toBeVisible()
  expect(body).toEqual({ result: 'MATCHED' })
})
