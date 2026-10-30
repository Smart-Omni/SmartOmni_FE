import { useCallback, useState } from 'react'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog'
import { tenantApi } from '@/services/api/tenant'
import { DataTable, Feedback, OwnerPanel } from '@/features/portal/components/OwnerWorkspaceUI'
import { useApiResource } from './useApiResource'
import { ResourceState } from './ShopeeShared'
import { useApiAction } from './apiHelpers'
import styles from '@/features/portal/OwnerWorkspace.module.css'

export default function ApiTenants() {
  const [query, setQuery] = useState('')
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(0)
  const [pending, setPending] = useState(null)
  const action = useApiAction()
  const loader = useCallback(signal => tenantApi.list({ keyword, page, size: 20 }, signal), [keyword, page])
  const resource = useApiResource(loader)
  return <><OwnerPanel title="Tenant directory"><form className={styles.filters} onSubmit={event => { event.preventDefault(); setKeyword(query.trim()); setPage(0); resource.reload() }}><label className={styles.field}>Search tenants<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Tenant name or subdomain" /></label><Button type="submit">Search</Button><Button type="button" variant="outline" onClick={resource.reload}>Refresh tenants</Button></form><ResourceState resource={resource} />{resource.data && <><DataTable label="Tenant directory" headings={['Tenant', 'Subdomain', 'Status', 'Actions']}>{resource.data.content?.map(tenant => <tr key={tenant.id}><td>{tenant.name || tenant.companyName}<p>ID {tenant.id}</p></td><td>{tenant.subdomain}</td><td>{tenant.status}</td><td><div className={styles.actions}><Button variant="outline" disabled={action.busy} onClick={() => action.run(async () => { const active = await tenantApi.status(tenant.id); if (typeof active !== 'boolean') throw new Error('Could not determine tenant status.'); return active }, active => `${tenant.name || tenant.subdomain}: ${active ? 'active' : 'inactive'}.`)}>Check status</Button>{tenant.status?.toUpperCase() === 'LOCKED' ? <Button variant="outline" onClick={() => setPending({ tenant, unlock: true })}>Unlock tenant</Button> : <Button variant="destructive" onClick={() => setPending({ tenant, unlock: false })}>Lock tenant</Button>}</div></td></tr>)}</DataTable>{!resource.data.content?.length && <p>No tenants match your search.</p>}<div className={styles.actions}><Button variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous page</Button><span>Page {page + 1} of {Math.max(1, resource.data.totalPages || 0)} · {resource.data.totalElements || 0} tenants</span><Button variant="secondary" disabled={page + 1 >= (resource.data.totalPages || 0)} onClick={() => setPage(page + 1)}>Next page</Button></div></>}<Feedback value={action.feedback} /></OwnerPanel><TenantCreator reload={resource.reload} />{pending && <TenantAccessDialog key={`${pending.tenant.id}:${pending.unlock}`} {...pending} close={() => setPending(null)} reload={resource.reload} />}</>
}

function TenantAccessDialog({ tenant, unlock, close, reload }) {
  const [reason, setReason] = useState('')
  const action = useApiAction()
  return <Dialog open onOpenChange={open => { if (!open && !action.busy) close() }}><DialogContent className={styles.dialog}><DialogTitle>{unlock ? 'Unlock' : 'Lock'} tenant {tenant.name || tenant.subdomain}?</DialogTitle><DialogDescription>{unlock ? 'Restore access to this tenant workspace.' : 'This pauses tenant access and may revoke active sessions. Enter a reason before confirming.'}</DialogDescription><form className={styles.form} onSubmit={event => { event.preventDefault(); action.run(async () => { if (!unlock && !reason.trim()) throw new Error('Enter a reason.'); return unlock ? tenantApi.unlock(tenant.id) : tenantApi.lock(tenant.id, reason.trim()) }, unlock ? 'Tenant unlocked.' : 'Tenant locked.', () => { reload(); close() }) }}>{!unlock && <label className={styles.field}>Lock reason<textarea required value={reason} onChange={event => setReason(event.target.value)} disabled={action.busy} /></label>}<Feedback value={action.feedback} /><div className={styles.actions}><Button type="button" variant="secondary" onClick={close} disabled={action.busy}>Cancel</Button><Button type="submit" disabled={action.busy}>{action.busy ? 'Saving…' : unlock ? 'Confirm unlock' : 'Confirm lock'}</Button></div></form></DialogContent></Dialog>
}

function TenantCreator({ reload }) {
  const [draft, setDraft] = useState({ companyName: '', subdomain: '', adminEmail: '', adminPassword: '', contactEmail: '', contactPhone: '', planType: 'FREE' })
  const action = useApiAction()
  const change = event => setDraft({ ...draft, [event.target.name]: event.target.value })
  async function check() {
    const subdomain = draft.subdomain.trim().toLowerCase()
    if (!/^[a-z0-9-]{3,30}$/.test(subdomain)) throw new Error('Enter a subdomain with 3–30 lowercase letters, numbers or hyphens.')
    return tenantApi.checkSubdomain(subdomain)
  }
  function submit(event) {
    event.preventDefault()
    action.run(async () => {
      const availability = await check()
      if (availability.available !== true) throw new Error(availability.message || 'This subdomain is unavailable.')
      return tenantApi.onboard({ companyName: draft.companyName.trim(), subdomain: draft.subdomain.trim().toLowerCase(), adminEmail: draft.adminEmail.trim().toLowerCase(), adminPassword: draft.adminPassword, contactEmail: draft.contactEmail.trim() || null, contactPhone: draft.contactPhone.trim() || null, planType: draft.planType })
    }, tenant => `Tenant ${tenant.subdomain} created. Administrator account created.`, () => { reload(); setDraft({ companyName: '', subdomain: '', adminEmail: '', adminPassword: '', contactEmail: '', contactPhone: '', planType: 'FREE' }) })
  }
  return <OwnerPanel title="Provision a tenant workspace"><p>Create a workspace and its administrator account. Share the initial password securely with the administrator.</p><form className={styles.form} onSubmit={submit}><label className={styles.field}>Company name<input required name="companyName" value={draft.companyName} onChange={change} disabled={action.busy} /></label><label className={styles.field}>Tenant subdomain<input required name="subdomain" pattern="[a-z0-9-]{3,30}" autoCapitalize="none" spellCheck={false} value={draft.subdomain} onChange={change} disabled={action.busy} /></label><div className={styles.actions}><Button type="button" variant="outline" disabled={action.busy} onClick={() => action.run(check, result => result.message || (result.available ? 'Subdomain is available.' : 'Subdomain is unavailable.'))}>Check subdomain</Button></div><label className={styles.field}>Administrator email<input required name="adminEmail" type="email" value={draft.adminEmail} onChange={change} disabled={action.busy} autoComplete="off" /></label><label className={styles.field}>Administrator password<input required name="adminPassword" type="password" minLength={8} maxLength={100} value={draft.adminPassword} onChange={change} disabled={action.busy} autoComplete="new-password" /></label><label className={styles.field}>Contact email<input name="contactEmail" type="email" value={draft.contactEmail} onChange={change} disabled={action.busy} /></label><label className={styles.field}>Contact phone<input name="contactPhone" type="tel" value={draft.contactPhone} onChange={change} disabled={action.busy} /></label><label className={styles.field}>Allocated plan<select name="planType" value={draft.planType} onChange={change} disabled={action.busy}><option value="FREE">Free</option><option value="PRO">Pro</option></select></label><p className={styles.note}>Plan allocation does not process a payment.</p><div className={styles.actions}><Button type="submit" disabled={action.busy}>{action.busy ? 'Creating…' : 'Create tenant workspace'}</Button></div><Feedback value={action.feedback} /></form></OwnerPanel>
}
