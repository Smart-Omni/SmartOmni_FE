import { useState } from 'react'
import { Link, useOutletContext, useParams, useSearchParams } from 'react-router-dom'
import { X } from 'lucide-react'
import { Button } from '@/shared/ui/button'

import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/shared/ui/tabs'
import { categories, discoveryCategories } from '../data/catalog'
import styles from '../Storefront.module.css'
import detail from './ProductDetail.module.css'
import { ProductReviews } from '../components/ProductExtras'
import { ProductOverview, ProductRecommendations } from '../components/ProductOverview'
import { useRecordProductView } from '../components/useRecordProductView'
import overview from '../components/ProductOverview.module.css'


export function ProductDetailPage() {
  const { productId } = useParams()
  const { base, products } = useOutletContext()
  const [params, setParams] = useSearchParams()
  const [missingLink, setMissingLink] = useState(null)
  const product = products.find(item => item.id === productId)
  useRecordProductView(product?.id)
  const item = product?.variants.find(variant => variant.sku === params.get('sku')) || (!params.has('sku') ? product?.variants[0] : null)
  if (!product || !item) return <main id="main-content" className={styles.unavailable} tabIndex={-1}><h1>{product ? 'This option is unavailable.' : 'Product not found.'}</h1><p>Explore the collection to find another product or option.</p><Button asChild variant="outline"><Link to={product ? `${base}/products/${product.id}` : base}>Back to {product ? 'product' : 'collection'}</Link></Button></main>
  const category = [...categories, ...discoveryCategories].find(entry => entry.id === product.category)
  const related = products.filter(entry => entry.id !== product.id).sort((a, b) => Number(b.category === product.category) - Number(a.category === product.category)).slice(0, 6)
  function chooseSku(sku) { const next = new URLSearchParams(params); next.set('sku', sku); setParams(next, { preventScrollReset: true }) }
  return <main id="main-content" className={`${detail.page} ${overview.page}`} tabIndex={-1}>
    <div className={overview.content}><ProductOverview key={product.id} product={product} item={item} category={category} base={base} chooseSku={chooseSku} onMissingLink={setMissingLink} /></div>
    <div id="product-information" className={overview.information}>
    <Tabs key={product.id} defaultValue="description" orientation="vertical" className={detail.details}>
      <TabsList className={detail.tabList} aria-label="Product information"><TabsTrigger value="description">Description</TabsTrigger><TabsTrigger value="details">Additional information</TabsTrigger><TabsTrigger value="reviews">Reviews</TabsTrigger></TabsList>
      <TabsContent value="description" className={detail.tabContent}><h2>Considered for your everyday.</h2><p>{product.description}</p><p>Explore the {category.name.toLowerCase()} collection and select your preferred colour above. Compare the available offers for the same SKU, then continue to your chosen marketplace to complete your purchase.</p><p className={detail.note}>This is a sample catalog. Product specifications and live availability will be provided by the seller.</p></TabsContent>
      <TabsContent value="details" className={`${styles.productDetails} ${detail.tabContent}`}><h2>Product details</h2><dl><div><dt>Collection</dt><dd>{category.name}</dd></div><div><dt>Selected colour</dt><dd>{item.colour}</dd></div><div><dt>Product reference</dt><dd>{item.sku}</dd></div><div><dt>Available on</dt><dd>{item.offers.map(offer => offer.channel === 'shopee' ? 'Shopee' : 'TikTok Shop').join(' / ')}</dd></div></dl></TabsContent>
      <TabsContent value="reviews" className={detail.tabContent}><ProductReviews key={product.id} productId={product.id} /></TabsContent>
    </Tabs></div>
    <div className={overview.content}><ProductRecommendations title="More from this collection" items={related} base={base} /><ProductRecommendations title="You may also like" items={products.filter(entry => entry.id !== product.id && !related.some(relatedProduct => relatedProduct.id === entry.id)).slice(0, 6)} base={base} /></div>
    <Dialog open={Boolean(missingLink)} onOpenChange={open => { if (!open) setMissingLink(null) }}><DialogContent showCloseButton={false} className={styles.linkDialog}><div className={styles.dialogHead}><DialogTitle>Product link unavailable</DialogTitle><DialogClose asChild><Button variant="ghost" size="icon" aria-label="Close message"><X size={18} /></Button></DialogClose></div><DialogDescription>This sample offer has no live {missingLink === 'shopee' ? 'Shopee' : 'TikTok Shop'} product link yet. No purchase has been made.</DialogDescription><DialogClose asChild><Button variant="outline">Back to product</Button></DialogClose></DialogContent></Dialog>

  </main>
}
