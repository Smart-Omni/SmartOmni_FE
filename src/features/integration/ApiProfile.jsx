import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usersApi } from '@/services/api/users'
import { authApi } from '@/services/api/auth'
import { clearApiSession, updateApiProfile } from '@/services/api/session'
import { Button } from '@/shared/ui/button'
import { Feedback, OwnerPanel } from '@/features/portal/components/OwnerWorkspaceUI'
import { useApiResource } from './useApiResource'
import { useApiAction } from './apiHelpers'
import { ResourceState } from './ShopeeShared'
import styles from '@/features/portal/OwnerWorkspace.module.css'

export default function ApiProfile() {
  const resource = useApiResource(usersApi.me)
  return <><OwnerPanel title="Personal information"><ResourceState resource={resource} />{resource.data && <ProfileForm key={JSON.stringify(resource.data)} profile={resource.data} />}</OwnerPanel><ChangePassword /></>
}

function ProfileForm({ profile }) {
  const [draft, setDraft] = useState({ full_name: profile.full_name || profile.fullName || '', phone: profile.phone || '', avatar: profile.avatar || '' })
  const action = useApiAction()
  const change = event => setDraft({ ...draft, [event.target.name]: event.target.value })
  function save(event) {
    event.preventDefault()
    const contactOnly = event.nativeEvent.submitter?.value === 'contact'
    action.run(async () => {
      const body = Object.fromEntries(Object.entries(draft).map(([key, value]) => [key, value.trim()]))
      const result = await (contactOnly ? usersApi.patchMe({ phone: body.phone, avatar: body.avatar }) : usersApi.updateMe(body))
      updateApiProfile(result)
      return result
    }, 'Profile saved.')
  }
  return <><p>{profile.email} · {profile.role} · {profile.status}</p><form className={styles.form} onSubmit={save}><fieldset disabled={action.busy} className={styles.form} style={{ border: 0, padding: 0, margin: 0 }}>
    <label className={styles.field}>Full name<input name="full_name" maxLength={100} value={draft.full_name} onChange={change} autoComplete="name" /></label>
    <label className={styles.field}>Phone<input name="phone" type="tel" maxLength={50} value={draft.phone} onChange={change} autoComplete="tel" /></label>
    <label className={styles.field}>Avatar URL<input name="avatar" type="url" maxLength={500} value={draft.avatar} onChange={change} /></label>
    <div className={styles.actions}><Button type="submit">Save profile</Button><Button type="submit" variant="outline" value="contact">Save contact only</Button></div>
  </fieldset><Feedback value={action.feedback} /></form></>
}

function ChangePassword() {
  const [draft, setDraft] = useState({ current_password: '', new_password: '', confirm_password: '' })
  const [done, setDone] = useState(false)
  const action = useApiAction()
  const navigate = useNavigate()
  function submit(event) {
    event.preventDefault()
    action.run(async () => {
      if (draft.new_password !== draft.confirm_password) throw new Error('Passwords do not match.')
      await authApi.changePassword(draft)
      setDraft({ current_password: '', new_password: '', confirm_password: '' }); setDone(true)
    }, 'Password changed. Sign in again to start a new session.')
  }
  return <OwnerPanel title="Change password">{!done && <form className={styles.form} onSubmit={submit}>{[['current_password', 'Current password'], ['new_password', 'New password'], ['confirm_password', 'Confirm new password']].map(([name, label]) => <label key={name} className={styles.field}>{label}<input required type="password" minLength={name === 'current_password' ? undefined : 6} maxLength={100} autoComplete={name === 'current_password' ? 'current-password' : 'new-password'} value={draft[name]} disabled={action.busy} onChange={event => setDraft({ ...draft, [name]: event.target.value })} /></label>)}<Button type="submit" disabled={action.busy}>Change password</Button></form>}<Feedback value={action.feedback} />{done && <Button onClick={() => { clearApiSession(); navigate('/auth/login', { replace: true }) }}>Sign in again</Button>}</OwnerPanel>
}
