import { getDemoSession } from '@/features/auth/lib/demoSession'

const key = 'smartomni.customer-voucher-lab.v1'
export const voucherTiers = ['Bronze', 'Silver', 'Gold']
export const demoRecipients = [
  { id: 'demo-bronze-a', label: 'Bronze sample member A', tier: 'Bronze', optIn: true },
  { id: 'demo-bronze-b', label: 'Bronze sample member B', tier: 'Bronze', optIn: false },
  { id: 'demo-silver-a', label: 'Silver sample member A', tier: 'Silver', optIn: true },
  { id: 'demo-gold-a', label: 'Gold sample member A', tier: 'Gold', optIn: true },
  { id: 'demo-gold-b', label: 'Gold sample member B', tier: 'Gold', optIn: true },
]
function account() {
  const value = getDemoSession()
  if (value?.role !== 'CUSTOMER' || !value.verified || value.tenantId !== 'demo-tenant') throw new Error('A verified customer account is required.')
  try { if (JSON.parse(localStorage.getItem('smartomni.platform-demo.v1'))?.tenants?.find(tenant => tenant.id === value.tenantId)?.status === 'SUSPENDED') throw new Error('This tenant is suspended.') } catch (error) { if (error.message === 'This tenant is suspended.') throw error }
  return value
}
function root() { try { const value = JSON.parse(localStorage.getItem(key)); return value && typeof value === 'object' && !Array.isArray(value) ? value : {} } catch { return {} } }
export function readCustomerCampaigns() { const value = root()[account().id]; return Array.isArray(value) ? value : [] }
export function issueCustomerDemoVouchers(tier, discount, requestId) {
  const customer = account()
  const percentage = Number(discount)
  if (!voucherTiers.includes(tier) || !Number.isInteger(percentage) || percentage < 1 || percentage > 100 || !requestId) throw new Error('Choose a tier and a whole discount percentage from 1 to 100.')
  const data = root()
  const existing = Array.isArray(data[customer.id]) ? data[customer.id] : []
  if (existing.some(batch => batch.requestId === requestId)) return
  const id = crypto.randomUUID()
  const batch = { id, requestId, tier, discount: percentage, at: new Date().toISOString(), recipients: demoRecipients.filter(item => item.tier === tier).map((item, index) => ({ ...item, status: item.optIn ? 'ISSUED_DEMO' : 'SKIPPED', code: item.optIn ? `LAB-${id.slice(0, 8).toUpperCase()}-${index + 1}` : null })) }
  try { localStorage.setItem(key, JSON.stringify({ ...data, [customer.id]: [batch, ...existing].slice(0, 100) })) } catch { throw new Error('Could not save this demo campaign. Allow browser storage and try again.') }
  window.dispatchEvent(new Event('smartomni:customer-vouchers'))
}
