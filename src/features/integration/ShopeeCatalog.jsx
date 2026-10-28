import { useEffect, useState } from 'react'
import { Button } from '@/shared/ui/button'
import { shopeeApi } from '@/services/api/shopee'
import { DataTable, Feedback, OwnerPanel, SummaryMetrics } from '@/features/portal/components/OwnerWorkspaceUI'
import { useApiResource } from './useApiResource'
import { ResourceState } from './ShopeeShared'
import { dateTime, useApiAction } from './apiHelpers'
import styles from '@/features/portal/OwnerWorkspace.module.css'

export default function ShopeeCatalog({ screen }) {
  const resource = useApiResource(shopeeApi.importRuns)
  const action = useApiAction()
  const [report, setReport] = useState(null)
  const runs = resource.data || []
  const running = runs.some(run => ['running', 'queued'].includes(run.status?.toLowerCase()))
  useEffect(() => {
    if (!running && !action.busy) return
    const timer = setInterval(resource.reload, 5000)
    return () => clearInterval(timer)
  }, [running, action.busy, resource.reload])
  return <><OwnerPanel title={screen === 'prices' ? 'Shopee price synchronization' : 'Import products from Shopee'}>
    <p>{screen === 'prices' ? 'Compare Shopee prices with linked SKUs. Changes over 50% are flagged by the backend.' : 'Import your authorized Shopee catalog, variants and SKU links into SmartOmni.'}</p>
    <div className={styles.actions}><Button disabled={action.busy || running} onClick={() => action.run(shopeeApi.importProducts, result => `Import ${result.status}: ${result.productsCreated} created, ${result.productsUpdated} updated, ${result.productsFailed} failed.`, result => { setReport(result); resource.reload() })}>{action.busy ? 'Working…' : 'Import Shopee products'}</Button><Button variant="outline" disabled={action.busy} onClick={() => action.run(shopeeApi.syncWarehouses, result => `${result.warehouses} warehouses synchronized.`)}>Sync warehouses</Button><Button variant="outline" disabled={action.busy} onClick={() => action.run(async () => {
      const result = await shopeeApi.syncPrices()
      if (result.fetchError) throw new Error(`Price fetch failed: ${result.fetchError}`)
      return result
    }, result => `${result.considered} prices compared · ${result.applied} applied · ${result.heldAnomaly} anomalies flagged · ${result.unchanged} unchanged · ${result.rejected} rejected · ${result.missing} missing.`)}>Sync prices</Button><Button variant="outline" onClick={resource.reload}>Refresh import history</Button></div>
    <Feedback value={action.feedback} />{action.busy && <p role="status">The backend is processing this request. Import history refreshes while it runs.</p>}
  </OwnerPanel><OwnerPanel title="Product import results"><ResourceState resource={resource} />{!resource.loading && !resource.error && (runs.length ? <DataTable label="Import run history" headings={['Run / started', 'Status', 'Products', 'SKU links', 'Action']}>{runs.map(run => <tr key={run.id}><td>#{run.id}<p>{dateTime(run.startedAt)}</p></td><td>{run.status}<p>{run.errorMessage}</p></td><td>{run.productsSeen} seen · {run.productsCreated} created · {run.productsUpdated} updated<p>{run.productsSkipped} skipped · {run.productsFailed} failed</p></td><td>{run.skusCreated} created · {run.skusLinked} linked · {run.skusUnmatched} unmatched<p>{run.skusConflicted} conflicts</p></td><td><Button variant="outline" onClick={() => setReport(run)}>View import details</Button></td></tr>)}</DataTable> : <p>No product imports yet.</p>)}</OwnerPanel>
    {report && <OwnerPanel title={`Import #${report.id}`}><p>{report.status} · {dateTime(report.startedAt)} → {dateTime(report.finishedAt)}</p><SummaryMetrics items={[["Products seen", report.productsSeen], ['Created', report.productsCreated], ['Updated', report.productsUpdated], ['SKU links', report.skusLinked]]} />{report.skuLimitReached && <p role="alert">Your plan SKU limit was reached. Some products were skipped.</p>}{report.errorMessage && <p role="alert" className={styles.error}>{report.errorMessage}</p>}{report.items?.length ? <DataTable label="Import item results" headings={['Item / SKU', 'Result', 'Details']}>{report.items.map((item, index) => <tr key={index}><td>{item.externalProductId} / {item.externalSkuId || '—'}</td><td>{item.outcome}</td><td>{item.message || '—'}</td></tr>)}</DataTable> : <p>No item errors reported.</p>}{report.itemsOmitted > 0 && <p>{report.itemsOmitted} additional item results omitted by the backend.</p>}</OwnerPanel>}
  </>
}
