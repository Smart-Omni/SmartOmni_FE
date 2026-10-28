import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useDemoSession } from '@/features/auth/hooks/useDemoSession'
import { marketplaces } from './marketplaces'
import { AuthLayout } from '@/features/auth/components/AuthLayout'
import styles from '@/features/portal/OwnerWorkspace.module.css'

// Share the exchange across StrictMode's repeated effects. Backend state is single-use.
const exchanges = new Map()
export default function ShopeeCallback({ provider = 'shopee' }) {
  const { name, api } = marketplaces[provider]
  const session = useDemoSession()
  const location = useLocation()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const params = new URLSearchParams(location.search)
  const providerError = params.get('error_description') || params.get('error')
  const code = params.get('code'), shopId = params.get('shop_id'), state = params.get('state')
  const missing = !code || !state || (provider === 'shopee' && !shopId)
  useEffect(() => {
    if (!session || providerError || missing) return
    let active = true
    const key = `${provider}:${session.id}:${session.tenantId}:${state}`
    if (!exchanges.has(key)) exchanges.set(key, api.callback(provider === 'shopee' ? { code, shop_id: shopId, state } : { code, state }))
    exchanges.get(key).then(() => {
      if (active) navigate(provider === 'shopee' ? '/merchant/shops' : '/merchant/shops?marketplace=tiktok-shop', { replace: true })
    }).catch(failure => { if (active) setError(failure.message) })
    return () => { active = false }
  }, [session, code, shopId, state, providerError, navigate, provider, api, missing])
  if (!session) return <Navigate to="/auth/login" replace state={{ returnTo: location.pathname + location.search }} />
  const message = providerError || error || (missing ? `Missing ${name} callback parameters. Start a new connection.` : '')
  return <AuthLayout showBackLink={false}><div className={styles.page}><h1>Connect {name}</h1>{message ? <><p role="alert" className={styles.error}>{message}</p><Link to={provider === 'shopee' ? '/merchant/shops' : '/merchant/shops?marketplace=tiktok-shop'}>Return to shop connections</Link></> : <p role="status">Completing {name} authorization…</p>}</div></AuthLayout>
}
