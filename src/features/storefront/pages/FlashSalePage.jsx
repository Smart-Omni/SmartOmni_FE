import { useState } from 'react'
import { Link, useOutletContext, useSearchParams } from 'react-router-dom'
import { ArrowRight, Bell, Check, ChevronDown, ChevronRight, Star, Truck, Zap } from 'lucide-react'
import { DropdownMenu } from 'radix-ui'
import { Button } from '@/shared/ui/button'
import { discoveryCategories, formatPrice, matchesCategory } from '../data/catalog'
import { saleProducts as allSaleProducts } from '../data/flashSale'
import { StorefrontBenefits } from '../components/StorefrontDiscovery'
import { SaveProductButton } from '../components/SaveProductButton'
import { useDealCountdown } from '../components/useDealCountdown'
import shared from '../Storefront.module.css'
import styles from './FlashSalePage.module.css'

const sessions = [['now', 'Now', 'Live deals'], ['12', '12:00', 'Coming up'], ['15', '15:00', 'Coming up'], ['18', '18:00', 'Coming up'], ['21', '21:00', 'Tonight’s picks']]
const sorts = [['discount', 'Biggest discount'], ['price', 'Price: low to high'], ['price-desc', 'Price: high to low']]

export function FlashSalePage() {
  const { base, products } = useOutletContext()
  const saleProducts = allSaleProducts.filter(product => products.some(item => item.id === product.id))
  const categories = discoveryCategories.filter(category => category.id !== 'all' && saleProducts.some(product => matchesCategory(product, category.id)))
  const [params, setParams] = useSearchParams()
  const [reminders, setReminders] = useState([])
  const { remaining, time } = useDealCountdown()
  const session = sessions.find(([id]) => id === params.get('session')) || sessions[0]
  const category = categories.some(item => item.id === params.get('category')) ? params.get('category') : 'all'
  const sort = sorts.find(([id]) => id === params.get('sort')) || sorts[0]
  const upcoming = session[0] !== 'now'
  function update(values) {
    const next = new URLSearchParams(params)
    Object.entries(values).forEach(([key, value]) => { if (!value) next.delete(key); else next.set(key, value) })
    setParams(next, { preventScrollReset: true })
  }
  const items = saleProducts.filter(product => matchesCategory(product, category)).sort((a, b) => sort[0] === 'price' ? a.price - b.price : sort[0] === 'price-desc' ? b.price - a.price : b.discount - a.discount)
  const toggleReminder = key => setReminders(current => current.includes(key) ? current.filter(id => id !== key) : [...current, key])
  return <div className={styles.page}><main id="main-content" className={styles.main} tabIndex={-1}>
    <nav className={styles.breadcrumb} aria-label="Breadcrumb"><Link to={base}>Home</Link><ChevronRight size={12} aria-hidden="true" /><span>Flash Sale</span></nav>
    <div className={styles.heading}><h1><Zap size={24} fill="currentColor" aria-hidden="true" />FLASH SALE</h1><div className={styles.timerWrap}><span>{upcoming ? `Next session at ${session[1]}` : 'These deals won’t wait'}</span>{!upcoming && <><small>{remaining ? 'ENDS IN' : 'ENDED'}</small><div className={styles.timer} role="timer" aria-label="Time remaining for sample deals">{time.map((value, index) => <b key={index}>{value}</b>)}</div></>}</div></div>
    <section className={styles.hero} aria-label="Flash sale promotion"><div><span className={styles.eyebrow}>BIG FINDS. SMALL PRICES.</span><h2>Good timing.<br />Even better deals.</h2><p>Everyday favorites at prices worth catching.</p><a href="#sale-products">Explore the deals <ArrowRight size={16} aria-hidden="true" /></a></div><div className={styles.heroArt}><Zap size={110} strokeWidth={1} aria-hidden="true" /><span>UP TO<strong>50%</strong>OFF SELECTED FINDS</span></div></section>
    <div className={styles.sessions} role="group" aria-label="Flash sale sessions">{sessions.map(([id, label, detail]) => <button key={id} aria-pressed={session[0] === id} onClick={() => update({ session: id === 'now' ? '' : id })}><strong>{label}</strong><span>{detail}</span></button>)}</div>
    <div className={styles.categories} role="group" aria-label="Sale categories"><button aria-pressed={category === 'all'} onClick={() => update({ category: '' })}>All</button>{categories.map(item => <button key={item.id} aria-pressed={category === item.id} onClick={() => update({ category: item.id })}>{item.name}</button>)}</div>
    <div id="sale-products" className={styles.toolbar}><p role="status">{items.length} deals · {upcoming ? `Preview for ${session[1]}` : remaining ? 'Live now' : 'Session ended'}</p><div><span>Sort by</span><DropdownMenu.Root><DropdownMenu.Trigger asChild><Button variant="outline" className={styles.sortButton} aria-label="Sort deals">{sort[1]}<ChevronDown size={12} aria-hidden="true" /></Button></DropdownMenu.Trigger><DropdownMenu.Portal><DropdownMenu.Content className={shared.sortMenu} align="end" sideOffset={6}>{sorts.map(([id, label]) => <DropdownMenu.Item key={id} className={shared.sortOption} onSelect={() => update({ sort: id === 'discount' ? '' : id })} aria-current={sort[0] === id ? 'true' : undefined}>{label}</DropdownMenu.Item>)}</DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu.Root></div></div>
    {upcoming && <p className={styles.previewNote}>Preview session. Reminders are kept for this visit; no notifications are sent.</p>}
    <section className={styles.grid} aria-label="Sale products">{items.map(product => {
      const key = `${session[0]}-${product.id}`
      const reminded = reminders.includes(key)
      return <article className={styles.card} key={product.id}>
        <div className={styles.image}><Link to={`${base}/products/${product.id}`} aria-label={`View ${product.name}`}><img src={product.image} alt={product.name} loading="lazy" className={product.imageMode === 'contain' ? styles.contain : ''} /></Link><span className={styles.discount}>−{product.discount}%</span><SaveProductButton product={product} compact /><span className={styles.shipping}><Truck size={11} aria-hidden="true" />Marketplace offer</span></div>
        <div className={styles.copy}><h2><Link to={`${base}/products/${product.id}`}>{product.name}</Link></h2><p className={styles.price}>{formatPrice(product.price)}</p><p className={styles.savings}>{product.discount}% off <del>{formatPrice(product.original)}</del></p><div className={styles.rating}><span><Star size={11} fill="currentColor" aria-hidden="true" />{product.rating}</span><span>{product.sold.toLocaleString('en-US')} sold</span></div><p className={styles.location}>{product.location}</p></div>
        <div className={styles.actions}><div className={styles.stock} style={{ '--progress': `${upcoming ? 0 : product.progress}%` }} role="progressbar" aria-label={`${product.name} sample stock sold`} aria-valuenow={upcoming ? 0 : product.progress} aria-valuemin={0} aria-valuemax={100} aria-valuetext={upcoming ? 'Coming soon' : `${product.progress}% sold`}><span><strong>{upcoming ? '—' : `${product.progress}%`}</strong><small>{upcoming ? 'SOON' : 'SOLD'}</small></span></div>{upcoming ? <button aria-pressed={reminded} onClick={() => toggleReminder(key)}>{reminded ? <Check size={12} /> : <Bell size={12} />}{reminded ? 'Saved' : 'Remind me'}</button> : <Link to={`${base}/products/${product.id}`}>{remaining ? 'Shop now' : 'View product'}<ChevronRight size={12} aria-hidden="true" /></Link>}</div>
      </article>
    })}</section>
    <p className={styles.sampleNote}>Illustrative promotions, ratings and sales counts. Final prices and availability are confirmed on the marketplace.</p>
    <StorefrontBenefits />
  </main></div>
}
