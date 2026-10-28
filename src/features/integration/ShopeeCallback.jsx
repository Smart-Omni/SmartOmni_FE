import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useDemoSession } from '@/features/auth/hooks/useDemoSession'
import { shopeeApi } from '@/services/api/shopee'
import { AuthLayout } from '@/features/auth/components/AuthLayout'
import styles from '@/features/portal/OwnerWorkspace.module.css'

// Share the exchange across StrictMode's repeated effects. Backend state is single-use.
const exchanges = new Map()
export default function ShopeeCallback() {
  const session = useDemoSession()
  const location = useLocation()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const params = new URLSearchParams(location.search)
  const providerError = params.get('error_description') || params.get('error')
  const code = params.get('code'), shopId = params.get('shop_id'), state = params.get('state')
  useEffect(() => {
    if (!session || providerError || !code || !shopId || !state) return
    let active = true
    const key = `${session.id}:${state}`
    if (!exchanges.has(key)) exchanges.set(key, shopeeApi.callback({ code, shop_id: shopId, state }))
    exchanges.get(key).then(() => {
      if (active) navigate('/merchant/shops', { replace: true, state: { shopeeConnected: true } })
    }).catch(failure => { if (active) setError(failure.message) })
    return () => { active = false }
  }, [session, code, shopId, state, providerError, navigate])
  if (!session) return <Navigate to="/auth/login" replace state={{ returnTo: location.pathname + location.search }} />
  const message = providerError || error || (!code || !shopId || !state ? 'Missing Shopee callback parameters. Start a new connection.' : '')
  return <AuthLayout showBackLink={false}><div className={styles.page}><h1>Connect Shopee</h1>{message ? <><p role="alert" className={styles.error}>{message}</p><Link to="/merchant/shops">Return to shop connections</Link></> : <p role="status">Completing Shopee authorization…</p>}</div></AuthLayout>
}
