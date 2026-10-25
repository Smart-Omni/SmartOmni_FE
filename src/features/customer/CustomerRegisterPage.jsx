import { useId, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Button } from '@/shared/ui/button'
import { AuthLayout } from '@/features/auth/components/AuthLayout'
import { FormField } from '@/features/auth/components/FormField'
import { GoogleContinue } from '@/features/auth/components/GoogleContinue'
import { PasswordField } from '@/features/auth/components/PasswordField'
import { useValidatedForm } from '@/features/auth/hooks/useValidatedForm'
import { useDemoSession } from '@/features/auth/hooks/useDemoSession'
import { createChallenge, registerCustomer } from './customerStore'
import styles from '@/features/auth/components/AuthForm.module.css'
import pageStyles from '@/features/auth/pages/StaffRegisterPage.module.css'

export function CustomerRegisterPage() {
  const id = useId()
  const navigate = useNavigate()
  const session = useDemoSession()
  const [notice, setNotice] = useState('')
  const form = useValidatedForm({ fullName: '', email: '', password: '', confirmPassword: '' })
  function submit(event) {
    if (!form.check(event)) return
    setNotice('')
    try {
      const { fullName, email, password, confirmPassword } = form.values
      const account = registerCustomer(fullName, email, password, confirmPassword)
      form.clearCredentials()
      navigate('/customer/verify-email', { state: { email: account.email, token: createChallenge(account.email, 'verify') } })
    } catch (failure) { setNotice(failure.message) }
  }
  if (session?.role === 'CUSTOMER') return <Navigate to="/store/everyday-studio" replace />
  return <AuthLayout compact showInfoCard={false} showBackLink={false} footer={<>Already have an account? <Link to="/auth/login?account=customer">Sign in</Link></>}>
    <div className={`${styles.container} ${pageStyles.container}`}>
      <div className={`${styles.intro} ${pageStyles.intro}`}><p className={styles.eyebrow}>CUSTOMER</p><h1>Create your customer account.</h1><p className={styles.subtitle}>Shop your everyday favourites and collect loyalty points.</p></div>
      <form noValidate onSubmit={submit} aria-label="Customer registration">
        <FormField name="fullName" label="Full name" autoComplete="name" placeholder="Your full name" value={form.values.fullName} error={form.errors.fullName} onChange={form.change} onBlur={form.blur} />
        <FormField name="email" label="Email address" type="email" autoComplete="email" placeholder="you@example.com" value={form.values.email} error={form.errors.email} onChange={form.change} onBlur={form.blur} />
        <PasswordField id={`${id}-password`} value={form.values.password} error={form.errors.password} onChange={form.change} onBlur={form.blur} />
        <PasswordField id={`${id}-confirm`} name="confirmPassword" label="Confirm password" value={form.values.confirmPassword} error={form.errors.confirmPassword} onChange={form.change} onBlur={form.blur} />
        <div className={pageStyles.actions}><Link className={pageStyles.back} to="/store/everyday-studio"><ArrowLeft size={16} aria-hidden="true" />Back to store</Link><Button className={styles.submit} type="submit">Create account</Button></div>
      </form>
      <GoogleContinue onContinue={() => setNotice('Google sign-up is not connected yet. No account has been created.')} />
      <p role="status" aria-live="polite" className={pageStyles.googleNotice}>{notice}</p>
      <p className={styles.hint}>Demo registration. Verify your email next to continue to the store. No real email is sent; new accounts last until reload.</p>
    </div>
  </AuthLayout>
}
