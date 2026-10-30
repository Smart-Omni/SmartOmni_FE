import { Link, Navigate, useLocation } from 'react-router-dom'
import { LogOut, Store } from 'lucide-react'
import { Brand } from '@/shared/components/Brand'
import { Button } from '@/shared/ui/button'
import { useDemoSession } from '@/features/auth/hooks/useDemoSession'
import { signOutDemo } from '@/features/auth/lib/demoSession'
import { OwnerPanel } from '@/features/portal/components/OwnerWorkspaceUI'
import MarketplaceWorkspace from './MarketplaceWorkspace'
import ShopeeOrders from './ShopeeOrders'
import ShopeeReturns from './ShopeeReturns'
import ApiStoreSettings from '@/features/portal/ApiStoreSettings'
import ApiProducts from './ApiProducts'
import ApiInventory from './ApiInventory'
import ApiInsights from './ApiInsights'
import ApiTenants from './ApiTenants'
import ApiOrderLookup from './ApiOrderLookup'
import ApiProfile from './ApiProfile'
import ApiUsers from './ApiUsers'
import { canManageUsers } from '@/services/api/users'
import styles from '@/features/portal/PortalPage.module.css'
import workspace from '@/features/portal/OwnerWorkspace.module.css'

const merchantNavigation = [
  ['/merchant/shops', 'Shop connections'],
  ['/merchant/staff/products', 'Products'],
  ['/merchant/staff/imports', 'Product imports'],
  ['/merchant/staff/prices', 'Price synchronization'],
  ['/merchant/staff/inventory', 'Stock adjustment'],
  ['/merchant/staff/orders', 'Orders & shipping'],
  ['/merchant/staff/tracking', 'Order lookup'],
  ['/merchant/staff/returns', 'Returns & refunds'],
  ['/merchant/forecasts', 'AI insights'],
  ['/merchant/settings/profile', 'Store settings'],
  ['/merchant/profile', 'Your profile'],
  ['/merchant/users', 'User accounts'],
]
const adminNavigation = [['/admin/tenants', 'Tenants'], ['/admin/profile', 'Your profile']]

export default function ApiPortal() {
  const session = useDemoSession()
  const { pathname } = useLocation()
  if (!session) return <Navigate to="/auth/login" replace />
  const admin = session.role === 'SUPER_ADMIN'
  const merchant = ['TENANT_OWNER', 'TENANT_STAFF'].includes(session.role)
  const customer = session.role === 'CUSTOMER'
  if (customer && pathname !== '/customer/profile') return <Navigate to="/customer/profile" replace />
  if (admin && !pathname.startsWith('/admin')) return <Navigate to="/admin/tenants" replace />
  if (!admin && pathname.startsWith('/admin')) return <Navigate to="/merchant/shops" replace />
  if (admin && pathname === '/admin') return <Navigate to="/admin/tenants" replace />
  if (merchant && ['/merchant/dashboard', '/merchant', '/merchant/channels'].includes(pathname)) return <Navigate to="/merchant/shops" replace />
  const links = customer ? [['/customer/profile', 'Your profile']] : admin ? adminNavigation : merchantNavigation.filter(([path]) => (path !== '/merchant/settings/profile' || session.role === 'TENANT_OWNER') && (path !== '/merchant/users' || canManageUsers(session)))
  const current = links.find(([path]) => path === pathname)
  const settings = pathname === '/merchant/settings/profile'
  let content
  if (['/merchant/profile', '/admin/profile', '/customer/profile'].includes(pathname)) {
    content = <ApiProfile />
  } else if (pathname === '/merchant/users') {
    content = <ApiUsers session={session} />
  } else if (admin && pathname === '/admin/tenants') {
    content = <ApiTenants />
  } else if (settings) {
    content = session.role === 'TENANT_OWNER' && session.tenantId ? <ApiStoreSettings /> : <OwnerPanel title="Owner access required"><p>Only the tenant Owner can edit storefront settings.</p></OwnerPanel>
  } else if (!admin && (!merchant || !session.tenantId)) {
    content = <OwnerPanel title="Workspace unavailable"><p>This account has no tenant workspace assigned. Contact your administrator.</p></OwnerPanel>
  } else {
    const pages = {
      '/merchant/shops': <MarketplaceWorkspace session={session} screen="shops" />,
      '/merchant/staff/imports': <MarketplaceWorkspace session={session} screen="imports" />,
      '/merchant/staff/prices': <MarketplaceWorkspace session={session} screen="prices" />,
      '/merchant/staff/products': <ApiProducts />,
      '/merchant/staff/inventory': <ApiInventory />,
      '/merchant/staff/orders': <ShopeeOrders />,
      '/merchant/staff/tracking': <ApiOrderLookup />,
      '/merchant/staff/returns': <ShopeeReturns />,
      '/merchant/forecasts': <ApiInsights />,
      '/merchant/staff/forecasts': <ApiInsights />,
    }
    content = pages[pathname] || <OwnerPanel title="This page is not connected yet"><p>This workspace feature is not available yet.</p><Link to={admin ? '/admin/tenants' : '/merchant/shops'}>Back to workspace</Link></OwnerPanel>
  }
  return <div className={styles.shell}>
    <aside className={styles.sidebar} aria-label="Workspace navigation">
      <div className={styles.brand}><Brand /></div>
      <div className={styles.workspace}><span className={styles.storeIcon}><Store size={19} /></span><div><strong>{session.tenantName || 'SmartOmni'}</strong><span>{session.roleLabel}</span></div></div>
      <p className={styles.navLabel}>{admin ? 'PLATFORM' : 'WORKSPACE'}</p>
      <nav>{links.map(([path, label]) => <Link key={path} to={path} aria-current={path === pathname ? 'page' : undefined}>{label}</Link>)}</nav>
      <div className={styles.sidebarBottom}><p>Connected backend<span>{admin ? 'Platform administration' : `Tenant ${session.tenantId || '—'}`}</span></p><Button variant="ghost" onClick={() => { void signOutDemo().catch(() => { /* The local session is always cleared. */ }) }}><LogOut size={16} />Sign out</Button></div>
    </aside>
    <div className={styles.main}>
      <header className={styles.topbar}><span>{admin ? 'Platform' : 'Workspace'}<span className={styles.slash}>/</span><strong>{current?.[1] || 'Your workspace'}</strong></span><span className={styles.demoBadge}>API mode</span></header>
      <main id="main-content" tabIndex={-1} className={styles.content}><div className={workspace.page}>
        {!settings && <div className={workspace.heading}><h1>{current?.[1] || 'Your workspace'}</h1><p>{session.name} · {session.tenantDomain || session.roleLabel}</p></div>}
        {content}
      </div></main>
    </div>
  </div>
}
