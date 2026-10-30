import { test, expect } from '@playwright/test'

const ok = (route, data) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data }) })
const fail = (route, status, message) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ success: false, message }) })
async function fill(page) {
  await page.getByLabel('Full name', { exact: true }).fill('New Owner')
  await page.getByLabel('Email address', { exact: true }).fill('owner-new@example.test')
  await page.getByLabel('Store name', { exact: true }).fill('New Store')
  await page.getByLabel('Store subdomain', { exact: true }).fill('new-store')
  await page.getByLabel('Password', { exact: true }).fill('Owner@123')
  await page.getByLabel('Confirm password', { exact: true }).fill('Owner@123')
}
async function setup(page, handler) {
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (!path.startsWith('/api/')) return route.continue()
    expect(route.request().headers().authorization).toBeUndefined()
    await handler(route, path)
  })
}

test('guest registers Owner and subdomain then hands off the new email to sign-in', async ({ page }) => {
  const creates = [], logins = []
  await setup(page, async (route, path) => {
    if (path.endsWith('/check-subdomain')) { await ok(route, { available: true }); return }
    if (path === '/api/v1/tenants') { creates.push(route.request().postDataJSON()); await ok(route, { id: 51, subdomain: 'new-store', adminUserId: 8 }); return }
    if (path.endsWith('/login')) { logins.push(route.request().postDataJSON()); await fail(route, 401, 'Sign-in validation test'); return }
    throw new Error(`Unexpected API: ${path}`)
  })
  await page.goto('/auth/register')
  await page.getByRole('button', { name: 'Select Owner', exact: true }).click()
  await page.getByRole('link', { name: 'Continue as Owner', exact: true }).click()
  await expect(page).toHaveURL(/\/auth\/register\/owner$/)
  await fill(page)
  await page.getByRole('button', { name: 'Create Owner account and store', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your store is ready.' })).toBeVisible()
  expect(creates).toEqual([{ companyName: 'New Store', subdomain: 'new-store', adminEmail: 'owner-new@example.test', adminFullName: 'New Owner', adminPassword: 'Owner@123', planType: 'FREE' }])
  expect(await page.evaluate(() => JSON.stringify(sessionStorage) + JSON.stringify(localStorage) + JSON.stringify(history.state))).not.toContain('Owner@123')
  expect(await page.evaluate(() => sessionStorage.getItem('smartomni.api-session.v1'))).toBeNull()
  await page.getByRole('link', { name: 'Continue to sign in', exact: true }).click()
  await expect(page.getByLabel('Email address', { exact: true })).toHaveValue('owner-new@example.test')
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('')
  await page.getByLabel('Password', { exact: true }).fill('Owner@123')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByText('Sign-in validation test')).toBeVisible()
  expect(logins).toEqual([{ email: 'owner-new@example.test', password: 'Owner@123' }])
})

test('checks availability publicly and rechecks edited subdomain before creation', async ({ page }) => {
  const checks = [], creates = []
  await setup(page, async (route, path) => {
    if (path.endsWith('/check-subdomain')) {
      const value = new URL(route.request().url()).searchParams.get('subdomain'); checks.push(value)
      await ok(route, { available: value !== 'taken-store', message: value === 'taken-store' ? 'Already taken' : 'Available' }); return
    }
    creates.push(route.request().postDataJSON()); await ok(route, { subdomain: 'fresh-store' })
  })
  await page.goto('/auth/register/owner'); await fill(page)
  await page.getByRole('button', { name: 'Check subdomain', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Availability check passed.')
  await page.getByLabel('Store subdomain', { exact: true }).fill('taken-store')
  await expect(page.getByText('Availability check passed.', { exact: false })).toHaveCount(0)
  await page.getByRole('button', { name: 'Create Owner account and store', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText('Already taken')
  expect(creates).toHaveLength(0)
  await page.getByLabel('Store subdomain', { exact: true }).fill('fresh-store')
  await page.getByRole('button', { name: 'Create Owner account and store', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your store is ready.' })).toBeVisible()
  expect(checks).toEqual(['new-store', 'taken-store', 'fresh-store'])
  expect(creates[0].subdomain).toBe('fresh-store')
})

test('rejects mismatched passwords and invalid subdomains before requesting APIs', async ({ page }) => {
  const requests = []
  await setup(page, async (route, path) => { requests.push(path); await ok(route, { available: true }) })
  await page.goto('/auth/register/owner'); await fill(page)
  await page.getByLabel('Confirm password', { exact: true }).fill('Different123')
  await page.getByRole('button', { name: 'Create Owner account and store', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText('Passwords do not match.')
  await page.getByLabel('Confirm password', { exact: true }).fill('Owner@123')
  await page.getByLabel('Store subdomain', { exact: true }).fill('invalid.name')
  await page.getByRole('button', { name: 'Create Owner account and store', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('3–30 lowercase')
  expect(requests).toHaveLength(0)
})

test('retains draft on email conflict, prevents duplicate submit and allows retry', async ({ page }) => {
  let creates = 0, release
  await setup(page, async (route, path) => {
    if (path.endsWith('/check-subdomain')) { await ok(route, { available: true }); return }
    creates++
    if (creates === 1) { await new Promise(resolve => { release = resolve }); await fail(route, 409, 'Email already exists') }
    else await ok(route, { subdomain: 'new-store' })
  })
  await page.goto('/auth/register/owner'); await fill(page)
  await page.getByRole('button', { name: 'Create Owner account and store', exact: true }).click()
  await expect.poll(() => creates).toBe(1)
  await expect(page.getByRole('button', { name: 'Creating…', exact: true })).toBeDisabled()
  await page.getByLabel('Confirm password', { exact: true }).press('Enter')
  expect(creates).toBe(1)
  release()
  await expect(page.getByRole('alert')).toHaveText('Email already exists')
  await expect(page.getByLabel('Store name', { exact: true })).toHaveValue('New Store')
  await page.getByLabel('Email address', { exact: true }).fill('other-owner@example.test')
  await page.getByRole('button', { name: 'Create Owner account and store', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your store is ready.' })).toBeVisible()
  expect(creates).toBe(2)
})

for (const width of [375, 1440]) {
  test(`Owner registration fits at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    await setup(page, async route => ok(route, { available: true }))
    await page.goto('/auth/register/owner')
    await expect(page.getByRole('heading', { name: 'Create your tenant account.' })).toBeVisible()
    await fill(page)
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `test-results/owner-registration-${width}.png`, fullPage: true })
  })
}
