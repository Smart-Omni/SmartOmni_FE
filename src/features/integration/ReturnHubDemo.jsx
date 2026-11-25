import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock, PackageCheck, RefreshCw, Scale, ShieldAlert } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog'
import { DataTable, Feedback, OwnerPanel } from '@/features/portal/components/OwnerWorkspaceUI'
import { dateTime, money } from './apiHelpers'
import styles from '@/features/portal/OwnerWorkspace.module.css'
import demo from './ReturnHubDemo.module.css'

const HOUR_MS = 3_600_000
const MAX_VISIBLE_ITEMS = 2

const SHOPEE_DISPUTE_REASONS = [
  { id: 47, code: 'ITEM_DAMAGED_BY_BUYER', label: 'Sản phẩm bị hư hỏng / đã qua sử dụng bởi người mua' },
  { id: 48, code: 'WEIGHT_MEASUREMENT_MISMATCH', label: 'Sai lệch cân nặng khi đóng gói và khi nhận hoàn' },
  { id: 50, code: 'INCORRECT_CLAIM', label: 'Khiếu nại của người mua không chính xác / sai hàng hoàn' },
  { id: 51, code: 'NON_RECEIPT_REJECT', label: 'Từ chối khiếu nại chưa nhận hàng (có bằng chứng giao thành công)' },
  { id: 52, code: 'NOT_RECEIVED_RETURN', label: 'Đã đồng ý hoàn nhưng chưa nhận được kiện hàng hoàn' },
  { id: 49, code: 'OTHER', label: 'Lý do khác' },
]

const TIKTOK_REJECT_REASONS = [
  { name: 'ITEM_AS_DESCRIBED', text: 'Sản phẩm đúng với mô tả' },
  { name: 'RETURN_WINDOW_EXPIRED', text: 'Quá thời hạn yêu cầu trả hàng' },
  { name: 'ITEM_USED_OR_DAMAGED', text: 'Hàng hoàn đã qua sử dụng hoặc bị hư hỏng' },
  { name: 'OTHER', text: 'Lý do khác' },
]

const WAREHOUSE_RESULTS = {
  PENDING: { label: 'Chờ kiểm định kho', cls: 'warehouseBadge' },
  MATCHED: { label: 'Khớp hàng · Đã cộng kho', cls: 'warehouseBadge warehouseRestocked' },
  DAMAGED: { label: 'Hư hỏng · Tạm giữ', cls: 'warehouseBadge warehouseRejected' },
  SWAPPED: { label: 'Bị tráo hàng · Tạm giữ', cls: 'warehouseBadge warehouseRejected' },
  MISSING_ITEMS: { label: 'Thiếu sản phẩm · Tạm giữ', cls: 'warehouseBadge warehouseRejected' },
}

const STAGE_TABS = [
  { id: 'need_action', label: 'Cần shop xử lý' },
  { id: 'warehouse_transit', label: 'Chờ hàng về & Kiểm định kho' },
  { id: 'dispute', label: 'Khiếu nại / Trọng tài' },
  { id: 'completed', label: 'Đã hoàn tất / Đóng' },
  { id: 'all', label: 'Tất cả yêu cầu' },
]

function buildInitialDemoReturns(baseTime) {
  return [
    {
      id: 'RET-261125-001',
      orderId: 'SHP-261124-088',
      channel: 'SHOPEE',
      rawStatus: 'REQUESTED',
      validationType: 'seller_validation',
      solution: 'RETURN_REFUND',
      buyerUsername: 'minhanh_99',
      reason: 'DAMAGED_FAULTY',
      reasonText: 'Hàng bị lỗi / hư hỏng khi mở hộp',
      refundAmount: 490000,
      reverseShippingFee: 28000,
      trackingNumber: '',
      negotiationStatus: 'TERMINATED',
      offerAmount: null,
      compensationStatus: null,
      arbitrationStatus: null,
      createdAt: baseTime - 22 * HOUR_MS,
      updatedAt: baseTime - 22 * HOUR_MS,
      dueDate: baseTime + 5.5 * HOUR_MS,
      warehouseInspection: null,
      buyerProofImages: ['https://cf.shopee.vn/file/demo-proof-1.jpg', 'https://cf.shopee.vn/file/demo-proof-2.jpg'],
      sellerProofImages: [],
      rulingNotes: '',
      records: [
        { at: baseTime - 22 * HOUR_MS, actor: 'BUYER', note: 'Người mua gửi yêu cầu Trả hàng & Hoàn tiền (DAMAGED_FAULTY)' },
      ],
      items: [
        { sku: 'SO-ANC-BLK-1Y', name: 'Tai nghe chống ồn ANC Pro', variant: 'Đen · BH 1 năm', qty: 1, price: 490000, refundAmount: 490000 },
      ],
    },
    {
      id: 'TT-RET-994012',
      orderId: 'TT-576291038211',
      channel: 'TIKTOK',
      rawStatus: 'BUYER_SHIPPED_ITEM',
      validationType: 'seller_validation',
      solution: 'RETURN_AND_REFUND',
      buyerUsername: 'quocbao_hn',
      reason: 'NOT_AS_DESCRIBED',
      reasonText: 'Sản phẩm không đúng mô tả',
      refundAmount: 689000,
      reverseShippingFee: 0,
      trackingNumber: 'SIMRET884920112',
      negotiationStatus: null,
      offerAmount: null,
      compensationStatus: null,
      arbitrationStatus: 'NO_ARBITRATION',
      createdAt: baseTime - 60 * HOUR_MS,
      updatedAt: baseTime - 3 * HOUR_MS,
      dueDate: baseTime + 18 * HOUR_MS,
      warehouseInspection: { id: 301, status: 'PENDING', restocked: false },
      buyerProofImages: ['https://p16-oec-va.tiktokcdn.com/demo-buyer-proof.jpg'],
      sellerProofImages: [],
      rulingNotes: '',
      records: [
        { at: baseTime - 60 * HOUR_MS, actor: 'BUYER', note: 'NEW -> RETURN_OR_REFUND_REQUEST_PENDING' },
        { at: baseTime - 48 * HOUR_MS, actor: 'SELLER', note: 'Chấp nhận trả hàng (APPROVE_RETURN -> AWAITING_BUYER_SHIP)' },
        { at: baseTime - 3 * HOUR_MS, actor: 'BUYER', note: 'Khách đã gửi hoàn qua ĐVVC (SIMRET884920112)' },
      ],
      items: [
        { sku: 'SO-ANC-BLK-1Y', name: 'Tai nghe chống ồn ANC Pro', variant: 'Đen · BH 1 năm', qty: 1, price: 490000, refundAmount: 490000 },
        { sku: 'SO-CHG-15W', name: 'Đế sạc không dây 15W MagSafe', variant: 'Trắng', qty: 1, price: 199000, refundAmount: 199000 },
      ],
    },
    {
      id: 'TT-RET-994155',
      orderId: 'TT-576291044009',
      channel: 'TIKTOK',
      rawStatus: 'RETURN_OR_REFUND_REQUEST_PENDING',
      validationType: 'seller_validation',
      solution: 'REFUND',
      buyerUsername: 'thaovy_sg',
      reason: 'DAMAGED_ITEM',
      reasonText: 'Hàng bị lỗi hoặc hư hỏng (Chỉ hoàn tiền)',
      refundAmount: 199000,
      reverseShippingFee: 0,
      trackingNumber: '',
      negotiationStatus: null,
      offerAmount: null,
      compensationStatus: null,
      arbitrationStatus: 'NO_ARBITRATION',
      createdAt: baseTime - 10 * HOUR_MS,
      updatedAt: baseTime - 10 * HOUR_MS,
      dueDate: baseTime + 38 * HOUR_MS,
      warehouseInspection: null,
      buyerProofImages: ['https://p16-oec-va.tiktokcdn.com/demo-refund-only.jpg'],
      sellerProofImages: [],
      rulingNotes: '',
      records: [
        { at: baseTime - 10 * HOUR_MS, actor: 'BUYER', note: 'NEW -> RETURN_OR_REFUND_REQUEST_PENDING (REFUND)' },
      ],
      items: [
        { sku: 'SO-CHG-15W', name: 'Đế sạc không dây 15W MagSafe', variant: 'Trắng', qty: 1, price: 199000, refundAmount: 199000 },
      ],
    },
    {
      id: 'RET-261123-019',
      orderId: 'SHP-261120-042',
      channel: 'SHOPEE',
      rawStatus: 'PROCESSING',
      validationType: 'warehouse_validation',
      solution: 'RETURN_REFUND',
      buyerUsername: 'hoangnam_q1',
      reason: 'CHANGE_OF_MIND',
      reasonText: 'Đổi ý (Sản phẩm còn nguyên tem, nhãn mác)',
      refundAmount: 650000,
      reverseShippingFee: 32000,
      trackingNumber: 'SPXRET09281726',
      negotiationStatus: 'TERMINATED',
      offerAmount: null,
      compensationStatus: null,
      arbitrationStatus: null,
      createdAt: baseTime - 42 * HOUR_MS,
      updatedAt: baseTime - 8 * HOUR_MS,
      dueDate: null,
      warehouseInspection: { id: 302, status: 'PENDING', restocked: false },
      buyerProofImages: [],
      sellerProofImages: [],
      rulingNotes: 'Kho Shopee đã duyệt nhận hàng hoàn · Đang chờ kiểm định nhập kho SmartOmni.',
      records: [
        { at: baseTime - 42 * HOUR_MS, actor: 'BUYER', note: 'Gửi yêu cầu qua luồng warehouse_validation -> JUDGING' },
        { at: baseTime - 20 * HOUR_MS, actor: 'SHOPEE_ADMIN', note: 'Trọng tài Shopee duyệt cho trả hàng -> PROCESSING' },
      ],
      items: [
        { sku: 'SO-CAM-4K', name: 'Camera hành trình 4K Wi-Fi', variant: 'Bản chuẩn', qty: 1, price: 650000, refundAmount: 650000 },
        { sku: 'SO-SD-64G', name: 'Thẻ nhớ microSD 64GB Class 10', variant: '64GB', qty: 1, price: 120000, refundAmount: 0 },
        { sku: 'SO-MOUNT-01', name: 'Ngàm gắn kính lái hút chân không', variant: 'Đen', qty: 1, price: 0, refundAmount: 0 },
      ],
    },
    {
      id: 'RET-261122-007',
      orderId: 'SHP-261118-011',
      channel: 'SHOPEE',
      rawStatus: 'SELLER_DISPUTE',
      validationType: 'seller_validation',
      solution: 'RETURN_REFUND',
      buyerUsername: 'khanhtran_dn',
      reason: 'DAMAGED_FAULTY',
      reasonText: 'Khách báo sản phẩm không lên nguồn',
      refundAmount: 550000,
      reverseShippingFee: 28000,
      trackingNumber: 'SPXRET09280011',
      negotiationStatus: 'TERMINATED',
      offerAmount: null,
      compensationStatus: null,
      arbitrationStatus: null,
      createdAt: baseTime - 72 * HOUR_MS,
      updatedAt: baseTime - 14 * HOUR_MS,
      dueDate: baseTime + 20 * HOUR_MS,
      warehouseInspection: { id: 303, status: 'SWAPPED', restocked: false },
      buyerProofImages: ['https://cf.shopee.vn/file/demo-dispute-buyer.jpg'],
      sellerProofImages: ['https://cf.shopee.vn/file/demo-unbox-seller.jpg'],
      rulingNotes: 'Shop đã gửi khiếu nại (INCORRECT_CLAIM #50): Khách hoàn trả sai mẫu cũ.',
      records: [
        { at: baseTime - 72 * HOUR_MS, actor: 'BUYER', note: 'Yêu cầu trả hàng & hoàn tiền' },
        { at: baseTime - 14 * HOUR_MS, actor: 'SELLER', note: 'Khiếu nại lên Shopee (ID 50: INCORRECT_CLAIM)' },
      ],
      items: [
        { sku: 'SO-ANC-BLK-2Y', name: 'Tai nghe chống ồn ANC Pro', variant: 'Đen · BH 2 năm', qty: 1, price: 550000, refundAmount: 550000 },
      ],
    },
    {
      id: 'TT-RET-993800',
      orderId: 'TT-576290980010',
      channel: 'TIKTOK',
      rawStatus: 'RETURN_OR_REFUND_REQUEST_COMPLETE',
      validationType: 'seller_validation',
      solution: 'RETURN_AND_REFUND',
      buyerUsername: 'mailinh_ct',
      reason: 'WRONG_ITEM',
      reasonText: 'Giao sai hàng',
      refundAmount: 199000,
      reverseShippingFee: 0,
      trackingNumber: 'SIMRET771002211',
      negotiationStatus: null,
      offerAmount: null,
      compensationStatus: null,
      arbitrationStatus: 'NO_ARBITRATION',
      createdAt: baseTime - 120 * HOUR_MS,
      updatedAt: baseTime - 40 * HOUR_MS,
      dueDate: null,
      warehouseInspection: { id: 304, status: 'MATCHED', restocked: true },
      buyerProofImages: [],
      sellerProofImages: [],
      rulingNotes: '',
      records: [
        { at: baseTime - 120 * HOUR_MS, actor: 'BUYER', note: 'Yêu cầu trả hàng hoàn tiền' },
        { at: baseTime - 40 * HOUR_MS, actor: 'OPERATOR', note: 'Hoàn tiền thành công -> COMPLETE' },
      ],
      items: [
        { sku: 'SO-CHG-15W', name: 'Đế sạc không dây 15W MagSafe', variant: 'Trắng', qty: 1, price: 199000, refundAmount: 199000 },
      ],
    },
  ]
}

function getReturnMeta(ret) {
  const s = ret.rawStatus
  if (ret.channel === 'SHOPEE') {
    if (s === 'REQUESTED') return { label: 'Chờ shop phản hồi', cls: 'statusAction', stage: 'need_action', needsSellerAction: true }
    if (s === 'PROCESSING') return { label: 'Đang hoàn hàng về', cls: 'statusTransit', stage: 'warehouse_transit', canConfirm: true, canDispute: true }
    if (s === 'JUDGING') return { label: 'Shopee đang thẩm định', cls: 'statusDispute', stage: 'dispute' }
    if (s === 'SELLER_DISPUTE') return { label: 'Shop đang khiếu nại', cls: 'statusDispute', stage: 'dispute', canCancelDispute: true }
    if (s === 'ACCEPTED') {
      return ret.compensationStatus === 'COMPENSATION_REQUESTED'
        ? { label: 'Đã hoàn · Đang yêu cầu bồi thường', cls: 'statusDispute', stage: 'dispute' }
        : { label: 'Đã chấp nhận hoàn tiền', cls: 'statusSuccess', stage: 'completed', canDispute: true }
    }
    if (s === 'CLOSED' || s === 'CANCELLED') return { label: s === 'CANCELLED' ? 'Đã hủy yêu cầu' : 'Đã đóng', cls: 'statusClosed', stage: 'completed' }
  }
  if (s === 'RETURN_OR_REFUND_REQUEST_PENDING') return { label: 'Chờ shop duyệt', cls: 'statusAction', stage: 'need_action', needsSellerAction: true }
  if (s === 'BUYER_SHIPPED_ITEM') return { label: 'Khách đã gửi · Chờ xác nhận nhận', cls: 'statusAction', stage: 'need_action', needsSellerAction: true }
  if (s === 'AWAITING_BUYER_SHIP') return { label: 'Chờ khách gửi hàng hoàn', cls: 'statusTransit', stage: 'warehouse_transit' }
  if (s === 'RETURN_OR_REFUND_REQUEST_SUCCESS' || s === 'RETURN_OR_REFUND_REQUEST_COMPLETE') return { label: 'Đã hoàn tiền', cls: 'statusSuccess', stage: 'completed' }
  if (s === 'REFUND_OR_RETURN_REQUEST_REJECT' || s === 'REJECT_RECEIVE_PACKAGE' || s === 'RETURN_OR_REFUND_REQUEST_CANCEL') {
    return { label: s === 'RETURN_OR_REFUND_REQUEST_CANCEL' ? 'Khách đã hủy' : 'Shop đã từ chối', cls: 'statusClosed', stage: ret.arbitrationStatus === 'IN_ARBITRATION' ? 'dispute' : 'completed' }
  }
  return { label: s, cls: 'statusClosed', stage: 'all' }
}

function getDueBadge(ret, now) {
  if (!ret.dueDate || ['completed'].includes(getReturnMeta(ret).stage)) return null
  const diff = ret.dueDate - now
  if (diff < 0) return { urgent: true, cls: 'slaOverdue', label: 'Quá hạn phản hồi' }
  const hrs = Math.max(1, Math.round(diff / HOUR_MS))
  if (hrs <= 24) return { urgent: true, cls: 'slaUrgent', label: `Còn ${hrs} giờ` }
  return { urgent: false, cls: 'slaOk', label: `Còn ${hrs} giờ` }
}

export default function ReturnHubDemo() {
  const [returns, setReturns] = useState(() => buildInitialDemoReturns(Date.now()))
  const [now, setNow] = useState(() => Date.now())
  const [channel, setChannel] = useState('ALL')
  const [stage, setStage] = useState('need_action')
  const [urgentOnly, setUrgentOnly] = useState(false)
  const [sortBy, setSortBy] = useState('DUE_ASC')
  const [query, setQuery] = useState('')
  const [feedback, setFeedback] = useState(null)

  const [detailId, setDetailId] = useState(null)
  const [disputeTarget, setDisputeTarget] = useState(null)
  const [disputeReasonId, setDisputeReasonId] = useState('50')
  const [disputeEmail, setDisputeEmail] = useState('owner@smartomni.vn')
  const [disputeText, setDisputeText] = useState('')
  const [disputeProof, setDisputeProof] = useState('https://cf.shopee.vn/file/shop-evidence.jpg')

  const [offerTarget, setOfferTarget] = useState(null)
  const [offerAmount, setOfferAmount] = useState('')
  const [offerReason, setOfferReason] = useState('')

  const [tiktokRejectTarget, setTiktokRejectTarget] = useState(null)
  const [tiktokRejectReason, setTiktokRejectReason] = useState('ITEM_AS_DESCRIBED')

  const [inspectTarget, setInspectTarget] = useState(null)
  const [inspectResult, setInspectResult] = useState('MATCHED')
  const [inspectVideo, setInspectVideo] = useState('')

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [])

  const enriched = useMemo(() => {
    return returns.map(r => {
      const meta = getReturnMeta(r)
      const isDispute = meta.stage === 'dispute' || r.arbitrationStatus === 'IN_ARBITRATION'
      return {
        ...r,
        meta,
        isDispute,
        due: getDueBadge(r, now),
        needsWarehouseInspect: r.warehouseInspection?.status === 'PENDING',
      }
    })
  }, [returns, now])

  const kpis = useMemo(() => {
    const open = enriched.filter(r => r.meta.stage !== 'completed')
    return {
      needAction: enriched.filter(r => r.meta.needsSellerAction).length,
      urgentDue: enriched.filter(r => r.due?.urgent).length,
      warehouseTransit: enriched.filter(r => r.meta.stage === 'warehouse_transit' || r.needsWarehouseInspect).length,
      dispute: enriched.filter(r => r.isDispute).length,
      openRefundTotal: open.reduce((sum, r) => sum + Number(r.refundAmount || 0), 0),
    }
  }, [enriched])

  const stageCounts = useMemo(() => {
    const counts = { need_action: 0, warehouse_transit: 0, dispute: 0, completed: 0, all: 0 }
    for (const r of enriched) {
      if (channel !== 'ALL' && r.channel !== channel) continue
      counts.all += 1
      if (r.isDispute) counts.dispute += 1
      else if (counts[r.meta.stage] != null) counts[r.meta.stage] += 1
    }
    return counts
  }, [enriched, channel])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = enriched.filter(r => {
      if (channel !== 'ALL' && r.channel !== channel) return false
      if (urgentOnly && !r.due?.urgent) return false
      if (stage === 'dispute') {
        if (!r.isDispute) return false
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
        const aDue = a.due ? a.dueDate : Number.MAX_SAFE_INTEGER
        const bDue = b.due ? b.dueDate : Number.MAX_SAFE_INTEGER
        if (aDue !== bDue) return aDue - bDue
        return b.createdAt - a.createdAt
      }
      if (sortBy === 'AMOUNT_DESC') return b.refundAmount - a.refundAmount
      return b.createdAt - a.createdAt
    })
  }, [enriched, channel, stage, urgentOnly, sortBy, query])

  const detailItem = useMemo(() => enriched.find(r => r.id === detailId) || null, [enriched, detailId])

  function confirmShopeeReturn(ret) {
    setReturns(prev => prev.map(r => (r.id === ret.id ? {
      ...r,
      rawStatus: 'ACCEPTED',
      negotiationStatus: 'TERMINATED',
      updatedAt: Date.now(),
      records: [...r.records, { at: Date.now(), actor: 'SELLER', note: 'Shop chấp nhận hoàn tiền (confirm -> ACCEPTED)' }],
    } : r)))
    setFeedback({ message: `Đã chấp nhận hoàn tiền ${money(ret.refundAmount)} cho yêu cầu Shopee ${ret.id}.` })
  }

  function submitShopeeOffer(event) {
    event.preventDefault()
    if (!offerTarget) return
    const amt = Number(offerAmount)
    if (!amt || amt <= 0 || amt > offerTarget.refundAmount) return
    setReturns(prev => prev.map(r => (r.id === offerTarget.id ? {
      ...r,
      negotiationStatus: 'PENDING_BUYER_RESPOND',
      offerAmount: amt,
      updatedAt: Date.now(),
      records: [...r.records, { at: Date.now(), actor: 'SELLER', note: `Đề xuất hoàn một phần ${money(amt)}: ${offerReason || 'Thương lượng'}` }],
    } : r)))
    setFeedback({ message: `Đã gửi đề xuất hoàn tiền một phần (${money(amt)}) cho ${offerTarget.id}.` })
    setOfferTarget(null)
  }

  function submitShopeeDispute(event) {
    event.preventDefault()
    if (!disputeTarget) return
    const def = SHOPEE_DISPUTE_REASONS.find(d => d.id === Number(disputeReasonId))
    const isPostAccept = disputeTarget.rawStatus === 'ACCEPTED'
    setReturns(prev => prev.map(r => (r.id === disputeTarget.id ? {
      ...r,
      rawStatus: isPostAccept ? 'ACCEPTED' : 'SELLER_DISPUTE',
      compensationStatus: isPostAccept ? 'COMPENSATION_REQUESTED' : r.compensationStatus,
      sellerProofImages: disputeProof.split('\n').map(s => s.trim()).filter(Boolean),
      rulingNotes: `Shop khiếu nại (${def?.code} #${disputeReasonId}): ${disputeText}`,
      updatedAt: Date.now(),
      records: [...r.records, { at: Date.now(), actor: 'SELLER', note: `Gửi khiếu nại #${disputeReasonId} (${def?.code})` }],
    } : r)))
    setFeedback({ message: `Đã gửi khiếu nại lên Shopee cho yêu cầu ${disputeTarget.id}.` })
    setDisputeTarget(null)
  }

  function cancelShopeeDispute(ret) {
    setReturns(prev => prev.map(r => (r.id === ret.id ? {
      ...r,
      rawStatus: 'REQUESTED',
      updatedAt: Date.now(),
      records: [...r.records, { at: Date.now(), actor: 'SELLER', note: 'Shop rút khiếu nại (cancel_dispute -> REQUESTED)' }],
    } : r)))
    setFeedback({ message: `Đã hủy khiếu nại cho ${ret.id}, yêu cầu quay lại trạng thái Chờ shop phản hồi.` })
  }

  function approveTiktokReturn(ret) {
    const nextStatus = ret.rawStatus === 'BUYER_SHIPPED_ITEM'
      ? 'RETURN_OR_REFUND_REQUEST_SUCCESS'
      : ret.solution === 'REFUND'
        ? 'RETURN_OR_REFUND_REQUEST_SUCCESS'
        : 'AWAITING_BUYER_SHIP'
    setReturns(prev => prev.map(r => (r.id === ret.id ? {
      ...r,
      rawStatus: nextStatus,
      updatedAt: Date.now(),
      records: [...r.records, { at: Date.now(), actor: 'SELLER', note: `Duyệt yêu cầu TikTok -> ${nextStatus}` }],
    } : r)))
    setFeedback({ message: `Đã duyệt yêu cầu TikTok ${ret.id} (${nextStatus}).` })
  }

  function submitTiktokReject(event) {
    event.preventDefault()
    if (!tiktokRejectTarget) return
    const nextStatus = tiktokRejectTarget.rawStatus === 'BUYER_SHIPPED_ITEM'
      ? 'REJECT_RECEIVE_PACKAGE'
      : 'REFUND_OR_RETURN_REQUEST_REJECT'
    setReturns(prev => prev.map(r => (r.id === tiktokRejectTarget.id ? {
      ...r,
      rawStatus: nextStatus,
      updatedAt: Date.now(),
      records: [...r.records, { at: Date.now(), actor: 'SELLER', note: `Từ chối (${tiktokRejectReason}) -> ${nextStatus}` }],
    } : r)))
    setFeedback({ message: `Đã từ chối yêu cầu TikTok ${tiktokRejectTarget.id}.` })
    setTiktokRejectTarget(null)
  }

  function submitWarehouseInspection(event) {
    event.preventDefault()
    if (!inspectTarget) return
    const matched = inspectResult === 'MATCHED'
    setReturns(prev => prev.map(r => (r.id === inspectTarget.id ? {
      ...r,
      warehouseInspection: { ...r.warehouseInspection, status: inspectResult, restocked: matched },
      updatedAt: Date.now(),
      records: [...r.records, {
        at: Date.now(),
        actor: 'WAREHOUSE',
        note: matched ? 'Kiểm định kho ĐẠT -> Đã cộng trả tồn kho' : `Kiểm định kho TỪ CHỐI (${inspectResult}) -> Không cộng kho`,
      }],
    } : r)))
    setFeedback({
      message: matched
        ? `Kiểm định kho ĐẠT cho ${inspectTarget.id}. Đã cộng trả tồn kho SmartOmni.`
        : `Đã lưu kết quả kiểm định (${inspectResult}) cho ${inspectTarget.id}. Tồn kho được giữ nguyên.`,
    })
    setInspectTarget(null)
  }

  return (
    <div className={demo.hub}>
      <div className={demo.banner}>
        <div className={demo.bannerTitle}>
          <span className={demo.demoTag}>Bản Demo UI</span>
          <span>
            Trung tâm Hoàn trả &amp; Hoàn tiền hợp nhất (Shopee · TikTok Shop · Kiểm định kho SmartOmni) · Dữ liệu mẫu tương tác tại chỗ.
          </span>
        </div>
        <Button variant="outline" onClick={() => {
          setReturns(buildInitialDemoReturns(Date.now()))
          setChannel('ALL')
          setStage('need_action')
          setUrgentOnly(false)
          setFeedback({ message: 'Đã đặt lại dữ liệu demo ban đầu.' })
        }}>
          <RefreshCw size={14} /> Đặt lại dữ liệu demo
        </Button>
      </div>

      <OwnerPanel title="Tổng quan Hoàn trả &amp; Hoàn tiền toàn shop">
        <div className={demo.kpiGrid}>
          <button
            type="button"
            className={`${demo.kpiCard} ${demo.kpiAction} ${stage === 'need_action' && !urgentOnly ? demo.kpiCardActive : ''}`}
            onClick={() => { setStage('need_action'); setUrgentOnly(false) }}
          >
            <span className={demo.kpiLabel}>Cần shop xử lý ngay <AlertTriangle size={14} color="#dc2626" /></span>
            <span className={demo.kpiValue}>{kpis.needAction}</span>
            <span className={demo.kpiHint}>Chờ duyệt / xác nhận nhận hàng</span>
          </button>

          <button
            type="button"
            className={`${demo.kpiCard} ${demo.kpiUrgent} ${urgentOnly ? demo.kpiCardActive : ''}`}
            onClick={() => { setStage('all'); setUrgentOnly(!urgentOnly) }}
          >
            <span className={demo.kpiLabel}>Sắp hết hạn (&le; 24 giờ) <Clock size={14} color="#d97706" /></span>
            <span className={demo.kpiValue}>{kpis.urgentDue}</span>
            <span className={demo.kpiHint}>Tránh sàn tự động hoàn tiền</span>
          </button>

          <button
            type="button"
            className={`${demo.kpiCard} ${demo.kpiWarehouse} ${stage === 'warehouse_transit' ? demo.kpiCardActive : ''}`}
            onClick={() => { setStage('warehouse_transit'); setUrgentOnly(false) }}
          >
            <span className={demo.kpiLabel}>Chờ hàng về &amp; Kiểm định kho <PackageCheck size={14} color="#2563eb" /></span>
            <span className={demo.kpiValue}>{kpis.warehouseTransit}</span>
            <span className={demo.kpiHint}>Chờ nhận kiện hoàn &amp; nhập kho</span>
          </button>

          <button
            type="button"
            className={`${demo.kpiCard} ${demo.kpiDispute} ${stage === 'dispute' ? demo.kpiCardActive : ''}`}
            onClick={() => { setStage('dispute'); setUrgentOnly(false) }}
          >
            <span className={demo.kpiLabel}>Khiếu nại / Trọng tài <Scale size={14} color="#7c3aed" /></span>
            <span className={demo.kpiValue}>{kpis.dispute}</span>
            <span className={demo.kpiHint}>Đang chờ sàn phân xử</span>
          </button>

          <button
            type="button"
            className={`${demo.kpiCard} ${demo.kpiTotal} ${stage === 'all' && !urgentOnly ? demo.kpiCardActive : ''}`}
            onClick={() => { setStage('all'); setUrgentOnly(false) }}
          >
            <span className={demo.kpiLabel}>Tổng tiền đang chờ xử lý <ShieldAlert size={14} /></span>
            <span className={demo.kpiValue}>{money(kpis.openRefundTotal)}</span>
            <span className={demo.kpiHint}>Giá trị hoàn trả các đơn đang mở</span>
          </button>
        </div>
      </OwnerPanel>

      <OwnerPanel title="Danh sách yêu cầu Hoàn trả &amp; Hoàn tiền">
        <div className={demo.stageTabs} role="tablist" aria-label="Nhóm trạng thái hoàn trả">
          {STAGE_TABS.map(tab => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={stage === tab.id}
              className={`${demo.stageTab} ${stage === tab.id ? demo.stageTabActive : ''}`}
              onClick={() => { setStage(tab.id); setUrgentOnly(false) }}
            >
              <span>{tab.label}</span>
              <span className={demo.stageCount}>{stageCounts[tab.id] ?? 0}</span>
            </button>
          ))}
        </div>

        <div className={styles.filters}>
          <label className={styles.field}>
            Nguồn sàn
            <select value={channel} onChange={e => setChannel(e.target.value)}>
              <option value="ALL">Tất cả sàn (Shopee &amp; TikTok Shop)</option>
              <option value="SHOPEE">Shopee</option>
              <option value="TIKTOK">TikTok Shop</option>
            </select>
          </label>

          <label className={styles.field}>
            Sắp xếp theo
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="DUE_ASC">Hạn phản hồi gần nhất</option>
              <option value="NEWEST">Mới nhất</option>
              <option value="AMOUNT_DESC">Số tiền hoàn cao nhất</option>
            </select>
          </label>

          <label className={styles.field}>
            Tìm kiếm nhanh
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Mã hoàn trả, mã đơn, người mua hoặc SKU"
            />
          </label>
        </div>

        <Feedback value={feedback} />

        {visible.length ? (
          <DataTable
            label="Danh sách hoàn trả hợp nhất"
            headings={['Yêu cầu / Kênh', 'Sản phẩm hoàn', 'Tiền hoàn', 'Trạng thái & Hạn xử lý', 'Lý do & Kiểm định kho', 'Thao tác']}
          >
            {visible.map(ret => {
              const shownItems = ret.items.slice(0, MAX_VISIBLE_ITEMS)
              const extraCount = ret.items.length - shownItems.length
              const wh = ret.warehouseInspection ? WAREHOUSE_RESULTS[ret.warehouseInspection.status] : null
              const rowCls = ret.isDispute ? demo.rowDispute : ret.due?.urgent ? demo.rowUrgent : ''
              return (
                <tr key={ret.id} className={rowCls}>
                  <td>
                    <strong>{ret.id}</strong>
                    <p className={styles.note}>Đơn: {ret.orderId}</p>
                    <p>
                      <span className={`${demo.channelBadge} ${ret.channel === 'SHOPEE' ? demo.channelShopee : demo.channelTiktok}`}>
                        {ret.channel === 'SHOPEE' ? 'Shopee' : 'TikTok Shop'}
                      </span>
                      <span className={demo.typeBadge}>
                        {ret.solution === 'REFUND' ? 'Chỉ hoàn tiền' : 'Trả hàng & Hoàn tiền'}
                      </span>
                    </p>
                    <p className={styles.note}>Người mua: {ret.buyerUsername}</p>
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
                        <button type="button" className={demo.moreItemsBtn} onClick={() => setDetailId(ret.id)}>
                          … (+{extraCount} sản phẩm khác)
                        </button>
                      )}
                    </div>
                  </td>
                  <td>
                    <strong>{money(ret.refundAmount)}</strong>
                    {ret.offerAmount && <p className={styles.note}>Đề xuất: {money(ret.offerAmount)}</p>}
                    {ret.reverseShippingFee > 0 && <p className={styles.note}>Phí ship hoàn: {money(ret.reverseShippingFee)}</p>}
                  </td>
                  <td>
                    <span className={`${demo.statusBadge} ${demo[ret.meta.cls]}`}>{ret.meta.label}</span>
                    {ret.due && (
                      <p>
                        <span className={`${demo.slaBadge} ${demo[ret.due.cls]}`}>
                          <Clock size={11} /> {ret.due.label}
                        </span>
                      </p>
                    )}
                    {ret.dueDate && <p className={styles.note}>Hạn: {dateTime(ret.dueDate)}</p>}
                    {ret.trackingNumber && <p className={styles.note}>Mã hoàn: <strong>{ret.trackingNumber}</strong></p>}
                  </td>
                  <td>
                    <span>{ret.reasonText || ret.reason}</span>
                    {wh && (
                      <div>
                        <span className={wh.cls.split(' ').map(c => demo[c]).join(' ')}>
                          <CheckCircle2 size={11} /> {wh.label}
                        </span>
                      </div>
                    )}
                    {ret.rulingNotes && <p className={styles.note}>{ret.rulingNotes}</p>}
                  </td>
                  <td>
                    <div className={styles.actions}>
                      {ret.channel === 'SHOPEE' && (ret.rawStatus === 'REQUESTED' || ret.meta.canConfirm) && (
                        <Button onClick={() => confirmShopeeReturn(ret)}>Chấp nhận hoàn</Button>
                      )}
                      {ret.channel === 'SHOPEE' && (ret.rawStatus === 'REQUESTED' || ret.rawStatus === 'PROCESSING') && ret.negotiationStatus !== 'PENDING_BUYER_RESPOND' && (
                        <Button variant="outline" onClick={() => { setOfferTarget(ret); setOfferAmount(String(Math.round(ret.refundAmount * 0.5))); setOfferReason('') }}>
                          Đề xuất hoàn 1 phần
                        </Button>
                      )}
                      {ret.channel === 'SHOPEE' && ['REQUESTED', 'PROCESSING', 'ACCEPTED'].includes(ret.rawStatus) && ret.compensationStatus !== 'COMPENSATION_REQUESTED' && (
                        <Button variant="outline" onClick={() => { setDisputeTarget(ret); setDisputeText('') }}>
                          Khiếu nại
                        </Button>
                      )}
                      {ret.meta.canCancelDispute && (
                        <Button variant="outline" onClick={() => cancelShopeeDispute(ret)}>Rút khiếu nại</Button>
                      )}
                      {ret.channel === 'TIKTOK' && ret.meta.needsSellerAction && (
                        <>
                          <Button onClick={() => approveTiktokReturn(ret)}>
                            {ret.rawStatus === 'BUYER_SHIPPED_ITEM' ? 'Xác nhận đã nhận hàng' : 'Chấp nhận'}
                          </Button>
                          <Button variant="destructive" onClick={() => setTiktokRejectTarget(ret)}>Từ chối</Button>
                        </>
                      )}
                      {ret.needsWarehouseInspect && (
                        <Button variant="outline" onClick={() => { setInspectTarget(ret); setInspectResult('MATCHED'); setInspectVideo('') }}>
                          Kiểm định kho
                        </Button>
                      )}
                      <Button variant="outline" onClick={() => setDetailId(ret.id)}>Chi tiết</Button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </DataTable>
        ) : (
          <p className={styles.empty}>Không có yêu cầu hoàn trả nào khớp bộ lọc hiện tại.</p>
        )}
      </OwnerPanel>

      {/* Modal: Chi tiết yêu cầu hoàn trả */}
      <Dialog open={Boolean(detailItem)} onOpenChange={open => { if (!open) setDetailId(null) }}>
        <DialogContent className={`${styles.dialog} ${styles.marketplaceDialog} ${demo.detailDialog}`}>
          <DialogTitle>Chi tiết yêu cầu {detailItem?.id}</DialogTitle>
          <DialogDescription>
            {detailItem?.channel === 'SHOPEE' ? 'Shopee' : 'TikTok Shop'} · Đơn {detailItem?.orderId} · {detailItem?.meta.label}
          </DialogDescription>
          {detailItem && (
            <>
              <div className={demo.detailMeta}>
                <div>Người mua<strong>{detailItem.buyerUsername}</strong><span>{detailItem.solution === 'REFUND' ? 'Chỉ hoàn tiền' : 'Trả hàng & Hoàn tiền'}</span></div>
                <div>Tiền hoàn dự kiến<strong>{money(detailItem.refundAmount)}</strong><span>Phí ship hoàn: {money(detailItem.reverseShippingFee)}</span></div>
                <div>Vận đơn hoàn<strong>{detailItem.trackingNumber || 'Chưa có'}</strong><span>{detailItem.validationType === 'warehouse_validation' ? 'Kho sàn thẩm định' : 'Shop thẩm định'}</span></div>
              </div>
              <p><strong>Lý do:</strong> {detailItem.reasonText} ({detailItem.reason})</p>
              {detailItem.rulingNotes && <p className={demo.noteBox}>{detailItem.rulingNotes}</p>}
              <DataTable label="Sản phẩm yêu cầu hoàn" headings={['SKU / Sản phẩm', 'SL', 'Đơn giá', 'Tiền hoàn']}>
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
                <strong>Bằng chứng người mua:</strong>
                {detailItem.buyerProofImages.length ? (
                  <ul className={demo.proofList}>
                    {detailItem.buyerProofImages.map((url, i) => (
                      <li key={i}><a href={url} target="_blank" rel="noreferrer">Ảnh bằng chứng {i + 1}</a></li>
                    ))}
                  </ul>
                ) : <p className={styles.note}>Không có ảnh bằng chứng từ người mua.</p>}
              </div>
              <div>
                <strong>Lịch sử xử lý:</strong>
                <ul className={demo.timeline}>
                  {detailItem.records.map((rec, i) => (
                    <li key={i}>{dateTime(rec.at)} · <strong>{rec.actor}</strong>: {rec.note}</li>
                  ))}
                </ul>
              </div>
              <div className={styles.actions}>
                <Button variant="secondary" onClick={() => setDetailId(null)}>Đóng</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal: Shopee Khiếu nại (Dispute Reason 47..52) */}
      <Dialog open={Boolean(disputeTarget)} onOpenChange={open => { if (!open) setDisputeTarget(null) }}>
        <DialogContent className={`${styles.dialog} ${styles.marketplaceDialog}`}>
          <DialogTitle>Khiếu nại lên Shopee</DialogTitle>
          <DialogDescription>Yêu cầu {disputeTarget?.id} · Chọn lý do khiếu nại chính thức của Shopee</DialogDescription>
          <form className={styles.form} onSubmit={submitShopeeDispute}>
            <label className={styles.field}>
              Lý do khiếu nại (Shopee)
              <select value={disputeReasonId} onChange={e => setDisputeReasonId(e.target.value)}>
                {SHOPEE_DISPUTE_REASONS.map(r => (
                  <option key={r.id} value={r.id}>#{r.id} · {r.label}</option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              Giải trình chi tiết
              <textarea required maxLength={2000} value={disputeText} onChange={e => setDisputeText(e.target.value)} placeholder="Mô tả tình trạng hàng hoàn hoặc bằng chứng giao hàng..." />
            </label>
            <label className={styles.field}>
              Email liên hệ
              <input required type="email" value={disputeEmail} onChange={e => setDisputeEmail(e.target.value)} />
            </label>
            <label className={styles.field}>
              Link ảnh bằng chứng (HTTPS, mỗi dòng 1 link)
              <textarea required value={disputeProof} onChange={e => setDisputeProof(e.target.value)} />
            </label>
            <div className={styles.actions}>
              <Button type="button" variant="secondary" onClick={() => setDisputeTarget(null)}>Quay lại</Button>
              <Button type="submit">Gửi khiếu nại lên Shopee</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Shopee Đề xuất hoàn tiền một phần */}
      <Dialog open={Boolean(offerTarget)} onOpenChange={open => { if (!open) setOfferTarget(null) }}>
        <DialogContent className={`${styles.dialog} ${styles.marketplaceDialog}`}>
          <DialogTitle>Đề xuất hoàn tiền một phần</DialogTitle>
          <DialogDescription>Yêu cầu {offerTarget?.id} · Tối đa {money(offerTarget?.refundAmount)}</DialogDescription>
          <form className={styles.form} onSubmit={submitShopeeOffer}>
            <label className={styles.field}>
              Số tiền đề xuất hoàn (VNĐ)
              <input type="number" required min="1000" max={offerTarget?.refundAmount || 1} value={offerAmount} onChange={e => setOfferAmount(e.target.value)} />
            </label>
            <label className={styles.field}>
              Lý do thương lượng
              <input type="text" value={offerReason} onChange={e => setOfferReason(e.target.value)} placeholder="Ví dụ: Hỗ trợ hoàn một phần, khách giữ lại sản phẩm" />
            </label>
            <div className={styles.actions}>
              <Button type="button" variant="secondary" onClick={() => setOfferTarget(null)}>Quay lại</Button>
              <Button type="submit">Gửi đề xuất</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: TikTok Từ chối yêu cầu */}
      <Dialog open={Boolean(tiktokRejectTarget)} onOpenChange={open => { if (!open) setTiktokRejectTarget(null) }}>
        <DialogContent className={`${styles.dialog} ${styles.marketplaceDialog}`}>
          <DialogTitle>Từ chối yêu cầu TikTok Shop</DialogTitle>
          <DialogDescription>Yêu cầu {tiktokRejectTarget?.id} · Đơn {tiktokRejectTarget?.orderId}</DialogDescription>
          <form className={styles.form} onSubmit={submitTiktokReject}>
            <label className={styles.field}>
              Lý do từ chối
              <select value={tiktokRejectReason} onChange={e => setTiktokRejectReason(e.target.value)}>
                {TIKTOK_REJECT_REASONS.map(r => (
                  <option key={r.name} value={r.name}>{r.text}</option>
                ))}
              </select>
            </label>
            <div className={styles.actions}>
              <Button type="button" variant="secondary" onClick={() => setTiktokRejectTarget(null)}>Quay lại</Button>
              <Button type="submit" variant="destructive">Xác nhận từ chối</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Kiểm định nhập kho SmartOmni */}
      <Dialog open={Boolean(inspectTarget)} onOpenChange={open => { if (!open) setInspectTarget(null) }}>
        <DialogContent className={`${styles.dialog} ${styles.marketplaceDialog}`}>
          <DialogTitle>Kiểm định hàng hoàn nhập kho</DialogTitle>
          <DialogDescription>Yêu cầu {inspectTarget?.id} · Đơn {inspectTarget?.orderId}</DialogDescription>
          <form className={styles.form} onSubmit={submitWarehouseInspection}>
            <label className={styles.field}>
              Kết quả kiểm định thực tế
              <select value={inspectResult} onChange={e => setInspectResult(e.target.value)}>
                <option value="MATCHED">Khớp hàng · Đạt chuẩn (Cộng trả tồn kho)</option>
                <option value="DAMAGED">Hàng bị hư hỏng (Không cộng kho)</option>
                <option value="SWAPPED">Bị tráo hàng (Không cộng kho)</option>
                <option value="MISSING_ITEMS">Thiếu sản phẩm (Không cộng kho)</option>
              </select>
            </label>
            <label className={styles.field}>
              Link video mở hộp (tùy chọn, HTTPS)
              <input type="url" value={inspectVideo} onChange={e => setInspectVideo(e.target.value)} placeholder="https://..." />
            </label>
            <div className={styles.actions}>
              <Button type="button" variant="secondary" onClick={() => setInspectTarget(null)}>Quay lại</Button>
              <Button type="submit">{inspectResult === 'MATCHED' ? 'Xác nhận & Nhập kho' : 'Lưu kết quả kiểm định'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
