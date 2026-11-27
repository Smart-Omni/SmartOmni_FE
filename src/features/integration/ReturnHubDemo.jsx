import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Clock, PackageCheck, RefreshCw, Scale, ShieldAlert } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog'
import { shopeeApi } from '@/services/api/shopee'
import { DataTable, Feedback, OwnerPanel } from '@/features/portal/components/OwnerWorkspaceUI'
import { useApiResource } from './useApiResource'
import { ResourceState } from './ShopeeShared'
import { dateTime, money, useApiAction } from './apiHelpers'
import TiktokReturns from './TiktokReturns'
import styles from '@/features/portal/OwnerWorkspace.module.css'
import demo from './ReturnHubDemo.module.css'

const HOUR_MS = 3_600_000
const MAX_VISIBLE_ITEMS = 2

const DEFAULT_SHOPEE_DISPUTE_REASONS = [
  { disputeReasonId: 47, disputeName: 'ITEM_DAMAGED_BY_BUYER', disputeRequirement: 'Sản phẩm hoàn về bị hư hỏng / đã qua sử dụng bởi người mua' },
  { disputeReasonId: 48, disputeName: 'WEIGHT_MEASUREMENT_MISMATCH', disputeRequirement: 'Sai lệch cân nặng khi đóng gói và khi nhận hoàn' },
  { disputeReasonId: 50, disputeName: 'INCORRECT_CLAIM', disputeRequirement: 'Không đồng ý quyết định hoàn tiền / Hàng hoàn sai mẫu' },
  { disputeReasonId: 51, disputeName: 'NON_RECEIPT_REJECT', disputeRequirement: 'Khiếu nại đơn chưa nhận hàng (có bằng chứng đã giao thành công)' },
  { disputeReasonId: 52, disputeName: 'NOT_RECEIVED_RETURN', disputeRequirement: 'Chưa nhận được hàng hoàn từ ĐVVC' },
  { disputeReasonId: 49, disputeName: 'OTHER', disputeRequirement: 'Lý do khác' },
]

const STAGE_TABS = [
  { id: 'need_action', label: 'Cần xác nhận / Phản hồi' },
  { id: 'in_return_transit', label: 'Đang hoàn hàng về' },
  { id: 'dispute', label: 'Đang khiếu nại (3–5 ngày)' },
  { id: 'completed', label: 'Đã hoàn tất / Đóng' },
  { id: 'all', label: 'Tất cả yêu cầu' },
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
      note: `Tạo yêu cầu ${raw.needsLogistics === false ? 'Hoàn tiền ngay' : 'Trả hàng & Hoàn tiền'} (${raw.reason || 'RETURN'})`,
    })
  }
  if (raw.trackingNumber && raw.needsLogistics !== false) {
    records.push({
      at: updatedAt || createdAt,
      actor: 'ĐVVC',
      note: `Vận đơn hoàn: ${raw.trackingNumber}`,
    })
  }
  if (reverseDeliveredAt) {
    records.push({
      at: reverseDeliveredAt,
      actor: 'ĐVVC',
      note: 'ĐVVC đã giao hàng hoàn cho Shop -> Mở cửa sổ 2 ngày khiếu nại',
    })
  }
  if (raw.negotiationStatus === 'PENDING_BUYER_RESPOND' && raw.offerAmount != null) {
    records.push({
      at: updatedAt || createdAt,
      actor: 'SELLER',
      note: `Đã đề xuất hoàn một phần ${money(raw.offerAmount)}${raw.offerReason ? ` (${raw.offerReason})` : ''}`,
    })
  }
  if (raw.status === 'SELLER_DISPUTE' || raw.compensationStatus === 'COMPENSATION_REQUESTED') {
    const reasonCode = raw.disputeReason?.[0] || 'DISPUTE'
    records.push({
      at: updatedAt || createdAt,
      actor: 'SELLER',
      note: `Đã gửi khiếu nại lên Shopee (${reasonCode})`,
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
    name: item.name || 'Sản phẩm Shopee',
    variant: item.variationSku || (item.modelId ? `Model #${item.modelId}` : 'Mặc định'),
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
    buyerUsername: raw.buyerUsername || 'Người mua Shopee',
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

  if (s === 'REQUESTED') {
    return {
      label: 'Chờ shop xử lý / Thương lượng',
      cls: 'statusAction',
      stage: 'need_action',
      canConfirmReceipt: true,
      canDispute: true,
      canOffer: ret.negotiationStatus !== 'PENDING_BUYER_RESPOND',
    }
  }
  if (s === 'PROCESSING') {
    const deliveredOrPastExpected = Boolean(ret.reverseDeliveredAt)
      || (Boolean(ret.expectedReturnDate) && now >= ret.expectedReturnDate)
    const inTransit = ret.needsLogistics && !ret.reverseDeliveredAt
    return {
      label: inTransit ? 'Đang hoàn hàng về Shop' : 'Đã giao hoàn · Chờ xác nhận',
      cls: inTransit ? 'statusTransit' : 'statusAction',
      stage: 'need_action',
      inTransit,
      canConfirmReceipt: true,
      canDispute: deliveredOrPastExpected && withinDisputeWindow,
      canOffer: ret.negotiationStatus !== 'PENDING_BUYER_RESPOND',
    }
  }
  if (s === 'ACCEPTED' && ret.solution === 'REFUND'
    && ret.compensationStatus !== 'COMPENSATION_REQUESTED'
    && ret.compensationStatus !== 'COMPENSATION_APPROVED') {
    return {
      label: 'Shopee hoàn tiền ngay (Không trả hàng)',
      cls: 'statusAction',
      stage: 'need_action',
      canDispute: withinDisputeWindow,
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
    }
  }
  if (s === 'ACCEPTED') {
    return { label: 'Đã chấp nhận hoàn tiền', cls: 'statusSuccess', stage: 'completed' }
  }
  if (s === 'CLOSED' || s === 'CANCELLED') {
    return { label: s === 'CANCELLED' ? 'Đã hủy yêu cầu' : 'Đã đóng', cls: 'statusClosed', stage: 'completed' }
  }
  return { label: s, cls: 'statusClosed', stage: 'all' }
}

function getDueBadge(ret, now) {
  const meta = getReturnMeta(ret, now)
  const deadline = ret.disputeDueDate ?? ret.dueDate
  if (!deadline || meta.stage === 'completed' || meta.stage === 'dispute') return null
  const diff = deadline - now
  if (diff < 0) return { urgent: true, cls: 'slaOverdue', label: 'Quá hạn 2 ngày khiếu nại' }
  const hrs = Math.max(1, Math.round(diff / HOUR_MS))
  if (hrs <= 48) return { urgent: true, cls: 'slaUrgent', label: `Còn ${hrs} giờ để khiếu nại` }
  return { urgent: false, cls: 'slaOk', label: `Còn ${hrs} giờ` }
}

export default function ReturnHubDemo() {
  const [searchParams] = useSearchParams()
  const [channel, setChannel] = useState(() => (searchParams.get('source') === 'tiktok' ? 'TIKTOK' : 'SHOPEE'))
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
  const [disputeEmail, setDisputeEmail] = useState('owner@smartomni.vn')
  const [disputeText, setDisputeText] = useState('')
  const [disputeProof, setDisputeProof] = useState('')

  const [offerTarget, setOfferTarget] = useState(null)
  const [offerAmount, setOfferAmount] = useState('')
  const [offerReason, setOfferReason] = useState('')

  const action = useApiAction()
  const loader = useCallback(
    signal => (channel === 'SHOPEE' ? shopeeApi.enrichedReturns({ pageNo: 1, pageSize: 50 }, signal) : Promise.resolve({ returnList: [] })),
    [channel]
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
      if (r.meta.inTransit) counts.in_return_transit += 1
      if (r.isDispute) counts.dispute += 1
      else if (counts[r.meta.stage] != null) counts[r.meta.stage] += 1
    }
    return counts
  }, [enriched])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = enriched.filter(r => {
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
        const aDue = a.due ? (a.disputeDueDate ?? a.dueDate) : Number.MAX_SAFE_INTEGER
        const bDue = b.due ? (b.disputeDueDate ?? b.dueDate) : Number.MAX_SAFE_INTEGER
        if (aDue !== bDue) return aDue - bDue
        return b.createdAt - a.createdAt
      }
      if (sortBy === 'AMOUNT_DESC') return b.refundAmount - a.refundAmount
      return b.createdAt - a.createdAt
    })
  }, [enriched, stage, urgentOnly, sortBy, query])

  const detailItem = useMemo(() => enriched.find(r => r.id === detailId) || null, [enriched, detailId])

  function confirmShopeeReceipt(ret) {
    setLocalNotice(null)
    action.run(
      async () => {
        const result = await shopeeApi.confirmReturn(ret.id)
        if (result?.confirmed === false) throw new Error('Shopee không chấp nhận yêu cầu xác nhận này.')
        return result
      },
      `Đã xác nhận hoàn tiền cho yêu cầu Shopee ${ret.id}.`,
      () => resource.reload()
    )
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
          throw new Error('Mỗi link bằng chứng phải là URL HTTP/HTTPS hợp lệ.')
        }
        const result = await shopeeApi.disputeReturn(disputeTarget.id, {
          disputeReasonId: Number(disputeReasonId),
          disputeTextReason: disputeText.trim(),
          email: disputeEmail.trim(),
          proofImages,
        })
        if (result?.disputed === false) throw new Error('Shopee từ chối tiếp nhận khiếu nại.')
        return result
      },
      `Đã gửi khiếu nại lên Shopee cho ${disputeTarget.id}. Chờ Shopee xử lý trong 3–5 ngày làm việc.`,
      () => {
        setDisputeTarget(null)
        resource.reload()
      }
    )
  }

  function submitShopeeOffer(event) {
    event.preventDefault()
    if (!offerTarget) return
    const amountNum = Number(offerAmount)
    if (!Number.isFinite(amountNum) || amountNum <= 0 || amountNum > Number(offerTarget.refundAmount || 0)) {
      setLocalNotice({ error: true, message: `Số tiền đề xuất phải > 0 và <= ${money(offerTarget.refundAmount)}.` })
      return
    }
    setLocalNotice(null)
    action.run(
      async () => {
        const result = await shopeeApi.offerReturn(offerTarget.id, {
          offerAmount: amountNum,
          offerReason: offerReason.trim() || 'Người bán đề xuất hoàn tiền một phần không cần trả hàng',
        })
        if (result?.offered === false) throw new Error('Shopee không chấp nhận đề xuất hoàn tiền này.')
        return result
      },
      `Đã gửi đề xuất hoàn ${money(amountNum)} cho ${offerTarget.id}.`,
      () => {
        setOfferTarget(null)
        resource.reload()
      }
    )
  }

  const channelSelect = (
    <label className={styles.field}>
      Nguồn sàn
      <select value={channel} onChange={e => { setChannel(e.target.value); setLocalNotice(null) }}>
        <option value="SHOPEE">Shopee (Trực tiếp)</option>
        <option value="TIKTOK">TikTok Shop</option>
      </select>
    </label>
  )

  if (channel === 'TIKTOK') {
    return (
      <div className={demo.hub}>
        <OwnerPanel title="Trung tâm Hoàn trả &amp; Hoàn tiền">
          <div className={styles.filters}>{channelSelect}</div>
        </OwnerPanel>
        <TiktokReturns />
      </div>
    )
  }

  return (
    <div className={demo.hub}>
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
          {channelSelect}

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

          <div className={styles.actions}>
            <Button size="sm" variant="outline" disabled={resource.loading || action.busy} onClick={resource.reload}>
              <RefreshCw size={14} /> {resource.loading ? 'Đang tải…' : 'Làm mới dữ liệu'}
            </Button>
          </div>
        </div>

        <Feedback value={localNotice || action.feedback} />
        <ResourceState resource={resource} />

        {!resource.loading && !resource.error && (visible.length ? (
          <DataTable
            label="Danh sách hoàn trả Shopee"
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
                      <span className={`${demo.channelBadge} ${demo.channelShopee}`}>Shopee</span>
                      <span className={demo.typeBadge}>
                        {ret.solution === 'REFUND' ? 'Hoàn tiền ngay' : 'Trả hàng & Hoàn tiền'}
                      </span>
                    </p>
                    <p className={styles.note}>Người mua: {ret.buyerUsername}</p>
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
                    {ret.rawStatus === 'PROCESSING' && ret.needsLogistics && !ret.reverseDeliveredAt && (
                      <p className={styles.note}>
                        Người mua đang trả hàng.
                        {ret.expectedReturnDate
                          ? ` Dự kiến nhận: ${dateTime(ret.expectedReturnDate)}`
                          : ret.buyerReturnDueDate
                            ? ` Hạn gửi: ${dateTime(ret.buyerReturnDueDate)}`
                            : ''}
                      </p>
                    )}
                    {ret.negotiationStatus === 'PENDING_BUYER_RESPOND' && (
                      <p className={styles.note}>
                        Chờ khách phản hồi đề xuất hoàn{ret.offerAmount ? ` ${money(ret.offerAmount)}` : ''}
                      </p>
                    )}
                    {ret.due && (
                      <p>
                        <span className={`${demo.slaBadge} ${demo[ret.due.cls]}`}>
                          <Clock size={11} /> {ret.due.label}
                        </span>
                      </p>
                    )}
                    {(ret.disputeDueDate || ret.dueDate) && ret.due && <p className={styles.note}>Hạn: {dateTime(ret.disputeDueDate ?? ret.dueDate)}</p>}
                    {ret.trackingNumber && <p className={styles.note}>Mã hoàn: <strong>{ret.trackingNumber}</strong></p>}
                  </td>
                  <td>
                    <span>{ret.reasonText || ret.reason}</span>
                    {ret.isNfrExempt && (
                      <p>
                        <span className={`${demo.statusBadge} ${demo.statusSuccess}`}>Không tính NFR</span>
                      </p>
                    )}
                    {ret.rulingNotes && <p className={styles.note}>{ret.rulingNotes}</p>}
                  </td>
                  <td>
                    <div className={demo.compactActions}>
                      {ret.meta.canConfirmReceipt && (
                        <Button disabled={action.busy} onClick={() => confirmShopeeReceipt(ret)}>
                          Xác nhận nhận hàng
                        </Button>
                      )}
                      {ret.meta.canOffer && (
                        <Button size="sm" variant="outline" disabled={action.busy} onClick={() => {
                          setOfferTarget(ret)
                          setOfferAmount(String(Math.max(1, Math.round(Number(ret.refundAmount || 0) * 0.5))))
                          setOfferReason('')
                        }}>
                          Đề xuất hoàn tiền
                        </Button>
                      )}
                      {ret.meta.canDispute && (
                        <Button size="sm" variant="outline" disabled={action.busy} onClick={() => openDisputeModal(ret)}>
                          Khiếu nại
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
        ))}
      </OwnerPanel>

      {/* Modal: Chi tiết yêu cầu */}
      <Dialog open={Boolean(detailItem)} onOpenChange={open => { if (!open) setDetailId(null) }}>
        <DialogContent className={`${styles.dialog} ${styles.marketplaceDialog} ${demo.detailDialog}`}>
          <DialogTitle>Chi tiết yêu cầu {detailItem?.id}</DialogTitle>
          <DialogDescription>
            Shopee · Đơn {detailItem?.orderId} · {detailItem?.meta.label}
          </DialogDescription>
          {detailItem && (
            <>
              <div className={demo.detailMeta}>
                <div>Người mua<strong>{detailItem.buyerUsername}</strong><span>{detailItem.solution === 'REFUND' ? 'Hoàn tiền ngay (Không trả hàng)' : 'Trả hàng & Hoàn tiền'}</span></div>
                <div>Số tiền hoàn<strong>{money(detailItem.refundAmount)}</strong><span>Phí ship hoàn: {money(detailItem.reverseShippingFee)}</span></div>
                <div>Vận đơn hoàn<strong>{detailItem.trackingNumber || 'Không có'}</strong><span>{detailItem.due ? detailItem.due.label : '—'}</span></div>
              </div>
              <p><strong>Lý do:</strong> {detailItem.reasonText} ({detailItem.reason}){detailItem.isNfrExempt ? ' · Không tính NFR' : ''}</p>
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
              {detailItem.sellerProofImages.length > 0 && (
                <div>
                  <strong>Bằng chứng người bán đã gửi:</strong>
                  <ul className={demo.proofList}>
                    {detailItem.sellerProofImages.map((url, i) => (
                      <li key={i}><a href={url} target="_blank" rel="noreferrer">Ảnh shop {i + 1}</a></li>
                    ))}
                  </ul>
                </div>
              )}
              <div>
                <strong>Lịch sử xử lý:</strong>
                <ul className={demo.timeline}>
                  {detailItem.records.map((rec, i) => (
                    <li key={i}>{dateTime(rec.at)} · <strong>{rec.actor}</strong>: {rec.note}</li>
                  ))}
                </ul>
              </div>
              <div className={styles.actions}>
                {detailItem.meta.canConfirmReceipt && (
                  <Button disabled={action.busy} onClick={() => { confirmShopeeReceipt(detailItem); setDetailId(null) }}>
                    Xác nhận nhận hàng
                  </Button>
                )}
                {detailItem.meta.canDispute && (
                  <Button size="sm" variant="outline" disabled={action.busy} onClick={() => {
                    const target = detailItem
                    setDetailId(null)
                    openDisputeModal(target)
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
      <Dialog open={Boolean(disputeTarget)} onOpenChange={open => { if (!open && !action.busy) setDisputeTarget(null) }}>
        <DialogContent className={`${styles.dialog} ${styles.marketplaceDialog}`}>
          <DialogTitle>Khiếu nại quyết định của Shopee</DialogTitle>
          <DialogDescription>
            Yêu cầu {disputeTarget?.id} · Shopee sẽ xem xét &amp; phản hồi trong 3–5 ngày làm việc
          </DialogDescription>
          <form className={styles.form} onSubmit={submitShopeeDispute}>
            <label className={styles.field}>
              Lý do khiếu nại (Shopee)
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
              Giải trình chi tiết
              <textarea required maxLength={2000} disabled={action.busy} value={disputeText} onChange={e => setDisputeText(e.target.value)} placeholder="Mô tả tình trạng hàng hoàn hoặc lý do không đồng ý quyết định hoàn tiền..." />
            </label>
            <label className={styles.field}>
              Email liên hệ
              <input required type="email" disabled={action.busy} value={disputeEmail} onChange={e => setDisputeEmail(e.target.value)} />
            </label>
            <label className={styles.field}>
              Tải ảnh bằng chứng lên Shopee (.jpg, .png)
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
                    if (!res?.url) throw new Error('Không nhận được URL ảnh từ Shopee.')
                    setDisputeProof(prev => (prev.trim() ? `${prev.trim()}\n${res.url}` : res.url))
                    return res
                  }, 'Đã tải ảnh bằng chứng lên Shopee.')
                }}
              />
            </label>
            <label className={styles.field}>
              Link ảnh / video bằng chứng (HTTPS, mỗi dòng 1 link)
              <textarea required disabled={action.busy} value={disputeProof} onChange={e => setDisputeProof(e.target.value)} />
            </label>
            <Feedback value={action.feedback} />
            <div className={styles.actions}>
              <Button type="button" variant="secondary" disabled={action.busy} onClick={() => setDisputeTarget(null)}>Quay lại</Button>
              <Button type="submit" disabled={action.busy}>{action.busy ? 'Đang gửi…' : 'Gửi khiếu nại lên Shopee'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Shopee Đề xuất hoàn tiền một phần */}
      <Dialog open={Boolean(offerTarget)} onOpenChange={open => { if (!open && !action.busy) setOfferTarget(null) }}>
        <DialogContent className={`${styles.dialog} ${styles.marketplaceDialog}`}>
          <DialogTitle>Đề xuất hoàn tiền một phần</DialogTitle>
          <DialogDescription>
            Yêu cầu {offerTarget?.id} · Tối đa: {money(offerTarget?.refundAmount)} (Không cần trả hàng)
          </DialogDescription>
          <form className={styles.form} onSubmit={submitShopeeOffer}>
            <label className={styles.field}>
              Số tiền đề xuất hoàn (VND)
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
              Lý do / Ghi chú thương lượng
              <textarea
                maxLength={500}
                disabled={action.busy}
                value={offerReason}
                onChange={e => setOfferReason(e.target.value)}
                placeholder="Đề xuất hoàn tiền một phần không cần trả hàng..."
              />
            </label>
            <Feedback value={action.feedback} />
            <div className={styles.actions}>
              <Button type="button" variant="secondary" disabled={action.busy} onClick={() => setOfferTarget(null)}>Hủy</Button>
              <Button type="submit" disabled={action.busy}>{action.busy ? 'Đang gửi…' : 'Gửi đề xuất'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
