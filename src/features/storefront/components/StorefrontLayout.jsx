import { StorefrontHeader } from './StorefrontHeader'
import { Link, Outlet, useParams } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { Brand } from '@/shared/components/Brand'
import { Button } from '@/shared/ui/button'
import { categories, discoveryCategories, matchesCategory, products } from '../data/catalog'
import styles from '../Storefront.module.css'
import { defaultSettings, useStoreSettings } from '@/features/portal/lib/merchantStore'
import { usePublicStores } from './usePublicStores'
import { StorefrontContext } from './useStorefront'
import { storeHostname } from '../data/publicStores'

export function StorefrontLayout() {
  const { storeSlug } = useParams()
  const ownerSettings = useStoreSettings()
  const stores = usePublicStores()
  const store = stores.find(item => item.slug === storeSlug)
  const base = `/store/${storeSlug}`
  if (!store) return <main id="main-content" className={styles.unavailable} tabIndex={-1}><h1>Store not found.</h1><p>This store is unavailable or its address has changed.</p><Button asChild variant="outline"><Link to="/stores">Explore stores</Link></Button></main>
  const settings = store.id === 'demo-tenant' ? ownerSettings : { ...defaultSettings, profile: { ...defaultSettings.profile, name: store.name, description: store.description } }
  const storeProducts = products.filter(product => store.productIds.includes(product.id))
  const context = { base, store, settings, products: storeProducts }
  const collections = store.id === 'demo-tenant' ? categories : [...categories, ...discoveryCategories].filter(category => category.id !== 'all' && storeProducts.some(product => matchesCategory(product, category.id)))
  return <StorefrontContext.Provider value={context}><div className={`${styles.store} ${settings.appearance.density === 'compact' ? styles.compact : ''}`} data-accent={settings.appearance.accent}>
    <StorefrontHeader base={base} />
    <div className={styles.storeIdentityBar}><div><strong>{settings.profile.name}</strong><span>{storeHostname(store)}</span></div><Link to="/stores">Explore other stores <ArrowUpRight size={13} aria-hidden="true" /></Link></div>
    {(settings.appearance.headline || settings.appearance.announcement) && <section className={styles.storeIntro} aria-label="Store announcement">{settings.appearance.announcement && <p>{settings.appearance.announcement}</p>}{settings.appearance.headline && <h2>{settings.appearance.headline}</h2>}</section>}
    <Outlet key={store.slug} context={context} />
    <footer className={styles.footer} id="about-store">
      <div className={styles.footerColumns}>
        <section><h2>{settings.profile.name}</h2><p>{settings.profile.description}</p>{settings.profile.email && <a href={`mailto:${settings.profile.email}`}>{settings.profile.email}</a>}{settings.profile.phone && <p>{settings.profile.phone}</p>}<Link to={base}>Explore the collection <ArrowUpRight size={13} aria-hidden="true" /></Link></section>
        <section><h2>THE COLLECTION</h2>{collections.map(category => <Link to={`${base}?category=${category.id}`} key={category.id}>{category.name}</Link>)}</section>
        <section><h2>HOW TO SHOP</h2><p>Discover your favourites here.<br />Choose a colour or option.<br />Compare offers, then buy on your preferred marketplace.</p></section>
        <section><h2>FIND US ON</h2><span>Shopee</span><span>TikTok Shop</span><p className={styles.sampleNote}>Sample catalog. Prices and availability are illustrative.</p></section>
      </div>
      {Object.entries(settings.policies).some(([, value]) => value.trim()) && <section className={styles.storePolicies} aria-label="Store policies"><h2>Store policies</h2>{Object.entries(settings.policies).filter(([, value]) => value.trim()).map(([id, value]) => <details key={id}><summary>{id === 'shipping' ? 'Shipping policy' : id === 'returns' ? 'Return policy' : 'Privacy policy'}</summary><p>{value}</p></details>)}</section>}
      <div className={styles.footerBottom}><span>Powered by <Brand /></span></div>
    </footer>
  </div></StorefrontContext.Provider>
}
