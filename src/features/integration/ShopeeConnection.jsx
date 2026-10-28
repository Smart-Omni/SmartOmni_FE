import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/shared/ui/button'
import { shopeeApi } from '@/services/api/shopee'
import { DataTable, Feedback, OwnerPanel } from '@/features/portal/components/OwnerWorkspaceUI'
import { useApiResource } from './useApiResource'
import { ResourceState } from './ShopeeShared'
import { dateTime, useApiAction } from './apiHelpers'
import styles from '@/features/portal/OwnerWorkspace.module.css'

export default function ShopeeConnection({ session }) {
  const resource = useApiResource(shopeeApi.connection)
  const action = useApiAction()
  const [confirm, setConfirm] = useState(false)
  const shop = resource.data
  // Pick up revocation/reconnect status after returning from a provider tab.
  useEffect(() => {
    window.addEventListener('focus', resource.reload)
    const timer = setInterval(resource.reload, 60_000)
    return () => { window.removeEventListener('focus', resource.reload); clearInterval(timer) }
  }, [resource.reload])
  const owner = session.role === 'TENANT_OWNER'
  async function connect() {
    await action.run(async () => {
      const result = await shopeeApi.authorize()
      const target = new URL(result.authorizationUrl)
      if (!['https:', 'http:'].includes(target.protocol)) throw new Error('Invalid authorization URL.')
      // Stay on this origin: the callback must be able to read this tab's session.
      const redirect = target.searchParams.get('redirect_uri') || target.searchParams.get('redirect')
      if (redirect && new URL(redirect).origin !== window.location.origin) throw new Error(`Open SmartOmni at ${new URL(redirect).origin} and sign in there before connecting Shopee.`)
      window.location.assign(target.href)
    }, 'Redirecting to Shopee…')
  }
  return <><OwnerPanel title="Shopee connection"><p>Authorize your shop to import products and manage Shopee orders.</p><ResourceState resource={resource} />{!resource.loading && !resource.error && <>
    {shop ? <DataTable label="Connected shops" headings={['Shop', 'Status', 'Connected', 'Token expiry']}><tr><td>{shop.shopName || shop.shopId}<p>{shop.shopId} · {shop.shopRegion}</p></td><td><strong>{shop.status}</strong>{shop.needsReconnect && <p>Authorization must be renewed.</p>}{shop.lastErrorCode && <p className={styles.error}>{shop.lastErrorCode} · {dateTime(shop.lastErrorAt)}</p>}</td><td>{dateTime(shop.connectedAt)}</td><td>{dateTime(shop.accessTokenExpiresAt)}</td></tr></DataTable> : <p>No Shopee shop connected.</p>}
    <div className={styles.actions}>{owner && <Button disabled={action.busy} onClick={connect}>{shop ? 'Reconnect Shopee' : 'Connect Shopee'}</Button>}<Button variant="outline" disabled={action.busy} onClick={resource.reload}>Refresh connection</Button>{owner && shop && shop.status !== 'DISCONNECTED' && <Button variant="destructive" disabled={action.busy} onClick={() => setConfirm(true)}>Disconnect Shopee</Button>}</div>
    {confirm && <div className={styles.message}><p>Disconnect this Shopee shop? Synchronization will stop.</p><div className={styles.actions}><Button variant="secondary" onClick={() => setConfirm(false)}>Keep connection</Button><Button variant="destructive" disabled={action.busy} onClick={() => action.run(shopeeApi.disconnect, 'Shopee disconnected.', () => { setConfirm(false); resource.reload() })}>Confirm disconnect</Button></div></div>}
    {shop?.status === 'CONNECTED' && <p><Link to="/merchant/staff/imports">Import products</Link> · <Link to="/merchant/staff/orders">View orders</Link></p>}
  </>}<Feedback value={action.feedback} /></OwnerPanel></>
}
