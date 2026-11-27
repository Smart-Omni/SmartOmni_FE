import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/shared/ui/button'
import { acceptManagerInvitation, useTeam } from './lib/merchantStore'
import styles from './StoreSettings.module.css'

export default function ManagerInvitations({ session }) {
  const team = useTeam()
  const [feedback, setFeedback] = useState(null)
  const pending = team.filter(item => item.email === session.email && item.status === 'INVITED')
  return <section className={styles.panel}><h2>Workspace invitations</h2>
    {!pending.length && <p>{session.membershipStatus === 'ACTIVE' ? 'Your workspace membership is active.' : 'No workspace invitations yet.'}</p>}
    {pending.map(item => <div key={item.id} className={styles.member}><strong>Everyday Studio</strong><p>Invited as Tenant Manager · {item.permissions.map(id => id.replace(':read', '')).join(', ')} (read only)</p><div className={styles.actions}><Button onClick={() => { try { acceptManagerInvitation(item.id); setFeedback({ message: 'Invitation accepted in demo.' }) } catch (error) { setFeedback({ error: true, message: error.message }) } }}>Accept demo invitation</Button></div></div>)}
    {feedback && <p role={feedback.error ? 'alert' : 'status'} className={feedback.error ? styles.error : ''}>{feedback.message}</p>}
    {session.membershipStatus === 'ACTIVE' && <Button asChild variant="outline"><Link to="/merchant/dashboard">Open workspace</Link></Button>}
    <p>Invitations are simulated in this browser. No invitation email has been sent.</p>
  </section>
}
