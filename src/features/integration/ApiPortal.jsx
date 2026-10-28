import { Link, Navigate, useLocation } from 'react-router-dom'
import { LogOut, Store } from 'lucide-react'
import { Brand } from '@/shared/components/Brand'
import { Button } from '@/shared/ui/button'
import { useDemoSession } from '@/features/auth/hooks/useDemoSession'
import { signOutDemo } from '@/features/auth/lib/demoSession'
import { OwnerPanel } from '@/features/portal/components/OwnerWorkspaceUI'
import ShopeeConnection from './ShopeeConnection'
import ShopeeCatalog from './ShopeeCatalog'
import ShopeeOrders from './ShopeeOrders'
import ShopeeReturns from './ShopeeReturns'
import ApiStoreSettings from '@/features/portal/ApiStoreSettings'
import styles from '@/features/portal/PortalPage.module.css'
import workspace from '@/features/portal/OwnerWorkspace.module.css'

const navigation = [
  ['/merchant/shops', 'Shop connections'], ['/merchant/staff/imports', 'Product imports'],
  ['/merchant/staff/prices', 'Price synchronization'], ['/merchant/staff/orders', 'Orders & shipping'],
  ['/merchant/staff/returns', 'Returns & refunds'], ['/merchant/settings/profile', 'Store settings'], ['/merchant/profile', 'Your profile'],
]

export default function ApiPortal() {
  const session = useDemoSession()
  const { pathname } = useLocation()
  if (!session) return <Navigate to="/auth/login" replace />
  const merchant = ['TENANT_OWNER', 'TENANT_STAFF'].includes(session.role)
  if (merchant && ['/merchant/dashboard', '/merchant', '/merchant/channels'].includes(pathname)) return <Navigate to="/merchant/shops" replace />
  const current = navigation.find(([path]) => path === pathname)
  const links = merchant ? navigation.filter(([path]) => path !== '/merchant/settings/profile' || session.role === 'TENANT_OWNER') : [['/admin/profile', 'Your profile']]
  return <div className={styles.shell}>
    <aside className={styles.sidebar} aria-label="Workspace navigation"><div className={styles.brand}><Brand /></div><div className={styles.workspace}><span className={styles.storeIcon}><Store size={19} /></span><div><strong>{session.tenantName || 'SmartOmni'}</strong><span>{session.roleLabel}</span></div></div><p className={styles.navLabel}>WORKSPACE</p><nav>{links.map(([path, label]) => <Link key={path} to={path} aria-current={path === pathname ? 'page' : undefined}>{label}</Link>)}</nav><div className={styles.sidebarBottom}><p>Connected backend<span>Tenant {session.tenantId || '—'}</span></p><Button variant="ghost" onClick={() => { void signOutDemo().catch(() => { /* Local session is cleared even when logout is unavailable. */ }) }}><LogOut size={16} />Sign out</Button></div></aside>
    <div className={styles.main}><header className={styles.topbar}><span>Workspace<span className={styles.slash}>/</span><strong>{current?.[1] || 'Your workspace'}</strong></span><span className={styles.demoBadge}>API mode</span></header><main id="main-content" tabIndex={-1} className={styles.content}><div className={workspace.page}>{pathname !== '/merchant/settings/profile' && <div className={workspace.heading}><h1>{current?.[1] || 'Your workspace'}</h1><p>{session.name} · {session.tenantDomain || session.roleLabel}</p></div>}
      {pathname === '/merchant/settings/profile' ? session.role === 'TENANT_OWNER' ? <ApiStoreSettings /> : <OwnerPanel title="Owner access required"><p>Only the tenant Owner can edit storefront settings.</p></OwnerPanel>
        : pathname.endsWith('/profile') ? <OwnerPanel title="Personal information"><dl className={workspace.details}>{[['Name', session.name], ['Email', session.email], ['Role', session.roleLabel], ['Tenant', session.tenantDomain || session.tenantId || '—']].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></OwnerPanel>
        : !merchant || !session.tenantId ? <OwnerPanel title="Workspace unavailable"><p>{merchant ? 'This account has no tenant assigned. Contact your administrator.' : 'Shopee operations require a tenant Owner or Staff account. This role has no connected workspace in this integration.'}</p></OwnerPanel>
        : pathname === '/merchant/shops' ? <ShopeeConnection session={session} />
        : ['/merchant/staff/imports', '/merchant/staff/products', '/merchant/staff/prices'].includes(pathname) ? <ShopeeCatalog key={pathname} screen={pathname.endsWith('/prices') ? 'prices' : 'imports'} />
        : pathname === '/merchant/staff/orders' ? <ShopeeOrders />
        : pathname === '/merchant/staff/returns' ? <ShopeeReturns />
        : <OwnerPanel title="This page is not connected yet"><p>The current backend does not provide all APIs used by the preview screens.</p><Link to="/merchant/shops">Open shop connections</Link></OwnerPanel>}
    </div></main></div>
  </div>
}
