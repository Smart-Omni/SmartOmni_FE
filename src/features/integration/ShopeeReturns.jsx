import { useCallback, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog'
import { shopeeApi } from '@/services/api/shopee'
import { DataTable, Feedback, OwnerPanel } from '@/features/portal/components/OwnerWorkspaceUI'
import { useApiResource } from './useApiResource'
import { ResourceState } from './ShopeeShared'
import { dateTime, money, useApiAction } from './apiHelpers'
import { marketplaces } from './marketplaces'
import TiktokReturns from './TiktokReturns'
import ShopeeWarehouseReturns from './ShopeeWarehouseReturns'
import InternalReturns from './InternalReturns'
import styles from '@/features/portal/OwnerWorkspace.module.css'

export default function MarketplaceReturns() {
  const [params, setParams] = useSearchParams()
  const provider = params.get('marketplace') === 'tiktok-shop' ? 'tiktok-shop' : 'shopee'
  const warehouse = provider === 'shopee' && params.get('source') === 'warehouse'
  const internal = params.get('source') === 'internal'
  return <>
    <div className={styles.filters}>
      <label className={styles.field}>Marketplace<select value={internal ? 'internal' : provider} onChange={event => setParams(event.target.value === 'internal' ? { source: 'internal' } : event.target.value === 'shopee' ? {} : { marketplace: event.target.value })}>{Object.entries(marketplaces).map(([id, item]) => <option key={id} value={id}>{item.name}</option>)}<option value="internal">SmartOmni</option></select></label>
      {provider === 'shopee' && !internal && <label className={styles.field}>Return source
        <select value={warehouse ? 'warehouse' : 'shopee'} onChange={event => setParams(event.target.value === 'warehouse' ? { source: 'warehouse' } : {})}>
          <option value="shopee">Shopee requests</option>
          <option value="warehouse">Warehouse inspections</option>
        </select>
      </label>}
    </div>
    {internal ? <InternalReturns /> : provider === 'tiktok-shop' ? <TiktokReturns /> : warehouse ? <ShopeeWarehouseReturns /> : <ShopeeReturns />}
  </>
}

function ShopeeReturns() {
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const [selected, setSelected] = useState(null)
  const loader = useCallback(signal => shopeeApi.returns({ pageNo: page, pageSize: 20, status: status || undefined }, signal), [page, status])
  const resource = useApiResource(loader)
  const rows = resource.data?.returnList || []
  return <><OwnerPanel title="Shopee returns & refunds"><div className={styles.filters}><label className={styles.field}>Return status<select value={status} onChange={event => { setStatus(event.target.value); setPage(1) }}><option value="">All statuses</option>{['REQUESTED', 'JUDGING', 'PROCESSING', 'ACCEPTED', 'SELLER_DISPUTE', 'CLOSED', 'CANCELLED'].map(value => <option key={value}>{value}</option>)}</select></label><Button variant="outline" onClick={resource.reload}>Refresh returns</Button></div><ResourceState resource={resource} />{!resource.loading && !resource.error && <>
    {rows.length ? <DataTable label="Shopee return requests" headings={['Return / order', 'Status', 'Refund', 'Reason', 'Action']}>{rows.map(item => <tr key={item.returnSn}><td>{item.returnSn}<p>{item.orderSn}</p></td><td>{item.status}{item.negotiationStatus === 'PENDING_BUYER_RESPOND' && <p>Offer pending buyer</p>}</td><td>{money(item.refundAmount)}</td><td>{item.reason}{(item.isNfrExempt || item.reason === 'CHANGE_OF_MIND') && <p>NFR exempt</p>}<p>{item.textReason}</p>{item.disputeDueDate ? <p>Dispute due: {dateTime(item.disputeDueDate * 1000)}</p> : item.expectedReturnDate ? <p>Expected return: {dateTime(item.expectedReturnDate * 1000)}</p> : item.buyerReturnDueDate ? <p>Buyer ship due: {dateTime(item.buyerReturnDueDate * 1000)}</p> : item.dueDate ? <p>Due: {dateTime(item.dueDate * 1000)}</p> : null}</td><td><Button variant="outline" onClick={() => setSelected(item.returnSn)}>Review return</Button></td></tr>)}</DataTable> : <p className={styles.empty}>No returns match your filters.</p>}
    {(page > 1 || resource.data?.more) && <div className={`${styles.actions} ${styles.pagination}`}><Button variant="secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous page</Button><span>Page {page} · {resource.data?.total || 0} returns</span><Button variant="secondary" disabled={!resource.data?.more} onClick={() => setPage(page + 1)}>Next page</Button></div>}
  </>}</OwnerPanel>{selected && <ReturnDetail key={selected} returnSn={selected} close={() => setSelected(null)} reload={resource.reload} />}</>
}

const DEFAULT_SHOPEE_DISPUTE_REASONS = [
  { disputeReasonId: 47, disputeName: 'ITEM_DAMAGED_BY_BUYER', disputeRequirement: 'Returned product was damaged or used by buyer' },
  { disputeReasonId: 48, disputeName: 'WEIGHT_MEASUREMENT_MISMATCH', disputeRequirement: 'Parcel weight mismatch before dispatch and on return' },
  { disputeReasonId: 50, disputeName: 'INCORRECT_CLAIM', disputeRequirement: 'Buyer claim is incorrect or returned parcel is incorrect' },
  { disputeReasonId: 51, disputeName: 'NON_RECEIPT_REJECT', disputeRequirement: 'Reject non-receipt claim with delivery proof' },
  { disputeReasonId: 52, disputeName: 'NOT_RECEIVED_RETURN', disputeRequirement: 'Return parcel was never received from carrier' },
  { disputeReasonId: 49, disputeName: 'OTHER', disputeRequirement: 'Other supporting statement and evidence' },
]

function ReturnDetail({ returnSn, close, reload }) {
  const loader = useCallback(() => shopeeApi.returnDetail(returnSn), [returnSn])
  const reasonsLoader = useCallback(() => shopeeApi.disputeReasons(returnSn).catch(() => DEFAULT_SHOPEE_DISPUTE_REASONS), [returnSn])
  const resource = useApiResource(loader)
  const reasonsResource = useApiResource(reasonsLoader)
  const action = useApiAction()
  const [intent, setIntent] = useState('')
  const [reasonId, setReasonId] = useState('50')
  const [text, setText] = useState('')
  const [email, setEmail] = useState('')
  const [proof, setProof] = useState('')
  const [offerAmount, setOfferAmount] = useState('')
  const [offerReason, setOfferReason] = useState('')
  const detail = resource.data
  const disputeReasons = reasonsResource.data?.length ? reasonsResource.data : DEFAULT_SHOPEE_DISPUTE_REASONS
  const nowSec = Math.floor(Date.now() / 1000)
  const withinDisputeWindow = !detail?.disputeDueDate || nowSec <= detail.disputeDueDate
  const canDispute = Boolean(detail) && (
    detail.status === 'REQUESTED' ||
    (detail.status === 'ACCEPTED' && detail.needsLogistics === false
      && detail.compensationStatus !== 'COMPENSATION_REQUESTED'
      && detail.compensationStatus !== 'COMPENSATION_APPROVED'
      && withinDisputeWindow) ||
    (detail.status === 'PROCESSING'
      && (Boolean(detail.reverseDeliveredAt) || (Boolean(detail.expectedReturnDate) && nowSec >= detail.expectedReturnDate))
      && withinDisputeWindow)
  )
  const canOffer = Boolean(detail)
    && (detail.status === 'REQUESTED' || detail.status === 'PROCESSING')
    && detail.negotiationStatus !== 'PENDING_BUYER_RESPOND'
  async function handleProofUpload(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    await action.run(async () => {
      const res = await shopeeApi.convertReturnImage(file, returnSn)
      if (!res?.url) throw new Error('Image upload did not return a URL.')
      setProof(prev => (prev.trim() ? `${prev.trim()}\n${res.url}` : res.url))
      return res
    }, 'Proof image uploaded.')
  }
  function submit(event) {
    event.preventDefault()
    action.run(async () => {
      if (intent === 'offer') {
        const result = await shopeeApi.offerReturn(returnSn, { offerAmount: Number(offerAmount), offerReason })
        if (result.offered === false) throw new Error('Shopee did not accept this counter-offer.')
        return result
      }
      if (intent === 'confirm') {
        const result = await shopeeApi.confirmReturn(returnSn)
        if (result.confirmed === false) throw new Error('Shopee did not accept this request.')
        return result
      }
      const proofImages = proof.split('\n').map(value => value.trim()).filter(Boolean)
      if (proofImages.some(value => { try { return !['https:', 'http:'].includes(new URL(value).protocol) } catch { return true } })) throw new Error('Each proof image must be a valid HTTP/HTTPS URL.')
      const result = await shopeeApi.disputeReturn(returnSn, { disputeReasonId: Number(reasonId), disputeTextReason: text, email, proofImages })
      if (result.disputed === false) throw new Error('Shopee did not accept this request.')
      return result
    }, intent === 'confirm' ? 'Return accepted.' : intent === 'offer' ? 'Counter-offer submitted.' : 'Dispute submitted.', () => { reload(); close() })
  }
  return <Dialog open onOpenChange={open => { if (!open && !action.busy) close() }}><DialogContent className={`${styles.dialog} ${styles.marketplaceDialog}`}><DialogTitle>Return {returnSn}</DialogTitle><DialogDescription>Review buyer evidence before accepting a refund, proposing an offer, or submitting a dispute.</DialogDescription><ResourceState resource={resource} />{detail && <><p>{detail.orderSn} · {detail.status} · {money(detail.refundAmount)}</p><p>{detail.reason}{(detail.isNfrExempt || detail.reason === 'CHANGE_OF_MIND') ? ' (NFR exempt)' : ''} · {detail.textReason}</p><p>Buyer: {detail.buyerUsername} · Reverse shipping: {money(detail.reverseShippingFee)}{detail.trackingNumber ? ` · Tracking: ${detail.trackingNumber}` : ''}</p>{detail.disputeDueDate && <p>Dispute deadline: {dateTime(detail.disputeDueDate * 1000)}</p>}{detail.expectedReturnDate && !detail.reverseDeliveredAt && <p>Expected return delivery: {dateTime(detail.expectedReturnDate * 1000)}</p>}{detail.rulingNotes && <p>{detail.rulingNotes}</p>}<DataTable label="Returned items" headings={['Item', 'Quantity', 'Refund']}>{detail.items?.map((item, index) => <tr key={index}><td>{item.name}</td><td>{item.quantity}</td><td>{money(item.refundAmount)}</td></tr>)}</DataTable><p>Buyer evidence</p>{detail.buyerProofImages?.length ? <ul>{detail.buyerProofImages.map((url, index) => /^https:\/\//i.test(url) ? <li key={index}><a href={url} target="_blank" rel="noreferrer">Proof image {index + 1}</a></li> : null)}</ul> : <p>No buyer proof images supplied.</p>}<div className={styles.actions}>{canDispute && <Button variant="outline" disabled={action.busy} onClick={() => setIntent('dispute')}>Dispute return</Button>}{canOffer && <Button variant="outline" disabled={action.busy} onClick={() => { setOfferAmount(String(Math.round(Number(detail.refundAmount || 0) * 0.5))); setIntent('offer') }}>Propose partial refund</Button>}<Button variant="destructive" disabled={action.busy} onClick={() => setIntent('confirm')}>Accept refund</Button></div>
  {intent && <form className={styles.form} onSubmit={submit}>{intent === 'confirm' ? <p>Confirm acceptance of this buyer return and refund?</p> : intent === 'offer' ? <><label className={styles.field}>Offer amount (VND)<input required type="number" min="1" max={Number(detail.refundAmount || 0)} step="1" value={offerAmount} onChange={event => setOfferAmount(event.target.value)} /></label><label className={styles.field}>Offer reason<textarea maxLength={500} value={offerReason} onChange={event => setOfferReason(event.target.value)} placeholder="Propose partial refund without returning item..." /></label></> : <><label className={styles.field}>Shopee dispute reason<select required value={reasonId} onChange={event => setReasonId(event.target.value)}>{disputeReasons.map(r => <option key={r.disputeReasonId} value={r.disputeReasonId}>#{r.disputeReasonId} · {r.disputeName}</option>)}</select></label><p className={styles.note}>{disputeReasons.find(r => String(r.disputeReasonId) === String(reasonId))?.disputeRequirement || 'Select a Shopee dispute reason.'}</p><label className={styles.field}>Dispute explanation<textarea required maxLength={2000} value={text} onChange={event => setText(event.target.value)} /></label><label className={styles.field}>Contact email<input required type="email" value={email} onChange={event => setEmail(event.target.value)} /></label><label className={styles.field}>Upload proof image (.jpg, .png)<input type="file" accept="image/jpeg,image/png" disabled={action.busy} onChange={handleProofUpload} /></label><label className={styles.field}>Proof image URLs (one URL per line)<textarea required value={proof} onChange={event => setProof(event.target.value)} /></label></>}<Feedback value={action.feedback} /><div className={styles.actions}><Button type="button" variant="secondary" onClick={() => setIntent('')} disabled={action.busy}>Back</Button><Button type="submit" disabled={action.busy}>{action.busy ? 'Submitting…' : intent === 'confirm' ? 'Confirm refund acceptance' : intent === 'offer' ? 'Send counter-offer' : 'Submit dispute'}</Button></div></form>}</>}</DialogContent></Dialog>
}
