import { request } from './client'
import { requireId } from './operations'

const base = '/api/v1/users'
export function canManageUsers(session) { return ['ADMIN', 'TENANT_OWNER'].includes((session.backendRole || session.role)?.toUpperCase()) }
export const usersApi = {
  me: signal => request(`${base}/me`, { signal }),
  updateMe: body => request(`${base}/me`, { method: 'PUT', body }),
  patchMe: body => request(`${base}/me`, { method: 'PATCH', body }),
  list: (params, signal) => request(base, { params, signal }),
  create: body => request(base, { method: 'POST', body }),
  update: (id, body) => request(`${base}/${requireId(id)}`, { method: 'PUT', body }),
  status: (id, status) => request(`${base}/${requireId(id)}/status`, { method: 'PATCH', body: { status } }),
  roles: (id, role) => request(`${base}/${requireId(id)}/roles`, { method: 'PUT', body: { roles: [role] } }),
}
