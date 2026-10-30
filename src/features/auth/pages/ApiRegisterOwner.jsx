import { useId, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useDemoSession } from '../hooks/useDemoSession'
import { tenantApi } from '@/services/api/tenant'
import { Button } from '@/shared/ui/button'
import { AuthLayout } from '../components/AuthLayout'
import { PasswordField } from '../components/PasswordField'
import { Feedback } from '@/features/portal/components/OwnerWorkspaceUI'
import { useApiAction } from '@/features/integration/apiHelpers'
import styles from '../components/AuthForm.module.css'
import pageStyles from './StaffRegisterPage.module.css'

export default function ApiRegisterOwner() {
  const id = useId()
  const session = useDemoSession()
  const [draft, setDraft] = useState({ adminFullName: '', adminEmail: '', adminPassword: '', confirmPassword: '', companyName: '', subdomain: '' })
  const [created, setCreated] = useState(null)
  const [checkedSubdomain, setCheckedSubdomain] = useState('')
  const action = useApiAction()
  const checkAction = useApiAction()
  const busy = action.busy || checkAction.busy
  const subdomain = draft.subdomain.trim().toLowerCase()
  const change = event => setDraft({ ...draft, [event.target.name]: event.target.value })
  function validSubdomain() {
    if (!/^[a-z0-9-]{3,30}$/.test(subdomain)) throw new Error('Use 3–30 lowercase letters, numbers or hyphens for your subdomain.')
    return subdomain
  }
  function check() {
    setCheckedSubdomain(subdomain)
    checkAction.run(() => tenantApi.checkSubdomain(validSubdomain()), result => result.available === true ? 'Availability check passed. Final availability is confirmed when your store is created.' : result.message || 'This subdomain is unavailable.')
  }
  function submit(event) {
    event.preventDefault()
    action.run(async () => {
      if (!draft.adminFullName.trim() || !draft.companyName.trim()) throw new Error('Enter your full name and store name.')
      if (draft.adminPassword.length < 6 || draft.adminPassword.length > 100) throw new Error('Password must contain 6–100 characters.')
      if (draft.adminPassword !== draft.confirmPassword) throw new Error('Passwords do not match.')
      const value = validSubdomain()
      // Availability is advisory; the create endpoint still checks duplicates transactionally.
      const availability = await tenantApi.checkSubdomain(value)
      if (availability.available !== true) throw new Error(availability.message || 'This subdomain is unavailable.')
      const body = { companyName: draft.companyName.trim(), subdomain: value, adminEmail: draft.adminEmail.trim().toLowerCase(), adminFullName: draft.adminFullName.trim(), adminPassword: draft.adminPassword, planType: 'FREE' }
      const tenant = await tenantApi.onboard(body)
      return { subdomain: tenant.subdomain || value, email: body.adminEmail }
    }, 'Your store and Owner account have been created.', result => {
      setCreated(result)
      setDraft({ adminFullName: '', adminEmail: '', adminPassword: '', confirmPassword: '', companyName: '', subdomain: '' })
    })
  }
  if (session) return <Navigate to={session.role === 'SUPER_ADMIN' ? '/admin/tenants' : session.role === 'CUSTOMER' ? '/customer/profile' : '/merchant/shops'} replace />
  return <AuthLayout compact showInfoCard={false} showBackLink={false} footer={<>Already have an account? <Link to="/auth/login?setup=1">Sign in</Link></>}>
    <div className={`${styles.container} ${pageStyles.container}`}>
      <div className={styles.intro}><p className={styles.eyebrow}>TENANT OWNER ACCOUNT</p><h1>{created ? 'Your store is ready.' : 'Create your tenant account.'}</h1><p className={styles.subtitle}>{created ? 'Sign in with the email and password you just registered.' : 'Create your Owner account and choose a unique subdomain for your store.'}</p></div>
      {created ? <><Feedback value={action.feedback} /><p className={styles.subtitle}>Store subdomain: <strong>{created.subdomain}</strong></p><Button asChild className={styles.submit}><Link to="/auth/login?setup=1" state={{ email: created.email }}>Continue to sign in</Link></Button></> : <form onSubmit={submit} aria-label="Tenant account registration">
        <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          {[
            ['adminFullName', 'Full name', 'text', 'name', 100], ['adminEmail', 'Email address', 'email', 'email', 254],
            ['companyName', 'Store name', 'text', 'organization', 100], ['subdomain', 'Store subdomain', 'text', 'off', 30],
          ].map(([name, label, type, autoComplete, maxLength]) => <div className={styles.field} key={name}><label htmlFor={`${id}-${name}`}>{label}</label><input id={`${id}-${name}`} className={styles.input} name={name} type={type} required maxLength={maxLength} autoComplete={autoComplete} autoCapitalize={['adminEmail', 'subdomain'].includes(name) ? 'none' : undefined} spellCheck={name === 'subdomain' ? false : undefined} value={draft[name]} onChange={name === 'subdomain' ? event => setDraft({ ...draft, subdomain: event.target.value.toLowerCase() }) : change} /></div>)}
          <p className={styles.hint}>Use 3–30 lowercase letters, numbers or hyphens. Your storefront will be available at /store/{subdomain || 'your-subdomain'}.</p>
          <Button type="button" variant="outline" onClick={check}>Check subdomain</Button>
          {checkedSubdomain === subdomain && <Feedback value={checkAction.feedback} />}
          <PasswordField id={`${id}-password`} name="adminPassword" value={draft.adminPassword} onChange={change} />
          <PasswordField id={`${id}-confirmPassword`} name="confirmPassword" label="Confirm password" value={draft.confirmPassword} onChange={change} />
          <p className={styles.hint}>Your workspace starts on the Free plan.</p>
          <Button className={styles.submit} type="submit">{action.busy ? 'Creating…' : 'Create Owner account and store'}</Button>
        </fieldset>
        <Feedback value={action.feedback} />
        <Link className={pageStyles.back} to="/auth/register">Back to Account Type</Link>
      </form>}
    </div>
  </AuthLayout>
}
