import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog'
import { tiktokApi } from '@/services/api/tiktok'
import { DataTable, Feedback, OwnerPanel } from '@/features/portal/components/OwnerWorkspaceUI'
import { useApiResource } from './useApiResource'
import { ResourceState } from './ShopeeShared'
import { dateTime, money, useApiAction } from './apiHelpers'
import styles from '@/features/portal/OwnerWorkspace.module.css'

// TikTok Open API return statuses; not yet verified against the TikTok simulator.
const returnStatuses = ['RETURN_OR_REFUND_REQUEST_PENDING', 'REFUND_OR_RETURN_REQUEST_REJECT', 'AWAITING_BUYER_SHIP', 'BUYER_SHIPPED_ITEM', 'REJECT_RECEIVE_PACKAGE', 'RETURN_OR_REFUND_REQUEST_SUCCESS', 'RETURN_OR_REFUND_REQUEST_CANCEL', 'RETURN_OR_REFUND_REQUEST_COMPLETE']
// Statuses in which the seller may approve or reject a return.
const sellerDecisionStatuses = ['RETURN_OR_REFUND_REQUEST_PENDING']

export default function TiktokReturns() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('')
  const [orderInput, setOrderInput] = useState('')
  const [orderId, setOrderId] = useState('')
  const [tokens, setTokens] = useState([null])
  const [selected, setSelected] = useState(null)
  const [notice, setNotice] = useState(null)
  const pageToken = tokens[tokens.length - 1]
  const loader = useCallback(signal => tiktokApi.returns({ pageSize: 20, status: status || undefined, orderId: orderId || undefined, pageToken: pageToken || undefined }, signal), [status, orderId, pageToken])
  const resource = useApiResource(loader)
  const rows = resource.data?.returns || []
  function search(event) { event.preventDefault(); setOrderId(orderInput.trim()); setTokens([null]) }
  return <><OwnerPanel title="TikTok returns & refunds"><form className={styles.filters} onSubmit={search}>
    <label className={styles.field}>Return status<select value={status} onChange={event => { setStatus(event.target.value); setTokens([null]) }}><option value="">All statuses</option>{returnStatuses.map(value => <option key={value}>{value}</option>)}</select></label>
    <label className={styles.field}>Order ID<input type="search" value={orderInput} onChange={event => setOrderInput(event.target.value)} placeholder="TikTok order ID" /></label>
    <div className={styles.actions}><Button type="submit" variant="outline">Search returns</Button><Button type="button" variant="outline" onClick={resource.reload}>Refresh returns</Button></div>
  </form>
  {notice && <Feedback value={notice} />}{resource.errorStatus === 409 ? <><Feedback value={{ error: true, message: 'TikTok Shop is not connected. Connect your TikTok shop to view its returns.' }} /><Button variant="outline" onClick={() => navigate('/merchant/shops?marketplace=tiktok-shop')}>Connect TikTok Shop</Button></> : <ResourceState resource={resource} />}
  {!resource.loading && !resource.error && <><DataTable label="TikTok return requests" headings={['Return / order', 'Status', 'Refund', 'Reason', 'Action']}>{rows.map(item => <tr key={item.return_id}><td>{item.return_id}<p>{item.order_id}</p></td><td>{item.return_status}<p>{item.return_type}</p></td><td>{money(item.refund_amount)}</td><td>{item.return_reason_text || item.return_reason}<p>Created: {dateTime(item.create_time)}</p></td><td><Button variant="outline" onClick={() => { setNotice(null); setSelected(item.return_id) }}>Review return</Button></td></tr>)}</DataTable>{!rows.length && <p>No returns match your filters.</p>}
    <div className={styles.actions}><Button variant="secondary" disabled={tokens.length === 1} onClick={() => setTokens(tokens.slice(0, -1))}>Previous page</Button><span>Page {tokens.length}{resource.data?.totalCount != null && ` · ${resource.data.totalCount} returns`}</span><Button variant="secondary" disabled={!resource.data?.nextPageToken} onClick={() => setTokens([...tokens, resource.data.nextPageToken])}>Next page</Button></div></>}
  </OwnerPanel>{selected && <ReturnDetail key={selected} returnId={selected} close={() => setSelected(null)} done={message => { setNotice({ message }); setSelected(null); resource.reload() }} />}</>
}

function ReturnDetail({ returnId, close, done }) {
  const loader = useCallback(signal => tiktokApi.returnDetail(returnId, signal), [returnId])
  const resource = useApiResource(loader)
  const action = useApiAction()
  const [intent, setIntent] = useState('')
  const [reason, setReason] = useState('')
  const detail = resource.data
  function submit(event) {
    event.preventDefault()
    const message = intent === 'approve' ? 'Return approved.' : 'Return rejected.'
    action.run(async () => {
      const result = intent === 'approve' ? await tiktokApi.approveReturn(returnId) : await tiktokApi.rejectReturn(returnId, reason.trim())
      if (result?.approved === false || result?.rejected === false) throw new Error('TikTok did not accept this request.')
      return result
    }, message, () => done(message))
  }
  return <Dialog open onOpenChange={open => { if (!open && !action.busy) close() }}><DialogContent className={styles.dialog}><DialogTitle>Return {returnId}</DialogTitle><DialogDescription>Review the buyer request before approving or rejecting it on TikTok.</DialogDescription><ResourceState resource={resource} />{detail && <><p>Order {detail.order_id} · {detail.return_status} · {detail.return_type}</p><p>{detail.return_reason_text || detail.return_reason}</p><p>Refund: {money(detail.refund_amount)} · Return tracking: {detail.return_tracking_number || 'Not assigned'}</p>
    {detail.return_line_items?.length ? <DataTable label="Returned items" headings={['Seller SKU', 'Quantity', 'Refund']}>{detail.return_line_items.map((item, index) => <tr key={item.return_item_id || index}><td>{item.seller_sku || item.sku_id}</td><td>{item.quantity}</td><td>{money(item.refund_amount)}</td></tr>)}</DataTable> : <p>TikTok returned no line items for this return.</p>}
    {sellerDecisionStatuses.includes(detail.return_status) && <div className={styles.actions}><Button variant="outline" disabled={action.busy} onClick={() => setIntent('reject')}>Reject return</Button><Button variant="destructive" disabled={action.busy} onClick={() => setIntent('approve')}>Approve return</Button></div>}
    {intent && <form className={styles.form} onSubmit={submit}>{intent === 'approve' ? <p>Approve this buyer return and refund on TikTok?</p> : <><p>Reject this buyer return on TikTok?</p><label className={styles.field}>Reject reason (optional)<input maxLength={200} value={reason} onChange={event => setReason(event.target.value)} /></label></>}<Feedback value={action.feedback} /><div className={styles.actions}><Button type="button" variant="secondary" onClick={() => setIntent('')} disabled={action.busy}>Back</Button><Button type="submit" disabled={action.busy}>{action.busy ? 'Submitting…' : intent === 'approve' ? 'Confirm approval' : 'Confirm rejection'}</Button></div></form>}</>}</DialogContent></Dialog>
}
