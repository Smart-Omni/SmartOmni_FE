import { useEffect, useRef } from 'react'
import { Check, Link2, PackageSearch, ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AuthActions } from '../components/TrialButton'
import { DashboardPreview } from '../components/DashboardPreview'
import { MarketplaceLogo } from '@/shared/components/MarketplaceLogo'
import { HeroConnection } from '../components/HeroConnection'
import styles from './Hero.module.css'

export function Hero() {
  const stageRef = useRef(null)
  const introRef = useRef(null)

  useEffect(() => {
    const intro = introRef.current
    const lead = intro.querySelector('[data-hero-lead]')
    const alignHands = () => {
      const title = lead.getBoundingClientRect()
      intro.style.setProperty('--hero-hand-y', `${title.top - intro.getBoundingClientRect().top + title.height / 2}px`)
    }
    const observer = new ResizeObserver(alignHands)
    observer.observe(intro)
    observer.observe(lead)
    alignHands()
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const stage = stageRef.current
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const pointer = window.matchMedia('(pointer: fine)')
    if (!stage || motion.matches || !pointer.matches) return
    let frame = 0
    const move = (event) => {
      const rect = stage.getBoundingClientRect()
      const x = (event.clientX - rect.left) / rect.width - .5
      const y = (event.clientY - rect.top) / rect.height - .5
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        stage.style.setProperty('--tilt-x', `${(-y * 2.5).toFixed(2)}deg`)
        stage.style.setProperty('--tilt-y', `${(x * 3).toFixed(2)}deg`)
      })
    }
    const reset = () => { stage.style.setProperty('--tilt-x', '0deg'); stage.style.setProperty('--tilt-y', '0deg') }
    stage.addEventListener('pointermove', move)
    stage.addEventListener('pointerleave', reset)
    return () => { cancelAnimationFrame(frame); stage.removeEventListener('pointermove', move); stage.removeEventListener('pointerleave', reset) }
  }, [])

  return <section className={styles.hero} id="product" aria-labelledby="hero-title">
    <span className={styles.sentinel} data-page-top aria-hidden="true" />
    <div className={styles.intro} ref={introRef}>
      <HeroConnection />
      <div className={styles.copy}>
        <p className={styles.eyebrow}><span /> MULTI-CHANNEL, MADE CLEAR</p>
        <h1 id="hero-title"><span data-hero-lead>One workspace</span><br /> for every sales channel.</h1>
        <p className={styles.subtitle}>Connect Shopee and TikTok Shop, sync your products, manage orders and inventory, and run your store from one unified workspace.</p>
        <AuthActions />
        <p className={styles.context}>Built for merchants selling on <strong>Shopee</strong> and <strong>TikTok Shop</strong>.</p>
        <p className={styles.shopEntry}>Here to shop? <Link to="/stores">Explore stores <ArrowUpRight size={15} aria-hidden="true" /></Link></p>
      </div>
    </div>
    <div className={styles.stage} ref={stageRef} aria-label="Illustrative SmartOmni dashboard with products and marketplace listings">
      <div className={styles.stageInner}>
        <span className={styles.orbit} aria-hidden="true" />
        <DashboardPreview className={styles.dashboard} />
        <div className={styles.listingCard} aria-hidden="true">
          <span className={styles.miniIcon}><Link2 size={16} /></span>
          <span><small>CHANNEL LISTINGS</small><strong>One SKU, two shops</strong><em><MarketplaceLogo marketplace="shopee" size={16} decorative /> Shopee <b>+</b> <MarketplaceLogo marketplace="tiktok" size={16} decorative /> TikTok Shop</em></span>
        </div>
        <div className={styles.mappingCard} aria-hidden="true">
          <span className={styles.miniIcon}><PackageSearch size={16} /></span>
          <span><small>MAPPING REVIEW</small><strong>Catalog stays organized</strong><em><Check size={13} /> 3 mapped · 1 to review</em></span>
        </div>
      </div>
    </div>
  </section>
}
