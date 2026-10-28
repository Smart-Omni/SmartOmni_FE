import { test, expect } from '@playwright/test'

const profile = { subdomain: 'real-store', storeName: 'Real Store', status: 'ACTIVE', logoUrl: 'https://images.example.test/logo.png', bannerUrl: 'https://images.example.test/banner.png', primaryColor: '#234738', supportPhone: '+84 900 123 456', address: '123 Real Street\nHo Chi Minh City' }
const auth = { access_token: 'owner-access', refresh_token: 'owner-refresh', user_info: { id: 7, email: 'owner@example.test', fullName: 'API Owner', role: 'TENANT_ADMIN', tenant_id: 42, subdomain: 'real-store' } }
const publicPath = '/api/v1/tenants/public/by-subdomain/'
const ok = (route, data) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data }) })
const fail = (route, status, message) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ success: false, message }) })

async function setup(page, handler) {
  await page.route('https://images.example.test/**', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><rect width="200" height="100" fill="#234738" /></svg>' }))
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (!path.startsWith('/api/')) return route.continue()
    if (path === '/api/v1/auth/login') return ok(route, auth)
    if (path === '/api/marketplace-connections/shopee') return ok(route, null)
    return handler(route, path)
  })
}

async function login(page) {
  await page.goto('/auth/login')
  await page.getByLabel('Email address').fill('owner@example.test')
  await page.getByLabel('Password', { exact: true }).fill('Testing@123')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/merchant\/shops$/)
}

test('loads the public storefront without JWT or mock products', async ({ page }) => {
  await setup(page, async (route, path) => {
    expect(path).toBe(publicPath + 'real-store')
    expect(route.request().headers().authorization).toBeUndefined()
    return ok(route, profile)
  })
  await page.goto('/store/real-store')
  await expect(page.getByRole('heading', { name: 'Real Store', exact: true })).toBeVisible()
  await expect(page.getByText('123 Real Street')).toBeVisible()
  await expect(page.getByRole('link', { name: '+84 900 123 456' })).toHaveAttribute('href', 'tel:+84900123456')
  await expect(page.getByRole('img', { name: 'Real Store logo' })).toHaveAttribute('src', profile.logoUrl)
  await expect(page.getByRole('img', { name: 'Real Store banner' })).toHaveAttribute('src', profile.bannerUrl)
  await expect(page.getByRole('heading', { name: 'Products are not available here yet.' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Ask product assistant|Saved products/ })).toHaveCount(0)
  await expect(page.getByRole('search')).toHaveCount(0)
  await expect(page.getByText('Everyday Studio', { exact: true })).toHaveCount(0)
})

test('404 and inactive storefront never show fixtures or stale data', async ({ page }) => {
  await setup(page, (route, path) => path.endsWith('/locked-store') ? ok(route, { ...profile, subdomain: 'locked-store', status: 'LOCKED' }) : fail(route, 404, 'Không tìm thấy cửa hàng'))
  await page.goto('/store/everyday-studio')
  await expect(page.getByRole('heading', { name: 'Storefront unavailable.' })).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('not publicly available')
  await expect(page.getByText('Everyday Studio', { exact: true })).toHaveCount(0)
  await page.goto('/store/locked-store')
  await expect(page.getByRole('heading', { name: 'Storefront unavailable.' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Real Store' })).toHaveCount(0)
})

test('server failure has a retry that can load the storefront', async ({ page }) => {
  let broken = true
  await setup(page, route => broken ? fail(route, 503, 'Service temporarily unavailable') : ok(route, { ...profile, logoUrl: null, bannerUrl: null }))
  await page.goto('/store/real-store')
  await expect(page.getByRole('alert')).toHaveText('Service temporarily unavailable')
  broken = false
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByRole('heading', { name: 'Real Store' })).toBeVisible()
})

test('owner preview uses own JWT after anonymous 404 and disappears on logout', async ({ page }) => {
  let authenticatedReads = 0
  await setup(page, (route, path) => {
    expect(path).toBe(publicPath + 'real-store')
    if (route.request().headers().authorization === 'Bearer owner-access') { authenticatedReads++; return ok(route, profile) }
    return fail(route, 404, 'Not found')
  })
  await login(page)
  await page.goto('/store/real-store')
  await expect(page.getByRole('status')).toContainText('Workspace preview')
  await expect(page.getByRole('heading', { name: 'Real Store' })).toBeVisible()
  expect(authenticatedReads).toBe(1)
  await page.evaluate(() => { sessionStorage.removeItem('smartomni.api-session.v1'); window.dispatchEvent(new Event('smartomni:api-session')) })
  await expect(page.getByRole('heading', { name: 'Storefront unavailable.' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Real Store' })).toHaveCount(0)
  expect(authenticatedReads).toBe(1)
})

test('does not send tenant credentials while opening a different tenant storefront', async ({ page }) => {
  await setup(page, (route, path) => {
    expect(path).toBe(publicPath + 'another-store')
    expect(route.request().headers().authorization).toBeUndefined()
    return fail(route, 404, 'Not found')
  })
  await login(page)
  await page.goto('/store/another-store')
  await expect(page.getByRole('heading', { name: 'Storefront unavailable.' })).toBeVisible()
})

test('store lookup validates and normalizes subdomain instead of using a fixture directory', async ({ page }) => {
  await setup(page, (route, path) => { expect(path).toBe(publicPath + 'real-store'); return ok(route, profile) })
  await page.goto('/stores')
  await expect(page.getByRole('heading', { name: 'Find a storefront.' })).toBeVisible()
  await page.getByLabel('Store subdomain').fill('invalid.store')
  await page.getByRole('button', { name: 'Open storefront' }).click()
  await expect(page.getByRole('alert')).toContainText('3–30')
  await page.getByLabel('Store subdomain').fill(' REAL-STORE ')
  await page.getByRole('button', { name: 'Open storefront' }).click()
  await expect(page).toHaveURL(/\/store\/real-store$/)
  await expect(page.getByRole('heading', { name: 'Real Store' })).toBeVisible()
})

test('product, flash-sale and assistant routes cannot render mock catalog in API mode', async ({ page }) => {
  await setup(page, route => ok(route, profile))
  for (const route of ['products/wireless-mouse', 'assistant', 'flash-sale']) {
    await page.goto('/store/real-store/' + route)
    await expect(page.getByRole('heading', { name: 'This page is not available yet.' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Real Store' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Send question|Send message/ })).toHaveCount(0)
  }
})

test('owner saves all supported storefront fields through API and sees them on preview', async ({ page }) => {
  let current = { ...profile }
  let submitted
  await setup(page, (route, path) => {
    if (path === '/api/v1/tenants/me') return ok(route, { companyName: 'Real Tenant', subdomain: 'real-store', storefront: current })
    if (path === '/api/v1/tenants/storefront') {
      expect(route.request().method()).toBe('PUT')
      expect(route.request().headers().authorization).toBe('Bearer owner-access')
      submitted = route.request().postDataJSON(); current = { ...current, ...submitted }
      return ok(route, { subdomain: 'real-store', storefront: current })
    }
    if (path === publicPath + 'real-store') return ok(route, current)
    throw new Error('Unexpected API: ' + path)
  })
  await login(page)
  await page.getByRole('link', { name: 'Store settings', exact: true }).click()
  await page.getByLabel('Store name', { exact: true }).fill('Renamed Store')
  await page.getByLabel('Contact phone', { exact: true }).fill('0901234567')
  await page.getByRole('textbox', { name: 'Store address', exact: true }).fill('456 New Street')
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText('Store information saved to the backend.')
  expect(Object.keys(submitted).sort()).toEqual(['address', 'bannerUrl', 'logoUrl', 'primaryColor', 'storeName', 'supportPhone'])
  await page.goto('/store/real-store')
  await expect(page.getByRole('heading', { name: 'Renamed Store' })).toBeVisible()
  await expect(page.getByText('456 New Street')).toBeVisible()
})

test('failed settings save preserves form and does not report success', async ({ page }) => {
  await setup(page, (route, path) => path === '/api/v1/tenants/me' ? ok(route, { companyName: 'Real Tenant', subdomain: 'real-store', storefront: profile }) : fail(route, 500, 'Save failed'))
  await login(page)
  await page.getByRole('link', { name: 'Store settings', exact: true }).click()
  await page.getByLabel('Store name', { exact: true }).fill('Unsaved Store')
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText('Save failed')
  await expect(page.getByLabel('Store name', { exact: true })).toHaveValue('Unsaved Store')
  await expect(page.getByText('Store information saved to the backend.')).toHaveCount(0)
})
