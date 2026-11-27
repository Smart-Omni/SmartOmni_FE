import { test, expect } from '@playwright/test'
import { openWorkspacePage } from './helpers/workspace-navigation'

const shopee = '/api/v1/marketplace-connections/shopee'
const auth = { access_token: 'access-test', refresh_token: 'refresh-test', user_info: { id: 7, email: 'owner@example.test', fullName: 'API Owner', role: 'TENANT_ADMIN', tenant_id: 42, subdomain: 'test-store' } }
const shopeeReturn = (returnSn, status = 'REQUESTED') => ({ returnSn, orderSn: `O-${returnSn}`, status, refundAmount: 100000, needsLogistics: true })
const record = (id, externalId, inspected = false) => ({
  id, external_return_id: externalId, platform_order_id: `O-${externalId || id}`, platform: 'SHOPEE', return_type: 'PHYSICAL_RETURN',
  status: inspected ? 'COMPLETED' : 'REQUESTED', inspection_result: inspected ? 'MATCHED' : 'PENDING', restocked: inspected,
})

async function json(route, data, status = 200) { await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ success: status < 400, data, ...(status >= 400 ? { message: data.message } : {}) }) }) }
async function open(page, handler) {
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url())
    const path = url.pathname
    if (!path.startsWith('/api/')) return route.continue()
    if (await handler(route, path, url.searchParams)) return
    if (path === '/api/v1/auth/login') return json(route, auth)
    if (path === '/api/v1/tenants/subscription/status') return json(route, { status: 'ACTIVE' })
    if (path === shopee) return json(route, { id: 88, shopId: '727720655', status: 'CONNECTED', needsReconnect: false })
    if (path === '/api/v1/marketplace-connections/tiktok-shop') return json(route, { status: 'DISCONNECTED' })
    throw new Error(`Unexpected API: ${route.request().method()} ${path}`)
  })
  await page.goto('/auth/login')
  await page.getByLabel('Email address').fill('owner@example.test')
  await page.getByLabel('Password', { exact: true }).fill('Testing@123')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/merchant\/shops$/)
  await openWorkspacePage(page, 'Orders', 'Returns & refunds')
}
const requests = page => page.getByLabel('Shopee return requests', { exact: true })
const unmatched = page => page.getByLabel('Unmatched warehouse returns', { exact: true }).locator('table')

test('joins warehouse records by return number and keeps unmatched pending inspections reachable', async ({ page }) => {
  const warehousePages = []
  await open(page, async (route, path, params) => {
    if (path === shopee + '/returns/enriched') { await json(route, { returnList: [shopeeReturn('RET1'), shopeeReturn('RET2', 'CLOSED'), shopeeReturn('RET3')], more: false, total: 3 }); return true }
    if (path === '/api/v1/returns') {
      warehousePages.push(params.get('page'))
      const content = params.get('page') === '0' ? [record(1, 'RET1', true), record(2, 'RET2')] : [record(3, 'OTHER'), record(4, null)]
      await json(route, { content, totalPages: 2 })
      return true
    }
    return false
  })
  await expect(requests(page).getByRole('row', { name: /RET1/ })).toContainText('Matched')
  await expect(requests(page).getByRole('row', { name: /RET1/ }).getByRole('button', { name: 'View inspection' })).toBeVisible()
  await expect(requests(page).getByRole('row', { name: /RET3/ }).getByRole('button', { name: /inspect/i })).toHaveCount(0)
  await expect(requests(page).getByRole('row', { name: /RET2/ })).toHaveCount(0)
  await page.getByRole('button', { name: /^Awaiting inspection/ }).click()
  await expect(requests(page).locator('tbody tr')).toHaveCount(1)
  await expect(requests(page).getByRole('row', { name: /RET2/ }).getByRole('button', { name: 'Inspect' })).toBeVisible()
  await expect(unmatched(page).locator('tbody tr')).toHaveCount(2)
  await expect(unmatched(page)).toContainText('OTHER')
  expect(warehousePages).toContain('1')
})

test('shows requests when warehouse records fail to load', async ({ page }) => {
  await open(page, async (route, path) => {
    if (path === shopee + '/returns/enriched') { await json(route, { returnList: [shopeeReturn('RET1')], more: false, total: 1 }); return true }
    if (path === '/api/v1/returns') { await json(route, { message: 'Warehouse offline' }, 500); return true }
    return false
  })
  await expect(requests(page).getByRole('row', { name: /RET1/ })).toContainText('Unavailable')
  await expect(page.getByText('Warehouse inspections could not be loaded', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Awaiting inspection/ })).toContainText('—')
})

test('accepts a refund only after confirmation', async ({ page }) => {
  let confirmed = 0
  await open(page, async (route, path) => {
    if (path === shopee + '/returns/enriched') { await json(route, { returnList: [shopeeReturn('RET1')], more: false, total: 1 }); return true }
    if (path === '/api/v1/returns') { await json(route, { content: [], totalPages: 0 }); return true }
    if (path === shopee + '/returns/RET1/confirm') { confirmed++; await json(route, { confirmed: true }); return true }
    return false
  })
  await page.getByRole('button', { name: 'Accept refund' }).click()
  expect(confirmed).toBe(0)
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByText('Refund accepted for Shopee return RET1.')).toBeVisible()
  expect(confirmed).toBe(1)
})

test('filters by status and pages through Shopee returns', async ({ page }) => {
  const queries = []
  await open(page, async (route, path, params) => {
    if (path === shopee + '/returns/enriched') {
      queries.push({ pageNo: params.get('pageNo'), status: params.get('status') })
      const second = params.get('pageNo') === '2'
      await json(route, { returnList: [shopeeReturn(second ? 'RET51' : 'RET1', params.get('status') || 'REQUESTED')], more: !second, total: 51 })
      return true
    }
    if (path === '/api/v1/returns') { await json(route, { content: [], totalPages: 0 }); return true }
    return false
  })
  await page.getByRole('button', { name: 'Next page' }).click()
  await expect(requests(page)).toContainText('RET51')
  await page.getByLabel('Return status').selectOption('CLOSED')
  await expect(requests(page).getByRole('row', { name: /RET1/ })).toBeVisible()
  await expect(page.getByRole('tab', { name: /All requests/ })).toHaveAttribute('aria-selected', 'true')
  expect(queries.at(-1)).toEqual({ pageNo: '1', status: 'CLOSED' })
})
