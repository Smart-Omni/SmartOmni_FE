import { useState } from 'react'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog'
import { DataTable, Feedback, OwnerPanel } from '@/features/portal/components/OwnerWorkspaceUI'
import { warehouses } from './data/managerFixtures'
import { availableStock, changeInventory, queueInventorySync } from './lib/managerStore'
import styles from '@/features/portal/OwnerWorkspace.module.css'

export default function ManagerInventory({ data, session }) {
  const [query, setQuery] = useState('')
  const [warehouse, setWarehouse] = useState('ALL')
  const [form, setForm] = useState(null)
  const [feedback, setFeedback] = useState(null)
  const rows = data.inventory.filter(row => (warehouse === 'ALL' || row.warehouseId === warehouse) && `${row.sku} ${data.products.find(product => product.sku === row.sku)?.name}`.toLowerCase().includes(query.trim().toLowerCase()))
  return <>
    <OwnerPanel title="Warehouse inventory"><div className={styles.filters}><label className={styles.field}>Search inventory<input type="search" value={query} onChange={event => setQuery(event.target.value)} /></label><label className={styles.field}>Inventory warehouse<select value={warehouse} onChange={event => setWarehouse(event.target.value)}><option value="ALL">All warehouses</option>{warehouses.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div><p>Available = on hand − reserved. Adjustments cannot reduce on-hand below reserved stock. Incoming receipts add stock once per confirmed operation.</p><DataTable label="Warehouse inventory" headings={['SKU / product', 'Warehouse', 'On hand', 'Reserved', 'Available', 'Actions']}>{rows.map(row => <tr key={row.id}><td>{row.sku}<p>{data.products.find(product => product.sku === row.sku)?.name}</p></td><td>{row.warehouseId}</td><td>{row.onHand}</td><td>{row.reserved}</td><td>{availableStock(row)}</td><td><div className={styles.actions}><Button variant="outline" disabled={!session.permissions.includes('inventory:adjust')} onClick={() => setForm({ row, receive: false })}>Adjust stock</Button><Button variant="outline" disabled={!session.permissions.includes('inventory:receive')} onClick={() => setForm({ row, receive: true })}>Record incoming stock</Button><Button variant="outline" disabled={!session.permissions.includes('inventory:sync')} onClick={() => { try { queueInventorySync(row.id); setFeedback({ message: 'Sync queued where a new attempt is needed. Existing failed jobs remain in Inventory sync for retry.' }) } catch (error) { setFeedback({ error: true, message: error.message }) } }}>Queue inventory sync</Button></div></td></tr>)}</DataTable>{!rows.length && <p>No inventory matches these filters.</p>}<Feedback value={feedback} /></OwnerPanel>
    <OwnerPanel title="Stock movement history">{data.stockLedger.length ? <DataTable label="Stock movement history" headings={['Time', 'SKU / warehouse', 'Movement', 'Before → after', 'Reference']}>{data.stockLedger.map(item => <tr key={item.id}><td>{new Date(item.at).toLocaleString('en-GB')}</td><td>{item.sku}<p>{item.warehouseId}</p></td><td>{item.kind} · {item.delta > 0 ? '+' : ''}{item.delta}</td><td>{item.before} → {item.after}</td><td>{item.reason}</td></tr>)}</DataTable> : <p>No local stock adjustments or receipts yet.</p>}</OwnerPanel>
    <Dialog open={Boolean(form)} onOpenChange={open => { if (!open) setForm(null) }}><DialogContent className={styles.dialog}><DialogTitle>{form?.receive ? 'Record incoming stock' : 'Adjust inventory'}</DialogTitle><DialogDescription>{form?.row.sku} · {form?.row.warehouseId}. Changes apply only to the local demo and queue related inventory sync.</DialogDescription>{form && <StockForm key={`${form.row.id}-${form.receive}`} {...form} close={() => setForm(null)} />}</DialogContent></Dialog>
  </>
}
function StockForm({ row, receive, close }) {
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')
  const [requestId] = useState(() => crypto.randomUUID())
  const [feedback, setFeedback] = useState(null)
  return <form className={styles.form} onSubmit={event => { event.preventDefault(); try { changeInventory(row.id, quantity, reason, receive, JSON.stringify(row), requestId); close() } catch (error) { setFeedback({ error: true, message: error.message }) } }}><p>On hand: {row.onHand} · Reserved: {row.reserved} · Available: {availableStock(row)}</p><label className={styles.field}>{receive ? 'Incoming quantity' : 'Quantity adjustment (+ / −)'}<input type="number" required step="1" min={receive ? 1 : undefined} value={quantity} onChange={event => setQuantity(event.target.value)} /></label><label className={styles.field}>{receive ? 'Receipt reference' : 'Adjustment reason'}<textarea required maxLength={500} value={reason} onChange={event => setReason(event.target.value)} /></label><Feedback value={feedback} /><div className={styles.actions}><Button variant="secondary" type="button" onClick={close}>Cancel</Button><Button type="submit">{receive ? 'Confirm stock receipt' : 'Confirm stock adjustment'}</Button></div></form>
}
