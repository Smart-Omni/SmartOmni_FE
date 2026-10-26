export function demoDomainIssue(value) {
  const slug = value.trim()
  if (!/^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$/.test(slug)) return 'Use 3–63 lowercase letters, numbers or hyphens, with no hyphen at either end.'
  const reserved = ['admin', 'api', 'auth', 'www', 'support', 'customer', 'merchant', 'everyday-studio']
  let tenants = []
  try { const value = JSON.parse(localStorage.getItem('smartomni.platform-demo.v1'))?.tenants; tenants = Array.isArray(value) ? value : [] } catch { /* Use the published demo addresses. */ }
  if (reserved.includes(slug) || tenants.some(tenant => tenant.domain?.split('.')[0] === slug)) return 'This address is reserved or already used in the local demo. Try another name.'
  return ''
}
