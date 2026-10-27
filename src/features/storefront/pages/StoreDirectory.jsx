import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, Check, ChevronDown, Grid2X2, Search, Sparkles, Store, X } from 'lucide-react'
import { DropdownMenu } from 'radix-ui'
import { Button } from '@/shared/ui/button'
import { Brand } from '@/shared/components/Brand'
import { StorefrontHeader } from '../components/StorefrontHeader'
import { usePublicStores } from '../components/usePublicStores'
import { storeCategories, storeHostname } from '../data/publicStores'
import shared from '../Storefront.module.css'
import styles from './StoreDirectory.module.css'

export function StoreDirectory() {
  const stores = usePublicStores()
  const [params, setParams] = useSearchParams()
  const [assistantSlug, setAssistantSlug] = useState('everyday-studio')
  const query = (params.get('q') || '').trim().toLowerCase()
  const category = storeCategories.includes(params.get('category')) ? params.get('category') : 'All stores'
  const visible = stores.filter(store => (category === 'All stores' || store.category === category) && `${store.name} ${storeHostname(store)}`.toLowerCase().includes(query))
  const assistantStore = stores.find(store => store.slug === assistantSlug) || stores[0]
  function chooseCategory(value) {
    const next = new URLSearchParams(params)
    if (value === 'All stores') next.delete('category'); else next.set('category', value)
    setParams(next, { preventScrollReset: true })
  }
  return <div className={shared.store}>
    <StorefrontHeader base="/stores" directory />
    <main id="main-content" className={styles.main} tabIndex={-1}>
      <div className={styles.intro}>
        <section className={styles.hero} aria-labelledby="directory-title"><span className={styles.eyebrow}>GOOD FINDS START HERE</span><h1 id="directory-title">A little discovery.<br />Your kind of store.</h1><p>Independent storefronts. Thoughtful collections.<br />Find a store that feels like you.</p><a href="#stores" className={styles.browse}>Explore the stores <ArrowRight size={17} aria-hidden="true" /></a><div className={styles.heroDetail}><Store size={17} strokeWidth={1.5} aria-hidden="true" /><span>One place to discover. A space for every store.</span></div></section>
        <section className={styles.assistant} aria-labelledby="assistant-title"><div className={styles.assistantTop}><span className={styles.spark}><Sparkles size={22} strokeWidth={1.5} aria-hidden="true" /></span><span className={styles.eyebrow}>YOUR SHOPPING COMPANION</span></div><h2 id="assistant-title">A little help finding<br />the right thing.</h2><p>Choose a store. Ask about products, compare options, or start with your budget.</p><span className={styles.fieldLabel} id="assistant-store-label">Ask in this store</span><DropdownMenu.Root><DropdownMenu.Trigger asChild><button className={styles.storeSelect} aria-labelledby="assistant-store-label assistant-store-value" disabled={!stores.length}><span id="assistant-store-value">{assistantStore?.name || 'No stores available'}</span><ChevronDown size={15} aria-hidden="true" /></button></DropdownMenu.Trigger><DropdownMenu.Portal><DropdownMenu.Content className={`${shared.sortMenu} ${styles.storeMenu}`} align="start" sideOffset={6}>{stores.map(store => <DropdownMenu.Item key={store.slug} className={shared.sortOption} onSelect={() => setAssistantSlug(store.slug)}>{store.name}{assistantStore?.slug === store.slug && <Check size={14} aria-hidden="true" />}</DropdownMenu.Item>)}</DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu.Root>{assistantStore && <Button asChild className={styles.ask}><Link to={`/store/${assistantStore.slug}/assistant`}>Ask product assistant <ArrowUpRight size={16} aria-hidden="true" /></Link></Button>}<small>Advice from your selected store’s sample catalog.</small></section>
      </div>
      <section id="stores" className={styles.directory} aria-labelledby="stores-title">
        <aside className={styles.sidebar}><span className={styles.eyebrow}>FIND YOUR KIND OF STORE</span><h2>Browse by interest</h2><nav aria-label="Store categories">{storeCategories.map(value => <button key={value} onClick={() => chooseCategory(value)} aria-pressed={category === value}>{value === 'All stores' && <Grid2X2 size={15} aria-hidden="true" />}<span>{value}</span><small>{stores.filter(store => value === 'All stores' || store.category === value).length}</small></button>)}</nav><div className={styles.sidebarNote}><Store size={21} strokeWidth={1.4} aria-hidden="true" /><p>Every store has its own collection and product assistant.</p></div></aside>
        <div className={styles.results}><div className={styles.resultHeading}><div><h2 id="stores-title">{query ? `Stores matching “${params.get('q')}”` : category}</h2><p role="status">{visible.length} {visible.length === 1 ? 'store' : 'stores'} to explore</p></div>{(query || category !== 'All stores') && <Button variant="ghost" onClick={() => setParams({})}>Clear filters <X size={14} aria-hidden="true" /></Button>}</div>
          <div className={styles.grid}>{visible.map(store => <Link className={styles.card} key={store.slug} to={`/store/${store.slug}`} aria-label={`Visit ${store.name}`}><div className={styles.cardArt}><span className={styles.category}>{store.category}</span><img src={store.image} alt="" loading="lazy" className={store.contain ? styles.contain : ''} /><span className={styles.initials}>{store.initials}</span><ArrowUpRight className={styles.cardArrow} size={18} aria-hidden="true" /></div><div className={styles.cardCopy}><h3>{store.name}</h3><p>{store.description}</p><span className={styles.hostname}>{storeHostname(store)}</span><span className={styles.cardAction}>Visit store <ArrowRight size={15} aria-hidden="true" /></span></div></Link>)}</div>
          {!visible.length && <div className={styles.empty}><Search size={28} strokeWidth={1.4} aria-hidden="true" /><h3>{stores.length ? 'No stores found.' : 'No stores available yet.'}</h3><p>{stores.length ? 'Try a store name, a subdomain, or another interest.' : 'Check back soon for new storefronts to explore.'}</p>{stores.length > 0 && <Button variant="outline" onClick={() => setParams({})}>Show all stores</Button>}</div>}
        </div>
      </section>
      <footer className={styles.footer}><span>Independent stores. Connected by <Brand /></span><p>Demo storefront directory · sample catalogs · preview addresses</p><Link to="/">About SmartOmni <ArrowUpRight size={13} aria-hidden="true" /></Link></footer>
    </main>
  </div>
}
