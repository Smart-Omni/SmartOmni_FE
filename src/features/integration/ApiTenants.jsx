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
  return <><OwnerPanel title="Tenant directory"><form className={styles.filters} onSubmit={event => { event.preventDefault(); setKeyword(query.trim()); setPage(0); resource.reload() }}><label className={styles.field}>Search tenants<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Tenant name or subdomain" /></label><Button type="submit">Search</Button><Button type="button" variant="outline" onClick={resource.reload}>Refresh tenants</Button></form><ResourceState resource={resource} />{resource.data && <><DataTable label="Tenant directory" headings={['Tenant', 'Subdomain', 'Status', 'Actions']}>{resource.data.content?.map(tenant => <tr key={tenant.id}><td>{tenant.name || tenant.companyName}<p>ID {tenant.id}</p></td><td>{tenant.subdomain}</td><td>{tenant.status}</td><td><div className={styles.actions}><Button variant="outline" disabled={action.busy} onClick={() => action.run(async () => { const active = await tenantApi.status(tenant.id); if (typeof active !== 'boolean') throw new Error('Could not determine tenant status.'); return active }, active => `${tenant.name || tenant.subdomain}: ${active ? 'active' : 'inactive'}.`)}>Check status</Button>{tenant.status?.toUpperCase() === 'LOCKED' ? <Button variant="outline" onClick={() => setPending({ tenant, unlock: true })}>Unlock tenant</Button> : <Button variant="destructive" onClick={() => setPending({ tenant, unlock: false })}>Lock tenant</Button>}</div></td></tr>)}</DataTable>{!resource.data.content?.length && <p>No tenants match your search.</p>}<div className={styles.actions}><Button variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous page</Button><span>Page {page + 1} of {Math.max(1, resource.data.totalPages || 0)} · {resource.data.totalElements || 0} tenants</span><Button variant="secondary" disabled={page + 1 >= (resource.data.totalPages || 0)} onClick={() => setPage(page + 1)}>Next page</Button></div></>}<Feedback value={action.feedback} /></OwnerPanel>{pending && <TenantAccessDialog key={`${pending.tenant.id}:${pending.unlock}`} {...pending} close={() => setPending(null)} reload={resource.reload} />}</>
}

function TenantAccessDialog({ tenant, unlock, close, reload }) {
  const [reason, setReason] = useState('')
  const action = useApiAction()
  return <Dialog open onOpenChange={open => { if (!open && !action.busy) close() }}><DialogContent className={styles.dialog}><DialogTitle>{unlock ? 'Unlock' : 'Lock'} tenant {tenant.name || tenant.subdomain}?</DialogTitle><DialogDescription>{unlock ? 'Restore access to this tenant workspace.' : 'This pauses tenant access and may revoke active sessions. Enter a reason before confirming.'}</DialogDescription><form className={styles.form} onSubmit={event => { event.preventDefault(); action.run(async () => { if (!unlock && !reason.trim()) throw new Error('Enter a reason.'); return unlock ? tenantApi.unlock(tenant.id) : tenantApi.lock(tenant.id, reason.trim()) }, unlock ? 'Tenant unlocked.' : 'Tenant locked.', () => { reload(); close() }) }}>{!unlock && <label className={styles.field}>Lock reason<textarea required value={reason} onChange={event => setReason(event.target.value)} disabled={action.busy} /></label>}<Feedback value={action.feedback} /><div className={styles.actions}><Button type="button" variant="secondary" onClick={close} disabled={action.busy}>Cancel</Button><Button type="submit" disabled={action.busy}>{action.busy ? 'Saving…' : unlock ? 'Confirm unlock' : 'Confirm lock'}</Button></div></form></DialogContent></Dialog>
}
