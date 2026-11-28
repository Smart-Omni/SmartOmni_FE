import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock, PackageCheck, Printer, RefreshCw, Truck } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { shopeeApi } from '@/services/api/shopee'
import { tiktokApi } from '@/services/api/tiktok'
import { DataTable, Feedback, OwnerPanel } from '@/features/portal/components/OwnerWorkspaceUI'
import { useApiResource } from './useApiResource'
import { ResourceState } from './ShopeeShared'
import { dateTime, money, useApiAction } from './apiHelpers'
import styles from '@/features/portal/OwnerWorkspace.module.css'
import demo from './OrderHubDemo.module.css'
import { maskAddress, maskPhone } from './orderPrivacy'
import { isTiktokShopDisconnected } from './marketplaces'
import { downloadTiktokLabel, loadTiktokHub, normalizeTiktokOrders } from './tiktokOrderHub'
import {
  TiktokBatchShipDialog,
  TiktokBuyerCancelDialog,
  TiktokCancelDialog,
  TiktokDetailTools,
  TiktokEscrowDialog,
  TiktokShipDialog,
} from './TiktokOrderDialogs'

const HOUR_MS = 3_600_000
const MINUTE_MS = 60_000
const PICKUP_STUCK_HOURS = 24
const TRANSIT_STUCK_HOURS = 72
const MAX_VISIBLE_ITEMS = 2
const CHANNELS = { SHOPEE: 'Shopee', TIKTOK: 'TikTok Shop' }
const HANDOVER_STORAGE_KEY = 'smartomni_shopee_handovers_v1'

function loadHandoverMap() {
  try {
    const raw = localStorage.getItem(HANDOVER_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

const STATUS_META = {
  UNPAID: { label: 'Awaiting payment', cls: 'statusPending', stage: 'all', canCancel: true },
  READY_TO_SHIP: { label: 'Awaiting preparation', cls: 'statusToShip', stage: 'to_prepare', canPrepare: true, canCancel: true },
  PROCESSED: { label: 'Prepared · Awaiting handover', cls: 'statusProcessed', stage: 'ready_pickup', hasLabel: true, canHandover: true },
  IN_CANCEL: { label: 'Buyer requested cancellation', cls: 'statusInCancel', stage: 'cancel_request', isCancelReq: true },
  SHIPPED: { label: 'Shipping', cls: 'statusShipping', stage: 'shipping', hasLabel: true },
  TO_CONFIRM_RECEIVE: { label: 'Awaiting receipt confirmation', cls: 'statusShipping', stage: 'shipping', hasLabel: true },
  COMPLETED: { label: 'Completed', cls: 'statusDone', stage: 'completed' },
  CANCELLED: { label: 'Cancelled', cls: 'statusDone', stage: 'cancelled' },
  TO_RETURN: { label: 'Return requested', cls: 'statusInCancel', stage: 'returned' },
}

const STAGE_TABS = [
  { id: 'to_prepare', label: 'To prepare' },
  { id: 'ready_pickup', label: 'Awaiting pickup' },
  { id: 'stuck', label: 'Stuck / Possibly lost' },
  { id: 'cancel_request', label: 'Cancellation requests' },
  { id: 'shipping', label: 'Shipping' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'returned', label: 'Returns / Refunds' },
  { id: 'all', label: 'All orders' },
]

function normalizeShopeeOrder(raw, packedSet, handoverMap = {}) {
  const sn = raw.orderSn || raw.platformOrderId || raw.id
  const items = (raw.items || []).map(item => ({
    sku: item.modelSku || item.itemSku || String(item.modelId || item.itemId || '—'),
    name: item.itemName || 'Shopee product',
    variant: item.modelName || 'Default',
    qty: item.quantityPurchased ?? 1,
    price: item.discountedPrice ?? item.originalPrice ?? 0,
  }))
  const createdAt = raw.createTime ? raw.createTime * 1000 : Date.now()
  const updatedAt = raw.updateTime ? raw.updateTime * 1000 : createdAt
  const deadlineAt = raw.shipByDate ? raw.shipByDate * 1000 : null

  const logisticsStatus = raw.logisticsStatus || ''
  const handedOver = Boolean(handoverMap[sn]) || logisticsStatus === 'LOGISTICS_HANDED_OVER'
  const paymentRaw = String(raw.paymentMethod || '').toLowerCase()
  const paymentLabel = (raw.cod === true || paymentRaw.includes('cod') || paymentRaw.includes('cash'))
    ? 'Cash on delivery (COD)'
    : (raw.cod === false || paymentRaw ? 'ShopeePay wallet' : '')
  const cancelReasonText = raw.buyerCancelReason || raw.cancelReason
  const cancelRespondBy = raw.cancelRespondBy ? raw.cancelRespondBy * 1000 : null

  return {
    id: sn,
    channel: 'SHOPEE',
    rawStatus: raw.orderStatus || raw.status || 'UNPAID',
    logisticsStatus,
    handedOver,
    paymentLabel,
    buyerName: raw.recipientAddress?.name || raw.buyerUsername || 'Shopee buyer',
    buyerPhone: maskPhone(raw.recipientAddress?.phone),
    shippingAddress: maskAddress(raw.recipientAddress?.fullAddress),
    buyerNote: cancelReasonText ? `Cancellation reason: ${cancelReasonText}` : '',
    carrier: raw.shippingCarrier || 'Shopee carrier',
    trackingNumber: raw.trackingNo || raw.trackingNumber || '',
    createdAt,
    updatedAt,
    handoverAt: handoverMap[sn] || (logisticsStatus === 'LOGISTICS_HANDED_OVER' ? updatedAt : null),
    cancelRespondBy,
    deadlineAt,
    totalAmount: raw.totalAmount ?? 0,
    packed: packedSet.has(sn) || ['PROCESSED', 'SHIPPED', 'TO_CONFIRM_RECEIVE', 'COMPLETED'].includes(raw.orderStatus),
    items,
  }
}

function getStuckInfo(order, now) {
  const tiktok = order.channel === 'TIKTOK'
  if (order.rawStatus === (tiktok ? 'AWAITING_COLLECTION' : 'PROCESSED')) {
    if (!order.handoverAt) return null
    const idleHours = Math.floor(Math.max(0, now - order.handoverAt) / HOUR_MS)
    if (idleHours >= PICKUP_STUCK_HOURS) {
      return {
        kind: 'pickup',
        idleHours,
        lastUpdate: order.handoverAt,
        reason: `Carrier has not picked up ${idleHours}h after ${tiktok ? 'ready to ship' : 'handover'} (threshold ${PICKUP_STUCK_HOURS}h)`,
        badge: `Pickup waiting ${idleHours}h`,
      }
    }
    return null
  }
  const lastUpdate = order.updatedAt || order.createdAt
  const idleHours = Math.floor(Math.max(0, now - lastUpdate) / HOUR_MS)
  const inTransit = tiktok ? ['IN_TRANSIT', 'PARTIALLY_SHIPPING'] : ['SHIPPED', 'TO_CONFIRM_RECEIVE']
  if (inTransit.includes(order.rawStatus) && idleHours >= TRANSIT_STUCK_HOURS) {
    return {
      kind: 'transit',
      idleHours,
      lastUpdate,
      reason: `No tracking update for ${idleHours}h (threshold ${TRANSIT_STUCK_HOURS}h)`,
      badge: `Idle ${idleHours}h · Possibly lost`,
    }
  }
  return null
}

function getSlaStatus(order, now) {
  const meta = order.meta || STATUS_META[order.rawStatus] || {}
  const targetDeadline = order.rawStatus === 'IN_CANCEL' && order.cancelRespondBy
    ? order.cancelRespondBy
    : order.deadlineAt
  if ((!meta.canPrepare && !meta.isCancelReq) || !targetDeadline) return null
  const diff = targetDeadline - now
  if (diff < 0) {
    const absMins = Math.abs(Math.round(diff / MINUTE_MS))
    const hrs = Math.floor(absMins / 60)
    const mins = absMins % 60
    return {
      bucket: 'overdue',
      diff,
      cls: 'slaOverdue',
      rowCls: 'rowOverdue',
      label: hrs > 0 ? `Overdue ${hrs}h ${mins}m` : `Overdue ${mins}m`,
    }
  }
  const totalMins = Math.max(1, Math.round(diff / MINUTE_MS))
  const hrs = Math.floor(totalMins / 60)
  const mins = totalMins % 60
  if (diff <= 6 * HOUR_MS) {
    return {
      bucket: 'critical',
      diff,
      cls: 'slaCritical',
      rowCls: 'rowUrgent',
      label: hrs > 0 ? `${hrs}h ${mins}m left` : `${mins}m left`,
    }
  }
  if (diff <= 24 * HOUR_MS) {
    return {
      bucket: 'today',
      diff,
      cls: 'slaSoon',
      rowCls: '',
      label: `${hrs}h ${mins}m left`,
    }
  }
  return {
    bucket: 'normal',
    diff,
    cls: 'slaOk',
    rowCls: '',
    label: `${hrs}h left`,
  }
}

export default function OrderHubDemo() {
  const [searchParams] = useSearchParams()
  const [channel, setChannel] = useState(() => searchParams.get('source') === 'tiktok' ? 'TIKTOK' : 'SHOPEE')
  // Keyed by channel so filters, selections, dialogs and notices never carry over between marketplaces.
  return <ChannelOrderHub key={channel} channel={channel} setChannel={setChannel} />
}

function ChannelOrderHub({ channel, setChannel }) {
  const tiktok = channel === 'TIKTOK'
  const channelName = CHANNELS[channel]
  const navigate = useNavigate()
  const [pageTokens, setPageTokens] = useState([null])
  const pageToken = pageTokens[pageTokens.length - 1]
  const [stage, setStage] = useState('to_prepare')
  const [slaFilter, setSlaFilter] = useState('ALL')
  const [sortBy, setSortBy] = useState('SLA_ASC')
  const [query, setQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [packedIds, setPackedIds] = useState(() => new Set())
  const [handoverMap, setHandoverMap] = useState(() => loadHandoverMap())
  const [localNotice, setLocalNotice] = useState(null)
  const [now, setNow] = useState(() => Date.now())

  const [detailOrderId, setDetailOrderId] = useState(null)
  const [shipOrderSn, setShipOrderSn] = useState(null)
  const [batchShipSns, setBatchShipSns] = useState([])
  const [pickingOpen, setPickingOpen] = useState(false)
  const [escrowOrderSn, setEscrowOrderSn] = useState(null)
  const [cancelOrderSn, setCancelOrderSn] = useState(null)
  const [cancelReviewOrderSn, setCancelReviewOrderSn] = useState(null)
  const [cancelRequest, setCancelRequest] = useState(null)
  const [supportOrder, setSupportOrder] = useState(null)

  const action = useApiAction()
  const loader = useCallback(
    signal => (tiktok
      ? loadTiktokHub(pageToken, signal)
      : shopeeApi.ordersPage({ pageSize: 50, cursor: pageToken || undefined }, signal)),
    [tiktok, pageToken]
  )
  const resource = useApiResource(loader)

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    window.addEventListener('focus', resource.reload)
    return () => window.removeEventListener('focus', resource.reload)
  }, [resource.reload])

  const markHandover = useCallback((orderSn) => {
    action.run(
      () => shopeeApi.handoverOrder(orderSn),
      `Order ${orderSn} handed over to the carrier. It moves to "Shipping" when the carrier picks it up.`,
      () => {
        const ts = Date.now()
        setHandoverMap(prev => {
          const next = { ...prev, [orderSn]: ts }
          try { localStorage.setItem(HANDOVER_STORAGE_KEY, JSON.stringify(next)) } catch { /* ignore */ }
          return next
        })
        resource.reload()
      }
    )
  }, [action, resource])

  const enriched = useMemo(() => {
    if (tiktok) {
      return normalizeTiktokOrders(resource.data, packedIds).map(order => ({
        ...order,
        // TikTok gives no response deadline for cancellations, so only orders to prepare carry a ship deadline.
        sla: order.meta.canPrepare ? getSlaStatus(order, now) : null,
        stuck: getStuckInfo(order, now),
      }))
    }
    const rawList = Array.isArray(resource.data?.orders)
      ? resource.data.orders
      : (Array.isArray(resource.data) ? resource.data : [])
    return rawList.map(raw => {
      const order = normalizeShopeeOrder(raw, packedIds, handoverMap)
      const baseMeta = STATUS_META[order.rawStatus] || { label: order.rawStatus, cls: 'statusDone', stage: 'all' }
      const meta = order.rawStatus === 'PROCESSED'
        ? (order.handedOver
          ? { ...baseMeta, label: 'Handed over (awaiting pickup)', canHandover: false, canCancel: false }
          : { ...baseMeta, canCancel: true })
        : baseMeta
      return {
        ...order,
        meta,
        sla: getSlaStatus({ ...order, meta }, now),
        stuck: getStuckInfo(order, now),
      }
    })
  }, [tiktok, resource.data, packedIds, handoverMap, now])

  const kpis = useMemo(() => {
    const toPrepare = enriched.filter(o => o.meta.canPrepare)
    return {
      overdue: toPrepare.filter(o => o.sla?.bucket === 'overdue').length,
      critical: toPrepare.filter(o => o.sla?.bucket === 'critical').length,
      today: toPrepare.filter(o => ['overdue', 'critical', 'today'].includes(o.sla?.bucket)).length,
      stuck: enriched.filter(o => Boolean(o.stuck)).length,
      totalPrepare: toPrepare.length,
    }
  }, [enriched])

  const stageCounts = useMemo(() => {
    const counts = { to_prepare: 0, ready_pickup: 0, stuck: 0, cancel_request: 0, shipping: 0, completed: 0, cancelled: 0, returned: 0, all: 0 }
    for (const order of enriched) {
      counts.all += 1
      if (order.stuck) counts.stuck += 1
      if (order.meta.stage && counts[order.meta.stage] != null) counts[order.meta.stage] += 1
    }
    return counts
  }, [enriched])

  const visibleOrders = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = enriched.filter(order => {
      if (stage === 'stuck') {
        if (!order.stuck) return false
      } else if (stage !== 'all' && order.meta.stage !== stage) {
        return false
      }
      if (slaFilter === 'OVERDUE' && order.sla?.bucket !== 'overdue') return false
      if (slaFilter === 'CRITICAL' && order.sla?.bucket !== 'critical') return false
      if (slaFilter === 'TODAY' && !['overdue', 'critical', 'today'].includes(order.sla?.bucket)) return false
      if (q) {
        const skuText = order.items.map(i => `${i.sku} ${i.name}`).join(' ')
        const haystack = `${order.id} ${order.buyerName} ${order.trackingNumber || ''} ${skuText}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })

    return filtered.sort((a, b) => {
      if (stage === 'stuck') {
        return (b.stuck?.idleHours || 0) - (a.stuck?.idleHours || 0)
      }
      if (stage === 'cancel_request') {
        const aExp = a.cancelRespondBy ?? Number.MAX_SAFE_INTEGER
        const bExp = b.cancelRespondBy ?? Number.MAX_SAFE_INTEGER
        return aExp - bExp
      }
      if (sortBy === 'SLA_ASC') {
        const aDiff = a.sla ? a.sla.diff : Number.MAX_SAFE_INTEGER
        const bDiff = b.sla ? b.sla.diff : Number.MAX_SAFE_INTEGER
        if (aDiff !== bDiff) return aDiff - bDiff
        return b.createdAt - a.createdAt
      }
      if (sortBy === 'AMOUNT_DESC') return b.totalAmount - a.totalAmount
      return b.createdAt - a.createdAt
    })
  }, [enriched, stage, slaFilter, sortBy, query])

  // Orders waiting to ship without any deadline mean the backend does not return it, so a count of 0 would mislead.
  const noTiktokDeadlines = tiktok && enriched.some(o => o.meta.canPrepare) && !enriched.some(o => o.deadlineAt)
  const noDeadlineHint = 'TikTok has not returned ship deadlines yet'

  const detailOrder = useMemo(
    () => enriched.find(o => o.id === detailOrderId) || null,
    [enriched, detailOrderId]
  )

  const selectedOrders = useMemo(
    () => enriched.filter(o => selectedIds.has(o.id)),
    [enriched, selectedIds]
  )

  const pickingItems = useMemo(() => {
    const targetOrders = selectedOrders.length ? selectedOrders : visibleOrders.filter(o => o.meta.canPrepare)
    const map = new Map()
    for (const order of targetOrders) {
      for (const item of order.items) {
        const key = `${item.sku}::${item.variant}`
        const current = map.get(key) || { sku: item.sku, name: item.name, variant: item.variant, totalQty: 0, orderIds: [] }
        current.totalQty += item.qty
        current.orderIds.push(`${order.id} (×${item.qty})`)
        map.set(key, current)
      }
    }
    return { orders: targetOrders, rows: Array.from(map.values()) }
  }, [selectedOrders, visibleOrders])

  function toggleSelect(id) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectUrgentOrders() {
    const urgentIds = visibleOrders
      .filter(o => o.meta.canPrepare && ['overdue', 'critical'].includes(o.sla?.bucket))
      .map(o => o.id)
    setSelectedIds(new Set(urgentIds))
    setLocalNotice({
      message: urgentIds.length
        ? `Selected ${urgentIds.length} urgent orders to process now.`
        : 'No orders are overdue or due within 6 hours.',
    })
  }

  function markPickedOrders() {
    const next = new Set(packedIds)
    pickingItems.orders.forEach(o => next.add(o.id))
    setPackedIds(next)
    setPickingOpen(false)
    setLocalNotice({ message: `Marked ${pickingItems.orders.length} orders as picked and packed.` })
  }

  async function downloadAwb(order) {
    const orderSn = order.id
    await action.run(async () => {
      const pdf = await (tiktok ? downloadTiktokLabel(order) : shopeeApi.awb(orderSn))
      const url = URL.createObjectURL(pdf)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `AWB-${orderSn.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`
      anchor.click()
      setTimeout(() => URL.revokeObjectURL(url), 30_000)
    }, `Downloaded shipping label AWB-${orderSn}.pdf from ${channelName}.`)
  }

  function syncOrders() {
    if (!tiktok) {
      return action.run(
        () => shopeeApi.batchSync({ pageSize: 50 }),
        result => `Sync requested for ${result.length} Shopee orders.`,
        () => { setPageTokens([null]); resource.reload() }
      )
    }
    const toDate = Math.floor(Date.now() / 1000)
    return action.run(
      () => tiktokApi.syncOrders({ fromDate: toDate - 7 * 86400, toDate }),
      result => result?.enqueuedCount != null
        ? `Queued ${result.enqueuedCount}/${result.totalFetched} TikTok orders for sync${result.failedCount ? ` · Failed: ${result.failedCount}` : ''}.`
        : `Synced ${result?.totalFetched ?? 0} TikTok orders.`,
      () => { setPageTokens([null]); resource.reload() }
    )
  }

  function finishTiktokAction(message, close) {
    close(null)
    setLocalNotice({ message })
    resource.reload()
  }

  function finishBatch(res) {
    setSelectedIds(new Set())
    setBatchShipSns([])
    setLocalNotice({
      message: res?.failed?.length
        ? `Confirmed ${res.ok}/${batchShipSns.length} orders. Errors: ${res.failed.join('; ')}`
        : `Arranged shipment for ${res?.ok ?? batchShipSns.length} orders on ${channelName}.`,
    })
    resource.reload()
  }

  function changePage(tokens) {
    setSelectedIds(new Set())
    setPageTokens(tokens)
  }

  const supportText = supportOrder
    ? `Please urgently check order ${supportOrder.id} (channel ${channelName}, tracking number ${supportOrder.trackingNumber || 'not assigned'} via ${supportOrder.carrier}). The status "${supportOrder.meta.label}" has not changed since ${dateTime(supportOrder.stuck?.lastUpdate)} (${supportOrder.stuck?.idleHours} hours). Please verify the parcel and handle a possible loss.`
    : ''
  const disconnected = tiktok && isTiktokShopDisconnected(resource)
  const nextPageToken = tiktok
    ? resource.data?.nextPageToken
    : (resource.data?.more && resource.data?.nextCursor ? resource.data.nextCursor : null)
  const slaCards = [
    { id: 'OVERDUE', label: 'Overdue', Icon: AlertTriangle, color: '#dc2626', cls: demo.kpiOverdue, value: kpis.overdue, hint: 'Ship now to avoid auto-cancellation' },
    { id: 'CRITICAL', label: 'Urgent (< 6h)', Icon: Clock, color: '#d97706', cls: demo.kpiUrgent, value: kpis.critical, hint: 'Pack these first' },
    { id: 'TODAY', label: 'Due within 24h', Icon: Clock, color: '#2563eb', cls: demo.kpiToday, value: kpis.today, hint: 'Orders to finish today' },
  ]

  const channelSelect = <label className={styles.field}>
    Order source
    <select value={channel} onChange={e => setChannel(e.target.value)}>
      <option value="SHOPEE">Shopee (Live)</option>
      <option value="TIKTOK">TikTok Shop</option>
    </select>
  </label>

  return (
    <div className={demo.hub}>
      <OwnerPanel title="Shipping deadlines (SLA)">
          <div className={demo.kpiGrid}>
            {slaCards.map(({ id, label, Icon, color, cls, value, hint }) => (
              <button
                key={id}
                type="button"
                disabled={noTiktokDeadlines}
                className={`${demo.kpiCard} ${cls} ${slaFilter === id ? demo.kpiCardActive : ''}`}
                onClick={() => { setStage('to_prepare'); setSlaFilter(slaFilter === id ? 'ALL' : id) }}
              >
                <span className={demo.kpiLabel}>{label} <Icon size={14} color={color} /></span>
                <span className={demo.kpiValue}>{noTiktokDeadlines ? '—' : value}</span>
                <span className={demo.kpiHint}>{noTiktokDeadlines ? noDeadlineHint : hint}</span>
              </button>
            ))}

            <button
              type="button"
              className={`${demo.kpiCard} ${demo.kpiStuck} ${stage === 'stuck' ? demo.kpiCardActive : ''}`}
              onClick={() => { setStage('stuck'); setSlaFilter('ALL') }}
            >
              <span className={demo.kpiLabel}>Stuck / Possibly lost <AlertTriangle size={14} color="#7c3aed" /></span>
              <span className={demo.kpiValue}>{kpis.stuck}</span>
              <span className={demo.kpiHint}>Pickup waiting &gt; 24h ({tiktok ? 'after ready to ship' : 'after handover'}) or idle &gt; 72h</span>
            </button>

            <button
              type="button"
              className={`${demo.kpiCard} ${demo.kpiTotal} ${slaFilter === 'ALL' && stage === 'to_prepare' ? demo.kpiCardActive : ''}`}
              onClick={() => { setStage('to_prepare'); setSlaFilter('ALL') }}
            >
              <span className={demo.kpiLabel}>Orders to prepare <PackageCheck size={14} /></span>
              <span className={demo.kpiValue}>{kpis.totalPrepare}</span>
              <span className={demo.kpiHint}>{channelName} orders ready to pack</span>
            </button>
          </div>
      </OwnerPanel>

      <OwnerPanel title="Order fulfillment center">
        <div className={styles.filters}>
          {channelSelect}

              <label className={styles.field}>
                Sort by
                <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
                  <option value="SLA_ASC">Nearest ship deadline (SLA first)</option>
                  <option value="NEWEST">Newest orders</option>
                  <option value="AMOUNT_DESC">Highest order value</option>
                </select>
              </label>

              <label className={styles.field}>
                Quick search
                <input
                  type="search"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Order, buyer, SKU or tracking number"
                />
              </label>
        </div>

          <>
            <div className={demo.stageTabs} role="tablist" aria-label="Processing stage">
              {STAGE_TABS.map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={stage === tab.id}
                  className={`${demo.stageTab} ${stage === tab.id ? demo.stageTabActive : ''}`}
                  onClick={() => { setStage(tab.id); setSelectedIds(new Set()); if (tab.id !== 'to_prepare') setSlaFilter('ALL') }}
                >
                  <span>{tab.label}</span>
                  <span className={demo.stageCount}>{stageCounts[tab.id] ?? 0}</span>
                </button>
              ))}
            </div>

            <div className={styles.actions}>
              <Button disabled={action.busy} onClick={syncOrders}>
                <RefreshCw size={15} /> Sync {tiktok ? 'TikTok' : 'Shopee'} orders
              </Button>
              <Button variant="outline" disabled={action.busy} onClick={resource.reload}>
                Refresh list
              </Button>
              {stage === 'to_prepare' && (
                <>
                  <Button variant="outline" disabled={noTiktokDeadlines} title={noTiktokDeadlines ? noDeadlineHint : undefined} onClick={selectUrgentOrders}>
                    Select urgent orders (&lt; 6h)
                  </Button>
                  <Button variant="outline" disabled={!pickingItems.orders.length} onClick={() => setPickingOpen(true)}>
                    Picking list ({selectedOrders.length || visibleOrders.filter(o => o.meta.canPrepare).length} orders)
                  </Button>
                </>
              )}
            </div>

            {selectedOrders.length > 0 && stage === 'to_prepare' && (
              <div className={demo.batchBar}>
                <span className={demo.batchInfo}><strong>{selectedOrders.length}</strong> orders selected for preparation</span>
                <div className={styles.actions}>
                  <Button variant="outline" onClick={() => setPickingOpen(true)}>Picking list</Button>
                  <Button disabled={action.busy} onClick={() => setBatchShipSns(selectedOrders.map(o => o.id))}>
                    <Truck size={15} /> Arrange shipment ({selectedOrders.length} orders)
                  </Button>
                  <Button variant="secondary" onClick={() => setSelectedIds(new Set())}>Clear selection</Button>
                </div>
              </div>
            )}

            <Feedback value={localNotice} />
            <Feedback value={action.feedback} />
            {resource.data?.warnings?.length > 0 && (
              <Feedback value={{ error: true, message: `Could not load ${resource.data.warnings.join(' and ')} from TikTok. Order statuses may be incomplete.` }} />
            )}
            {disconnected ? (
              <>
                <Feedback value={{ error: true, message: 'TikTok Shop is not connected. Connect your shop to view orders.' }} />
                <Button variant="outline" onClick={() => navigate('/merchant/shops?marketplace=tiktok-shop')}>Connect TikTok Shop</Button>
              </>
            ) : <ResourceState resource={resource} />}

            {!resource.loading && !resource.error && (
              visibleOrders.length ? (
                <DataTable
                  label={`${channelName} orders`}
                  headings={stage === 'to_prepare'
                    ? ['', 'Order / Channel', 'Items to pick', 'Total', 'Status & deadline', 'Quick actions']
                    : ['Order / Channel', 'Items to pick', 'Total', 'Status & deadline', 'Tracking number', 'Actions']}
                >
                  {visibleOrders.map(order => {
                    const rowCls = order.stuck ? demo.rowStuck : (order.sla?.rowCls ? demo[order.sla.rowCls] : '')
                    const shownItems = order.items.slice(0, MAX_VISIBLE_ITEMS)
                    const extraCount = order.items.length - shownItems.length
                    return (
                      <tr key={order.id} className={rowCls}>
                        {stage === 'to_prepare' && (
                          <td className={demo.checkboxCell}>
                            <input
                              type="checkbox"
                              aria-label={`Select order ${order.id}`}
                              checked={selectedIds.has(order.id)}
                              onChange={() => toggleSelect(order.id)}
                            />
                          </td>
                        )}
                        <td>
                          <strong>{order.id}</strong>
                          <p>
                            <span className={`${demo.channelBadge} ${tiktok ? demo.channelTiktok : demo.channelShopee}`}>{channelName}</span>
                            {order.packed && (
                              <span className={demo.packedBadge}>
                                <CheckCircle2 size={11} /> Packed
                              </span>
                            )}
                          </p>
                          <p className={styles.note}>{order.buyerName} · {order.buyerPhone}</p>
                        </td>
                        <td>
                          <div className={demo.itemPreview}>
                            {shownItems.map((item, idx) => (
                              <div key={idx}>
                                <strong>{item.qty}×</strong>{' '}
                                <span className={demo.itemName} title={item.name}>{item.name}</span>
                                <div className={demo.skuCode}>{item.sku} · {item.variant}</div>
                              </div>
                            ))}
                            {extraCount > 0 && (
                              <button
                                type="button"
                                className={demo.moreItemsBtn}
                                onClick={() => setDetailOrderId(order.id)}
                              >
                                … (+{extraCount} more items)
                              </button>
                            )}
                          </div>
                        </td>
                        <td>
                          <strong>{money(order.totalAmount)}</strong>
                          {order.paymentLabel && <p className={styles.note}>{order.paymentLabel}</p>}
                        </td>
                        <td>
                          <span className={`${demo.statusBadge} ${demo[order.meta.cls]}`}>{order.meta.label}</span>
                          {order.stuck && (
                            <>
                              <p>
                                <span className={demo.stuckBadge}>
                                  <AlertTriangle size={11} /> {order.stuck.badge}
                                </span>
                              </p>
                              <p className={styles.note}>
                                Last update: {dateTime(order.stuck.lastUpdate)} · {order.stuck.reason}
                              </p>
                            </>
                          )}
                          {order.sla && (
                            <p>
                              <span className={`${demo.slaBadge} ${demo[order.sla.cls]}`}>
                                <Clock size={11} /> {order.sla.label}
                              </span>
                            </p>
                          )}
                          {order.sla && (
                            <p className={styles.note}>
                              Due: {dateTime(order.deadlineAt)}
                            </p>
                          )}
                        </td>
                        {stage !== 'to_prepare' && (
                          <td>
                            {order.trackingNumber ? <strong>{order.trackingNumber}</strong> : '—'}
                            <p className={styles.note}>{order.carrier}</p>
                          </td>
                        )}
                        <td>
                          <div className={styles.actions}>
                            {order.meta.canPrepare && (
                              <Button disabled={action.busy} onClick={() => setShipOrderSn(order.id)}>
                                Prepare order
                              </Button>
                            )}
                            {order.meta.canHandover && (
                              <Button disabled={action.busy} onClick={() => markHandover(order.id)}>
                                <Truck size={14} /> Hand over
                              </Button>
                            )}
                            {(order.meta.hasLabel || order.trackingNumber) && (
                              <Button variant="outline" disabled={action.busy} onClick={() => downloadAwb(order)}>
                                <Printer size={14} /> Print label
                              </Button>
                            )}
                            {order.stuck && (
                              <Button variant="outline" onClick={() => setSupportOrder(order)}>
                                Report to support
                              </Button>
                            )}
                            {order.meta.isCancelReq && (
                              <Button variant="destructive" onClick={() => (tiktok ? setCancelRequest(order.cancelRequest) : setCancelReviewOrderSn(order.id))}>
                                Review cancellation
                              </Button>
                            )}
                            {order.meta.canCancel && (
                              <Button variant="destructive" onClick={() => setCancelOrderSn(order.id)}>
                                Cancel order
                              </Button>
                            )}
                            <Button variant="outline" onClick={() => setDetailOrderId(order.id)}>View details</Button>
                            {!(tiktok && order.rawStatus === 'UNPAID') && <Button variant="outline" onClick={() => setEscrowOrderSn(order.id)}>View escrow</Button>}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </DataTable>
              ) : (
                <p className={styles.empty}>No orders match your filters.</p>
              )
            )}
            {!resource.loading && !resource.error && (pageTokens.length > 1 || nextPageToken) && (
              <div className={`${styles.actions} ${styles.pagination}`}>
                <Button variant="secondary" disabled={pageTokens.length === 1} onClick={() => changePage(pageTokens.slice(0, -1))}>Previous page</Button>
                <span>Page {pageTokens.length}{resource.data?.totalCount != null && ` · ${resource.data.totalCount} orders`} · Counts and filters apply to this page</span>
                <Button variant="secondary" disabled={!nextPageToken} onClick={() => changePage([...pageTokens, nextPageToken])}>Next page</Button>
              </div>
            )}
          </>
      </OwnerPanel>

      {/* Modal: order detail (wide enough for the full item table) */}
      <Dialog open={Boolean(detailOrder)} onOpenChange={open => { if (!open) setDetailOrderId(null) }}>
        <DialogContent className={`${styles.dialog} ${styles.marketplaceDialog} ${demo.detailDialog}`}>
          <DialogTitle>Order {detailOrder?.id}</DialogTitle>
          <DialogDescription>
            {channelName} · {detailOrder?.meta.label}
          </DialogDescription>
          {detailOrder && (
            <>
              <div className={demo.detailMeta}>
                <div>Recipient<strong>{detailOrder.buyerName}</strong><span>{detailOrder.buyerPhone}</span></div>
                <div>Shipping<strong>{detailOrder.carrier}</strong><span>{detailOrder.trackingNumber || 'No tracking number yet'}</span></div>
                <div>Ship by<strong>{dateTime(detailOrder.deadlineAt)}</strong><span>{detailOrder.sla ? detailOrder.sla.label : '—'}</span></div>
              </div>
              <p><strong>Delivery address (masked):</strong> {detailOrder.shippingAddress}</p>
              {detailOrder.buyerNote && <p className={demo.noteBox}><strong>Note:</strong> {detailOrder.buyerNote}</p>}
              {detailOrder.items.length ? (
                <DataTable label="Order items" headings={['SKU / Item', 'Qty', 'Unit price', 'Amount']}>
                  {detailOrder.items.map((item, idx) => (
                    <tr key={idx}>
                      <td><strong>{item.name}</strong><p className={demo.skuCode}>{item.sku} · {item.variant}</p></td>
                      <td>{item.qty}</td>
                      <td>{money(item.price)}</td>
                      <td>{money(item.price * item.qty)}</td>
                    </tr>
                  ))}
                </DataTable>
              ) : (
                <p className={styles.empty}>No item information for this order.</p>
              )}
              {tiktok && <TiktokDetailTools orderId={detailOrder.id} items={detailOrder.items} />}
              <div className={styles.actions}>
                {detailOrder.meta.canPrepare && (
                  <Button onClick={() => { setDetailOrderId(null); setShipOrderSn(detailOrder.id) }}>
                    Prepare order now
                  </Button>
                )}
                {detailOrder.meta.canHandover && (
                  <Button onClick={() => { markHandover(detailOrder.id); setDetailOrderId(null) }}>
                    <Truck size={14} /> Hand over to carrier
                  </Button>
                )}
                {(detailOrder.meta.hasLabel || detailOrder.trackingNumber) && (
                  <Button variant="outline" disabled={action.busy} onClick={() => downloadAwb(detailOrder)}>
                    <Printer size={14} /> Print label (AWB PDF)
                  </Button>
                )}
                <Button variant="secondary" onClick={() => setDetailOrderId(null)}>Close</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal: arrange a single shipment (shipping-parameter and ship APIs) */}
      {shipOrderSn && tiktok && (
        <TiktokShipDialog orderId={shipOrderSn} close={() => setShipOrderSn(null)} done={message => finishTiktokAction(message, setShipOrderSn)} />
      )}
      {shipOrderSn && !tiktok && (
        <ShipOrderDialog
          orderSn={shipOrderSn}
          close={() => setShipOrderSn(null)}
          reload={resource.reload}
        />
      )}

      {/* Modal: batch shipment */}
      {batchShipSns.length > 0 && tiktok && (
        <TiktokBatchShipDialog orderIds={batchShipSns} close={() => setBatchShipSns([])} done={finishBatch} />
      )}
      {batchShipSns.length > 0 && !tiktok && (
        <BatchShipDialog
          orderSns={batchShipSns}
          close={() => setBatchShipSns([])}
          done={finishBatch}
        />
      )}

      {/* Modal: picking list */}
      <Dialog open={pickingOpen} onOpenChange={setPickingOpen}>
        <DialogContent className={`${styles.dialog} ${styles.marketplaceDialog} ${demo.detailDialog}`}>
          <DialogTitle>Picking list</DialogTitle>
          <DialogDescription>
            Quantities per SKU for {pickingItems.orders.length} orders, so the warehouse can pick them in one pass.
          </DialogDescription>
          {pickingItems.rows.length ? (
            <DataTable label="Items to pick" headings={['SKU / Item', 'Total to pick', 'Orders']}>
              {pickingItems.rows.map(row => (
                <tr key={`${row.sku}:${row.variant}`}>
                  <td>
                    <strong>{row.name}</strong>
                    <p className={demo.skuCode}>{row.sku} · {row.variant}</p>
                  </td>
                  <td><span className={demo.pickingTotal}>{row.totalQty}</span></td>
                  <td>{row.orderIds.join(', ')}</td>
                </tr>
              ))}
            </DataTable>
          ) : (
            <p className={styles.empty}>There are no items to pick.</p>
          )}
          <div className={styles.actions}>
            <Button variant="secondary" onClick={() => setPickingOpen(false)}>Close</Button>
            <Button variant="outline" onClick={markPickedOrders}>Mark as picked &amp; packed</Button>
            <Button
              disabled={!pickingItems.orders.length}
              onClick={() => {
                const sns = pickingItems.orders.map(o => o.id)
                setPickingOpen(false)
                setBatchShipSns(sns)
              }}
            >
              Arrange batch shipment ({pickingItems.orders.length} orders)
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: escrow */}
      {escrowOrderSn && (tiktok
        ? <TiktokEscrowDialog orderId={escrowOrderSn} close={() => setEscrowOrderSn(null)} />
        : <EscrowDialog orderSn={escrowOrderSn} close={() => setEscrowOrderSn(null)} />)}

      {/* Modal: cancel order / review cancellation */}
      {cancelOrderSn && (tiktok
        ? <TiktokCancelDialog orderId={cancelOrderSn} close={() => setCancelOrderSn(null)} done={message => finishTiktokAction(message, setCancelOrderSn)} />
        : <CancelDialog orderSn={cancelOrderSn} close={() => setCancelOrderSn(null)} reload={resource.reload} />)}
      {cancelReviewOrderSn && <BuyerCancelDialog orderSn={cancelReviewOrderSn} close={() => setCancelReviewOrderSn(null)} reload={resource.reload} />}
      {cancelRequest && <TiktokBuyerCancelDialog request={cancelRequest} close={() => setCancelRequest(null)} done={message => finishTiktokAction(message, setCancelRequest)} />}

      {/* Modal: report a stuck order */}
      <Dialog open={Boolean(supportOrder)} onOpenChange={open => { if (!open) setSupportOrder(null) }}>
        <DialogContent className={`${styles.dialog} ${styles.marketplaceDialog}`}>
          <DialogTitle>Report a stuck order</DialogTitle>
          <DialogDescription>Order {supportOrder?.id} · {channelName}</DialogDescription>
          {supportOrder && (
            <>
              <div className={demo.detailMeta}>
                <div>Tracking number<strong>{supportOrder.trackingNumber || 'None'}</strong><span>{supportOrder.carrier}</span></div>
                <div>Current status<strong>{supportOrder.meta.label}</strong><span>{supportOrder.stuck?.badge}</span></div>
                <div>Last update<strong>{dateTime(supportOrder.stuck?.lastUpdate)}</strong><span>Idle for {supportOrder.stuck?.idleHours} hours</span></div>
              </div>
              <div className={demo.noteBox}>
                <strong>Message for marketplace or carrier support:</strong>
                <p>{supportText}</p>
              </div>
              <div className={styles.actions}>
                <Button variant="secondary" onClick={() => setSupportOrder(null)}>Close</Button>
                <Button onClick={() => {
                  navigator.clipboard?.writeText(supportText).catch(() => {})
                  setLocalNotice({ message: `Support message for order ${supportOrder.id} copied.` })
                  setSupportOrder(null)
                }}>
                  Copy support message
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ShipOrderDialog({ orderSn, close, reload }) {
  const action = useApiAction()
  const [mode, setMode] = useState('dropoff')
  const [address, setAddress] = useState('')
  const [slot, setSlot] = useState('')
  const [branch, setBranch] = useState('')
  const loader = useCallback(() => shopeeApi.shippingParameters(orderSn), [orderSn])
  const resource = useApiResource(loader)
  const parameters = resource.data
  const addresses = parameters?.pickupAddresses || []
  const selectedAddress = addresses.find(item => String(item.addressId) === address)

  function submit(event) {
    event.preventDefault()
    action.run(
      () => shopeeApi.ship(
        orderSn,
        mode === 'pickup'
          ? { shippingMode: 'pickup', addressId: Number(address), pickupTimeId: slot }
          : { shippingMode: 'dropoff', ...(branch ? { branchId: Number(branch) } : {}) }
      ),
      result => result?.trackingNumber
        ? `Shipment confirmed. Tracking number: ${result.trackingNumber}`
        : 'Shipment arranged on Shopee.',
      () => { reload(); close() }
    )
  }

  return (
    <Dialog open onOpenChange={open => { if (!open && !action.busy) close() }}>
      <DialogContent className={`${styles.dialog} ${styles.marketplaceDialog}`}>
        <DialogTitle>Arrange shipment</DialogTitle>
        <DialogDescription>Shopee order {orderSn}</DialogDescription>
        <ResourceState resource={resource} />
        {!resource.loading && !resource.error && (
          <form className={styles.form} onSubmit={submit}>
            <label className={styles.field}>
              Handover method
              <select value={mode} onChange={e => setMode(e.target.value)}>
                <option value="dropoff">Drop off at a post office (Drop-off)</option>
                <option value="pickup">Carrier picks up (Pickup)</option>
              </select>
            </label>
            {mode === 'pickup' ? (
              <>
                <label className={styles.field}>
                  Pickup address
                  <select required value={address} onChange={e => { setAddress(e.target.value); setSlot('') }}>
                    <option value="">Select a pickup address</option>
                    {addresses.map(item => <option key={item.addressId} value={item.addressId}>{item.address}</option>)}
                  </select>
                </label>
                <label className={styles.field}>
                  Pickup time slot
                  <select required value={slot} onChange={e => setSlot(e.target.value)}>
                    <option value="">Select a time slot</option>
                    {selectedAddress?.timeSlots?.map(item => (
                      <option key={item.pickupTimeId} value={item.pickupTimeId}>
                        {dateTime(item.date)} · {item.timeText}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : parameters?.dropoffBranches?.length ? (
              <label className={styles.field}>
                Drop-off branch
                <select required value={branch} onChange={e => setBranch(e.target.value)}>
                  <option value="">Select a branch</option>
                  {parameters.dropoffBranches.map(item => (
                    <option key={item.branchId} value={item.branchId}>{item.address || item.branchId}</option>
                  ))}
                </select>
              </label>
            ) : (
              <p className={styles.note}>Shopee does not require a specific branch for this order.</p>
            )}
            <Feedback value={action.feedback} />
            <div className={styles.actions}>
              <Button type="button" variant="secondary" disabled={action.busy} onClick={close}>Back</Button>
              <Button type="submit" disabled={action.busy}>{action.busy ? 'Submitting…' : 'Confirm shipment'}</Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

function BatchShipDialog({ orderSns, close, done }) {
  const action = useApiAction()
  const [mode, setMode] = useState('dropoff')

  function submit(event) {
    event.preventDefault()
    action.run(async () => {
      let ok = 0
      const failed = []
      for (const orderSn of orderSns) {
        try {
          const params = await shopeeApi.shippingParameters(orderSn)
          const firstAddress = params?.pickupAddresses?.[0]
          const firstSlot = firstAddress?.timeSlots?.[0]
          const firstBranch = params?.dropoffBranches?.[0]
          const body = mode === 'pickup' && firstAddress && firstSlot
            ? { shippingMode: 'pickup', addressId: firstAddress.addressId, pickupTimeId: firstSlot.pickupTimeId }
            : { shippingMode: 'dropoff', ...(firstBranch ? { branchId: firstBranch.branchId } : {}) }
          await shopeeApi.ship(orderSn, body)
          ok += 1
        } catch (err) {
          failed.push(`${orderSn}: ${err.message}`)
        }
      }
      if (ok === 0 && failed.length) {
        throw new Error(`Could not process the orders: ${failed[0]}`)
      }
      return { ok, failed }
    },
    res => res.failed.length
      ? `Confirmed ${res.ok}/${orderSns.length} orders. Errors: ${res.failed.join('; ')}`
      : `Arranged shipment for ${res.ok} orders on Shopee.`,
    done)
  }

  return (
    <Dialog open onOpenChange={open => { if (!open && !action.busy) close() }}>
      <DialogContent className={`${styles.dialog} ${styles.marketplaceDialog}`}>
        <DialogTitle>Arrange batch shipment ({orderSns.length} orders)</DialogTitle>
        <DialogDescription>
          Uses the default Shopee shipping parameters and confirms each order.
        </DialogDescription>
        <form className={styles.form} onSubmit={submit}>
          <div className={demo.noteBox}>Orders to process: <strong>{orderSns.join(', ')}</strong></div>
          <label className={styles.field}>
            Default handover method
            <select value={mode} onChange={e => setMode(e.target.value)}>
              <option value="dropoff">Drop off at a post office (Drop-off)</option>
              <option value="pickup">Carrier picks up (Pickup · earliest time slot)</option>
            </select>
          </label>
          <Feedback value={action.feedback} />
          <div className={styles.actions}>
            <Button type="button" variant="secondary" disabled={action.busy} onClick={close}>Back</Button>
            <Button type="submit" disabled={action.busy}>{action.busy ? 'Processing…' : 'Confirm batch shipment'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function EscrowDialog({ orderSn, close }) {
  const loader = useCallback(() => shopeeApi.escrow(orderSn), [orderSn])
  const resource = useApiResource(loader)
  const p = resource.data
  return (
    <Dialog open onOpenChange={open => { if (!open) close() }}>
      <DialogContent className={`${styles.dialog} ${styles.marketplaceDialog}`}>
        <DialogTitle>Escrow details</DialogTitle>
        <DialogDescription>Shopee order {orderSn}</DialogDescription>
        <ResourceState resource={resource} />
        {!resource.loading && !resource.error && p && (
          <dl className={styles.details}>
            {[
              ['Original item total', p.orderOriginalPrice],
              ['Buyer paid total', p.buyerTotalAmount],
              ['Shopee shipping rebate', p.shopeeShippingRebate],
              ['Commission fee', p.commissionFee],
              ['Transaction fee', p.sellerTransactionFee],
              ['Service fee', p.serviceFee],
              ['Return shipping fee', p.reverseShippingFee],
              ['Return refund', p.sellerReturnRefund],
              ['Expected payout', Math.max(0, Number(p.escrowAmount || 0))],
            ].map(([label, value]) => (
              <div key={label}><dt>{label}</dt><dd>{money(value)}</dd></div>
            ))}
          </dl>
        )}
        <div className={styles.actions}>
          <Button variant="secondary" onClick={close}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function CancelDialog({ orderSn, close, reload }) {
  const action = useApiAction()
  const [reason, setReason] = useState('OUT_OF_STOCK')
  function submit(event) {
    event.preventDefault()
    action.run(async () => {
      const res = await shopeeApi.cancelOrder(orderSn, reason)
      if (res?.canceled === false) throw new Error('Shopee did not accept this cancellation.')
      return res
    }, `Order ${orderSn} cancelled.`, () => { reload(); close() })
  }
  return (
    <Dialog open onOpenChange={open => { if (!open && !action.busy) close() }}>
      <DialogContent className={`${styles.dialog} ${styles.marketplaceDialog}`}>
        <DialogTitle>Cancel Shopee order</DialogTitle>
        <DialogDescription>Order {orderSn}</DialogDescription>
        <form className={styles.form} onSubmit={submit}>
          <label className={styles.field}>
            Cancellation reason
            <select value={reason} onChange={e => setReason(e.target.value)}>
              <option value="OUT_OF_STOCK">Out of stock</option>
              <option value="UNDELIVERABLE_AREA">Cannot deliver to this area</option>
              <option value="CUSTOMER_REQUEST">Requested by the buyer</option>
            </select>
          </label>
          <Feedback value={action.feedback} />
          <div className={styles.actions}>
            <Button type="button" variant="secondary" disabled={action.busy} onClick={close}>Back</Button>
            <Button type="submit" variant="destructive" disabled={action.busy}>
              {action.busy ? 'Submitting…' : 'Confirm cancellation'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function BuyerCancelDialog({ orderSn, close, reload }) {
  const action = useApiAction()
  const [operation, setOperation] = useState('ACCEPT')
  function submit(event) {
    event.preventDefault()
    action.run(async () => {
      const res = await shopeeApi.handleCancellation(orderSn, operation)
      if (res?.success === false) throw new Error('Shopee did not accept this action.')
      return res
    }, 'Buyer cancellation request processed.', () => { reload(); close() })
  }
  return (
    <Dialog open onOpenChange={open => { if (!open && !action.busy) close() }}>
      <DialogContent className={`${styles.dialog} ${styles.marketplaceDialog}`}>
        <DialogTitle>Review buyer cancellation</DialogTitle>
        <DialogDescription>Order {orderSn}</DialogDescription>
        <form className={styles.form} onSubmit={submit}>
          <label className={styles.field}>
            Seller decision
            <select value={operation} onChange={e => setOperation(e.target.value)}>
              <option value="ACCEPT">Accept cancellation</option>
              <option value="REJECT">Reject cancellation (keep shipping)</option>
            </select>
          </label>
          <Feedback value={action.feedback} />
          <div className={styles.actions}>
            <Button type="button" variant="secondary" disabled={action.busy} onClick={close}>Back</Button>
            <Button type="submit" disabled={action.busy}>
              {action.busy ? 'Submitting…' : 'Confirm decision'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
