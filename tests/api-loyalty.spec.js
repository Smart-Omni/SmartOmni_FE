import { test, expect } from '@playwright/test'

const base = '/api/v1/loyalty'
const date = '2026-12-01T00:00:00Z'
const campaign = {
  id: 15, name: 'Holiday reward', platform: 'tiktok_shop', shopName: 'Test Shop',
  discountPercent: 10, requiredPoints: 100, quantity: 5, availableQuantity: 5,
  status: 'active', startsAt: date, endsAt: '2026-12-31T00:00:00Z', provisioningMode: 'import',
}
const roles = { CUSTOMER: 11, TENANT_STAFF: 12 }
const ok = (route, data) => route.fulfill({ json: { success: true, data } })

async function prepare(page, role, handlers) {
  await page.addInitScript(({ id, role }) => {
    sessionStorage.setItem('smartomni.api-session.v1', JSON.stringify({
      accessToken: 'test-access', refreshToken: 'test-refresh',
      account: { id, name: 'Test user', role, backendRole: role === 'TENANT_STAFF' ? 'MANAGER' : role, tenantId: 42 },
    }))
  }, { role, id: roles[role] })
  await page.route('**/api/v1/**', async route => {
    expect(route.request().headers().authorization).toBe('Bearer test-access')
    const { pathname } = new URL(route.request().url())
    if (pathname === '/api/v1/tenants/subscription/status') return ok(route, { isPro: false, planName: 'FREE' })
    const handle = handlers[route.request().method() + ' ' + pathname]
    if (!handle) throw new Error('Unexpected API request: ' + pathname)
    await handle(route)
  })
}

test('customer claims an order, reads the updated membership and requests a voucher', async ({ page }) => {
  const orderId = '9007199254740993'
  let claim
  let voucher
  await prepare(page, 'CUSTOMER', {
    ['GET ' + base + '/me']: route => ok(route, { totalPoints: claim ? 150 : 0, tier: 'BRONZE', nextTier: 'SILVER', pointsToNextTier: 350 }),
    ['GET ' + base + '/me/claims']: route => ok(route, claim ? [claim] : []),
    ['POST ' + base + '/claims']: route => {
      expect(route.request().postDataJSON()).toEqual({ orderId, totalAmount: '150000' })
      claim = { id: 1, orderId, pointsAwarded: 150, eligibleAmountVnd: 150000, claimedAt: date }
      return ok(route, claim)
    },
    ['GET ' + base + '/campaigns']: route => ok(route, [campaign]),
    ['GET ' + base + '/me/vouchers']: route => ok(route, voucher ? [voucher] : []),
    ['POST ' + base + '/me/reward-requests']: route => {
      expect(route.request().postDataJSON()).toEqual({ campaignId: 15, idempotencyKey: expect.any(String) })
      voucher = { id: 1, campaignId: 15, campaignName: campaign.name, status: 'pending', requestedAt: date }
      return ok(route, voucher)
    },
  })
  await page.goto('/customer')
  await expect(page.getByText('BRONZE')).toBeVisible()
  await page.getByRole('navigation').getByRole('link', { name: 'Claim order points' }).click()
  await page.getByLabel('SmartOmni order ID').fill(orderId)
  await page.getByLabel('Order total (VND)').fill('150000')
  await page.getByRole('button', { name: 'Review claim' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click()
  await expect(page.getByRole('status')).toHaveText(`Order ${orderId} earned 150 points.`)
  await page.getByRole('link', { name: 'Claim history' }).click()
  await expect(page.getByRole('rowheader', { name: orderId })).toBeVisible()
  await page.getByRole('link', { name: 'Loyalty vouchers' }).click()
  await expect(page.getByText('Available loyalty points: 150')).toBeVisible()
  await page.getByRole('button', { name: 'Request voucher' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click()
  await expect(page.getByRole('cell', { name: 'pending' })).toBeVisible()
  voucher = { ...voucher, status: 'issued', code: 'HOLIDAY-10' }
  await page.getByRole('button', { name: 'Refresh requests' }).click()
  await expect(page.getByRole('cell', { name: 'HOLIDAY-10' })).toBeVisible()
})

test('tenant staff creates and updates a campaign and reads issuance results', async ({ page }) => {
  let saved
  await prepare(page, 'TENANT_STAFF', {
    'GET /api/v1/marketplace-connections/tiktok-shop': route => ok(route, { id: 9, status: 'CONNECTED', shopName: 'Test Shop' }),
    'GET /api/v1/marketplace-connections/shopee': route => ok(route, null),
    ['GET ' + base + '/campaigns']: route => ok(route, saved ? [saved] : []),
    ['POST ' + base + '/campaigns']: route => {
      const body = route.request().postDataJSON()
      expect(body).toEqual({
        name: campaign.name, connectionId: '9', discountPercent: '10', requiredPoints: '100',
        quantity: 5, provisioningMode: 'import', externalCouponId: 'coupon-10',
        status: 'draft', startsAt: expect.any(String), endsAt: expect.any(String),
      })
      saved = { ...campaign, ...body }
      return ok(route, saved)
    },
    ['PATCH ' + base + '/campaigns/15']: route => {
      const body = route.request().postDataJSON()
      expect(body).toMatchObject({ status: 'active', externalCouponId: 'coupon-10' })
      expect(body).not.toHaveProperty('connectionId')
      saved = { ...saved, ...body }
      return ok(route, saved)
    },
    ['GET ' + base + '/reward-requests']: route => ok(route, [
      { id: 1, customerId: 11, campaignName: campaign.name, status: 'failed', failureReason: 'Coupon unavailable', requestedAt: date },
    ]),
  })
  await page.goto('/merchant/vouchers')
  await page.getByRole('button', { name: 'New campaign' }).click()
  await page.getByLabel('Connected shop').selectOption('9')
  await page.getByLabel('Campaign name').fill(campaign.name)
  await page.getByLabel('Discount (%)').fill('10')
  await page.getByLabel('Required points').fill('100')
  await page.getByLabel('Voucher quantity').fill('5')
  await page.getByLabel('Marketplace coupon ID (optional)').fill('coupon-10')
  await page.getByLabel('Starts (local time)').fill('2026-12-01T00:00')
  await page.getByLabel('Ends (local time)').fill('2026-12-31T00:00')
  await page.getByRole('button', { name: 'Save campaign' }).click()
  await expect(page.getByRole('cell', { name: 'draft' })).toBeVisible()
  await page.getByRole('button', { name: 'Edit campaign' }).click()
  await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('active')
  await page.getByRole('button', { name: 'Save campaign' }).click()
  await expect(page.getByRole('cell', { name: 'active' })).toBeVisible()
  await page.getByRole('link', { name: 'View voucher requests' }).click()
  await expect(page.getByRole('cell', { name: 'Coupon unavailable' })).toBeVisible()
})
