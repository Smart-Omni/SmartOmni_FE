import { useCallback } from 'react'
import { Link, useOutletContext, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowUpRight, ImageOff } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { useApiResource } from '@/features/integration/useApiResource'
import { channelLabel, storefrontApi, storefrontImageUrl, tenantWebsiteUrl } from '@/services/api/storefront'
import { formatPrice } from '../data/catalog'
import styles from './ApiCatalog.module.css'

/**
 * One product of the public catalog. The shopper picks an option, compares the marketplace offers and continues to
 * Shopee or TikTok Shop to buy; SmartOmni itself takes no order or payment.
 */
export default function ApiProductDetailPage() {
  const { base, storeSlug } = useOutletContext()
  const { productId } = useParams()
  const [params, setParams] = useSearchParams()
  const loader = useCallback(signal => storefrontApi.product(storeSlug, productId, signal), [storeSlug, productId])
  const resource = useApiResource(loader)
  const product = resource.data
  const back = <Link className={styles.back} to={base}><ArrowLeft size={14} aria-hidden="true" /> Back to all products</Link>

  if (resource.loading) return <section className={styles.detail} aria-busy="true">{back}<p role="status">Loading product…</p></section>
  if (resource.error || !product) return <section className={styles.detail}>{back}
    <div className={styles.error} role="alert"><h1>{resource.errorStatus === 404 ? 'Product not found.' : 'Could not load this product.'}</h1>
      <p>{resource.errorStatus === 404 ? 'It may be sold out on every marketplace or no longer listed.' : resource.error}</p>
      {resource.errorStatus !== 404 && <Button variant="outline" onClick={resource.reload}>Try again</Button>}</div>
  </section>

  const selected = product.variants.find(variant => String(variant.id) === params.get('option')) || product.variants[0]
  const image = storefrontImageUrl(product.imageUrl)
  function choose(variant) {
    const next = new URLSearchParams(params)
    next.set('option', String(variant.id))
    setParams(next, { replace: true, preventScrollReset: true })
  }

  return <section className={styles.detail} aria-labelledby="product-heading">
    {back}
    <div className={styles.detailLayout}>
      <div className={styles.media}>{image ? <img src={image} alt={product.name} /> : <span className={styles.placeholder}><ImageOff size={40} aria-hidden="true" /><span>No image</span></span>}</div>
      <div className={styles.info}>
        <h1 id="product-heading">{product.name}</h1>
        {product.variants.length > 1 && <fieldset className={styles.options}>
          <legend>Option</legend>
          <div>{product.variants.map(variant => <button type="button" key={variant.id} aria-pressed={variant.id === selected.id}
            className={variant.id === selected.id ? styles.optionActive : styles.option} onClick={() => choose(variant)}>{variant.variantName}</button>)}</div>
        </fieldset>}
        {product.variants.length === 1 && selected.variantName !== 'Standard' && <p className={styles.single}>Option: {selected.variantName}</p>}
        <ul className={styles.offers} aria-label={`Where to buy ${selected.variantName}`}>
          {selected.offers.map(offer => {
            const url = tenantWebsiteUrl(offer.url)
            const label = `Buy on ${channelLabel(offer.platform)}`
            return <li key={offer.platform} className={styles.offer}>
              <div><strong>{channelLabel(offer.platform)}</strong><span className={styles.offerPrice}>{formatPrice(Number(offer.price))}</span>
                <span className={offer.available ? styles.inStock : styles.outOfStock}>{offer.available ? 'In stock' : 'Sold out'}</span></div>
              {offer.available && url
                ? <Button asChild><a href={url} target="_blank" rel="noopener noreferrer">{label}<ArrowUpRight size={16} aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span></a></Button>
                : <Button disabled>{offer.available ? 'Link unavailable' : 'Sold out'}</Button>}
            </li>
          })}
        </ul>
        <p className={styles.hint}>You complete the purchase on the marketplace. After the order is completed for 15 days, claim loyalty points with its order number on <Link to="/customer/loyalty">Loyalty points</Link>.</p>
        {product.description && <div className={styles.description}><h2>Description</h2><p>{product.description}</p></div>}
      </div>
    </div>
  </section>
}
