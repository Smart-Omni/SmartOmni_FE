import { request } from './client'
import { requireId } from './operations'
import { readApiSession, saveApiSession } from './session'

const base = '/api/v1/users'
export function canManageUsers(session) {
  return ['ADMIN', 'TENANT_ADMIN', 'TENANT_OWNER'].includes((session.backendRole || session.role)?.toUpperCase())
}
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

export const invitationsApi = {
  sent: signal => request(base + '/invitations', { signal }),
  send: email => request(base + '/invitations', { method: 'POST', body: { email, role: 'MANAGER' } }),
  revoke: id => request(`${base}/invitations/${requireId(id)}`, { method: 'DELETE' }),
  received: signal => request(base + '/me/invitations', { signal }),
  accept: async id => {
    const data = await request(`${base}/me/invitations/${requireId(id)}/accept`, { method: 'POST' })
    const session = readApiSession()
    if (!session || session.account.id !== data?.user_info?.id) throw new Error('Your session changed. Sign in again to open your workspace.')
    return saveApiSession(data)
  },
  decline: id => request(`${base}/me/invitations/${requireId(id)}/decline`, { method: 'POST' }),
}
