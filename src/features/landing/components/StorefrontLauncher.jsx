import { ArrowUpRight, Store } from 'lucide-react'
import { Link } from 'react-router-dom'
import styles from './StorefrontLauncher.module.css'

export function StorefrontLauncher() {
  return <Link to="/stores" className={styles.launcher} aria-label="Visit storefront">
    <span className={styles.label}>Visit storefront <ArrowUpRight size={16} aria-hidden="true" /></span>
    <span className={styles.bubble}>
      <span className={styles.aura} aria-hidden="true" />
      <Store size={26} strokeWidth={1.8} aria-hidden="true" />
    </span>
  </Link>
}
