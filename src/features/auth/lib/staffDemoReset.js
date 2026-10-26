import { demoAccounts, demoPassword } from '../data/demoAccounts'

// Deliberately memory-only: refreshing the app restores the published fixture password.
const challenges = new Map()
const overrides = new Map()
export function demoCredentialFor(accountId) { return overrides.get(accountId) || demoPassword }
export function requestStaffDemoReset(email) {
  return requestAccountDemoReset(email, 'TENANT_STAFF')
}
export function requestAccountDemoReset(email, role) {
  const account = demoAccounts.find(item => ['TENANT_STAFF', 'TENANT_OWNER', 'SUPER_ADMIN'].includes(role) && item.role === role && item.email === email.trim().toLowerCase())
  for (const [id, challenge] of challenges) if (account && challenge.accountId === account.id) challenges.delete(id)
  const token = crypto.randomUUID()
  challenges.set(token, { accountId: account?.id || null, expiresAt: Date.now() + 10 * 60 * 1000 })
  return token
}
export function resetStaffDemoPassword(token, password, confirmation) {
  const challenge = challenges.get(token)
  if (!challenge?.accountId || challenge.expiresAt < Date.now()) throw new Error('This demo reset link is invalid, expired or was lost after reloading. Request a new link.')
  if (!password || password !== confirmation) throw new Error('Enter a new password and a matching confirmation.')
  overrides.set(challenge.accountId, password)
  challenges.delete(token)
  return challenge.accountId
}
