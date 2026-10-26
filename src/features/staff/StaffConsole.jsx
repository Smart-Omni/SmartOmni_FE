import { lazy, Suspense } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTenantFeatures } from '@/features/auth/hooks/useTenantFeatures'
import { OwnerPanel, SummaryMetrics } from '@/features/portal/components/OwnerWorkspaceUI'
import { staffCan, staffScreens, staffScreenGroups } from './data/staffNavigation'
import { availableStock, useStaffData } from './lib/staffStore'
import StaffProducts from './StaffProducts'
import StaffPrices from './StaffPrices'
import StaffInventory from './StaffInventory'
import StaffMapping from './StaffMapping'
import StaffOrders from './StaffOrders'
import StaffSync from './StaffSync'
import StaffConversations from './StaffConversations'
import StaffReturns from './StaffReturns'
import StaffCases from './StaffCases'
import styles from '@/features/portal/OwnerWorkspace.module.css'
import staffStyles from './StaffSupport.module.css'
const StaffBusinessWorkspace = lazy(() => import('./StaffBusinessWorkspace'))

export default function StaffConsole({ session, overview = false }) {
  const { pathname } = useLocation()
  const data = useStaffData(session.tenantId)
  const features = useTenantFeatures(session.tenantId)
  const screen = overview ? 'overview' : pathname.split('/').at(-1)
  const title = overview ? 'Your workspace' : staffScreens.find(([id]) => id === screen)?.[1]
  const lowStock = data.inventory.filter(row => availableStock(row) < 10)
  const group = staffScreenGroups.find(items => items.includes(screen)) || staffScreenGroups[0]
  return <div className={styles.page}><div className={styles.heading}><h1>{title}</h1><p>Tenant Staff · {session.name} · Everyday Studio</p><p className={styles.note}>Assigned demo subdomain: <strong>{session.tenantDomain}</strong> · tenant ID: {session.tenantId}. Local preview binding; no DNS subdomain is provisioned.</p></div><nav className={`${styles.tabs} ${staffStyles.operationTabs}`} aria-label="Staff operation pages">{staffScreens.filter(([id, , permissions]) => group.includes(id) && staffCan(session, permissions)).map(([id, label]) => <Link key={id} to={`/merchant/staff/${id}?tenant=${session.tenantDomain}`} aria-current={id === screen ? 'page' : undefined}>{label}</Link>)}</nav>
    {overview ? <>
      <SummaryMetrics items={[["Membership", 'Active'], ['Assigned tenant', session.tenantDomain], ['Granted permissions', session.permissions.length]]} />
      {session.permissions.includes('orders:read') && <OwnerPanel title="Recent orders"><ul className={styles.list}>{data.orders.map(order => <li key={order.id}><strong>{order.id}</strong><p>{order.customer} · {order.status} · {order.shipment?.status || 'Not arranged'}</p></li>)}</ul></OwnerPanel>}
      {session.permissions.includes('inventory:read') && features.inventoryAlerts && <OwnerPanel title="Inventory alerts"><ul className={styles.list}>{lowStock.map(row => <li key={row.id}><strong>{row.sku}</strong><p>{row.warehouseId} · {availableStock(row)} available</p></li>)}</ul></OwnerPanel>}
      {!staffScreens.some(([, , permissions]) => staffCan(session, permissions)) && <OwnerPanel title="No enabled views"><p>Ask the Owner to review your permissions.</p></OwnerPanel>}
    </> : ['products', 'imports'].includes(screen) ? <StaffProducts key={screen} screen={screen} data={data} session={session} /> : screen === 'prices' ? <StaffPrices data={data} /> : screen === 'inventory' ? <StaffInventory data={data} session={session} /> : screen === 'mapping' ? <StaffMapping data={data} session={session} /> : screen === 'orders' ? <StaffOrders data={data} session={session} /> : screen === 'conversations' ? <StaffConversations data={data} session={session} /> : screen === 'returns' ? <StaffReturns data={data} session={session} /> : ['disputes', 'complaints'].includes(screen) ? <StaffCases key={screen} screen={screen} data={data} session={session} /> : ['business', 'sales-events', 'forecasts', 'costs', 'profit', 'advisor', 'strategy'].includes(screen) ? <Suspense fallback={<p role="status">Loading business workspace…</p>}><StaffBusinessWorkspace key={screen} screen={screen} session={session} data={data} /></Suspense> : <StaffSync data={data} session={session} />}
    <p className={styles.note}>Staff demo · tenant-scoped browser data · no live imports, marketplace sync, carrier booking or official labels. Settings and billing remain Owner-only. Business views follow the permissions granted by your Owner.</p>
  </div>
}
