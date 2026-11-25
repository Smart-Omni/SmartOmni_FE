import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock, PackageCheck, Printer, RefreshCw, Truck } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog'
import { DataTable, Feedback, OwnerPanel } from '@/features/portal/components/OwnerWorkspaceUI'
import { dateTime, money } from './apiHelpers'
import styles from '@/features/portal/OwnerWorkspace.module.css'
import demo from './OrderHubDemo.module.css'

const HOUR_MS = 3_600_000
const MINUTE_MS = 60_000

const STATUS_META = {
  UNPAID: { label: 'Chờ thanh toán', cls: 'statusPending', stage: 'all' },
  READY_TO_SHIP: { label: 'Chờ chuẩn bị hàng', cls: 'statusToShip', stage: 'to_prepare', canPrepare: true },
  AWAITING_SHIPMENT: { label: 'Chờ chuẩn bị hàng', cls: 'statusToShip', stage: 'to_prepare', canPrepare: true },
  PROCESSED: { label: 'Đã xử lý · Chờ lấy', cls: 'statusProcessed', stage: 'ready_pickup', hasLabel: true },
  AWAITING_COLLECTION: { label: 'Chờ ĐVVC lấy hàng', cls: 'statusProcessed', stage: 'ready_pickup', hasLabel: true },
  IN_CANCEL: { label: 'Khách yêu cầu hủy', cls: 'statusInCancel', stage: 'cancel_request', isCancelReq: true },
  SHIPPED: { label: 'Đang giao hàng', cls: 'statusShipping', stage: 'shipping', hasLabel: true },
  IN_TRANSIT: { label: 'Đang vận chuyển', cls: 'statusShipping', stage: 'shipping', hasLabel: true },
  TO_CONFIRM_RECEIVE: { label: 'Chờ xác nhận nhận', cls: 'statusShipping', stage: 'shipping', hasLabel: true },
  DELIVERED: { label: 'Đã giao hàng', cls: 'statusDone', stage: 'done' },
  COMPLETED: { label: 'Hoàn tất', cls: 'statusDone', stage: 'done' },
  CANCELLED: { label: 'Đã hủy', cls: 'statusDone', stage: 'done' },
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

const PICKUP_STUCK_HOURS = 24
const TRANSIT_STUCK_HOURS = 72

function buildInitialDemoOrders(baseTime) {
  return [
    {
      id: 'SHP-261125-001',
      channel: 'SHOPEE',
      rawStatus: 'READY_TO_SHIP',
      buyerName: 'Nguyễn Minh Anh',
      buyerPhone: '0903 412 889',
      shippingAddress: '128 Nguyễn Đình Chiểu, Phường Võ Thị Sáu, Quận 3, TP.HCM',
      buyerNote: 'Giao giờ hành chính giúp mình nha shop.',
      carrier: 'SPX Express',
      trackingNumber: '',
      createdAt: baseTime - 49.5 * HOUR_MS,
      paidAt: baseTime - 49.2 * HOUR_MS,
      deadlineAt: baseTime - 1.2 * HOUR_MS,
      deadlineSource: 'Hạn sàn Shopee (ship_by_date)',
      totalAmount: 589000,
      packed: false,
      items: [
        { sku: 'SO-ANC-BLK-1Y', name: 'Tai nghe chống ồn ANC Pro', variant: 'Đen · BH 1 năm', qty: 1, price: 490000 },
        { sku: 'SO-CBL-USB-C', name: 'Cáp sạc nhanh Type-C 100W', variant: '1.5m · Đen', qty: 1, price: 99000 },
      ],
      escrow: { productTotal: 589000, platformRebate: 15000, commissionFee: 23560, serviceFee: 11780, transactionFee: 11780, net: 556880 },
    },
    {
      id: 'TT-576291044812',
      channel: 'TIKTOK',
      rawStatus: 'AWAITING_SHIPMENT',
      packageId: 'PKG-576200198',
      buyerName: 'Trần Hoàng Nam',
      buyerPhone: '0918 776 234',
      shippingAddress: '45 Tôn Thất Tùng, Phường Phạm Ngũ Lão, Quận 1, TP.HCM',
      buyerNote: 'Gói kỹ chống sốc giúp em.',
      carrier: 'Simulator Express',
      trackingNumber: '',
      createdAt: baseTime - 45.5 * HOUR_MS,
      paidAt: baseTime - 45.3 * HOUR_MS,
      deadlineAt: baseTime + 2.7 * HOUR_MS,
      deadlineSource: 'Hạn chuẩn 48h (từ paid_time)',
      totalAmount: 650000,
      packed: false,
      items: [
        { sku: 'SO-CAM-4K', name: 'Camera hành trình 4K Wi-Fi', variant: 'Bản chuẩn', qty: 1, price: 650000 },
      ],
      escrow: { productTotal: 650000, platformRebate: 20000, commissionFee: 26000, serviceFee: 13000, transactionFee: 13000, net: 618000 },
    },
    {
      id: 'SHP-261125-002',
      channel: 'SHOPEE',
      rawStatus: 'READY_TO_SHIP',
      buyerName: 'Lê Thảo Vy',
      buyerPhone: '0932 554 109',
      shippingAddress: '19 Hoàng Hoa Thám, Phường 6, Bình Thạnh, TP.HCM',
      buyerNote: '',
      carrier: 'Giao Hàng Nhanh',
      trackingNumber: '',
      createdAt: baseTime - 43.2 * HOUR_MS,
      paidAt: baseTime - 43.0 * HOUR_MS,
      deadlineAt: baseTime + 5.0 * HOUR_MS,
      deadlineSource: 'Hạn sàn Shopee (ship_by_date)',
      totalAmount: 398000,
      packed: true,
      items: [
        { sku: 'SO-CHG-15W', name: 'Đế sạc không dây 15W MagSafe', variant: 'Trắng', qty: 2, price: 199000 },
      ],
      escrow: { productTotal: 398000, platformRebate: 0, commissionFee: 15920, serviceFee: 7960, transactionFee: 7960, net: 366160 },
    },
    {
      id: 'TT-576291045190',
      channel: 'TIKTOK',
      rawStatus: 'AWAITING_SHIPMENT',
      packageId: 'PKG-576200244',
      buyerName: 'Phạm Quốc Bảo',
      buyerPhone: '0979 112 904',
      shippingAddress: '88 Cầu Giấy, Quan Hoa, Cầu Giấy, Hà Nội',
      buyerNote: '',
      carrier: 'Simulator Express',
      trackingNumber: '',
      createdAt: baseTime - 32.0 * HOUR_MS,
      paidAt: baseTime - 31.8 * HOUR_MS,
      deadlineAt: baseTime + 16.2 * HOUR_MS,
      deadlineSource: 'Hạn chuẩn 48h (từ paid_time)',
      totalAmount: 689000,
      packed: false,
      items: [
        { sku: 'SO-ANC-BLK-1Y', name: 'Tai nghe chống ồn ANC Pro', variant: 'Đen · BH 1 năm', qty: 1, price: 490000 },
        { sku: 'SO-CHG-15W', name: 'Đế sạc không dây 15W MagSafe', variant: 'Trắng', qty: 1, price: 199000 },
      ],
      escrow: { productTotal: 689000, platformRebate: 25000, commissionFee: 27560, serviceFee: 13780, transactionFee: 13780, net: 658880 },
    },
    {
      id: 'SHP-261125-003',
      channel: 'SHOPEE',
      rawStatus: 'READY_TO_SHIP',
      buyerName: 'Võ Thị Hồng Nhung',
      buyerPhone: '0909 623 411',
      shippingAddress: '210 Phan Xích Long, Phường 2, Phú Nhuận, TP.HCM',
      buyerNote: 'Xuất hóa đơn VAT điện tử nếu có.',
      carrier: 'SPX Express',
      trackingNumber: '',
      createdAt: baseTime - 10.0 * HOUR_MS,
      paidAt: baseTime - 9.8 * HOUR_MS,
      deadlineAt: baseTime + 38.2 * HOUR_MS,
      deadlineSource: 'Hạn sàn Shopee (ship_by_date)',
      totalAmount: 550000,
      packed: false,
      items: [
        { sku: 'SO-ANC-BLK-2Y', name: 'Tai nghe chống ồn ANC Pro', variant: 'Đen · BH 2 năm', qty: 1, price: 550000 },
      ],
      escrow: { productTotal: 550000, platformRebate: 0, commissionFee: 22000, serviceFee: 11000, transactionFee: 11000, net: 506000 },
    },
    {
      id: 'SHP-261125-004',
      channel: 'SHOPEE',
      rawStatus: 'IN_CANCEL',
      buyerName: 'Đỗ Gia Huy',
      buyerPhone: '0984 312 007',
      shippingAddress: '12 Lê Lợi, Bến Thành, Quận 1, TP.HCM',
      buyerNote: 'Khách xin hủy để đổi địa chỉ nhận hàng.',
      carrier: 'SPX Express',
      trackingNumber: '',
      createdAt: baseTime - 28.0 * HOUR_MS,
      paidAt: baseTime - 27.9 * HOUR_MS,
      deadlineAt: baseTime + 20.1 * HOUR_MS,
      deadlineSource: 'Hạn sàn Shopee (ship_by_date)',
      totalAmount: 199000,
      packed: false,
      items: [
        { sku: 'SO-CHG-15W', name: 'Đế sạc không dây 15W MagSafe', variant: 'Trắng', qty: 1, price: 199000 },
      ],
      escrow: { productTotal: 199000, platformRebate: 0, commissionFee: 7960, serviceFee: 3980, transactionFee: 3980, net: 183080 },
    },
    {
      id: 'TT-576291041002',
      channel: 'TIKTOK',
      rawStatus: 'AWAITING_COLLECTION',
      packageId: 'PKG-576200112',
      buyerName: 'Bùi Thanh Tùng',
      buyerPhone: '0912 889 456',
      shippingAddress: '74 Trần Hưng Đạo, Hoàn Kiếm, Hà Nội',
      buyerNote: '',
      carrier: 'Simulator Express',
      trackingNumber: 'SIM88291041002',
      createdAt: baseTime - 26.0 * HOUR_MS,
      paidAt: baseTime - 25.8 * HOUR_MS,
      updatedAt: baseTime - 4.0 * HOUR_MS,
      deadlineAt: baseTime + 22.2 * HOUR_MS,
      deadlineSource: 'Hạn chuẩn 48h (từ paid_time)',
      totalAmount: 490000,
      packed: true,
      items: [
        { sku: 'SO-ANC-BLK-1Y', name: 'Tai nghe chống ồn ANC Pro', variant: 'Đen · BH 1 năm', qty: 1, price: 490000 },
      ],
      escrow: { productTotal: 490000, platformRebate: 15000, commissionFee: 19600, serviceFee: 9800, transactionFee: 9800, net: 465800 },
    },
    {
      id: 'SHP-261124-099',
      channel: 'SHOPEE',
      rawStatus: 'PROCESSED',
      buyerName: 'Hoàng Mai Linh',
      buyerPhone: '0945 771 332',
      shippingAddress: '52 Nguyễn Văn Linh, Hải Châu, Đà Nẵng',
      buyerNote: '',
      carrier: 'SPX Express',
      trackingNumber: 'SPXVN0482910099',
      createdAt: baseTime - 46.0 * HOUR_MS,
      paidAt: baseTime - 45.7 * HOUR_MS,
      updatedAt: baseTime - 41.0 * HOUR_MS,
      deadlineAt: baseTime + 2.3 * HOUR_MS,
      deadlineSource: 'Hạn sàn Shopee (ship_by_date)',
      totalAmount: 650000,
      packed: true,
      items: [
        { sku: 'SO-CAM-4K', name: 'Camera hành trình 4K Wi-Fi', variant: 'Bản chuẩn', qty: 1, price: 650000 },
      ],
      escrow: { productTotal: 650000, platformRebate: 0, commissionFee: 26000, serviceFee: 13000, transactionFee: 13000, net: 598000 },
    },
    {
      id: 'TT-576290981115',
      channel: 'TIKTOK',
      rawStatus: 'IN_TRANSIT',
      packageId: 'PKG-576200045',
      buyerName: 'Đặng Khánh Ly',
      buyerPhone: '0967 204 519',
      shippingAddress: '103 Lý Tự Trọng, Ninh Kiều, Cần Thơ',
      buyerNote: '',
      carrier: 'Simulator Saver',
      trackingNumber: 'SIM77100981115',
      createdAt: baseTime - 110.0 * HOUR_MS,
      paidAt: baseTime - 109.5 * HOUR_MS,
      updatedAt: baseTime - 86.0 * HOUR_MS,
      deadlineAt: baseTime - 61.5 * HOUR_MS,
      deadlineSource: 'Đang giao hàng (không có cập nhật mới)',
      totalAmount: 199000,
      packed: true,
      items: [
        { sku: 'SO-CHG-15W', name: 'Đế sạc không dây 15W MagSafe', variant: 'Trắng', qty: 1, price: 199000 },
      ],
      escrow: { productTotal: 199000, platformRebate: 0, commissionFee: 7960, serviceFee: 3980, transactionFee: 3980, net: 183080 },
    },
    {
      id: 'SHP-261121-014',
      channel: 'SHOPEE',
      rawStatus: 'SHIPPED',
      buyerName: 'Nguyễn Hữu Phước',
      buyerPhone: '0914 552 019',
      shippingAddress: '15 Trần Phú, Nha Trang, Khánh Hòa',
      buyerNote: '',
      carrier: 'Giao Hàng Nhanh',
      trackingNumber: 'GHN8829104412',
      createdAt: baseTime - 130.0 * HOUR_MS,
      paidAt: baseTime - 129.0 * HOUR_MS,
      updatedAt: baseTime - 94.0 * HOUR_MS,
      deadlineAt: baseTime - 81.0 * HOUR_MS,
      deadlineSource: 'Đang giao hàng (đứng im tại kho trung chuyển)',
      totalAmount: 490000,
      packed: true,
      items: [
        { sku: 'SO-ANC-BLK-1Y', name: 'Tai nghe chống ồn ANC Pro', variant: 'Đen · BH 1 năm', qty: 1, price: 490000 },
      ],
      escrow: { productTotal: 490000, platformRebate: 0, commissionFee: 19600, serviceFee: 9800, transactionFee: 9800, net: 450800 },
    },
  ]
}

function getStuckInfo(order, now) {
  const lastUpdate = order.updatedAt || order.paidAt || order.createdAt
  const idleMs = Math.max(0, now - lastUpdate)
  const idleHours = Math.floor(idleMs / HOUR_MS)
  if (['PROCESSED', 'AWAITING_COLLECTION'].includes(order.rawStatus) && idleHours >= PICKUP_STUCK_HOURS) {
    return {
      kind: 'pickup',
      idleHours,
      lastUpdate,
      reason: `ĐVVC chưa đến lấy sau ${idleHours} giờ (ngưỡng ${PICKUP_STUCK_HOURS}g)`,
      badge: `Chờ lấy quá ${idleHours}g`,
    }
  }
  if (['SHIPPED', 'IN_TRANSIT', 'TO_CONFIRM_RECEIVE'].includes(order.rawStatus) && idleHours >= TRANSIT_STUCK_HOURS) {
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
  if (!meta.canPrepare && !meta.isCancelReq) {
    return null
  }
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
  const [orders, setOrders] = useState(() => buildInitialDemoOrders(Date.now()))
  const [now, setNow] = useState(() => Date.now())
  const [channel, setChannel] = useState('ALL')
  const [stage, setStage] = useState('to_prepare')
  const [slaFilter, setSlaFilter] = useState('ALL')
  const [sortBy, setSortBy] = useState('SLA_ASC')
  const [query, setQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [feedback, setFeedback] = useState(null)
  const [syncing, setSyncing] = useState(false)

  const [detailOrderId, setDetailOrderId] = useState(null)
  const [shipTargetIds, setShipTargetIds] = useState([])
  const [shipMode, setShipMode] = useState('PICKUP')
  const [shipSlot, setShipSlot] = useState('Hôm nay · 14:00 - 18:00')
  const [pickingOpen, setPickingOpen] = useState(false)
  const [escrowOrder, setEscrowOrder] = useState(null)
  const [cancelReviewOrder, setCancelReviewOrder] = useState(null)
  const [labelPreviewOrder, setLabelPreviewOrder] = useState(null)
  const [supportOrder, setSupportOrder] = useState(null)

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [])

  const enriched = useMemo(() => {
    return orders.map(order => ({
      ...order,
      meta: STATUS_META[order.rawStatus] || { label: order.rawStatus, cls: 'statusDone', stage: 'all' },
      sla: getSlaStatus(order, now),
      stuck: getStuckInfo(order, now),
    }))
  }, [orders, now])

  const kpis = useMemo(() => {
    const toPrepare = enriched.filter(o => o.meta.canPrepare)
    return {
      overdue: toPrepare.filter(o => o.sla?.bucket === 'overdue').length,
      critical: toPrepare.filter(o => o.sla?.bucket === 'critical').length,
      today: toPrepare.filter(o => o.sla?.bucket === 'overdue' || o.sla?.bucket === 'critical' || o.sla?.bucket === 'today').length,
      stuck: enriched.filter(o => Boolean(o.stuck)).length,
      totalPrepare: toPrepare.length,
    }
  }, [enriched])

  const stageCounts = useMemo(() => {
    const counts = { to_prepare: 0, ready_pickup: 0, stuck: 0, cancel_request: 0, shipping: 0, done: 0, all: 0 }
    for (const order of enriched) {
      if (channel !== 'ALL' && order.channel !== channel) continue
      counts.all += 1
      if (order.stuck) counts.stuck += 1
      if (order.meta.stage && counts[order.meta.stage] != null) counts[order.meta.stage] += 1
    }
    return counts
  }, [enriched, channel])

  const visibleOrders = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = enriched.filter(order => {
      if (channel !== 'ALL' && order.channel !== channel) return false
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
  }, [enriched, channel, stage, slaFilter, sortBy, query])

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
    setFeedback({ message: urgentIds.length ? `Đã chọn ${urgentIds.length} đơn gấp cần xử lý ngay.` : 'Hiện không có đơn quá hạn hoặc còn dưới 6 giờ.' })
  }

  function simulateSync(targetChannel) {
    setSyncing(true)
    setTimeout(() => {
      const ts = Date.now()
      const suffix = String(ts).slice(-4)
      const incoming = []
      if (targetChannel === 'ALL' || targetChannel === 'SHOPEE') {
        incoming.push({
          id: `SHP-261125-${suffix}`,
          channel: 'SHOPEE',
          rawStatus: 'READY_TO_SHIP',
          buyerName: 'Ngô Minh Quân',
          buyerPhone: '0901 334 782',
          shippingAddress: '64 Cách Mạng Tháng 8, Quận 3, TP.HCM',
          buyerNote: 'Đơn mới đồng bộ từ Shopee Simulator.',
          carrier: 'SPX Express',
          trackingNumber: '',
          createdAt: ts - 44.5 * HOUR_MS,
          paidAt: ts - 44.3 * HOUR_MS,
          updatedAt: ts - 44.3 * HOUR_MS,
          deadlineAt: ts + 3.7 * HOUR_MS,
          deadlineSource: 'Hạn sàn Shopee (ship_by_date)',
          totalAmount: 490000,
          packed: false,
          items: [{ sku: 'SO-ANC-BLK-1Y', name: 'Tai nghe chống ồn ANC Pro', variant: 'Đen · BH 1 năm', qty: 1, price: 490000 }],
          escrow: { productTotal: 490000, platformRebate: 10000, commissionFee: 19600, serviceFee: 9800, transactionFee: 9800, net: 460800 },
        })
      }
      if (targetChannel === 'ALL' || targetChannel === 'TIKTOK') {
        incoming.push({
          id: `TT-57629109${suffix}`,
          channel: 'TIKTOK',
          rawStatus: 'AWAITING_SHIPMENT',
          packageId: `PKG-57629${suffix}`,
          buyerName: 'Lý Thu Hà',
          buyerPhone: '0938 665 120',
          shippingAddress: '312 Hai Bà Trưng, Quận 1, TP.HCM',
          buyerNote: 'Đơn mới đồng bộ từ TikTok Simulator.',
          carrier: 'Simulator Express',
          trackingNumber: '',
          createdAt: ts - 18.0 * HOUR_MS,
          paidAt: ts - 17.8 * HOUR_MS,
          updatedAt: ts - 17.8 * HOUR_MS,
          deadlineAt: ts + 30.2 * HOUR_MS,
          deadlineSource: 'Hạn chuẩn 48h (từ paid_time)',
          totalAmount: 398000,
          packed: false,
          items: [{ sku: 'SO-CHG-15W', name: 'Đế sạc không dây 15W MagSafe', variant: 'Trắng', qty: 2, price: 199000 }],
          escrow: { productTotal: 398000, platformRebate: 15000, commissionFee: 15920, serviceFee: 7960, transactionFee: 7960, net: 381160 },
        })
      }
      setOrders(prev => [...incoming, ...prev])
      setNow(ts)
      setSyncing(false)
      setFeedback({
        message: `Đồng bộ thành công ${incoming.length} đơn hàng mới (${targetChannel === 'ALL' ? 'Shopee & TikTok Shop' : targetChannel === 'SHOPEE' ? 'Shopee' : 'TikTok Shop'}).`,
      })
    }, 350)
  }

  function confirmShipment(event) {
    event.preventDefault()
    if (!shipTargetIds.length) return
    const targetSet = new Set(shipTargetIds)
    const stamp = String(Date.now()).slice(-7)
    setOrders(prev => prev.map((order, idx) => {
      if (!targetSet.has(order.id)) return order
      const isShopee = order.channel === 'SHOPEE'
      return {
        ...order,
        rawStatus: isShopee ? 'PROCESSED' : 'AWAITING_COLLECTION',
        packed: true,
        updatedAt: Date.now(),
        trackingNumber: order.trackingNumber || (isShopee ? `SPXVN${stamp}${idx}` : `SIM${stamp}${idx}`),
      }
    }))
    setSelectedIds(prev => {
      const next = new Set(prev)
      shipTargetIds.forEach(id => next.delete(id))
      return next
    })
    setFeedback({
      message: `Đã chuẩn bị giao hàng thành công cho ${shipTargetIds.length} đơn (${shipMode === 'PICKUP' ? 'ĐVVC đến lấy' : 'Gửi tại bưu cục'}). Đã cấp mã vận đơn & sẵn sàng in phiếu gửi hàng.`,
    })
    setShipTargetIds([])
  }

  function markPickedOrders() {
    const ids = new Set(pickingItems.orders.map(o => o.id))
    setOrders(prev => prev.map(o => (ids.has(o.id) ? { ...o, packed: true } : o)))
    setPickingOpen(false)
    setFeedback({ message: `Đã đánh dấu hoàn tất nhặt hàng & đóng gói cho ${ids.size} đơn.` })
  }

  function handleCancelDecision(orderId, accept) {
    setOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o
      return { ...o, rawStatus: accept ? 'CANCELLED' : 'READY_TO_SHIP' }
    }))
    setCancelReviewOrder(null)
    setFeedback({
      message: accept
        ? `Đã chấp nhận yêu cầu hủy cho đơn ${orderId}.`
        : `Đã từ chối yêu cầu hủy — đơn ${orderId} quay lại trạng thái Chờ chuẩn bị hàng.`,
    })
  }

  return (
    <div className={demo.hub}>
      <div className={demo.banner}>
        <div className={demo.bannerTitle}>
          <span className={demo.demoTag}>Bản Demo UI</span>
          <span>
            Trung tâm xử lý đơn hàng tập trung (Shopee &amp; TikTok Shop) · Dữ liệu mẫu tương tác tại chỗ, chưa ghi vào backend thật.
          </span>
        </div>
        <Button variant="outline" onClick={() => {
          setOrders(buildInitialDemoOrders(Date.now()))
          setSelectedIds(new Set())
          setSlaFilter('ALL')
          setStage('to_prepare')
          setFeedback({ message: 'Đã đặt lại dữ liệu demo ban đầu.' })
        }}>
          Đặt lại dữ liệu demo
        </Button>
      </div>

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
            <span className={demo.kpiHint}>Gồm cả Shopee &amp; TikTok Shop</span>
          </button>
        </div>
      </OwnerPanel>

      <OwnerPanel title="Trung tâm điều phối &amp; chuẩn bị đơn hàng">
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

        <div className={styles.filters}>
          <label className={styles.field}>
            Nguồn đơn hàng
            <select value={channel} onChange={e => { setChannel(e.target.value); setSelectedIds(new Set()) }}>
              <option value="ALL">Tất cả sàn (Shopee &amp; TikTok Shop)</option>
              <option value="SHOPEE">Shopee</option>
              <option value="TIKTOK">TikTok Shop</option>
            </select>
          </label>

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
        </div>

        <div className={styles.actions}>
          <Button disabled={syncing} onClick={() => simulateSync(channel)}>
            <RefreshCw size={15} />
            {syncing ? 'Đang đồng bộ…' : channel === 'SHOPEE' ? 'Đồng bộ đơn Shopee' : channel === 'TIKTOK' ? 'Đồng bộ đơn TikTok' : 'Đồng bộ tất cả sàn'}
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
              <Button onClick={() => setShipTargetIds(selectedOrders.map(o => o.id))}>
                <Truck size={15} /> Chuẩn bị giao hàng ({selectedOrders.length} đơn)
              </Button>
              <Button variant="secondary" onClick={() => setSelectedIds(new Set())}>Bỏ chọn</Button>
            </div>
          </div>
        )}

        <Feedback value={feedback} />

        {visibleOrders.length ? (
          <DataTable
            label="Danh sách đơn hàng từ các sàn"
            headings={stage === 'to_prepare'
              ? ['', 'Đơn hàng / Kênh', 'Sản phẩm cần soạn', 'Tổng tiền', 'Trạng thái & Hạn giao', 'Thao tác nhanh']
              : ['Đơn hàng / Kênh', 'Sản phẩm cần soạn', 'Tổng tiền', 'Trạng thái & Hạn giao', 'Mã vận đơn', 'Thao tác']}
          >
            {visibleOrders.map(order => {
              const rowCls = order.stuck ? demo.rowStuck : (order.sla?.rowCls ? demo[order.sla.rowCls] : '')
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
                      <span className={`${demo.channelBadge} ${order.channel === 'SHOPEE' ? demo.channelShopee : demo.channelTiktok}`}>
                        {order.channel === 'SHOPEE' ? 'Shopee' : 'TikTok Shop'}
                      </span>
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
                      {order.items.map((item, idx) => (
                        <div key={idx}>
                          <strong>{item.qty}×</strong> {item.name}
                          <div className={demo.skuCode}>{item.sku} · {item.variant}</div>
                        </div>
                      ))}
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
                        <Button onClick={() => setShipTargetIds([order.id])}>
                          Chuẩn bị giao hàng
                        </Button>
                      )}
                      {order.meta.hasLabel && (
                        <Button variant="outline" onClick={() => setLabelPreviewOrder(order)}>
                          <Printer size={14} /> In phiếu gửi
                        </Button>
                      )}
                      {order.stuck && (
                        <Button variant="outline" onClick={() => setSupportOrder(order)}>
                          Báo CSKH / Tra soát
                        </Button>
                      )}
                      {order.meta.isCancelReq && (
                        <Button variant="destructive" onClick={() => setCancelReviewOrder(order)}>
                          Xử lý yêu cầu hủy
                        </Button>
                      )}
                      <Button variant="outline" onClick={() => setDetailOrderId(order.id)}>Chi tiết</Button>
                      <Button variant="outline" onClick={() => setEscrowOrder(order)}>Đối soát</Button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </DataTable>
        ) : (
          <p className={styles.empty}>Không có đơn hàng nào khớp bộ lọc hiện tại.</p>
        )}
      </OwnerPanel>

      {/* Modal: Chi tiết đơn hàng */}
      <Dialog open={Boolean(detailOrder)} onOpenChange={open => { if (!open) setDetailOrderId(null) }}>
        <DialogContent className={`${styles.dialog} ${styles.marketplaceDialog}`}>
          <DialogTitle>Chi tiết đơn {detailOrder?.id}</DialogTitle>
          <DialogDescription>
            {detailOrder?.channel === 'SHOPEE' ? 'Shopee' : 'TikTok Shop'} · {detailOrder?.meta.label}
          </DialogDescription>
          {detailOrder && (
            <>
              <div className={demo.detailMeta}>
                <div>Người nhận<strong>{detailOrder.buyerName}</strong><span>{detailOrder.buyerPhone}</span></div>
                <div>Vận chuyển<strong>{detailOrder.carrier}</strong><span>{detailOrder.trackingNumber || 'Chưa cấp mã vận đơn'}</span></div>
                <div>Hạn gửi hàng<strong>{dateTime(detailOrder.deadlineAt)}</strong><span>{detailOrder.sla ? detailOrder.sla.label : detailOrder.deadlineSource}</span></div>
              </div>
              <p><strong>Địa chỉ giao:</strong> {detailOrder.shippingAddress}</p>
              {detailOrder.buyerNote && <p className={demo.noteBox}><strong>Ghi chú của khách:</strong> {detailOrder.buyerNote}</p>}
              <DataTable label="Sản phẩm trong đơn" headings={['SKU / Sản phẩm', 'SL', 'Đơn giá', 'Thành tiền']}>
                {detailOrder.items.map((item, idx) => (
                  <tr key={idx}>
                    <td>{item.name}<p className={demo.skuCode}>{item.sku} · {item.variant}</p></td>
                    <td>{item.qty}</td>
                    <td>{money(item.price)}</td>
                    <td>{money(item.price * item.qty)}</td>
                  </tr>
                ))}
              </DataTable>
              <div className={styles.actions}>
                {detailOrder.meta.canPrepare && (
                  <Button onClick={() => { setDetailOrderId(null); setShipTargetIds([detailOrder.id]) }}>
                    Chuẩn bị giao hàng ngay
                  </Button>
                )}
                {detailOrder.meta.hasLabel && (
                  <Button variant="outline" onClick={() => { setDetailOrderId(null); setLabelPreviewOrder(detailOrder) }}>
                    In phiếu gửi hàng
                  </Button>
                )}
                <Button variant="secondary" onClick={() => setDetailOrderId(null)}>Đóng</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal: Chuẩn bị giao hàng nhanh (1 hoặc nhiều đơn) */}
      <Dialog open={shipTargetIds.length > 0} onOpenChange={open => { if (!open) setShipTargetIds([]) }}>
        <DialogContent className={`${styles.dialog} ${styles.marketplaceDialog}`}>
          <DialogTitle>Chuẩn bị giao hàng ({shipTargetIds.length} đơn)</DialogTitle>
          <DialogDescription>
            Gửi yêu cầu lấy hàng / giao bưu cục sang sàn và cấp mã vận đơn tự động.
          </DialogDescription>
          <form className={styles.form} onSubmit={confirmShipment}>
            <div className={demo.noteBox}>
              Đơn được xử lý: <strong>{shipTargetIds.join(', ')}</strong>
            </div>
            <label className={styles.field}>
              Hình thức bàn giao vận chuyển
              <select value={shipMode} onChange={e => setShipMode(e.target.value)}>
                <option value="PICKUP">Đơn vị vận chuyển đến lấy tận nơi (Pickup)</option>
                <option value="DROPOFF">Tự mang ra bưu cục (Drop-off)</option>
              </select>
            </label>
            {shipMode === 'PICKUP' && (
              <label className={styles.field}>
                Khung giờ lấy hàng dự kiến
                <select value={shipSlot} onChange={e => setShipSlot(e.target.value)}>
                  <option value="Hôm nay · 14:00 - 18:00">Hôm nay · 14:00 - 18:00</option>
                  <option value="Ngày mai · 08:00 - 12:00">Ngày mai · 08:00 - 12:00</option>
                  <option value="Ngày mai · 14:00 - 18:00">Ngày mai · 14:00 - 18:00</option>
                </select>
              </label>
            )}
            <div className={styles.actions}>
              <Button type="button" variant="secondary" onClick={() => setShipTargetIds([])}>Quay lại</Button>
              <Button type="submit">Xác nhận giao hàng &amp; Lấy mã vận đơn</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Tổng hợp hàng cần soạn */}
      <Dialog open={pickingOpen} onOpenChange={setPickingOpen}>
        <DialogContent className={`${styles.dialog} ${styles.marketplaceDialog}`}>
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
            <Button onClick={() => {
              const ids = pickingItems.orders.map(o => o.id)
              setPickingOpen(false)
              setShipTargetIds(ids)
            }}>
              Chuẩn bị giao hàng loạt ({pickingItems.orders.length} đơn)
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Đối soát tiền (Escrow) */}
      <Dialog open={Boolean(escrowOrder)} onOpenChange={open => { if (!open) setEscrowOrder(null) }}>
        <DialogContent className={`${styles.dialog} ${styles.marketplaceDialog}`}>
          <DialogTitle>Chi tiết đối soát tiền (Escrow)</DialogTitle>
          <DialogDescription>Đơn {escrowOrder?.id} · {escrowOrder?.channel === 'SHOPEE' ? 'Shopee' : 'TikTok Shop'}</DialogDescription>
          {escrowOrder && (
            <dl className={styles.details}>
              <div><dt>Tiền hàng gốc</dt><dd>{money(escrowOrder.escrow.productTotal)}</dd></div>
              <div><dt>Trợ giá sàn</dt><dd>{money(escrowOrder.escrow.platformRebate)}</dd></div>
              <div><dt>Phí cố định / Hoa hồng</dt><dd>-{money(escrowOrder.escrow.commissionFee)}</dd></div>
              <div><dt>Phí dịch vụ</dt><dd>-{money(escrowOrder.escrow.serviceFee)}</dd></div>
              <div><dt>Phí thanh toán</dt><dd>-{money(escrowOrder.escrow.transactionFee)}</dd></div>
              <div><dt>Thực nhận dự kiến</dt><dd><strong>{money(escrowOrder.escrow.net)}</strong></dd></div>
            </dl>
          )}
          <div className={styles.actions}>
            <Button variant="secondary" onClick={() => setEscrowOrder(null)}>Đóng</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Xử lý yêu cầu hủy */}
      <Dialog open={Boolean(cancelReviewOrder)} onOpenChange={open => { if (!open) setCancelReviewOrder(null) }}>
        <DialogContent className={`${styles.dialog} ${styles.marketplaceDialog}`}>
          <DialogTitle>Xử lý yêu cầu hủy từ người mua</DialogTitle>
          <DialogDescription>Đơn {cancelReviewOrder?.id} · {cancelReviewOrder?.buyerName}</DialogDescription>
          {cancelReviewOrder && (
            <>
              <p className={demo.noteBox}>{cancelReviewOrder.buyerNote || 'Người mua đã gửi yêu cầu hủy đơn trên sàn.'}</p>
              <div className={styles.actions}>
                <Button variant="secondary" onClick={() => setCancelReviewOrder(null)}>Để sau</Button>
                <Button variant="outline" onClick={() => handleCancelDecision(cancelReviewOrder.id, false)}>Từ chối hủy (Tiếp tục giao)</Button>
                <Button variant="destructive" onClick={() => handleCancelDecision(cancelReviewOrder.id, true)}>Chấp nhận hủy đơn</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal: Báo CSKH / Tra soát đơn kẹt */}
      <Dialog open={Boolean(supportOrder)} onOpenChange={open => { if (!open) setSupportOrder(null) }}>
        <DialogContent className={`${styles.dialog} ${styles.marketplaceDialog}`}>
          <DialogTitle>Tra soát đơn kẹt / Hỗ trợ CSKH</DialogTitle>
          <DialogDescription>
            Đơn {supportOrder?.id} · {supportOrder?.channel === 'SHOPEE' ? 'Shopee' : 'TikTok Shop'}
          </DialogDescription>
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
                  {`Nhờ kiểm tra gấp đơn ${supportOrder.id} (kênh ${supportOrder.channel === 'SHOPEE' ? 'Shopee' : 'TikTok Shop'}, mã vận đơn ${supportOrder.trackingNumber || 'chưa cấp'} qua ${supportOrder.carrier}). Trạng thái hiện tại "${supportOrder.meta.label}" không cập nhật từ ${dateTime(supportOrder.stuck?.lastUpdate)} (đã ${supportOrder.stuck?.idleHours} giờ). Vui lòng hỗ trợ xác minh tình trạng kiện hàng / xử lý thất lạc.`}
                </p>
              </div>
              <div className={styles.actions}>
                <Button variant="secondary" onClick={() => setSupportOrder(null)}>Đóng</Button>
                <Button onClick={() => {
                  const text = `Nhờ kiểm tra gấp đơn ${supportOrder.id} (kênh ${supportOrder.channel === 'SHOPEE' ? 'Shopee' : 'TikTok Shop'}, mã vận đơn ${supportOrder.trackingNumber || 'chưa cấp'} qua ${supportOrder.carrier}). Trạng thái hiện tại "${supportOrder.meta.label}" không cập nhật từ ${dateTime(supportOrder.stuck?.lastUpdate)} (đã ${supportOrder.stuck?.idleHours} giờ). Vui lòng hỗ trợ xác minh tình trạng kiện hàng / xử lý thất lạc.`
                  navigator.clipboard?.writeText(text).catch(() => {})
                  setFeedback({ message: `Đã sao chép nội dung tra soát cho đơn ${supportOrder.id} gửi CSKH.` })
                  setSupportOrder(null)
                }}>
                  Sao chép nội dung gửi CSKH
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal: Xem trước phiếu gửi hàng (AWB / Shipping Label) */}
      <Dialog open={Boolean(labelPreviewOrder)} onOpenChange={open => { if (!open) setLabelPreviewOrder(null) }}>
        <DialogContent className={`${styles.dialog} ${styles.marketplaceDialog}`}>
          <DialogTitle>Phiếu gửi hàng ({labelPreviewOrder?.channel === 'SHOPEE' ? 'Shopee AWB' : 'TikTok Shipping Label'})</DialogTitle>
          <DialogDescription>Đơn {labelPreviewOrder?.id} · Mã vận đơn: {labelPreviewOrder?.trackingNumber}</DialogDescription>
          {labelPreviewOrder && (
            <>
              <div className={demo.noteBox}>
                <p><strong>Đơn vị vận chuyển:</strong> {labelPreviewOrder.carrier}</p>
                <p><strong>Người nhận:</strong> {labelPreviewOrder.buyerName} ({labelPreviewOrder.buyerPhone})</p>
                <p><strong>Địa chỉ:</strong> {labelPreviewOrder.shippingAddress}</p>
                <p><strong>Sản phẩm:</strong> {labelPreviewOrder.items.map(i => `${i.qty}× ${i.sku}`).join(', ')}</p>
              </div>
              <div className={styles.actions}>
                <Button variant="secondary" onClick={() => setLabelPreviewOrder(null)}>Đóng</Button>
                <Button onClick={() => {
                  setFeedback({ message: `Đã tải phiếu gửi hàng PDF cho đơn ${labelPreviewOrder.id} (${labelPreviewOrder.trackingNumber}).` })
                  setLabelPreviewOrder(null)
                }}>
                  <Printer size={14} /> Tải PDF khổ A6 (Demo)
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
