import { useCallback, useState } from 'react'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog'
import { tiktokApi } from '@/services/api/tiktok'
import { Feedback } from '@/features/portal/components/OwnerWorkspaceUI'
import { useApiResource } from './useApiResource'
import { ResourceState } from './ShopeeShared'
import { RejectReasonSelect } from './TiktokRejectReasons'
import { money, useApiAction } from './apiHelpers'
import { tiktokPackageId } from './tiktokOrderHub'
import styles from '@/features/portal/OwnerWorkspace.module.css'
import demo from './OrderHubDemo.module.css'

function HubDialog({ title, description, busy, close, children }) {
  return (
    <Dialog open onOpenChange={open => { if (!open && !busy) close() }}>
      <DialogContent className={`${styles.dialog} ${styles.marketplaceDialog}`}>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
        {children}
      </DialogContent>
    </Dialog>
  )
}

function FormActions({ busy, close, disabled, variant, label, busyLabel = 'Đang gửi…' }) {
  return (
    <div className={styles.actions}>
      <Button type="button" variant="secondary" disabled={busy} onClick={close}>Quay lại</Button>
      <Button type="submit" variant={variant} disabled={busy || disabled}>{busy ? busyLabel : label}</Button>
    </div>
  )
}

function HandoverSelect({ value, onChange }) {
  return (
    <label className={styles.field}>
      Hình thức giao hàng
      <select value={value} onChange={e => onChange(e.target.value)}>
        <option value="DROP_OFF">Tự mang ra bưu cục (Drop-off)</option>
        <option value="PICKUP">ĐVVC đến lấy tận nơi (Pickup)</option>
      </select>
    </label>
  )
}

export function TiktokShipDialog({ orderId, close, done }) {
  const action = useApiAction()
  const [serviceId, setServiceId] = useState('')
  const [handoverMethod, setHandoverMethod] = useState('PICKUP')
  const loader = useCallback(async signal => {
    const packageId = tiktokPackageId(await tiktokApi.order(orderId, signal))
    return { packageId, providers: packageId ? await tiktokApi.shippingProviders(packageId, signal) : [] }
  }, [orderId])
  const resource = useApiResource(loader)
  const packageId = resource.data?.packageId
  const services = (resource.data?.providers || []).filter(provider => provider.shippingServiceId)

  function submit(event) {
    event.preventDefault()
    const message = result => result?.tracking_number
      ? `Đã xác nhận giao hàng. Mã vận đơn: ${result.tracking_number}`
      : 'Đã xác nhận chuẩn bị giao hàng trên TikTok Shop.'
    action.run(
      () => tiktokApi.shipPackage({ orderId, packageId, shippingServiceId: serviceId || undefined, handoverMethod }),
      message,
      result => done(message(result))
    )
  }

  return (
    <HubDialog title="Chuẩn bị giao hàng" description={`Đơn TikTok Shop ${orderId}`} busy={action.busy} close={close}>
      <ResourceState resource={resource} />
      {!resource.loading && !resource.error && (
        <form className={styles.form} onSubmit={submit}>
          {packageId
            ? <p className={styles.note}>Kiện hàng {packageId}</p>
            : <p className={styles.error}>TikTok chưa trả về kiện hàng cho đơn này.</p>}
          <HandoverSelect value={handoverMethod} onChange={setHandoverMethod} />
          {services.length > 0 && (
            <label className={styles.field}>
              Dịch vụ vận chuyển
              <select value={serviceId} onChange={e => setServiceId(e.target.value)}>
                <option value="">Mặc định của TikTok</option>
                {services.map(provider => (
                  <option key={`${provider.shippingProviderId}:${provider.shippingServiceId}`} value={provider.shippingServiceId}>
                    {[provider.shippingProviderName, provider.shippingServiceName].filter(Boolean).join(' · ') || provider.shippingServiceId}
                  </option>
                ))}
              </select>
            </label>
          )}
          <Feedback value={action.feedback} />
          <FormActions busy={action.busy} close={close} disabled={!packageId} label="Xác nhận giao hàng" />
        </form>
      )}
    </HubDialog>
  )
}

export function TiktokBatchShipDialog({ orderIds, close, done }) {
  const action = useApiAction()
  const [handoverMethod, setHandoverMethod] = useState('DROP_OFF')

  function submit(event) {
    event.preventDefault()
    action.run(async () => {
      let ok = 0
      const failed = []
      for (const orderId of orderIds) {
        try {
          const packageId = tiktokPackageId(await tiktokApi.order(orderId))
          if (!packageId) throw new Error('TikTok chưa trả về kiện hàng.')
          await tiktokApi.shipPackage({ orderId, packageId, handoverMethod })
          ok += 1
        } catch (err) {
          failed.push(`${orderId}: ${err.message}`)
        }
      }
      if (ok === 0 && failed.length) throw new Error(`Không thể xử lý đơn: ${failed[0]}`)
      return { ok, failed }
    },
    res => `Đã xác nhận ${res.ok}/${orderIds.length} đơn.`,
    done)
  }

  return (
    <HubDialog
      title={`Chuẩn bị giao hàng loạt (${orderIds.length} đơn)`}
      description="Dùng dịch vụ vận chuyển mặc định của TikTok Shop và xác nhận từng đơn."
      busy={action.busy}
      close={close}
    >
      <form className={styles.form} onSubmit={submit}>
        <div className={demo.noteBox}>Đơn được xử lý: <strong>{orderIds.join(', ')}</strong></div>
        <HandoverSelect value={handoverMethod} onChange={setHandoverMethod} />
        <Feedback value={action.feedback} />
        <FormActions busy={action.busy} close={close} label="Xác nhận giao hàng loạt" busyLabel="Đang xử lý…" />
      </form>
    </HubDialog>
  )
}

export function TiktokEscrowDialog({ orderId, close }) {
  const loader = useCallback(signal => tiktokApi.escrow(orderId, signal), [orderId])
  const resource = useApiResource(loader)
  const p = resource.data
  const amount = value => value == null ? 'Chưa có dữ liệu' : money(value)
  const feesUnknown = p && [p.commissionFee, p.serviceFee, p.transactionFee, p.escrowAmount].every(value => value == null)
  return (
    <HubDialog title="Chi tiết đối soát tiền (Escrow)" description={`Đơn TikTok Shop ${orderId}`} close={close}>
      <ResourceState resource={resource} />
      {p && (
        <dl className={styles.details}>
          {[
            ['Tiền hàng gốc', amount(p.orderOriginalPrice)],
            ['Tổng tiền người mua trả', amount(p.buyerTotalAmount)],
            ['Sàn giảm giá', amount(p.platformDiscount)],
            ['Người bán giảm giá', amount(p.sellerDiscount)],
            ['Phí vận chuyển', amount(p.shippingFee)],
            ['Phí hoa hồng sàn', amount(p.commissionFee)],
            ['Phí thanh toán', amount(p.transactionFee)],
            ['Phí dịch vụ', amount(p.serviceFee)],
            ['Tiền hoàn trả hàng', amount(p.refundAmount)],
            ['Thực nhận dự kiến', amount(p.escrowAmount)],
            ['Phương thức thanh toán', p.paymentMethod || '—'],
            ['Tiền tệ', p.currency || '—'],
          ].map(([label, value]) => (
            <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
          ))}
        </dl>
      )}
      {feesUnknown && <p className={styles.note}>TikTok không cung cấp phí sàn và số tiền thực nhận qua API.</p>}
      <div className={styles.actions}>
        <Button variant="secondary" onClick={close}>Đóng</Button>
      </div>
    </HubDialog>
  )
}

export function TiktokCancelDialog({ orderId, close, done }) {
  const action = useApiAction()
  const [reason, setReason] = useState('')
  const loader = useCallback(signal => tiktokApi.aftersaleReasons(signal).then(codes => codes?.sellerCancelReasons || []), [])
  const resource = useApiResource(loader)
  const selected = reason || resource.data?.[0]?.name || ''

  function submit(event) {
    event.preventDefault()
    const message = `Đã hủy đơn ${orderId}.`
    action.run(async () => {
      const res = await tiktokApi.cancelOrder(orderId, selected)
      if (res?.canceled === false) throw new Error('TikTok không chấp nhận yêu cầu hủy đơn này.')
      return res
    }, message, () => done(message))
  }

  return (
    <HubDialog title="Hủy đơn hàng TikTok Shop" description={`Đơn ${orderId}`} busy={action.busy} close={close}>
      <ResourceState resource={resource} />
      {!resource.loading && !resource.error && (
        <form className={styles.form} onSubmit={submit}>
          <label className={styles.field}>
            Lý do hủy đơn
            <select required value={selected} onChange={e => setReason(e.target.value)}>
              {resource.data.map(item => <option key={item.name} value={item.name}>{item.textVi || item.text || item.name}</option>)}
            </select>
          </label>
          <Feedback value={action.feedback} />
          <FormActions busy={action.busy} close={close} disabled={!selected} variant="destructive" label="Xác nhận hủy đơn" />
        </form>
      )}
    </HubDialog>
  )
}

export function TiktokBuyerCancelDialog({ request, close, done }) {
  const action = useApiAction()
  const [decision, setDecision] = useState('approve')
  const [rejectReason, setRejectReason] = useState('')

  function submit(event) {
    event.preventDefault()
    const message = 'Đã xử lý yêu cầu hủy từ người mua.'
    action.run(async () => {
      const res = await tiktokApi.decideCancellation(request.cancel_id, decision, rejectReason || undefined)
      if (res?.approved === false || res?.rejected === false) throw new Error('TikTok không chấp nhận thao tác này.')
      return res
    }, message, () => done(message))
  }

  return (
    <HubDialog title="Xử lý yêu cầu hủy từ người mua" description={`Đơn ${request.order_id}`} busy={action.busy} close={close}>
      <form className={styles.form} onSubmit={submit}>
        <label className={styles.field}>
          Quyết định của người bán
          <select value={decision} onChange={e => setDecision(e.target.value)}>
            <option value="approve">Chấp nhận hủy đơn</option>
            <option value="reject">Từ chối hủy (Tiếp tục giao)</option>
          </select>
        </label>
        {decision === 'reject' && (
          <RejectReasonSelect
            id={request.cancel_id}
            value={rejectReason}
            onChange={setRejectReason}
            disabled={action.busy}
            label="Lý do từ chối (không bắt buộc)"
            defaultLabel="Mặc định của TikTok"
          />
        )}
        <Feedback value={action.feedback} />
        <FormActions busy={action.busy} close={close} label="Xác nhận quyết định" />
      </form>
    </HubDialog>
  )
}

// TikTok-only tools inside the order detail dialog: push SKU stock and check which after-sales requests are allowed.
export function TiktokDetailTools({ orderId, items }) {
  const [selected, setSelected] = useState(null)
  const [quantity, setQuantity] = useState('')
  const [checking, setChecking] = useState(false)
  const action = useApiAction()
  const validQuantity = /^\d+$/.test(quantity) && Number(quantity) <= 2147483647
  const stockItems = items.filter(item => item.productId && item.skuId)

  function submit(event) {
    event.preventDefault()
    if (!selected || !validQuantity) return
    action.run(
      () => tiktokApi.updateStock(selected.productId, selected.skuId, Number(quantity)),
      `Đã cập nhật tồn kho TikTok cho SKU ${selected.skuId}.`,
      () => setSelected(null)
    )
  }

  return (
    <>
      <div className={styles.actions}>
        {stockItems.map(item => (
          <Button key={`${item.skuId}:${item.price}`} variant="outline" disabled={action.busy} onClick={() => { setSelected(item); setQuantity('') }}>
            Cập nhật tồn kho TikTok · {item.sku}
          </Button>
        ))}
        <Button variant="outline" aria-expanded={checking} onClick={() => setChecking(!checking)}>
          {checking ? 'Ẩn điều kiện hậu mãi' : 'Kiểm tra điều kiện hậu mãi'}
        </Button>
      </div>
      {selected && (
        <form className={styles.form} onSubmit={submit}>
          <p>Đặt số tồn trên TikTok Shop cho <strong>{selected.name}</strong> ({selected.variant}).</p>
          <p className={styles.note}>Product ID {selected.productId} · SKU ID {selected.skuId}</p>
          <label className={styles.field}>
            Số lượng tồn mới trên TikTok
            <input type="number" min="0" max="2147483647" step="1" required value={quantity} disabled={action.busy} onChange={e => setQuantity(e.target.value)} />
          </label>
          <FormActions busy={action.busy} close={() => setSelected(null)} disabled={!validQuantity} label="Xác nhận cập nhật tồn" busyLabel="Đang cập nhật…" />
        </form>
      )}
      <Feedback value={action.feedback} />
      {checking && <TiktokEligibility orderId={orderId} />}
    </>
  )
}

function TiktokEligibility({ orderId }) {
  const loader = useCallback(signal => tiktokApi.aftersaleEligibility(orderId, signal), [orderId])
  const resource = useApiResource(loader)
  const types = resource.data?.request_types || []
  return (
    <>
      <ResourceState resource={resource} />
      {resource.data && <p>{types.length ? `Loại yêu cầu được phép: ${types.join(', ')}` : 'TikTok không trả về loại yêu cầu nào được phép.'}</p>}
    </>
  )
}
