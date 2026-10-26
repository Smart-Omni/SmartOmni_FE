import { useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { Button } from '@/shared/ui/button'
import { AuthLayout } from '../components/AuthLayout'
import { getDemoSession, signOutDemo } from '../lib/demoSession'
import { requestAccountDemoReset, resetStaffDemoPassword } from '../lib/staffDemoReset'
import styles from '@/features/portal/OwnerWorkspace.module.css'

export default function StaffResetPasswordPage() {
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const accountType = ['owner', 'admin'].includes(params.get('account')) ? params.get('account') : 'staff'
  const label = { owner: 'Owner', admin: 'Admin', staff: 'Staff' }[accountType]
  const role = { owner: 'TENANT_OWNER', admin: 'SUPER_ADMIN', staff: 'TENANT_STAFF' }[accountType]
  const token = params.get('token')
  const [email, setEmail] = useState(location.state?.email || '')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [previewToken, setPreviewToken] = useState(null)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  function submit(event) {
    event.preventDefault()
    setError('')
    if (!token) { setPreviewToken(requestAccountDemoReset(email, role)); return }
    try {
      const accountId = resetStaffDemoPassword(token, password, confirmation)
      if (getDemoSession()?.id === accountId) signOutDemo()
      setPassword(''); setConfirmation(''); setDone(true)
    } catch (failure) { setPassword(''); setConfirmation(''); setError(failure.message) }
  }
  return <AuthLayout showBackLink={false} footer={<Link to="/auth/login">Back to sign in</Link>}><div className={styles.page}><div className={styles.heading}><h1>{done ? 'Demo password updated' : token ? `Set a new ${label} password` : `Reset ${label} password`}</h1><p>Reset your {label.toLowerCase()} account with a one-use local preview link. No reset email has been sent.</p></div>
    {done ? <p role="status">The new password works only in this running app session. Reloading restores Demo@123. No password is saved to browser storage or sent to a service. Workspace membership and permissions are unchanged.</p> : <form className={styles.form} onSubmit={submit}>{token ? <><label className={styles.field}>New password<input required type="password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} /></label><label className={styles.field}>Confirm new password<input required type="password" autoComplete="new-password" value={confirmation} onChange={event => setConfirmation(event.target.value)} /></label></> : <><label className={styles.field}>Account type<select value={accountType} onChange={event => { setParams({ account: event.target.value }); setPreviewToken(null); setError(''); setEmail('') }}><option value="staff">Staff</option><option value="owner">Owner</option><option value="admin">Super Admin</option></select></label><label className={styles.field}>{label} email<input required type="email" autoComplete="email" value={email} onChange={event => { setEmail(event.target.value); setPreviewToken(null) }} /></label></>}{error && <p role="alert" className={styles.error}>{error}</p>}<div className={styles.actions}><Button type="submit">{token ? 'Update demo password' : 'Request demo reset'}</Button></div></form>}
    {!token && <p role="status">{previewToken ? `If the account is an eligible demo ${label}, use the local preview link below. No email was sent.` : 'No reset email has been sent.'}</p>}
    {!token && previewToken && <Button variant="outline" onClick={() => { setParams({ token: previewToken, account: accountType }); setPreviewToken(null); setError('') }}>Open demo reset link</Button>}
    {token && !done && <Button variant="secondary" onClick={() => { setParams({ account: accountType }); setError(''); setPassword(''); setConfirmation('') }}>Request a new link</Button>}
  </div></AuthLayout>
}
