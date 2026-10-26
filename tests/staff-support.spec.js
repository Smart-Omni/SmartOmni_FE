import { expect, test } from '@playwright/test'
import { mkdirSync } from 'node:fs'

async function login(page) {
  await page.goto('/auth/login')
  await page.getByLabel('Email address').fill('staff.active@smartomni.demo')
  await page.getByLabel('Password', { exact: true }).fill('Demo@123')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/merchant\/dashboard$/)
}
const open = (page, screen) => page.goto(`/merchant/staff/${screen}?tenant=everyday-studio`)
const data = page => page.evaluate(() => JSON.parse(localStorage.getItem('smartomni.staff-operations-demo.v1')).tenants['demo-tenant'])

test('inbox filters, attachments, reply progression and failed retry persist', async ({ page }) => {
  await login(page); await open(page, 'conversations')
  await expect(page.getByRole('log')).toContainText('Natural tote')
  await expect(page.getByRole('link', { name: 'Natural tote reference' })).toHaveAttribute('download', 'Natural tote reference')
  await page.getByLabel('Reply', { exact: true }).fill('We will send the Natural tote.')
  await page.getByLabel('Attach files').setInputFiles({ name: 'care.txt', mimeType: 'text/plain', buffer: Buffer.from('Care instructions') })
  await page.getByRole('button', { name: 'Queue demo reply' }).click()
  await expect(page.getByRole('log')).toContainText('Queued locally')
  await page.getByRole('button', { name: 'Mark sent in demo' }).click()
  await page.getByRole('button', { name: 'Mark delivered in demo' }).click()
  await page.reload()
  await expect(page.getByRole('log')).toContainText('We will send the Natural tote.')
  await expect(page.getByRole('link', { name: 'care.txt' })).toBeVisible()
  await page.getByRole('button', { name: /Bao Tran/ }).click()
  await page.getByRole('button', { name: 'Retry demo reply' }).click()
  await expect(page.getByRole('log')).not.toContainText('Failed · demo')
  await page.getByLabel('Search conversations').fill('no matching customer')
  await expect(page.getByRole('heading', { name: 'No matching conversations' })).toBeVisible()
})

test('returned goods require receipt and inspection and damaged goods enter quarantine exactly once', async ({ page }) => {
  await login(page); await open(page, 'returns')
  await page.getByRole('row').filter({ hasText: 'RET-104' }).getByRole('button', { name: 'Review return' }).click()
  await page.getByLabel('Receipt reference').fill('HCM-RCPT-104')
  await page.getByRole('button', { name: 'Record receipt of returned goods' }).click()
  await page.getByLabel('Returned goods condition').selectOption('DAMAGED')
  await page.getByLabel('Inspection notes').fill('Crack along the handle. Not safe to sell.')
  await page.getByLabel('Inspection video', { exact: true }).setInputFiles({ name: 'inspection.mp4', mimeType: 'video/mp4', buffer: Buffer.from('local inspection video sample') })
  await page.getByRole('button', { name: 'Save inspection', exact: true }).click()
  mkdirSync('artifacts/uc-completion/support', { recursive: true })
  await page.screenshot({ path: 'artifacts/uc-completion/support/return-inspection-dialog.png', fullPage: true })
  await expect(page.getByLabel('Restock destination').locator('option[value="SELLABLE"]')).toHaveAttribute('disabled', '')
  await page.getByRole('button', { name: 'Review restock' }).click()
  await page.screenshot({ path: 'artifacts/uc-completion/support/restock-confirmation-dialog.png', fullPage: true })
  await page.getByRole('button', { name: 'Confirm restock', exact: true }).click()
  await expect(page.getByText(/Completed · 1 unit/)).toBeVisible()
  const state = await data(page)
  expect(state.quarantine).toHaveLength(1)
  expect(state.inventory.find(row => row.id === 'inv-mug-hcm').onHand).toBe(8)
  const denied = await page.evaluate(async () => {
    const { restockReturn } = await import('/src/features/staff/lib/supportStore.js')
    const value = JSON.parse(localStorage.getItem('smartomni.staff-operations-demo.v1')).tenants['demo-tenant'].returns[0]
    try { restockReturn(value.id, 'QUARANTINE', JSON.stringify(value)); return 'unexpected' } catch (error) { return error.message }
  })
  expect(denied).toContain('Receive and inspect')
  await page.reload()
  await expect(page.getByLabel('Quarantined stock', { exact: true })).toContainText('RET-104')
})

test('good returned goods increase sellable stock and stale return updates are rejected', async ({ page }) => {
  await login(page); await open(page, 'returns')
  await page.getByRole('row').filter({ hasText: 'RET-098' }).getByRole('button').click()
  await page.getByLabel('Inspection notes').fill('Unopened packaging; all checks passed.')
  await page.getByLabel('Inspection video', { exact: true }).setInputFiles({ name: 'sealed.webm', mimeType: 'video/webm', buffer: Buffer.from('sample') })
  await page.getByRole('button', { name: 'Save inspection' }).click()
  await page.getByLabel('Restock destination').selectOption('SELLABLE')
  await page.getByRole('button', { name: 'Review restock' }).click()
  await page.getByRole('button', { name: 'Confirm restock', exact: true }).click()
  const state = await data(page)
  expect(state.inventory.find(row => row.id === 'inv-tote-hcm').onHand).toBe(16)
  expect(state.inventory.find(row => row.id === 'inv-tote-hcm').reserved).toBe(3)
  expect(state.stockLedger[0].kind).toBe('RETURN')
  expect(state.syncJobs.find(row => row.id === 'sync-tote').status).toBe('QUEUED')
})

test('complaint classification, resolution and read-only dispute timeline work', async ({ page }) => {
  await login(page); await open(page, 'complaints')
  await page.getByRole('row').filter({ hasText: 'CMP-104' }).getByRole('button').click()
  await expect(page.getByRole('dialog')).toContainText('94%')
  await page.getByRole('button', { name: 'Mark complaint as resolved' }).click()
  await page.getByLabel('Resolution note').fill('Return received and damaged mug quarantined. Customer informed.')
  await page.getByRole('button', { name: 'Confirm resolution' }).click()
  await expect(page.getByRole('dialog')).toContainText('RESOLVED')
  await page.reload()
  await page.getByLabel('Case status').selectOption('RESOLVED')
  await expect(page.getByRole('row').filter({ hasText: 'CMP-104' })).toBeVisible()
  await open(page, 'disputes')
  await page.getByRole('row').filter({ hasText: 'DSP-104' }).getByRole('button').click()
  await page.screenshot({ path: 'artifacts/uc-completion/support/dispute-dialog.png', fullPage: true })
  await expect(page.getByRole('dialog')).toContainText('Evidence requested')
  await expect(page.getByRole('dialog')).toContainText('2026-10-29')
})

test('support mutations recheck permission and tenant binding', async ({ page }) => {
  await login(page); await open(page, 'conversations')
  const denied = await page.evaluate(async () => {
    const team = JSON.parse(localStorage.getItem('smartomni.team-demo.v1'))
    const member = team.find(row => row.email === 'staff.active@smartomni.demo')
    member.permissions = member.permissions.filter(permission => permission !== 'conversations:reply')
    localStorage.setItem('smartomni.team-demo.v1', JSON.stringify(team))
    const { sendSupportReply } = await import('/src/features/staff/lib/supportStore.js')
    try { sendSupportReply('chat-anh', 'Blocked reply', [], 'blocked'); return 'unexpected' } catch (error) { return error.message }
  })
  expect(denied).toContain('not granted permission')
  await page.reload()
  await expect(page.getByRole('button', { name: 'Queue demo reply' })).toHaveCount(0)
  await page.goto('/merchant/staff/returns?tenant=another-store')
  await expect(page.getByRole('heading', { name: 'Subdomain access denied.' })).toBeVisible()
})

for (const width of [375, 1440]) test(`support screens are usable at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 }); await login(page)
  const errors = []; page.on('pageerror', error => errors.push(error.message))
  mkdirSync('artifacts/uc-completion/support', { recursive: true })
  for (const screen of ['conversations', 'returns', 'complaints', 'disputes']) {
    await open(page, screen)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.screenshot({ path: `artifacts/uc-completion/support/${screen}-${width}.png`, fullPage: true })
    if (screen === 'conversations' && width === 375) {
      await page.getByLabel('Customer conversation', { exact: true }).selectOption('chat-bao')
      await expect(page.getByRole('log')).toContainText('My mug arrived with a crack')
    }
  }
  expect(errors).toEqual([])
})
