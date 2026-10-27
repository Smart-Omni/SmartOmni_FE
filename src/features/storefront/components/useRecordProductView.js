import { useEffect } from 'react'
import { useStorefront } from './useStorefront'

export function useRecordProductView(productId) {
  const { store, products } = useStorefront()
  useEffect(() => {
    if (!products.some(product => product.id === productId)) return
    const key = `smartomni:${store.slug}:recently-viewed`
    try {
      const stored = JSON.parse(localStorage.getItem(key) || '[]')
      const ids = Array.isArray(stored) ? [...new Set(stored.filter(id => products.some(product => product.id === id)))] : []
      if (ids[0] === productId) return
      localStorage.setItem(key, JSON.stringify([productId, ...ids.filter(id => id !== productId)].slice(0, 12)))
      window.dispatchEvent(new Event('smartomni-store-storage'))
    } catch {
      try { localStorage.setItem(key, JSON.stringify([productId])); window.dispatchEvent(new Event('smartomni-store-storage')) } catch { /* Viewing a product still works without browser storage. */ }
    }
  }, [productId, store.slug, products])
}
