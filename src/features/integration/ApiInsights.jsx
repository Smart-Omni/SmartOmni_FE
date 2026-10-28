import { useCallback, useState } from 'react'
import { Button } from '@/shared/ui/button'
import { aiApi, requireId } from '@/services/api/operations'
import { DataTable, Feedback, OwnerPanel } from '@/features/portal/components/OwnerWorkspaceUI'
import { useApiResource } from './useApiResource'
import { ResourceState } from './ShopeeShared'
import { useApiAction } from './apiHelpers'
import styles from '@/features/portal/OwnerWorkspace.module.css'

export default function ApiInsights() {
  const [skuId, setSkuId] = useState('')
  const [selected, setSelected] = useState(null)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const action = useApiAction()
  return <><OwnerPanel title="Demand forecasts & product recommendations"><p>Look up results for a SKU in this workspace. Forecast generation and uncached recommendations require the AI service to be available.</p><form className={styles.form} onSubmit={event => { event.preventDefault(); try { setSelected(requireId(skuId, 'SKU ID')); setRevision(revision + 1); setError('') } catch (failure) { setError(failure.message) } }}><label className={styles.field}>SKU ID<input required inputMode="numeric" value={skuId} onChange={event => setSkuId(event.target.value)} /></label>{error && <p role="alert" className={styles.error}>{error}</p>}<div className={styles.actions}><Button type="submit">View insights</Button><Button type="button" variant="outline" disabled={action.busy} onClick={() => action.run(aiApi.runForecast, 'Forecast request completed. Refresh the selected SKU to view any available results.', () => setRevision(revision + 1))}>{action.busy ? 'Requesting forecast…' : 'Run demand forecast'}</Button></div></form><Feedback value={action.feedback} /></OwnerPanel>{selected && <><Forecasts key={`forecast:${selected}:${revision}`} skuId={selected} /><Recommendations key={`recommendations:${selected}:${revision}`} skuId={selected} /></>}</>
}

function Forecasts({ skuId }) {
  const loader = useCallback(signal => aiApi.forecast(skuId, signal), [skuId])
  const resource = useApiResource(loader)
  return <OwnerPanel title={`Forecasts · SKU ${skuId}`}><ResourceState resource={resource} />{Array.isArray(resource.data) && (resource.data.length ? <DataTable label="SKU demand forecasts" headings={['Date', 'Predicted quantity', 'Recommended reorder quantity', 'Model version']}>{resource.data.map((row, index) => <tr key={row.id || index}><td>{row.forecastDate || '—'}</td><td>{row.predictedQuantity ?? '—'}</td><td>{row.recommendedReorderQty ?? '—'}</td><td>{row.modelVersionId ?? '—'}</td></tr>)}</DataTable> : <p>No forecasts are available for this SKU.</p>)}</OwnerPanel>
}

function Recommendations({ skuId }) {
  const loader = useCallback(signal => aiApi.recommendations(skuId, signal), [skuId])
  const resource = useApiResource(loader)
  return <OwnerPanel title={`Related SKUs · ${skuId}`}><ResourceState resource={resource} />{Array.isArray(resource.data) && (resource.data.length ? <DataTable label="SKU recommendations" headings={['Recommended SKU ID', 'Similarity score']}>{resource.data.map((row, index) => <tr key={row.id || index}><td>{row.recommendedSkuId ?? '—'}</td><td>{row.similarityScore ?? '—'}</td></tr>)}</DataTable> : <p>No recommendations are available for this SKU.</p>)}</OwnerPanel>
}
