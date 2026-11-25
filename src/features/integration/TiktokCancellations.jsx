import { useCallback, useState } from 'react'
import { tiktokApi } from '@/services/api/tiktok'
import { Button } from '@/shared/ui/button'
import { DataTable, Feedback, OwnerPanel } from '@/features/portal/components/OwnerWorkspaceUI'
import { RejectReasonSelect } from './TiktokRejectReasons'
import { ConfirmationDialog } from './ConfirmationDialog'
import { useApiResource } from './useApiResource'
import { ResourceState, TiktokResourceState } from './ShopeeShared'
import styles from '@/features/portal/OwnerWorkspace.module.css'

export default function TiktokCancellations() {
  const codes = useApiResource(tiktokApi.aftersaleReasons)
  const [filters, setFilters] = useState({ status: '', orderId: '' })
  const [query, setQuery] = useState(filters)
  const [tokens, setTokens] = useState([undefined])
  const [decision, setDecision] = useState(null)
  const [notice, setNotice] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const token = tokens.at(-1)
  const loader = useCallback(signal => tiktokApi.cancellations({
    status: query.status || undefined, orderId: query.orderId.trim() || undefined, pageSize: 20, pageToken: token,
  }, signal), [query, token])
  const resource = useApiResource(loader)
  const rows = resource.data?.cancellations ?? resource.data?.cancel_list ?? []
  const next = resource.data?.next_page_token
  async function confirm() {
    const result = await tiktokApi.decideCancellation(decision.row.cancel_id, decision.type, rejectReason.trim() || undefined)
    if (result?.approved === false || result?.rejected === false) throw new Error('TikTok did not accept this decision.')
    return result
  }

  return <OwnerPanel title="TikTok buyer cancellations">
    <form className={styles.filters} onSubmit={event => { event.preventDefault(); setQuery({ ...filters }); setTokens([undefined]) }}>
      <label className={styles.field}>Order ID<input type="search" value={filters.orderId} onChange={event => setFilters({ ...filters, orderId: event.target.value })} /></label>
      <label className={styles.field}>Cancellation status<select value={filters.status} onChange={event => setFilters({ ...filters, status: event.target.value })}>
        <option value="">All statuses</option>
        {codes.data?.cancelStatuses?.map(item => <option key={item.code} value={item.code}>{item.code}</option>)}
      </select></label>
      <div className={styles.actions}><Button type="submit" variant="outline">Search cancellations</Button></div>
    </form>
    {codes.error && <ResourceState resource={codes} />}
    {notice && <Feedback value={{ message: notice }} />}
    <TiktokResourceState resource={resource} />
    {resource.data && (rows.length ? <DataTable label="TikTok cancellation requests" headings={['Request', 'Order', 'Reason', 'Status', 'Actions']}>
      {rows.map(row => <tr key={row.cancel_id}><td>{row.cancel_id}</td><td>{row.order_id}</td>
        <td>{row.cancel_reason_text || row.cancel_reason}</td><td>{row.cancel_status}</td>
        <td>{row.cancel_status === 'CANCELLATION_REQUEST_PENDING' && <div className={styles.actions}>
          <Button variant="outline" onClick={() => setDecision({ row, type: 'approve' })}>Approve cancellation</Button>
          <Button variant="outline" onClick={() => { setRejectReason(''); setDecision({ row, type: 'reject' }) }}>Reject cancellation</Button>
        </div>}</td>
      </tr>)}
    </DataTable> : <p>No cancellation requests.</p>)}
    {resource.data && (tokens.length > 1 || next) && <div className={styles.actions}>
      <Button variant="secondary" disabled={tokens.length === 1} onClick={() => setTokens(tokens.slice(0, -1))}>Previous page</Button>
      <span>Page {tokens.length}</span>
      <Button variant="secondary" disabled={!next || tokens.includes(next)} onClick={() => setTokens([...tokens, next])}>Next page</Button>
    </div>}
    {decision && <ConfirmationDialog title={decision.type === 'approve' ? 'Approve buyer cancellation' : 'Reject buyer cancellation'}
      description={`TikTok order ${decision.row.order_id} · request ${decision.row.cancel_id}`}
      submit={confirm}
      children={decision.type === 'reject' ? <RejectReasonSelect id={decision.row.cancel_id} value={rejectReason} onChange={setRejectReason} /> : null} close={() => setDecision(null)} done={() => {
        setNotice(decision.type === 'approve' ? 'Cancellation approved.' : 'Cancellation rejected.')
        setDecision(null)
        resource.reload()
      }} />}
  </OwnerPanel>
}
