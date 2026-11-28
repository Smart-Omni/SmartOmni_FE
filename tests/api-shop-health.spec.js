import { test, expect } from '@playwright/test'

const ownerAuth = {
  access_token: 'api-access',
  refresh_token: 'api-refresh',
  user_info: {
    id: 7,
    email: 'owner@example.test',
    fullName: 'API Owner',
    role: 'TENANT_ADMIN',
    tenant_id: 42,
    subdomain: 'test-store',
  },
}

const ok = (route, data) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data }) })

const availableHealth = {
  updatedAt: '2026-11-28T10:00:00Z',
  timezone: 'GMT+7',
  totalDueSoon: 7,
  shopee: {
    state: 'AVAILABLE',
    unavailableReason: null,
    connected: true,
    quarterLabel: 'Quý 4/2026',
    weekLabel: 'Tuần 16/11–22/11, 2026',
    overallRating: 3,
    penaltyPoints: 2,
    penaltyEvents: [
      { referenceId: 101, violationType: 5, label: 'Giao hàng trễ (LSR)', points: 2, issueTimeEpochSec: 1795000000 },
    ],
    ongoingPunishments: [],
    lsr: { state: 'AVAILABLE', currentPeriod: 6.8, lastPeriod: 7.1, targetValue: 10, targetComparator: '<', affectedCount: 11 },
    nfr: { state: 'AVAILABLE', currentPeriod: 1.9, lastPeriod: 2.2, targetValue: 10, targetComparator: '<', affectedCount: 3 },
    dueSoon: 3,
    lateOrdersCount: 2,
  },
  tiktok: {
    state: 'ESTIMATED',
    unavailableReason: null,
    connected: true,
    windowLabel: '7 ngày · 22/11–28/11/2026',
    checkedOrders: 148,
    estimatedLdr: 5.4,
    lateDispatchCount: 8,
    sfcrState: 'ESTIMATED',
    estimatedSfcr: 2.1,
    sfcrOrders: 3,
    collectionDelayState: 'UNAVAILABLE',
    collectionDelayRate: null,
    lateCollectionCount: 0,
    dueSoon: 4,
  },
}

function makeOutcomes(periodDays) {
  return {
    periodDays,
    periodLabel: periodDays === 30 ? '30/10/2026 – 28/11/2026' : '22/11/2026 – 28/11/2026',
    timezone: 'GMT+7',
    from: '2026-11-22T00:00:00Z',
    to: '2026-11-29T00:00:00Z',
    cancelled: {
      total: periodDays === 30 ? 57 : 14,
      ratePct: 4.9,
      shopee: periodDays === 30 ? 31 : 8,
      tiktok: periodDays === 30 ? 26 : 6,
      topReason: 'Người mua đổi ý',
      seriesShopee: periodDays === 30 ? Array(30).fill(1) : [1, 2, 1, 0, 2, 1, 1],
      seriesTiktok: periodDays === 30 ? Array(30).fill(1) : [1, 1, 0, 1, 1, 1, 1],
    },
    aftersales: {
      total: periodDays === 30 ? 34 : 9,
      ratePct: 3.3,
      shopee: periodDays === 30 ? 19 : 5,
      tiktok: periodDays === 30 ? 15 : 4,
      refunds: periodDays === 30 ? 5000000 : 1250000,
      topReason: 'Sản phẩm lỗi / hư hỏng',
      seriesShopee: periodDays === 30 ? Array(30).fill(1) : [0, 1, 1, 0, 1, 1, 1],
      seriesTiktok: periodDays === 30 ? Array(30).fill(0) : [1, 0, 1, 0, 1, 0, 1],
    },
    cancelReasons: [
      { label: 'Người mua đổi ý', shopee: periodDays === 30 ? 11 : 3, tiktok: 2 },
      { label: 'Shop hết hàng', shopee: 2, tiktok: 2 },
    ],
    returnReasons: [
      { label: 'Sản phẩm lỗi / hư hỏng', shopee: periodDays === 30 ? 7 : 2, tiktok: 1 },
    ],
    dates: periodDays === 30 ? Array.from({ length: 30 }, (_, i) => `${i + 1}/11`) : ['22', '23', '24', '25', '26', '27', '28'],
  }
}

async function setupRoutes(page, healthPayload) {
  let healthCalls = 0
  const outcomeDaysCalled = []
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url())
    const path = url.pathname
    if (!path.startsWith('/api/')) return route.continue()
    if (path === '/api/v1/tenants/subscription/status') return ok(route, { isPro: true, planName: 'PRO' })
    if (path === '/api/v1/auth/login') return ok(route, ownerAuth)
    if (path === '/api/v1/users/me') return ok(route, { id: 7, email: 'owner@example.test', full_name: 'API Owner', role: 'TENANT_ADMIN', status: 'ACTIVE' })
    if (path === '/api/v1/marketplace-connections/shopee' || path === '/api/v1/marketplace-connections/tiktok-shop') return ok(route, null)
    if (path === '/api/v1/ai/insights/health') {
      healthCalls++
      return ok(route, healthPayload)
    }
    if (path === '/api/v1/ai/insights/outcomes') {
      const days = Number(url.searchParams.get('periodDays') || 7)
      outcomeDaysCalled.push(days)
      return ok(route, makeOutcomes(days))
    }
    return ok(route, {})
  })
  return { getHealthCalls: () => healthCalls, outcomeDaysCalled }
}

async function loginAndOpenHealth(page) {
  await page.goto('/auth/login')
  await page.getByLabel('Email address').fill('owner@example.test')
  await page.getByLabel('Password', { exact: true }).fill('Testing@123')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.goto('/merchant/insights/health')
  await expect(page.getByRole('heading', { name: 'Sức khỏe Shop', exact: true })).toBeVisible()
}

test('Shop Health renders fixed policy periods, interactive (?) hints, and decoupled Hủy & Hoàn switcher', async ({ page }) => {
  const tracker = await setupRoutes(page, availableHealth)
  await loginAndOpenHealth(page)

  await expect(page.getByText('2 điểm').first()).toBeVisible()
  await expect(page.getByText('6,8%').first()).toBeVisible()
  await expect(page.getByText('5,4%').first()).toBeVisible()
  await expect(page.getByText('Ước tính từ Order API')).toBeVisible()

  // (?) popover opens on click and closes on Escape
  const lsrHintBtn = page.getByRole('button', { name: /Giải thích chỉ số: Tỷ lệ giao hàng trễ/i }).first()
  await lsrHintBtn.click()
  await expect(page.getByRole('tooltip')).toContainText('Shopee AccountHealth API')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('tooltip')).toHaveCount(0)

  // Toggling 30 ngày in Hủy & Hoàn updates outcomes without re-fetching health
  await page.getByRole('button', { name: '30 ngày', exact: true }).click()
  await expect.poll(() => tracker.outcomeDaysCalled).toContain(30)
  expect(tracker.getHealthCalls()).toBe(1)
  await expect(page.getByText('57 đơn · 4,9% trên số đơn đã đặt')).toBeVisible()
  await expect(page.getByText('6,8%').first()).toBeVisible()
})

test('Shopee UNAVAILABLE state displays explicit notice without internal fallback', async ({ page }) => {
  await setupRoutes(page, {
    ...availableHealth,
    shopee: {
      ...availableHealth.shopee,
      state: 'UNAVAILABLE',
      unavailableReason: 'Shopee API tạm thời không khả dụng',
      penaltyPoints: null,
      lsr: { state: 'UNAVAILABLE', currentPeriod: null, lastPeriod: null, targetValue: 10, targetComparator: '<', affectedCount: null },
      nfr: { state: 'UNAVAILABLE', currentPeriod: null, lastPeriod: null, targetValue: 10, targetComparator: '<', affectedCount: null },
    },
  })
  await loginAndOpenHealth(page)

  await expect(page.getByText('Chỉ số Shopee không khả dụng')).toBeVisible()
  await expect(page.getByText('Shopee API tạm thời không khả dụng').first()).toBeVisible()
})
