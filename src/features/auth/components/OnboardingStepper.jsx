import { Check } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ownerSteps } from '../data/onboardingContent'
import styles from './OnboardingStepper.module.css'

export function OnboardingStepper({ current, allowed }) {
  return <nav className={styles.stepper} aria-label="Owner onboarding progress">
    <div className={styles.compact}><span>Step {current + 1} of {ownerSteps.length}</span><strong>{ownerSteps[current].label}</strong></div>
    <div className={styles.rail} role="progressbar" aria-label="Onboarding step" aria-valuemin={1} aria-valuemax={ownerSteps.length} aria-valuenow={current + 1} aria-valuetext={`Step ${current + 1}: ${ownerSteps[current].label}`}>
      <span style={{ width: `${(current + 1) * 100 / ownerSteps.length}%` }} />
    </div>
    <ol>{ownerSteps.map((step, index) => <li key={step.path} className={`${index === current ? styles.current : ''} ${index < current ? styles.done : ''}`}>
      {index <= allowed ? <Link to={step.path} aria-current={index === current ? 'step' : undefined}>
        <span className={styles.number}>{index < current ? <Check size={16} aria-hidden="true" /> : index + 1}</span><span>{step.label}</span>
      </Link> : <span className={styles.locked}><span className={styles.number}>{index + 1}</span><span>{step.label}</span></span>}
    </li>)}</ol>
  </nav>
}
