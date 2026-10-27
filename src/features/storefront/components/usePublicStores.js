import { useSyncExternalStore } from 'react'
import { publicStores } from '../data/publicStores'

const key = 'smartomni.platform-demo.v1'
function snapshot() { try { return localStorage.getItem(key) || '' } catch { return '' } }
function subscribe(listener) {
  const onStorage = event => { if (!event.key || event.key === key) listener() }
  window.addEventListener('storage', onStorage)
  window.addEventListener('smartomni:platform-demo', listener)
  return () => { window.removeEventListener('storage', onStorage); window.removeEventListener('smartomni:platform-demo', listener) }
}
export function usePublicStores() {
  const value = useSyncExternalStore(subscribe, snapshot, () => '')
  let tenants = []
  try { const parsed = JSON.parse(value); if (Array.isArray(parsed?.tenants)) tenants = parsed.tenants } catch { /* Use public demo fixtures when storage is unavailable. */ }
  return publicStores.filter(store => {
    const tenant = tenants.find(item => item?.id === store.id)
    return !tenant || tenant.status === 'ACTIVE'
  })
}
