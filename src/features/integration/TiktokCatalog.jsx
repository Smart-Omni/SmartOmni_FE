import { useState } from 'react'
import { tiktokApi } from '@/services/api/tiktok'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog'
import { DataTable, Feedback, OwnerPanel } from '@/features/portal/components/OwnerWorkspaceUI'
import { ConfirmationDialog } from './ConfirmationDialog'
import { useApiResource } from './useApiResource'
import { TiktokResourceState } from './ShopeeShared'
import { useApiAction } from './apiHelpers'
import styles from '@/features/portal/OwnerWorkspace.module.css'

export default function TiktokCatalog() {
  const resource = useApiResource(tiktokApi.catalog)
  const [selected, setSelected] = useState(null)
  const [importing, setImporting] = useState(false)
  const [notice, setNotice] = useState('')
  const rows = resource.data || []

  function finishImport(result) {
    setImporting(false)
    setNotice(`Import ${result.status}: ${result.importedCount} imported, ${result.linkedExistingCount} linked, ${result.skippedCount} skipped.`)
    resource.reload()
  }

  return <OwnerPanel title="TikTok catalog and SKU links">
    <div className={styles.actions}>
      <Button disabled={!resource.data} onClick={() => setImporting(true)}>Run auto-import</Button>
      <Button variant="outline" onClick={resource.reload}>Refresh catalog</Button>
    </div>
    {notice && <Feedback value={{ message: notice }} />}
    <TiktokResourceState resource={resource} />
    {resource.data && (rows.length ? <DataTable label="TikTok catalog" headings={['Product', 'TikTok SKU', 'SmartOmni SKU', 'Price', 'Stock', 'Actions']}>
      {rows.map(item => <tr key={`${item.tiktokProductId}:${item.tiktokSkuId}`}>
        <td>{item.productName || item.tiktokProductId}</td><td>{item.sellerSku || item.tiktokSkuId}</td>
        <td>{item.mapped ? item.localSkuCode || item.localSkuId : 'Unmapped'}</td>
        <td>{item.currentPrice == null ? '—' : `${item.currentPrice} ${item.currency || ''}`}</td>
        <td>{item.stock ?? '—'}</td>
        <td>{item.tiktokProductId && item.tiktokSkuId && <Button variant="outline" onClick={() => setSelected(item)}>Edit SKU price</Button>}</td>
      </tr>)}
    </DataTable> : <p>No TikTok SKUs found.</p>)}
    {importing && <ConfirmationDialog title="Run TikTok auto-import" description="Import new SKUs and link matching SKUs to SmartOmni."
      submit={tiktokApi.autoImport} close={() => setImporting(false)} done={finishImport} />}
    {selected && <PriceDialog item={selected} close={() => setSelected(null)} done={() => {
      setSelected(null)
      setNotice('TikTok SKU price updated.')
      resource.reload()
    }} />}
  </OwnerPanel>
}

function PriceDialog({ item, close, done }) {
  const action = useApiAction()
  const [price, setPrice] = useState('')

  function submit(event) {
    event.preventDefault()
    action.run(() => {
      const originalPrice = Number(price)
      if (originalPrice <= 0 || !Number.isInteger(originalPrice)) throw new Error('Enter a positive whole-number price in VND.')
      return tiktokApi.updatePrice({ productId: item.tiktokProductId, skuId: item.tiktokSkuId, originalPrice })
    }, 'Price updated.', done)
  }

  return <Dialog open onOpenChange={open => { if (!open && !action.busy) close() }}>
    <DialogContent className={styles.dialog} showCloseButton={!action.busy}>
      <DialogTitle>Edit TikTok SKU price</DialogTitle>
      <DialogDescription>{item.productName || item.tiktokProductId} · {item.sellerSku || item.tiktokSkuId} · {item.currency || 'Shop currency'}</DialogDescription>
      <form className={styles.form} onSubmit={submit}>
        <label className={styles.field}>New price (VND)<input type="number" min="1" step="1" required disabled={action.busy} value={price} onChange={event => setPrice(event.target.value)} /></label>
        <Feedback value={action.feedback} />
        <div className={styles.actions}>
          <Button type="button" variant="secondary" onClick={close} disabled={action.busy}>Back</Button>
          <Button type="submit" disabled={action.busy}>{action.busy ? 'Saving…' : 'Confirm price change'}</Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>
}
