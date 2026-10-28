import { useCallback, useState } from 'react'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog'
import { shopeeApi } from '@/services/api/shopee'
import { DataTable, Feedback, OwnerPanel } from '@/features/portal/components/OwnerWorkspaceUI'
import { useApiResource } from './useApiResource'
import { ResourceState } from './ShopeeShared'
import { dateTime, money, useApiAction } from './apiHelpers'
import styles from '@/features/portal/OwnerWorkspace.module.css'

export default function ShopeeReturns() {
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const [selected, setSelected] = useState(null)
  const loader = useCallback(signal => shopeeApi.returns({ pageNo: page, pageSize: 20, status: status || undefined }, signal), [page, status])
  const resource = useApiResource(loader)
  return <><OwnerPanel title="Shopee returns & refunds"><div className={styles.filters}><label className={styles.field}>Return status<select value={status} onChange={event => { setStatus(event.target.value); setPage(1) }}><option value="">All statuses</option>{['REQUESTED', 'ACCEPTED', 'PROCESSING', 'JUDGING', 'REFUND_PAID', 'CLOSED', 'CANCELLED'].map(value => <option key={value}>{value}</option>)}</select></label><Button variant="outline" onClick={resource.reload}>Refresh returns</Button></div><ResourceState resource={resource} />{!resource.loading && !resource.error && <><DataTable label="Shopee return requests" headings={['Return / order', 'Status', 'Refund', 'Reason', 'Action']}>{resource.data?.returnList?.map(item => <tr key={item.returnSn}><td>{item.returnSn}<p>{item.orderSn}</p></td><td>{item.status}</td><td>{money(item.refundAmount)}</td><td>{item.reason}<p>{item.textReason}</p><p>Due: {dateTime(item.dueDate)}</p></td><td><Button variant="outline" onClick={() => setSelected(item.returnSn)}>Review return</Button></td></tr>)}</DataTable>{!resource.data?.returnList?.length && <p>No returns match your filters.</p>}<div className={styles.actions}><Button variant="secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous page</Button><span>Page {page} · {resource.data?.total || 0} returns</span><Button variant="secondary" disabled={!resource.data?.more} onClick={() => setPage(page + 1)}>Next page</Button></div></>}</OwnerPanel>{selected && <ReturnDetail key={selected} returnSn={selected} close={() => setSelected(null)} reload={resource.reload} />}</>
}

function ReturnDetail({ returnSn, close, reload }) {
  const loader = useCallback(() => shopeeApi.returnDetail(returnSn), [returnSn])
  const resource = useApiResource(loader)
  const action = useApiAction()
  const [intent, setIntent] = useState('')
  const [reasonId, setReasonId] = useState('')
  const [text, setText] = useState('')
  const [email, setEmail] = useState('')
  const [proof, setProof] = useState('')
  const detail = resource.data
  function submit(event) {
    event.preventDefault()
    action.run(async () => {
      const proofImages = proof.split('\n').map(value => value.trim()).filter(Boolean)
      if (proofImages.some(value => { try { return new URL(value).protocol !== 'https:' } catch { return true } })) throw new Error('Each proof image must be a valid HTTPS URL.')
      const result = intent === 'confirm' ? await shopeeApi.confirmReturn(returnSn) : await shopeeApi.disputeReturn(returnSn, { disputeReasonId: Number(reasonId), disputeTextReason: text, email, proofImages })
      if (result.confirmed === false || result.disputed === false) throw new Error('Shopee did not accept this request.')
      return result
    }, intent === 'confirm' ? 'Return accepted.' : 'Dispute submitted.', () => { reload(); close() })
  }
  return <Dialog open onOpenChange={open => { if (!open && !action.busy) close() }}><DialogContent className={styles.dialog}><DialogTitle>Return {returnSn}</DialogTitle><DialogDescription>Review buyer evidence before accepting a refund or submitting a dispute.</DialogDescription><ResourceState resource={resource} />{detail && <><p>{detail.orderSn} · {detail.status} · {money(detail.refundAmount)}</p><p>{detail.reason} · {detail.textReason}</p><p>Buyer: {detail.buyerUsername} · Reverse shipping: {money(detail.reverseShippingFee)}</p>{detail.rulingNotes && <p>{detail.rulingNotes}</p>}<DataTable label="Returned items" headings={['Item', 'Quantity', 'Refund']}>{detail.items?.map((item, index) => <tr key={index}><td>{item.name}</td><td>{item.quantity}</td><td>{money(item.refundAmount)}</td></tr>)}</DataTable><p>Buyer evidence</p>{detail.buyerProofImages?.length ? <ul>{detail.buyerProofImages.map((url, index) => /^https:\/\//i.test(url) ? <li key={index}><a href={url} target="_blank" rel="noreferrer">Proof image {index + 1}</a></li> : null)}</ul> : <p>No buyer proof images supplied.</p>}<div className={styles.actions}><Button variant="outline" disabled={action.busy} onClick={() => setIntent('dispute')}>Dispute return</Button><Button variant="destructive" disabled={action.busy} onClick={() => setIntent('confirm')}>Accept refund</Button></div>
  {intent && <form className={styles.form} onSubmit={submit}>{intent === 'confirm' ? <p>Confirm acceptance of this buyer return and refund?</p> : <><label className={styles.field}>Shopee dispute reason ID<input required type="number" min="1" step="1" value={reasonId} onChange={event => setReasonId(event.target.value)} /></label><p className={styles.note}>Use a reason ID provided by Shopee. The current backend has no reason-list or image-upload API.</p><label className={styles.field}>Dispute explanation<textarea required maxLength={2000} value={text} onChange={event => setText(event.target.value)} /></label><label className={styles.field}>Contact email<input required type="email" value={email} onChange={event => setEmail(event.target.value)} /></label><label className={styles.field}>Proof image URLs (one HTTPS URL per line)<textarea required value={proof} onChange={event => setProof(event.target.value)} /></label></>}<Feedback value={action.feedback} /><div className={styles.actions}><Button type="button" variant="secondary" onClick={() => setIntent('')} disabled={action.busy}>Back</Button><Button type="submit" disabled={action.busy}>{action.busy ? 'Submitting…' : intent === 'confirm' ? 'Confirm refund acceptance' : 'Submit dispute'}</Button></div></form>}</>}</DialogContent></Dialog>
}
