import { useState } from 'react'
import PlanFeatureEditor from './PlanFeatureEditor'
import { planFeatures } from './data/platformFeatures'
import { Link } from 'react-router-dom'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/shared/ui/dialog'
import { usePlatform } from './hooks/usePlatform'
import { updatePlan, usageIssues } from './lib/platformStore'
import { PageHeading } from './components/PlatformUI'
import portal from '@/features/portal/PortalPage.module.css'
import styles from './Platform.module.css'

export default function PlanManagement() {
  const { plans, tenants } = usePlatform()
  const [editing, setEditing] = useState(null)
  const [featurePlan, setFeaturePlan] = useState(null)
  const [draft, setDraft] = useState(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const affected = tenants.filter(tenant => tenant.plan === editing)
  const exceeded = draft ? affected.filter(tenant => usageIssues(tenant, draft).length) : []
  function edit(plan) { setEditing(plan.id); setDraft({ ...plan }); setReason(''); setError('') }
  function submit(event) {
    event.preventDefault()
    try { updatePlan(editing, draft, reason); setNotice(`${editing} plan updated for ${affected.length} demo tenants. The change is recorded in the action log.`); setEditing(null) } catch (failure) { setError(failure.message) }
  }
  return <><PageHeading title="Plans & limits" description="Manage the Free and Pro definitions used by your demo workspaces." /><div className={styles.banner}><strong>Illustrative plan definitions</strong><p>Free allows one shop connection. Other quotas are sample values for this prototype. No pricing, payments or subscription charges are applied.</p></div><p className={styles.notice} role="status">{notice}</p>
    <div className={styles.planCards}>{plans.map(plan => <section key={plan.id} className={portal.panel}><div className={portal.panelHeading}><h2>{plan.id}</h2><span className={portal.neutral}>{tenants.filter(tenant => tenant.plan === plan.id).length} tenants</span></div><p className={styles.planDescription}>{plan.description}</p><dl className={styles.planLimits}><dt>SKU limit</dt><dd>{plan.skuLimit.toLocaleString()}</dd><dt>Shop connections</dt><dd>{plan.shopLimit}</dd><dt>Managers</dt><dd>{plan.managerLimit}</dd></dl><ul className={styles.planFeatureSummary}>{planFeatures.map(feature => <li key={feature.id}><span>{feature.label}</span><span>{plan.features[feature.id] ? 'Included' : 'Not included'}</span></li>)}</ul><div className={styles.planFooter}><Button variant="outline" className={portal.outline} onClick={() => edit(plan)}>Edit {plan.id} plan</Button><Button variant="outline" className={portal.outline} onClick={() => setFeaturePlan(plan.id)}>Configure {plan.id} features</Button><Link className={styles.viewAll} to={`/admin/tenants?plan=${plan.id}`}>View tenants</Link></div></section>)}</div>
    {featurePlan && <PlanFeatureEditor key={featurePlan} plan={plans.find(plan => plan.id === featurePlan)} tenantCount={tenants.filter(tenant => tenant.plan === featurePlan).length} onClose={() => setFeaturePlan(null)} onSaved={setNotice} />}
    <Dialog open={Boolean(editing)} onOpenChange={open => { if (!open) setEditing(null) }}><DialogContent className={styles.modal} onInteractOutside={event => event.preventDefault()}><form onSubmit={submit}><DialogTitle>Edit {editing} plan</DialogTitle><DialogDescription className={styles.modalDescription}>Changes apply to all {affected.length} demo tenants on this plan. Tenant data will be retained, including any usage above the new limits.</DialogDescription>{draft && <><label className={styles.field}>Description<input required maxLength={200} value={draft.description} onChange={event => setDraft(current => ({ ...current, description: event.target.value }))} /></label><div className={styles.limitFields}>{[['skuLimit', 'SKU limit'], ['shopLimit', 'Shop connections'], ['managerLimit', 'Managers']].map(([key, label]) => <label className={styles.field} key={key}>{label}<input type="number" min="1" max="1000000" step="1" required readOnly={editing === 'Free' && key === 'shopLimit'} value={draft[key]} onChange={event => setDraft(current => ({ ...current, [key]: event.target.value === '' ? '' : Number(event.target.value) }))} /></label>)}</div>{editing === 'Free' && <p className={styles.help}>Free keeps the approved limit of one shop connection.</p>}<div className={styles.impact}><strong>{affected.length} tenants affected · {exceeded.length} would exceed limits</strong>{exceeded.length ? <ul>{exceeded.map(tenant => <li key={tenant.id}>{tenant.name}: {usageIssues(tenant, draft).join(' · ')}</li>)}</ul> : <p>All tenants fit within the proposed quotas.</p>}</div><label className={styles.field}>Reason<textarea required maxLength={500} value={reason} onChange={event => { setReason(event.target.value); setError('') }} /></label></>}<p className={styles.fieldError} role="alert">{error}</p><DialogFooter><DialogClose asChild><Button variant="outline" type="button">Cancel</Button></DialogClose><Button type="submit">Save plan</Button></DialogFooter></form></DialogContent></Dialog>
  </>
}
