import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, Clock3, KeyRound, Mail, Pencil, Phone, ShieldCheck } from 'lucide-react'
import { usersApi } from '@/services/api/users'
import { authApi } from '@/services/api/auth'
import { clearApiSession, updateApiProfile } from '@/services/api/session'
import { storefrontImageUrl } from '@/services/api/storefront'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/shared/ui/dialog'
import { Feedback, OwnerPanel } from '@/features/portal/components/OwnerWorkspaceUI'
import { useApiResource } from './useApiResource'
import { dateTime, useApiAction } from './apiHelpers'
import { ResourceState } from './ShopeeShared'
import form from '@/features/portal/OwnerWorkspace.module.css'
import styles from './ApiProfile.module.css'

export default function ApiProfile({ session }) {
  const resource = useApiResource(usersApi.me)
  if (!resource.data) return <OwnerPanel title="Your profile"><ResourceState resource={resource} /></OwnerPanel>
  return <ProfileView initialProfile={resource.data} session={session} />
}

function ProfileView({ initialProfile, session }) {
  const [profile, setProfile] = useState(initialProfile)
  const [saved, setSaved] = useState(false)
  const name = profile.full_name || profile.fullName || profile.email
  const image = storefrontImageUrl(profile.avatar)
  const tenant = profile.subdomain || session.tenantName
  const overview = [
    [ShieldCheck, 'Account status', profile.status],
    [CalendarDays, 'Member since', profile.created_at && dateTime(profile.created_at)],
    [Clock3, 'Profile updated', profile.updated_at && dateTime(profile.updated_at)],
  ].filter(([, , value]) => value)

  return <div className={styles.profile}>
    <section className={styles.hero} aria-labelledby="profile-name">
      <div className={styles.cover} aria-hidden="true" />
      <div className={styles.identity}>
        <ProfileAvatar key={image} name={name} image={image} />
        <div className={styles.identityText}>
          <h1 id="profile-name">{name}</h1>
          <p>{session.roleLabel || profile.role}{tenant && <><span aria-hidden="true">·</span>{tenant}</>}</p>
        </div>
        <ProfileEditor profile={profile} onSaved={result => {
          updateApiProfile(result)
          setProfile(result)
          setSaved(true)
        }} onOpen={() => setSaved(false)} />
      </div>
      {saved && <div className={styles.saved}><Feedback value={{ message: 'Profile saved.' }} /></div>}
    </section>
    <div className={styles.columns}>
      <OwnerPanel title="Personal information">
        <dl className={styles.contact}>
          <div><Mail size={17} aria-hidden="true" /><div><dt>Email address</dt><dd>{profile.email}</dd></div></div>
          <div><Phone size={17} aria-hidden="true" /><div><dt>Phone</dt><dd>{profile.phone || 'Add a phone number'}</dd></div></div>
        </dl>
      </OwnerPanel>
      <OwnerPanel title="Account overview">
        {overview.length > 0 && <dl className={styles.overview}>
          {overview.map(([Icon, label, value]) => <div key={label}>
            <Icon size={17} aria-hidden="true" />
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>)}
        </dl>}
        <div className={styles.security}>
          <KeyRound size={18} aria-hidden="true" />
          <h3>Password</h3>
          <ChangePassword />
        </div>
      </OwnerPanel>
    </div>
  </div>
}

function ProfileAvatar({ image, name }) {
  const [failed, setFailed] = useState(false)
  const initials = String(name || '').trim().split(/\s+/).slice(0, 2).map(part => Array.from(part)[0]).join('').toUpperCase()
  return <span className={styles.avatar} aria-hidden="true">
    {image && !failed ? <img src={image} alt="" onError={() => setFailed(true)} referrerPolicy="no-referrer" /> : initials}
  </span>
}

function ProfileEditor({ profile, onOpen, onSaved }) {
  const [open, setOpen] = useState(false)
  const action = useApiAction()
  return <Dialog open={open} onOpenChange={value => {
    if (action.busy) return
    if (value) onOpen()
    setOpen(value)
  }}>
    <DialogTrigger asChild>
      <Button className={styles.editButton} variant="outline"><Pencil size={15} />Edit profile</Button>
    </DialogTrigger>
    <DialogContent className={form.dialog} showCloseButton={!action.busy}>
      <DialogTitle>Edit profile</DialogTitle>
      <DialogDescription>Update your name, phone number or avatar.</DialogDescription>
      {open && <ProfileForm profile={profile} action={action} onSaved={result => { onSaved(result); setOpen(false) }} close={() => setOpen(false)} />}
    </DialogContent>
  </Dialog>
}

function ProfileForm({ profile, action, onSaved, close }) {
  const [draft, setDraft] = useState({ full_name: profile.full_name || profile.fullName || '', phone: profile.phone || '', avatar: profile.avatar || '' })
  const change = event => setDraft({ ...draft, [event.target.name]: event.target.value })
  const [attempted, setAttempted] = useState(false)
  function save(event) {
    event.preventDefault()
    setAttempted(true)
    const contactOnly = event.nativeEvent.submitter?.value === 'contact'
    const body = Object.fromEntries(Object.entries(draft).map(([key, value]) => [key, value.trim()]))
    action.run(() => contactOnly ? usersApi.patchMe({ phone: body.phone, avatar: body.avatar }) : usersApi.updateMe(body), 'Profile saved.', onSaved)
  }
  return <form className={form.form} onSubmit={save}>
    <fieldset disabled={action.busy} className={`${form.form} ${styles.fields}`}>
      <label className={form.field}>Full name<input name="full_name" maxLength={100} value={draft.full_name} onChange={change} autoComplete="name" /></label>
      <label className={form.field}>Phone<input name="phone" type="tel" maxLength={50} value={draft.phone} onChange={change} autoComplete="tel" /></label>
      <label className={form.field}>Avatar URL<input name="avatar" type="url" maxLength={500} value={draft.avatar} onChange={change} /></label>
      <div className={form.actions}>
        <Button type="submit">{action.busy ? 'Saving…' : 'Save profile'}</Button>
        <Button type="submit" variant="outline" value="contact">Save contact only</Button>
        <Button type="button" variant="ghost" onClick={close}>Cancel</Button>
      </div>
    </fieldset>
    {attempted && <Feedback value={action.feedback} />}
  </form>
}

function ChangePassword() {
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState(false)
  const action = useApiAction()
  const navigate = useNavigate()

  function signIn() {
    clearApiSession()
    navigate('/auth/login', { replace: true })
  }

  return <Dialog open={open} onOpenChange={value => { if (!action.busy) setOpen(value) }}>
    <DialogTrigger asChild><Button variant="outline">{done ? 'Finish password change' : 'Change password'}</Button></DialogTrigger>
    <DialogContent className={form.dialog} showCloseButton={!action.busy}>
      <DialogTitle>{done ? 'Password changed' : 'Change password'}</DialogTitle>
      <DialogDescription>{done ? 'Sign in again to start a new session.' : 'Enter your current password and choose a new one.'}</DialogDescription>
      {done
        ? <div className={form.actions}><Button onClick={signIn}>Sign in again</Button></div>
        : open && <PasswordForm action={action} onSaved={() => setDone(true)} />}
    </DialogContent>
  </Dialog>
}

function PasswordForm({ action, onSaved }) {
  const [draft, setDraft] = useState({ current_password: '', new_password: '', confirm_password: '' })
  const [attempted, setAttempted] = useState(false)
  function submit(event) {
    event.preventDefault()
    setAttempted(true)
    action.run(async () => {
      if (draft.new_password !== draft.confirm_password) throw new Error('Passwords do not match.')
      await authApi.changePassword(draft)
    }, 'Password changed.', onSaved)
  }
  return <form className={form.form} onSubmit={submit}>
    {[
      ['current_password', 'Current password'], ['new_password', 'New password'], ['confirm_password', 'Confirm new password'],
    ].map(([name, label]) => <label key={name} className={form.field}>{label}
      <input required type="password" minLength={name === 'current_password' ? undefined : 6} maxLength={100}
        autoComplete={name === 'current_password' ? 'current-password' : 'new-password'}
        value={draft[name]} disabled={action.busy} onChange={event => setDraft({ ...draft, [name]: event.target.value })} />
    </label>)}
    <div className={form.actions}><Button type="submit" disabled={action.busy}>{action.busy ? 'Changing…' : 'Change password'}</Button></div>
    {attempted && <Feedback value={action.feedback} />}
  </form>
}
