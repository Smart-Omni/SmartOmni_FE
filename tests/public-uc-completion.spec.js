import { expect, test } from '@playwright/test'
import { mkdirSync } from 'node:fs'

async function loginCustomer(page) {
  await page.goto('/auth/login?account=customer'); await page.getByLabel('Email address').fill('customer@smartomni.demo')
  await page.getByLabel('Password', { exact: true }).fill('Demo@123'); await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/store\/everyday-studio$/)
}

test('Guest product chatbot recommends catalog products and retains only its own session', async ({ page }) => {
  await page.goto('/store/everyday-studio')
  await page.getByRole('link', { name: 'Ask product assistant', exact: true }).click()
  await page.getByRole('button', { name: 'Headphones', exact: true }).click()
  await page.getByRole('button', { name: 'Ask assistant', exact: true }).click()
  await expect(page.getByRole('log')).toContainText('Studio Headphones')
  await page.reload()
  await expect(page.getByRole('log')).toContainText('Studio Headphones')
  await page.getByLabel('Your question', { exact: true }).fill('under 500000')
  await page.getByRole('button', { name: 'Ask assistant', exact: true }).click()
  await expect(page.getByRole('log')).toContainText('within')
  await page.getByLabel('Your question', { exact: true }).fill('Track my marketplace order')
  await page.getByRole('button', { name: 'Ask assistant', exact: true }).click()
  await expect(page.getByRole('log')).toContainText('cannot confirm live prices, order status')
  await loginCustomer(page)
  await page.goto('/store/everyday-studio/assistant')
  await expect(page.getByRole('log')).not.toContainText('Track my marketplace order')
})

test('Customer tier voucher issuance previews opt-in and saves results without touching Owner data', async ({ page }) => {
  await loginCustomer(page); await page.goto('/customer/vouchers')
  await page.getByLabel('Voucher recipient tier').selectOption('Bronze')
  await page.getByLabel('Voucher discount percentage').fill('15')
  await page.getByRole('button', { name: 'Preview tier vouchers', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('Skipped · no opt-in')
  await page.getByRole('button', { name: 'Issue demo tier vouchers' }).click()
  await expect(page.getByRole('heading', { name: 'Bronze · 15% discount' })).toBeVisible()
  await expect(page.getByText('Issued locally', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Bronze · 15% discount' })).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('smartomni.owner-workspace-demo.v1'))).toBeNull()
  const replay = await page.evaluate(async () => {
    const { issueCustomerDemoVouchers, readCustomerCampaigns } = await import('/src/features/customer/customerVoucherStore.js')
    const batch = readCustomerCampaigns()[0]
    issueCustomerDemoVouchers(batch.tier, batch.discount, batch.requestId)
    return readCustomerCampaigns().length
  })
  expect(replay).toBe(1)
})

test('Guest cannot access or mutate customer campaigns', async ({ page }) => {
  await page.goto('/customer/vouchers')
  await expect(page).toHaveURL(/auth\/login\?account=customer$/)
  const denied = await page.evaluate(async () => {
    const { issueCustomerDemoVouchers } = await import('/src/features/customer/customerVoucherStore.js')
    try { issueCustomerDemoVouchers('Gold', 10, 'guest'); return 'unexpected' } catch (error) { return error.message }
  })
  expect(denied).toContain('verified customer')
})

test('store address setup checks format, reserved names and preview availability', async ({ page }) => {
  await page.goto('/auth/register/owner')
  await page.getByLabel('Target Domain', { exact: true }).fill('Invalid Address')
  await page.getByRole('button', { name: 'Check demo availability' }).click()
  await expect(page.getByRole('alert')).toContainText('3–63 lowercase')
  await page.getByLabel('Target Domain', { exact: true }).fill('everyday-studio')
  await page.getByRole('button', { name: 'Check demo availability' }).click()
  await expect(page.getByRole('alert')).toContainText('already used')
  await page.getByLabel('Target Domain', { exact: true }).fill('my-new-studio')
  await page.getByRole('button', { name: 'Check demo availability' }).click()
  await expect(page.getByRole('status')).toContainText('Available in this demo')
  await expect(page.getByLabel('Store address setup')).toContainText('my-new-studio.smartomni.example')
})

for (const width of [375, 1440]) test(`new public and customer screens fit at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 })
  mkdirSync('artifacts/uc-completion/public', { recursive: true })
  const errors = []; page.on('pageerror', error => errors.push(error.message))
  await page.goto('/store/everyday-studio/assistant')
  await page.getByRole('button', { name: 'Workspace essentials', exact: true }).click()
  await page.getByRole('button', { name: 'Ask assistant', exact: true }).click()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: `artifacts/uc-completion/public/assistant-${width}.png`, fullPage: true })
  await loginCustomer(page); await page.goto('/customer/vouchers')
  await expect(page.getByRole('heading', { name: 'Issue tier vouchers.' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: `artifacts/uc-completion/public/vouchers-${width}.png`, fullPage: true })
  await page.goto('/auth/register/owner')
  await page.getByLabel('Target Domain', { exact: true }).fill('new-studio')
  await page.getByRole('button', { name: 'Check demo availability' }).click()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: `artifacts/uc-completion/public/domain-${width}.png`, fullPage: true })
  expect(errors).toEqual([])
})
