import { useMemo, useSyncExternalStore } from 'react'
import { billingInvoices, costCategories, demandHistory, loyaltyCustomers, loyaltyTiers, ownerWorkspaceKey, sampleCosts, sampleShops, sampleShopAlerts } from '../data/ownerWorkspace'
import { getDemoSession } from '@/features/auth/lib/demoSession'
import { requireStaff } from '@/features/staff/lib/staffStore'

const eventName = 'smartomni:owner-workspace'
const platformKey = 'smartomni.platform-demo.v1'
const initial = { plan: null, refunds: [], shopOverrides: [], vouchers: [], salesEvents: [], costs: sampleCosts, conversations: [], audit: [] }
function raw(key) { try { return localStorage.getItem(key) || '' } catch { return '' } }
function parse(value, fallback) { try { return JSON.parse(value) ?? fallback } catch { return fallback } }
function normalize(value) { return { ...initial, plan: ['Free', 'Pro'].includes(value?.plan) ? value.plan : null, ...Object.fromEntries(Object.keys(initial).filter(key => key !== 'plan').map(key => [key, Array.isArray(value?.[key]) ? value[key] : initial[key]])) } }
export function getOwnerState() { return normalize(parse(raw(ownerWorkspaceKey), initial)) }
function subscribe(listener) {
  const storage = event => { if (!event.key || [ownerWorkspaceKey, platformKey].includes(event.key)) listener() }
  window.addEventListener('storage', storage)
  window.addEventListener(eventName, listener)
  window.addEventListener('smartomni:platform-demo', listener)
  return () => { window.removeEventListener('storage', storage); window.removeEventListener(eventName, listener); window.removeEventListener('smartomni:platform-demo', listener) }
}
export function useOwnerWorkspace() {
  const value = useSyncExternalStore(subscribe, () => JSON.stringify([raw(ownerWorkspaceKey), raw(platformKey)]), () => '["",""]')
  return useMemo(() => {
    const [ownerRaw, platformRaw] = JSON.parse(value)
    const platform = parse(platformRaw, {})
    const tenant = platform.tenants?.find(item => item.id === 'demo-tenant')
    return { state: normalize(parse(ownerRaw, initial)), platform, tenant }
  }, [value])
}
export function requireOwnerWorkspace() {
  if (sessionStorage.getItem('smartomni.demo-session') !== 'demo-owner') throw new Error('Only the Tenant Owner can perform this action.')
  if (parse(raw(platformKey), {}).tenants?.find(item => item.id === 'demo-tenant')?.status === 'SUSPENDED') throw new Error('This workspace is suspended.')
}
function requireBusinessWorkspace(permission) {
  if (getDemoSession()?.role === 'TENANT_STAFF') return requireStaff({ 'planning:write': ['planning:read', 'planning:write'], 'finance:write': ['finance:read', 'finance:write'] }[permission] || [permission])
  requireOwnerWorkspace()
  return getDemoSession()
}
function commit(next, action, detail, permission) {
  if (permission) requireBusinessWorkspace(permission)
  else requireOwnerWorkspace()
  const audit = { id: crypto.randomUUID(), at: new Date().toISOString(), actor: getDemoSession()?.name || 'Tenant Owner demo', action, detail, tenantId: 'demo-tenant', source: 'Local demo' }
  try { localStorage.setItem(ownerWorkspaceKey, JSON.stringify({ ...next, audit: [audit, ...next.audit].slice(0, 200) })) } catch { throw new Error('Could not save. Allow browser storage and try again.') }
  window.dispatchEvent(new Event(eventName))
}
export function recordOwnerActivity(action) {
  try {
    if (sessionStorage.getItem('smartomni.demo-session') === 'demo-owner') commit(getOwnerState(), action, 'Owner settings or staff updated in this browser.')
  } catch { /* Secondary demo logging must not turn a successful settings save into an error. */ }
}
export function effectivePlan(state, tenant) { return state.plan || tenant?.plan || 'Pro' }
export function planLimits(platform, plan) { return platform.plans?.find(item => item.id === plan) || (plan === 'Free' ? { skuLimit: 100, shopLimit: 1, staffLimit: 2 } : { skuLimit: 1000, shopLimit: 3, staffLimit: 10 }) }
export function changeOwnerPlan(plan) {
  requireOwnerWorkspace()
  if (!['Free', 'Pro'].includes(plan)) throw new Error('Choose a supported plan.')
  const state = getOwnerState()
  const platform = parse(raw(platformKey), {})
  if (effectivePlan(state, platform.tenants?.find(item => item.id === 'demo-tenant')) === plan) throw new Error('This plan is already selected.')
  commit({ ...state, plan }, 'Subscription plan changed', `${plan} applied to the local demo. No payment or proration.`)
}
export function requestRefund(invoiceId, reason) {
  requireOwnerWorkspace()
  const invoice = billingInvoices.find(item => item.id === invoiceId)
  const state = getOwnerState()
  if (!invoice || invoice.status !== 'PAID') throw new Error('Only paid sample invoices can be submitted for review.')
  if (state.refunds.some(item => item.invoiceId === invoiceId)) throw new Error('A refund request already exists for this invoice.')
  if (!reason.trim() || reason.length > 1000) throw new Error('Enter a reason of up to 1,000 characters.')
  commit({ ...state, refunds: [{ id: crypto.randomUUID(), invoiceId, amount: invoice.amount, reason: reason.trim(), status: 'PENDING_REVIEW', at: new Date().toISOString() }, ...state.refunds] }, 'Refund requested', invoiceId)
}
export function ownerConnections(state, tenant, platform = {}) {
  const baseline = tenant?.shops || sampleShops
  return [...baseline.map((shop, index) => {
    const override = state.shopOverrides.find(item => item.platform === shop.platform && item.name === shop.name)
    const latestAlert = platform.alerts?.filter(alert => alert.kind === 'shop' && alert.tenantId === 'demo-tenant' && alert.platform === shop.platform && alert.shopName === shop.name).sort((a, b) => b.lastSeen.localeCompare(a.lastSeen))[0]
    return { ...shop, id: shop.id || `baseline-${index}`, ...(override && (!latestAlert || override.updatedAt >= latestAlert.lastSeen) ? override : {}) }
  }), ...state.shopOverrides.filter(item => !baseline.some(shop => item.platform === shop.platform && item.name === shop.name))]
}
export function ownerConnectionAlerts(state, platform = {}) {
  return (platform.alerts || sampleShopAlerts).filter(alert => alert.kind === 'shop' && alert.tenantId === 'demo-tenant').map(alert => {
    const override = state.shopOverrides.find(shop => shop.platform === alert.platform && shop.name === alert.shopName && shop.status === 'Connected' && shop.updatedAt >= alert.lastSeen)
    return override && alert.status !== 'RESOLVED' ? { ...alert, status: 'RESOLVED', history: [...alert.history, { at: override.updatedAt, action: 'Owner reauthorized in demo', note: 'Local preview only; provider authorization is not performed.' }] } : alert
  })
}
export function authorizeOwnerShop(platform, name, reauthorize = false) {
  requireOwnerWorkspace()
  if (!['shopee', 'tiktok'].includes(platform) || !name.trim() || name.length > 100) throw new Error('Choose a marketplace and enter a shop name of up to 100 characters.')
  const state = getOwnerState()
  const admin = parse(raw(platformKey), {})
  const tenant = admin.tenants?.find(item => item.id === 'demo-tenant')
  const connections = ownerConnections(state, tenant, admin)
  const current = connections.find(item => item.platform === platform && item.name === name.trim())
  if (!reauthorize && current) throw new Error('This shop is already connected. Use Reauthorize instead.')
  if (reauthorize && !current) throw new Error('This connection is no longer available.')
  if (!current && connections.length >= planLimits(admin, effectivePlan(state, tenant)).shopLimit) throw new Error('The demo shop limit is reached. Review your subscription plan.')
  const shop = { id: current?.id || crypto.randomUUID(), platform, name: name.trim(), status: 'Connected', updatedAt: new Date().toISOString() }
  commit({ ...state, shopOverrides: [...state.shopOverrides.filter(item => item.platform !== platform || item.name !== shop.name), shop] }, reauthorize ? 'Shop reauthorized' : 'Shop connected', `${platform}: ${shop.name} (demo only)`)
}
export function issueTierVouchers(tier, discount, expectedRecipients, requestId) {
  requireOwnerWorkspace()
  const percentage = Number(discount)
  if (!loyaltyTiers.includes(tier) || !Number.isInteger(percentage) || percentage < 1 || percentage > 100) throw new Error('Choose a tier and a whole discount percentage from 1 to 100.')
  const customers = loyaltyCustomers.filter(item => item.tier === tier)
  if (customers.filter(item => item.acceptsVouchers).length !== expectedRecipients) throw new Error('Recipients changed. Review the issuance preview again.')
  const state = getOwnerState()
  const existing = requestId && state.vouchers.find(batch => batch.requestId === requestId)
  if (existing) return existing.id
  const id = crypto.randomUUID()
  const recipients = customers.map((customer, index) => ({ customerId: customer.id, name: customer.name, email: customer.email, status: customer.acceptsVouchers ? 'ISSUED_DEMO' : 'SKIPPED', reason: customer.acceptsVouchers ? 'Created locally; no message sent' : 'Customer has not opted in', code: customer.acceptsVouchers ? `DEMO-${id.slice(0, 8).toUpperCase()}-${index + 1}` : null }))
  if (!recipients.some(item => item.code)) throw new Error('This tier has no eligible voucher recipients.')
  const batch = { id, requestId, tier, discount: percentage, at: new Date().toISOString(), recipients }
  commit({ ...state, vouchers: [batch, ...state.vouchers] }, 'Vouchers issued', `${tier}: ${percentage}% · demo issuance`)
  return batch.id
}
function validDate(value) { const date = new Date(`${value}T00:00:00Z`); return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value }
export function saveSalesEvent(input) {
  requireBusinessWorkspace('planning:write')
  const uplift = Number(input.uplift)
  if (!input.name.trim() || input.name.length > 100 || !validDate(input.start) || !validDate(input.end) || input.start > input.end || !Number.isFinite(uplift) || uplift < 0 || uplift > 500) throw new Error('Enter a name, a valid date range and an uplift between 0 and 500%.')
  const state = getOwnerState()
  commit({ ...state, salesEvents: [{ id: crypto.randomUUID(), name: input.name.trim(), start: input.start, end: input.end, uplift }, ...state.salesEvents] }, 'Sales event entered', input.name.trim(), 'planning:write')
}
export function removeSalesEvent(id) {
  requireBusinessWorkspace('planning:write')
  const state = getOwnerState()
  if (!state.salesEvents.some(item => item.id === id)) throw new Error('Sales event is no longer available.')
  commit({ ...state, salesEvents: state.salesEvents.filter(item => item.id !== id) }, 'Sales event removed', 'Local forecast scenario updated.', 'planning:write')
}
export function forecastRows(state) {
  const days = ['2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30']
  return demandHistory.map(item => {
    const baseline = item.dailyUnits.reduce((sum, value) => sum + value, 0)
    const forecast = Math.ceil(days.reduce((sum, day) => sum + baseline / 7 * (1 + Math.max(0, ...state.salesEvents.filter(event => event.start <= day && event.end >= day).map(event => event.uplift)) / 100), 0))
    return { ...item, baseline, forecast, shortfall: Math.max(0, forecast - item.available) }
  })
}
export function saveBusinessCost(input, expectedRevision) {
  requireBusinessWorkspace('finance:write')
  const state = getOwnerState()
  const previous = state.costs.find(item => item.id === input.id)
  if (input.id && !previous) throw new Error('This cost is no longer available.')
  if (previous && expectedRevision && JSON.stringify(previous) !== expectedRevision) throw new Error('This cost changed. Close and reopen it before saving.')
  const amount = Number(input.amount)
  if (!validDate(input.date) || !costCategories.includes(input.category) || !Number.isSafeInteger(amount) || amount <= 0 || !input.description.trim() || input.description.length > 500) throw new Error('Enter a valid date, category, positive whole VND amount and description of up to 500 characters.')
  const cost = { id: previous?.id || crypto.randomUUID(), date: input.date, category: input.category, amount, description: input.description.trim() }
  commit({ ...state, costs: previous ? state.costs.map(item => item.id === previous.id ? cost : item) : [cost, ...state.costs] }, previous ? 'Business cost updated' : 'Business cost entered', `${cost.category}: ${cost.amount} VND`, 'finance:write')
}
export function deleteBusinessCost(id, expectedRevision) {
  requireBusinessWorkspace('finance:write')
  const state = getOwnerState()
  const current = state.costs.find(item => item.id === id)
  if (!current) throw new Error('This cost is no longer available.')
  if (expectedRevision && JSON.stringify(current) !== expectedRevision) throw new Error('This cost changed. Close and reopen it before deleting.')
  commit({ ...state, costs: state.costs.filter(item => item.id !== id) }, 'Business cost deleted', 'Local cost ledger updated.', 'finance:write')
}
export function demoAdvisorAnswer(question, state) {
  if (/stock|inventory|forecast|kho|tồn|dự báo/i.test(question)) {
    const rows = forecastRows(state)
    return `Demo inventory review: ${rows.filter(item => item.shortfall > 0).length} sample SKUs have a projected shortfall for 24–30 Oct 2026. ${rows[0].sku}: ${rows[0].available} available against ${rows[0].forecast} forecast units. Verify live stock and lead times before restocking. Source: seven-day sample demand and saved sales-event assumptions; no AI model was called.`
  }
  if (/profit|cost|margin|chi phí|lợi nhuận/i.test(question)) return `Demo cost review: ${state.costs.length} entries are recorded in the local cost ledger. Review Profit with the matching reporting dates and check that cost of goods, marketplace fees and returns are included. This is a fixed demo response, not a verified financial calculation or AI recommendation.`
  if (/customer|loyal|voucher|khách|giảm giá/i.test(question)) return 'Demo loyalty review: filter customers by tier and preview voucher recipients before issuing. Customers without voucher opt-in are skipped. Compare discount costs with recorded margins before running a campaign. Source: sample loyalty data; no live messages or AI requests are sent.'
  return 'This demo can illustrate inventory, forecast, cost/profit and loyalty questions. Ask about one of those topics to see a response grounded in the sample workspace. A real AI advisor requires a connected model and tenant data service.'
}
export function askDemoAdvisor(question) {
  const session = requireBusinessWorkspace('advisor:use')
  if (!question.trim() || question.length > 1000) throw new Error('Enter a question of up to 1,000 characters.')
  const state = getOwnerState()
  if (session.role === 'TENANT_STAFF') {
    if (/profit|cost|margin|chi phí|lợi nhuận/i.test(question)) requireStaff(['finance:read'])
    if (/stock|inventory|forecast|kho|tồn|dự báo/i.test(question)) requireStaff(['planning:read'])
  }
  const requiredPermissions = [...(/profit|cost|margin|chi phí|lợi nhuận/i.test(question) ? ['finance:read'] : []), ...(/stock|inventory|forecast|kho|tồn|dự báo/i.test(question) ? ['planning:read'] : [])]
  const conversation = { id: crypto.randomUUID(), actorId: session.id, requiredPermissions, question: question.trim(), answer: demoAdvisorAnswer(question, state), at: new Date().toISOString() }
  commit({ ...state, conversations: [...state.conversations, conversation].slice(-50) }, 'Advisor question asked', 'A local demo response was generated; no model request was sent.', 'advisor:use')
}
