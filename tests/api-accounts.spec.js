import { test, expect } from '@playwright/test'

const me = { id: 7, email: 'owner@example.test', full_name: 'Server Name', phone: '0901234567', avatar: '', role: 'ADMIN', status: 'ACTIVE', tenant_id: 42, subdomain: 'test-store' }
const user = { ...me, id: 9, email: 'staff@example.test', full_name: 'Staff Name', role: 'MANAGER' }
const auth = role => ({ access_token: 'account-access', refresh_token: 'account-refresh', user_info: { ...me, role } })
const ok = (route, data) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data }) })
const fail = (route, message, status = 400) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ success: false, message }) })

async function setup(page, handler = async () => false, role = 'ADMIN') {
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (!path.startsWith('/api/')) return route.continue()
    if (await handler(route, path)) return
    if (path === '/api/v1/auth/login') return ok(route, auth(role))
    if (path === '/api/v1/users/me') return ok(route, { ...me, role })
    if (path === '/api/v1/tenants') return ok(route, { content: [], totalPages: 0, totalElements: 0 })
    if (path === '/api/marketplace-connections/shopee') return ok(route, null)
    throw new Error(`Unexpected API: ${route.request().method()} ${path}`)
  })
}
async function login(page) {
  await page.goto('/auth/login')
  await page.getByLabel('Email address', { exact: true }).fill(me.email)
  await page.getByLabel('Password', { exact: true }).fill('Initial@123')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/(merchant\/shops|customer\/profile|admin\/profile)$/)
}

test('loads server profile and saves PUT/PATCH without replacing JWTs', async ({ page }) => {
  const calls = []
  await setup(page, async (route, path) => {
    if (path === '/api/v1/users/me' && route.request().method() !== 'GET') {
      const body = route.request().postDataJSON()
      calls.push({ method: route.request().method(), body })
      await ok(route, { ...me, ...body }); return true
    }
    return false
  })
  await login(page)
  await page.getByRole('link', { name: 'Your profile', exact: true }).click()
  await expect(page.getByLabel('Full name', { exact: true })).toHaveValue('Server Name')
  await page.getByLabel('Full name', { exact: true }).fill('Updated Name')
  await page.getByRole('button', { name: 'Save profile', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Profile saved')
  expect(calls[0]).toEqual({ method: 'PUT', body: { full_name: 'Updated Name', phone: '0901234567', avatar: '' } })
  await expect.poll(async () => JSON.parse(await page.evaluate(() => sessionStorage.getItem('smartomni.api-session.v1'))).account.name).toBe('Updated Name')
  await page.getByLabel('Phone', { exact: true }).fill('0999999999')
  await page.getByRole('button', { name: 'Save contact only', exact: true }).click()
  await expect.poll(() => calls.length).toBe(2)
  expect(calls[1]).toEqual({ method: 'PATCH', body: { phone: '0999999999', avatar: '' } })
  expect(JSON.parse(await page.evaluate(() => sessionStorage.getItem('smartomni.api-session.v1'))).accessToken).toBe('account-access')
})

test('profile failure preserves edits and password mismatch never submits', async ({ page }) => {
  let changes = 0
  await setup(page, async (route, path) => {
    if (path === '/api/v1/users/me' && route.request().method() === 'PUT') { await fail(route, 'Profile rejected'); return true }
    if (path.endsWith('/change-password')) { changes++; await ok(route, null); return true }
    return false
  })
  await login(page); await page.goto('/merchant/profile')
  await page.getByLabel('Full name', { exact: true }).fill('Unsaved Name')
  await page.getByRole('button', { name: 'Save profile', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText('Profile rejected')
  await expect(page.getByLabel('Full name', { exact: true })).toHaveValue('Unsaved Name')
  await page.getByLabel('Current password', { exact: true }).fill('Old@123')
  await page.getByLabel('New password', { exact: true }).fill('New@123')
  await page.getByLabel('Confirm new password', { exact: true }).fill('Other@123')
  await page.getByRole('button', { name: 'Change password', exact: true }).click()
  await expect(page.getByText('Passwords do not match.', { exact: true })).toBeVisible()
  expect(changes).toBe(0)
})

test('change password uses snake_case fields and offers a new login', async ({ page }) => {
  let body
  await setup(page, async (route, path) => {
    if (path.endsWith('/change-password')) { body = route.request().postDataJSON(); await ok(route, null); return true }
    return false
  })
  await login(page); await page.goto('/merchant/profile')
  await page.getByLabel('Current password', { exact: true }).fill('Old@123')
  await page.getByLabel('New password', { exact: true }).fill('New@123')
  await page.getByLabel('Confirm new password', { exact: true }).fill('New@123')
  await page.getByRole('button', { name: 'Change password', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Sign in again', exact: true })).toBeVisible()
  expect(body).toEqual({ current_password: 'Old@123', new_password: 'New@123', confirm_password: 'New@123' })
  await page.getByRole('button', { name: 'Sign in again', exact: true }).click()
  await expect(page).toHaveURL(/\/auth\/login$/)
  expect(await page.evaluate(() => sessionStorage.getItem('smartomni.api-session.v1'))).toBeNull()
})

test('Customer registration handles conflict and creates a real API session', async ({ page }) => {
  let body, calls = 0
  await setup(page, async (route, path) => {
    if (path.endsWith('/register')) {
      calls++; body = route.request().postDataJSON()
      if (calls === 1) await fail(route, 'Email already exists', 409)
      else await ok(route, auth('CUSTOMER'))
      return true
    }
    return false
  }, 'CUSTOMER')
  await page.goto('/auth/register/customer?subdomain=test-store')
  await page.getByLabel('Full name', { exact: true }).fill('Customer Name')
  await page.getByLabel('Email address', { exact: true }).fill('customer@example.test')
  await page.getByLabel('Password', { exact: true }).fill('Secret123')
  await page.getByLabel('Confirm password', { exact: true }).fill('Secret123')
  await page.getByRole('button', { name: 'Create Customer account', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText('Email already exists')
  await expect(page.getByLabel('Full name', { exact: true })).toHaveValue('Customer Name')
  await page.getByRole('button', { name: 'Create Customer account', exact: true }).click()
  await expect(page).toHaveURL(/\/customer\/profile$/)
  expect(body).toEqual({ full_name: 'Customer Name', email: 'customer@example.test', phone: '', subdomain: 'test-store', password: 'Secret123' })
  expect(await page.evaluate(() => JSON.stringify(sessionStorage) + JSON.stringify(localStorage))).not.toContain('Secret123')
  await expect(page.getByRole('link', { name: 'User accounts' })).toHaveCount(0)
})

test('user list sends filters and reads snake_case pagination', async ({ page }) => {
  const queries = []
  await setup(page, async (route, path) => {
    if (path === '/api/v1/users') { queries.push(Object.fromEntries(new URL(route.request().url()).searchParams)); await ok(route, { content: [user], total_pages: 2, total_elements: 11 }); return true }
    return false
  })
  await login(page); await page.getByRole('link', { name: 'User accounts' }).click()
  await expect(page.getByText('Page 1 of 2 · 11 users')).toBeVisible()
  await page.getByRole('button', { name: 'Next page' }).click()
  await expect.poll(() => queries.some(query => query.page === '1')).toBe(true)
  await page.getByLabel('Search users').fill('staff')
  await page.getByLabel('Status').selectOption('ACTIVE')
  await page.getByRole('combobox', { name: /^Role/ }).selectOption('MANAGER')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await expect.poll(() => queries.at(-1)).toMatchObject({ keyword: 'staff', status: 'ACTIVE', role: 'MANAGER', page: '0', size: '10', sortBy: 'createdAt', sortDir: 'desc' })
})

test('create, edit, status confirmation and role assignment use the new contracts', async ({ page }) => {
  const calls = []
  await setup(page, async (route, path) => {
    if (path === '/api/v1/users' && route.request().method() === 'GET') { await ok(route, { content: [user], total_pages: 1, total_elements: 1 }); return true }
    if (path.startsWith('/api/v1/users') && route.request().method() !== 'GET') { calls.push({ path, method: route.request().method(), body: route.request().postDataJSON() }); await ok(route, user); return true }
    return false
  })
  await login(page); await page.goto('/merchant/users')
  await page.getByRole('button', { name: 'Create user', exact: true }).click()
  let dialog = page.getByRole('dialog')
  await dialog.getByLabel('Email address').fill('new@example.test')
  await dialog.getByLabel('Initial password').fill('Start@123')
  await dialog.getByLabel('Full name').fill('New Staff')
  await dialog.getByRole('button', { name: 'Confirm create user' }).click()
  await expect(dialog).toHaveCount(0)
  expect(calls[0]).toMatchObject({ path: '/api/v1/users', method: 'POST', body: { email: 'new@example.test', password: 'Start@123', full_name: 'New Staff', role: 'MANAGER' } })
  await page.getByRole('button', { name: `Edit ${user.email}`, exact: true }).click()
  dialog = page.getByRole('dialog')
  await dialog.getByLabel('Full name').fill('Edited Staff')
  await dialog.getByRole('button', { name: 'Confirm edit user' }).click()
  await expect(dialog).toHaveCount(0)
  expect(calls[1]).toMatchObject({ path: '/api/v1/users/9', method: 'PUT', body: { full_name: 'Edited Staff' } })
  await page.getByRole('button', { name: `Disable ${user.email}`, exact: true }).click()
  expect(calls).toHaveLength(2)
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm disable user' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(calls[2]).toEqual({ path: '/api/v1/users/9/status', method: 'PATCH', body: { status: 'DISABLED' } })
  await page.getByRole('button', { name: `Assign role to ${user.email}`, exact: true }).click()
  await page.getByRole('dialog').getByLabel('Account role').selectOption('CUSTOMER')
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm assign role' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(calls[3]).toEqual({ path: '/api/v1/users/9/roles', method: 'PUT', body: { roles: ['CUSTOMER'] } })
})

for (const role of ['MANAGER', 'TENANT_ADMIN', 'CUSTOMER', 'SUPER_ADMIN']) {
  test(`${role} cannot fetch user management by opening a URL`, async ({ page }) => {
    let requests = 0
    await setup(page, async (route, path) => { if (path === '/api/v1/users') { requests++; await fail(route, 'Forbidden', 403); return true } return false }, role)
    await login(page); await page.goto('/merchant/users')
    await expect(page.getByRole('heading', { name: 'User accounts', exact: true })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'User accounts', exact: true })).toHaveCount(0)
    expect(requests).toBe(0)
  })
}

test('reset password sends confirmation and accepts six-character passwords', async ({ page }) => {
  let body
  await setup(page, async (route, path) => { if (path.endsWith('/reset-password')) { body = route.request().postDataJSON(); await ok(route, null); return true } return false })
  await page.goto('/auth/reset-password?token=reset-token')
  await page.getByLabel('New password', { exact: true }).fill('123456')
  await page.getByLabel('Confirm new password', { exact: true }).fill('123456')
  await page.getByRole('button', { name: 'Update password', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Password updated')
  expect(body).toEqual({ token: 'reset-token', new_password: '123456', confirm_password: '123456' })
})

for (const width of [375, 1440]) {
  test(`account pages fit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    await setup(page, async (route, path) => { if (path === '/api/v1/users') { await ok(route, { content: [user], total_pages: 1, total_elements: 1 }); return true } return false })
    await login(page)
    for (const path of ['/merchant/profile', '/merchant/users']) {
      await page.goto(path)
      await expect(page.getByRole('heading', { name: path.endsWith('profile') ? 'Personal information' : 'User accounts', exact: true, level: 2 })).toBeVisible()
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await expect(page.getByText('Loading…', { exact: true })).toHaveCount(0)
      await page.screenshot({ path: `test-results/account-${path.endsWith('profile') ? 'profile' : 'users'}-${width}.png`, fullPage: true })
    }
    await page.screenshot({ path: `test-results/account-users-${width}.png`, fullPage: true })
  })
}
