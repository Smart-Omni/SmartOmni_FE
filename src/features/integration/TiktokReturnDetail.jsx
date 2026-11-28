import { useCallback, useState } from 'react'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog'
import { tiktokApi } from '@/services/api/tiktok'
import { DataTable, Feedback } from '@/features/portal/components/OwnerWorkspaceUI'
import { useApiResource } from './useApiResource'
import { ResourceState } from './ShopeeShared'
import { dateTime, money, useApiAction } from './apiHelpers'
import { RejectReasonSelect } from './TiktokRejectReasons'
import { getTiktokReturnMeta, refundTotal } from './tiktokReturnHub'
import styles from '@/features/portal/OwnerWorkspace.module.css'

export default function TiktokReturnDetail({ returnId, initialIntent = '', close, done }) {
  const loader = useCallback(signal => tiktokApi.returnDetail(returnId, signal), [returnId])
  const resource = useApiResource(loader)
  const action = useApiAction()
  const [intent, setIntent] = useState(initialIntent)
  const [reason, setReason] = useState('')
  const detail = resource.data
  const meta = detail ? getTiktokReturnMeta(detail) : null

  function submit(event) {
    event.preventDefault()
    const message = intent === 'approve' ? 'Return approved.' : 'Return rejected.'
    action.run(async () => {
      const result = intent === 'approve' ? await tiktokApi.approveReturn(returnId) : await tiktokApi.rejectReturn(returnId, reason.trim())
      if (result?.approved === false || result?.rejected === false) throw new Error('TikTok did not accept this request.')
      return result
    }, message, () => done(message))
  }

  return <Dialog open onOpenChange={open => { if (!open && !action.busy) close() }}>
    <DialogContent className={`${styles.dialog} ${styles.marketplaceDialog}`}>
      <DialogTitle>Return {returnId}</DialogTitle>
      <DialogDescription>Review the buyer request before approving or rejecting it on TikTok.</DialogDescription>
      <ResourceState resource={resource} />
      {detail && <>
        <p>Order {detail.order_id} · {detail.return_status} · {detail.return_type}</p>
        <p>{detail.return_reason_text || detail.return_reason}</p>
        <p>Refund: {money(refundTotal(detail))} · Return tracking: {detail.return_tracking_number || 'Not assigned'}</p>
        {detail.return_line_items?.length ? <DataTable label="Returned items" headings={['Seller SKU', 'Quantity', 'Refund']}>
          {detail.return_line_items.map((item, index) => <tr key={item.return_line_item_id || item.return_item_id || index}><td>{item.seller_sku || item.sku_id}</td><td>{item.quantity ?? 1}</td><td>{money(refundTotal(item))}</td></tr>)}
        </DataTable> : <p>TikTok returned no line items for this return.</p>}
        <ReturnRecords returnId={returnId} />
        {meta.canDecide && <div className={styles.actions}>
          <Button variant="outline" disabled={action.busy} onClick={() => setIntent('reject')}>Reject return</Button>
          <Button variant="destructive" disabled={action.busy} onClick={() => setIntent('approve')}>Approve return</Button>
        </div>}
        {intent && meta.canDecide && <form className={styles.form} onSubmit={submit}>
          {intent === 'approve'
            ? <p>{meta.shipped ? 'Confirm the returned parcel arrived and refund the buyer on TikTok?' : 'Approve this buyer return and refund on TikTok?'}</p>
            : <><p>Reject this buyer return on TikTok?</p><RejectReasonSelect id={returnId} value={reason} onChange={setReason} disabled={action.busy} /></>}
          <Feedback value={action.feedback} />
          <div className={styles.actions}>
            <Button type="button" variant="secondary" onClick={() => setIntent('')} disabled={action.busy}>Back</Button>
            <Button type="submit" disabled={action.busy}>{action.busy ? 'Submitting…' : intent === 'approve' ? 'Confirm approval' : 'Confirm rejection'}</Button>
          </div>
        </form>}
      </>}
    </DialogContent>
  </Dialog>
}

function ReturnRecords({ returnId }) {
  const loader = useCallback(signal => tiktokApi.returnRecords(returnId, signal), [returnId])
  const resource = useApiResource(loader)
  const raw = resource.data
  const records = Array.isArray(raw) ? raw : raw?.records ?? raw?.return_records ?? []
  return <>
    <h4>Processing history</h4>
    <ResourceState resource={resource} />
    {!resource.loading && !resource.error && (records.length
      ? <DataTable label="Processing history" headings={['Time', 'Role', 'Event', 'Details']}>
        {records.map((item, index) => <tr key={index}><td>{dateTime(item.create_time)}</td><td>{item.role}</td><td>{item.event}</td><td>{[item.description, item.note, item.reason_text].filter(Boolean).join(' · ') || '—'}</td></tr>)}
      </DataTable>
      : <p>No processing history yet.</p>)}
  </>
}
