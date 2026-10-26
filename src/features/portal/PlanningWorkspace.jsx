import { useState } from 'react'
import { Button } from '@/shared/ui/button'
import { forecastRows, removeSalesEvent, saveSalesEvent } from './lib/ownerWorkspaceStore'
import { ConfirmAction, DataTable, Feedback, OwnerPanel } from './components/OwnerWorkspaceUI'
import styles from './OwnerWorkspace.module.css'

const emptyEvent = { name: '', start: '2026-10-24', end: '2026-10-30', uplift: '20' }
export default function PlanningWorkspace({ screen, state, canWrite = true }) {
  const [draft, setDraft] = useState(emptyEvent)
  const [feedback, setFeedback] = useState(null)
  const [remove, setRemove] = useState(null)
  const rows = forecastRows(state)
  function change(event) { setDraft({ ...draft, [event.target.name]: event.target.value }); setFeedback(null) }
  function save(event) {
    event.preventDefault()
    try { saveSalesEvent(draft); setDraft(emptyEvent); setFeedback({ message: 'Sales event saved. The local forecast scenario has been recalculated.' }) } catch (error) { setFeedback({ error: true, message: error.message }) }
  }
  return <>
    {screen === 'sales-events' ? <><OwnerPanel title="Enter a sales event"><p>The expected uplift is your scenario assumption. It is not a model prediction or a promised increase in demand.</p>{canWrite ? <form className={styles.form} onSubmit={save}><label className={styles.field}>Event name<input required maxLength={100} name="name" value={draft.name} onChange={change} /></label><div className={styles.grid}><label className={styles.field}>Start date<input type="date" required name="start" value={draft.start} onChange={change} /></label><label className={styles.field}>End date<input type="date" required name="end" min={draft.start} value={draft.end} onChange={change} /></label></div><label className={styles.field}>Expected demand uplift (%)<input type="number" min="0" max="500" step="1" required name="uplift" value={draft.uplift} onChange={change} /></label><div className={styles.actions}><Button type="submit">Save sales event</Button></div><Feedback value={feedback} /></form> : <p>Read-only access. Ask the Owner for permission to enter sales events.</p>}</OwnerPanel><OwnerPanel title="Saved sales events">{state.salesEvents.length ? <DataTable label="Saved sales events" headings={['Event', 'Dates', 'Assumed uplift', 'Action']}>{state.salesEvents.map(item => <tr key={item.id}><td>{item.name}</td><td>{item.start} – {item.end}</td><td>{item.uplift}%</td><td>{canWrite ? <Button variant="outline" className={styles.danger} onClick={() => setRemove(item)}>Remove event</Button> : 'Read only'}</td></tr>)}</DataTable> : <p>No sales events recorded yet.</p>}</OwnerPanel></>
      : <><OwnerPanel title="Demand forecast · 24–30 Oct 2026"><p>Illustrative seven-day moving average using sample units sold on 17–23 Oct. On event dates the highest saved uplift applies; overlapping events are not added together. Results are rounded up to whole units. No forecasting model is connected.</p><DataTable label="Demand forecasts" headings={['SKU / product', 'Baseline (units / 7 days)', 'Scenario forecast (units / 7 days)', 'Available units', 'Projected shortfall (units)']}>{rows.map(item => <tr key={item.sku}><td>{item.sku}<p>{item.name}</p></td><td>{item.baseline}</td><td>{item.forecast}</td><td>{item.available}</td><td>{item.shortfall}</td></tr>)}</DataTable></OwnerPanel><OwnerPanel title="Forecast comparison"><p className={styles.note}>Bars show scenario demand in units for 24–30 Oct 2026. Source: sample SKU history and locally saved sales events.</p>{rows.map(item => <div key={item.sku} className={styles.barRow}><span>{item.sku}</span><div className={styles.barTrack}><span style={{ width: `${item.forecast / Math.max(...rows.map(row => row.forecast), 1) * 100}%` }} /></div><span>{item.forecast} u.</span></div>)}</OwnerPanel></>}
    {remove && <ConfirmAction title="Remove sales event?" description={`${remove.name} will be removed from the local forecast scenario.`} danger confirmLabel="Remove event" onClose={() => setRemove(null)} onConfirm={() => removeSalesEvent(remove.id)} />}
  </>
}
