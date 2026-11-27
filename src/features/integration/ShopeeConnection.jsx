import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog'
import { shopeeApi } from '@/services/api/shopee'
import { marketplaces } from './marketplaces'
import { DataTable, Feedback, OwnerPanel } from '@/features/portal/components/OwnerWorkspaceUI'
import { useApiResource } from './useApiResource'
import { ResourceState } from './ShopeeShared'
import { dateTime, useApiAction } from './apiHelpers'
import styles from '@/features/portal/OwnerWorkspace.module.css'

// Return to the origin that holds this tab's session. TikTok matches redirect URIs exactly,
// so hosted TikTok keeps the BE default (TIKTOK_REDIRECT_URI) instead of a per-subdomain URI.
function callbackUrl(provider) {
  const { protocol, hostname, port, origin } = window.location
  const local = port && ['localhost', '127.0.0.1'].includes(hostname)
  const hosted = !port && protocol === 'https:' && (hostname === 'smartomni.vn' || hostname.endsWith('.smartomni.vn'))
  if (local || (hosted && provider === 'shopee')) return `${origin}/merchant/channels/${provider}/callback`
}

export default function ShopeeConnection({ session, provider = 'shopee' }) {
  const { name, api } = marketplaces[provider]
  const resource = useApiResource(api.connection)
  const action = useApiAction()
  const [confirm, setConfirm] = useState(false)
  const [showChannels, setShowChannels] = useState(false)
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
      const result = await api.authorize(callbackUrl(provider))
      const target = new URL(result.authorizationUrl)
      if (!['https:', 'http:'].includes(target.protocol)) throw new Error('Invalid authorization URL.')
      // Stay on this origin: the callback must be able to read this tab's session.
      const redirect = target.searchParams.get('redirect_uri') || target.searchParams.get('redirect')
      if (redirect && new URL(redirect).origin !== window.location.origin) throw new Error(`Open SmartOmni at ${new URL(redirect).origin} and sign in there before connecting ${name}.`)
      window.location.assign(target.href)
    }, `Redirecting to ${name}…`)
  }
  return <><OwnerPanel title={`${name} connection`}><p>Authorize your shop to import its products into your workspace.</p><ResourceState resource={resource} />{!resource.loading && !resource.error && <>
    {shop ? <DataTable label="Connected shops" headings={['Shop', 'Status', 'Connected', 'Token expiry']}><tr><td>{shop.shopName || shop.shopId}<p>{shop.shopId} · {shop.shopRegion}</p></td><td><strong>{shop.status}</strong>{provider === 'tiktok-shop' && (shop.grantedScopes?.length ? <p title={shop.grantedScopes.join(', ')}>{shop.grantedScopes.length} scopes granted</p> : <p className={styles.error}>Granted scopes are unknown. If an action fails with a permission error, reconnect the shop.</p>)}{shop.needsReconnect && <p>Authorization must be renewed.</p>}{shop.lastErrorCode && <p className={styles.error}>{shop.lastErrorCode} · {dateTime(shop.lastErrorAt)}</p>}</td><td>{dateTime(shop.connectedAt)}</td><td>{shop.refreshTokenExpiresAt ? <>{dateTime(shop.refreshTokenExpiresAt)}<p>Refresh token · access auto-refreshes ({dateTime(shop.accessTokenExpiresAt)})</p></> : dateTime(shop.accessTokenExpiresAt)}</td></tr></DataTable> : <p className={styles.empty}>No {name} shop connected.</p>}
    <div className={styles.actions}>{owner && <Button variant={shop && shop.status === 'CONNECTED' && !shop.needsReconnect ? 'outline' : undefined} disabled={action.busy} onClick={connect}>{shop ? `Reconnect ${name}` : `Connect ${name}`}</Button>}<Button variant="outline" disabled={action.busy} onClick={resource.reload}>Refresh connection</Button>{owner && shop && shop.status !== 'DISCONNECTED' && <Button variant="destructive" disabled={action.busy} onClick={() => setConfirm(true)}>Disconnect {name}</Button>}</div>
    {confirm && <div className={styles.message}><p>Disconnect this {name} shop? Synchronization will stop. You can keep synced products for reconnecting later, or wipe all catalog data from this shop.</p><div className={styles.actions}><Button variant="secondary" onClick={() => setConfirm(false)}>Keep connection</Button><Button variant="outline" disabled={action.busy} onClick={() => action.run(() => api.disconnect({ wipeCatalog: false }), `${name} disconnected.`, () => { setConfirm(false); resource.reload() })}>Disconnect (keep catalog)</Button><Button variant="destructive" disabled={action.busy} onClick={() => action.run(() => api.disconnect({ wipeCatalog: true }), `${name} disconnected and shop catalog wiped.`, () => { setConfirm(false); resource.reload() })}>Disconnect &amp; wipe shop data</Button></div></div>}
    {shop?.status === 'CONNECTED' && <div className={`${styles.actions} ${styles.relatedLinks}`}>
      <Link to={`/merchant/manager/imports?marketplace=${provider}`}>Import products</Link>
      <Link to={`/merchant/manager/orders?source=${provider === 'shopee' ? 'shopee' : 'tiktok'}`}>View orders</Link>
      {provider === 'shopee' && <Button variant="outline" onClick={() => setShowChannels(true)}>View shipping channels</Button>}
    </div>}
    {provider === 'shopee' && shop?.status === 'CONNECTED' && typeof shop.autoImportProducts === 'boolean' &&
      <label className={styles.field}>
        <input type="checkbox" checked={shop.autoImportProducts} disabled={!owner || action.busy}
          onChange={event => {
            const enabled = event.target.checked
            action.run(() => shopeeApi.updateSettings(enabled),
              enabled ? 'Automatic product import enabled.' : 'Automatic product import disabled.', resource.reload)
          }} />
        Automatically import products
      </label>}
  </>}<Feedback value={action.feedback} /></OwnerPanel>
  {showChannels && <ShopeeChannels close={() => setShowChannels(false)} />}
  </>
}

function ShopeeChannels({ close }) {
  const resource = useApiResource(shopeeApi.logisticsChannels)
  return <Dialog open onOpenChange={open => { if (!open) close() }}>
    <DialogContent className={`${styles.dialog} ${styles.marketplaceDialog}`}>
      <DialogTitle>Shopee shipping channels</DialogTitle>
      <DialogDescription>Shipping channels configured for your connected Shopee shop.</DialogDescription>
      <ResourceState resource={resource} />
      {!resource.loading && !resource.error && (resource.data?.length
        ? <DataTable label="Shopee shipping channels" headings={['Channel', 'Availability']}>
          {resource.data.map(channel => <tr key={channel.channelId}>
            <td>{channel.channelName || channel.channelId}</td>
            <td>{channel.enabled == null ? 'Status unknown' : channel.enabled ? 'Enabled' : 'Disabled'}
              <p>{channel.codEnabled == null ? 'Cash on delivery status unknown' : channel.codEnabled ? 'Cash on delivery available' : 'Cash on delivery unavailable'}</p>
            </td>
          </tr>)}
        </DataTable>
        : <p>Shopee returned no shipping channels.</p>)}
    </DialogContent>
  </Dialog>
}
