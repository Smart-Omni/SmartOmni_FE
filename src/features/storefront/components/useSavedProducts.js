import { useSyncExternalStore } from 'react'
import { products as defaultProducts } from '../data/catalog'
import { useStorefront } from './useStorefront'

const eventName = 'smartomni:saved-products-changed'
const fallbacks = new Map()
function snapshot(storageKey) { try { return localStorage.getItem(storageKey) || fallbacks.get(storageKey) || '[]' } catch { return fallbacks.get(storageKey) || '[]' } }
function subscribe(callback) {
  window.addEventListener('storage', callback)
  window.addEventListener(eventName, callback)
  return () => { window.removeEventListener('storage', callback); window.removeEventListener(eventName, callback) }
}
function parse(value, products) {
  try { const ids = JSON.parse(value); return Array.isArray(ids) ? [...new Set(ids.filter(id => products.some(product => product.id === id)))] : [] } catch { return [] }
}
export function useSavedProducts() {
  const context = useStorefront()
  const products = context?.products || defaultProducts
  const storageKey = `smartomni:${context?.store.slug || 'everyday-studio'}:saved-products`
  const value = useSyncExternalStore(subscribe, () => snapshot(storageKey), () => '[]')
  const savedIds = parse(value, products)
  function toggle(id) {
    if (!products.some(product => product.id === id)) return
    const current = parse(snapshot(storageKey), products)
    const fallback = JSON.stringify(current.includes(id) ? current.filter(item => item !== id) : [id, ...current])
    fallbacks.set(storageKey, fallback)
    try { localStorage.setItem(storageKey, fallback) } catch { /* Keep saved items for the current session if storage is unavailable. */ }
    window.dispatchEvent(new Event(eventName))
  }
  return { savedIds, toggle }
}
