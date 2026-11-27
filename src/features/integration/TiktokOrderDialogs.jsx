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

function FormActions({ busy, close, disabled, variant, label, busyLabel = 'Submitting…' }) {
  return (
    <div className={styles.actions}>
      <Button type="button" variant="secondary" disabled={busy} onClick={close}>Back</Button>
      <Button type="submit" variant={variant} disabled={busy || disabled}>{busy ? busyLabel : label}</Button>
    </div>
  )
}

function HandoverSelect({ value, onChange }) {
  return (
    <label className={styles.field}>
      Handover method
      <select value={value} onChange={e => onChange(e.target.value)}>
        <option value="DROP_OFF">Drop off at a post office (Drop-off)</option>
        <option value="PICKUP">Carrier picks up (Pickup)</option>
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
      ? `Shipment confirmed. Tracking number: ${result.tracking_number}`
      : 'Shipment arranged on TikTok Shop.'
    action.run(
      () => tiktokApi.shipPackage({ orderId, packageId, shippingServiceId: serviceId || undefined, handoverMethod }),
      message,
      result => done(message(result))
    )
  }

  return (
    <HubDialog title="Arrange shipment" description={`TikTok Shop order ${orderId}`} busy={action.busy} close={close}>
      <ResourceState resource={resource} />
      {!resource.loading && !resource.error && (
        <form className={styles.form} onSubmit={submit}>
          {packageId
            ? <p className={styles.note}>Package {packageId}</p>
            : <p className={styles.error}>TikTok returned no package for this order.</p>}
          <HandoverSelect value={handoverMethod} onChange={setHandoverMethod} />
          {services.length > 0 && (
            <label className={styles.field}>
              Shipping service
              <select value={serviceId} onChange={e => setServiceId(e.target.value)}>
                <option value="">TikTok default</option>
                {services.map(provider => (
                  <option key={`${provider.shippingProviderId}:${provider.shippingServiceId}`} value={provider.shippingServiceId}>
                    {[provider.shippingProviderName, provider.shippingServiceName].filter(Boolean).join(' · ') || provider.shippingServiceId}
                  </option>
                ))}
              </select>
            </label>
          )}
          <Feedback value={action.feedback} />
          <FormActions busy={action.busy} close={close} disabled={!packageId} label="Confirm shipment" />
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
          if (!packageId) throw new Error('TikTok returned no package.')
          await tiktokApi.shipPackage({ orderId, packageId, handoverMethod })
          ok += 1
        } catch (err) {
          failed.push(`${orderId}: ${err.message}`)
        }
      }
      if (ok === 0 && failed.length) throw new Error(`Could not process the orders: ${failed[0]}`)
      return { ok, failed }
    },
    res => `Confirmed ${res.ok}/${orderIds.length} orders.`,
    done)
  }

  return (
    <HubDialog
      title={`Arrange batch shipment (${orderIds.length} orders)`}
      description="Uses the TikTok Shop default shipping service and confirms each order."
      busy={action.busy}
      close={close}
    >
      <form className={styles.form} onSubmit={submit}>
        <div className={demo.noteBox}>Orders to process: <strong>{orderIds.join(', ')}</strong></div>
        <HandoverSelect value={handoverMethod} onChange={setHandoverMethod} />
        <Feedback value={action.feedback} />
        <FormActions busy={action.busy} close={close} label="Confirm batch shipment" busyLabel="Processing…" />
      </form>
    </HubDialog>
  )
}

export function TiktokEscrowDialog({ orderId, close }) {
  const loader = useCallback(signal => tiktokApi.escrow(orderId, signal), [orderId])
  const resource = useApiResource(loader)
  const p = resource.data
  const amount = value => value == null ? 'No data' : money(value)
  const feesUnknown = p && [p.commissionFee, p.serviceFee, p.transactionFee, p.escrowAmount].every(value => value == null)
  return (
    <HubDialog title="Escrow details" description={`TikTok Shop order ${orderId}`} close={close}>
      <ResourceState resource={resource} />
      {p && (
        <dl className={styles.details}>
          {[
            ['Original item total', amount(p.orderOriginalPrice)],
            ['Buyer paid total', amount(p.buyerTotalAmount)],
            ['Platform discount', amount(p.platformDiscount)],
            ['Seller discount', amount(p.sellerDiscount)],
            ['Shipping fee', amount(p.shippingFee)],
            ['Commission fee', amount(p.commissionFee)],
            ['Transaction fee', amount(p.transactionFee)],
            ['Service fee', amount(p.serviceFee)],
            ['Return refund', amount(p.refundAmount)],
            ['Expected payout', amount(p.escrowAmount)],
            ['Payment method', p.paymentMethod || '—'],
            ['Currency', p.currency || '—'],
          ].map(([label, value]) => (
            <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
          ))}
        </dl>
      )}
      {feesUnknown && <p className={styles.note}>TikTok does not provide platform fees or the payout amount through its API.</p>}
      <div className={styles.actions}>
        <Button variant="secondary" onClick={close}>Close</Button>
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
    const message = `Order ${orderId} cancelled.`
    action.run(async () => {
      const res = await tiktokApi.cancelOrder(orderId, selected)
      if (res?.canceled === false) throw new Error('TikTok did not accept this cancellation.')
      return res
    }, message, () => done(message))
  }

  return (
    <HubDialog title="Cancel TikTok Shop order" description={`Order ${orderId}`} busy={action.busy} close={close}>
      <ResourceState resource={resource} />
      {!resource.loading && !resource.error && (
        <form className={styles.form} onSubmit={submit}>
          <label className={styles.field}>
            Cancellation reason
            <select required value={selected} onChange={e => setReason(e.target.value)}>
              {resource.data.map(item => <option key={item.name} value={item.name}>{item.text || item.textVi || item.name}</option>)}
            </select>
          </label>
          <Feedback value={action.feedback} />
          <FormActions busy={action.busy} close={close} disabled={!selected} variant="destructive" label="Confirm cancellation" />
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
    const message = 'Buyer cancellation request processed.'
    action.run(async () => {
      const res = await tiktokApi.decideCancellation(request.cancel_id, decision, rejectReason || undefined)
      if (res?.approved === false || res?.rejected === false) throw new Error('TikTok did not accept this action.')
      return res
    }, message, () => done(message))
  }

  return (
    <HubDialog title="Review buyer cancellation" description={`Order ${request.order_id}`} busy={action.busy} close={close}>
      <form className={styles.form} onSubmit={submit}>
        <label className={styles.field}>
          Seller decision
          <select value={decision} onChange={e => setDecision(e.target.value)}>
            <option value="approve">Accept cancellation</option>
            <option value="reject">Reject cancellation (keep shipping)</option>
          </select>
        </label>
        {decision === 'reject' && (
          <RejectReasonSelect
            id={request.cancel_id}
            value={rejectReason}
            onChange={setRejectReason}
            disabled={action.busy}
            label="Rejection reason (optional)"
            defaultLabel="TikTok default"
          />
        )}
        <Feedback value={action.feedback} />
        <FormActions busy={action.busy} close={close} label="Confirm decision" />
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
      `TikTok stock updated for SKU ${selected.skuId}.`,
      () => setSelected(null)
    )
  }

  return (
    <>
      <div className={styles.actions}>
        {stockItems.map(item => (
          <Button key={`${item.skuId}:${item.price}`} variant="outline" disabled={action.busy} onClick={() => { setSelected(item); setQuantity('') }}>
            Update TikTok stock · {item.sku}
          </Button>
        ))}
        <Button variant="outline" aria-expanded={checking} onClick={() => setChecking(!checking)}>
          {checking ? 'Hide after-sales eligibility' : 'Check after-sales eligibility'}
        </Button>
      </div>
      {selected && (
        <form className={styles.form} onSubmit={submit}>
          <p>Set TikTok Shop stock for <strong>{selected.name}</strong> ({selected.variant}).</p>
          <p className={styles.note}>Product ID {selected.productId} · SKU ID {selected.skuId}</p>
          <label className={styles.field}>
            New TikTok stock quantity
            <input type="number" min="0" max="2147483647" step="1" required value={quantity} disabled={action.busy} onChange={e => setQuantity(e.target.value)} />
          </label>
          <FormActions busy={action.busy} close={() => setSelected(null)} disabled={!validQuantity} label="Confirm stock update" busyLabel="Updating…" />
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
      {resource.data && <p>{types.length ? `Allowed request types: ${types.join(', ')}` : 'TikTok returned no allowed request types.'}</p>}
    </>
  )
}
