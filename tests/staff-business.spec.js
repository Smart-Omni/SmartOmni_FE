import { expect, test } from '@playwright/test'
import { mkdirSync } from 'node:fs'

async function login(page, email = 'staff.active@smartomni.demo') {
  await page.goto('/auth/login'); await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password', { exact: true }).fill('Demo@123')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/merchant\/dashboard$/)
}
const open = (page, screen) => page.goto(`/merchant/staff/${screen}?tenant=everyday-studio`)

test('staff planning and costs share the tenant ledger with Owner and update reports', async ({ page, context }) => {
  await login(page); await open(page, 'sales-events')
  await page.getByLabel('Event name').fill('Staff weekend campaign')
  await page.getByRole('button', { name: 'Save sales event' }).click()
  await expect(page.getByLabel('Saved sales events', { exact: true })).toContainText('Staff weekend campaign')
  await open(page, 'forecasts')
  await expect(page.getByLabel('Demand forecasts', { exact: true })).toContainText('Scenario forecast')
  await open(page, 'costs')
  await page.getByLabel('Cost description').fill('Staff packaging supplies')
  await page.getByLabel('Amount (VND)').fill('120000')
  await page.getByRole('button', { name: 'Save business cost', exact: true }).click()
  await expect(page.getByLabel('Business cost ledger', { exact: true })).toContainText('Staff packaging supplies')
  await open(page, 'profit')
  await expect(page.getByText('Demo profit estimate', { exact: true })).toBeVisible()
  const owner = await context.newPage(); await login(owner, 'owner@smartomni.demo')
  await owner.goto('/merchant/costs')
  await expect(owner.getByLabel('Business cost ledger', { exact: true })).toContainText('Staff packaging supplies')
  await owner.goto('/merchant/sales-events')
  await expect(owner.getByLabel('Saved sales events', { exact: true })).toContainText('Staff weekend campaign')
})

test('staff advisor preserves its own conversation history and exposes strategic links', async ({ page }) => {
  await login(page); await open(page, 'advisor')
  await page.getByLabel('Your question').fill('Review inventory risk')
  await page.getByRole('button', { name: 'Ask in demo' }).click()
  await expect(page.getByRole('heading', { name: 'Conversation history' }).locator('..')).toContainText('Demo inventory review')
  await page.reload()
  await expect(page.getByText('Demo inventory review:', { exact: false })).toBeVisible()
  await open(page, 'strategy')
  await page.getByRole('link', { name: 'Review profit estimate' }).click()
  await expect(page).toHaveURL(/staff\/profit$/)
})

test('read-only business permissions block edits and direct mutation calls', async ({ page }) => {
  await login(page)
  await page.evaluate(() => {
    const team = JSON.parse(localStorage.getItem('smartomni.team-demo.v1'))
    const member = team.find(item => item.email === 'staff.active@smartomni.demo')
    member.permissions = member.permissions.filter(permission => !['finance:write', 'planning:write'].includes(permission))
    localStorage.setItem('smartomni.team-demo.v1', JSON.stringify(team))
  })
  await open(page, 'costs')
  await expect(page.getByRole('button', { name: 'Save business cost', exact: true })).toHaveCount(0)
  const denied = await page.evaluate(async () => {
    const { saveBusinessCost } = await import('/src/features/portal/lib/ownerWorkspaceStore.js')
    try { saveBusinessCost({ date: '2026-10-23', amount: 100, category: 'Other', description: 'Blocked' }); return 'unexpected' } catch (error) { return error.message }
  })
  expect(denied).toContain('not granted permission')
  await open(page, 'sales-events')
  await expect(page.getByText('Read-only access.', { exact: false })).toBeVisible()
})

for (const width of [375, 1440]) test(`all staff business screens fit at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 }); await login(page)
  mkdirSync('artifacts/uc-completion/business', { recursive: true })
  const errors = []; page.on('pageerror', error => errors.push(error.message))
  for (const screen of ['business', 'sales-events', 'forecasts', 'costs', 'profit', 'advisor', 'strategy']) {
    await open(page, screen)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByText('Loading business workspace…')).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: `artifacts/uc-completion/business/${screen}-${width}.png`, fullPage: true })
  }
  expect(errors).toEqual([])
})
