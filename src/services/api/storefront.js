import { request } from './client'

export const storefrontApi = {
  publicProfile: (subdomain, signal, authenticated = false) => request(`/api/v1/tenants/public/by-subdomain/${encodeURIComponent(subdomain)}`, { signal, authenticated }),
  currentTenant: signal => request('/api/v1/tenants/me', { signal }),
  update: body => request('/api/v1/tenants/storefront', { method: 'PUT', body }),
}

export function validSubdomain(value) { return /^[a-z0-9-]{3,30}$/.test(value) }

export function storefrontImageUrl(value) {
  if (!value) return undefined
  try {
    const url = new URL(value, window.location.origin)
    return ['http:', 'https:'].includes(url.protocol) ? url.href : undefined
  } catch { return undefined }
}
