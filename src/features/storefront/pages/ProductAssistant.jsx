import { useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { ArrowLeft, ArrowUpRight, MessageCircle } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { useDemoSession } from '@/features/auth/hooks/useDemoSession'
import { useStoreSettings } from '@/features/portal/lib/merchantStore'
import { products, formatPrice, lowestPrice } from '../data/catalog'
import styles from './ProductAssistant.module.css'

const normalize = value => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replaceAll('đ', 'd')
function recommend(question, policies) {
  const text = normalize(question)
  if (/track.*order|order status|my.*order|don hang/.test(text)) return { text: 'I cannot confirm live prices, order status or marketplace availability. Please open your order on the marketplace for tracking. I can help you choose a product from this catalog.', ids: [] }
  if (/shipping|delivery|returns|policy|giao hang|doi tra/.test(text)) return { text: /return|doi tra/.test(text) ? policies.returns || 'Return terms depend on the seller and marketplace. Review the store policies or the selected marketplace listing before buying.' : policies.shipping || 'Delivery options and charges are confirmed by your chosen marketplace. This storefront does not arrange delivery.', ids: [] }
  const budgetMatch = text.match(/(?:under|below|budget|duoi|toi da)\s*([\d.,]+)\s*(k|million|m|trieu|tr)?/)
  const amount = budgetMatch && budgetMatch[2] && /[.,]\d{1,2}$/.test(budgetMatch[1]) ? Number(budgetMatch[1].replace(',', '.')) : Number(budgetMatch?.[1].replace(/[.,]/g, ''))
  const budget = budgetMatch ? amount * (/^(m|million|trieu|tr)$/.test(budgetMatch[2]) ? 1000000 : budgetMatch[2] === 'k' ? 1000 : 1) : Infinity
  const words = text.split(/\W+/).filter(word => word.length > 2 && !['the', 'for', 'and', 'can', 'you', 'show', 'find', 'under', 'below', 'budget', 'need', 'want', 'product', 'products', 'recommend', 'please', 'with', 'toi', 'can', 'tim', 'duoi'].includes(word) && !/^\d+$/.test(word))
  const ranked = products.filter(product => product.variants.some(variant => variant.offers.some(offer => offer.available)) && lowestPrice(product) <= budget).map(product => ({ product, score: words.reduce((score, word) => score + (normalize(`${product.name} ${product.category} ${product.description}`).includes(word) ? 1 : 0), 0) })).sort((a, b) => b.score - a.score || lowestPrice(a.product) - lowestPrice(b.product))
  const matches = ranked.filter(item => item.score > 0)
  const selected = (matches.length ? matches : budgetMatch ? ranked : []).slice(0, 3)
  return selected.length ? { text: `${selected.length === 1 ? 'Here is 1 catalog option' : `Here are ${selected.length} catalog options`}${budgetMatch ? ` within ${formatPrice(budget)}` : ' matching your question'}. Prices and stock are sample data. Open a product to compare colours and marketplace offers.`, ids: selected.map(item => item.product.id) } : { text: 'I can help you explore this sample catalog by product, category or budget. Try “headphones”, “workspace essentials” or “under 500000”. I cannot confirm live prices, order status or marketplace availability.', ids: [] }
}
function read(key) { try { const value = JSON.parse(sessionStorage.getItem(key)); return Array.isArray(value) ? value.filter(item => item && typeof item.id === 'string' && typeof item.question === 'string' && typeof item.text === 'string' && Array.isArray(item.ids) && item.ids.every(id => typeof id === 'string')).slice(-30) : [] } catch { return [] } }
export function ProductAssistant() {
  const { base } = useOutletContext()
  const session = useDemoSession()
  const storageKey = `smartomni.product-assistant.${base}.${session?.id || 'guest'}`
  return <Assistant key={storageKey} storageKey={storageKey} base={base} />
}
function Assistant({ storageKey, base }) {
  const settings = useStoreSettings()
  const [messages, setMessages] = useState(() => read(storageKey))
  const [question, setQuestion] = useState('')
  const [error, setError] = useState('')
  function save(next) { try { sessionStorage.setItem(storageKey, JSON.stringify(next)); setMessages(next); setError(''); return true } catch { setError('Could not save this conversation. Allow session storage and try again.'); return false } }
  function ask(event) {
    event.preventDefault()
    if (!question.trim() || question.length > 1000) { setError('Enter a question of up to 1,000 characters.'); return }
    const reply = recommend(question, settings.policies)
    if (save([...messages, { id: crypto.randomUUID(), question: question.trim(), ...reply }].slice(-30))) setQuestion('')
  }
  return <main id="main-content" className={styles.page} tabIndex={-1}><Link to={base} className={styles.back}><ArrowLeft size={16} />Back to collection</Link><div className={styles.heading}><div><span className={styles.eyebrow}>SHOPPING HELP</span><h1>Find your everyday favourite.</h1><p>Ask about products, compare options, or start with your budget.</p></div><MessageCircle size={28} strokeWidth={1.5} /></div><section className={styles.chat} aria-label="Product chatbot"><div className={styles.chatHeader}><strong>Product assistant</strong><span>Catalog demo</span>{messages.length > 0 && <Button variant="ghost" onClick={() => save([])}>Clear chat</Button>}</div><div className={styles.messages} role="log" aria-live="polite" aria-label="Product conversation">{!messages.length && <div className={styles.intro}><h2>A little guidance for your next find.</h2><p>I can show matching products from this store. What are you looking for?</p><div className={styles.prompts}>{['Workspace essentials', 'Headphones', 'Under 500000', 'What is the return policy?'].map(prompt => <Button variant="outline" key={prompt} onClick={() => setQuestion(prompt)}>{prompt}</Button>)}</div></div>}{messages.map(message => <article key={message.id} className={styles.exchange}><p className={styles.question}>{message.question}</p><p className={styles.answer}>{message.text}</p>{message.ids.length > 0 && <div className={styles.products}>{message.ids.map(id => { const product = products.find(item => item.id === id); return product && <Link key={id} to={`${base}/products/${id}`}><img src={product.image} alt={product.name} /><div><strong>{product.name}</strong><span>From {formatPrice(lowestPrice(product))}</span><small>View product <ArrowUpRight size={12} /></small></div></Link> })}</div>}</article>)}</div><form className={styles.composer} onSubmit={ask}><label htmlFor="product-question">Your question</label><textarea id="product-question" maxLength={1000} value={question} onChange={event => setQuestion(event.target.value)} placeholder="e.g. Help me find a desk accessory under 500000" /><div><p>Local catalog responses · no live AI or marketplace service.</p><Button type="submit" disabled={!question.trim()}>Ask assistant</Button></div>{error && <p role="alert" className={styles.error}>{error}</p>}</form></section></main>
}
