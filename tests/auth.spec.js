import { expect, test } from '@playwright/test'

const modes = [
  { path: '/auth/login', heading: 'Welcome back.', action: 'Sign in', autocomplete: 'current-password', notice: 'Demo email or password is incorrect.' },
]

for (const mode of modes) {
  test(`${mode.action}: fields, validation, keyboard interaction, and honest submission`, async ({ page }) => {
    const errors = []
    const credentialRequests = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('request', request => { if (request.method() === 'POST') credentialRequests.push(request.url()) })
    await page.goto(mode.path)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(mode.heading)
    await expect(page.getByLabel('Email address')).toHaveAttribute('autocomplete', 'email')
    const password = page.getByLabel('Password', { exact: true })
    await expect(password).toHaveAttribute('autocomplete', mode.autocomplete)
    await expect(password).toHaveAttribute('type', 'password')
    await expect(page.getByText('Enter your email address.', { exact: true })).toHaveCount(0)
    await expect(page.getByRole('checkbox')).toHaveCount(0)
    await page.getByRole('button', { name: 'Forgot password?', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('No reset email has been sent.')
    await page.getByRole('link', { name: 'Back to sign in', exact: true }).click()
    await expect(page.getByLabel('Email address')).not.toHaveAttribute('aria-invalid', 'true')
    await page.getByRole('button', { name: 'Continue with Google', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('Google sign-in is not connected yet.')
    const submit = page.getByRole('button', { name: mode.action, exact: true })
    await submit.click()
    await expect(page.getByText('Enter your email address.', { exact: true })).toBeVisible()
    await expect(page.getByText('Enter your password.', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Email address')).toBeFocused()
    await expect(page.getByLabel('Email address')).toHaveAttribute('aria-invalid', 'true')
    await page.getByLabel('Email address').fill('invalid-email')
    await expect(page.getByText('Enter a valid email address, like you@example.com.')).toBeVisible()
    await page.getByLabel('Email address').fill('owner@example.com')
    // No unapproved minimum length or complexity requirement.
    await password.fill('x')
    await password.focus()
    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name: 'Show password' })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(password).toHaveAttribute('type', 'text')
    await expect(page.getByRole('button', { name: 'Hide password' })).toHaveAttribute('aria-pressed', 'true')
    await page.keyboard.press('Space')
    await expect(password).toHaveAttribute('type', 'password')
    await password.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('status')).toContainText(mode.notice)
    await expect(page).toHaveURL(new RegExp(`${mode.path}$`))
    expect(credentialRequests).toEqual([])
    const storage = await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage }, cookies: document.cookie }))
    expect(storage.session).toEqual({})
    expect(storage.cookies).toBe('')
    expect(Object.keys(storage.local)).toEqual(['smartomni.security-demo.v1'])
    const events = JSON.parse(storage.local['smartomni.security-demo.v1'])
    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('LOGIN_FAILURE')
    expect(events[0]).not.toHaveProperty('password')
    expect(JSON.stringify(events)).not.toContain('owner@example.com')
    await password.fill('edited')
    await expect(page.getByRole('status')).toBeEmpty()
    await page.reload()
    await expect(password).toHaveValue('')
    expect(errors).toEqual([])
  })

  for (const width of [320, 375, 768, 1024, 1440]) {
    test(`${mode.action}: responsive form at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: width < 760 ? 667 : 900 })
      await page.goto(mode.path)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
      const email = await page.getByLabel('Email address').boundingBox()
      expect(email.x).toBeGreaterThanOrEqual(0)
      expect(email.x + email.width).toBeLessThanOrEqual(width)
      // Desktop uses the compact 85% scale; mobile keeps full-size controls.
      expect(email.height).toBeGreaterThanOrEqual(width <= 760 ? 44 : 40)
      const infoCard = page.getByRole('complementary')
      await expect(infoCard).toBeVisible()
      const infoBox = await infoCard.boundingBox()
      const formBox = await page.getByRole('region', { name: 'Account access' }).boundingBox()
      // The requested black and white cards overlap at every supported size.
      expect(Math.min(infoBox.x + infoBox.width, formBox.x + formBox.width) - Math.max(infoBox.x, formBox.x)).toBeGreaterThan(0)
      expect(Math.min(infoBox.y + infoBox.height, formBox.y + formBox.height) - Math.max(infoBox.y, formBox.y)).toBeGreaterThan(0)
      if (width <= 760) {
        expect(infoBox.y).toBeLessThan(formBox.y)
        expect(await page.getByLabel('Email address').evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16)
      } else {
        expect(infoBox.x).toBeLessThan(formBox.x)
        expect(Math.abs(formBox.x - (infoBox.x + infoBox.width / 2))).toBeLessThan(1)
        expect(infoBox.x + infoBox.width).toBeLessThan(email.x)
      }
      await page.getByRole('button', { name: mode.action, exact: true }).click()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
      if ([375, 1440].includes(width)) {
        await page.reload()
        await page.screenshot({ path: `artifacts/auth/${mode.action === 'Sign in' ? 'login' : 'register'}-${width}.png`, fullPage: true, animations: 'disabled' })
      }
    })
  }
}

test('auth navigation returns to landing and clears credentials between forms', async ({ page }) => {
  await page.goto('/auth/login')
  await page.getByLabel('Email address').fill('owner@example.com')
  await page.getByLabel('Password', { exact: true }).fill('private-value')
  await page.getByRole('button', { name: 'Show password' }).click()
  await page.getByRole('link', { name: 'Create account', exact: true }).click()
  await expect(page).toHaveURL(/\/auth\/register$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('How will you use SmartOmni?')
  await page.getByRole('button', { name: 'Select Staff' }).click()
  await page.getByRole('link', { name: 'Continue as Staff' }).click()
  await expect(page.getByLabel('Email address')).toHaveValue('')
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'password')
  await page.getByRole('link', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/auth\/login$/)
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('')
  await page.getByRole('link', { name: 'Back to SmartOmni' }).click()
  await expect(page).toHaveURL('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('One workspace for every sales channel.')
})

test('mobile short viewport and reduced motion keep the form usable', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 360 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/auth/register/staff')
  const animation = await page.locator('form').evaluate(element => getComputedStyle(element.parentElement).animationName)
  expect(animation).toBe('none')
  await page.getByLabel('Full name').fill('Sample Staff')
  await page.getByLabel('Email address').fill('staff@example.com')
  await page.getByLabel('Password', { exact: true }).fill('sample')
  await page.getByLabel('Confirm password', { exact: true }).fill('sample')
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your next step: Join a workspace.')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= 375)).toBe(true)
})
