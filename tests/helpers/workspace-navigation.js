export async function openWorkspacePage(page, group, name) {
  const sidebar = page.getByRole('complementary', { name: 'Workspace navigation' })
  await sidebar.waitFor()
  const mobileMenu = sidebar.getByRole('button', { name: 'Workspace menu' })
  if (await mobileMenu.isVisible() && await mobileMenu.getAttribute('aria-expanded') === 'false') {
    await mobileMenu.click()
  }
  const section = sidebar.getByRole('button', { name: group, exact: true })
  if (await section.getAttribute('aria-expanded') === 'false') await section.click()
  const link = sidebar.getByRole('link', { name, exact: true })
  const path = await link.getAttribute('href')
  await link.click()
  await page.waitForURL(url => url.pathname === path)
}
