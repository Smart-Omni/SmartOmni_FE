import { request } from './client'

const base = '/api/v1/tenants'
export const tenantApi = {
  list: (params, signal) => request(base, { params, signal }),
  checkSubdomain: subdomain => request(`${base}/check-subdomain`, { params: { subdomain }, authenticated: false }),
  onboard: body => request(base, { method: 'POST', body, authenticated: false }),
  status: tenantId => request(`${base}/${encodeURIComponent(tenantId)}/status`),
  lock: (tenantId, reason) => request(`${base}/${encodeURIComponent(tenantId)}/lock`, { method: 'POST', body: { reason } }),
  unlock: tenantId => request(`${base}/${encodeURIComponent(tenantId)}/unlock`, { method: 'POST' }),
}
