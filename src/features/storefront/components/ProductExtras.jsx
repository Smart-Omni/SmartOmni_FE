import { useCallback, useMemo, useState, useSyncExternalStore } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Clock3, MessageSquare, Star } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { formatPrice, lowestPrice } from '../data/catalog'
import { useStorefront } from './useStorefront'
import detail from '../pages/ProductDetail.module.css'
import recentStyles from './RecentlyViewed.module.css'
import { useRecordProductView } from './useRecordProductView'

const storageEvent = 'smartomni-store-storage'
function subscribe(listener) {
  window.addEventListener('storage', listener)
  window.addEventListener(storageEvent, listener)
  return () => { window.removeEventListener('storage', listener); window.removeEventListener(storageEvent, listener) }
}
function useStoredList(key) {
  const getSnapshot = useCallback(() => { try { return localStorage.getItem(key) || '[]' } catch { return '[]' } }, [key])
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => '[]')
  const entries = useMemo(() => { try { const value = JSON.parse(snapshot); return Array.isArray(value) ? value : [] } catch { return [] } }, [snapshot])
  const save = useCallback(value => {
    try { localStorage.setItem(key, JSON.stringify(value)); window.dispatchEvent(new Event(storageEvent)); return true } catch { return false }
  }, [key])
  return [entries, save]
}

export function ProductReviews({ productId }) {
  const { store } = useStorefront()
  const [stored, save] = useStoredList(`smartomni:${store.slug}:reviews:${productId}`)
  const [status, setStatus] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const reviews = stored.filter(entry => entry && typeof entry.name === 'string' && typeof entry.text === 'string' && Number.isInteger(entry.rating) && entry.rating >= 1 && entry.rating <= 5).slice(0, 50)
  const average = reviews.length ? reviews.reduce((sum, entry) => sum + entry.rating, 0) / reviews.length : 0
  function submit(event) {
    event.preventDefault()
    const form = event.currentTarget
    const values = new FormData(form)
    const name = String(values.get('name') || '').trim()
    const text = String(values.get('review') || '').trim()
    if (name.length < 2 || text.length < 10) { setStatus('Please enter a name and a review of at least 10 characters.'); return }
    if (save([{ name, text, rating: Number(values.get('rating')), createdAt: new Date().toISOString() }, ...reviews].slice(0, 50))) {
      form.reset()
      setStatus('Your review has been saved on this device.')
    } else setStatus('Your browser could not save this review. Please allow browser storage and try again.')
  }
  return <div className={detail.reviews}>
    <div className={detail.reviewSummary}><strong>{reviews.length ? average.toFixed(1) : '—'}<small> / 5</small></strong><div><div className={detail.stars} aria-label={reviews.length ? `${average.toFixed(1)} out of 5 stars` : 'No ratings yet'}>{[1, 2, 3, 4, 5].map(value => <Star key={value} size={16} fill={value <= Math.round(average) ? 'currentColor' : 'none'} aria-hidden="true" />)}</div><p>{reviews.length} {reviews.length === 1 ? 'review' : 'reviews'} on this device</p></div></div>
    <p className={detail.note}>Demo reviews are saved only in this browser and are not published to the store or marketplaces.</p>
    {reviews.length ? <div className={detail.reviewList}>{reviews.map((review, index) => <article key={`${review.createdAt}-${index}`}><header><strong>{review.name}</strong><span aria-label={`${review.rating} out of 5 stars`}>{review.rating} <Star size={12} fill="currentColor" aria-hidden="true" /></span></header><p>{review.text}</p></article>)}</div> : <div className={detail.reviewEmpty}><MessageSquare size={22} aria-hidden="true" /><div><h2>No reviews yet</h2><p>Share your thoughts about this product.</p></div></div>}
    <Button type="button" variant="outline" className={detail.reviewToggle} aria-expanded={formOpen} aria-controls="product-review-form" onClick={() => setFormOpen(!formOpen)}>{formOpen ? 'Collapse review form' : 'Write a review'}</Button>
    {formOpen && <form id="product-review-form" className={detail.reviewForm} onSubmit={submit}>
      <h2>Write a review</h2>
      <fieldset><legend>Your rating</legend><div className={detail.ratingChoices}>{[1, 2, 3, 4, 5].map(value => <label key={value}><input type="radio" name="rating" value={value} required aria-label={`${value} ${value === 1 ? 'star' : 'stars'}`} /><span>{value} <Star size={13} aria-hidden="true" /></span></label>)}</div></fieldset>
      <label htmlFor="review-name">Your name</label><input id="review-name" name="name" required minLength={2} maxLength={60} autoComplete="name" placeholder="Name" />
      <label htmlFor="review-text">Your review</label><textarea id="review-text" name="review" required minLength={10} maxLength={2000} rows={4} placeholder="What did you think of this product?" />
      <Button type="submit">Post</Button><p role="status">{status}</p>
    </form>}
  </div>
}

export function ProductRatingSummary({ productId, className }) {
  const { store } = useStorefront()
  const [stored] = useStoredList(`smartomni:${store.slug}:reviews:${productId}`)
  const reviews = stored.filter(review => review && Number.isFinite(review.rating) && review.rating >= 1 && review.rating <= 5)
  const average = reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : 0
  return <div className={className}><strong>{reviews.length ? average.toFixed(1) : '—'}</strong><span aria-label={reviews.length ? `${average.toFixed(1)} out of 5 stars` : 'No ratings yet'}>{[1, 2, 3, 4, 5].map(value => <Star key={value} size={12} fill={value <= Math.round(average) ? 'currentColor' : 'none'} aria-hidden="true" />)}</span><a href="#product-information">{reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}</a><small>On this device</small></div>
}

export function RecentlyViewed({ productId, base, contained = false }) {
  const { store, products } = useStorefront()
  const [stored] = useStoredList(`smartomni:${store.slug}:recently-viewed`)
  const ids = useMemo(() => [...new Set(stored.filter(id => products.some(product => product.id === id)))].slice(0, 12), [stored, products])
  useRecordProductView(productId)
  const recent = ids.filter(id => id !== productId).slice(0, 10).map(id => products.find(product => product.id === id))
  return <section className={`${recentStyles.section} ${contained ? recentStyles.contained : ''}`} aria-labelledby="recently-viewed">
    <div className={recentStyles.heading}><h2 id="recently-viewed">Recently viewed</h2><span><Clock3 size={14} aria-hidden="true" />On this device</span></div>
    {recent.length ? <div className={recentStyles.grid}>{recent.map(product => <article className={recentStyles.card} key={product.id}>
      <Link to={`${base}/products/${product.id}`} className={recentStyles.image} aria-label={`View ${product.name}`}><img src={product.image} alt={product.name} loading="lazy" className={product.imageMode === 'contain' ? recentStyles.contain : ''} /></Link>
      <div className={recentStyles.copy}><h3><Link to={`${base}/products/${product.id}`}>{product.name}</Link></h3><p>{lowestPrice(product) !== null ? <><span>From</span> <strong>{formatPrice(lowestPrice(product))}</strong></> : 'Unavailable'}</p></div>
    </article>)}</div> : <div className={recentStyles.empty}>
      <div className={recentStyles.emptyIcon}><Clock3 size={26} strokeWidth={1.4} aria-hidden="true" /></div>
      <div className={recentStyles.emptyCopy}><h3>A little inspiration for later</h3><p>The products you explore will appear here.</p></div>
      <a className={recentStyles.explore} href={contained ? '#just-for-you' : base}>Explore the collection <ArrowRight size={16} aria-hidden="true" /></a>
    </div>}
  </section>
}
