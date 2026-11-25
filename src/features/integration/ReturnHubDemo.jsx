import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Clock, PackageCheck, RefreshCw, Scale, ShieldAlert } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog'
import { DataTable, Feedback, OwnerPanel } from '@/features/portal/components/OwnerWorkspaceUI'
import { dateTime, money } from './apiHelpers'
import styles from '@/features/portal/OwnerWorkspace.module.css'
import demo from './ReturnHubDemo.module.css'

const HOUR_MS = 3_600_000
const MAX_VISIBLE_ITEMS = 2

const SHOPEE_DISPUTE_REASONS = [
  { id: 47, code: 'ITEM_DAMAGED_BY_BUYER', label: 'Sản phẩm hoàn về bị hư hỏng / đã qua sử dụng bởi người mua' },
  { id: 48, code: 'WEIGHT_MEASUREMENT_MISMATCH', label: 'Sai lệch cân nặng khi đóng gói và khi nhận hoàn' },
  { id: 50, code: 'INCORRECT_CLAIM', label: 'Không đồng ý quyết định hoàn tiền / Hàng hoàn sai mẫu' },
  { id: 51, code: 'NON_RECEIPT_REJECT', label: 'Khiếu nại đơn chưa nhận hàng (có bằng chứng đã giao thành công)' },
  { id: 52, code: 'NOT_RECEIVED_RETURN', label: 'Chưa nhận được hàng hoàn từ ĐVVC' },
  { id: 49, code: 'OTHER', label: 'Lý do khác' },
]

const TIKTOK_REJECT_REASONS = [
  { name: 'ITEM_AS_DESCRIBED', text: 'Sản phẩm đúng với mô tả' },
  { name: 'RETURN_WINDOW_EXPIRED', text: 'Quá thời hạn yêu cầu trả hàng' },
  { name: 'ITEM_USED_OR_DAMAGED', text: 'Hàng hoàn đã qua sử dụng hoặc bị hư hỏng' },
  { name: 'OTHER', text: 'Lý do khác' },
]

const STAGE_TABS = [
  { id: 'need_action', label: 'Cần xác nhận / Phản hồi' },
  { id: 'in_return_transit', label: 'Đang hoàn hàng về' },
  { id: 'dispute', label: 'Đang khiếu nại (3–5 ngày)' },
  { id: 'completed', label: 'Đã hoàn tất / Đóng' },
  { id: 'all', label: 'Tất cả yêu cầu' },
]

function buildInitialDemoReturns(baseTime) {
  return [
    {
      id: 'RET-261125-001',
      orderId: 'SHP-261124-088',
      channel: 'SHOPEE',
      rawStatus: 'ACCEPTED',
      decisionLabel: 'Shopee quyết định hoàn tiền ngay (không cần trả hàng)',
      solution: 'REFUND',
      buyerUsername: 'minhanh_99',
      reason: 'DAMAGED_FAULTY',
      reasonText: 'Shopee duyệt hoàn tiền ngay cho người mua do lỗi ngoại quan',
      refundAmount: 490000,
      reverseShippingFee: 0,
      trackingNumber: '',
      compensationStatus: null,
      arbitrationStatus: null,
      createdAt: baseTime - 18 * HOUR_MS,
      updatedAt: baseTime - 18 * HOUR_MS,
      dueDate: baseTime + 30 * HOUR_MS,
      buyerProofImages: ['https://cf.shopee.vn/file/demo-proof-1.jpg'],
      sellerProofImages: [],
      rulingNotes: 'Trong vòng 2 ngày kể từ khi Shopee quyết định hoàn tiền ngay, Người bán có thể Khiếu nại nếu không đồng ý.',
      records: [
        { at: baseTime - 18 * HOUR_MS, actor: 'SHOPEE', note: 'Shopee quyết định hoàn tiền ngay cho người mua (không trả hàng). Hạn khiếu nại: 2 ngày.' },
      ],
      items: [
        { sku: 'SO-ANC-BLK-1Y', name: 'Tai nghe chống ồn ANC Pro', variant: 'Đen · BH 1 năm', qty: 1, price: 490000, refundAmount: 490000 },
      ],
    },
    {
      id: 'RET-261123-019',
      orderId: 'SHP-261120-042',
      channel: 'SHOPEE',
      rawStatus: 'PROCESSING',
      decisionLabel: 'Người mua đã gửi hàng hoàn qua ĐVVC',
      solution: 'RETURN_REFUND',
      buyerUsername: 'hoangnam_q1',
      reason: 'CHANGE_OF_MIND',
      reasonText: 'Đổi ý (Sản phẩm còn nguyên tem, nhãn mác)',
      refundAmount: 650000,
      reverseShippingFee: 32000,
      trackingNumber: 'SPXRET09281726',
      compensationStatus: null,
      arbitrationStatus: null,
      createdAt: baseTime - 56 * HOUR_MS,
      updatedAt: baseTime - 6 * HOUR_MS,
      dueDate: baseTime + 42 * HOUR_MS,
      buyerProofImages: [],
      sellerProofImages: [],
      rulingNotes: 'Khi nhận được kiện hoàn, vui lòng bấm "Xác nhận nhận hàng" hoặc "Khiếu nại" trong vòng 2 ngày nếu hàng có vấn đề / chưa nhận được.',
      records: [
        { at: baseTime - 56 * HOUR_MS, actor: 'SHOPEE', note: 'Shopee duyệt yêu cầu Trả hàng & Hoàn tiền -> PROCESSING' },
        { at: baseTime - 6 * HOUR_MS, actor: 'ĐVVC', note: 'Người mua đã gửi hàng hoàn qua SPX Express (SPXRET09281726)' },
      ],
      items: [
        { sku: 'SO-CAM-4K', name: 'Camera hành trình 4K Wi-Fi', variant: 'Bản chuẩn', qty: 1, price: 650000, refundAmount: 650000 },
        { sku: 'SO-SD-64G', name: 'Thẻ nhớ microSD 64GB Class 10', variant: '64GB', qty: 1, price: 120000, refundAmount: 0 },
        { sku: 'SO-MOUNT-01', name: 'Ngàm gắn kính lái hút chân không', variant: 'Đen', qty: 1, price: 0, refundAmount: 0 },
      ],
    },
    {
      id: 'TT-RET-994012',
      orderId: 'TT-576291038211',
      channel: 'TIKTOK',
      rawStatus: 'BUYER_SHIPPED_ITEM',
      solution: 'RETURN_AND_REFUND',
      buyerUsername: 'quocbao_hn',
      reason: 'NOT_AS_DESCRIBED',
      reasonText: 'Sản phẩm không đúng mô tả',
      refundAmount: 689000,
      reverseShippingFee: 0,
      trackingNumber: 'SIMRET884920112',
      compensationStatus: null,
      arbitrationStatus: 'NO_ARBITRATION',
      createdAt: baseTime - 60 * HOUR_MS,
      updatedAt: baseTime - 3 * HOUR_MS,
      dueDate: baseTime + 18 * HOUR_MS,
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
      solution: 'REFUND',
      buyerUsername: 'thaovy_sg',
      reason: 'DAMAGED_ITEM',
      reasonText: 'Hàng bị lỗi hoặc hư hỏng (Chỉ hoàn tiền)',
      refundAmount: 199000,
      reverseShippingFee: 0,
      trackingNumber: '',
      compensationStatus: null,
      arbitrationStatus: 'NO_ARBITRATION',
      createdAt: baseTime - 10 * HOUR_MS,
      updatedAt: baseTime - 10 * HOUR_MS,
      dueDate: baseTime + 38 * HOUR_MS,
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
      id: 'RET-261122-007',
      orderId: 'SHP-261118-011',
      channel: 'SHOPEE',
      rawStatus: 'SELLER_DISPUTE',
      decisionLabel: 'Chờ kết quả xử lý từ Shopee (3–5 ngày làm việc)',
      solution: 'RETURN_REFUND',
      buyerUsername: 'khanhtran_dn',
      reason: 'DAMAGED_FAULTY',
      reasonText: 'Khách báo sản phẩm không lên nguồn',
      refundAmount: 550000,
      reverseShippingFee: 28000,
      trackingNumber: 'SPXRET09280011',
      compensationStatus: null,
      arbitrationStatus: null,
      createdAt: baseTime - 72 * HOUR_MS,
      updatedAt: baseTime - 14 * HOUR_MS,
      dueDate: null,
      buyerProofImages: ['https://cf.shopee.vn/file/demo-dispute-buyer.jpg'],
      sellerProofImages: ['https://cf.shopee.vn/file/demo-unbox-seller.jpg'],
      rulingNotes: 'Shop đã gửi khiếu nại (#50 INCORRECT_CLAIM): Khách hoàn trả sai mẫu cũ. Đang chờ Shopee phản hồi trong 3–5 ngày làm việc.',
      records: [
        { at: baseTime - 72 * HOUR_MS, actor: 'SHOPEE', note: 'Khách gửi hàng hoàn về Shop -> PROCESSING' },
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
      solution: 'RETURN_AND_REFUND',
      buyerUsername: 'mailinh_ct',
      reason: 'WRONG_ITEM',
      reasonText: 'Giao sai hàng',
      refundAmount: 199000,
      reverseShippingFee: 0,
      trackingNumber: 'SIMRET771002211',
      compensationStatus: null,
      arbitrationStatus: 'NO_ARBITRATION',
      createdAt: baseTime - 120 * HOUR_MS,
      updatedAt: baseTime - 40 * HOUR_MS,
      dueDate: null,
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
    if (s === 'PROCESSING') {
      return {
        label: 'Đang hoàn hàng về Shop',
        cls: 'statusAction',
        stage: 'need_action',
        inTransit: true,
        canConfirmReceipt: true,
        canDispute: true,
      }
    }
    if (s === 'ACCEPTED' && ret.solution === 'REFUND' && ret.compensationStatus !== 'COMPENSATION_REQUESTED' && !ret.receiptConfirmed) {
      return {
        label: 'Shopee hoàn tiền ngay (Không trả hàng)',
        cls: 'statusAction',
        stage: 'need_action',
        canDispute: true,
      }
    }
    if (s === 'JUDGING') {
      return { label: 'Shopee đang thẩm định', cls: 'statusDispute', stage: 'dispute' }
    }
    if (s === 'SELLER_DISPUTE' || ret.compensationStatus === 'COMPENSATION_REQUESTED') {
      return {
        label: 'Đang khiếu nại (Chờ Shopee 3–5 ngày)',
        cls: 'statusDispute',
        stage: 'dispute',
        canCancelDispute: s === 'SELLER_DISPUTE',
      }
    }
    if (s === 'ACCEPTED') {
      return { label: 'Đã xác nhận nhận hàng hoàn', cls: 'statusSuccess', stage: 'completed' }
    }
    if (s === 'CLOSED' || s === 'CANCELLED') {
      return { label: s === 'CANCELLED' ? 'Đã hủy yêu cầu' : 'Đã đóng', cls: 'statusClosed', stage: 'completed' }
    }
  }

  if (s === 'RETURN_OR_REFUND_REQUEST_PENDING') return { label: 'Chờ shop duyệt (TikTok)', cls: 'statusAction', stage: 'need_action', tiktokPending: true }
  if (s === 'BUYER_SHIPPED_ITEM') return { label: 'Khách đã gửi · Chờ xác nhận nhận', cls: 'statusAction', stage: 'need_action', tiktokPending: true }
  if (s === 'AWAITING_BUYER_SHIP') return { label: 'Chờ khách gửi hàng hoàn', cls: 'statusTransit', stage: 'in_return_transit', inTransit: true }
  if (s === 'RETURN_OR_REFUND_REQUEST_SUCCESS' || s === 'RETURN_OR_REFUND_REQUEST_COMPLETE') return { label: 'Đã hoàn tiền', cls: 'statusSuccess', stage: 'completed' }
  if (s === 'REFUND_OR_RETURN_REQUEST_REJECT' || s === 'REJECT_RECEIVE_PACKAGE' || s === 'RETURN_OR_REFUND_REQUEST_CANCEL') {
    return { label: s === 'RETURN_OR_REFUND_REQUEST_CANCEL' ? 'Khách đã hủy' : 'Shop đã từ chối', cls: 'statusClosed', stage: ret.arbitrationStatus === 'IN_ARBITRATION' ? 'dispute' : 'completed' }
  }
  return { label: s, cls: 'statusClosed', stage: 'all' }
}

function getDueBadge(ret, now) {
  const meta = getReturnMeta(ret)
  if (!ret.dueDate || meta.stage === 'completed' || meta.stage === 'dispute') return null
  const diff = ret.dueDate - now
  if (diff < 0) return { urgent: true, cls: 'slaOverdue', label: 'Quá hạn 2 ngày khiếu nại' }
  const hrs = Math.max(1, Math.round(diff / HOUR_MS))
  if (hrs <= 48) return { urgent: true, cls: 'slaUrgent', label: `Còn ${hrs} giờ để khiếu nại` }
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

  const [tiktokRejectTarget, setTiktokRejectTarget] = useState(null)
  const [tiktokRejectReason, setTiktokRejectReason] = useState('ITEM_AS_DESCRIBED')

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
      }
    })
  }, [returns, now])

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
      if (channel !== 'ALL' && r.channel !== channel) continue
      counts.all += 1
      if (r.meta.inTransit) counts.in_return_transit += 1
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

  function confirmShopeeReceipt(ret) {
    setReturns(prev => prev.map(r => (r.id === ret.id ? {
      ...r,
      rawStatus: 'ACCEPTED',
      receiptConfirmed: true,
      dueDate: null,
      updatedAt: Date.now(),
      records: [...r.records, { at: Date.now(), actor: 'SELLER', note: 'Người bán xác nhận đã nhận hàng hoàn (confirm -> ACCEPTED)' }],
    } : r)))
    setFeedback({ message: `Đã xác nhận nhận hàng hoàn cho yêu cầu Shopee ${ret.id}.` })
  }

  function submitShopeeDispute(event) {
    event.preventDefault()
    if (!disputeTarget) return
    const def = SHOPEE_DISPUTE_REASONS.find(d => d.id === Number(disputeReasonId))
    const isInstantRefund = disputeTarget.rawStatus === 'ACCEPTED'
    setReturns(prev => prev.map(r => (r.id === disputeTarget.id ? {
      ...r,
      rawStatus: isInstantRefund ? 'ACCEPTED' : 'SELLER_DISPUTE',
      compensationStatus: isInstantRefund ? 'COMPENSATION_REQUESTED' : r.compensationStatus,
      sellerProofImages: disputeProof.split('\n').map(s => s.trim()).filter(Boolean),
      rulingNotes: `Đã gửi khiếu nại (#${disputeReasonId} ${def?.code}): ${disputeText}. Chờ kết quả xử lý từ Shopee trong 3–5 ngày làm việc.`,
      updatedAt: Date.now(),
      records: [...r.records, { at: Date.now(), actor: 'SELLER', note: `Gửi khiếu nại lên Shopee (#${disputeReasonId}: ${def?.code})` }],
    } : r)))
    setFeedback({ message: `Đã gửi khiếu nại lên Shopee cho ${disputeTarget.id}. Chờ Shopee xử lý trong 3–5 ngày làm việc.` })
    setDisputeTarget(null)
  }

  function cancelShopeeDispute(ret) {
    setReturns(prev => prev.map(r => (r.id === ret.id ? {
      ...r,
      rawStatus: 'PROCESSING',
      updatedAt: Date.now(),
      records: [...r.records, { at: Date.now(), actor: 'SELLER', note: 'Người bán rút khiếu nại (cancel_dispute -> PROCESSING)' }],
    } : r)))
    setFeedback({ message: `Đã rút khiếu nại cho ${ret.id}.` })
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
      records: [...r.records, { at: Date.now(), actor: 'SELLER', note: `Xác nhận yêu cầu TikTok -> ${nextStatus}` }],
    } : r)))
    setFeedback({ message: `Đã xác nhận yêu cầu TikTok ${ret.id} (${nextStatus}).` })
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

  return (
    <div className={demo.hub}>
      <div className={demo.banner}>
        <div className={demo.bannerTitle}>
          <span className={demo.demoTag}>Bản Demo UI</span>
          <span>
            Trung tâm Hoàn trả &amp; Hoàn tiền (Shopee: phản hồi quyết định của sàn · TikTok Shop: duyệt / xác nhận nhận hàng).
          </span>
        </div>
        <Button size="sm" variant="outline" onClick={() => {
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
            <span className={demo.kpiLabel}>Cần phản hồi / Xác nhận <AlertTriangle size={14} color="#dc2626" /></span>
            <span className={demo.kpiValue}>{kpis.needAction}</span>
            <span className={demo.kpiHint}>Xác nhận nhận hàng hoặc khiếu nại</span>
          </button>

          <button
            type="button"
            className={`${demo.kpiCard} ${demo.kpiUrgent} ${urgentOnly ? demo.kpiCardActive : ''}`}
            onClick={() => { setStage('all'); setUrgentOnly(!urgentOnly) }}
          >
            <span className={demo.kpiLabel}>Hạn khiếu nại (Trong 2 ngày) <Clock size={14} color="#d97706" /></span>
            <span className={demo.kpiValue}>{kpis.urgentDue}</span>
            <span className={demo.kpiHint}>Quá 2 ngày sẽ không thể khiếu nại</span>
          </button>

          <button
            type="button"
            className={`${demo.kpiCard} ${demo.kpiWarehouse} ${stage === 'in_return_transit' ? demo.kpiCardActive : ''}`}
            onClick={() => { setStage('in_return_transit'); setUrgentOnly(false) }}
          >
            <span className={demo.kpiLabel}>Đang hoàn hàng về Shop <PackageCheck size={14} color="#2563eb" /></span>
            <span className={demo.kpiValue}>{kpis.inTransit}</span>
            <span className={demo.kpiHint}>Theo dõi kiện hoàn từ ĐVVC</span>
          </button>

          <button
            type="button"
            className={`${demo.kpiCard} ${demo.kpiDispute} ${stage === 'dispute' ? demo.kpiCardActive : ''}`}
            onClick={() => { setStage('dispute'); setUrgentOnly(false) }}
          >
            <span className={demo.kpiLabel}>Đang khiếu nại (3–5 ngày) <Scale size={14} color="#7c3aed" /></span>
            <span className={demo.kpiValue}>{kpis.dispute}</span>
            <span className={demo.kpiHint}>Chờ kết quả xử lý từ sàn</span>
          </button>

          <button
            type="button"
            className={`${demo.kpiCard} ${demo.kpiTotal} ${stage === 'all' && !urgentOnly ? demo.kpiCardActive : ''}`}
            onClick={() => { setStage('all'); setUrgentOnly(false) }}
          >
            <span className={demo.kpiLabel}>Tổng tiền đang chờ xử lý <ShieldAlert size={14} /></span>
            <span className={demo.kpiValue}>{money(kpis.openRefundTotal)}</span>
            <span className={demo.kpiHint}>Giá trị các yêu cầu chưa đóng</span>
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
              <option value="DUE_ASC">Hạn khiếu nại gần nhất</option>
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
            headings={['Yêu cầu / Kênh', 'Sản phẩm hoàn', 'Tiền hoàn', 'Trạng thái & Thời hạn', 'Ghi chú / Lý do', 'Thao tác']}
          >
            {visible.map(ret => {
              const shownItems = ret.items.slice(0, MAX_VISIBLE_ITEMS)
              const extraCount = ret.items.length - shownItems.length
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
                        {ret.solution === 'REFUND' ? 'Hoàn tiền ngay' : 'Trả hàng & Hoàn tiền'}
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
                    {ret.dueDate && ret.due && <p className={styles.note}>Hạn: {dateTime(ret.dueDate)}</p>}
                    {ret.trackingNumber && <p className={styles.note}>Mã hoàn: <strong>{ret.trackingNumber}</strong></p>}
                  </td>
                  <td>
                    <span>{ret.reasonText || ret.reason}</span>
                    {ret.rulingNotes && <p className={styles.note}>{ret.rulingNotes}</p>}
                  </td>
                  <td>
                    <div className={demo.compactActions}>
                      {ret.channel === 'SHOPEE' && ret.meta.canConfirmReceipt && (
                        <Button onClick={() => confirmShopeeReceipt(ret)}>
                          Xác nhận nhận hàng
                        </Button>
                      )}
                      {ret.channel === 'SHOPEE' && ret.meta.canDispute && (
                        <Button size="sm" variant="outline" onClick={() => {
                          setDisputeTarget(ret)
                          setDisputeReasonId(ret.solution === 'REFUND' ? '50' : '52')
                          setDisputeText('')
                        }}>
                          Khiếu nại
                        </Button>
                      )}
                      {ret.meta.canCancelDispute && (
                        <Button variant="outline" onClick={() => cancelShopeeDispute(ret)}>Rút khiếu nại</Button>
                      )}
                      {ret.channel === 'TIKTOK' && ret.meta.tiktokPending && (
                        <>
                          <Button onClick={() => approveTiktokReturn(ret)}>
                            {ret.rawStatus === 'BUYER_SHIPPED_ITEM' ? 'Xác nhận đã nhận hàng' : 'Chấp nhận'}
                          </Button>
                          <Button variant="destructive" onClick={() => setTiktokRejectTarget(ret)}>Từ chối</Button>
                        </>
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

      {/* Modal: Chi tiết yêu cầu */}
      <Dialog open={Boolean(detailItem)} onOpenChange={open => { if (!open) setDetailId(null) }}>
        <DialogContent className={`${styles.dialog} ${styles.marketplaceDialog} ${demo.detailDialog}`}>
          <DialogTitle>Chi tiết yêu cầu {detailItem?.id}</DialogTitle>
          <DialogDescription>
            {detailItem?.channel === 'SHOPEE' ? 'Shopee' : 'TikTok Shop'} · Đơn {detailItem?.orderId} · {detailItem?.meta.label}
          </DialogDescription>
          {detailItem && (
            <>
              <div className={demo.detailMeta}>
                <div>Người mua<strong>{detailItem.buyerUsername}</strong><span>{detailItem.solution === 'REFUND' ? 'Hoàn tiền ngay (Không trả hàng)' : 'Trả hàng & Hoàn tiền'}</span></div>
                <div>Số tiền hoàn<strong>{money(detailItem.refundAmount)}</strong><span>Phí ship hoàn: {money(detailItem.reverseShippingFee)}</span></div>
                <div>Vận đơn hoàn<strong>{detailItem.trackingNumber || 'Không có'}</strong><span>{detailItem.due ? detailItem.due.label : '—'}</span></div>
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
                {detailItem.channel === 'SHOPEE' && detailItem.meta.canConfirmReceipt && (
                  <Button onClick={() => { confirmShopeeReceipt(detailItem); setDetailId(null) }}>
                    Xác nhận nhận hàng
                  </Button>
                )}
                {detailItem.channel === 'SHOPEE' && detailItem.meta.canDispute && (
                  <Button size="sm" variant="outline" onClick={() => {
                    setDetailId(null)
                    setDisputeTarget(detailItem)
                    setDisputeReasonId(detailItem.solution === 'REFUND' ? '50' : '52')
                    setDisputeText('')
                  }}>
                    Khiếu nại lên Shopee
                  </Button>
                )}
                <Button variant="secondary" onClick={() => setDetailId(null)}>Đóng</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal: Shopee Khiếu nại (Dispute Reason 47..52) */}
      <Dialog open={Boolean(disputeTarget)} onOpenChange={open => { if (!open) setDisputeTarget(null) }}>
        <DialogContent className={`${styles.dialog} ${styles.marketplaceDialog}`}>
          <DialogTitle>Khiếu nại quyết định của Shopee</DialogTitle>
          <DialogDescription>
            Yêu cầu {disputeTarget?.id} · Shopee sẽ xem xét &amp; phản hồi trong 3–5 ngày làm việc
          </DialogDescription>
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
              <textarea required maxLength={2000} value={disputeText} onChange={e => setDisputeText(e.target.value)} placeholder="Mô tả tình trạng hàng hoàn hoặc lý do không đồng ý quyết định hoàn tiền..." />
            </label>
            <label className={styles.field}>
              Email liên hệ
              <input required type="email" value={disputeEmail} onChange={e => setDisputeEmail(e.target.value)} />
            </label>
            <label className={styles.field}>
              Link ảnh / video bằng chứng (HTTPS, mỗi dòng 1 link)
              <textarea required value={disputeProof} onChange={e => setDisputeProof(e.target.value)} />
            </label>
            <div className={styles.actions}>
              <Button type="button" variant="secondary" onClick={() => setDisputeTarget(null)}>Quay lại</Button>
              <Button type="submit">Gửi khiếu nại lên Shopee</Button>
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
    </div>
  )
}
