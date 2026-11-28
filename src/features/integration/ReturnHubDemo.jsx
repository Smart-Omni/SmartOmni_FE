import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Clock, PackageCheck, RefreshCw, Scale, ShieldAlert, Truck } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog'
import { shopeeApi } from '@/services/api/shopee'
import { DataTable, Feedback, OwnerPanel } from '@/features/portal/components/OwnerWorkspaceUI'
import { useApiResource } from './useApiResource'
import { ResourceState } from './ShopeeShared'
import { dateTime, money, useApiAction } from './apiHelpers'
import TiktokReturns from './TiktokReturns'
import { KpiGrid, StageTabs } from './ReturnHubParts'
import { ConfirmationDialog } from './ConfirmationDialog'
import { InspectionDialog } from './ShopeeWarehouseReturns'
import { inspectionLabel, loadWarehouseReturns, pendingInspection } from './warehouseReturns'
import styles from '@/features/portal/OwnerWorkspace.module.css'
import demo from './ReturnHubDemo.module.css'

const HOUR_MS = 3_600_000
const MAX_VISIBLE_ITEMS = 2
const PAGE_SIZE = 50
const RETURN_STATUSES = ['REQUESTED', 'JUDGING', 'PROCESSING', 'ACCEPTED', 'SELLER_DISPUTE', 'CLOSED', 'CANCELLED']
const SOURCES = { shopee: 'Shopee', tiktok: 'TikTok Shop' }

const DEFAULT_SHOPEE_DISPUTE_REASONS = [
  { disputeReasonId: 47, disputeName: 'ITEM_DAMAGED_BY_BUYER', disputeRequirement: 'Returned product was damaged or used by buyer' },
  { disputeReasonId: 48, disputeName: 'WEIGHT_MEASUREMENT_MISMATCH', disputeRequirement: 'Parcel weight mismatch before dispatch and on return' },
  { disputeReasonId: 50, disputeName: 'INCORRECT_CLAIM', disputeRequirement: 'Buyer claim is incorrect or returned parcel is incorrect' },
  { disputeReasonId: 51, disputeName: 'NON_RECEIPT_REJECT', disputeRequirement: 'Reject non-receipt claim with delivery proof' },
  { disputeReasonId: 52, disputeName: 'NOT_RECEIVED_RETURN', disputeRequirement: 'Return parcel was never received from carrier' },
  { disputeReasonId: 49, disputeName: 'OTHER', disputeRequirement: 'Other supporting statement and evidence' },
]

const STAGE_TABS = [
  { id: 'need_action', label: 'Needs action' },
  { id: 'in_return_transit', label: 'Return in transit' },
  { id: 'dispute', label: 'In dispute (3–5 days)' },
  { id: 'completed', label: 'Completed / Closed' },
  { id: 'all', label: 'All requests' },
]

function toMs(epochSeconds) {
  return epochSeconds ? Number(epochSeconds) * 1000 : null
}

function buildReturnTimeline(raw, createdAt, updatedAt, reverseDeliveredAt) {
  const records = []
  if (createdAt) {
    records.push({
      at: createdAt,
      actor: 'BUYER',
      note: `Opened a ${raw.needsLogistics === false ? 'refund only' : 'return and refund'} request (${raw.reason || 'RETURN'})`,
    })
  }
  if (raw.trackingNumber && raw.needsLogistics !== false) {
    records.push({
      at: updatedAt || createdAt,
      actor: 'CARRIER',
      note: `Return tracking number: ${raw.trackingNumber}`,
    })
  }
  if (reverseDeliveredAt) {
    records.push({
      at: reverseDeliveredAt,
      actor: 'CARRIER',
      note: 'Carrier delivered the return to the shop. The 2-day dispute window opened',
    })
  }
  if (raw.negotiationStatus === 'PENDING_BUYER_RESPOND' && raw.offerAmount != null) {
    records.push({
      at: updatedAt || createdAt,
      actor: 'SELLER',
      note: `Proposed a partial refund of ${money(raw.offerAmount)}${raw.offerReason ? ` (${raw.offerReason})` : ''}`,
    })
  }
  if (raw.status === 'SELLER_DISPUTE' || raw.compensationStatus === 'COMPENSATION_REQUESTED') {
    const reasonCode = raw.disputeReason?.[0] || 'DISPUTE'
    records.push({
      at: updatedAt || createdAt,
      actor: 'SELLER',
      note: `Submitted a dispute to Shopee (${reasonCode})`,
    })
  }
  if (raw.rulingNotes) {
    records.push({
      at: updatedAt || createdAt,
      actor: 'SHOPEE',
      note: raw.rulingNotes,
    })
  }
  return records
}

function normalizeShopeeReturn(raw) {
  const createdAt = toMs(raw.createTime) ?? Date.now()
  const updatedAt = toMs(raw.updateTime) ?? createdAt
  const reverseDeliveredAt = toMs(raw.reverseDeliveredAt)
  const items = (raw.items || []).map(item => ({
    sku: item.variationSku || String(item.modelId || item.itemId || '—'),
    name: item.name || 'Shopee product',
    variant: item.variationSku || (item.modelId ? `Model #${item.modelId}` : 'Default'),
    qty: item.quantity ?? 1,
    price: Number(item.itemPrice ?? 0),
    refundAmount: Number(item.refundAmount ?? 0),
  }))

  return {
    id: raw.returnSn,
    orderId: raw.orderSn,
    channel: 'SHOPEE',
    rawStatus: raw.status || 'REQUESTED',
    solution: raw.needsLogistics === false ? 'REFUND' : 'RETURN_REFUND',
    needsLogistics: raw.needsLogistics !== false,
    buyerUsername: raw.buyerUsername || 'Shopee buyer',
    reason: raw.reason || '',
    reasonText: raw.textReason || raw.reason || '',
    refundAmount: Number(raw.refundAmount ?? 0),
    reverseShippingFee: Number(raw.reverseShippingFee ?? 0),
    trackingNumber: raw.trackingNumber || '',
    compensationStatus: raw.compensationStatus || null,
    arbitrationStatus: null,
    negotiationStatus: raw.negotiationStatus || 'TERMINATED',
    offerAmount: raw.offerAmount != null ? Number(raw.offerAmount) : null,
    offerReason: raw.offerReason || '',
    isNfrExempt: Boolean(raw.isNfrExempt) || raw.reason === 'CHANGE_OF_MIND',
    createdAt,
    updatedAt,
    dueDate: toMs(raw.dueDate),
    disputeDueDate: toMs(raw.disputeDueDate),
    buyerReturnDueDate: toMs(raw.buyerReturnDueDate),
    expectedReturnDate: toMs(raw.expectedReturnDate),
    reverseDeliveredAt,
    buyerProofImages: raw.buyerProofImages || [],
    sellerProofImages: raw.sellerProofImages || [],
    rulingNotes: raw.rulingNotes || '',
    records: buildReturnTimeline(raw, createdAt, updatedAt, reverseDeliveredAt),
    items,
  }
}

function getReturnMeta(ret, now = Date.now()) {
  const s = ret.rawStatus
  const disputeDeadline = ret.disputeDueDate ?? ret.dueDate
  const withinDisputeWindow = !disputeDeadline || now <= disputeDeadline
  const isChangeOfMind = ret.reason === 'CHANGE_OF_MIND' || ret.isNfrExempt

  if (s === 'REQUESTED') {
    return {
      label: 'Awaiting seller / Negotiating',
      cls: 'statusAction',
      stage: 'need_action',
      canConfirmReceipt: !isChangeOfMind,
      canDispute: true,
      canOffer: !isChangeOfMind && ret.negotiationStatus !== 'PENDING_BUYER_RESPOND',
    }
  }
  if (s === 'PROCESSING') {
    const deliveredOrPastExpected = Boolean(ret.reverseDeliveredAt)
      || (Boolean(ret.expectedReturnDate) && now >= ret.expectedReturnDate)
    const inTransit = ret.needsLogistics && !deliveredOrPastExpected
    return {
      label: inTransit ? 'Returning to shop' : 'Return delivered · Awaiting confirmation',
      cls: inTransit ? 'statusTransit' : 'statusAction',
      stage: inTransit ? 'in_return_transit' : 'need_action',
      inTransit,
      canConfirmReceipt: !inTransit,
      canDispute: deliveredOrPastExpected && (!ret.disputeDueDate || now <= ret.disputeDueDate),
      canOffer: !inTransit && !isChangeOfMind && ret.negotiationStatus !== 'PENDING_BUYER_RESPOND',
    }
  }
  if (s === 'ACCEPTED' && ret.solution === 'REFUND'
    && ret.compensationStatus !== 'COMPENSATION_REQUESTED'
    && ret.compensationStatus !== 'COMPENSATION_APPROVED') {
    return {
      label: 'Shopee instant refund (no return)',
      cls: 'statusAction',
      stage: 'need_action',
      canDispute: withinDisputeWindow,
    }
  }
  if (s === 'JUDGING') {
    return { label: 'Under Shopee review', cls: 'statusDispute', stage: 'dispute' }
  }
  if (s === 'SELLER_DISPUTE' || ret.compensationStatus === 'COMPENSATION_REQUESTED') {
    return {
      label: 'In dispute (Shopee 3–5 days)',
      cls: 'statusDispute',
      stage: 'dispute',
    }
  }
  if (s === 'ACCEPTED') {
    return { label: 'Refund accepted', cls: 'statusSuccess', stage: 'completed' }
  }
  if (s === 'CLOSED' || s === 'CANCELLED') {
    return { label: s === 'CANCELLED' ? 'Request cancelled' : 'Closed', cls: 'statusClosed', stage: 'completed' }
  }
  return { label: s, cls: 'statusClosed', stage: 'all' }
}

function getDueBadge(ret, now) {
  const meta = getReturnMeta(ret, now)
  if (meta.stage === 'completed' || meta.stage === 'dispute' || meta.inTransit) return null
  const isDisputeDeadline = Boolean(ret.disputeDueDate)
  const deadline = ret.rawStatus === 'PROCESSING'
    ? ret.disputeDueDate
    : (ret.disputeDueDate ?? ret.dueDate)
  if (!deadline) return null
  const diff = deadline - now
  if (diff < 0) {
    return {
      urgent: true,
      cls: 'slaOverdue',
      label: isDisputeDeadline ? 'Dispute window overdue' : 'Response overdue',
    }
  }
  const hrs = Math.max(1, Math.round(diff / HOUR_MS))
  if (hrs <= 48) {
    return {
      urgent: true,
      cls: 'slaUrgent',
      label: isDisputeDeadline ? `${hrs}h left to dispute` : `${hrs}h left to respond`,
    }
  }
  return { urgent: false, cls: 'slaOk', label: `${hrs}h left` }
}

export default function ReturnHubDemo() {
  const [searchParams, setSearchParams] = useSearchParams()
  const requested = searchParams.get('source')
  const source = Object.hasOwn(SOURCES, requested ?? '') ? requested : 'shopee'
  const sourceSelect = (
    <label className={styles.field}>
      Return source
      <select value={source} onChange={e => setSearchParams(e.target.value === 'shopee' ? {} : { source: e.target.value })}>
        {Object.entries(SOURCES).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
      </select>
    </label>
  )

  const Hub = source === 'tiktok' ? TiktokReturns : ShopeeReturnHub
  return <Hub sourceSelect={sourceSelect} />
}

function ShopeeReturnHub({ sourceSelect }) {
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const [awaitingOnly, setAwaitingOnly] = useState(false)
  const [inspectId, setInspectId] = useState(null)
  const [confirmTarget, setConfirmTarget] = useState(null)
  const [now, setNow] = useState(() => Date.now())
  const [stage, setStage] = useState('need_action')
  const [urgentOnly, setUrgentOnly] = useState(false)
  const [sortBy, setSortBy] = useState('DUE_ASC')
  const [query, setQuery] = useState('')
  const [localNotice, setLocalNotice] = useState(null)

  const [detailId, setDetailId] = useState(null)
  const [disputeTarget, setDisputeTarget] = useState(null)
  const [disputeReasons, setDisputeReasons] = useState(DEFAULT_SHOPEE_DISPUTE_REASONS)
  const [disputeReasonId, setDisputeReasonId] = useState('50')
  const [disputeEmail, setDisputeEmail] = useState('')
  const [disputeText, setDisputeText] = useState('')
  const [disputeProof, setDisputeProof] = useState('')

  const [offerTarget, setOfferTarget] = useState(null)
  const [offerAmount, setOfferAmount] = useState('')
  const [offerReason, setOfferReason] = useState('')

  const action = useApiAction()
  const loader = useCallback(
    signal => shopeeApi.enrichedReturns({ pageNo: page, pageSize: PAGE_SIZE, status: status || undefined }, signal),
    [page, status]
  )
  const resource = useApiResource(loader)
  const warehouse = useApiResource(loadWarehouseReturns)
  const { reload: reloadReturns } = resource
  const { reload: reloadWarehouse } = warehouse
  const reloadAll = useCallback(() => { reloadReturns(); reloadWarehouse() }, [reloadReturns, reloadWarehouse])

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    window.addEventListener('focus', reloadAll)
    return () => window.removeEventListener('focus', reloadAll)
  }, [reloadAll])

  const enriched = useMemo(() => {
    const rawList = resource.data?.returnList || []
    return rawList.map(raw => {
      const r = normalizeShopeeReturn(raw)
      const meta = getReturnMeta(r, now)
      const isDispute = meta.stage === 'dispute'
      return {
        ...r,
        meta,
        isDispute,
        due: getDueBadge(r, now),
      }
    })
  }, [resource.data, now])

  const kpis = useMemo(() => {
    const open = enriched.filter(r => r.meta.stage !== 'completed')
    return {
      needAction: enriched.filter(r => r.meta.stage === 'need_action').length,
      urgentDue: enriched.filter(r => r.due?.urgent).length,
      inTransit: enriched.filter(r => r.meta.inTransit).length,
      dispute: enriched.filter(r => r.isDispute).length,
      openRefundTotal: open.reduce((sum, r) => sum + Number(r.refundAmount || 0), 0),
    }
  }, [enriched])

  const stageCounts = useMemo(() => {
    const counts = { need_action: 0, in_return_transit: 0, dispute: 0, completed: 0, all: 0 }
    for (const r of enriched) {
      counts.all += 1
      if (r.isDispute) counts.dispute += 1
      else if (r.meta.inTransit) counts.in_return_transit += 1
      else if (counts[r.meta.stage] != null) counts[r.meta.stage] += 1
    }
    return counts
  }, [enriched])

  // The newest record wins when several share a return number (records arrive newest first).
  const warehouseByReturn = useMemo(() => {
    const map = new Map()
    for (const record of warehouse.data ?? []) {
      const key = record.external_return_id
      if (key && (!map.has(key) || (pendingInspection(record) && !pendingInspection(map.get(key))))) map.set(key, record)
    }
    return map
  }, [warehouse.data])

  const awaitingCount = enriched.filter(r => pendingInspection(warehouseByReturn.get(r.id))).length

  // Pending inspections with no request on this page would otherwise be unreachable.
  const unmatched = useMemo(() => {
    const shown = new Set(enriched.map(r => warehouseByReturn.get(r.id)?.id))
    return (warehouse.data ?? []).filter(record => pendingInspection(record) && !shown.has(record.id))
  }, [enriched, warehouse.data, warehouseByReturn])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = enriched.filter(r => {
      if (urgentOnly && !r.due?.urgent) return false
      if (awaitingOnly && !pendingInspection(warehouseByReturn.get(r.id))) return false
      if (stage === 'dispute') {
        if (!r.isDispute) return false
      } else if (stage === 'in_return_transit') {
        if (!r.meta.inTransit) return false
      } else if (stage !== 'all' && r.meta.stage !== stage) {
        return false
      }
      if (q) {
        const itemsText = r.items.map(i => `${i.sku} ${i.name}`).join(' ')
        const hay = `${r.id} ${r.orderId} ${r.buyerUsername} ${r.trackingNumber || ''} ${itemsText}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })

    return list.sort((a, b) => {
      if (sortBy === 'DUE_ASC') {
        const aDue = a.due ? (a.disputeDueDate ?? a.dueDate) : Number.MAX_SAFE_INTEGER
        const bDue = b.due ? (b.disputeDueDate ?? b.dueDate) : Number.MAX_SAFE_INTEGER
        if (aDue !== bDue) return aDue - bDue
        return b.createdAt - a.createdAt
      }
      if (sortBy === 'AMOUNT_DESC') return b.refundAmount - a.refundAmount
      return b.createdAt - a.createdAt
    })
  }, [enriched, stage, urgentOnly, awaitingOnly, warehouseByReturn, sortBy, query])

  const detailItem = useMemo(() => enriched.find(r => r.id === detailId) || null, [enriched, detailId])

  function showStage(nextStage, { urgent = false, awaiting = false } = {}) {
    setStage(nextStage)
    setUrgentOnly(urgent)
    setAwaitingOnly(awaiting)
  }

  function changeStatus(value) {
    setStatus(value)
    setPage(1)
    // A status filter would otherwise be filtered again by the stage tab.
    showStage(value ? 'all' : 'need_action')
  }

  async function acceptRefund() {
    const result = await shopeeApi.confirmReturn(confirmTarget.id)
    if (result?.confirmed === false) throw new Error('Shopee did not accept this request.')
    return result
  }

  function openRefundConfirmation(ret) {
    setLocalNotice(null)
    setConfirmTarget(ret)
  }

  function openDisputeModal(ret) {
    setLocalNotice(null)
    setDisputeTarget(ret)
    setDisputeReasonId(ret.solution === 'REFUND' ? '50' : '52')
    setDisputeText('')
    setDisputeProof('')
    shopeeApi.disputeReasons(ret.id)
      .then(list => {
        if (Array.isArray(list) && list.length > 0) {
          setDisputeReasons(list)
        }
      })
      .catch(() => setDisputeReasons(DEFAULT_SHOPEE_DISPUTE_REASONS))
  }

  function submitShopeeDispute(event) {
    event.preventDefault()
    if (!disputeTarget) return
    setLocalNotice(null)
    action.run(
      async () => {
        const proofImages = disputeProof.split('\n').map(s => s.trim()).filter(Boolean)
        if (proofImages.some(url => { try { return !['https:', 'http:'].includes(new URL(url).protocol) } catch { return true } })) {
          throw new Error('Each proof image must be a valid HTTP/HTTPS URL.')
        }
        const result = await shopeeApi.disputeReturn(disputeTarget.id, {
          disputeReasonId: Number(disputeReasonId),
          disputeTextReason: disputeText.trim(),
          email: disputeEmail.trim(),
          proofImages,
        })
        if (result?.disputed === false) throw new Error('Shopee did not accept this dispute.')
        return result
      },
      `Dispute submitted for ${disputeTarget.id}. Shopee reviews it within 3–5 business days.`,
      () => {
        setDisputeTarget(null)
        reloadAll()
      }
    )
  }

  function submitShopeeOffer(event) {
    event.preventDefault()
    if (!offerTarget) return
    const amountNum = Number(offerAmount)
    if (!Number.isFinite(amountNum) || amountNum <= 0 || amountNum > Number(offerTarget.refundAmount || 0)) {
      setLocalNotice({ error: true, message: `The offer must be above 0 and at most ${money(offerTarget.refundAmount)}.` })
      return
    }
    setLocalNotice(null)
    action.run(
      async () => {
        const result = await shopeeApi.offerReturn(offerTarget.id, {
          offerAmount: amountNum,
          offerReason: offerReason.trim() || 'The seller proposes a partial refund without returning the item',
        })
        if (result?.offered === false) throw new Error('Shopee did not accept this counter-offer.')
        return result
      },
      `Counter-offer of ${money(amountNum)} sent for ${offerTarget.id}.`,
      () => {
        setOfferTarget(null)
        reloadAll()
      }
    )
  }

  return (
    <div className={demo.hub}>
      <OwnerPanel title="Returns &amp; refunds overview">
        <KpiGrid cards={[
          { label: 'Needs action', value: kpis.needAction, hint: 'Accept the refund or dispute it', icon: AlertTriangle, color: '#dc2626', tone: 'kpiAction', active: stage === 'need_action' && !urgentOnly, onClick: () => showStage('need_action') },
          { label: 'Dispute due (within 2 days)', value: kpis.urgentDue, hint: 'Disputes close after 2 days', icon: Clock, color: '#d97706', tone: 'kpiUrgent', active: urgentOnly, onClick: () => showStage('all', { urgent: !urgentOnly }) },
          { label: 'Returning to shop', value: kpis.inTransit, hint: 'Track return parcels from carriers', icon: Truck, color: '#2563eb', tone: 'kpiWarehouse', active: stage === 'in_return_transit', onClick: () => showStage('in_return_transit') },
          { label: 'Awaiting inspection', value: warehouse.data ? awaitingCount : '—', hint: 'Warehouse checks still pending', icon: PackageCheck, color: '#2563eb', tone: 'kpiWarehouse', active: awaitingOnly, onClick: () => showStage('all', { awaiting: !awaitingOnly }) },
          { label: 'In dispute (3–5 days)', value: kpis.dispute, hint: 'Waiting for the marketplace ruling', icon: Scale, color: '#7c3aed', tone: 'kpiDispute', active: stage === 'dispute', onClick: () => showStage('dispute') },
          { label: 'Open refund value', value: money(kpis.openRefundTotal), hint: 'Value of requests not yet closed', icon: ShieldAlert, tone: 'kpiTotal', active: stage === 'all' && !urgentOnly && !awaitingOnly, onClick: () => showStage('all') },
        ]} />
      </OwnerPanel>

      <OwnerPanel title="Return &amp; refund requests">
        <StageTabs tabs={STAGE_TABS} stage={stage} counts={stageCounts} onSelect={id => showStage(id)} />

        <div className={styles.filters}>
          {sourceSelect}

          <label className={styles.field}>
            Return status
            <select value={status} onChange={e => changeStatus(e.target.value)}>
              <option value="">All statuses</option>
              {RETURN_STATUSES.map(value => <option key={value}>{value}</option>)}
            </select>
          </label>

          <label className={styles.field}>
            Sort by
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="DUE_ASC">Nearest dispute deadline</option>
              <option value="NEWEST">Newest</option>
              <option value="AMOUNT_DESC">Highest refund</option>
            </select>
          </label>

          <label className={styles.field}>
            Quick search
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Return, order, buyer or SKU"
            />
          </label>

          <div className={styles.actions}>
            <Button size="sm" variant="outline" disabled={resource.loading || action.busy} onClick={reloadAll}>
              <RefreshCw size={14} /> {resource.loading ? 'Loading…' : 'Refresh returns'}
            </Button>
          </div>
        </div>

        <Feedback value={localNotice || action.feedback} />
        {warehouse.error && (
          <>
            <Feedback value={{ error: true, message: `Warehouse inspections could not be loaded: ${warehouse.error}` }} />
            <Button size="sm" variant="outline" onClick={warehouse.reload}>Retry inspections</Button>
          </>
        )}
        <ResourceState resource={resource} />

        {!resource.loading && !resource.error && (visible.length ? (
          <DataTable
            label="Shopee return requests"
            headings={['Return / Channel', 'Returned items', 'Refund', 'Status & deadline', 'Reason / Notes', 'Warehouse inspection', 'Actions']}
          >
            {visible.map(ret => {
              const shownItems = ret.items.slice(0, MAX_VISIBLE_ITEMS)
              const extraCount = ret.items.length - shownItems.length
              const record = warehouseByReturn.get(ret.id)
              const rowCls = ret.isDispute ? demo.rowDispute : ret.due?.urgent ? demo.rowUrgent : ''
              return (
                <tr key={ret.id} className={rowCls}>
                  <td>
                    <strong>{ret.id}</strong>
                    <p className={styles.note}>Order: {ret.orderId}</p>
                    <p>
                      <span className={`${demo.channelBadge} ${demo.channelShopee}`}>Shopee</span>
                      <span className={demo.typeBadge}>
                        {ret.solution === 'REFUND' ? 'Refund only' : 'Return & refund'}
                      </span>
                    </p>
                    <p className={styles.note}>Buyer: {ret.buyerUsername}</p>
                  </td>
                  <td>
                    <div className={demo.itemPreview}>
                      {shownItems.length ? shownItems.map((item, idx) => (
                        <div key={idx}>
                          <strong>{item.qty}×</strong>{' '}
                          <span className={demo.itemName} title={item.name}>{item.name}</span>
                          <div className={demo.skuCode}>{item.sku} · {item.variant}</div>
                        </div>
                      )) : <span className={styles.note}>—</span>}
                      {extraCount > 0 && (
                        <button type="button" className={demo.moreItemsBtn} onClick={() => setDetailId(ret.id)}>
                          … (+{extraCount} more items)
                        </button>
                      )}
                    </div>
                  </td>
                  <td>
                    <strong style={{ whiteSpace: 'nowrap' }}>{money(ret.refundAmount)}</strong>
                    {ret.reverseShippingFee > 0 && <p className={styles.note}>Return shipping: {money(ret.reverseShippingFee)}</p>}
                  </td>
                  <td>
                    <span className={`${demo.statusBadge} ${demo[ret.meta.cls]}`}>{ret.meta.label}</span>
                    {ret.rawStatus === 'PROCESSING' && ret.needsLogistics && !ret.reverseDeliveredAt && (
                      <p className={styles.note}>
                        Buyer is returning the item.
                        {ret.expectedReturnDate
                          ? ` Expected: ${dateTime(ret.expectedReturnDate)}`
                          : ret.buyerReturnDueDate
                            ? ` Ship by: ${dateTime(ret.buyerReturnDueDate)}`
                            : ''}
                      </p>
                    )}
                    {ret.negotiationStatus === 'PENDING_BUYER_RESPOND' && (
                      <p className={styles.note}>
                        Offer pending buyer{ret.offerAmount ? ` ${money(ret.offerAmount)}` : ''}
                      </p>
                    )}
                    {ret.due && (
                      <p>
                        <span className={`${demo.slaBadge} ${demo[ret.due.cls]}`}>
                          <Clock size={11} /> {ret.due.label}
                        </span>
                      </p>
                    )}
                    {(ret.disputeDueDate || ret.dueDate) && ret.due && <p className={styles.note}>Due: {dateTime(ret.disputeDueDate ?? ret.dueDate)}</p>}
                    {ret.trackingNumber && <p className={styles.note}>Return tracking: <strong>{ret.trackingNumber}</strong></p>}
                  </td>
                  <td>
                    <span>{ret.reasonText || ret.reason}</span>
                    {ret.isNfrExempt && (
                      <p>
                        <span className={`${demo.statusBadge} ${demo.statusSuccess}`}>NFR exempt</span>
                      </p>
                    )}
                    {ret.rulingNotes && <p className={styles.note}>{ret.rulingNotes}</p>}
                  </td>
                  <td>
                    {warehouse.loading ? 'Loading…' : warehouse.error ? 'Unavailable' : record ? inspectionLabel(record) : '—'}
                  </td>
                  <td>
                    <div className={demo.compactActions}>
                      {ret.meta.canConfirmReceipt && (
                        <Button disabled={action.busy} onClick={() => openRefundConfirmation(ret)}>
                          Accept refund
                        </Button>
                      )}
                      {ret.meta.canOffer && (
                        <Button size="sm" variant="outline" disabled={action.busy} onClick={() => {
                          setOfferTarget(ret)
                          setOfferAmount(String(Math.max(1, Math.round(Number(ret.refundAmount || 0) * 0.5))))
                          setOfferReason('')
                        }}>
                          Propose partial refund
                        </Button>
                      )}
                      {ret.meta.canDispute && (
                        <Button size="sm" variant="outline" disabled={action.busy} onClick={() => openDisputeModal(ret)}>
                          Dispute return
                        </Button>
                      )}
                      {record && (
                        <Button size="sm" variant="outline" onClick={() => setInspectId(record.id)}>
                          {pendingInspection(record) ? 'Inspect' : 'View inspection'}
                        </Button>
                      )}
                      <Button variant="outline" onClick={() => setDetailId(ret.id)}>Review return</Button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </DataTable>
        ) : (
          <p className={styles.empty}>No returns match your filters.</p>
        ))}
        {!resource.loading && !resource.error && (page > 1 || resource.data?.more) && (
          <div className={`${styles.actions} ${styles.pagination}`}>
            <Button variant="secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous page</Button>
            <span>Page {page} · {resource.data?.total || 0} returns · Counts and filters apply to this page</span>
            <Button variant="secondary" disabled={!resource.data?.more} onClick={() => setPage(page + 1)}>Next page</Button>
          </div>
        )}
      </OwnerPanel>

      {!resource.loading && unmatched.length > 0 && (
        <OwnerPanel title="Unmatched warehouse returns">
          <p className={styles.note}>Pending inspections that have no matching request on this page.</p>
          <DataTable label="Unmatched warehouse returns" headings={['Return', 'Order', 'Status', 'Action']}>
            {unmatched.map(item => (
              <tr key={item.id}>
                <td>{item.external_return_id || item.id}</td>
                <td>{item.platform_order_id || item.order_id}</td>
                <td>{item.status}</td>
                <td><Button variant="outline" onClick={() => setInspectId(item.id)}>Inspect</Button></td>
              </tr>
            ))}
          </DataTable>
        </OwnerPanel>
      )}

      {inspectId !== null && <InspectionDialog key={inspectId} returnId={inspectId} close={() => setInspectId(null)} reload={reloadAll} />}

      {confirmTarget && (
        <ConfirmationDialog
          title="Accept refund"
          description={`Confirm acceptance of return ${confirmTarget.id} with a refund of ${money(confirmTarget.refundAmount)}?`}
          submit={acceptRefund}
          close={() => setConfirmTarget(null)}
          done={() => {
            setLocalNotice({ message: `Refund accepted for Shopee return ${confirmTarget.id}.` })
            setConfirmTarget(null)
            reloadAll()
          }}
        />
      )}

      {/* Modal: return detail */}
      <Dialog open={Boolean(detailItem)} onOpenChange={open => { if (!open) setDetailId(null) }}>
        <DialogContent className={`${styles.dialog} ${styles.marketplaceDialog} ${demo.detailDialog}`}>
          <DialogTitle>Return {detailItem?.id}</DialogTitle>
          <DialogDescription>
            Shopee · Order {detailItem?.orderId} · {detailItem?.meta.label}
          </DialogDescription>
          {detailItem && (
            <>
              <div className={demo.detailMeta}>
                <div>Buyer<strong>{detailItem.buyerUsername}</strong><span>{detailItem.solution === 'REFUND' ? 'Refund only (no return)' : 'Return & refund'}</span></div>
                <div>Refund amount<strong>{money(detailItem.refundAmount)}</strong><span>Return shipping: {money(detailItem.reverseShippingFee)}</span></div>
                <div>Return tracking<strong>{detailItem.trackingNumber || 'None'}</strong><span>{detailItem.due ? detailItem.due.label : '—'}</span></div>
              </div>
              <p><strong>Reason:</strong> {detailItem.reasonText} ({detailItem.reason}){detailItem.isNfrExempt ? ' · NFR exempt' : ''}</p>
              {detailItem.rulingNotes && <p className={demo.noteBox}>{detailItem.rulingNotes}</p>}
              <DataTable label="Returned items" headings={['SKU / Item', 'Qty', 'Unit price', 'Refund']}>
                {detailItem.items.map((item, idx) => (
                  <tr key={idx}>
                    <td><strong>{item.name}</strong><p className={demo.skuCode}>{item.sku} · {item.variant}</p></td>
                    <td>{item.qty}</td>
                    <td>{money(item.price)}</td>
                    <td>{money(item.refundAmount)}</td>
                  </tr>
                ))}
              </DataTable>
              <div>
                <strong>Buyer evidence:</strong>
                {detailItem.buyerProofImages.length ? (
                  <ul className={demo.proofList}>
                    {detailItem.buyerProofImages.map((url, i) => (
                      <li key={i}><a href={url} target="_blank" rel="noreferrer">Proof image {i + 1}</a></li>
                    ))}
                  </ul>
                ) : <p className={styles.note}>No buyer proof images supplied.</p>}
              </div>
              {detailItem.sellerProofImages.length > 0 && (
                <div>
                  <strong>Seller evidence:</strong>
                  <ul className={demo.proofList}>
                    {detailItem.sellerProofImages.map((url, i) => (
                      <li key={i}><a href={url} target="_blank" rel="noreferrer">Seller image {i + 1}</a></li>
                    ))}
                  </ul>
                </div>
              )}
              <div>
                <strong>Processing history:</strong>
                <ul className={demo.timeline}>
                  {detailItem.records.map((rec, i) => (
                    <li key={i}>{dateTime(rec.at)} · <strong>{rec.actor}</strong>: {rec.note}</li>
                  ))}
                </ul>
              </div>
              <div className={styles.actions}>
                {detailItem.meta.canConfirmReceipt && (
                  <Button disabled={action.busy} onClick={() => { openRefundConfirmation(detailItem); setDetailId(null) }}>
                    Accept refund
                  </Button>
                )}
                {detailItem.meta.canDispute && (
                  <Button size="sm" variant="outline" disabled={action.busy} onClick={() => {
                    const target = detailItem
                    setDetailId(null)
                    openDisputeModal(target)
                  }}>
                    Dispute return
                  </Button>
                )}
                <Button variant="secondary" onClick={() => setDetailId(null)}>Close</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal: Shopee dispute (reasons 47..52) */}
      <Dialog open={Boolean(disputeTarget)} onOpenChange={open => { if (!open && !action.busy) setDisputeTarget(null) }}>
        <DialogContent className={`${styles.dialog} ${styles.marketplaceDialog}`}>
          <DialogTitle>Dispute the Shopee return</DialogTitle>
          <DialogDescription>
            Return {disputeTarget?.id} · Shopee reviews and replies within 3–5 business days
          </DialogDescription>
          <form className={styles.form} onSubmit={submitShopeeDispute}>
            <label className={styles.field}>
              Shopee dispute reason
              <select value={disputeReasonId} disabled={action.busy} onChange={e => setDisputeReasonId(e.target.value)}>
                {disputeReasons.map(r => (
                  <option key={r.disputeReasonId} value={r.disputeReasonId}>#{r.disputeReasonId} · {r.disputeName}</option>
                ))}
              </select>
            </label>
            <p className={styles.note}>
              {disputeReasons.find(r => String(r.disputeReasonId) === String(disputeReasonId))?.disputeRequirement || ''}
            </p>
            <label className={styles.field}>
              Dispute explanation
              <textarea required maxLength={2000} disabled={action.busy} value={disputeText} onChange={e => setDisputeText(e.target.value)} placeholder="Describe the returned item or why you disagree with the refund..." />
            </label>
            <label className={styles.field}>
              Contact email
              <input required type="email" disabled={action.busy} value={disputeEmail} onChange={e => setDisputeEmail(e.target.value)} />
            </label>
            <label className={styles.field}>
              Upload proof image (.jpg, .png)
              <input
                type="file"
                accept="image/jpeg,image/png"
                disabled={action.busy}
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (!file) return
                  await action.run(async () => {
                    const res = await shopeeApi.convertReturnImage(file, disputeTarget?.id)
                    if (!res?.url) throw new Error('Image upload did not return a URL.')
                    setDisputeProof(prev => (prev.trim() ? `${prev.trim()}\n${res.url}` : res.url))
                    return res
                  }, 'Proof image uploaded.')
                }}
              />
            </label>
            <label className={styles.field}>
              Proof image URLs (one URL per line)
              <textarea required disabled={action.busy} value={disputeProof} onChange={e => setDisputeProof(e.target.value)} />
            </label>
            <Feedback value={action.feedback} />
            <div className={styles.actions}>
              <Button type="button" variant="secondary" disabled={action.busy} onClick={() => setDisputeTarget(null)}>Back</Button>
              <Button type="submit" disabled={action.busy}>{action.busy ? 'Submitting…' : 'Submit dispute'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Shopee partial refund offer */}
      <Dialog open={Boolean(offerTarget)} onOpenChange={open => { if (!open && !action.busy) setOfferTarget(null) }}>
        <DialogContent className={`${styles.dialog} ${styles.marketplaceDialog}`}>
          <DialogTitle>Propose partial refund</DialogTitle>
          <DialogDescription>
            Return {offerTarget?.id} · Maximum: {money(offerTarget?.refundAmount)} (no item return)
          </DialogDescription>
          <form className={styles.form} onSubmit={submitShopeeOffer}>
            <label className={styles.field}>
              Offer amount (VND)
              <input
                required
                type="number"
                min="1"
                max={Number(offerTarget?.refundAmount || 0)}
                step="1"
                disabled={action.busy}
                value={offerAmount}
                onChange={e => setOfferAmount(e.target.value)}
              />
            </label>
            <label className={styles.field}>
              Offer reason
              <textarea
                maxLength={500}
                disabled={action.busy}
                value={offerReason}
                onChange={e => setOfferReason(e.target.value)}
                placeholder="Propose partial refund without returning item..."
              />
            </label>
            <Feedback value={action.feedback} />
            <div className={styles.actions}>
              <Button type="button" variant="secondary" disabled={action.busy} onClick={() => setOfferTarget(null)}>Cancel</Button>
              <Button type="submit" disabled={action.busy}>{action.busy ? 'Submitting…' : 'Send counter-offer'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
