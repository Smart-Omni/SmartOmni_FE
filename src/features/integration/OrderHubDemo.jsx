import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock, PackageCheck, Printer, RefreshCw, Truck } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog'
import { shopeeApi } from '@/services/api/shopee'
import { DataTable, Feedback, OwnerPanel } from '@/features/portal/components/OwnerWorkspaceUI'
import { useApiResource } from './useApiResource'
import { ResourceState } from './ShopeeShared'
import { dateTime, money, useApiAction } from './apiHelpers'
import styles from '@/features/portal/OwnerWorkspace.module.css'
import demo from './OrderHubDemo.module.css'

const HOUR_MS = 3_600_000
const MINUTE_MS = 60_000
const PICKUP_STUCK_HOURS = 24
const TRANSIT_STUCK_HOURS = 72
const MAX_VISIBLE_ITEMS = 2

const STATUS_META = {
  UNPAID: { label: 'Chờ thanh toán', cls: 'statusPending', stage: 'all', canCancel: true },
  READY_TO_SHIP: { label: 'Chờ chuẩn bị hàng', cls: 'statusToShip', stage: 'to_prepare', canPrepare: true, canCancel: true },
  PROCESSED: { label: 'Đã xử lý · Chờ lấy', cls: 'statusProcessed', stage: 'ready_pickup', hasLabel: true },
  IN_CANCEL: { label: 'Khách yêu cầu hủy', cls: 'statusInCancel', stage: 'cancel_request', isCancelReq: true },
  SHIPPED: { label: 'Đang giao hàng', cls: 'statusShipping', stage: 'shipping', hasLabel: true },
  TO_CONFIRM_RECEIVE: { label: 'Chờ xác nhận nhận', cls: 'statusShipping', stage: 'shipping', hasLabel: true },
  COMPLETED: { label: 'Hoàn tất', cls: 'statusDone', stage: 'done' },
  CANCELLED: { label: 'Đã hủy', cls: 'statusDone', stage: 'done' },
  TO_RETURN: { label: 'Yêu cầu trả hàng', cls: 'statusInCancel', stage: 'done' },
}

const STAGE_TABS = [
  { id: 'to_prepare', label: 'Cần chuẩn bị' },
  { id: 'ready_pickup', label: 'Chờ lấy hàng' },
  { id: 'stuck', label: 'Đơn kẹt / Nghi thất lạc' },
  { id: 'cancel_request', label: 'Yêu cầu hủy' },
  { id: 'shipping', label: 'Đang giao' },
  { id: 'done', label: 'Hoàn tất / Hủy' },
  { id: 'all', label: 'Tất cả đơn' },
]

export function maskPhone(phone) {
  if (!phone) return '—'
  const trimmed = String(phone).trim()
  if (trimmed.includes('*')) return trimmed
  if (trimmed.length <= 4) return '****'
  if (trimmed.length <= 7) return `${trimmed.slice(0, 2)}****${trimmed.slice(-2)}`
  return `${trimmed.slice(0, 3)}****${trimmed.slice(-3)}`
}

export function maskAddress(fullAddress) {
  if (!fullAddress) return '—'
  const trimmed = String(fullAddress).trim()
  if (trimmed.includes('*')) return trimmed
  const comma = trimmed.indexOf(',')
  if (comma > 0 && comma < trimmed.length - 1) return `******${trimmed.slice(comma)}`
  if (trimmed.length <= 8) return '****'
  return `${trimmed.slice(0, 2)}****${trimmed.slice(-4)}`
}

function normalizeShopeeOrder(raw, packedSet) {
  const sn = raw.orderSn || raw.platformOrderId || raw.id
  const items = (raw.items || []).map(item => ({
    sku: item.modelSku || item.itemSku || String(item.modelId || item.itemId || '—'),
    name: item.itemName || 'Sản phẩm Shopee',
    variant: item.modelName || 'Mặc định',
    qty: item.quantityPurchased ?? 1,
    price: item.discountedPrice ?? item.originalPrice ?? 0,
  }))
  const createdAt = raw.createTime ? raw.createTime * 1000 : Date.now()
  const updatedAt = raw.updateTime ? raw.updateTime * 1000 : createdAt
  const deadlineAt = raw.shipByDate ? raw.shipByDate * 1000 : null

  return {
    id: sn,
    channel: 'SHOPEE',
    rawStatus: raw.orderStatus || raw.status || 'UNPAID',
    buyerName: raw.recipientAddress?.name || raw.buyerUsername || 'Người mua Shopee',
    buyerPhone: maskPhone(raw.recipientAddress?.phone),
    shippingAddress: maskAddress(raw.recipientAddress?.fullAddress),
    buyerNote: raw.cancelReason ? `Lý do hủy: ${raw.cancelReason}` : '',
    carrier: raw.shippingCarrier || 'ĐVVC Shopee',
    trackingNumber: raw.trackingNo || raw.trackingNumber || '',
    createdAt,
    updatedAt,
    deadlineAt,
    deadlineSource: 'Hạn sàn Shopee (ship_by_date)',
    totalAmount: raw.totalAmount ?? 0,
    packed: packedSet.has(sn) || ['PROCESSED', 'SHIPPED', 'TO_CONFIRM_RECEIVE', 'COMPLETED'].includes(raw.orderStatus),
    items,
  }
}

function getStuckInfo(order, now) {
  const lastUpdate = order.updatedAt || order.createdAt
  const idleHours = Math.floor(Math.max(0, now - lastUpdate) / HOUR_MS)
  if (order.rawStatus === 'PROCESSED' && idleHours >= PICKUP_STUCK_HOURS) {
    return {
      kind: 'pickup',
      idleHours,
      lastUpdate,
      reason: `ĐVVC chưa đến lấy sau ${idleHours} giờ (ngưỡng ${PICKUP_STUCK_HOURS}g)`,
      badge: `Chờ lấy quá ${idleHours}g`,
    }
  }
  if (['SHIPPED', 'TO_CONFIRM_RECEIVE'].includes(order.rawStatus) && idleHours >= TRANSIT_STUCK_HOURS) {
    return {
      kind: 'transit',
      idleHours,
      lastUpdate,
      reason: `Hành trình đứng im ${idleHours} giờ không cập nhật (ngưỡng ${TRANSIT_STUCK_HOURS}g)`,
      badge: `Đứng im ${idleHours}g · Nghi thất lạc`,
    }
  }
  return null
}

function getSlaStatus(order, now) {
  const meta = STATUS_META[order.rawStatus] || {}
  if ((!meta.canPrepare && !meta.isCancelReq) || !order.deadlineAt) return null
  const diff = order.deadlineAt - now
  if (diff < 0) {
    const absMins = Math.abs(Math.round(diff / MINUTE_MS))
    const hrs = Math.floor(absMins / 60)
    const mins = absMins % 60
    return {
      bucket: 'overdue',
      diff,
      cls: 'slaOverdue',
      rowCls: 'rowOverdue',
      label: hrs > 0 ? `Quá hạn ${hrs}g ${mins}p` : `Quá hạn ${mins}p`,
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
      label: hrs > 0 ? `Còn ${hrs}g ${mins}p` : `Còn ${mins}p`,
    }
  }
  if (diff <= 24 * HOUR_MS) {
    return {
      bucket: 'today',
      diff,
      cls: 'slaSoon',
      rowCls: '',
      label: `Còn ${hrs}g ${mins}p`,
    }
  }
  return {
    bucket: 'normal',
    diff,
    cls: 'slaOk',
    rowCls: '',
    label: `Còn ${hrs}g`,
  }
}

export default function OrderHubDemo() {
  const [channel, setChannel] = useState('SHOPEE')
  const [stage, setStage] = useState('to_prepare')
  const [slaFilter, setSlaFilter] = useState('ALL')
  const [sortBy, setSortBy] = useState('SLA_ASC')
  const [query, setQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [packedIds, setPackedIds] = useState(() => new Set())
  const [localNotice, setLocalNotice] = useState(null)
  const [now, setNow] = useState(() => Date.now())

  const [detailOrderId, setDetailOrderId] = useState(null)
  const [shipOrderSn, setShipOrderSn] = useState(null)
  const [batchShipSns, setBatchShipSns] = useState([])
  const [pickingOpen, setPickingOpen] = useState(false)
  const [escrowOrderSn, setEscrowOrderSn] = useState(null)
  const [cancelOrderSn, setCancelOrderSn] = useState(null)
  const [cancelReviewOrderSn, setCancelReviewOrderSn] = useState(null)
  const [supportOrder, setSupportOrder] = useState(null)

  const action = useApiAction()
  const loader = useCallback(
    signal => (channel === 'SHOPEE' ? shopeeApi.orders({ pageSize: 50 }, signal) : Promise.resolve([])),
    [channel]
  )
  const resource = useApiResource(loader)

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [])

  const enriched = useMemo(() => {
    const rawList = Array.isArray(resource.data) ? resource.data : []
    return rawList.map(raw => {
      const order = normalizeShopeeOrder(raw, packedIds)
      return {
        ...order,
        meta: STATUS_META[order.rawStatus] || { label: order.rawStatus, cls: 'statusDone', stage: 'all' },
        sla: getSlaStatus(order, now),
        stuck: getStuckInfo(order, now),
      }
    })
  }, [resource.data, packedIds, now])

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
    const counts = { to_prepare: 0, ready_pickup: 0, stuck: 0, cancel_request: 0, shipping: 0, done: 0, all: 0 }
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
        ? `Đã chọn ${urgentIds.length} đơn gấp cần xử lý ngay.`
        : 'Hiện không có đơn quá hạn hoặc còn dưới 6 giờ.',
    })
  }

  function markPickedOrders() {
    const next = new Set(packedIds)
    pickingItems.orders.forEach(o => next.add(o.id))
    setPackedIds(next)
    setPickingOpen(false)
    setLocalNotice({ message: `Đã đánh dấu hoàn tất soạn & đóng gói cho ${pickingItems.orders.length} đơn.` })
  }

  async function downloadAwb(orderSn) {
    await action.run(async () => {
      const pdf = await shopeeApi.awb(orderSn)
      const url = URL.createObjectURL(pdf)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `AWB-${orderSn.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`
      anchor.click()
      setTimeout(() => URL.revokeObjectURL(url), 30_000)
    }, `Đã tải phiếu gửi hàng AWB-${orderSn}.pdf từ Shopee.`)
  }

  return (
    <div className={demo.hub}>
      {channel === 'SHOPEE' && (
        <OwnerPanel title="Tổng quan hạn giao hàng (SLA)">
          <div className={demo.kpiGrid}>
            <button
              type="button"
              className={`${demo.kpiCard} ${demo.kpiOverdue} ${slaFilter === 'OVERDUE' ? demo.kpiCardActive : ''}`}
              onClick={() => { setStage('to_prepare'); setSlaFilter(slaFilter === 'OVERDUE' ? 'ALL' : 'OVERDUE') }}
            >
              <span className={demo.kpiLabel}>Quá hạn giao <AlertTriangle size={14} color="#dc2626" /></span>
              <span className={demo.kpiValue}>{kpis.overdue}</span>
              <span className={demo.kpiHint}>Cần gửi ngay để tránh sàn tự hủy</span>
            </button>

            <button
              type="button"
              className={`${demo.kpiCard} ${demo.kpiUrgent} ${slaFilter === 'CRITICAL' ? demo.kpiCardActive : ''}`}
              onClick={() => { setStage('to_prepare'); setSlaFilter(slaFilter === 'CRITICAL' ? 'ALL' : 'CRITICAL') }}
            >
              <span className={demo.kpiLabel}>Gấp (&lt; 6 giờ) <Clock size={14} color="#d97706" /></span>
              <span className={demo.kpiValue}>{kpis.critical}</span>
              <span className={demo.kpiHint}>Ưu tiên đóng gói trước</span>
            </button>

            <button
              type="button"
              className={`${demo.kpiCard} ${demo.kpiToday} ${slaFilter === 'TODAY' ? demo.kpiCardActive : ''}`}
              onClick={() => { setStage('to_prepare'); setSlaFilter(slaFilter === 'TODAY' ? 'ALL' : 'TODAY') }}
            >
              <span className={demo.kpiLabel}>Hạn trong 24 giờ <Clock size={14} color="#2563eb" /></span>
              <span className={demo.kpiValue}>{kpis.today}</span>
              <span className={demo.kpiHint}>Đơn cần hoàn tất trong ngày</span>
            </button>

            <button
              type="button"
              className={`${demo.kpiCard} ${demo.kpiStuck} ${stage === 'stuck' ? demo.kpiCardActive : ''}`}
              onClick={() => { setStage('stuck'); setSlaFilter('ALL') }}
            >
              <span className={demo.kpiLabel}>Đơn kẹt / Nghi thất lạc <AlertTriangle size={14} color="#7c3aed" /></span>
              <span className={demo.kpiValue}>{kpis.stuck}</span>
              <span className={demo.kpiHint}>Chờ lấy &gt; 24g hoặc đứng im &gt; 72g</span>
            </button>

            <button
              type="button"
              className={`${demo.kpiCard} ${demo.kpiTotal} ${slaFilter === 'ALL' && stage === 'to_prepare' ? demo.kpiCardActive : ''}`}
              onClick={() => { setStage('to_prepare'); setSlaFilter('ALL') }}
            >
              <span className={demo.kpiLabel}>Tổng đơn chờ chuẩn bị <PackageCheck size={14} /></span>
              <span className={demo.kpiValue}>{kpis.totalPrepare}</span>
              <span className={demo.kpiHint}>Đơn Shopee sẵn sàng đóng gói</span>
            </button>
          </div>
        </OwnerPanel>
      )}

      <OwnerPanel title="Trung tâm điều phối &amp; chuẩn bị đơn hàng">
        <div className={styles.filters}>
          <label className={styles.field}>
            Nguồn đơn hàng
            <select value={channel} onChange={e => { setChannel(e.target.value); setSelectedIds(new Set()); setLocalNotice(null) }}>
              <option value="SHOPEE">Shopee (Trực tiếp)</option>
              <option value="TIKTOK">TikTok Shop (Đang phát triển · TO-DO)</option>
            </select>
          </label>

          {channel === 'SHOPEE' && (
            <>
              <label className={styles.field}>
                Sắp xếp theo
                <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
                  <option value="SLA_ASC">Hạn giao gần nhất (Ưu tiên SLA)</option>
                  <option value="NEWEST">Đơn mới nhất</option>
                  <option value="AMOUNT_DESC">Giá trị đơn cao nhất</option>
                </select>
              </label>

              <label className={styles.field}>
                Tìm kiếm nhanh
                <input
                  type="search"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Mã đơn, khách hàng, SKU hoặc mã vận đơn"
                />
              </label>
            </>
          )}
        </div>

        {channel === 'TIKTOK' ? (
          <div className={demo.todoPanel}>
            <strong>TikTok Shop — Danh sách công việc tích hợp (TO-DO)</strong>
            <p className={styles.note}>
              Kênh TikTok Shop chưa được tích hợp vào Trung tâm đơn hàng SmartOmni. Các hạng mục dự kiến triển khai:
            </p>
            <ul>
              <li>Đồng bộ đơn hàng trực tiếp từ TikTok Shop (202309/202507 Orders API).</li>
              <li>Tính hạn giao chuẩn 48h từ <code>paid_time</code> / <code>create_time</code> và cảnh báo đơn kẹt.</li>
              <li>Xác nhận gói hàng (<code>shipPackage</code>) và tải nhãn giao hàng TikTok PDF.</li>
            </ul>
          </div>
        ) : (
          <>
            <div className={demo.stageTabs} role="tablist" aria-label="Trạng thái xử lý">
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
              <Button
                disabled={action.busy}
                onClick={() => action.run(
                  () => shopeeApi.batchSync({ pageSize: 50 }),
                  result => `Đã gửi đồng bộ ${result.length} đơn hàng Shopee.`,
                  resource.reload
                )}
              >
                <RefreshCw size={15} /> Đồng bộ đơn Shopee
              </Button>
              <Button variant="outline" disabled={action.busy} onClick={resource.reload}>
                Làm mới danh sách
              </Button>
              {stage === 'to_prepare' && (
                <>
                  <Button variant="outline" onClick={selectUrgentOrders}>
                    Chọn nhanh đơn gấp (&lt; 6 giờ)
                  </Button>
                  <Button variant="outline" disabled={!pickingItems.orders.length} onClick={() => setPickingOpen(true)}>
                    Tổng hợp hàng cần soạn ({selectedOrders.length || visibleOrders.filter(o => o.meta.canPrepare).length} đơn)
                  </Button>
                </>
              )}
            </div>

            {selectedOrders.length > 0 && stage === 'to_prepare' && (
              <div className={demo.batchBar}>
                <span className={demo.batchInfo}>Đã chọn <strong>{selectedOrders.length}</strong> đơn hàng cần chuẩn bị</span>
                <div className={styles.actions}>
                  <Button variant="outline" onClick={() => setPickingOpen(true)}>Tổng hợp hàng cần soạn</Button>
                  <Button disabled={action.busy} onClick={() => setBatchShipSns(selectedOrders.map(o => o.id))}>
                    <Truck size={15} /> Chuẩn bị giao hàng ({selectedOrders.length} đơn)
                  </Button>
                  <Button variant="secondary" onClick={() => setSelectedIds(new Set())}>Bỏ chọn</Button>
                </div>
              </div>
            )}

            <Feedback value={action.feedback || localNotice} />
            <ResourceState resource={resource} />

            {!resource.loading && !resource.error && (
              visibleOrders.length ? (
                <DataTable
                  label="Danh sách đơn hàng Shopee"
                  headings={stage === 'to_prepare'
                    ? ['', 'Đơn hàng / Kênh', 'Sản phẩm cần soạn', 'Tổng tiền', 'Trạng thái & Hạn giao', 'Thao tác nhanh']
                    : ['Đơn hàng / Kênh', 'Sản phẩm cần soạn', 'Tổng tiền', 'Trạng thái & Hạn giao', 'Mã vận đơn', 'Thao tác']}
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
                              aria-label={`Chọn đơn ${order.id}`}
                              checked={selectedIds.has(order.id)}
                              onChange={() => toggleSelect(order.id)}
                            />
                          </td>
                        )}
                        <td>
                          <strong>{order.id}</strong>
                          <p>
                            <span className={`${demo.channelBadge} ${demo.channelShopee}`}>Shopee</span>
                            {order.packed && (
                              <span className={demo.packedBadge}>
                                <CheckCircle2 size={11} /> Đã đóng gói
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
                                … (+{extraCount} sản phẩm khác)
                              </button>
                            )}
                          </div>
                        </td>
                        <td><strong>{money(order.totalAmount)}</strong></td>
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
                                Cập nhật cuối: {dateTime(order.stuck.lastUpdate)} · {order.stuck.reason}
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
                              Hạn: {dateTime(order.deadlineAt)} · {order.deadlineSource}
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
                                Chuẩn bị giao hàng
                              </Button>
                            )}
                            {(order.meta.hasLabel || order.trackingNumber) && (
                              <Button variant="outline" disabled={action.busy} onClick={() => downloadAwb(order.id)}>
                                <Printer size={14} /> In phiếu gửi
                              </Button>
                            )}
                            {order.stuck && (
                              <Button variant="outline" onClick={() => setSupportOrder(order)}>
                                Báo CSKH / Tra soát
                              </Button>
                            )}
                            {order.meta.isCancelReq && (
                              <Button variant="destructive" onClick={() => setCancelReviewOrderSn(order.id)}>
                                Xử lý yêu cầu hủy
                              </Button>
                            )}
                            {order.meta.canCancel && (
                              <Button variant="destructive" onClick={() => setCancelOrderSn(order.id)}>
                                Hủy đơn
                              </Button>
                            )}
                            <Button variant="outline" onClick={() => setDetailOrderId(order.id)}>Chi tiết</Button>
                            <Button variant="outline" onClick={() => setEscrowOrderSn(order.id)}>Đối soát</Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </DataTable>
              ) : (
                <p className={styles.empty}>Không có đơn hàng nào khớp bộ lọc hiện tại.</p>
              )
            )}
          </>
        )}
      </OwnerPanel>

      {/* Modal: Chi tiết đơn hàng (mở rộng kích thước để hiển thị đầy đủ bảng sản phẩm) */}
      <Dialog open={Boolean(detailOrder)} onOpenChange={open => { if (!open) setDetailOrderId(null) }}>
        <DialogContent className={`${styles.dialog} ${styles.marketplaceDialog} ${demo.detailDialog}`}>
          <DialogTitle>Chi tiết đơn {detailOrder?.id}</DialogTitle>
          <DialogDescription>
            Shopee · {detailOrder?.meta.label}
          </DialogDescription>
          {detailOrder && (
            <>
              <div className={demo.detailMeta}>
                <div>Người nhận<strong>{detailOrder.buyerName}</strong><span>{detailOrder.buyerPhone} (Đã che theo chính sách Shopee)</span></div>
                <div>Vận chuyển<strong>{detailOrder.carrier}</strong><span>{detailOrder.trackingNumber || 'Chưa cấp mã vận đơn'}</span></div>
                <div>Hạn gửi hàng<strong>{dateTime(detailOrder.deadlineAt)}</strong><span>{detailOrder.sla ? detailOrder.sla.label : detailOrder.deadlineSource}</span></div>
              </div>
              <p><strong>Địa chỉ giao (đã ẩn):</strong> {detailOrder.shippingAddress}</p>
              {detailOrder.buyerNote && <p className={demo.noteBox}><strong>Ghi chú:</strong> {detailOrder.buyerNote}</p>}
              {detailOrder.items.length ? (
                <DataTable label="Sản phẩm trong đơn" headings={['SKU / Sản phẩm', 'SL', 'Đơn giá', 'Thành tiền']}>
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
                <p className={styles.empty}>Không có thông tin sản phẩm trong đơn này.</p>
              )}
              <div className={styles.actions}>
                {detailOrder.meta.canPrepare && (
                  <Button onClick={() => { setDetailOrderId(null); setShipOrderSn(detailOrder.id) }}>
                    Chuẩn bị giao hàng ngay
                  </Button>
                )}
                {(detailOrder.meta.hasLabel || detailOrder.trackingNumber) && (
                  <Button variant="outline" disabled={action.busy} onClick={() => downloadAwb(detailOrder.id)}>
                    <Printer size={14} /> In phiếu gửi (AWB PDF)
                  </Button>
                )}
                <Button variant="secondary" onClick={() => setDetailOrderId(null)}>Đóng</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal: Chuẩn bị giao hàng đơn lẻ (gọi API shipping-parameter & ship từ Shopee Simulator) */}
      {shipOrderSn && (
        <ShipOrderDialog
          orderSn={shipOrderSn}
          close={() => setShipOrderSn(null)}
          reload={resource.reload}
        />
      )}

      {/* Modal: Chuẩn bị giao hàng loạt */}
      {batchShipSns.length > 0 && (
        <BatchShipDialog
          orderSns={batchShipSns}
          close={() => setBatchShipSns([])}
          done={res => {
            setSelectedIds(new Set())
            setBatchShipSns([])
            setLocalNotice({
              message: res?.failed?.length
                ? `Đã xác nhận ${res.ok}/${batchShipSns.length} đơn. Lỗi: ${res.failed.join('; ')}`
                : `Đã xác nhận chuẩn bị giao hàng thành công ${res?.ok ?? batchShipSns.length} đơn trên Shopee.`,
            })
            resource.reload()
          }}
        />
      )}

      {/* Modal: Tổng hợp hàng cần soạn */}
      <Dialog open={pickingOpen} onOpenChange={setPickingOpen}>
        <DialogContent className={`${styles.dialog} ${styles.marketplaceDialog} ${demo.detailDialog}`}>
          <DialogTitle>Tổng hợp hàng cần soạn</DialogTitle>
          <DialogDescription>
            Tổng hợp số lượng theo từng SKU cho {pickingItems.orders.length} đơn hàng để nhân viên kho soạn 1 lượt.
          </DialogDescription>
          {pickingItems.rows.length ? (
            <DataTable label="Tổng hợp sản phẩm cần soạn" headings={['SKU / Sản phẩm', 'Tổng SL cần soạn', 'Thuộc các đơn']}>
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
            <p className={styles.empty}>Không có sản phẩm nào cần soạn.</p>
          )}
          <div className={styles.actions}>
            <Button variant="secondary" onClick={() => setPickingOpen(false)}>Đóng</Button>
            <Button variant="outline" onClick={markPickedOrders}>Đánh dấu đã soạn &amp; đóng gói xong</Button>
            <Button
              disabled={!pickingItems.orders.length}
              onClick={() => {
                const sns = pickingItems.orders.map(o => o.id)
                setPickingOpen(false)
                setBatchShipSns(sns)
              }}
            >
              Chuẩn bị giao hàng loạt ({pickingItems.orders.length} đơn)
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Đối soát tiền (Escrow thật từ Shopee) */}
      {escrowOrderSn && <EscrowDialog orderSn={escrowOrderSn} close={() => setEscrowOrderSn(null)} />}

      {/* Modal: Hủy đơn / Xử lý yêu cầu hủy */}
      {cancelOrderSn && <CancelDialog orderSn={cancelOrderSn} close={() => setCancelOrderSn(null)} reload={resource.reload} />}
      {cancelReviewOrderSn && <BuyerCancelDialog orderSn={cancelReviewOrderSn} close={() => setCancelReviewOrderSn(null)} reload={resource.reload} />}

      {/* Modal: Báo CSKH / Tra soát đơn kẹt */}
      <Dialog open={Boolean(supportOrder)} onOpenChange={open => { if (!open) setSupportOrder(null) }}>
        <DialogContent className={`${styles.dialog} ${styles.marketplaceDialog}`}>
          <DialogTitle>Tra soát đơn kẹt / Hỗ trợ CSKH</DialogTitle>
          <DialogDescription>Đơn {supportOrder?.id} · Shopee</DialogDescription>
          {supportOrder && (
            <>
              <div className={demo.detailMeta}>
                <div>Mã vận đơn<strong>{supportOrder.trackingNumber || 'Chưa có'}</strong><span>{supportOrder.carrier}</span></div>
                <div>Trạng thái hiện tại<strong>{supportOrder.meta.label}</strong><span>{supportOrder.stuck?.badge}</span></div>
                <div>Cập nhật cuối<strong>{dateTime(supportOrder.stuck?.lastUpdate)}</strong><span>Đã đứng im {supportOrder.stuck?.idleHours} giờ</span></div>
              </div>
              <div className={demo.noteBox}>
                <strong>Mẫu nội dung gửi CSKH sàn / ĐVVC:</strong>
                <p>
                  {`Nhờ kiểm tra gấp đơn ${supportOrder.id} (kênh Shopee, mã vận đơn ${supportOrder.trackingNumber || 'chưa cấp'} qua ${supportOrder.carrier}). Trạng thái hiện tại "${supportOrder.meta.label}" không cập nhật từ ${dateTime(supportOrder.stuck?.lastUpdate)} (đã ${supportOrder.stuck?.idleHours} giờ). Vui lòng hỗ trợ xác minh tình trạng kiện hàng / xử lý thất lạc.`}
                </p>
              </div>
              <div className={styles.actions}>
                <Button variant="secondary" onClick={() => setSupportOrder(null)}>Đóng</Button>
                <Button onClick={() => {
                  const text = `Nhờ kiểm tra gấp đơn ${supportOrder.id} (kênh Shopee, mã vận đơn ${supportOrder.trackingNumber || 'chưa cấp'} qua ${supportOrder.carrier}). Trạng thái hiện tại "${supportOrder.meta.label}" không cập nhật từ ${dateTime(supportOrder.stuck?.lastUpdate)} (đã ${supportOrder.stuck?.idleHours} giờ). Vui lòng hỗ trợ xác minh tình trạng kiện hàng / xử lý thất lạc.`
                  navigator.clipboard?.writeText(text).catch(() => {})
                  setLocalNotice({ message: `Đã sao chép nội dung tra soát cho đơn ${supportOrder.id} gửi CSKH.` })
                  setSupportOrder(null)
                }}>
                  Sao chép nội dung gửi CSKH
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
        ? `Đã xác nhận giao hàng. Mã vận đơn: ${result.trackingNumber}`
        : 'Đã xác nhận chuẩn bị giao hàng trên Shopee.',
      () => { reload(); close() }
    )
  }

  return (
    <Dialog open onOpenChange={open => { if (!open && !action.busy) close() }}>
      <DialogContent className={`${styles.dialog} ${styles.marketplaceDialog}`}>
        <DialogTitle>Chuẩn bị giao hàng</DialogTitle>
        <DialogDescription>Đơn Shopee {orderSn}</DialogDescription>
        <ResourceState resource={resource} />
        {!resource.loading && !resource.error && (
          <form className={styles.form} onSubmit={submit}>
            <label className={styles.field}>
              Hình thức giao hàng
              <select value={mode} onChange={e => setMode(e.target.value)}>
                <option value="dropoff">Tự mang ra bưu cục (Drop-off)</option>
                <option value="pickup">ĐVVC đến lấy tận nơi (Pickup)</option>
              </select>
            </label>
            {mode === 'pickup' ? (
              <>
                <label className={styles.field}>
                  Địa chỉ lấy hàng
                  <select required value={address} onChange={e => { setAddress(e.target.value); setSlot('') }}>
                    <option value="">Chọn địa chỉ lấy hàng</option>
                    {addresses.map(item => <option key={item.addressId} value={item.addressId}>{item.address}</option>)}
                  </select>
                </label>
                <label className={styles.field}>
                  Khung giờ lấy hàng
                  <select required value={slot} onChange={e => setSlot(e.target.value)}>
                    <option value="">Chọn khung giờ</option>
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
                Điểm gửi hàng (Bưu cục)
                <select required value={branch} onChange={e => setBranch(e.target.value)}>
                  <option value="">Chọn bưu cục</option>
                  {parameters.dropoffBranches.map(item => (
                    <option key={item.branchId} value={item.branchId}>{item.address || item.branchId}</option>
                  ))}
                </select>
              </label>
            ) : (
              <p className={styles.note}>Shopee không yêu cầu chọn bưu cục cụ thể cho đơn này.</p>
            )}
            <Feedback value={action.feedback} />
            <div className={styles.actions}>
              <Button type="button" variant="secondary" disabled={action.busy} onClick={close}>Quay lại</Button>
              <Button type="submit" disabled={action.busy}>{action.busy ? 'Đang gửi…' : 'Xác nhận giao hàng'}</Button>
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
        throw new Error(`Không thể xử lý đơn: ${failed[0]}`)
      }
      return { ok, failed }
    },
    res => res.failed.length
      ? `Đã xác nhận ${res.ok}/${orderSns.length} đơn. Lỗi: ${res.failed.join('; ')}`
      : `Đã xác nhận chuẩn bị giao hàng thành công ${res.ok} đơn trên Shopee.`,
    done)
  }

  return (
    <Dialog open onOpenChange={open => { if (!open && !action.busy) close() }}>
      <DialogContent className={`${styles.dialog} ${styles.marketplaceDialog}`}>
        <DialogTitle>Chuẩn bị giao hàng loạt ({orderSns.length} đơn)</DialogTitle>
        <DialogDescription>
          Tự động lấy thông số vận chuyển mặc định từ Shopee Simulator và xác nhận từng đơn.
        </DialogDescription>
        <form className={styles.form} onSubmit={submit}>
          <div className={demo.noteBox}>Đơn được xử lý: <strong>{orderSns.join(', ')}</strong></div>
          <label className={styles.field}>
            Hình thức giao hàng mặc định
            <select value={mode} onChange={e => setMode(e.target.value)}>
              <option value="dropoff">Tự mang ra bưu cục (Drop-off)</option>
              <option value="pickup">ĐVVC đến lấy tận nơi (Pickup · chọn khung giờ sớm nhất)</option>
            </select>
          </label>
          <Feedback value={action.feedback} />
          <div className={styles.actions}>
            <Button type="button" variant="secondary" disabled={action.busy} onClick={close}>Quay lại</Button>
            <Button type="submit" disabled={action.busy}>{action.busy ? 'Đang xử lý…' : 'Xác nhận giao hàng loạt'}</Button>
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
        <DialogTitle>Chi tiết đối soát tiền (Escrow)</DialogTitle>
        <DialogDescription>Đơn Shopee {orderSn}</DialogDescription>
        <ResourceState resource={resource} />
        {!resource.loading && !resource.error && p && (
          <dl className={styles.details}>
            {[
              ['Tiền hàng gốc', p.orderOriginalPrice],
              ['Tổng tiền người mua trả', p.buyerTotalAmount],
              ['Trợ giá vận chuyển Shopee', p.shopeeShippingRebate],
              ['Phí hoa hồng sàn', p.commissionFee],
              ['Phí thanh toán', p.sellerTransactionFee],
              ['Phí dịch vụ', p.serviceFee],
              ['Phí vận chuyển hoàn', p.reverseShippingFee],
              ['Tiền hoàn trả hàng', p.sellerReturnRefund],
              ['Thực nhận dự kiến', Math.max(0, Number(p.escrowAmount || 0))],
            ].map(([label, value]) => (
              <div key={label}><dt>{label}</dt><dd>{money(value)}</dd></div>
            ))}
          </dl>
        )}
        <div className={styles.actions}>
          <Button variant="secondary" onClick={close}>Đóng</Button>
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
      if (res?.canceled === false) throw new Error('Shopee không chấp nhận yêu cầu hủy đơn này.')
      return res
    }, `Đã hủy đơn ${orderSn}.`, () => { reload(); close() })
  }
  return (
    <Dialog open onOpenChange={open => { if (!open && !action.busy) close() }}>
      <DialogContent className={`${styles.dialog} ${styles.marketplaceDialog}`}>
        <DialogTitle>Hủy đơn hàng Shopee</DialogTitle>
        <DialogDescription>Đơn {orderSn}</DialogDescription>
        <form className={styles.form} onSubmit={submit}>
          <label className={styles.field}>
            Lý do hủy đơn
            <select value={reason} onChange={e => setReason(e.target.value)}>
              <option value="OUT_OF_STOCK">Hết hàng</option>
              <option value="CUSTOMER_REQUEST">Theo yêu cầu của khách</option>
            </select>
          </label>
          <Feedback value={action.feedback} />
          <div className={styles.actions}>
            <Button type="button" variant="secondary" disabled={action.busy} onClick={close}>Quay lại</Button>
            <Button type="submit" variant="destructive" disabled={action.busy}>
              {action.busy ? 'Đang gửi…' : 'Xác nhận hủy đơn'}
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
      if (res?.success === false) throw new Error('Shopee không chấp nhận thao tác này.')
      return res
    }, 'Đã xử lý yêu cầu hủy từ người mua.', () => { reload(); close() })
  }
  return (
    <Dialog open onOpenChange={open => { if (!open && !action.busy) close() }}>
      <DialogContent className={`${styles.dialog} ${styles.marketplaceDialog}`}>
        <DialogTitle>Xử lý yêu cầu hủy từ người mua</DialogTitle>
        <DialogDescription>Đơn {orderSn}</DialogDescription>
        <form className={styles.form} onSubmit={submit}>
          <label className={styles.field}>
            Quyết định của người bán
            <select value={operation} onChange={e => setOperation(e.target.value)}>
              <option value="ACCEPT">Chấp nhận hủy đơn</option>
              <option value="REJECT">Từ chối hủy (Tiếp tục giao)</option>
            </select>
          </label>
          <Feedback value={action.feedback} />
          <div className={styles.actions}>
            <Button type="button" variant="secondary" disabled={action.busy} onClick={close}>Quay lại</Button>
            <Button type="submit" disabled={action.busy}>
              {action.busy ? 'Đang gửi…' : 'Xác nhận quyết định'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
