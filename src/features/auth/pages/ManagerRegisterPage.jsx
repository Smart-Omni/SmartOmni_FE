import { useEffect, useId, useRef, useState } from 'react'
import { ArrowLeft, Mail } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/shared/ui/button'
import { AuthLayout } from '../components/AuthLayout'
import { FormField } from '../components/FormField'
import { GoogleContinue } from '../components/GoogleContinue'
import { PasswordField } from '../components/PasswordField'
import { useValidatedForm } from '../hooks/useValidatedForm'
import styles from '../components/AuthForm.module.css'
import pageStyles from './ManagerRegisterPage.module.css'

export function ManagerRegisterPage() {
  const id = useId()
  const [preview, setPreview] = useState(false)
  const [googleNotice, setGoogleNotice] = useState('')
  const heading = useRef(null)
  const form = useValidatedForm({ fullName: '', email: '', password: '', confirmPassword: '' })
  useEffect(() => { if (preview) heading.current?.focus() }, [preview])
  function submit(event) {
    if (!form.check(event)) return
    form.clearCredentials()
    setPreview(true)
  }
  return <AuthLayout compact showInfoCard={false} showBackLink={false}
    footer={<>Already have an account? <Link to="/auth/login">Sign in</Link></>}><div className={`${styles.container} ${pageStyles.container}`}>
    {preview ? <>
      <div className={pageStyles.previewIcon}><Mail size={28} aria-hidden="true" /></div>
      <div className={styles.intro}><p className={styles.eyebrow}>PENDING INVITATION</p>
        <h1 ref={heading} tabIndex={-1}>Your next step: Join a workspace.</h1>
        <p className={styles.subtitle}>Once your account is created, a store owner can invite you to their team.</p>
      </div>
      <ol className={pageStyles.nextSteps} aria-label="Intended team onboarding">
        <li><span>1</span><div><strong>Receive an owner invitation</strong><p>A store owner invites your registered account.</p></div></li>
        <li><span>2</span><div><strong>Review and accept</strong><p>Review the workspace and the permissions offered.</p></div></li>
        <li><span>3</span><div><strong>Join the workspace</strong><p>Merchant access requires an active membership confirmed by the service.</p></div></li>
      </ol>
      <Button variant="outline" className={styles.submit} onClick={() => setPreview(false)}>Back to registration</Button>
    </> : <>
      <div className={`${styles.intro} ${pageStyles.intro}`}><p className={styles.eyebrow}>TENANT MANAGER</p><h1>Create your team account.</h1>
        <p className={styles.subtitle}>Get ready to collaborate in your SmartOmni workspace.</p>
      </div>
      <form noValidate onSubmit={submit} aria-label="Manager registration">
        <FormField name="fullName" label="Full name" autoComplete="name" placeholder="Your full name" value={form.values.fullName} error={form.errors.fullName} onChange={form.change} onBlur={form.blur} />
        <FormField name="email" label="Email address" type="email" autoComplete="email" placeholder="you@example.com" value={form.values.email} error={form.errors.email} onChange={form.change} onBlur={form.blur} />
        <PasswordField id={`${id}-password`} value={form.values.password} error={form.errors.password} onChange={form.change} onBlur={form.blur} />
        <PasswordField id={`${id}-confirm`} name="confirmPassword" label="Confirm password" value={form.values.confirmPassword} error={form.errors.confirmPassword} onChange={form.change} onBlur={form.blur} />
        <div className={pageStyles.actions}>
          <Link className={pageStyles.back} to="/auth/register"><ArrowLeft size={16} aria-hidden="true" />Back to Account Type</Link>
          <Button className={styles.submit} type="submit">Create account</Button>
        </div>
      </form>
      <div>
        <GoogleContinue onContinue={() => setGoogleNotice('Google sign-in is not connected yet. No account has been created.')} />
        <div role="status" aria-live="polite" className={pageStyles.googleNotice}>{googleNotice}</div>
      </div>
    </>}
  </div></AuthLayout>
}
