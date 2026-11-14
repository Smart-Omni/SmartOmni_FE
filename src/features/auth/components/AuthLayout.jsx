import { useId } from 'react'
import { ArrowLeft, Boxes, Package, ShoppingBag } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Brand } from '@/shared/components/Brand'
import styles from './AuthLayout.module.css'

const benefits = [
  { icon: Package, title: 'Your products, together.', copy: 'A clearer home for your catalog and SKUs.' },
  { icon: ShoppingBag, title: 'Every order in view.', copy: 'Keep up with orders across your shops.' },
  { icon: Boxes, title: 'Stock with more clarity.', copy: 'See inventory alongside channel sync status.' },
]

export function AuthLayout({ children, footer, footerStart, formCardClassName = '', showBackLink = true, showInfoCard = true, compact = false, wide = false, alignBackBelowInfo = false }) {
  const titleId = useId()
  return <main id="main-content" className={`${styles.page} ${compact ? styles.compact : ''}`} tabIndex={-1}>
    <header className={styles.header}><Brand /></header>
    <div className={`${styles.stack} ${showInfoCard ? '' : styles.standalone} ${wide ? styles.wide : ''} ${alignBackBelowInfo ? styles.balancedFooter : ''}`}>
      {showInfoCard && <aside className={styles.infoCard} aria-labelledby={titleId}>
        <p className={styles.eyebrow}>LESS SWITCHING. MORE CLARITY.</p>
        <h2 id={titleId}>All your shops.<br />One workspace.</h2>
        <p className={styles.description}>Bring your products, orders and inventory into a clearer view.</p>
        <ul className={styles.benefits}>
          {benefits.map(({ icon: Icon, title, copy }) => <li key={title}>
            <Icon size={20} strokeWidth={1.5} aria-hidden="true" />
            <div><strong>{title}</strong><p>{copy}</p></div>
          </li>)}
        </ul>
      </aside>}
      <section className={`${styles.formCard} ${formCardClassName}`} aria-label="Account access">
        <div className={styles.formBody}>
          {children}
          {showBackLink && <Link to="/" className={styles.back}><ArrowLeft size={15} aria-hidden="true" />Back to SmartOmni</Link>}
        </div>
        {footer && (footerStart ? <div className={styles.footerRow}>
          {footerStart}
          <p className={styles.register}>{footer}</p>
        </div> : <p className={styles.register}>{footer}</p>)}
      </section>
      {alignBackBelowInfo && footerStart && <div className={styles.lowerBack}>{footerStart}</div>}
    </div>
  </main>
}
