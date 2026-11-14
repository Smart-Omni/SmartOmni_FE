import { request } from './client'

export const storefrontApi = {
  publicProfile: (subdomain, signal, authenticated = false) => request(`/api/v1/tenants/public/by-subdomain/${encodeURIComponent(subdomain)}`, { signal, authenticated }),
  currentTenant: signal => request('/api/v1/tenants/me', { signal }),
  update: body => request('/api/v1/tenants/storefront', { method: 'PUT', body }),
}

export function validSubdomain(value) { return /^[a-z0-9-]{3,30}$/.test(value) }

export function tenantSubdomainFromHost(hostname) {
  const match = /^([a-z0-9-]+)\.(?:smartomni\.vn|smartomni\.local|lvh\.me|localhost)$/.exec(hostname)
  const slug = match?.[1]
  if (!slug || !validSubdomain(slug) || ['admin', 'api', 'auth', 'app', 'www', 'static', 'mail'].includes(slug)) return null
  return slug
}

export function tenantWebsiteUrl(value) {
  if (!value) return undefined
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : undefined
  } catch { return undefined }
}

export function storefrontImageUrl(value) {
  if (!value) return undefined
  try {
    const url = new URL(value, window.location.origin)
    return ['http:', 'https:'].includes(url.protocol) ? url.href : undefined
  } catch { return undefined }
}
