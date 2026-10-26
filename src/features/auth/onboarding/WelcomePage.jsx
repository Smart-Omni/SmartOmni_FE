import { CheckCircle2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/shared/ui/button'
import { OwnerStep } from '../components/OwnerStep'
import { useOwnerOnboarding } from '../hooks/useOwnerOnboarding'
import stepStyles from '../components/OwnerStep.module.css'
import styles from './WelcomePage.module.css'

export function WelcomePage() {
  const { state, confirmedShops } = useOwnerOnboarding()
  return <OwnerStep title="Welcome to SmartOmni." description="Your workspace is ready for what's next." eyebrow="WELCOME PREVIEW · NO REAL WORKSPACE CREATED">
    <div className={`${stepStyles.card} ${styles.welcome}`}>
      <div className={styles.completion}><CheckCircle2 size={36} aria-hidden="true" /></div>
      <p className={styles.label}>DEMO SETUP REVIEWED</p><h2>{state.ownerInfo.storeName}</h2>
      <p className={styles.address}>{state.ownerInfo.targetDomain}.smartomni.example <span>· Local address preview confirmed · DNS not provisioned</span></p>
      <dl className={styles.summary}>
        <div><dt>Selected plan</dt><dd>{state.selectedPlan} <small>Demo selection</small></dd></div>
        <div><dt>Confirmed demo shops</dt><dd>{confirmedShops.map(shop => <span key={shop.demoKey}>{shop.name}</span>)}</dd></div>
        <div><dt>Initial synchronization</dt><dd>COMPLETED <small>Simulated outcome only</small></dd></div>
      </dl>
      <p className={styles.disclosure}>You have explored the Owner setup flow. No account, Tenant, subscription, marketplace connection, or real product import has been created.</p>
      <Button disabled aria-describedby="dashboard-dependency" className={styles.dashboard}>Go to Dashboard</Button>
      <p id="dashboard-dependency" className={stepStyles.note}>Merchant Dashboard is unavailable in this preview. Real access requires authenticated authorization and all onboarding prerequisites confirmed by the backend.</p>
    </div>
    <div className={stepStyles.actions}><Button asChild variant="outline"><Link to="/auth/register/owner/import">Back</Link></Button></div>
  </OwnerStep>
}
