const key = 'smartomni.api-session.v1'
const eventName = 'smartomni:api-session'
let snapshot
let serialized

export function readApiSession() {
  const value = sessionStorage.getItem(key)
  if (value !== serialized) {
    serialized = value
    try { snapshot = JSON.parse(value) } catch { snapshot = null }
  }
  return snapshot || null
}

export function saveApiSession(data) {
  const user = data.user_info
  if (!data.access_token || !data.refresh_token || !user?.id) throw new Error('Invalid authentication response.')
  const roles = { TENANT_ADMIN: 'TENANT_OWNER', ADMIN: 'TENANT_OWNER', MANAGER: 'TENANT_STAFF' }
  const role = roles[user.role?.toUpperCase()] || user.role?.toUpperCase()
  const account = {
    id: user.id, email: user.email, name: user.fullName || user.email, role, backendRole: user.role,
    roleLabel: role === 'TENANT_OWNER' ? 'Tenant Owner' : role === 'TENANT_STAFF' ? 'Tenant Staff' : role === 'SUPER_ADMIN' ? 'Super Admin' : 'Customer',
    tenantId: user.tenant_id, tenantDomain: user.subdomain, tenantName: user.subdomain,
    membershipStatus: user.tenant_id ? 'ACTIVE' : null, source: 'api',
  }
  sessionStorage.setItem(key, JSON.stringify({ accessToken: data.access_token, refreshToken: data.refresh_token, account }))
  window.dispatchEvent(new Event(eventName))
  return account
}

export function clearApiSession() {
  sessionStorage.removeItem(key)
  window.dispatchEvent(new Event(eventName))
}

export function subscribeApiSession(listener) {
  window.addEventListener(eventName, listener)
  window.addEventListener('storage', listener)
  return () => { window.removeEventListener(eventName, listener); window.removeEventListener('storage', listener) }
}
