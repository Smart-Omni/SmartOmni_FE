import { useCallback, useState } from 'react'
import { Link, useOutletContext, useSearchParams } from 'react-router-dom'
import { ChevronRight, ImageOff, Search } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { useApiResource } from '@/features/integration/useApiResource'
import { channelLabel, productPriceRange, storefrontApi, storefrontImageUrl } from '@/services/api/storefront'
import { formatPrice } from '../data/catalog'
import grid from './CatalogPage.module.css'
import styles from './ApiCatalog.module.css'

const PAGE_SIZE = 20

/** Public catalog of one store (API mode): server-side search and paging, no demo fixtures. */
export default function ApiCatalogPage() {
  const [params] = useSearchParams()
  const query = (params.get('q') || '').trim()
  // A new search starts over: fresh input value and first page.
  return <Catalog key={query} query={query} />
}

function Catalog({ query }) {
  const { base, storeSlug } = useOutletContext()
  const [params, setParams] = useSearchParams()
  const [draft, setDraft] = useState(query)
  const [pages, setPages] = useState(1)

  const loader = useCallback(async signal => {
    const loaded = []
    let last = null
    for (let page = 0; page < pages; page++) {
      last = await storefrontApi.products(storeSlug, { page, size: PAGE_SIZE, ...(query ? { search: query } : {}) }, signal)
      loaded.push(...(last?.content || []))
      if (!last || last.last) break
    }
    return { products: loaded, total: last?.totalElements ?? loaded.length }
  }, [storeSlug, query, pages])
  const resource = useApiResource(loader)
  // Keep the products on screen while the next page loads.
  const [shown, setShown] = useState(null)
  if (resource.data && resource.data !== shown) setShown(resource.data)
  const data = resource.data || (resource.loading ? shown : null)

  function search(event) {
    event.preventDefault()
    const next = new URLSearchParams(params)
    if (draft.trim()) next.set('q', draft.trim()); else next.delete('q')
    setParams(next)
  }

  return <section className={styles.catalog} aria-labelledby="catalog-heading">
    <div className={styles.toolbar}>
      <h2 id="catalog-heading">{query ? `Results for “${query}”` : 'All products'}</h2>
      <form role="search" className={styles.search} onSubmit={search}>
        <label htmlFor="store-search" className="sr-only">Search this store</label>
        <input id="store-search" type="search" value={draft} onChange={event => setDraft(event.target.value)} placeholder="Search this store" maxLength={100} />
        <Button type="submit" variant="outline" aria-label="Search"><Search size={16} aria-hidden="true" /></Button>
      </form>
    </div>
    {data && <p className={styles.count} role="status">{data.total} {data.total === 1 ? 'product' : 'products'}</p>}
    {resource.error && !resource.loading && <div className={styles.error} role="alert"><p>{resource.error}</p><Button variant="outline" onClick={resource.reload}>Try again</Button></div>}
    {!data && resource.loading && <p role="status" className={styles.count}>Loading products…</p>}
    {data && <div className={grid.grid}>
      {data.products.map(product => {
        const { min, soldOut, channels } = productPriceRange(product)
        const image = storefrontImageUrl(product.imageUrl)
        const url = `${base}/products/${product.id}`
        return <article className={grid.card} key={product.id}>
          <Link className={grid.imageLink} to={url} aria-label={`View ${product.name}`}>
            {image ? <img src={image} alt={product.name} loading="lazy" decoding="async" /> : <span className={styles.placeholder}><ImageOff size={28} aria-hidden="true" /><span>No image</span></span>}
            {soldOut && <span className={grid.badge}>Sold out</span>}
          </Link>
          <div className={grid.cardBody}>
            <h2><Link to={url}>{product.name}</Link></h2>
            {min != null && <p className={grid.price}><span>From</span> {formatPrice(min)}</p>}
            <p className={grid.variants}>{product.variants.length} {product.variants.length === 1 ? 'option' : 'options'}</p>
            <p className={grid.channels}>{channels.map(channelLabel).join(' / ')}</p>
          </div>
        </article>
      })}
      {!data.products.length && <div className={grid.empty}><h2>{query ? 'No products match your search.' : 'This store has no products on sale yet.'}</h2><p>{query ? 'Try another keyword.' : 'Check back soon.'}</p>{query && <Button variant="outline" onClick={() => setParams({})}>Clear search</Button>}</div>}
    </div>}
    {data && data.products.length < data.total && <Button variant="outline" className={grid.discoverMore} disabled={resource.loading} onClick={() => setPages(value => value + 1)}>
      {resource.loading ? 'Loading…' : 'Discover more'}<ChevronRight size={16} aria-hidden="true" />
    </Button>}
  </section>
}
