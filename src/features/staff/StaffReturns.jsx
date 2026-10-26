import { useEffect, useRef, useState } from 'react'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog'
import { ConfirmAction, DataTable, Feedback, OwnerPanel } from '@/features/portal/components/OwnerWorkspaceUI'
import { inspectReturn, receiveReturn, restockReturn } from './lib/supportStore'
import styles from '@/features/portal/OwnerWorkspace.module.css'
import support from './StaffSupport.module.css'

export default function StaffReturns({ data, session }) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('ALL')
  const [id, setId] = useState(null)
  const rows = data.returns.filter(item => `${item.id} ${item.orderId} ${item.customer}`.toLowerCase().includes(query.toLowerCase()) && (status === 'ALL' || item.status === status))
  const item = data.returns.find(row => row.id === id)
  const dialogRef = useRef(null)
  useEffect(() => { dialogRef.current?.scrollTo({ top: 0 }) }, [item?.id, item?.status, item?.inspection?.at])
  return <><OwnerPanel title="Return requests"><div className={styles.filters}><label className={styles.field}>Search returns<input type="search" placeholder="Return, order or customer" value={query} onChange={event => setQuery(event.target.value)} /></label><label className={styles.field}>Return status<select value={status} onChange={event => setStatus(event.target.value)}><option value="ALL">All statuses</option><option value="AWAITING_RECEIPT">Awaiting receipt</option><option value="RECEIVED">Received</option><option value="RESTOCKED">Restocked</option></select></label></div><DataTable label="Return requests" headings={['Return / order', 'Customer / marketplace', 'Goods', 'Status', 'Action']}>{rows.map(row => <tr key={row.id}><td>{row.id}<p>{row.orderId}</p></td><td>{row.customer}<p>{row.platform}</p></td><td>{row.sku} × {row.quantity}</td><td>{row.status.replaceAll('_', ' ')}</td><td><Button variant="outline" onClick={() => setId(row.id)}>Review return</Button></td></tr>)}</DataTable>{!rows.length && <p>No matching returns. Try another status or order ID.</p>}</OwnerPanel><OwnerPanel title="Quarantined stock"><p>Quarantined goods are excluded from sellable inventory and available stock.</p>{data.quarantine.length ? <DataTable label="Quarantined stock" headings={['Return', 'SKU', 'Warehouse', 'Quantity', 'Condition']}>{data.quarantine.map(row => <tr key={row.id}><td>{row.returnId}</td><td>{row.sku}</td><td>{row.warehouseId}</td><td>{row.quantity}</td><td>{row.condition}</td></tr>)}</DataTable> : <p>No returned goods have been quarantined yet.</p>}</OwnerPanel>{item && <Dialog open onOpenChange={open => { if (!open) setId(null) }}><DialogContent ref={dialogRef} className={styles.dialog}><DialogTitle>Process return · {item.id}</DialogTitle><DialogDescription>{item.customer} · {item.orderId} · {item.reason}</DialogDescription><ReturnProcess key={`${item.id}-${item.status}`} item={item} session={session} /></DialogContent></Dialog>}</>
}
function ReturnProcess({ item, session }) {
  const [reference, setReference] = useState('')
  const [condition, setCondition] = useState('UNOPENED')
  const [notes, setNotes] = useState('')
  const [video, setVideo] = useState(null)
  const [preview, setPreview] = useState('')
  const [destination, setDestination] = useState('QUARANTINE')
  const [confirmation, setConfirmation] = useState(false)
  const [feedback, setFeedback] = useState(null)
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])
  const canProcess = session.permissions.includes('returns:process')
  function act(action) { try { action(); setFeedback({ message: 'Return updated in this browser.' }) } catch (error) { setFeedback({ error: true, message: error.message }) } }
  const expected = JSON.stringify(item)
  return <div className={styles.page}><ol className={support.steps} aria-label="Return processing steps">{['Receive', 'Inspect', 'Restock'].map((step, index) => <li key={step} aria-current={index === (item.status === 'AWAITING_RECEIPT' ? 0 : !item.inspection ? 1 : 2) ? 'step' : undefined}>{index + 1}. {step}</li>)}</ol><dl className={styles.details}><div><dt>SKU / quantity</dt><dd>{item.sku} × {item.quantity}</dd></div><div><dt>Warehouse</dt><dd>{item.warehouseId}</dd></div><div><dt>Status</dt><dd>{item.status}</dd></div></dl>
    {item.status === 'AWAITING_RECEIPT' && canProcess && <form className={styles.form} onSubmit={event => { event.preventDefault(); act(() => receiveReturn(item.id, reference, expected)) }}><label className={styles.field}>Receipt reference<input required maxLength={150} value={reference} onChange={event => setReference(event.target.value)} placeholder="Warehouse receipt or parcel reference" /></label><Button type="submit">Record receipt of returned goods</Button></form>}
    {item.status === 'RECEIVED' && !item.inspection && canProcess && <form className={styles.form} onSubmit={event => { event.preventDefault(); act(() => inspectReturn(item.id, { condition, notes, video }, expected)) }}><label className={styles.field}>Returned goods condition<select value={condition} onChange={event => setCondition(event.target.value)}><option value="UNOPENED">Unopened and intact</option><option value="GOOD">Opened · good condition</option><option value="DAMAGED">Damaged · quarantine required</option></select></label><label className={styles.field}>Inspection notes<textarea required maxLength={1000} value={notes} onChange={event => setNotes(event.target.value)} /></label><label className={styles.field}>Inspection video<input type="file" required accept="video/mp4,video/webm,video/quicktime" onChange={event => { const file = event.target.files[0]; if (file && (!['video/mp4', 'video/webm', 'video/quicktime'].includes(file.type) || file.size > 20 * 1024 * 1024 || !file.size)) { setFeedback({ error: true, message: 'Choose an MP4, WebM or MOV video, up to 20 MB.' }); event.target.value = ''; setVideo(null); setPreview(''); return } setVideo(file || null); setPreview(file ? URL.createObjectURL(file) : ''); setFeedback(null) }} /></label>{video && preview && <video className={support.video} src={preview} controls aria-label="Inspection video preview" />}<p className={styles.note}>Preview stays on this device. Only the file name, type and size are saved in this demo; the video is not uploaded or retained after closing.</p><Button type="submit">Save inspection</Button></form>}
    {item.inspection && <section><h2>Inspection record</h2><p>{item.inspection.condition} · {item.inspection.notes}</p><p>Video selected: {item.inspection.video.name} · {Math.ceil(item.inspection.video.size / 1024)} KB · metadata only</p></section>}
    {item.status === 'RECEIVED' && item.inspection && canProcess && <><label className={styles.field}>Restock destination<select value={destination} onChange={event => setDestination(event.target.value)}><option value="QUARANTINE">Quarantined stock</option><option value="SELLABLE" disabled={item.inspection.condition === 'DAMAGED'}>Sellable stock</option></select></label><p>Sellable stock increases on-hand quantity. Quarantined stock stays separate. Each return can be restocked once.</p><Button disabled={!session.permissions.includes('inventory:receive')} onClick={() => setConfirmation(true)}>Review restock</Button></>}
    {item.status === 'RESTOCKED' && <p role="status">Completed · {item.quantity} unit(s) added to {item.destination.toLowerCase()} stock.</p>}
    {!canProcess && <p>Read-only access. Ask the Owner for permission to process returns.</p>}<Feedback value={feedback} />
    {item.history.length > 0 && <section><h2>Return history</h2><ol className={support.timeline}>{item.history.map((entry, index) => <li key={index}><strong>{entry.action}</strong><p>{entry.note}</p><span className={support.meta}>{entry.actor} · {new Date(entry.at).toLocaleString('en-GB')}</span></li>)}</ol></section>}
    {confirmation && <ConfirmAction title="Confirm returned stock" description={`${item.id}: ${item.quantity} × ${item.sku} → ${destination.toLowerCase()} at ${item.warehouseId}.`} confirmLabel="Confirm restock" onClose={() => setConfirmation(false)} onConfirm={() => restockReturn(item.id, destination, expected)} />}
  </div>
}
