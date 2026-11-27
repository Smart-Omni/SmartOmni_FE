import { test, expect } from '@playwright/test'
import { openWorkspacePage } from './helpers/workspace-navigation'

const profile = { subdomain: 'real-store', storeName: 'Real Store', status: 'ACTIVE', logoUrl: 'https://images.example.test/logo.png', bannerUrl: 'https://images.example.test/banner.png', primaryColor: '#234738', supportPhone: '+84 900 123 456', address: '123 Real Street\nHo Chi Minh City' }
const auth = { access_token: 'owner-access', refresh_token: 'owner-refresh', user_info: { id: 7, email: 'owner@example.test', fullName: 'API Owner', role: 'TENANT_ADMIN', tenant_id: 42, subdomain: 'real-store' } }
const publicPath = '/api/v1/tenants/public/by-subdomain/'
const catalogPath = '/api/v1/products/public/by-subdomain/'
const emptyPage = { content: [], totalElements: 0, last: true }
const ok = (route, data) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data }) })
const fail = (route, status, message) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ success: false, message }) })

async function setup(page, handler, catalog = () => emptyPage) {
  await page.route('https://images.example.test/**', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><rect width="200" height="100" fill="#234738" /></svg>' }))
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (!path.startsWith('/api/')) return route.continue()
    if (path === '/api/v1/auth/login') return ok(route, auth)
    if (path === '/api/v1/marketplace-connections/shopee') return ok(route, null)
    if (path === '/api/v1/tenants/subscription/status') return ok(route, null)
    if (path.startsWith(catalogPath)) {
      expect(route.request().headers().authorization).toBeUndefined()
      const result = catalog(path, new URL(route.request().url()).searchParams)
      return result ? ok(route, result) : fail(route, 404, 'Product not found in this store')
    }
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

test('loads the public storefront without JWT or fixture products', async ({ page }) => {
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
  await expect(page.getByRole('heading', { name: 'This store has no products on sale yet.' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Sign up' })).toHaveAttribute('href', '/auth/register/customer?subdomain=real-store')
  await expect(page.getByRole('link', { name: /Ask product assistant|Saved products/ })).toHaveCount(0)
  await expect(page.getByText('Everyday Studio', { exact: true })).toHaveCount(0)
})

test('tenant host opens its storefront and prefills customer registration', async ({ page, baseURL }) => {
  await setup(page, (route, path) => {
    expect(path).toBe(publicPath + 'real-store')
    expect(route.request().headers().authorization).toBeUndefined()
    return ok(route, profile)
  })
  const tenantUrl = new URL(baseURL)
  tenantUrl.hostname = 'real-store.localhost'
  await page.goto(tenantUrl.href)
  await expect(page).toHaveURL(/\/store\/real-store$/)
  await expect(page.getByRole('heading', { name: 'Real Store', exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Sign up' }).click()
  await expect(page.getByLabel('Store subdomain')).toHaveValue('real-store')
  await page.goto(new URL('/auth/register/customer', tenantUrl).href)
  await expect(page.getByLabel('Store subdomain')).toHaveValue('real-store')
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
  await expect(page.getByRole('status').filter({ hasText: 'Workspace preview' })).toBeVisible()
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

test('flash-sale and assistant routes cannot render mock catalog in API mode', async ({ page }) => {
  await setup(page, route => ok(route, profile))
  for (const route of ['assistant', 'flash-sale']) {
    await page.goto('/store/real-store/' + route)
    await expect(page.getByRole('heading', { name: 'This page is not available yet.' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Back to storefront' })).toHaveAttribute('href', '/store/real-store')
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
  await openWorkspacePage(page, 'Settings', 'Store settings')
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
  await openWorkspacePage(page, 'Settings', 'Store settings')
  await page.getByLabel('Store name', { exact: true }).fill('Unsaved Store')
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText('Save failed')
  await expect(page.getByLabel('Store name', { exact: true })).toHaveValue('Unsaved Store')
  await expect(page.getByText('Store information saved to the backend.')).toHaveCount(0)
})

const shirt = {
  id: 501, name: 'Áo thun Inkfruit', description: 'Cotton 100%', imageUrl: null,
  variants: [
    { id: 11, variantName: 'Đen / S', offers: [
      { platform: 'tiktok_shop', price: 159000, currency: 'VND', available: true, url: 'https://tiktok.example.test/product/77' },
      { platform: 'shopee', price: 169000, currency: 'VND', available: true, url: 'https://shopee.example.test/product/88' },
    ] },
    { id: 12, variantName: 'Đen / M', offers: [
      { platform: 'tiktok_shop', price: 167000, currency: 'VND', available: false, url: 'https://tiktok.example.test/product/77' },
    ] },
  ],
}
const mug = { id: 502, name: 'Cốc sứ', description: null, imageUrl: 'https://images.example.test/mug.png',
  variants: [{ id: 21, variantName: 'Standard', offers: [{ platform: 'shopee', price: 60000, currency: 'VND', available: false, url: null }] }] }

test('catalog lists real products and searches on the server', async ({ page }) => {
  const searches = []
  await setup(page, route => ok(route, profile), (path, params) => {
    expect(path).toBe(catalogPath + 'real-store')
    searches.push(params.get('search'))
    const items = params.get('search') ? [mug] : [shirt, mug]
    return { content: items, totalElements: items.length, last: true }
  })
  await page.goto('/store/real-store')
  await expect(page.getByRole('status').filter({ hasText: '2 products' })).toBeVisible()
  const card = page.getByRole('article').filter({ hasText: 'Áo thun Inkfruit' })
  await expect(card).toContainText('159.000')
  await expect(card).toContainText('2 options')
  await expect(card).toContainText('TikTok Shop / Shopee')
  await expect(card.getByText('No image')).toBeVisible()
  await expect(page.getByRole('article').filter({ hasText: 'Cốc sứ' })).toContainText('Sold out')
  await page.getByLabel('Search this store').fill('cốc')
  await page.getByRole('button', { name: 'Search' }).click()
  await expect(page.getByRole('heading', { name: 'Results for “cốc”' })).toBeVisible()
  await expect(page.getByRole('article')).toHaveCount(1)
  expect(searches).toEqual([null, 'cốc'])
})

test('product detail lets a shopper pick an option and opens the marketplace in a new tab', async ({ page }) => {
  await setup(page, route => ok(route, profile), path => path === catalogPath + 'real-store/501' ? shirt
    : path === catalogPath + 'real-store' ? { content: [shirt], totalElements: 1, last: true } : null)
  await page.goto('/store/real-store')
  await page.getByRole('link', { name: 'Áo thun Inkfruit', exact: true }).click()
  await expect(page).toHaveURL(/\/store\/real-store\/products\/501$/)
  await expect(page.getByRole('heading', { name: 'Áo thun Inkfruit' })).toBeVisible()
  const tiktok = page.getByRole('link', { name: /Buy on TikTok Shop/ })
  await expect(tiktok).toHaveAttribute('href', 'https://tiktok.example.test/product/77')
  await expect(tiktok).toHaveAttribute('target', '_blank')
  await expect(tiktok).toHaveAttribute('rel', 'noopener noreferrer')
  await expect(page.getByRole('link', { name: /Buy on Shopee/ })).toHaveAttribute('href', 'https://shopee.example.test/product/88')
  await page.getByRole('button', { name: 'Đen / M' }).click()
  await expect(page.getByRole('button', { name: 'Đen / M' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('link', { name: /Buy on/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Sold out' })).toBeDisabled()
  await expect(page.getByRole('heading', { name: 'Real Store', exact: true })).toHaveCount(0)
  await page.goto('/store/real-store/products/999')
  await expect(page.getByRole('heading', { name: 'Product not found.' })).toBeVisible()
})

test('product page fits a phone-sized screen', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await setup(page, route => ok(route, profile), path => path.endsWith('/501') ? shirt : { content: [shirt, mug], totalElements: 2, last: true })
  await page.goto('/store/real-store/products/501')
  await expect(page.getByRole('link', { name: /Buy on TikTok Shop/ })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
