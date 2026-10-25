import { demoAccounts, demoPassword } from '@/features/auth/data/demoAccounts'

const accounts = new Map()
const passwords = new Map()
const challenges = new Map()
const key = 'smartomni.customer-loyalty-demo.v1'
export const customerEvent = 'smartomni:customer-loyalty'
export const tiers = [{ name: 'Bronze', minimum: 0 }, { name: 'Silver', minimum: 500 }, { name: 'Gold', minimum: 1000 }]
export const sampleOrders = [
  { id: 'ESO-1048', channel: 'Shopee', total: 650000, points: 65, status: 'Delivered', owner: 'customer-1', tenantId: 'demo-tenant' },
  { id: 'ESO-1049', channel: 'TikTok Shop', total: 420000, points: 42, status: 'In transit', owner: 'customer-1', tenantId: 'demo-tenant' },
  { id: 'ESO-1050', channel: 'Shopee', total: 280000, points: 28, status: 'Cancelled', owner: 'customer-1', tenantId: 'demo-tenant' },
  { id: 'ESO-1051', channel: 'Shopee', total: 900000, points: 90, status: 'Delivered', owner: 'customer-2', tenantId: 'demo-tenant' },
]
const seed = [
  { id: 'claim-3', orderId: 'ESO-1042', channel: 'Shopee', points: 125, at: '2026-10-22T09:30:00+07:00' },
  { id: 'claim-2', orderId: 'ESO-1036', channel: 'TikTok Shop', points: 375, at: '2026-10-16T14:20:00+07:00' },
  { id: 'claim-1', orderId: 'ESO-1021', channel: 'Shopee', points: 750, at: '2026-10-03T11:10:00+07:00' },
]
const normalize = value => value.trim().toLowerCase()
export function customerById(id) { return accounts.get(id) || demoAccounts.find(item => item.id === id && item.role === 'CUSTOMER') }
export function customerByEmail(email) { return [...accounts.values(), ...demoAccounts].find(item => item.role === 'CUSTOMER' && item.email === normalize(email)) }
export function customerPassword(id) { return passwords.get(id) ?? demoPassword }
export function registerCustomer(name, email, password, confirmation) {
  if (!name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw new Error('Enter your name and a valid email address.')
  if (demoAccounts.some(item => item.email === normalize(email)) || customerByEmail(email)) throw new Error('This email is already registered. Sign in instead.')
  if (!password || password !== confirmation) throw new Error('Enter a password and a matching confirmation.')
  const account = { id: crypto.randomUUID(), name: name.trim(), email: normalize(email), role: 'CUSTOMER', roleLabel: 'Customer', verified: false, tenantId: 'demo-tenant', tenantName: 'Everyday Studio' }
  accounts.set(account.id, account)
  passwords.set(account.id, password)
  return account
}
export function createChallenge(email, type) {
  const account = customerByEmail(email)
  const token = crypto.randomUUID()
  // One current link per account and purpose. Unknown emails receive the same UI response.
  for (const [id, item] of challenges) if (item.accountId === account?.id && item.type === type) challenges.delete(id)
  challenges.set(token, { accountId: account?.id, type, expires: Date.now() + 600000 })
  return token
}
export function completeChallenge(token, type, password, confirmation) {
  const challenge = challenges.get(token)
  const account = customerById(challenge?.accountId)
  if (!challenge || challenge.type !== type || !account || challenge.expires <= Date.now()) throw new Error('This demo link is invalid or expired. Request a new link. Reloading also clears demo links.')
  if (type === 'reset') {
    if (!password || password !== confirmation) throw new Error('Enter a password and a matching confirmation.')
    passwords.set(account.id, password)
  } else accounts.set(account.id, { ...account, verified: true })
  challenges.delete(token)
  return account
}
export function readClaims(accountId) {
  try {
    const data = JSON.parse(localStorage.getItem(key) || '{}')
    return Array.isArray(data[accountId]) ? data[accountId] : accountId === 'customer-1' ? seed : []
  } catch { return accountId === 'customer-1' ? seed : [] }
}
export function checkEligibility(account, input) {
  if (!account?.verified || account.role !== 'CUSTOMER') throw new Error('Sign in with a verified customer account to claim points.')
  const orderId = input.trim().toUpperCase()
  if (readClaims(account.id).some(item => item.orderId === orderId)) throw new Error('Points have already been claimed for this order.')
  const order = sampleOrders.find(item => item.id === orderId && item.owner === account.id && item.tenantId === account.tenantId)
  if (!order) throw new Error('We could not find an eligible order for your account. Check the order ID.')
  if (order.status !== 'Delivered') throw new Error(`This order is ${order.status.toLowerCase()}. Only delivered, non-cancelled demo orders are eligible.`)
  return order
}
export function claimOrder(account, orderId) {
  // Recheck at confirmation so a stale preview cannot award points twice.
  const order = checkEligibility(account, orderId)
  const claims = [{ id: crypto.randomUUID(), orderId: order.id, channel: order.channel, points: order.points, at: new Date().toISOString() }, ...readClaims(account.id)]
  try {
    const data = JSON.parse(localStorage.getItem(key) || '{}')
    localStorage.setItem(key, JSON.stringify({ ...data, [account.id]: claims }))
  } catch { throw new Error('Your points could not be saved. Allow browser storage and try again.') }
  window.dispatchEvent(new Event(customerEvent))
  return claims
}
