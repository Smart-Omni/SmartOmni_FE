import { useEffect, useId, useRef, useState } from 'react'
import { ArrowLeft, Check } from 'lucide-react'
import { Link, Navigate } from 'react-router-dom'
import { useDemoSession } from '../hooks/useDemoSession'
import { tenantApi } from '@/services/api/tenant'
import { tenantWebsiteUrl, validSubdomain } from '@/services/api/storefront'
import { Button } from '@/shared/ui/button'
import { AuthLayout } from '../components/AuthLayout'
import { PasswordField } from '../components/PasswordField'
import { Feedback } from '@/features/portal/components/OwnerWorkspaceUI'
import { useApiAction } from '@/features/integration/apiHelpers'
import styles from '../components/AuthForm.module.css'
import pageStyles from './ApiRegisterOwner.module.css'

const steps = ['Owner details', 'Store details', 'Review']
const emptyDraft = { adminFullName: '', adminEmail: '', adminPassword: '', confirmPassword: '', companyName: '', subdomain: '' }

export default function ApiRegisterOwner() {
  const id = useId()
  const session = useDemoSession()
  const [draft, setDraft] = useState(emptyDraft)
  const [step, setStep] = useState(0)
  const [created, setCreated] = useState(null)
  const [stepError, setStepError] = useState('')
  const [availability, setAvailability] = useState(null)
  const [checkAttempt, setCheckAttempt] = useState(0)
  const heading = useRef(null)
  const action = useApiAction()
  const subdomain = draft.subdomain.trim()
  const valid = validSubdomain(subdomain)
  const currentCheck = availability?.subdomain === subdomain ? availability : null

  useEffect(() => {
    if (step !== 1 || !valid || session) return
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const result = await tenantApi.checkSubdomain(subdomain, controller.signal)
        if (!controller.signal.aborted) setAvailability({ subdomain, available: result.available === true, message: result.message })
      } catch (error) {
        if (!controller.signal.aborted) setAvailability({ subdomain, error: error.message })
      }
    }, 400)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [step, subdomain, valid, session, checkAttempt])

  useEffect(() => {
    heading.current?.focus()
  }, [step, created])

  function change(event) {
    const { name, value } = event.target
    setDraft(current => ({ ...current, [name]: name === 'subdomain' ? value.toLowerCase() : value }))
    setStepError('')
    if (name === 'subdomain' && value.toLowerCase().trim() !== subdomain) setAvailability(null)
  }

  function goTo(next) {
    if (next === 1) setAvailability(null)
    setStepError('')
    setStep(next)
  }

  function submit(event) {
    event.preventDefault()
    if (step === 0) {
      if (!draft.adminFullName.trim()) return setStepError('Enter your full name.')
      if (draft.adminPassword.length < 6 || draft.adminPassword.length > 100) return setStepError('Password must contain 6–100 characters.')
      if (draft.adminPassword !== draft.confirmPassword) return setStepError('Passwords do not match.')
      goTo(1)
      return
    }
    if (step === 1) {
      if (!draft.companyName.trim()) return setStepError('Enter your store name.')
      if (currentCheck?.error) {
        setAvailability(null)
        setCheckAttempt(attempt => attempt + 1)
      } else if (currentCheck?.available) {
        goTo(2)
      }
      return
    }

    const email = draft.adminEmail.trim().toLowerCase()
    action.run(async () => {
      const result = await tenantApi.checkSubdomain(subdomain)
      if (!result.available) throw new Error(result.message || 'This subdomain is unavailable. Go back to choose another one.')
      const tenant = await tenantApi.onboard({
        companyName: draft.companyName.trim(),
        subdomain,
        admin_email: email,
        admin_full_name: draft.adminFullName.trim(),
        admin_password: draft.adminPassword,
        plan_type: 'FREE',
      })
      return { subdomain: tenant.subdomain || subdomain, email, website: tenantWebsiteUrl(tenant.tenantUrl) }
    }, 'Your store and Owner account have been created.', result => {
      setCreated(result)
      setDraft(emptyDraft)
    })
  }

  function field(name, label, type, autoComplete, maxLength) {
    return <div className={styles.field}>
      <label htmlFor={`${id}-${name}`}>{label}</label>
      <input id={`${id}-${name}`} className={styles.input} name={name} type={type} required maxLength={maxLength}
        autoComplete={autoComplete} autoCapitalize={type === 'email' ? 'none' : undefined} value={draft[name]} onChange={change} />
    </div>
  }

  const invalidSlug = Boolean(subdomain) && !valid
  const unavailable = currentCheck?.available === false
  const checkMessage = invalidSlug ? 'Use 3–30 lowercase letters, numbers or hyphens.'
    : valid && (currentCheck?.error || (unavailable ? currentCheck.message || 'This subdomain is unavailable.'
      : currentCheck?.available ? 'Subdomain is available.' : 'Checking availability…'))

  if (session) return <Navigate to={session.role === 'SUPER_ADMIN' ? '/admin/tenants' : session.role === 'CUSTOMER' ? '/customer/profile' : '/merchant/shops'} replace />

  return <AuthLayout wide={!created} formCardClassName={created ? '' : pageStyles.card} showInfoCard={false} showBackLink={false}
    footer={<>Already have an account? <Link to="/auth/login?setup=1">Sign in</Link></>}>
    {created ? <div className={styles.container}>
      <div className={styles.intro}>
        <h1 ref={heading} tabIndex={-1}>Your store is ready.</h1>
        <p className={styles.subtitle}>Sign in with the email and password you just registered.</p>
      </div>
      <p className={styles.subtitle}>Store subdomain: <strong>{created.subdomain}</strong></p>
      {created.website && <p className={styles.subtitle}><a href={created.website} target="_blank" rel="noreferrer">Open store website</a></p>}
      <Button asChild className={styles.submit}><Link to="/auth/login?setup=1" state={{ email: created.email }}>Continue to sign in</Link></Button>
    </div> : <div className={pageStyles.wizard}>
      <aside className={pageStyles.sidebar}>
        <p className={pageStyles.title}>Create your tenant account</p>
        <nav aria-label="Owner registration progress">
          <p className={pageStyles.mobileProgress}>Step {step + 1} of {steps.length}</p>
          <ol className={pageStyles.steps}>
            {steps.map((label, index) => (
              <li key={label} aria-current={index === step ? 'step' : undefined} data-complete={index < step}>
                <span className={pageStyles.number} aria-hidden="true">{index < step ? <Check size={16} /> : index + 1}</span>
                <span>{label}</span>
              </li>
            ))}
          </ol>
        </nav>
      </aside>
      <form onSubmit={submit} className={pageStyles.form} aria-label="Tenant account registration">
        <h1 ref={heading} tabIndex={-1}>{steps[step]}</h1>
        <fieldset disabled={action.busy} className={pageStyles.fields}>
          {step === 0 && <>
            {field('adminFullName', 'Full name', 'text', 'name', 100)}
            {field('adminEmail', 'Email address', 'email', 'email', 254)}
            <PasswordField id={`${id}-password`} name="adminPassword" value={draft.adminPassword} onChange={change} />
            <PasswordField id={`${id}-confirmPassword`} name="confirmPassword" label="Confirm password" value={draft.confirmPassword} onChange={change} />
          </>}
          {step === 1 && <>
            {field('companyName', 'Store name', 'text', 'organization', 100)}
            <div className={styles.field}>
              <label htmlFor={`${id}-subdomain`}>Store subdomain</label>
              <input id={`${id}-subdomain`} className={styles.input} name="subdomain" required maxLength={30}
                autoComplete="off" autoCapitalize="none" spellCheck={false} aria-invalid={invalidSlug || unavailable}
                aria-describedby={`${id}-subdomain-hint ${id}-subdomain-status`} value={draft.subdomain} onChange={change} />
              <p id={`${id}-subdomain-hint`} className={styles.hint}>Storefront: /store/{subdomain || 'your-subdomain'}</p>
              <p id={`${id}-subdomain-status`} role="status" className={invalidSlug || unavailable || currentCheck?.error ? styles.error : styles.hint}>{checkMessage}</p>
            </div>
          </>}
          {step === 2 && <dl className={pageStyles.review}>
            <div><dt>Full name</dt><dd>{draft.adminFullName.trim()}</dd></div>
            <div><dt>Email address</dt><dd>{draft.adminEmail.trim().toLowerCase()}</dd></div>
            <div><dt>Store name</dt><dd>{draft.companyName.trim()}</dd></div>
            <div><dt>Store subdomain</dt><dd>{subdomain}</dd></div>
            <div><dt>Plan</dt><dd>Free</dd></div>
          </dl>}
        </fieldset>
        {stepError && <p role="alert" className={styles.error}>{stepError}</p>}
        {step === 2 && <Feedback value={action.feedback} />}
        <div className={pageStyles.actions}>
          {step === 0 ? <Link className={pageStyles.back} to="/auth/register"><ArrowLeft size={16} aria-hidden="true" />Back to Account Type</Link>
            : <button className={pageStyles.back} type="button" onClick={() => goTo(step - 1)} disabled={action.busy}><ArrowLeft size={16} aria-hidden="true" />Back</button>}
          <Button type="submit" disabled={action.busy || (step === 1 && (!currentCheck || unavailable))}>
            {step === 2 ? (action.busy ? 'Creating…' : 'Create account')
              : step === 1 && currentCheck?.error ? 'Try again' : 'Continue'}
          </Button>
        </div>
      </form>
    </div>}
  </AuthLayout>
}
