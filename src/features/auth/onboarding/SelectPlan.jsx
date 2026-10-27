import { Check, Sparkles } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/shared/ui/button'
import { OwnerStep } from '../components/OwnerStep'
import { useOwnerOnboarding } from '../hooks/useOwnerOnboarding'
import stepStyles from '../components/OwnerStep.module.css'
import styles from './SelectPlan.module.css'

export function SelectPlan() {
  const { state, dispatch } = useOwnerOnboarding()
  const navigate = useNavigate()
  return <OwnerStep title="Choose the plan that fits your store." description="Start with the essentials or explore more ways to grow." eyebrow="WORKSPACE SETUP · STEP 01">
    <fieldset className={styles.plans}><legend className="sr-only">Select your plan</legend>
      {['Free', 'Pro'].map(plan => <label key={plan} className={`${styles.plan} ${state.selectedPlan === plan ? styles.selected : ''}`}>
        <input type="radio" name="plan" aria-label={`${plan} plan`} value={plan} checked={state.selectedPlan === plan} onChange={() => dispatch({ type: 'SELECT_PLAN', plan })} />
        <span className={styles.planTop}><span className={styles.symbol}>{plan === 'Free' ? <Check size={20} aria-hidden="true" /> : <Sparkles size={20} aria-hidden="true" />}</span><span>{state.selectedPlan === plan ? 'Selected' : 'Select plan'}</span></span>
        <strong className={styles.title}>{plan}</strong>
        <span className={styles.subtitle}>{plan === 'Free' ? 'A simple starting point.' : 'Explore your next stage of growth.'}</span>
        <span className={styles.detail}>{plan === 'Free' ? 'Connect up to 1 shop.' : 'Higher-tier plan.'}</span>
        <span className={styles.description}>{plan === 'Free' ? 'One shop in total across Shopee and TikTok Shop, rather than one per marketplace.' : 'Pricing, shop limits, product limits, and staff limits are TBD.'}</span>
        <span className={styles.foot}>{plan === 'Free' ? 'Other plan details remain TBD.' : 'Production entitlements are not finalized.'}</span>
      </label>)}
    </fieldset>
    <p className={stepStyles.note}>This selection is temporary. No subscription or payment is created. Changing plans clears channel and import demo progress.</p>
    <div className={stepStyles.actions}><Button asChild variant="outline"><Link to="/merchant/dashboard">Back to workspace</Link></Button><Button disabled={!state.selectedPlan} onClick={() => navigate('/merchant/setup/channels')}>Continue</Button></div>
  </OwnerStep>
}
