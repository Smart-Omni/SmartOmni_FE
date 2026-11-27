import { SectionHeading } from '../components/SectionHeading'
import styles from './Features.module.css'

const features = [
  { title: 'Catalog & SKU', copy: 'Keep your products, variants and marketplace listings together.', image: '/images/features/catalog.jpg' },
  { title: 'Orders', copy: 'Find orders across connected shops in one operational view.', image: '/images/features/orders.jpg' },
  { title: 'Inventory', copy: 'See product quantities with their marketplace sync status.', image: '/images/features/inventory.jpg' },
  { title: 'Manager & Permissions', copy: 'Invite your team into the workspace with assigned access.', image: '/images/features/team.jpg' },
]

export function Features() {
  return <section className={styles.section} id="features" aria-labelledby="features-title">
    <div className={styles.inner}>
      <SectionHeading className={styles.heading} id="features-title" eyebrow="CORE CAPABILITIES" title="The essentials, in one place." description="A focused workspace for the products, people and operations behind your sales channels." />
      <div className={styles.list}>
        {features.map(({ title, copy, image }, index) => <article className={styles.feature} key={title}>
          <div className={styles.content}>
            <h3>{title}</h3>
            <p>{copy}</p>
          </div>
          <span className={styles.number} style={{ backgroundImage: `url(${image})` }} aria-hidden="true">
            {String(index + 1).padStart(2, '0')}
          </span>
        </article>)}
      </div>
    </div>
  </section>
}
