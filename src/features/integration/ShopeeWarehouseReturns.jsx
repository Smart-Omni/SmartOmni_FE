import { useCallback, useState } from 'react'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog'
import { shopeeApi } from '@/services/api/shopee'
import { DataTable, Feedback } from '@/features/portal/components/OwnerWorkspaceUI'
import { useApiResource } from './useApiResource'
import { useApiAction } from './apiHelpers'
import { ResourceState } from './ShopeeShared'
import { INSPECTION_RESULTS, inspectionLabel, pendingInspection } from './warehouseReturns'
import styles from '@/features/portal/OwnerWorkspace.module.css'

export function InspectionDialog({ returnId, close, reload }) {
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
    if (!detail || !pendingInspection(detail) || !Object.hasOwn(INSPECTION_RESULTS, result) || (result === 'MATCHED' && !canRestock)) return
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
        <p>{detail.status} · {inspectionLabel(detail)}{detail.restocked && ' · Restocked'}</p>
        {items.length > 0 && <DataTable label="Warehouse return items" headings={['Item', 'SKU ID', 'Returned quantity']}>
          {items.map(item => <tr key={item.id}><td>{item.item_name || item.external_item_id || '—'}</td><td>{item.sku_id ?? '—'}</td><td>{item.quantity_returned ?? '—'}</td></tr>)}
        </DataTable>}
        {pendingInspection(detail) && <form className={styles.form} onSubmit={submit}>
          <label className={styles.field}>Inspection result
            <select required value={result} onChange={event => setResult(event.target.value)} disabled={action.busy}>
              <option value="">Select a result</option>
              {Object.entries(INSPECTION_RESULTS).map(([key, label]) => <option key={key} value={key} disabled={key === 'MATCHED' && !canRestock}>{label}</option>)}
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
