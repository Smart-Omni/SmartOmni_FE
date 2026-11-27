import { SectionHeading } from '../components/SectionHeading'
import styles from './HowItWorks.module.css'

const steps = [
  ['Create your workspace and select a plan', 'Start with a space for your store.'],
  ['Connect and confirm your marketplace shop', 'Choose the shop you want to bring in.'],
  ['Complete the initial product sync', 'Finish the first catalog sync.'],
  ['Enter your dashboard', 'Work with your connected store information.'],
  ['Invite your team', 'Bring managers into the workspace.'],
]

export function HowItWorks() {
  return <section className={styles.section} id="how-it-works" aria-labelledby="how-title">
    <div className={styles.inner}>
      <SectionHeading id="how-title" eyebrow="HOW IT WORKS" title="From first connection to a clearer day." description="A straightforward path from creating your workspace to working with your team." />
      <ol className={styles.steps}>
        {steps.map(([title, copy], index) => <li className={styles.step} key={title}>
          <span className={styles.number}>{String(index + 1).padStart(2, '0')}</span>
          <div><h3>{title}</h3><p>{copy}</p></div>
        </li>)}
      </ol>
    </div>
  </section>
}
