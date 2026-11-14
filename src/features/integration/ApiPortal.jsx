import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { Boxes, ChevronDown, CircleUserRound, CreditCard, LogOut, Menu, Package, PanelLeftClose, PanelLeftOpen, Sparkles, Store, Zap } from 'lucide-react'
import { Brand } from '@/shared/components/Brand'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/shared/ui/dialog'
import { useDemoSession } from '@/features/auth/hooks/useDemoSession'
import { signOutDemo } from '@/features/auth/lib/demoSession'
import { OwnerPanel } from '@/features/portal/components/OwnerWorkspaceUI'
import MarketplaceWorkspace from './MarketplaceWorkspace'
import ShopeeOrders from './ShopeeOrders'
import ShopeeReturns from './ShopeeReturns'
import TiktokSettlements from './TiktokSettlements'
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
import menu from './ApiPortal.module.css'

const merchantNavigation = [
  ['Channels', Store, [
    ['/merchant/shops', 'Shop connections'],
  ]],
  ['Catalog & stock', Boxes, [
    ['/merchant/staff/products', 'Products'],
    ['/merchant/staff/imports', 'Product imports'],
    ['/merchant/staff/prices', 'Price synchronization'],
    ['/merchant/staff/inventory', 'Stock adjustment'],
  ]],
  ['Orders', Package, [
    ['/merchant/staff/orders', 'Orders & shipping'],
    ['/merchant/staff/tracking', 'Order lookup'],
    ['/merchant/staff/returns', 'Returns & refunds'],
  ]],
  ['Finance', CreditCard, [
    ['/merchant/staff/settlements', 'TikTok settlements'],
  ]],
  ['Insights', Sparkles, [
    ['/merchant/forecasts', 'AI insights'],
  ]],
  ['Settings', CircleUserRound, [
    ['/merchant/settings/profile', 'Store settings'],
    ['/merchant/profile', 'Your profile'],
    ['/merchant/users', 'User accounts'],
  ]],
]
const adminNavigation = [['/admin/tenants', 'Tenants'], ['/admin/profile', 'Your profile']]
const marketplacePages = new Set(['/merchant/shops', '/merchant/staff/orders', '/merchant/staff/returns'])

export default function ApiPortal() {
  const session = useDemoSession()
  const { pathname } = useLocation()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  if (!session) return <Navigate to="/auth/login" replace />
  const admin = session.role === 'SUPER_ADMIN'
  const merchant = ['TENANT_OWNER', 'TENANT_STAFF'].includes(session.role)
  const customer = session.role === 'CUSTOMER'
  if (customer && pathname !== '/customer/profile') return <Navigate to="/customer/profile" replace />
  if (admin && !pathname.startsWith('/admin')) return <Navigate to="/admin/tenants" replace />
  if (!admin && pathname.startsWith('/admin')) return <Navigate to="/merchant/shops" replace />
  if (admin && pathname === '/admin') return <Navigate to="/admin/tenants" replace />
  if (merchant && ['/merchant/dashboard', '/merchant', '/merchant/channels'].includes(pathname)) return <Navigate to="/merchant/shops" replace />
  const groups = merchantNavigation.map(([label, Icon, items]) => [
    label, Icon, items.filter(([path]) => (
      (!['/merchant/settings/profile', '/merchant/staff/settlements'].includes(path) || session.role === 'TENANT_OWNER')
      && (path !== '/merchant/users' || canManageUsers(session))
    )),
  ]).filter(([, , items]) => items.length)
  const links = customer ? [['/customer/profile', 'Your profile']] : admin ? adminNavigation : groups.flatMap(([, , items]) => items)
  const activePath = pathname === '/merchant/staff/forecasts' ? '/merchant/forecasts' : pathname
  const current = links.find(([path]) => path === activePath)
  const settings = pathname === '/merchant/settings/profile'
  const marketplacePage = marketplacePages.has(pathname)
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
      '/merchant/staff/settlements': session.role === 'TENANT_OWNER' ? <TiktokSettlements /> : <OwnerPanel title="Owner access required"><p>Only the tenant Owner can view TikTok settlements.</p></OwnerPanel>,
      '/merchant/forecasts': <ApiInsights />,
      '/merchant/staff/forecasts': <ApiInsights />,
    }
    content = pages[pathname]
    if (!content) return <Navigate to={admin ? '/admin/tenants' : '/merchant/shops'} replace />
  }
  return <div className={merchant ? `${styles.shell} ${styles.merchantShell} ${menu.shell}` : styles.shell}
    data-sidebar-collapsed={merchant && sidebarCollapsed}>
    {merchant ? <MerchantSidebar key={pathname} groups={groups} activePath={activePath} session={session}
      collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} /> : <aside className={styles.sidebar} aria-label="Workspace navigation">
      <div className={styles.brand}><Brand /></div>
      <div className={styles.workspace}><span className={styles.storeIcon}><Store size={19} /></span><div><strong>{session.tenantName || 'SmartOmni'}</strong><span>{session.roleLabel}</span></div></div>
      <p className={styles.navLabel}>{admin ? 'PLATFORM' : 'WORKSPACE'}</p>
      <nav>{links.map(([path, label]) => <Link key={path} to={path} aria-current={path === pathname ? 'page' : undefined}>{label}</Link>)}</nav>
      <div className={styles.sidebarBottom}><p>Connected backend<span>{admin ? 'Platform administration' : `Tenant ${session.tenantId || '—'}`}</span></p><Button variant="ghost" onClick={() => { void signOutDemo().catch(() => { /* The local session is always cleared. */ }) }}><LogOut size={16} />Sign out</Button></div>
    </aside>}
    <div className={styles.main}>
      <header className={merchant ? `${styles.topbar} ${menu.topbar}` : styles.topbar}><span>{admin ? 'Platform' : 'Workspace'}<span className={styles.slash}>/</span><strong>{current?.[1] || 'Your workspace'}</strong></span><span className={styles.demoBadge}>API mode</span></header>
      <main id="main-content" tabIndex={-1} className={marketplacePage ? `${styles.content} ${styles.marketplaceContent}` : styles.content}><div className={marketplacePage ? `${workspace.page} ${workspace.marketplacePage}` : workspace.page}>
        {!settings && <div className={workspace.heading}><h1>{current?.[1] || 'Your workspace'}</h1><p>{session.name} · {session.tenantDomain || session.roleLabel}</p></div>}
        {content}
      </div></main>
    </div>
  </div>
}

function MerchantSidebar({ groups, activePath, session, collapsed, setCollapsed }) {
  const activeGroup = groups.find(([, , items]) => items.some(([path]) => path === activePath))?.[0]
  const [openGroup, setOpenGroup] = useState(activeGroup)
  const [mobileOpen, setMobileOpen] = useState(false)

  return <aside className={menu.sidebar} aria-label="Workspace navigation" data-mobile-open={mobileOpen}>
    <div className={menu.header}>
      <Brand className={menu.wordmark} />
      <Button variant="ghost" size="icon" className={menu.desktopToggle}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-expanded={!collapsed} aria-controls="merchant-navigation" onClick={() => setCollapsed(!collapsed)}>
        {collapsed ? <PanelLeftOpen size={18} aria-hidden="true" /> : <PanelLeftClose size={18} aria-hidden="true" />}
      </Button>
      <Button variant="ghost" size="icon" className={menu.mobileToggle} aria-label="Workspace menu"
        aria-expanded={mobileOpen} aria-controls="merchant-navigation" onClick={() => setMobileOpen(open => !open)}>
        <Menu size={18} aria-hidden="true" />
      </Button>
    </div>
    <div className={menu.body} id="merchant-navigation">
      <nav aria-label="Workspace features" className={menu.navigation}>
        {groups.map(([label, Icon, items], index) => {
          const open = openGroup === label && (!collapsed || mobileOpen)
          const groupId = `merchant-nav-group-${index}`
          return <div key={label}>
            <button type="button" className={menu.group} aria-expanded={open} aria-controls={groupId}
              data-active={activeGroup === label} title={label} onClick={() => {
                const iconOnly = collapsed && window.matchMedia('(min-width: 701px)').matches
                if (iconOnly) setCollapsed(false)
                setOpenGroup(iconOnly || !open ? label : null)
              }}>
              <Icon size={18} aria-hidden="true" />
              <span className={menu.groupLabel}>{label}</span>
              <ChevronDown size={15} aria-hidden="true" className={menu.chevron} />
            </button>
            <div id={groupId} className={menu.children} hidden={!open}>
              {items.map(([path, name]) => <Link key={path} to={path} aria-current={path === activePath ? 'page' : undefined}
                onClick={() => setMobileOpen(false)}>{name}</Link>)}
            </div>
          </div>
        })}
      </nav>
      {session.role === 'TENANT_OWNER' && session.tenantId && <UpgradeCard />}
      <div className={menu.account}>
        <div><strong>{session.tenantName || 'SmartOmni'}</strong><span>{session.roleLabel}</span></div>
        <Button variant="ghost" size="icon" aria-label="Sign out" title="Sign out"
          onClick={() => { void signOutDemo().catch(() => { /* The local session is always cleared. */ }) }}>
          <LogOut size={16} aria-hidden="true" />
        </Button>
      </div>
    </div>
  </aside>
}

function UpgradeCard() {
  return <Dialog>
    <section className={menu.upgrade} aria-label="Workspace upgrade">
      <div className={menu.upgradeIntro}>
        <Sparkles size={16} aria-hidden="true" />
        <div><strong>SmartOmni Pro</strong><p>More sales channels and AI insights.</p></div>
      </div>
      <DialogTrigger asChild>
        <Button className={menu.upgradeButton} aria-label="Upgrade to Pro" title="Upgrade to Pro">
          <Zap size={16} aria-hidden="true" /><span>Upgrade to Pro</span>
        </Button>
      </DialogTrigger>
    </section>
    <DialogContent>
      <DialogTitle>Upgrade to Pro</DialogTitle>
      <DialogDescription>Plan upgrades are currently unavailable for this workspace.</DialogDescription>
      <ul className={menu.proFeatures}>
        <li>Connect more marketplace shops</li>
        <li>Access demand forecasts and recommendations</li>
      </ul>
    </DialogContent>
  </Dialog>
}
