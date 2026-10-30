import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usersApi, canManageUsers } from '@/services/api/users'
import { clearApiSession } from '@/services/api/session'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog'
import { DataTable, Feedback, OwnerPanel } from '@/features/portal/components/OwnerWorkspaceUI'
import { useApiResource } from './useApiResource'
import { useApiAction } from './apiHelpers'
import { ResourceState } from './ShopeeShared'
import styles from '@/features/portal/OwnerWorkspace.module.css'

const roles = ['ADMIN', 'TENANT_ADMIN', 'MANAGER', 'CUSTOMER']

export default function ApiUsers({ session }) {
  // Keep hooks inside the authorized component, so opening a URL never fetches privileged data.
  return canManageUsers(session) ? <UserDirectory session={session} /> : <OwnerPanel title="Account management unavailable"><p>Your account does not have permission to manage users.</p></OwnerPanel>
}

function UserDirectory({ session }) {
  const [filters, setFilters] = useState({ keyword: '', status: '', role: '', sortBy: 'createdAt', sortDir: 'desc' })
  const [query, setQuery] = useState(filters)
  const [page, setPage] = useState(0)
  const [dialog, setDialog] = useState(null)
  const loader = useCallback(signal => usersApi.list({ ...query, page, size: 10 }, signal), [query, page])
  const resource = useApiResource(loader)
  return <OwnerPanel title="User accounts"><form className={styles.filters} onSubmit={event => { event.preventDefault(); setQuery({ ...filters }); setPage(0) }}>
    <label className={styles.field}>Search users<input value={filters.keyword} onChange={event => setFilters({ ...filters, keyword: event.target.value })} /></label>
    <label className={styles.field}>Status<select value={filters.status} onChange={event => setFilters({ ...filters, status: event.target.value })}><option value="">All statuses</option><option>ACTIVE</option><option>DISABLED</option></select></label>
    <label className={styles.field}>Role<select value={filters.role} onChange={event => setFilters({ ...filters, role: event.target.value })}><option value="">All roles</option>{roles.map(role => <option key={role}>{role}</option>)}</select></label>
    <label className={styles.field}>Sort by<select value={filters.sortBy} onChange={event => setFilters({ ...filters, sortBy: event.target.value })}><option value="createdAt">Created date</option><option value="email">Email</option><option value="fullName">Name</option></select></label>
    <label className={styles.field}>Sort direction<select value={filters.sortDir} onChange={event => setFilters({ ...filters, sortDir: event.target.value })}><option value="desc">Descending</option><option value="asc">Ascending</option></select></label>
    <Button type="submit">Search</Button>
  </form><div className={styles.actions}><Button onClick={() => setDialog({ type: 'create' })}>Create user</Button><Button variant="outline" onClick={resource.reload}>Refresh users</Button></div><ResourceState resource={resource} />{resource.data && <>
    <DataTable label="User directory" headings={['User', 'Role', 'Status', 'Actions']}>{resource.data.content?.map(user => <tr key={user.id}><td>{user.full_name || user.fullName || user.email}<p>{user.email}</p></td><td style={{ whiteSpace: 'nowrap' }}>{user.role}</td><td style={{ whiteSpace: 'nowrap' }}>{user.status}</td><td><div className={styles.actions}><Button variant="outline" aria-label={`Edit ${user.email}`} onClick={() => setDialog({ type: 'edit', user })}>Edit</Button><Button variant="outline" aria-label={`Assign role to ${user.email}`} onClick={() => setDialog({ type: 'roles', user })}>Assign role</Button><Button variant="outline" aria-label={`${user.status === 'DISABLED' ? 'Enable' : 'Disable'} ${user.email}`} onClick={() => setDialog({ type: 'status', user })}>{user.status === 'DISABLED' ? 'Enable' : 'Disable'}</Button></div></td></tr>)}</DataTable>
    {!resource.data.content?.length && <p>No users match your search.</p>}
    <div className={styles.actions}><Button variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous page</Button><span>Page {page + 1} of {Math.max(1, resource.data.total_pages || 0)} · {resource.data.total_elements || 0} users</span><Button variant="secondary" disabled={page + 1 >= (resource.data.total_pages || 0)} onClick={() => setPage(page + 1)}>Next page</Button></div>
  </>}{dialog && <UserDialog key={`${dialog.type}:${dialog.user?.id || 'new'}`} {...dialog} session={session} close={() => setDialog(null)} reload={resource.reload} />}</OwnerPanel>
}

function UserDialog({ type, user, session, close, reload }) {
  const [draft, setDraft] = useState({ email: '', password: '', full_name: user?.full_name || user?.fullName || '', phone: user?.phone || '', avatar: user?.avatar || '', role: user?.role || 'MANAGER' })
  const action = useApiAction()
  const navigate = useNavigate()
  const status = user?.status === 'DISABLED' ? 'ACTIVE' : 'DISABLED'
  const title = { create: 'Create user', edit: 'Edit user', roles: 'Assign role', status: status === 'ACTIVE' ? 'Enable user' : 'Disable user' }[type]
  const change = event => setDraft({ ...draft, [event.target.name]: event.target.value })
  function submit(event) {
    event.preventDefault()
    action.run(() => {
      if (type === 'status') return usersApi.status(user.id, status)
      if (type === 'roles') return usersApi.roles(user.id, draft.role)
      const body = { full_name: draft.full_name.trim(), phone: draft.phone.trim(), avatar: draft.avatar.trim() }
      return type === 'create' ? usersApi.create({ ...body, email: draft.email.trim().toLowerCase(), password: draft.password, role: draft.role }) : usersApi.update(user.id, body)
    }, 'User saved.', () => {
      if (String(user?.id) === String(session.id) && (type === 'roles' || (type === 'status' && status === 'DISABLED'))) {
        clearApiSession(); navigate('/auth/login', { replace: true }); return
      }
      reload(); close()
    })
  }
  return <Dialog open onOpenChange={open => { if (!open && !action.busy) close() }}><DialogContent className={styles.dialog}><DialogTitle>{title}</DialogTitle><DialogDescription>{type === 'create' ? 'Create an account in your workspace.' : `${title} for ${user.email}. ${type === 'roles' ? 'The user will need a new session to use their updated role.' : type === 'status' && status === 'DISABLED' ? 'Disabling an account revokes its refresh tokens.' : ''}`}</DialogDescription><form className={styles.form} onSubmit={submit}><fieldset disabled={action.busy} className={styles.form} style={{ border: 0, padding: 0, margin: 0 }}>
    {type === 'create' && <><label className={styles.field}>Email address<input name="email" type="email" required value={draft.email} onChange={change} autoComplete="off" /></label><label className={styles.field}>Initial password<input name="password" type="password" required minLength={6} maxLength={100} value={draft.password} onChange={change} autoComplete="new-password" /></label></>}
    {['create', 'edit'].includes(type) && <><label className={styles.field}>Full name<input name="full_name" required maxLength={100} value={draft.full_name} onChange={change} /></label><label className={styles.field}>Phone<input name="phone" type="tel" maxLength={50} value={draft.phone} onChange={change} /></label><label className={styles.field}>Avatar URL<input name="avatar" type="url" maxLength={500} value={draft.avatar} onChange={change} /></label></>}
    {['create', 'roles'].includes(type) && <label className={styles.field}>Account role<select name="role" value={draft.role} onChange={change} required>{!roles.includes(draft.role) && <option value="">Select a role</option>}{roles.map(role => <option key={role}>{role}</option>)}</select></label>}
    <div className={styles.actions}><Button type="button" variant="secondary" onClick={close}>Cancel</Button><Button type="submit" variant={type === 'status' && status === 'DISABLED' ? 'destructive' : 'default'}>{action.busy ? 'Saving…' : `Confirm ${title.toLowerCase()}`}</Button></div>
  </fieldset><Feedback value={action.feedback} /></form></DialogContent></Dialog>
}
