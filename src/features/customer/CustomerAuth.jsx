import { useId, useState } from 'react'
import { Mail } from 'lucide-react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { AuthLayout } from '@/features/auth/components/AuthLayout'
import { FormField } from '@/features/auth/components/FormField'
import { PasswordField } from '@/features/auth/components/PasswordField'
import { Button } from '@/shared/ui/button'
import { signInDemo } from '@/features/auth/lib/demoSession'
import { completeChallenge, createChallenge, customerPassword } from './customerStore'
import styles from '@/features/auth/components/AuthForm.module.css'
import pageStyles from '@/features/auth/pages/StaffRegisterPage.module.css'

export function CustomerAuth() {
  const location = useLocation()
  return <CustomerRecovery key={location.pathname + location.search} />
}

function CustomerRecovery() {
  const id = useId()
  const location = useLocation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const mode = location.pathname.includes('verify-email') ? 'verify' : 'reset'
  const token = params.get('token')
  const [email, setEmail] = useState(location.state?.email || '')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [linkToken, setLinkToken] = useState(location.state?.token || '')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [done, setDone] = useState(false)
  function submit(event) {
    event.preventDefault()
    setError('')
    try {
      if (!token) {
        setLinkToken(createChallenge(email, mode))
        setNotice('If this email belongs to a customer account, a demo link is ready below.')
      } else {
        const account = completeChallenge(token, mode, password, confirmation)
        if (mode === 'verify') {
          const result = signInDemo(account.email, customerPassword(account.id))
          if (result.error) throw new Error(result.error)
          navigate('/store/everyday-studio', { replace: true })
        } else {
          setPassword(''); setConfirmation(''); setDone(true)
        }
      }
    } catch (failure) { setError(failure.message) }
  }
  return <AuthLayout compact showInfoCard={false} showBackLink={false} footer={<Link to="/auth/login?account=customer">Back to sign in</Link>}>
    <div className={`${styles.container} ${pageStyles.container}`}>
      <div className={`${styles.intro} ${pageStyles.intro}`}><p className={styles.eyebrow}>CUSTOMER ACCOUNT</p><h1>{done ? 'Password updated.' : mode === 'verify' ? 'Verify your email.' : token ? 'Set a new password.' : 'Forgot your password?'}</h1><p className={styles.subtitle}>{mode === 'verify' ? 'Verify your email address to continue to the store.' : 'Reset your customer account password.'}</p></div>
      {done ? <><p role="status">Your new password works in this app session.</p><Button asChild variant="outline"><Link to="/auth/login?account=customer">Continue to sign in</Link></Button></> : <form onSubmit={submit}>
        {!token && <FormField name="email" label="Email address" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={event => setEmail(event.target.value)} />}
        {token && mode === 'reset' && <><PasswordField id={`${id}-password`} value={password} onChange={event => setPassword(event.target.value)} /><PasswordField id={`${id}-confirm`} name="confirmPassword" label="Confirm password" value={confirmation} onChange={event => setConfirmation(event.target.value)} /></>}
        {token && mode === 'verify' && <p className={styles.hint}>Use this local demo link to verify your email. No email has been sent.</p>}
        {error && <p className={styles.error} role="alert">{error}</p>}
        {notice && <p className={styles.hint} role="status">{notice}</p>}
        <div className={pageStyles.actions}><Button type="submit">{mode === 'verify' ? token ? 'Verify email address' : 'Resend verification link' : token ? 'Save new password' : 'Request reset link'}</Button></div>
      </form>}
      {linkToken && !token && <div className={styles.noticeContent}><Mail size={18} aria-hidden="true" /><div><strong>Demo inbox</strong><p>No email was sent. Links expire in 10 minutes and are cleared on reload.</p><Link to={`/customer/${mode === 'verify' ? 'verify-email' : 'reset-password'}?token=${encodeURIComponent(linkToken)}`}>Open demo {mode === 'verify' ? 'verification' : 'reset'} link</Link></div></div>}
      {token && !done && <Link className={pageStyles.back} to={location.pathname}>Request a new link</Link>}
      <p className={styles.hint}>Frontend demo. New accounts and changed passwords last until reload.</p>
    </div>
  </AuthLayout>
}
