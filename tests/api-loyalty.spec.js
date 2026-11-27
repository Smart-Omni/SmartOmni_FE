import { test, expect } from '@playwright/test'

const base = '/api/v1/loyalty'
const date = '2026-12-01T00:00:00Z'
const campaign = {
  id: 15, name: 'Holiday reward', platform: 'tiktok_shop', shopName: 'Test Shop',
  discountPercent: 10, requiredPoints: 100, quantity: 5, availableQuantity: 5,
  status: 'active', startsAt: date, endsAt: '2026-12-31T00:00:00Z', provisioningMode: 'import',
}
const roles = { CUSTOMER: 11, TENANT_MANAGER: 12 }
const ok = (route, data) => route.fulfill({ json: { success: true, data } })

async function prepare(page, role, handlers) {
  await page.addInitScript(({ id, role }) => {
    sessionStorage.setItem('smartomni.api-session.v1', JSON.stringify({
      accessToken: 'test-access', refreshToken: 'test-refresh',
      account: { id, name: 'Test user', role, backendRole: role === 'TENANT_MANAGER' ? 'MANAGER' : role, tenantId: 42 },
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
  const orderId = '5760028171077135663'
  let claim
  let voucher
  await prepare(page, 'CUSTOMER', {
    ['GET ' + base + '/me']: route => ok(route, { totalPoints: claim ? 150 : 0, tier: 'BRONZE', nextTier: 'SILVER', pointsToNextTier: 350 }),
    ['GET ' + base + '/me/claims']: route => ok(route, claim ? [claim] : []),
    ['POST ' + base + '/claims']: route => {
      expect(route.request().postDataJSON()).toEqual({ platformOrderId: orderId })
      claim = { id: 1, orderId: 901, pointsAwarded: 150, eligibleAmountVnd: 150000, claimedAt: date }
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
  await page.getByLabel('Order number').fill(' ' + orderId + ' ')
  await page.getByRole('button', { name: 'Claim points' }).click()
  await expect(page.getByRole('status')).toHaveText('You earned 150 points.')
  await page.getByRole('link', { name: 'Claim history' }).click()
  await expect(page.getByRole('rowheader', { name: '901' })).toBeVisible()
  await page.getByRole('link', { name: 'Loyalty vouchers' }).click()
  await expect(page.getByText('Available loyalty points: 150')).toBeVisible()
  await page.getByRole('button', { name: 'Request voucher' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click()
  await expect(page.getByRole('cell', { name: 'pending' })).toBeVisible()
  voucher = { ...voucher, status: 'issued', code: 'HOLIDAY-10' }
  await page.getByRole('button', { name: 'Refresh requests' }).click()
  await expect(page.getByRole('cell', { name: 'HOLIDAY-10' })).toBeVisible()
})

test('tenant manager creates and updates a campaign and reads issuance results', async ({ page }) => {
  let saved
  await prepare(page, 'TENANT_MANAGER', {
    'GET /api/v1/marketplace-connections/tiktok-shop': route => ok(route, { id: 9, status: 'CONNECTED', shopName: 'Test Shop' }),
    'GET /api/v1/marketplace-connections/shopee': route => ok(route, null),
    ['GET ' + base + '/campaigns']: route => ok(route, saved ? [saved] : []),
    ['GET ' + base + '/tiers']: route => ok(route, []),
    'GET /api/v1/tenants/subscription/status': route => ok(route, null),
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

const progressProfile = (points, reward) => ({
  totalPoints: points, tier: 'Gold', nextTier: 'Platinum', pointsToNextTier: 1000 - points,
  platforms: [
    { platform: 'tiktok_shop', connectionId: 9, shopName: 'TT', currentTier: 'Gold', nextTier: 'Platinum', pointsToNextTier: 1000 - points, milestones: [
      { campaignId: 31, name: 'Gold', requiredPoints: 500, discountPercent: 10, reached: true, availableQuantity: 5, reward },
      { campaignId: 32, name: 'Platinum', requiredPoints: 1000, discountPercent: 20, reached: false, availableQuantity: 5, reward: null },
      { campaignId: 33, name: 'Diamond', requiredPoints: 1500, discountPercent: 30, reached: false, availableQuantity: 5, reward: null },
    ] },
    { platform: 'shopee', connectionId: 10, shopName: 'SP', currentTier: null, nextTier: 'Bạc', pointsToNextTier: 800 - points, milestones: [
      { campaignId: 41, name: 'Bạc', requiredPoints: 800, discountPercent: 5, reached: false, availableQuantity: 5, reward: null },
    ] },
  ],
})

test('customer sees tier progress per marketplace and gets a voucher for a reached tier', async ({ page }) => {
  let reward = null
  await prepare(page, 'CUSTOMER', {
    ['GET ' + base + '/me']: route => ok(route, progressProfile(620, reward)),
    ['POST ' + base + '/me/reward-requests']: route => {
      expect(route.request().postDataJSON()).toEqual({ campaignId: 31, idempotencyKey: expect.any(String) })
      reward = { requestId: 7, status: 'issued', code: 'GOLD10' }
      return ok(route, { id: 7, status: 'pending' })
    },
    ['POST ' + base + '/claims']: route => route.fulfill({ status: 400, json: { success: false, code: 'ORDER_NOT_ELIGIBLE_YET',
      message: 'Order has not reached the 15-day eligibility date yet (eligible from 2026-12-09)' } }),
  })
  await page.goto('/customer/loyalty')
  await expect(page.getByText('620', { exact: true })).toBeVisible()
  const bar = page.getByRole('progressbar')
  await expect(bar).toHaveAttribute('aria-valuenow', '620')
  await expect(bar).toHaveAttribute('aria-valuemax', '1500')
  await expect(page.getByText('380 more points to Platinum on TikTok Shop.')).toBeVisible()
  await page.getByRole('button', { name: 'Get voucher' }).click()
  await expect(page.getByText('GOLD10')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Get voucher' })).toHaveCount(0)
  await page.getByRole('tab', { name: 'Shopee' }).click()
  await expect(page.getByRole('tab', { name: 'Shopee' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '800')
  await expect(page.getByText('Locked')).toBeVisible()
  await page.getByLabel('Order number').fill('5760000000000000001')
  await page.getByRole('combobox', { name: /^Marketplace/ }).selectOption('tiktok_shop')
  await page.getByRole('button', { name: 'Claim points' }).click()
  await expect(page.getByRole('alert')).toHaveText('Points can be claimed 15 days after the order is completed, from 09/12/2026.')
})

const batch = (title, percent, free = 20) => ({ title, discountType: 'PERCENT_OFF', discountValue: percent, ongoingCodes: 20, freeCodes: free, endTime: '2026-12-31T00:00:00Z' })
const tiktokBatches = [batch('Loyalty Gold 10%', 10, 18), batch('Loyalty Gold 15%', 15), batch('Loyalty Platinum 20%', 20), batch('Loyalty Diamond 30%', 30)]

async function tierSetupPage(page, onSave) {
  const setup = [{ connectionId: 9, platform: 'tiktok_shop', shopName: 'Test Shop', provisioningMode: 'import', tiers: [],
    suggested: [{ name: 'Gold', requiredPoints: 500, discountPercent: 10 }, { name: 'Platinum', requiredPoints: 1000, discountPercent: 20 }, { name: 'Diamond', requiredPoints: 1500, discountPercent: 30 }] }]
  let saved
  await prepare(page, 'TENANT_MANAGER', {
    ['GET ' + base + '/tiers']: route => ok(route, saved ? [{ ...setup[0], tiers: saved.tiers.map((t, i) => ({ ...t, campaignId: 60 + i, quantity: 18, availableQuantity: 18, endsAt: '2026-12-31T00:00:00Z' })) }] : setup),
    ['PUT ' + base + '/tiers']: route => { saved = route.request().postDataJSON(); onSave(saved); return ok(route, {}) },
    ['GET ' + base + '/campaigns']: route => ok(route, []),
    'GET /api/v1/tiktok/vouchers/batches': route => ok(route, tiktokBatches),
    'GET /api/v1/tenants/subscription/status': route => ok(route, null),
  })
  await page.goto('/merchant/vouchers')
}

test('tenant manager sets marketplace tiers from the suggestion and links TikTok code batches', async ({ page }) => {
  let body
  await tierSetupPage(page, value => { body = value })
  await expect(page.getByText(/create a code batch in TikTok Seller Center/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Refresh batches' })).toBeEnabled()
  await page.getByRole('button', { name: 'Use suggestion' }).click()
  // the suggestion picks the batch named after the tier that gives the tier's percent
  await expect(page.getByLabel('Tier 1 TikTok code batch')).toHaveValue('Loyalty Gold 10%')
  await expect(page.getByLabel('Tier 3 TikTok code batch')).toHaveValue('Loyalty Diamond 30%')
  await page.getByLabel('Tier 1 voucher percent').fill('15')
  await page.getByLabel('Tier 1 TikTok code batch').selectOption('Loyalty Gold 15%')
  await page.getByRole('button', { name: 'Save tiers' }).click()
  await expect.poll(() => body).toEqual({ connectionId: 9, tiers: [
    { campaignId: null, name: 'Gold', requiredPoints: 500, discountPercent: 15, tiktokBatchTitle: 'Loyalty Gold 15%' },
    { campaignId: null, name: 'Platinum', requiredPoints: 1000, discountPercent: 20, tiktokBatchTitle: 'Loyalty Platinum 20%' },
    { campaignId: null, name: 'Diamond', requiredPoints: 1500, discountPercent: 30, tiktokBatchTitle: 'Loyalty Diamond 30%' },
  ] })
  await expect(page.getByLabel('Tier 1 name')).toHaveValue('Gold')
  await expect(page.getByText('Gold: 18 of 18 codes left from “Loyalty Gold 15%”', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Remove tier 3' }).click()
  await page.getByLabel('Tier 2 points').fill('500')
  await page.getByRole('button', { name: 'Save tiers' }).click()
  await expect(page.getByRole('alert')).toHaveText('Two tiers cannot need the same points.')
})

test('a TikTok tier is not saved with a batch giving another percent or without a batch', async ({ page }) => {
  let body
  await tierSetupPage(page, value => { body = value })
  await page.getByRole('button', { name: 'Use suggestion' }).click()
  await page.getByLabel('Tier 2 TikTok code batch').selectOption('Loyalty Gold 15%')
  await page.getByRole('button', { name: 'Save tiers' }).click()
  await expect(page.getByRole('alert')).toHaveText("TikTok batch 'Loyalty Gold 15%' gives 15%, Platinum needs 20%.")
  await page.getByLabel('Tier 2 TikTok code batch').selectOption('')
  await page.getByRole('button', { name: 'Save tiers' }).click()
  await expect(page.getByRole('alert')).toHaveText('Choose the TikTok code batch for Platinum.')
  // the percent field only takes whole numbers, so the browser blocks a fractional percent before submit
  await page.getByLabel('Tier 2 voucher percent').fill('12.5')
  await page.getByRole('button', { name: 'Save tiers' }).click()
  expect(await page.getByLabel('Tier 2 voucher percent').evaluate(input => input.validity.stepMismatch)).toBe(true)
  expect(body).toBeUndefined()
})
