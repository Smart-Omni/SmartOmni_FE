import { demoAccounts } from '../data/demoAccounts'
import { recordDemoSecurityEvent } from './demoSecurityLog'
import { initializeAssignedManager, readManagerMembership } from '@/features/portal/lib/merchantStore'
import { demoCredentialFor } from './managerDemoReset'
import { customerById, customerByEmail, customerPassword } from '@/features/customer/customerStore'
import { apiMode } from '@/services/api/config'
import { authApi } from '@/services/api/auth'
import { readApiSession, subscribeApiSession } from '@/services/api/session'

const storageKey = 'smartomni.demo-session'
const changeEvent = 'smartomni:demo-session'
let managerSnapshotKey = ''
let managerSnapshot = null

export function getDemoSession() {
  if (apiMode) return readApiSession()?.account || null
  try {
    const id = sessionStorage.getItem(storageKey)
    const account = customerById(id) || demoAccounts.find(account => account.id === id) || null
    if (account?.role !== 'TENANT_MANAGER') return account
    const membership = readManagerMembership(account.email)
    if (!membership || membership.status === 'INVITED') return account
    const key = `${account.id}:${JSON.stringify(membership)}`
    if (key !== managerSnapshotKey) {
      managerSnapshotKey = key
      managerSnapshot = { ...account, name: membership.fullName || account.name, tenantId: 'demo-tenant', tenantName: 'Everyday Studio', tenantDomain: 'everyday-studio', membershipStatus: membership.status, onboardingStatus: 'COMPLETED', permissions: membership.status === 'ACTIVE' ? membership.permissions : [] }
    }
    return managerSnapshot
  } catch { return null }
}

export function signInDemo(email, password) {
  if (apiMode) return authApi.login(email, password).then(account => ({ account })).catch(error => ({ error: error.message }))
  const account = customerByEmail(email) || demoAccounts.find(item => item.email === email.trim().toLowerCase())
  if (!account || password !== (account.role === 'CUSTOMER' ? customerPassword(account.id) : demoCredentialFor(account.id))) {
    recordDemoSecurityEvent({ type: 'LOGIN_FAILURE', severity: 'WARNING', actor: account ? `${account.roleLabel} demo` : 'Unknown demo account', result: 'Rejected', message: 'Credentials did not match a demo account.', resource: '/auth/login' })
    return { error: 'Demo email or password is incorrect. Check your credentials and try again.' }
  }
  if (account.role === 'CUSTOMER' && !account.verified) return { error: 'Verify your email before signing in.', needsVerification: true }
  try {
    if (account.id === 'demo-active-manager') initializeAssignedManager()
    // Keep only a fixture identifier, never the password or a real authentication token.
    sessionStorage.setItem(storageKey, account.id)
    window.dispatchEvent(new Event(changeEvent))
    recordDemoSecurityEvent({ type: 'LOGIN_SUCCESS', actor: `${account.roleLabel} demo`, result: 'Allowed', message: 'Demo session started.', resource: '/auth/login', tenantId: getDemoSession()?.tenantId })
    return { account }
  } catch { return { error: 'Session storage is unavailable. Allow browser storage to use demo sign-in.' } }
}

export function signOutDemo() {
  if (apiMode) return authApi.logout()
  const account = getDemoSession()
  try { sessionStorage.removeItem(storageKey) } catch { /* Already inaccessible. */ }
  if (account) recordDemoSecurityEvent({ type: 'LOGOUT', actor: `${account.roleLabel} demo`, result: 'Completed', message: 'Demo session ended.', resource: '/auth/login', tenantId: account.tenantId })
  window.dispatchEvent(new Event(changeEvent))
}

export function subscribeDemoSession(listener) {
  if (apiMode) return subscribeApiSession(listener)
  window.addEventListener(changeEvent, listener)
  window.addEventListener('storage', listener)
  return () => {
    window.removeEventListener(changeEvent, listener)
    window.removeEventListener('storage', listener)
  }
}

