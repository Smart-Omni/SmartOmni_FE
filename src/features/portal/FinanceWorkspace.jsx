import { useState } from 'react'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog'
import { costCategories } from './data/ownerWorkspace'
import { money, weeklySales } from './data/ownerDashboard'
import { deleteBusinessCost, saveBusinessCost } from './lib/ownerWorkspaceStore'
import { ConfirmAction, DataTable, Feedback, OwnerPanel, SummaryMetrics } from './components/OwnerWorkspaceUI'
import styles from './OwnerWorkspace.module.css'

const emptyCost = { date: '2026-10-23', category: 'Other', amount: '', description: '' }
export default function FinanceWorkspace({ screen, state, canWrite = true }) {
  const [draft, setDraft] = useState(emptyCost)
  const [feedback, setFeedback] = useState(null)
  const [edit, setEdit] = useState(null)
  const [remove, setRemove] = useState(null)
  const [start, setStart] = useState('2026-10-17')
  const [end, setEnd] = useState('2026-10-23')
  const costs = state.costs.filter(item => item.date >= start && item.date <= end)
  const costsTotal = costs.reduce((sum, item) => sum + item.amount, 0)
  const sales = weeklySales.reduce((sum, amount, index) => { const date = `2026-10-${17 + index}`; return sum + (date >= start && date <= end ? amount : 0) }, 0)
  function save(event) { event.preventDefault(); try { saveBusinessCost(draft); setDraft(emptyCost); setFeedback({ message: 'Business cost saved in this browser.' }) } catch (error) { setFeedback({ error: true, message: error.message }) } }
  return <>
    {screen === 'costs' && canWrite && <OwnerPanel title="Enter business costs"><form className={styles.form} onSubmit={save}><CostFields value={draft} onChange={setDraft} /><div className={styles.actions}><Button type="submit">Save business cost</Button></div><Feedback value={feedback} /></form></OwnerPanel>}
    <OwnerPanel title="Reporting dates"><div className={styles.filters}><label className={styles.field}>From date<input type="date" value={start} max={end} onChange={event => setStart(event.target.value)} /></label><label className={styles.field}>To date<input type="date" value={end} min={start} onChange={event => setEnd(event.target.value)} /></label></div><p className={styles.note}>Sales are available only for the sample period 17–23 Oct 2026. Compare costs with the same dates. VND, whole amounts.</p>{(!start || !end || start > end) && <p role="alert" className={styles.error}>Choose a valid reporting date range.</p>}</OwnerPanel>
    {screen === 'profit' && <><SummaryMetrics items={[["Sample sales", money(sales)], ['Recorded costs', money(costsTotal)], ['Demo profit estimate', money(sales - costsTotal)]]} /><OwnerPanel title="Profit calculation"><p>Sample sales minus recorded costs for the selected dates. This estimate does not verify revenue recognition, returns, tax or missing costs; it is not actual audited profit. Costs already recorded include the sample product costs, marketplace fees and advertising.</p>{start < '2026-10-17' || end > '2026-10-23' ? <p className={styles.error}>Part of this range has no sample sales coverage. The estimate is incomplete.</p> : null}<DataTable label="Costs by category" headings={['Cost category', 'Amount']}>{costCategories.filter(category => costs.some(item => item.category === category)).map(category => <tr key={category}><td>{category}</td><td>{money(costs.filter(item => item.category === category).reduce((sum, item) => sum + item.amount, 0))}</td></tr>)}</DataTable></OwnerPanel></>}
    {screen === 'costs' && <OwnerPanel title="Cost ledger">{costs.length ? <DataTable label="Business cost ledger" headings={['Date', 'Category', 'Description', 'Amount', 'Actions']}>{costs.map(item => <tr key={item.id}><td>{item.date}</td><td>{item.category}</td><td>{item.description}</td><td>{money(item.amount)}</td><td><div className={styles.actions}><Button variant="outline" disabled={!canWrite} onClick={() => setEdit(item)}>Edit cost</Button><Button variant="outline" disabled={!canWrite} className={styles.danger} onClick={() => setRemove(item)}>Delete cost</Button></div></td></tr>)}</DataTable> : <p>No costs in this date range.</p>}<p className={styles.note}>Initial ledger entries are illustrative fixtures. Your additional entries are saved locally.</p></OwnerPanel>}
    {remove && <ConfirmAction title="Delete business cost?" description={`${remove.description} · ${money(remove.amount)} will be removed from the local cost ledger.`} danger confirmLabel="Delete cost" onClose={() => setRemove(null)} onConfirm={() => deleteBusinessCost(remove.id, JSON.stringify(remove))} />}
    <Dialog open={Boolean(edit)} onOpenChange={open => { if (!open) setEdit(null) }}><DialogContent className={styles.dialog}><DialogTitle>Edit business cost</DialogTitle><DialogDescription>Update the date, category, description or VND amount.</DialogDescription>{edit && <EditCost key={edit.id} initial={edit} close={() => setEdit(null)} />}</DialogContent></Dialog>
  </>
}
function CostFields({ value, onChange }) {
  const change = event => onChange({ ...value, [event.target.name]: event.target.value })
  return <><label className={styles.field}>Cost date<input type="date" required name="date" value={value.date} onChange={change} /></label><label className={styles.field}>Cost category<select name="category" value={value.category} onChange={change}>{costCategories.map(category => <option key={category}>{category}</option>)}</select></label><label className={styles.field}>Amount (VND)<input type="number" required name="amount" min="1" max={Number.MAX_SAFE_INTEGER} step="1" value={value.amount} onChange={change} /></label><label className={styles.field}>Cost description<textarea required name="description" maxLength={500} value={value.description} onChange={change} /></label></>
}
function EditCost({ initial, close }) {
  const [draft, setDraft] = useState(initial)
  const [feedback, setFeedback] = useState(null)
  return <form className={styles.form} onSubmit={event => { event.preventDefault(); try { saveBusinessCost(draft, JSON.stringify(initial)); close() } catch (error) { setFeedback({ error: true, message: error.message }) } }}><CostFields value={draft} onChange={setDraft} /><Feedback value={feedback} /><div className={styles.actions}><Button variant="secondary" type="button" onClick={close}>Cancel</Button><Button type="submit">Save cost changes</Button></div></form>
}
