import { useState } from 'react'
import { ArrowLeft, ArrowUpRight, Store, Users, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AuthLayout } from '../components/AuthLayout'
import { Button } from '@/shared/ui/button'
import formStyles from '../components/AuthForm.module.css'
import styles from './RegisterPage.module.css'

const roles = [
  { id: 'customer', icon: UserRound, title: "I'm a Customer", description: 'Claim points from your purchases and keep track of your membership rewards.', action: 'Continue as Customer' },
  { id: 'owner', icon: Store, title: "I'm a Store Owner", description: 'Create and manage your own workspace, connect sales channels, and bring your products together.', action: 'Continue as Owner' },
  { id: 'staff', icon: Users, title: "I'm a Team Member", description: 'Create your account and join a workspace when a store owner invites you.', action: 'Continue as Staff' },
]

export function RegisterPage() {
  const [selected, setSelected] = useState(null)
  return <AuthLayout showBackLink={false}
    footerStart={<Link to="/" className={styles.back}><ArrowLeft size={15} aria-hidden="true" />Back to SmartOmni</Link>}
    footer={<>Already have an account? <Link to="/auth/login">Sign in</Link></>}><div className={formStyles.container}>
    <div className={formStyles.intro}>
      <p className={formStyles.eyebrow}>YOUR NEXT CHAPTER</p>
      <h1>How will you use SmartOmni?</h1>
      <p className={formStyles.subtitle}>Choose how you'd like to get started.</p>
    </div>
    <div className={styles.roles}>
      {roles.map(({ id, icon: Icon, title, description, action }) => <section key={id} className={`${styles.card} ${selected === id ? styles.selected : ''}`}>
        <button type="button" className={styles.select} aria-pressed={selected === id} onClick={() => setSelected(id)}>
          <span className={styles.icon}><Icon size={22} aria-hidden="true" /></span>
          <span className={styles.roleCopy}><strong>{title}</strong><span>{description}</span></span>
        </button>
        <Button asChild variant="outline" className={styles.continue}><Link to={`/auth/register/${id}`}>{action}<ArrowUpRight aria-hidden="true" /></Link></Button>
      </section>)}
    </div>
  </div></AuthLayout>
}
