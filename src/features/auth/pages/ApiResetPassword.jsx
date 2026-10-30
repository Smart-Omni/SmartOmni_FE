import { useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { authApi } from '@/services/api/auth'
import { clearApiSession } from '@/services/api/session'
import { Button } from '@/shared/ui/button'
import { AuthLayout } from '../components/AuthLayout'
import { Feedback } from '@/features/portal/components/OwnerWorkspaceUI'
import { useApiAction } from '@/features/integration/apiHelpers'
import styles from '@/features/portal/OwnerWorkspace.module.css'

export default function ApiResetPassword() {
  const [params] = useSearchParams()
  const location = useLocation()
  const token = params.get('token')
  const [email, setEmail] = useState(location.state?.email || '')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [done, setDone] = useState(false)
  const action = useApiAction()
  function submit(event) {
    event.preventDefault()
    action.run(async () => {
      if (!token) return authApi.forgotPassword(email.trim())
      if (password !== confirmation) throw new Error('Passwords do not match.')
      await authApi.resetPassword(token, password, confirmation)
      clearApiSession(); setPassword(''); setConfirmation('')
    }, token ? 'Password updated. Sign in with your new password.' : 'If this email is registered, the server will process your reset request.', () => setDone(true))
  }
  return <AuthLayout showBackLink={false} footer={<Link to="/auth/login">Back to sign in</Link>}><div className={styles.page}><h1>{token ? 'Set a new password' : 'Reset password'}</h1>{!done && <form className={styles.form} onSubmit={submit}>{token ? <><label className={styles.field}>New password<input required minLength={6} maxLength={100} type="password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} /></label><label className={styles.field}>Confirm new password<input required minLength={6} maxLength={100} type="password" autoComplete="new-password" value={confirmation} onChange={event => setConfirmation(event.target.value)} /></label></> : <label className={styles.field}>Email address<input required type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} /></label>}<Button type="submit" disabled={action.busy}>{action.busy ? 'Submitting…' : token ? 'Update password' : 'Request password reset'}</Button></form>}<Feedback value={action.feedback} /></div></AuthLayout>
}
