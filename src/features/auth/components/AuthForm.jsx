import { useId, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Info } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { PasswordField } from './PasswordField'
import { GoogleContinue } from './GoogleContinue'
import { validateField } from '../lib/validation'
import { signInDemo } from '../lib/demoSession'
import { useDemoSession } from '../hooks/useDemoSession'
import styles from './AuthForm.module.css'
import { customerByEmail } from '@/features/customer/customerStore'

export function AuthForm() {
  const id = useId()
  const session = useDemoSession()
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const [values, setValues] = useState({ email: location.state?.email || '', password: '' })
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [notice, setNotice] = useState('')
  const [needsVerification, setNeedsVerification] = useState(false)

  function change(event) {
    const { name, value } = event.target
    setValues(current => ({ ...current, [name]: value }))
    setNotice('')
    setNeedsVerification(false)
    if (touched[name] || submitted) setErrors(current => ({ ...current, [name]: validateField(name, value) }))
  }

  function blur(event) {
    const { name, value } = event.target
    setTouched(current => ({ ...current, [name]: true }))
    setErrors(current => ({ ...current, [name]: validateField(name, value) }))
  }

  function submit(event) {
    event.preventDefault()
    const nextErrors = Object.fromEntries(Object.entries(values).map(([name, value]) => [name, validateField(name, value)]))
    setSubmitted(true)
    setErrors(nextErrors)
    setNotice('')
    const invalidField = Object.keys(nextErrors).find(name => nextErrors[name])
    if (invalidField) {
      event.currentTarget.elements.namedItem(invalidField)?.focus()
      return
    }
    const result = signInDemo(values.email, values.password)
    if (result.error) {
      setNotice(result.error)
      setNeedsVerification(Boolean(result.needsVerification))
      return
    }
    setValues({ email: '', password: '' })
    setNotice(`Signed in as ${result.account.roleLabel}. This is a local demo session.`)
    navigate(result.account.role === 'CUSTOMER' ? '/store/everyday-studio' : result.account.role === 'SUPER_ADMIN' ? '/admin' : '/merchant/dashboard', { replace: true })
  }

  if (session) return <Navigate to={session.role === 'CUSTOMER' ? '/store/everyday-studio' : session.role === 'SUPER_ADMIN' ? '/admin' : '/merchant/dashboard'} replace />

  return <div className={styles.container}>
    <div className={styles.intro}>
      <p className={styles.eyebrow}>YOUR WORKSPACE, TOGETHER</p>
      <h1>Welcome back.</h1>
      <p className={styles.subtitle}>Sign in to your SmartOmni workspace.</p>
    </div>
    <form className={styles.loginForm} noValidate onSubmit={submit} aria-label="Sign in">
      <div className={styles.field}>
        <label htmlFor={`${id}-email`}>Email address</label>
        <input id={`${id}-email`} name="email" type="email" required autoComplete="email"
          autoCapitalize="none" spellCheck={false} value={values.email} onChange={change} onBlur={blur}
          placeholder="you@example.com" className={styles.input}
          aria-invalid={Boolean(errors.email)} aria-describedby={`${id}-email-error`} />
        <p id={`${id}-email-error`} className={styles.error} aria-live="polite">{errors.email || ''}</p>
      </div>
      <PasswordField id={`${id}-password`} value={values.password} onChange={change} onBlur={blur}
        error={errors.password} autoComplete="current-password" />
      <div className={styles.actions}>
        <Button type="button" variant="link" size="sm" className={styles.forgot} onClick={() => navigate(params.get('account') === 'customer' || customerByEmail(values.email) ? '/customer/reset-password' : '/auth/reset-password', { state: { email: values.email } })}>Forgot password?</Button>
        <Button type="submit" className={styles.submit}>Sign in</Button>
      </div>
      <GoogleContinue onContinue={() => setNotice('Google sign-in is not connected yet. You have not been signed in.')} />
      <div className={styles.notice} role="status" aria-live="polite" aria-atomic="true">
        {notice && <div className={styles.noticeContent}><Info size={18} aria-hidden="true" /><p>{notice}</p></div>}
        {needsVerification && <Link to="/customer/verify-email" state={{ email: values.email }}>Verify your email address</Link>}
      </div>
    </form>
  </div>
}

