import { getDemoSession } from '@/features/auth/lib/demoSession'
import { initialAudit, initialPlans, initialTenants } from '../data/platformFixtures'
import { defaultFeatures, planFeatures } from '../data/platformFeatures'
import { initialAlerts } from '../data/alertFixtures'
import { recordDemoSecurityEvent } from '@/features/auth/lib/demoSecurityLog'
import { effectivePlan, getOwnerState, ownerConnectionAlerts, ownerConnections } from '@/features/portal/lib/ownerWorkspaceStore'

const key = 'smartomni.platform-demo.v1'
const listeners = new Set()
function normalize(stored) {
  const owner = getOwnerState()
  const baseAlerts = Array.isArray(stored.alerts) ? stored.alerts : structuredClone(initialAlerts)
  const ownerAlerts = ownerConnectionAlerts(owner, { alerts: baseAlerts })
  const alerts = baseAlerts.map(alert => ownerAlerts.find(item => item.id === alert.id) || alert)
  const projected = stored.tenants.map(tenant => tenant.id === 'demo-tenant' ? { ...tenant, plan: effectivePlan(owner, tenant), shops: ownerConnections(owner, tenant, { alerts }) } : tenant)
  const tenants = projected.map(tenant => ({ ...tenant, shops: tenant.shops.map(shop => {
    const related = alerts.filter(alert => alert.kind === 'shop' && alert.tenantId === tenant.id && alert.shopName === shop.name && alert.platform === shop.platform)
    return related.length ? { ...shop, status: related.some(alert => alert.status !== 'RESOLVED') ? 'Needs attention' : 'Connected' } : shop
  }) }))
  return { ...stored, tenants, plans: stored.plans.map(plan => ({ ...plan, features: { ...defaultFeatures[plan.id], ...Object.fromEntries(planFeatures.filter(feature => typeof plan.features?.[feature.id] === 'boolean').map(feature => [feature.id, plan.features[feature.id]])) } })), alerts }
}
const seed = () => normalize({ tenants: structuredClone(initialTenants), plans: structuredClone(initialPlans), audit: structuredClone(initialAudit) })
function readState() {
  try {
    const stored = JSON.parse(localStorage.getItem(key))
    if (stored && Array.isArray(stored.tenants) && stored.tenants.length === initialTenants.length && stored.tenants.every(item => initialTenants.some(tenant => tenant.id === item.id) && ['ACTIVE', 'SUSPENDED', 'ONBOARDING'].includes(item.status)) && Array.isArray(stored.plans) && stored.plans.length === 2 && stored.plans.every(plan => ['Free', 'Pro'].includes(plan.id) && [plan.skuLimit, plan.shopLimit, plan.managerLimit].every(value => Number.isSafeInteger(value) && value > 0)) && Array.isArray(stored.audit)) return normalize(stored)
  } catch { /* Missing, invalid or inaccessible storage uses the fixtures. */ }
  return seed()
}
let state = readState()

export const getPlatformSnapshot = () => state
export function subscribePlatform(listener) { listeners.add(listener); return () => listeners.delete(listener) }
window.addEventListener('storage', event => {
  if (event.key === key || event.key === 'smartomni.owner-workspace-demo.v1' || event.key === null) { state = readState(); listeners.forEach(listener => listener()) }
})
window.addEventListener('smartomni:owner-workspace', () => { state = readState(); listeners.forEach(listener => listener()) })

function commit(next) {
  const session = getDemoSession()
  if (session?.role !== 'SUPER_ADMIN') throw new Error('Super Admin access is required.')
  try { localStorage.setItem(key, JSON.stringify(next)) } catch { throw new Error('Browser storage is unavailable. Your change was not saved.') }
  state = next
  listeners.forEach(listener => listener())
  window.dispatchEvent(new Event('smartomni:platform-demo'))
}
function auditEntry(action, target, reason, tenantId) {
  return { id: crypto.randomUUID(), at: new Date().toISOString(), actor: getDemoSession()?.name || 'Super Admin', action, target, reason, ...(tenantId ? { tenantId } : {}) }
}
export function changeTenantStatus(id, reason) {
  const tenant = state.tenants.find(item => item.id === id)
  if (!tenant || !['ACTIVE', 'SUSPENDED'].includes(tenant.status)) throw new Error('Only active or suspended tenants can change access.')
  if (!reason.trim()) throw new Error('Enter a reason for this change.')
  const status = tenant.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'
  const nextTenant = { ...tenant, status, suspensionReason: status === 'SUSPENDED' ? reason.trim() : null }
  commit({ ...state, tenants: state.tenants.map(item => item.id === id ? nextTenant : item), audit: [auditEntry(status === 'SUSPENDED' ? 'Tenant suspended' : 'Tenant reactivated', tenant.name, reason.trim(), id), ...state.audit] })
  recordDemoSecurityEvent({ type: 'TENANT_ACCESS_CHANGED', severity: 'WARNING', actor: getDemoSession().name, result: 'Applied', message: `${tenant.name}: ${status === 'SUSPENDED' ? 'workspace suspended' : 'workspace reactivated'}.`, resource: `/admin/tenants/${id}` })
}
export function updatePlan(id, draft, reason) {
  const plan = state.plans.find(item => item.id === id)
  if (!plan) throw new Error('Plan not found.')
  if (!reason.trim()) throw new Error('Enter a reason for this change.')
  if (![draft.skuLimit, draft.shopLimit, draft.managerLimit].every(value => Number.isSafeInteger(value) && value > 0 && value <= 1000000)) throw new Error('Enter whole-number limits between 1 and 1,000,000.')
  if (id === 'Free' && draft.shopLimit !== 1) throw new Error('Free is limited to one shop connection.')
  const nextPlan = { ...plan, description: draft.description.trim(), skuLimit: draft.skuLimit, shopLimit: draft.shopLimit, managerLimit: draft.managerLimit }
  if (!nextPlan.description) throw new Error('Enter a plan description.')
  if (JSON.stringify(nextPlan) === JSON.stringify(plan)) throw new Error('No changes to save.')
  const changes = ['skuLimit', 'shopLimit', 'managerLimit'].filter(field => plan[field] !== nextPlan[field]).map(field => `${field}: ${plan[field]} → ${nextPlan[field]}`).join('; ')
  commit({ ...state, plans: state.plans.map(item => item.id === id ? nextPlan : item), audit: [auditEntry('Plan updated', id, `${reason.trim()}${changes ? ` · ${changes}` : ' · Description updated'}`), ...state.audit] })
  recordDemoSecurityEvent({ type: 'PLAN_LIMITS_CHANGED', severity: 'WARNING', actor: getDemoSession().name, result: 'Applied', message: `${id} plan definition updated.`, resource: '/admin/plans' })
}
export function usageIssues(tenant, plan) {
  return [[tenant.skus, plan.skuLimit, 'SKUs'], [tenant.shops.length, plan.shopLimit, 'shops'], [tenant.manager, plan.managerLimit, 'manager']].filter(([used, limit]) => used > limit).map(([used, limit, label]) => `${used} / ${limit} ${label}`)
}

export function updatePlanFeatures(id, features, reason) {
  const plan = state.plans.find(item => item.id === id)
  if (!plan) throw new Error('Plan not found.')
  if (!reason.trim()) throw new Error('Enter a reason for this change.')
  if (!planFeatures.every(feature => typeof features[feature.id] === 'boolean')) throw new Error('Choose a valid setting for each feature.')
  const changed = planFeatures.filter(feature => plan.features[feature.id] !== features[feature.id])
  if (!changed.length) throw new Error('No feature changes to save.')
  const nextFeatures = Object.fromEntries(planFeatures.map(feature => [feature.id, features[feature.id]]))
  const summary = changed.map(feature => `${feature.label}: ${features[feature.id] ? 'enabled' : 'disabled'}`).join('; ')
  commit({ ...state, plans: state.plans.map(item => item.id === id ? { ...item, features: nextFeatures } : item), audit: [auditEntry('Plan features updated', id, `${reason.trim()} · ${summary}`), ...state.audit] })
  recordDemoSecurityEvent({ type: 'ENTITLEMENTS_CHANGED', severity: 'WARNING', actor: getDemoSession().name, result: 'Applied', message: `${id} plan · ${summary}`, resource: '/admin/plans' })
}

export function transitionAlert(id, action, note) {
  const alert = state.alerts.find(item => item.id === id)
  if (!alert) throw new Error('Alert not found.')
  if (!note.trim()) throw new Error('Enter a note for this action.')
  const transitions = { acknowledge: { from: ['OPEN'], to: 'ACKNOWLEDGED', label: 'Alert acknowledged' }, resolve: { from: ['OPEN', 'ACKNOWLEDGED'], to: 'RESOLVED', label: 'Alert resolved' }, reopen: { from: ['RESOLVED'], to: 'OPEN', label: 'Alert reopened' } }
  const transition = transitions[action]
  if (!transition?.from.includes(alert.status)) throw new Error('This alert has changed. Review its current status before continuing.')
  const at = new Date().toISOString()
  const nextAlert = { ...alert, status: transition.to, lastSeen: at, occurrences: alert.occurrences + (action === 'reopen' ? 1 : 0), history: [...alert.history, { at, actor: getDemoSession()?.name || 'Super Admin', action: transition.label, note: note.trim() }] }
  const alerts = state.alerts.map(item => item.id === id ? nextAlert : item)
  const tenants = state.tenants.map(tenant => {
    if (alert.kind !== 'shop' || tenant.id !== alert.tenantId) return tenant
    return { ...tenant, shops: tenant.shops.map(shop => shop.name === alert.shopName && shop.platform === alert.platform ? { ...shop, status: alerts.some(item => item.kind === 'shop' && item.tenantId === tenant.id && item.shopName === shop.name && item.status !== 'RESOLVED') ? 'Needs attention' : 'Connected' } : shop) }
  })
  commit({ ...state, tenants, alerts, audit: [{ ...auditEntry(transition.label, alert.title, note.trim(), alert.tenantId), alertId: alert.id, alertKind: alert.kind }, ...state.audit] })
}
