import { useId, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/shared/ui/button'
import { FormField } from '../components/FormField'
import { PasswordField } from '../components/PasswordField'
import { OwnerStep } from '../components/OwnerStep'
import { useOwnerOnboarding } from '../hooks/useOwnerOnboarding'
import { useValidatedForm } from '../hooks/useValidatedForm'
import stepStyles from '../components/OwnerStep.module.css'
import styles from './OwnerBasicInfo.module.css'
import { demoDomainIssue } from '../lib/demoDomain'

export function OwnerBasicInfo() {
  const { state, dispatch } = useOwnerOnboarding()
  const navigate = useNavigate()
  const id = useId()
  const [domainPreview, setDomainPreview] = useState(null)
  const form = useValidatedForm({ ...state.ownerInfo, password: '', confirmPassword: '' })
  const field = (name, label, extra = {}) => <FormField name={name} label={label} value={form.values[name]} error={form.errors[name]} onChange={form.change} onBlur={form.blur} {...extra} />
  function submit(event) {
    if (!form.check(event)) return
    const { fullName, email, storeName, targetDomain } = form.values
    dispatch({ type: 'SAVE_INFO', info: { fullName, email, storeName, targetDomain } })
    form.clearCredentials()
    navigate('/auth/register/owner/plan')
  }
  return <OwnerStep title="Let's set up your workspace." description="Start with a few details about you and your store." eyebrow="TENANT OWNER · STEP 01">
    <form className={stepStyles.card} noValidate onSubmit={submit} aria-label="Owner basic information">
      <fieldset className={styles.group}><legend>Personal information</legend><div className={stepStyles.twoColumns}>
        {field('fullName', 'Full name', { autoComplete: 'name', placeholder: 'Your full name' })}
        {field('email', 'Email address', { type: 'email', autoComplete: 'email', placeholder: 'you@example.com' })}
      </div></fieldset>
      <fieldset className={styles.group}><legend>Store information</legend><div className={stepStyles.twoColumns}>
        {field('storeName', 'Store name', { autoComplete: 'organization', placeholder: 'Your store name' })}
        {field('targetDomain', 'Target Domain', { autoComplete: 'off', placeholder: 'your-store', hint: '3–63 lowercase letters, numbers or hyphens. This preview does not reserve DNS.' })}
      </div></fieldset>
      <section className={styles.domainPreview} aria-label="Store address setup"><h2>Set up your store address</h2><p>{form.values.targetDomain.trim() || 'your-store'}.smartomni.example</p><Button type="button" variant="outline" onClick={() => { const error = demoDomainIssue(form.values.targetDomain); setDomainPreview({ value: form.values.targetDomain, error }) }}>Check demo availability</Button>{domainPreview?.value === form.values.targetDomain && <p role={domainPreview.error ? 'alert' : 'status'}>{domainPreview.error || 'Available in this demo. Continuing confirms this address for your setup preview.'}</p>}<p>Availability uses reserved names and local demo tenants. The address is an example; registration and DNS provisioning require a backend.</p></section>
      <fieldset className={styles.group}><legend>Account security</legend><div className={stepStyles.twoColumns}>
        <PasswordField id={`${id}-password`} value={form.values.password} error={form.errors.password} onChange={form.change} onBlur={form.blur} />
        <PasswordField id={`${id}-confirm`} name="confirmPassword" label="Confirm password" value={form.values.confirmPassword} error={form.errors.confirmPassword} onChange={form.change} onBlur={form.blur} />
      </div></fieldset>
      <p className={stepStyles.note}>Continue explores the next demo step. Credentials are not sent or saved. Returning here requires entering your password again.</p>
      <div className={stepStyles.actions}><Button asChild variant="outline"><Link to="/auth/register">Back</Link></Button><Button type="submit">Continue to Plans</Button></div>
    </form>
  </OwnerStep>
}
