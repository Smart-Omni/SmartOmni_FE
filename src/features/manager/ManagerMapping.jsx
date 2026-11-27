import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog'
import { DataTable, Feedback, OwnerPanel } from '@/features/portal/components/OwnerWorkspaceUI'
import { marketplaceListings, warehouses } from './data/managerFixtures'
import { mappingIssue, saveSkuMapping } from './lib/managerStore'
import styles from '@/features/portal/OwnerWorkspace.module.css'

export default function ManagerMapping({ data, session }) {
  const [params] = useSearchParams()
  const [query, setQuery] = useState(params.get('listing') || '')
  const [edit, setEdit] = useState(null)
  const rows = marketplaceListings.filter(item => `${item.id} ${item.title} ${item.expectedSku} ${item.externalId}`.toLowerCase().includes(query.trim().toLowerCase()))
  return <><OwnerPanel title="SKU & warehouse mapping"><p>Map one marketplace variant to one internal SKU and warehouse. The sample scenario supplies an expected SKU for validation; real mapping requires product/variant verification.</p><label className={styles.field}>Search SKU mapping<input type="search" value={query} onChange={event => setQuery(event.target.value)} /></label><DataTable label="SKU mapping" headings={['Marketplace variant', 'Internal SKU', 'Warehouse', 'Validation', 'Actions']}>{rows.map(listing => {
    const mapping = data.mappings.find(item => item.listingId === listing.id)
    const issue = mappingIssue(data, listing.id)
    return <tr key={listing.id}><td>{listing.title}<p>{listing.platform} · {listing.externalId}</p></td><td>{mapping?.sku || 'Unmapped'}</td><td>{mapping?.warehouseId || 'Unmapped'}</td><td>{issue ? <>{issue.code}<p>{issue.message}</p></> : 'Verified demo mapping'}</td><td><Button variant="outline" disabled={!session.permissions.includes('mapping:write')} onClick={() => setEdit({ listing, mapping: mapping || null })}>{mapping ? 'Correct mapping' : 'Map SKU'}</Button></td></tr>
  })}</DataTable>{!rows.length && <p>No mappings match this search.</p>}<p>Saving a correction does not hide previous sync failures. Retry the failed job to verify the new SKU/warehouse mapping.</p></OwnerPanel><Dialog open={Boolean(edit)} onOpenChange={open => { if (!open) setEdit(null) }}><DialogContent className={styles.dialog}><DialogTitle>{edit?.mapping ? 'Correct SKU & warehouse mapping' : 'Map SKU to marketplace product'}</DialogTitle><DialogDescription>{edit?.listing.title} · {edit?.listing.externalId}. Review the variant before confirming.</DialogDescription>{edit && <MappingForm key={edit.listing.id} {...edit} data={data} close={() => setEdit(null)} />}</DialogContent></Dialog></>
}
function MappingForm({ listing, mapping, data, close }) {
  const [sku, setSku] = useState(mapping?.sku || '')
  const [warehouseId, setWarehouseId] = useState(warehouses.some(item => item.id === mapping?.warehouseId) ? mapping.warehouseId : '')
  const [reason, setReason] = useState('')
  const [feedback, setFeedback] = useState(null)
  return <form className={styles.form} onSubmit={event => { event.preventDefault(); try { saveSkuMapping(listing.id, sku, warehouseId, reason, JSON.stringify(mapping)); close() } catch (error) { setFeedback({ error: true, message: error.message }) } }}><p>Expected SKU in this sample scenario: {listing.expectedSku}</p><label className={styles.field}>Internal SKU<select required value={sku} onChange={event => setSku(event.target.value)}><option value="">Select an internal SKU</option>{data.products.map(item => <option key={item.id} value={item.sku}>{item.sku} · {item.name}</option>)}</select></label><label className={styles.field}>Mapped warehouse<select required value={warehouseId} onChange={event => setWarehouseId(event.target.value)}><option value="">Select a warehouse</option>{warehouses.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className={styles.field}>Mapping correction reason<textarea required maxLength={500} value={reason} onChange={event => setReason(event.target.value)} /></label><Feedback value={feedback} /><div className={styles.actions}><Button variant="secondary" type="button" onClick={close}>Cancel</Button><Button type="submit">Save SKU mapping</Button></div></form>
}
