import { Link, useOutletContext, useSearchParams } from 'react-router-dom'
import { ChevronRight, X } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { RecentlyViewed } from '../components/ProductExtras'
import { SaveProductButton } from '../components/SaveProductButton'
import { useSavedProducts } from '../components/useSavedProducts'
import { StorefrontDiscovery, StorefrontBenefits } from '../components/StorefrontDiscovery'
import { categories, discoveryCategories, matchesCategory, formatPrice } from '../data/catalog'
import { ShopWelcome } from '../components/ShopWelcome'
import shared from '../Storefront.module.css'
import styles from './CatalogPage.module.css'

const sortOptions = [['featured', 'Featured'], ['name', 'Name: A–Z'], ['price-asc', 'Price: low to high'], ['price-desc', 'Price: high to low']]
export function CatalogPage() {
  const [params, setParams] = useSearchParams()
  const { base, products, store } = useOutletContext()
  const { savedIds } = useSavedProducts()
  const savedOnly = params.get('saved') === '1'
  const clear = () => setParams({}, { preventScrollReset: true })
  const category = params.get('category') || 'all'
  const colours = params.getAll('colour')
  const channel = params.get('channel')
  const query = (params.get('q') || '').trim().toLowerCase()
  const min = Math.max(0, Number(params.get('min')) || 0)
  const max = params.has('max') && params.get('max') !== '' ? Number(params.get('max')) : Infinity
  const sort = sortOptions.some(([value]) => value === params.get('sort')) ? params.get('sort') : 'featured'
  const matchingOffers = variant => variant.offers.filter(offer => offer.available && (!channel || offer.channel === channel) && offer.price >= min && offer.price <= max)
  const matchingVariants = product => product.variants.filter(variant => (!colours.length || colours.includes(variant.colour)) && matchingOffers(variant).length)
  const displayedPrice = product => Math.min(...matchingVariants(product).flatMap(variant => matchingOffers(variant).map(offer => offer.price)))
  const filtered = products.filter(product => (!savedOnly || savedIds.includes(product.id)) && matchesCategory(product, category) && (!query || product.name.toLowerCase().includes(query)) && matchingVariants(product).length)
  if (sort === 'price-asc') filtered.sort((a, b) => displayedPrice(a) - displayedPrice(b))
  if (sort === 'price-desc') filtered.sort((a, b) => displayedPrice(b) - displayedPrice(a))
  if (sort === 'name') filtered.sort((a, b) => a.name.localeCompare(b.name))
  const selectedCategory = [...discoveryCategories, ...categories.flatMap(item => [item, ...item.children])].find(item => item.id === category)
  const hasFilters = savedOnly || category !== 'all' || colours.length > 0 || channel || params.has('min') || params.has('max') || query
  const title = savedOnly ? 'Saved products' : query ? `Results for “${params.get('q')}”` : selectedCategory?.name || 'All Products'
  const visibleCount = Math.max(7, Math.floor(Number(params.get('show'))) || 7)
  const visible = filtered.slice(0, visibleCount)
  function discoverMore() {
    const next = new URLSearchParams(params)
    next.set('show', String(visibleCount + 7))
    setParams(next, { preventScrollReset: true })
  }
  return <div className={styles.page}><main id="main-content" className={`${shared.main} ${styles.main}`} tabIndex={-1}>
    {!hasFilters && (store.slug === 'everyday-studio' ? <StorefrontDiscovery base={base} /> : <ShopWelcome />)}
    {hasFilters && <nav className={shared.breadcrumb} aria-label="Breadcrumb"><Link to="/">Home</Link><ChevronRight size={12} aria-hidden="true" /><span>{selectedCategory?.name || 'All products'}</span></nav>}
    <div id="just-for-you" className={`${styles.heading} ${!hasFilters ? styles.recommendHeading : ''}`}><div>{hasFilters ? <h1>{title}</h1> : <h2>JUST FOR YOU</h2>}{hasFilters && <p role="status">{filtered.length} {filtered.length === 1 ? 'product' : 'products'}</p>}</div>{hasFilters ? <button className={styles.clear} onClick={clear}>Clear filters <X size={13} aria-hidden="true" /></button> : <span>A fresh selection of things you’ll love</span>}</div>
    {hasFilters && <p className={styles.selection}>{[selectedCategory?.name, colours.join(', '), channel === 'shopee' ? 'Shopee' : channel === 'tiktok' ? 'TikTok Shop' : '', params.has('min') || params.has('max') ? `${formatPrice(min)} – ${Number.isFinite(max) ? formatPrice(max) : 'No limit'}` : ''].filter(Boolean).join(' · ')}</p>}
    <section className={styles.grid} aria-label="Products">
      {visible.map(product => {
        const variants = matchingVariants(product)
        const productUrl = `${base}/products/${product.id}?sku=${variants[0].sku}`
        const channels = [...new Set(variants.flatMap(variant => matchingOffers(variant).map(offer => offer.channel)))]
        return <article className={styles.card} key={product.id}>
          <SaveProductButton product={product} compact />
          <Link className={styles.imageLink} to={productUrl} aria-label={`View ${product.name}`}><img src={product.image} alt={product.name} loading="lazy" decoding="async" className={product.imageMode === 'contain' ? styles.contain : ''} />{product.badge && <span className={styles.badge}>{product.badge}</span>}</Link>
          <div className={styles.cardBody}><h2><Link to={productUrl}>{product.name}</Link></h2><p className={styles.price}><span>From</span> {formatPrice(displayedPrice(product))}</p><p className={styles.variants}>{variants.length} {variants.length === 1 ? 'colour' : 'colours'} available</p><p className={styles.channels}>{channels.map(value => value === 'shopee' ? 'Shopee' : 'TikTok Shop').join(' / ')}</p></div>
        </article>
      })}
      {!filtered.length && <div className={styles.empty}><h2>{savedOnly ? 'No saved products yet.' : 'No products match your selection.'}</h2><p>{savedOnly ? 'Tap the heart on a product to keep it here.' : 'Try another keyword or clear your filters.'}</p><Button variant="outline" onClick={clear}>{savedOnly ? 'Explore the collection' : 'Clear filters'}</Button></div>}
    </section>
    {filtered.length > 0 && <Button variant="outline" className={styles.discoverMore} onClick={discoverMore} disabled={visible.length >= filtered.length}>{visible.length < filtered.length ? 'Discover more' : 'All products shown'}<ChevronRight size={16} aria-hidden="true" /></Button>}
    <RecentlyViewed base={base} contained />
    {!hasFilters && <StorefrontBenefits />}
  </main></div>
}
