import { useEffect, useId, useRef, useState } from 'react'
import { CheckCircle2, ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/shared/ui/button'
import { AuthLayout } from '../components/AuthLayout'
import { FormField } from '../components/FormField'
import { PasswordField } from '../components/PasswordField'
import { useValidatedForm } from '../hooks/useValidatedForm'
import styles from '../components/AuthForm.module.css'
import pageStyles from '../pages/StaffRegisterPage.module.css'
import registration from './TenantRegistration.module.css'

export function OwnerBasicInfo() {
  const id = useId()
  const [complete, setComplete] = useState(false)
  const heading = useRef(null)
  const form = useValidatedForm({ fullName: '', email: '', password: '', confirmPassword: '' })
  useEffect(() => { if (complete) heading.current?.focus() }, [complete])
  function submit(event) {
    if (!form.check(event)) return
    form.clearCredentials()
    setComplete(true)
  }
  return <AuthLayout compact showInfoCard={false} showBackLink={false} footer={<>Already have an account? <Link to="/auth/login?setup=1">Sign in</Link></>}>
    <div className={styles.container + ' ' + pageStyles.container}>
      {complete ? <>
        <div className={pageStyles.previewIcon}><CheckCircle2 size={28} aria-hidden="true" /></div>
        <div className={styles.intro}><p className={styles.eyebrow}>ACCOUNT REGISTRATION PREVIEW</p><h1 ref={heading} tabIndex={-1}>Your next step: Sign in.</h1><p className={styles.subtitle}>Account registration ends here. Choose your plan and configure your workspace after signing in.</p></div>
        <p className={styles.hint} role="status">Preview complete. No account has been created and no credentials have been saved. Use an existing demo Owner account to preview the setup flow after sign-in.</p>
        <div className={registration.successActions}><Button variant="outline" onClick={() => setComplete(false)}>Back to registration</Button><Button asChild className={styles.submit}><Link to="/auth/login?setup=1">Continue to sign in</Link></Button></div>
      </> : <>
        <div className={styles.intro + ' ' + pageStyles.intro}><p className={styles.eyebrow}>TENANT OWNER ACCOUNT</p><h1>Create your tenant account.</h1><p className={styles.subtitle}>Start with your account. Set up your store after signing in.</p></div>
        <form noValidate onSubmit={submit} aria-label="Tenant account registration">
          <FormField name="fullName" label="Full name" autoComplete="name" placeholder="Your full name" value={form.values.fullName} error={form.errors.fullName} onChange={form.change} onBlur={form.blur} />
          <FormField name="email" label="Email address" type="email" autoComplete="email" placeholder="you@example.com" value={form.values.email} error={form.errors.email} onChange={form.change} onBlur={form.blur} />
          <PasswordField id={id + '-password'} value={form.values.password} error={form.errors.password} onChange={form.change} onBlur={form.blur} />
          <PasswordField id={id + '-confirm'} name="confirmPassword" label="Confirm password" value={form.values.confirmPassword} error={form.errors.confirmPassword} onChange={form.change} onBlur={form.blur} />
          <div className={pageStyles.actions}><Link className={pageStyles.back} to="/auth/register"><ArrowLeft size={16} aria-hidden="true" />Back to Account Type</Link><Button className={styles.submit} type="submit">Create account</Button></div>
        </form>
        <p className={styles.hint}>Frontend preview only. Creating an account requires a registration service.</p>
      </>}
    </div>
  </AuthLayout>
}
