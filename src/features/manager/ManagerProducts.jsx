import { useState } from 'react'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog'
import { ConfirmAction, DataTable, Feedback, OwnerPanel } from '@/features/portal/components/OwnerWorkspaceUI'
import { importCandidates } from './data/managerFixtures'
import { advanceProductImport, queueProductImport, managerShopConnected, updateInternalProduct } from './lib/managerStore'
import styles from '@/features/portal/OwnerWorkspace.module.css'

export default function ManagerProducts({ screen, data, session }) {
  const [query, setQuery] = useState('')
  const [edit, setEdit] = useState(null)
  const [marketplace, setMarketplace] = useState('shopee')
  const [selected, setSelected] = useState([])
  const [preview, setPreview] = useState(false)
  const [jobId, setJobId] = useState(null)
  const [feedback, setFeedback] = useState(null)
  const canEdit = session.permissions.includes('products:edit')
  const canImport = session.permissions.includes('products:import')
  const products = data.products.filter(item => `${item.sku} ${item.name} ${item.category}`.toLowerCase().includes(query.trim().toLowerCase()))
  const job = data.importJobs.find(item => item.id === jobId) || data.importJobs[0]
  function run(id) { try { advanceProductImport(id); setFeedback({ message: 'Demo import progressed. Review the job status and per-product results below.' }) } catch (error) { setFeedback({ error: true, message: error.message }) } }
  return <>
    {screen === 'products' ? <OwnerPanel title="Internal product catalog"><label className={styles.field}>Search internal products<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="SKU, name or category" /></label>{products.length ? <DataTable label="Internal products" headings={['SKU', 'Internal name', 'Category', 'Notes', 'Actions']}>{products.map(product => <tr key={product.id}><td>{product.sku}</td><td>{product.name}</td><td>{product.category}</td><td>{product.notes || '—'}</td><td><Button variant="outline" disabled={!canEdit} onClick={() => setEdit(product)}>Edit internal details</Button></td></tr>)}</DataTable> : <p>No internal products match your search.</p>}<p>Internal edits do not change marketplace listing names, prices or promotions. SKU identity is maintained through the mapping screen.</p></OwnerPanel>
      : <><OwnerPanel title="Import products from marketplace"><p>Choose source rows and preview the import. The demo job pauses at QUEUED and RUNNING so you can inspect each stage. Duplicate SKUs are skipped; missing seller SKUs fail.</p><form className={styles.form} onSubmit={event => { event.preventDefault(); setPreview(true) }}><label className={styles.field}>Import marketplace<select value={marketplace} onChange={event => { setMarketplace(event.target.value); setSelected([]) }}><option value="shopee">Shopee</option><option value="tiktok">TikTok Shop</option></select></label><p>{managerShopConnected(marketplace) ? 'Sample shop connection is available.' : 'Shop authorization is unavailable. Ask the Owner to reauthorize it.'}</p><fieldset><legend>Marketplace products</legend>{importCandidates.filter(item => item.platform === marketplace).map(item => <label className={styles.field} key={item.id}><input type="checkbox" checked={selected.includes(item.id)} onChange={event => setSelected(event.target.checked ? [...selected, item.id] : selected.filter(id => id !== item.id))} />{item.name} · {item.sku || 'Missing SKU'}</label>)}</fieldset><div className={styles.actions}><Button type="submit" disabled={!canImport || !selected.length || !managerShopConnected(marketplace)}>Preview product import</Button></div></form></OwnerPanel><OwnerPanel title="Product import results"><label className={styles.field}>Import job<select value={job?.id || ''} onChange={event => setJobId(event.target.value)}>{data.importJobs.map(item => <option key={item.id} value={item.id}>{item.platform} · {item.status} · {new Date(item.at).toLocaleString('en-GB')}</option>)}</select></label>{job && <><p>Job {job.id} · <strong>{job.status}</strong></p>{['QUEUED', 'RUNNING'].includes(job.status) && <div className={styles.actions}><Button disabled={!canImport} onClick={() => run(job.id)}>{job.status === 'QUEUED' ? 'Start demo import' : 'Complete demo import'}</Button></div>}{job.results.length ? <DataTable label="Import result rows" headings={['Product', 'SKU', 'Result', 'Details']}>{job.results.map((item, index) => <tr key={index}><td>{item.name}</td><td>{item.sku || '—'}</td><td>{item.status}</td><td>{item.message}</td></tr>)}</DataTable> : <p>No per-product results yet. Complete the demo job to generate them.</p>}</>}<Feedback value={feedback} /></OwnerPanel></>}
    {preview && <ConfirmAction title="Confirm marketplace import" description={`${selected.length} selected source rows from ${marketplace}. A local job will be created; no marketplace API will be called.`} confirmLabel="Queue demo import" onClose={() => setPreview(false)} onConfirm={() => { const id = queueProductImport(marketplace, selected); setJobId(id); setSelected([]); setFeedback({ message: 'Demo import queued.' }) }} />}
    <Dialog open={Boolean(edit)} onOpenChange={open => { if (!open) setEdit(null) }}><DialogContent className={styles.dialog}><DialogTitle>Edit internal product details</DialogTitle><DialogDescription>Update internal fields only. Marketplace data and SKU identity remain separate.</DialogDescription>{edit && <ProductEditor key={edit.id} product={edit} close={() => setEdit(null)} />}</DialogContent></Dialog>
  </>
}
function ProductEditor({ product, close }) {
  const [draft, setDraft] = useState(product)
  const [feedback, setFeedback] = useState(null)
  const change = event => setDraft({ ...draft, [event.target.name]: event.target.value })
  return <form className={styles.form} onSubmit={event => { event.preventDefault(); try { updateInternalProduct(product.id, draft, JSON.stringify(product)); close() } catch (error) { setFeedback({ error: true, message: error.message }) } }}><p className={styles.note}>SKU: {product.sku}</p><label className={styles.field}>Internal product name<input required name="name" maxLength={120} value={draft.name} onChange={change} /></label><label className={styles.field}>Internal category<input required name="category" maxLength={60} value={draft.category} onChange={change} /></label><label className={styles.field}>Internal notes<textarea name="notes" maxLength={1000} value={draft.notes} onChange={change} /></label><Feedback value={feedback} /><div className={styles.actions}><Button type="button" variant="secondary" onClick={close}>Cancel</Button><Button type="submit">Save internal details</Button></div></form>
}
