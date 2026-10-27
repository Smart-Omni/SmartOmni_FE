import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, Check, ChevronLeft, ChevronRight, Expand, Share2, ShieldCheck, ShoppingBag, Truck, Undo2, X } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog'
import { MarketplaceLogo } from '@/shared/components/MarketplaceLogo'
import { SaveProductButton } from './SaveProductButton'
import { ProductRatingSummary } from './ProductExtras'
import { formatPrice, lowestPrice } from '../data/catalog'
import { useStorefront } from './useStorefront'
import detail from '../pages/ProductDetail.module.css'
import styles from './ProductOverview.module.css'

const colourSwatches = { White: '#fafafa', Black: '#353535', Sand: '#c8b79a', Cloud: '#e4e6e7', Natural: '#ddd1b9', Olive: '#72765a' }

export function ProductOverview({ product, item, category, base, chooseSku, onMissingLink }) {
  const { settings, products } = useStorefront()
  const [expanded, setExpanded] = useState(false)
  const [copyStatus, setCopyStatus] = useState('')
  const prices = item.offers.filter(offer => offer.available).map(offer => offer.price)
  const lowest = prices.length ? Math.min(...prices) : null
  const selectedIndex = product.variants.indexOf(item)
  const imageStyle = variant => product.id === 'wireless-mouse' && variant.colour === 'Black' ? { filter: 'brightness(.25)' } : undefined
  async function shareProduct() {
    try {
      if (navigator.share) { await navigator.share({ title: product.name, url: window.location.href }); setCopyStatus('') }
      else { await navigator.clipboard.writeText(window.location.href); setCopyStatus('Link copied for sharing') }
    } catch (error) { if (error.name !== 'AbortError') setCopyStatus('Unable to share this link') }
  }
  return <>
    <nav className={styles.breadcrumb} aria-label="Breadcrumb"><Link to={base}>Home</Link><ChevronRight size={12} aria-hidden="true" /><Link to={`${base}?category=${product.category}`}>{category.name}</Link><ChevronRight size={12} aria-hidden="true" /><span>{product.name}</span></nav>
    <section className={styles.overview} aria-label="Product overview">
      <div className={styles.gallery}>
        <div className={styles.stage}><img src={product.image} alt={`${product.name} — ${item.colour}`} style={imageStyle(item)} className={product.imageMode === 'contain' ? styles.contain : ''} /><button className={styles.expand} onClick={() => setExpanded(true)}><Expand size={13} aria-hidden="true" />Overview</button></div>
        <div className={styles.previewRow}>
          <Button variant="ghost" size="icon" aria-label="Previous colour" disabled={product.variants.length < 2} onClick={() => chooseSku(product.variants[(selectedIndex - 1 + product.variants.length) % product.variants.length].sku)}><ChevronLeft size={18} /></Button>
          <div className={styles.thumbnails} aria-label="Product colour previews">{product.variants.map(variant => <button key={variant.sku} type="button" aria-label={`Preview ${variant.colour}`} aria-pressed={item.sku === variant.sku} onClick={() => chooseSku(variant.sku)}><img src={product.image} style={imageStyle(variant)} alt="" /><span>{variant.colour}</span></button>)}</div>
          <Button variant="ghost" size="icon" aria-label="Next colour" disabled={product.variants.length < 2} onClick={() => chooseSku(product.variants[(selectedIndex + 1) % product.variants.length].sku)}><ChevronRight size={18} /></Button>
        </div>
        <div className={styles.galleryActions}><button onClick={shareProduct}><Share2 size={15} aria-hidden="true" />Share</button><span className={styles.divider} aria-hidden="true">|</span><SaveProductButton product={product} label="Save to favourites" savedLabel="Saved to favourites" /><span role="status">{copyStatus}</span></div>
      </div>
      <div className={styles.info}>
        <h1>{product.name}</h1>
        <ProductRatingSummary productId={product.id} className={styles.rating} />
        <div className={styles.pricePanel}><p>{lowest !== null ? <><span>From</span> <strong>{formatPrice(lowest)}</strong><small>COMPARE OFFERS</small></> : <strong>Currently unavailable</strong>}</p><span>Everyday value, selected for you.</span></div>
        <p className={styles.intro}>{product.description}</p>
        <dl className={styles.delivery}><div><dt>Shop offers</dt><dd><a href="#product-offers"><ShoppingBag size={14} aria-hidden="true" />Explore offers<ChevronRight size={12} aria-hidden="true" /></a></dd></div><div><dt>Delivery</dt><dd><Truck size={16} aria-hidden="true" /><div>Ships from your selected marketplace<small>Delivery options and shipping costs are confirmed there.</small></div></dd></div><div><dt>Returns</dt><dd><Undo2 size={16} aria-hidden="true" /><div>Review the seller’s return policy<small>Terms vary by marketplace and product listing.</small></div></dd></div></dl>
        <div className={styles.options}><fieldset className={detail.colourPicker}><legend>Colour: <strong>{item.colour}</strong></legend><div>{product.variants.map(variant => <button type="button" key={variant.sku} aria-label={variant.colour} title={variant.colour} aria-pressed={variant.sku === item.sku} onClick={() => chooseSku(variant.sku)}><span style={{ backgroundColor: colourSwatches[variant.colour] || '#ccc' }} aria-hidden="true" /></button>)}</div></fieldset><p className={styles.sku}>SKU {item.sku}</p></div>
        <section id="product-offers" className={styles.offers} aria-labelledby="where-to-buy"><h2 id="where-to-buy">Choose where to buy</h2><div className={styles.offerGrid}>{item.offers.map(offer => <div className={styles.offer} key={offer.channel}><div className={styles.offerTitle}><span><MarketplaceLogo marketplace={offer.channel} size={21} decorative />{offer.channel === 'shopee' ? 'Shopee' : 'TikTok Shop'}</span><strong>{formatPrice(offer.price)}</strong></div><p>{offer.available ? <><Check size={11} aria-hidden="true" />In stock{offer.price === lowest && prices.length > 1 && <span>Lowest price</span>}</> : 'Out of stock'}</p>{offer.available ? <Button asChild={Boolean(offer.listingUrl)} variant="outline" className={styles.buy} onClick={offer.listingUrl ? undefined : () => onMissingLink(offer.channel)}>{offer.listingUrl ? <a href={offer.listingUrl} target="_blank" rel="noopener noreferrer">View on {offer.channel === 'shopee' ? 'Shopee' : 'TikTok Shop'}<ArrowUpRight size={14} aria-hidden="true" /></a> : <>View on {offer.channel === 'shopee' ? 'Shopee' : 'TikTok Shop'}<ArrowUpRight size={14} aria-hidden="true" /></>}</Button> : <Button className={styles.buy} disabled variant="outline">Currently unavailable</Button>}</div>)}</div></section>
        <div className={styles.confidence}><ShieldCheck size={21} aria-hidden="true" /><span>Shop with confidence<small>Compare the same colour and SKU before you buy.</small></span></div>
      </div>
    </section>
    <section className={styles.storePanel} aria-label="About this storefront"><div className={styles.storeIdentity}><span className={styles.storeIcon}><ShoppingBag size={25} strokeWidth={1.4} aria-hidden="true" /></span><div><h2>{settings.profile.name}</h2><p>{settings.profile.description}</p><Link to={base}>View shop<ArrowRight size={13} aria-hidden="true" /></Link></div></div><dl><div><dt>Products</dt><dd>{products.length}</dd></div><div><dt>Marketplaces</dt><dd>Shopee / TikTok Shop</dd></div><div><dt>Shopping</dt><dd>On your marketplace</dd></div><div><dt>Collection</dt><dd>Everyday essentials</dd></div></dl></section>
    <Dialog open={expanded} onOpenChange={setExpanded}><DialogContent className={styles.lightbox} showCloseButton={false}><div className={styles.lightboxHeader}><DialogTitle>{product.name}</DialogTitle><DialogClose asChild><Button variant="ghost" size="icon" aria-label="Close product image"><X size={19} /></Button></DialogClose></div><DialogDescription className="sr-only">Product image in {item.colour}.</DialogDescription><img src={product.image} alt={`${product.name} — ${item.colour}`} style={imageStyle(item)} /></DialogContent></Dialog>
  </>
}

export function ProductRecommendations({ title, items, base }) {
  return <section className={styles.recommendations} aria-label={title}><div className={styles.sectionHeading}><h2>{title}</h2><span>Find something that goes together</span></div><div className={styles.productGrid}>{items.map(product => <article key={product.id}><div className={styles.cardImage}><Link to={`${base}/products/${product.id}`} aria-label={`View ${product.name}`}><img src={product.image} alt={product.name} loading="lazy" className={product.imageMode === 'contain' ? styles.contain : ''} /></Link><SaveProductButton product={product} compact /></div><div className={styles.cardCopy}><h3><Link to={`${base}/products/${product.id}`}>{product.name}</Link></h3><p><span>From</span> <strong>{formatPrice(lowestPrice(product))}</strong></p><small>{[...new Set(product.variants.flatMap(variant => variant.offers.filter(offer => offer.available).map(offer => offer.channel)))].map(channel => channel === 'shopee' ? 'Shopee' : 'TikTok Shop').join(' / ')}</small></div></article>)}</div></section>
}
