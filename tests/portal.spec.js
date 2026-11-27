import { expect, test } from '@playwright/test'

async function login(page, role) {
  await page.goto('/auth/login')
  const emails = { 'Tenant Owner': 'owner@smartomni.demo', 'Tenant Manager': 'manager@smartomni.demo', 'Super Admin': 'admin@smartomni.demo' }
  await page.getByLabel('Email address').fill(emails[role])
  await page.getByLabel('Password', { exact: true }).fill('Demo@123')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
}

test('owner demo persists on reload, filters orders, opens details and exports a report', async ({ page }) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await login(page, 'Tenant Owner')
  await expect(page).toHaveURL(/\/merchant\/dashboard$/)
  await expect(page.getByRole('heading', { name: 'Your store at a glance.' })).toBeVisible()
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(6)
  await page.getByLabel('Filter orders').selectOption('To pack')
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(3)
  await page.getByRole('button', { name: 'SO-1048', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('Everyday tote · Natural')
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  await page.getByRole('button', { name: 'Today', exact: true }).click()
  await expect(page.getByText('7.800.000', { exact: false })).toBeVisible()
  const downloaded = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export report' }).click()
  expect((await downloaded).suggestedFilename()).toBe('smartomni-demo-today.csv')
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Your store at a glance.' })).toBeVisible()
  const storage = await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))
  expect(storage.session).toEqual({ 'smartomni.demo-session': 'demo-owner' })
  expect(Object.keys(storage.local)).toEqual(['smartomni.security-demo.v1'])
  expect(storage.local['smartomni.security-demo.v1']).not.toContain('Demo@123')
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/merchant\/dashboard$/)
  await page.getByRole('button', { name: 'Sign out', exact: true }).filter({ visible: true }).click()
  await expect(page).toHaveURL(/\/auth\/login$/)
  await page.goto('/merchant/dashboard')
  await expect(page).toHaveURL(/\/auth\/login$/)
  expect(errors).toEqual([])
})

test('manager without invitation sees locked dashboard and no business fixtures', async ({ page }) => {
  const loaded = []
  page.on('request', request => loaded.push(request.url()))
  await login(page, 'Tenant Manager')
  await expect(page.getByRole('heading', { name: 'Your workspace is waiting.' })).toBeVisible()
  await expect(page.getByRole('table')).toHaveCount(0)
  expect(loaded.some(url => /OwnerDashboard|ownerDashboard/.test(url))).toBe(false)
  await page.getByRole('link', { name: 'Check invitations' }).click()
  await expect(page.getByText('No workspace invitations yet.', { exact: false })).toBeVisible()
  await page.goto('/merchant/orders')
  await expect(page).toHaveURL(/\/merchant\/dashboard$/)
  await page.goto('/merchant/profile')
  await expect(page.getByText('No workspace assigned')).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Your profile' })).toBeVisible()
})

test('super admin has a separate destination and cannot open merchant data', async ({ page }) => {
  await login(page, 'Super Admin')
  await expect(page).toHaveURL(/\/admin$/)
  await expect(page.getByRole('heading', { name: 'Platform overview' })).toBeVisible()
  await page.goto('/merchant/dashboard')
  await expect(page).toHaveURL(/\/admin$/)
  await expect(page.getByRole('heading', { name: 'Your store at a glance.' })).toHaveCount(0)
})

for (const width of [375, 768, 1024, 1440]) {
  test(`portal fits ${width}px for owner and locked manager`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await login(page, 'Tenant Owner')
    await expect(page.getByRole('heading', { name: 'Your store at a glance.' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `artifacts/portal/owner-${width}.png`, fullPage: true })
    await page.getByRole('button', { name: 'Sign out', exact: true }).filter({ visible: true }).click()
    await login(page, 'Tenant Manager')
    await expect(page.getByRole('heading', { name: 'Your workspace is waiting.' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `artifacts/portal/manager-locked-${width}.png`, fullPage: true })
  })
}
