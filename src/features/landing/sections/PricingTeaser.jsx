import { Check, Minus } from 'lucide-react'
import { SectionHeading } from '../components/SectionHeading'
import styles from './PricingTeaser.module.css'

const plans = [
  {
    name: 'Free',
    audience: 'For early-stage sellers',
    features: [
      { label: '1 marketplace platform · 1 shop connection' },
      { label: 'Up to 100 SKUs' },
      { label: 'Standard support' },
      { label: 'No AI models', unavailable: true },
    ],
  },
  {
    name: 'Pro',
    audience: 'For scaling operations',
    featured: true,
    features: [
      { label: 'Shopee + TikTok Shop' },
      { label: 'Unlimited SKUs' },
      { label: '24/7 priority support' },
      { label: 'Full Prophet + Recommendation AI' },
    ],
  },
]

export function PricingTeaser() {
  return <section className={styles.section} id="pricing" aria-labelledby="pricing-title">
    <div className={styles.inner}>
      <SectionHeading className={styles.heading} id="pricing-title" eyebrow="PLANS" title="Start with the plan for your store." description="Choose a plan as you set up your workspace." />
      <div className={styles.grid}>
        {plans.map(({ name, audience, features, featured }) => <article key={name} data-gradient-rim={featured ? '' : undefined} className={`${styles.card} ${featured ? styles.premiumCard : ''}`}>
          <div className={styles.cardTop}>
            <div className={styles.planLabel}><span className={styles.plan}>{name.toUpperCase()}</span>{featured && <span className={styles.bestChoice}>Best choice</span>}</div>
            <span className={styles.planNumber}>0{featured ? 2 : 1}</span>
          </div>
          <h3>{name}</h3>
          <p className={styles.audience}>{audience}</p>
          <div className={styles.divider} />
          <ul className={styles.featureList}>
            {features.map(({ label, unavailable }) => <li key={label} className={unavailable ? styles.unavailable : undefined}>
              {unavailable ? <Minus size={17} aria-hidden="true" /> : <Check size={17} aria-hidden="true" />}
              <span>{label}</span>
            </li>)}
          </ul>
        </article>)}
      </div>
    </div>
  </section>
}
