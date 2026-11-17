import { useRef, useState } from 'react'
import { tiktokApi } from '@/services/api/tiktok'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog'
import { DataTable, Feedback, OwnerPanel } from '@/features/portal/components/OwnerWorkspaceUI'
import { useApiResource } from './useApiResource'
import { TiktokResourceState } from './ShopeeShared'
import { dateTime, useApiAction } from './apiHelpers'
import styles from '@/features/portal/OwnerWorkspace.module.css'

export default function TiktokVouchers() {
  const resource = useApiResource(tiktokApi.vouchers)
  const action = useApiAction()
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState('')
  const rows = resource.data || []

  return <OwnerPanel title="TikTok Shop vouchers">
    <div className={styles.actions}>
      <Button disabled={!resource.data || action.busy} onClick={() => { setCreated(''); setCreating(true) }}>Create voucher</Button>
      <Button variant="outline" disabled={!resource.data || action.busy}
        onClick={() => action.run(tiktokApi.syncVouchers, vouchers => `${vouchers.length} vouchers synchronized.`, resource.reload)}>Sync vouchers</Button>
    </div>
    {created && <Feedback value={{ message: created }} />}
    <Feedback value={action.feedback} />
    <TiktokResourceState resource={resource} />
    {resource.data && (rows.length ? <DataTable label="TikTok vouchers" headings={['Voucher', 'Discount', 'Redeemed', 'Expires', 'Status']}>
      {rows.map(row => <tr key={row.id || row.tiktokVoucherId}><td>{row.title}<p>{row.voucherCode}</p></td>
        <td>{row.discountValue}{row.discountType === 'PERCENT_OFF' ? '%' : ' VND'}</td>
        <td>{row.redeemedCount ?? 0}{row.usageLimit != null && ` / ${row.usageLimit}`}</td>
        <td>{dateTime(row.endTime)}</td><td>{row.status}</td></tr>)}
    </DataTable> : <p>No vouchers found.</p>)}
    {creating && <VoucherDialog close={() => setCreating(false)} done={voucher => {
      setCreating(false)
      setCreated(`Voucher ${voucher.voucherCode || voucher.title} created.`)
      resource.reload()
    }} />}
  </OwnerPanel>
}

function VoucherDialog({ close, done }) {
  const action = useApiAction()
  const [type, setType] = useState('PERCENT_OFF')
  const attempt = useRef(null)

  function submit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    action.run(() => {
      const value = key => String(form.get(key) || '').trim()
      const number = key => value(key) ? Number(value(key)) : undefined
      const date = key => value(key) ? new Date(value(key)).toISOString() : undefined
      const body = {
        title: value('title'), discountType: type, discountValue: number('discountValue'),
        maxDiscountAmount: number('maxDiscountAmount'), minOrderAmount: number('minOrderAmount'),
        usageLimit: number('usageLimit'), code: value('code') || undefined,
        customerId: value('customerId') || undefined, startTime: date('startTime'), endTime: date('endTime'),
      }
      if (!body.title) throw new Error('Enter a voucher title.')
      if (body.startTime && body.endTime && body.endTime <= body.startTime) throw new Error('End time must be after start time.')
      const payload = JSON.stringify(body)
      if (attempt.current?.payload !== payload) {
        const key = Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('')
        attempt.current = { payload, key }
      }
      return tiktokApi.createVoucher({ ...body, idempotencyKey: attempt.current.key })
    }, 'Voucher created.', done)
  }

  return <Dialog open onOpenChange={open => { if (!open && !action.busy) close() }}>
    <DialogContent className={styles.dialog} showCloseButton={!action.busy}>
      <DialogTitle>Create TikTok voucher</DialogTitle>
      <DialogDescription>Publish a discount for this connected TikTok Shop.</DialogDescription>
      <form className={styles.form} onSubmit={submit}>
        <fieldset className={styles.fieldColumns} disabled={action.busy}>
          <label className={styles.field}>Voucher title<input required name="title" /></label>
          <label className={styles.field}>Voucher code<input name="code" /></label>
          <label className={styles.field}>Discount type<select value={type} onChange={event => setType(event.target.value)}>
            <option value="PERCENT_OFF">Percentage</option><option value="AMOUNT_OFF">Fixed amount</option>
          </select></label>
          <label className={styles.field}>Discount value<input name="discountValue" required type="number" min="0.01" step="0.01" max={type === 'PERCENT_OFF' ? 100 : undefined} /></label>
          {type === 'PERCENT_OFF' && <label className={styles.field}>Maximum discount<input name="maxDiscountAmount" type="number" min="0.01" step="0.01" /></label>}
          <label className={styles.field}>Minimum order amount<input name="minOrderAmount" type="number" min="0" step="0.01" /></label>
          <label className={styles.field}>Usage limit<input name="usageLimit" type="number" min="1" step="1" max="2147483647" /></label>
          <label className={styles.field}>Customer ID<input name="customerId" /></label>
          <label className={styles.field}>Starts (local time)<input name="startTime" type="datetime-local" /></label>
          <label className={styles.field}>Ends (local time)<input name="endTime" type="datetime-local" /></label>
        </fieldset>
        <Feedback value={action.feedback} />
        <div className={styles.actions}>
          <Button type="button" variant="secondary" onClick={close} disabled={action.busy}>Back</Button>
          <Button type="submit" disabled={action.busy}>{action.busy ? 'Creating…' : 'Publish voucher'}</Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>
}
