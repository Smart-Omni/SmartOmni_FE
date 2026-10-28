import { request } from './client'
import { clearApiSession, saveApiSession } from './session'

export const authApi = {
  async login(email, password) {
    const data = await request('/api/v1/auth/login', { method: 'POST', body: { email: email.trim().toLowerCase(), password }, authenticated: false })
    return saveApiSession(data)
  },
  async logout() {
    try { await request('/api/v1/auth/logout', { method: 'POST' }) } finally { clearApiSession() }
  },
  forgotPassword: email => request('/api/v1/auth/forgot-password', { method: 'POST', body: { email }, authenticated: false }),
  resetPassword: (token, newPassword) => request('/api/v1/auth/reset-password', { method: 'POST', body: { token, newPassword }, authenticated: false }),
}
