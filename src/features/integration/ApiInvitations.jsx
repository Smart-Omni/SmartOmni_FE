import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { invitationsApi } from '@/services/api/users'
import { Button } from '@/shared/ui/button'
import { ConfirmationDialog } from './ConfirmationDialog'
import { DataTable, Feedback, OwnerPanel } from '@/features/portal/components/OwnerWorkspaceUI'
import { useApiResource } from './useApiResource'
import { ResourceState } from './ShopeeShared'
import { dateTime, useApiAction } from './apiHelpers'
import styles from '@/features/portal/OwnerWorkspace.module.css'

export default function ApiInvitations({ manage }) {
  const navigate = useNavigate()
  const resource = useApiResource(manage ? invitationsApi.sent : invitationsApi.received)
  const action = useApiAction()
  const [email, setEmail] = useState('')
  const [decision, setDecision] = useState(null)
  const [now, setNow] = useState(() => Date.now())
  const invitations = resource.data || []
  const verbs = { accept: 'Accept', decline: 'Decline', revoke: 'Revoke' }
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(timer)
  }, [])

  function send(event) {
    event.preventDefault()
    action.run(() => invitationsApi.send(email.trim().toLowerCase()), 'Invitation sent.', () => {
      setEmail('')
      resource.reload()
    })
  }

  function decide() {
    const { type, invitation } = decision
    return invitationsApi[type](invitation.id)
  }

  return <OwnerPanel title={manage ? 'Manager invitations' : 'Workspace invitations'}>
    {manage && <form className={styles.form} onSubmit={send}>
      <label className={styles.field}>Manager email address<input type="email" required value={email} disabled={action.busy} onChange={event => setEmail(event.target.value)} /></label>
      <p>Use the email of a Manager account that has not joined a workspace.</p>
      <div className={styles.actions}><Button type="submit" disabled={action.busy}>Send invitation</Button></div>
    </form>}
    <Feedback value={action.feedback} />
    <ResourceState resource={resource} />
    {resource.data && (invitations.length ? <DataTable label={manage ? 'Sent invitations' : 'Received invitations'} headings={[manage ? 'Email' : 'Workspace', 'Status', 'Expires', 'Actions']}>
      {invitations.map(invitation => {
        const pending = invitation.status === 'PENDING' && (!invitation.expiresAt || Date.parse(invitation.expiresAt) > now)
        return <tr key={invitation.id}>
          <td>{manage ? invitation.invitedEmail : invitation.companyName || invitation.subdomain}</td>
          <td>{invitation.status}</td><td>{dateTime(invitation.expiresAt)}</td>
          <td>{pending && <div className={styles.actions}>{(manage ? ['revoke'] : ['accept', 'decline']).map(type =>
            <Button key={type} variant="outline" onClick={() => setDecision({ type, invitation })}>{verbs[type]} invitation</Button>
          )}</div>}</td>
        </tr>
      })}
    </DataTable> : <p>No invitations.</p>)}
    {decision && <ConfirmationDialog
      title={verbs[decision.type] + ' invitation'}
      description={manage ? decision.invitation.invitedEmail : decision.invitation.companyName || decision.invitation.subdomain}
      submit={decide} close={() => setDecision(null)}
      done={() => {
        if (decision.type === 'accept') navigate('/merchant/shops', { replace: true })
        setDecision(null)
        resource.reload()
      }}
    />}
  </OwnerPanel>
}
