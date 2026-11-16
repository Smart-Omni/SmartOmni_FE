import { useCallback, useState } from 'react'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog'
import { shopeeApi } from '@/services/api/shopee'
import { DataTable, Feedback, OwnerPanel } from '@/features/portal/components/OwnerWorkspaceUI'
import { useApiResource } from './useApiResource'
import { useApiAction } from './apiHelpers'
import { ResourceState } from './ShopeeShared'
import styles from '@/features/portal/OwnerWorkspace.module.css'

const results = {
  MATCHED: 'Matched',
  DAMAGED: 'Damaged',
  SWAPPED: 'Swapped',
  MISSING_ITEMS: 'Missing items',
}

function pendingInspection(detail) {
  return detail.platform === 'SHOPEE' && detail.return_type === 'PHYSICAL_RETURN'
    && detail.status === 'REQUESTED' && detail.inspection_result === 'PENDING' && !detail.restocked
}

export default function ShopeeWarehouseReturns() {
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState(null)
  const loader = useCallback(signal => shopeeApi.warehouseReturns({ page, size: 20, sort: 'id,desc' }, signal), [page])
  const resource = useApiResource(loader)
  const rows = resource.data?.content?.filter(item => item.platform === 'SHOPEE' && item.return_type === 'PHYSICAL_RETURN') || []

  return <OwnerPanel title="Warehouse inspections">
    <p>Review physical Shopee returns synced to SmartOmni before restocking.</p>
    <Button variant="outline" onClick={resource.reload}>Refresh inspections</Button>
    <ResourceState resource={resource} />
    {resource.data && <>
      {rows.length ? <DataTable label="Shopee warehouse returns" headings={['Return', 'Order', 'Status', 'Inspection', 'Action']}>
        {rows.map(item => <tr key={item.id}>
          <td>{item.external_return_id || item.id}</td>
          <td>{item.platform_order_id || item.order_id}</td>
          <td>{item.status}</td>
          <td>{results[item.inspection_result] || item.inspection_result || '—'}</td>
          <td><Button variant="outline" onClick={() => setSelected(item.id)}>View inspection</Button></td>
        </tr>)}
      </DataTable> : <p>No physical Shopee returns on this page.</p>}
      {(page > 0 || page + 1 < resource.data.totalPages) && <div className={styles.actions}>
        <Button variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous page</Button>
        <span>Page {page + 1} of {resource.data.totalPages}</span>
        <Button variant="secondary" disabled={page + 1 >= resource.data.totalPages} onClick={() => setPage(page + 1)}>Next page</Button>
      </div>}
    </>}
    {selected !== null && <InspectionDialog key={selected} returnId={selected} close={() => setSelected(null)} reload={resource.reload} />}
  </OwnerPanel>
}

function InspectionDialog({ returnId, close, reload }) {
  const loader = useCallback(signal => shopeeApi.warehouseReturn(returnId, signal), [returnId])
  const resource = useApiResource(loader)
  const action = useApiAction()
  const [result, setResult] = useState('')
  const [video, setVideo] = useState('')
  const detail = resource.data
  const items = detail?.items || []
  const canRestock = items.length > 0
    && items.every(item => item.sku_id != null && Number.isInteger(item.quantity_returned) && item.quantity_returned > 0
      && (item.quantity_inspected == null || item.quantity_inspected === item.quantity_returned))
    && new Set(items.map(item => item.sku_id)).size === items.length

  function submit(event) {
    event.preventDefault()
    if (!detail || !pendingInspection(detail) || !Object.hasOwn(results, result) || (result === 'MATCHED' && !canRestock)) return
    action.run(async () => {
      const evidence = video.trim()
      if (evidence && !/^https:\/\//i.test(evidence)) throw new Error('Use an HTTPS URL for the video evidence.')
      return shopeeApi.inspectReturn(returnId, { result, ...(evidence ? { video_evidence_url: evidence } : {}) })
    }, 'Inspection saved.', () => {
      setResult('')
      resource.reload()
      reload()
    })
  }

  return <Dialog open onOpenChange={open => { if (!open && !action.busy) close() }}>
    <DialogContent className={`${styles.dialog} ${styles.marketplaceDialog}`} showCloseButton={!action.busy}>
      <DialogTitle>Return inspection {detail?.external_return_id || returnId}</DialogTitle>
      <DialogDescription>Confirm what the warehouse received. A matched result restocks the recorded SKUs.</DialogDescription>
      <ResourceState resource={resource} />
      {detail && <>
        <p>{detail.status} · {results[detail.inspection_result] || detail.inspection_result || '—'}{detail.restocked && ' · Restocked'}</p>
        {items.length > 0 && <DataTable label="Warehouse return items" headings={['Item', 'SKU ID', 'Returned quantity']}>
          {items.map(item => <tr key={item.id}><td>{item.item_name || item.external_item_id || '—'}</td><td>{item.sku_id ?? '—'}</td><td>{item.quantity_returned ?? '—'}</td></tr>)}
        </DataTable>}
        {pendingInspection(detail) && <form className={styles.form} onSubmit={submit}>
          <label className={styles.field}>Inspection result
            <select required value={result} onChange={event => setResult(event.target.value)} disabled={action.busy}>
              <option value="">Select a result</option>
              {Object.entries(results).map(([key, label]) => <option key={key} value={key} disabled={key === 'MATCHED' && !canRestock}>{label}</option>)}
            </select>
          </label>
          {!canRestock && <p className={styles.note}>Matched is unavailable until the returned items have unambiguous SKU mappings and quantities.</p>}
          <label className={styles.field}>Video evidence URL (optional)
            <input type="url" value={video} onChange={event => setVideo(event.target.value)} disabled={action.busy} />
          </label>
          <Button type="submit" disabled={action.busy || !result}>{action.busy ? 'Saving…' : result === 'MATCHED' ? 'Confirm and restock' : 'Save inspection'}</Button>
        </form>}
      </>}
      <Feedback value={action.feedback} />
    </DialogContent>
  </Dialog>
}
