import { useMemo, useSyncExternalStore } from 'react'
import { getDemoSession } from '@/features/auth/lib/demoSession'
import { createStaffFixture, importCandidates, marketplaceListings, staffOperationsKey, warehouses } from '../data/staffFixtures'

const eventName = 'smartomni:staff-operations'
function readRoot() { try { const value = JSON.parse(localStorage.getItem(staffOperationsKey)); return value && typeof value === 'object' ? value : { tenants: {} } } catch { return { tenants: {} } } }
function normalize(value) { const seed = createStaffFixture(); return Object.fromEntries(Object.keys(seed).map(key => [key, Array.isArray(value?.[key]) ? value[key] : seed[key]])) }
export function readStaffData(tenantId) { return normalize(readRoot().tenants?.[tenantId]) }
function subscribe(listener) {
  const storage = event => { if (!event.key || [staffOperationsKey, 'smartomni.team-demo.v1', 'smartomni.platform-demo.v1', 'smartomni.owner-workspace-demo.v1'].includes(event.key)) listener() }
  window.addEventListener('storage', storage); window.addEventListener(eventName, listener)
  window.addEventListener('smartomni:owner-workspace', listener); window.addEventListener('smartomni:platform-demo', listener)
  return () => { window.removeEventListener('storage', storage); window.removeEventListener(eventName, listener); window.removeEventListener('smartomni:owner-workspace', listener); window.removeEventListener('smartomni:platform-demo', listener) }
}
export function useStaffData(tenantId) {
  const snapshot = useSyncExternalStore(subscribe, () => JSON.stringify({ ...readStaffData(tenantId), shopAvailability: { shopee: staffShopConnected('shopee'), tiktok: staffShopConnected('tiktok') } }), () => JSON.stringify(createStaffFixture()))
  return useMemo(() => JSON.parse(snapshot), [snapshot])
}
export function requireStaff(permissions, tenantId = 'demo-tenant') {
  const session = getDemoSession()
  if (session?.role !== 'TENANT_STAFF' || session.membershipStatus !== 'ACTIVE' || session.tenantId !== tenantId) throw new Error('Active Staff membership in this tenant is required.')
  let tenant
  try { tenant = JSON.parse(localStorage.getItem('smartomni.platform-demo.v1'))?.tenants?.find(item => item.id === tenantId) } catch { /* Initial demo tenant is active. */ }
  if (tenant?.status === 'SUSPENDED') throw new Error('This tenant is suspended.')
  const requested = new URLSearchParams(window.location.search).get('tenant')
  if (requested && requested !== session.tenantDomain) throw new Error('This account is not assigned to the requested subdomain.')
  if (!permissions.every(permission => session.permissions.includes(permission))) throw new Error('Your owner has not granted permission for this action.')
  return session
}
export function mutateStaff(permissions, action, change) {
  const session = requireStaff(permissions)
  const root = readRoot()
  const state = structuredClone(normalize(root.tenants?.[session.tenantId]))
  const result = change(state)
  const audit = { id: crypto.randomUUID(), at: new Date().toISOString(), actor: session.name, action, tenantId: session.tenantId, tenantDomain: session.tenantDomain, source: 'Staff local demo' }
  state.audit = [audit, ...state.audit].slice(0, 200)
  try { localStorage.setItem(staffOperationsKey, JSON.stringify({ ...root, tenants: { ...root.tenants, [session.tenantId]: state } })) } catch { throw new Error('Could not save. Allow browser storage and try again.') }
  window.dispatchEvent(new Event(eventName))
  return result
}
const mutate = mutateStaff
export function availableStock(row) { return row.onHand - row.reserved }
export function staffShopConnected(platform) {
  try {
    const admin = JSON.parse(localStorage.getItem('smartomni.platform-demo.v1')) || {}
    const tenant = admin.tenants?.find(item => item.id === 'demo-tenant')
    const shop = tenant?.shops?.find(item => item.platform === platform)
    const name = shop?.name || (platform === 'shopee' ? 'Everyday Studio Official' : 'Everyday Studio')
    const own = JSON.parse(localStorage.getItem('smartomni.owner-workspace-demo.v1'))
    const override = own?.shopOverrides?.find(item => item.platform === platform && item.name === name)
    const lastAlert = admin.alerts?.filter(item => item.tenantId === 'demo-tenant' && item.platform === platform && item.shopName === name).sort((a, b) => b.lastSeen.localeCompare(a.lastSeen))[0]
    if (override && (!lastAlert || Date.parse(override.updatedAt) >= Date.parse(lastAlert.lastSeen))) return override.status === 'Connected'
    return shop ? shop.status === 'Connected' : platform === 'shopee'
  } catch { return platform === 'shopee' }
}
export function updateInternalProduct(id, input, expectedRevision) {
  return mutate(['products:read', 'products:edit'], 'Internal product updated', state => {
    const product = state.products.find(item => item.id === id)
    if (!product) throw new Error('This internal product is no longer available.')
    if (JSON.stringify(product) !== expectedRevision) throw new Error('This product changed. Close and reopen it before saving.')
    const name = input.name.trim(), category = input.category.trim(), notes = input.notes.trim()
    if (!name || name.length > 120 || !category || category.length > 60 || notes.length > 1000) throw new Error('Enter a name, category and notes within the displayed limits.')
    Object.assign(product, { name, category, notes, updatedAt: new Date().toISOString() })
  })
}
export function queueProductImport(platform, candidateIds) {
  return mutate(['products:read', 'products:import'], 'Marketplace import queued', state => {
    if (!['shopee', 'tiktok'].includes(platform) || !staffShopConnected(platform)) throw new Error('This shop needs Owner authorization before importing.')
    const selected = [...new Set(candidateIds)].filter(id => importCandidates.some(item => item.id === id && item.platform === platform))
    if (!selected.length) throw new Error('Select at least one marketplace product.')
    if (state.importJobs.some(job => ['QUEUED', 'RUNNING'].includes(job.status) && job.platform === platform)) throw new Error('Finish the existing import for this marketplace first.')
    const id = crypto.randomUUID()
    state.importJobs.unshift({ id, platform, at: new Date().toISOString(), status: 'QUEUED', candidateIds: selected, results: [] })
    return id
  })
}
export function advanceProductImport(id) {
  return mutate(['products:read', 'products:import'], 'Marketplace import progressed', state => {
    const job = state.importJobs.find(item => item.id === id)
    if (!job || !['QUEUED', 'RUNNING'].includes(job.status)) throw new Error('This import can no longer be processed.')
    if (!staffShopConnected(job.platform)) throw new Error('The shop connection is unavailable. Ask the Owner to reauthorize it.')
    if (job.status === 'QUEUED') { job.status = 'RUNNING'; return }
    job.results = job.candidateIds.map(candidateId => {
      const item = importCandidates.find(candidate => candidate.id === candidateId)
      if (!item?.sku) return { name: item?.name || 'Unknown listing', sku: '', status: 'FAILED', message: 'Seller SKU is missing; correct the marketplace listing before retrying.' }
      if (state.products.some(product => product.sku === item.sku)) return { name: item.name, sku: item.sku, status: 'SKIPPED', message: 'Internal SKU already exists; existing details were retained.' }
      state.products.push({ id: crypto.randomUUID(), sku: item.sku, name: item.name, category: item.category, notes: '', source: `Demo import ${job.id}` })
      state.inventory.push({ id: crypto.randomUUID(), sku: item.sku, warehouseId: 'WH-HCM', onHand: 0, reserved: 0 })
      return { name: item.name, sku: item.sku, status: 'IMPORTED', message: 'Internal product created locally. Stock and marketplace mapping still need setup.' }
    })
    job.status = job.results.some(item => item.status === 'FAILED') ? (job.results.some(item => item.status !== 'FAILED') ? 'PARTIAL' : 'FAILED') : 'COMPLETED'
    job.finishedAt = new Date().toISOString()
  })
}
function queueListings(state, listingIds) {
  for (const listingId of [...new Set(listingIds)]) {
    const job = state.syncJobs.find(item => item.listingId === listingId)
    if (job?.status === 'FAILED' || job?.status === 'QUEUED') continue
    if (job) { job.status = 'QUEUED'; job.message = 'Stock changed; awaiting demo sync.'; job.at = new Date().toISOString() }
    else state.syncJobs.unshift({ id: crypto.randomUUID(), listingId, status: 'QUEUED', attempts: 0, code: null, message: 'Awaiting demo sync.', available: null, at: new Date().toISOString(), history: [] })
  }
}
export function stockChanged(state, row) { queueListings(state, state.mappings.filter(item => item.sku === row.sku && item.warehouseId === row.warehouseId).map(item => item.listingId)) }
export function changeInventory(id, quantity, reason, receive, expectedRevision, requestId) {
  return mutate(['inventory:read', receive ? 'inventory:receive' : 'inventory:adjust'], receive ? 'Incoming stock recorded' : 'Inventory adjusted', state => {
    if (state.stockLedger.some(item => item.requestId === requestId)) return
    const row = state.inventory.find(item => item.id === id)
    if (!row) throw new Error('This SKU/warehouse record is unavailable.')
    if (JSON.stringify(row) !== expectedRevision) throw new Error('Stock changed. Close and reopen the form to use the latest quantity.')
    const delta = Number(quantity)
    if (!Number.isSafeInteger(delta) || delta === 0 || (receive && delta < 1) || !reason.trim() || reason.length > 500) throw new Error('Enter a non-zero whole quantity and a reference/reason of up to 500 characters.')
    const next = row.onHand + delta
    if (!Number.isSafeInteger(next) || next < row.reserved) throw new Error('On-hand stock cannot be negative or below the reserved quantity.')
    state.stockLedger.unshift({ id: crypto.randomUUID(), requestId, sku: row.sku, warehouseId: row.warehouseId, delta, before: row.onHand, after: next, kind: receive ? 'RECEIPT' : 'ADJUSTMENT', reason: reason.trim(), at: new Date().toISOString() })
    row.onHand = next
    stockChanged(state, row)
  })
}
export function mappingIssue(state, listingId) {
  const listing = marketplaceListings.find(item => item.id === listingId)
  const mapping = state.mappings.find(item => item.listingId === listingId)
  if (!mapping) return { code: 'SKU_MAPPING_MISSING', message: 'Map the marketplace variant to an internal SKU and warehouse.' }
  if (!warehouses.some(item => item.id === mapping.warehouseId)) return { code: 'WAREHOUSE_MAPPING_INVALID', message: 'The assigned warehouse does not exist in this demo.' }
  if (!state.products.some(item => item.sku === mapping.sku) || mapping.sku !== listing?.expectedSku) return { code: 'SKU_MAPPING_INCORRECT', message: `The sample scenario expects internal SKU ${listing?.expectedSku}.` }
  if (!state.inventory.some(item => item.sku === mapping.sku && item.warehouseId === mapping.warehouseId)) return { code: 'WAREHOUSE_SKU_MISSING', message: 'No inventory record exists for this SKU in the selected warehouse.' }
  return null
}
export function saveSkuMapping(listingId, sku, warehouseId, reason, expectedRevision) {
  return mutate(['products:read', 'inventory:read', 'mapping:write'], 'SKU/warehouse mapping saved', state => {
    const listing = marketplaceListings.find(item => item.id === listingId)
    const current = state.mappings.find(item => item.listingId === listingId)
    if (JSON.stringify(current || null) !== expectedRevision) throw new Error('This mapping changed. Reopen the mapping form.')
    if (!listing || !state.products.some(item => item.sku === sku) || !warehouses.some(item => item.id === warehouseId) || !reason.trim() || reason.length > 500) throw new Error('Choose an internal SKU, a valid warehouse and enter a reason/reference.')
    if (!state.inventory.some(item => item.sku === sku && item.warehouseId === warehouseId)) throw new Error('The selected warehouse has no stock record for this SKU.')
    state.mappings = [...state.mappings.filter(item => item.listingId !== listingId), { listingId, sku, warehouseId, reason: reason.trim(), updatedAt: new Date().toISOString() }]
  })
}
export function queueInventorySync(inventoryId) {
  return mutate(['inventory:read', 'inventory:sync'], 'Inventory sync queued', state => {
    const row = state.inventory.find(item => item.id === inventoryId)
    if (!row) throw new Error('Select an inventory record.')
    const mappings = state.mappings.filter(item => item.sku === row.sku && item.warehouseId === row.warehouseId)
    if (!mappings.length) throw new Error('No marketplace mapping exists for this SKU and warehouse. Correct mapping first.')
    queueListings(state, mappings.map(item => item.listingId))
  })
}
export function runInventorySync(id) {
  return mutate(['inventory:read', 'inventory:sync'], 'Inventory sync attempted', state => {
    const job = state.syncJobs.find(item => item.id === id)
    if (!job || !['FAILED', 'QUEUED'].includes(job.status)) throw new Error('Only queued or failed sync jobs can be run.')
    const listing = marketplaceListings.find(item => item.id === job.listingId)
    const issue = mappingIssue(state, job.listingId) || (!staffShopConnected(listing.platform) ? { code: 'SHOP_AUTH_REQUIRED', message: 'Ask the Owner to reauthorize this shop, then retry.' } : null)
    job.attempts += 1
    job.at = new Date().toISOString()
    if (issue) { Object.assign(job, issue, { status: 'FAILED' }); job.history.push({ at: job.at, ...issue }); return { failed: true, message: issue.message } }
    const mapping = state.mappings.find(item => item.listingId === job.listingId)
    const row = state.inventory.find(item => item.sku === mapping.sku && item.warehouseId === mapping.warehouseId)
    job.status = 'SUCCEEDED'; job.code = null; job.message = 'Available stock synchronized in local demo; no marketplace API call was made.'; job.available = availableStock(row)
    job.history.push({ at: job.at, code: 'SUCCEEDED', message: `${job.available} available units · demo only` })
    return { failed: false, message: job.message }
  })
}
export function arrangeStaffShipment(id, carrier, expectedRevision) {
  return mutate(['orders:read', 'shipments:arrange'], 'Shipment arranged', state => {
    const order = state.orders.find(item => item.id === id)
    if (!order || order.status !== 'READY_TO_SHIP' || JSON.stringify(order) !== expectedRevision) throw new Error('This order changed or is no longer ready to ship. Reopen it before arranging shipment.')
    if (!['Demo standard', 'Demo express'].includes(carrier)) throw new Error('Choose a demo carrier service.')
    for (const item of order.items) {
      const stock = state.inventory.find(row => row.sku === item.sku && row.warehouseId === order.warehouseId)
      if (!stock || stock.onHand < item.quantity || stock.reserved < item.quantity) throw new Error('The order’s SKU/warehouse reservation needs review before shipment.')
    }
    order.status = 'ARRANGED'
    order.shipment = { carrier, tracking: `DEMO-${order.id}`, status: 'PENDING_PICKUP', at: new Date().toISOString() }
  })
}
export function cancelStaffOrder(id, reason, expectedRevision) {
  return mutate(['orders:read', 'orders:cancel'], 'Order cancelled', state => {
    const order = state.orders.find(item => item.id === id)
    if (!order || order.status !== 'READY_TO_SHIP' || JSON.stringify(order) !== expectedRevision) throw new Error('This order changed or can no longer be cancelled in this demo.')
    if (!reason.trim() || reason.length > 500) throw new Error('Enter a cancellation reason of up to 500 characters.')
    for (const item of order.items) {
      const stock = state.inventory.find(row => row.sku === item.sku && row.warehouseId === order.warehouseId)
      if (!stock || stock.reserved < item.quantity) throw new Error('The stock reservation is inconsistent. No cancellation was saved.')
      stock.reserved -= item.quantity
      stockChanged(state, stock)
    }
    order.status = 'CANCELLED'; order.cancelReason = reason.trim(); order.cancelledAt = new Date().toISOString()
  })
}
const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]))
export function staffShippingLabel(id) {
  requireStaff(['orders:read', 'labels:print'])
  const order = readStaffData('demo-tenant').orders.find(item => item.id === id)
  if (!order?.shipment || !['ARRANGED', 'SHIPPED', 'DELIVERED'].includes(order.status)) throw new Error('A shipment must be arranged before a label is available.')
  return `<!doctype html><html><head><meta charset="utf-8"><title>Demo label ${escapeHtml(order.id)}</title><style>body{font:16px system-ui;margin:32px;max-width:500px;color:#171717}h1{font-size:24px}section{border:2px solid;padding:24px}li{margin:12px 0}@media print{body{margin:12mm}}</style></head><body><section><h1>DEMO · NOT VALID FOR SHIPPING</h1><p>Everyday Studio · everyday-studio</p><h2>${escapeHtml(order.id)}</h2><p>${escapeHtml(order.shipment.carrier)} · ${escapeHtml(order.shipment.tracking)}</p><p>${escapeHtml(order.customer)}<br>${escapeHtml(order.address)}</p><ul>${order.items.map(item => `<li>${escapeHtml(item.sku)} × ${item.quantity}</li>`).join('')}</ul><p>Local preview only. No carrier booking or official shipping label has been created.</p></section></body></html>`
}
