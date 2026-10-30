import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { authApi } from '@/services/api/auth'
import { Button } from '@/shared/ui/button'
import { AuthLayout } from '../components/AuthLayout'
import { Feedback } from '@/features/portal/components/OwnerWorkspaceUI'
import { useApiAction } from '@/features/integration/apiHelpers'
import styles from '@/features/portal/OwnerWorkspace.module.css'

export default function ApiRegisterCustomer() {
  const [params] = useSearchParams()
  const [draft, setDraft] = useState({ full_name: '', email: '', phone: '', subdomain: params.get('subdomain') || '', password: '', confirmation: '' })
  const navigate = useNavigate()
  const action = useApiAction()
  function submit(event) {
    event.preventDefault()
    action.run(async () => {
      if (draft.password !== draft.confirmation) throw new Error('Passwords do not match.')
      return authApi.register({ full_name: draft.full_name.trim(), email: draft.email.trim().toLowerCase(), phone: draft.phone.trim(), subdomain: draft.subdomain.trim().toLowerCase(), password: draft.password })
    }, 'Account created.', () => navigate('/customer/profile', { replace: true }))
  }
  return <AuthLayout showBackLink={false} footer={<Link to="/auth/login?account=customer">Already have an account? Sign in</Link>}><div className={styles.page}><h1>Create a Customer account</h1><form className={styles.form} onSubmit={submit}>
    {[
      ['full_name', 'Full name', 'text', 100, 'name'], ['email', 'Email address', 'email', 254, 'email'],
      ['phone', 'Phone (optional)', 'tel', 50, 'tel'], ['subdomain', 'Store subdomain', 'text', 30, 'off'],
      ['password', 'Password', 'password', 100, 'new-password'], ['confirmation', 'Confirm password', 'password', 100, 'new-password'],
    ].map(([name, label, type, maxLength, autoComplete]) => <label className={styles.field} key={name}>{label}<input name={name} type={type} required={name !== 'phone'} minLength={type === 'password' ? 6 : undefined} pattern={name === 'subdomain' ? '[a-z0-9-]{3,30}' : undefined} maxLength={maxLength} autoComplete={autoComplete} disabled={action.busy} value={draft[name]} onChange={event => setDraft({ ...draft, [name]: event.target.value })} /></label>)}
    <Button type="submit" disabled={action.busy}>{action.busy ? 'Creating…' : 'Create Customer account'}</Button><Feedback value={action.feedback} />
  </form></div></AuthLayout>
}
