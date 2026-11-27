import { lazy, Suspense } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTenantFeatures } from '@/features/auth/hooks/useTenantFeatures'
import { OwnerPanel, SummaryMetrics } from '@/features/portal/components/OwnerWorkspaceUI'
import { managerCan, managerScreens, managerScreenGroups } from './data/managerNavigation'
import { availableStock, useManagerData } from './lib/managerStore'
import ManagerProducts from './ManagerProducts'
import ManagerPrices from './ManagerPrices'
import ManagerInventory from './ManagerInventory'
import ManagerMapping from './ManagerMapping'
import ManagerOrders from './ManagerOrders'
import ManagerSync from './ManagerSync'
import ManagerConversations from './ManagerConversations'
import ManagerReturns from './ManagerReturns'
import ManagerCases from './ManagerCases'
import styles from '@/features/portal/OwnerWorkspace.module.css'
import managerStyles from './ManagerSupport.module.css'
const ManagerBusinessWorkspace = lazy(() => import('./ManagerBusinessWorkspace'))

export default function ManagerConsole({ session, overview = false }) {
  const { pathname } = useLocation()
  const data = useManagerData(session.tenantId)
  const features = useTenantFeatures(session.tenantId)
  const screen = overview ? 'overview' : pathname.split('/').at(-1)
  const title = overview ? 'Your workspace' : managerScreens.find(([id]) => id === screen)?.[1]
  const lowStock = data.inventory.filter(row => availableStock(row) < 10)
  const group = managerScreenGroups.find(items => items.includes(screen)) || managerScreenGroups[0]
  return <div className={styles.page}><div className={styles.heading}><h1>{title}</h1><p>Tenant Manager · {session.name} · Everyday Studio</p><p className={styles.note}>Assigned demo subdomain: <strong>{session.tenantDomain}</strong> · tenant ID: {session.tenantId}. Local preview binding; no DNS subdomain is provisioned.</p></div><nav className={`${styles.tabs} ${managerStyles.operationTabs}`} aria-label="Manager operation pages">{managerScreens.filter(([id, , permissions]) => group.includes(id) && managerCan(session, permissions)).map(([id, label]) => <Link key={id} to={`/merchant/manager/${id}?tenant=${session.tenantDomain}`} aria-current={id === screen ? 'page' : undefined}>{label}</Link>)}</nav>
    {overview ? <>
      <SummaryMetrics items={[["Membership", 'Active'], ['Assigned tenant', session.tenantDomain], ['Granted permissions', session.permissions.length]]} />
      {session.permissions.includes('orders:read') && <OwnerPanel title="Recent orders"><ul className={styles.list}>{data.orders.map(order => <li key={order.id}><strong>{order.id}</strong><p>{order.customer} · {order.status} · {order.shipment?.status || 'Not arranged'}</p></li>)}</ul></OwnerPanel>}
      {session.permissions.includes('inventory:read') && features.inventoryAlerts && <OwnerPanel title="Inventory alerts"><ul className={styles.list}>{lowStock.map(row => <li key={row.id}><strong>{row.sku}</strong><p>{row.warehouseId} · {availableStock(row)} available</p></li>)}</ul></OwnerPanel>}
      {!managerScreens.some(([, , permissions]) => managerCan(session, permissions)) && <OwnerPanel title="No enabled views"><p>Ask the Owner to review your permissions.</p></OwnerPanel>}
    </> : ['products', 'imports'].includes(screen) ? <ManagerProducts key={screen} screen={screen} data={data} session={session} /> : screen === 'prices' ? <ManagerPrices data={data} /> : screen === 'inventory' ? <ManagerInventory data={data} session={session} /> : screen === 'mapping' ? <ManagerMapping data={data} session={session} /> : screen === 'orders' ? <ManagerOrders data={data} session={session} /> : screen === 'conversations' ? <ManagerConversations data={data} session={session} /> : screen === 'returns' ? <ManagerReturns data={data} session={session} /> : ['disputes', 'complaints'].includes(screen) ? <ManagerCases key={screen} screen={screen} data={data} session={session} /> : ['business', 'sales-events', 'forecasts', 'costs', 'profit', 'advisor', 'strategy'].includes(screen) ? <Suspense fallback={<p role="status">Loading business workspace…</p>}><ManagerBusinessWorkspace key={screen} screen={screen} session={session} data={data} /></Suspense> : <ManagerSync data={data} session={session} />}
    <p className={styles.note}>Manager demo · tenant-scoped browser data · no live imports, marketplace sync, carrier booking or official labels. Settings and billing remain Owner-only. Business views follow the permissions granted by your Owner.</p>
  </div>
}
