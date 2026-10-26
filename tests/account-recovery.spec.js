import { expect, test } from '@playwright/test'

for (const [type, label, destination] of [['admin', 'Admin', '/admin'], ['owner', 'Owner', '/merchant/dashboard']]) {
  test(`${type} can recover a password without changing role or persisting credentials`, async ({ page }) => {
    await page.goto('/auth/login')
    await page.getByLabel('Email address').fill(`${type}@smartomni.demo`)
    await page.getByRole('button', { name: 'Forgot password?', exact: true }).click()
    await expect(page.getByRole('heading', { name: `Reset ${label} password` })).toBeVisible()
    await expect(page.getByLabel(`${label} email`)).toHaveValue(`${type}@smartomni.demo`)
    await page.getByRole('button', { name: 'Request demo reset', exact: true }).click()
    await page.getByRole('button', { name: 'Open demo reset link' }).click()
    await page.getByLabel('New password', { exact: true }).fill('Recovered@456')
    await page.getByLabel('Confirm new password', { exact: true }).fill('Recovered@456')
    await page.getByRole('button', { name: 'Update demo password' }).click()
    await expect(page.getByRole('heading', { name: 'Demo password updated' })).toBeVisible()
    await page.getByRole('link', { name: 'Back to sign in' }).click()
    await page.getByLabel('Email address').fill(`${type}@smartomni.demo`)
    await page.getByLabel('Password', { exact: true }).fill('Recovered@456')
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`${destination}$`))
    expect(await page.evaluate(() => JSON.stringify([{ ...localStorage }, { ...sessionStorage }]))).not.toContain('Recovered@456')
  })
}

test('a replacement recovery link invalidates the older link', async ({ page }) => {
  await page.goto('/auth/reset-password?account=admin')
  const result = await page.evaluate(async () => {
    const { requestAccountDemoReset, resetStaffDemoPassword } = await import('/src/features/auth/lib/staffDemoReset.js')
    const first = requestAccountDemoReset('admin@smartomni.demo', 'SUPER_ADMIN')
    requestAccountDemoReset('admin@smartomni.demo', 'SUPER_ADMIN')
    try { resetStaffDemoPassword(first, 'Local@123', 'Local@123'); return 'unexpected' } catch (error) { return error.message }
  })
  expect(result).toContain('invalid, expired')
})
