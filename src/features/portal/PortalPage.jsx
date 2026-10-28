import { lazy, Suspense, useEffect } from 'react'
import { Activity, Bell, Boxes, Building2, CircleUserRound, CreditCard, LayoutDashboard, Link2, LockKeyhole, LogOut, Package, ScrollText, ShieldCheck, Store } from 'lucide-react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Brand } from '@/shared/components/Brand'
import { Button } from '@/shared/ui/button'
import { useDemoSession } from '@/features/auth/hooks/useDemoSession'
import { signOutDemo } from '@/features/auth/lib/demoSession'
import { useTenantAccess } from '@/features/auth/hooks/useTenantAccess'
import { useTenantFeatures } from '@/features/auth/hooks/useTenantFeatures'
import { recordDemoSecurityEvent } from '@/features/auth/lib/demoSecurityLog'
import { ownerNavigationGroups, ownerScreens } from './data/ownerNavigation'
import { staffCan, staffScreens } from '@/features/staff/data/staffNavigation'
import styles from './PortalPage.module.css'
import { apiMode } from '@/services/api/config'
const ApiPortal = lazy(() => import('@/features/integration/ApiPortal'))

const OwnerDashboard = lazy(() => import('./OwnerDashboard'))
const AdminConsole = lazy(() => import('@/features/platform/AdminConsole'))
const StoreSettings = lazy(() => import('./StoreSettings'))
const TeamPage = lazy(() => import('./TeamPage'))
const StaffWorkspace = lazy(() => import('./StaffWorkspace'))
const StaffInvitations = lazy(() => import('./StaffInvitations'))
const OwnerConsole = lazy(() => import('./OwnerConsole'))
const StaffConsole = lazy(() => import('@/features/staff/StaffConsole'))

export function PortalPage() {
  return apiMode ? <Suspense fallback={<p role="status">Loading workspace…</p>}><ApiPortal /></Suspense> : <DemoPortalPage />
}

function DemoPortalPage() {
  const session = useDemoSession()
  const tenantStatus = useTenantAccess(session?.tenantId)
  const tenantFeatures = useTenantFeatures(session?.tenantId)
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  useEffect(() => {
    if (session && ((session.role !== 'SUPER_ADMIN' && pathname.startsWith('/admin')) || (session.role === 'SUPER_ADMIN' && pathname.startsWith('/merchant')))) recordDemoSecurityEvent({ type: 'ACCESS_DENIED', severity: 'WARNING', actor: `${session.roleLabel} demo`, result: 'Blocked', message: 'The demo role is not allowed to access this portal.', resource: pathname })
  }, [session, pathname])
  if (!session) return <Navigate to="/auth/login" replace />
  if (session.role === 'CUSTOMER') return <Navigate to="/customer" replace />
  const admin = session.role === 'SUPER_ADMIN'
  if (admin && !pathname.startsWith('/admin')) return <Navigate to="/admin" replace />
  if (!admin && pathname.startsWith('/admin')) return <Navigate to="/merchant/dashboard" replace />
  const base = admin ? '/admin' : '/merchant'
  const profile = pathname === `${base}/profile`
  const notifications = pathname === `${base}/notifications`
  if (admin && notifications) return <Navigate to="/admin/shop-alerts" replace />
  const home = admin ? '/admin' : '/merchant/dashboard'
  const storeSettings = ['/merchant/settings/profile', '/merchant/settings/appearance', '/merchant/settings/policies'].includes(pathname)
  const teamPage = pathname === '/merchant/team'
  const ownerScreen = ownerScreens.find(([id]) => pathname === `/merchant/${id}`)
  const staffScreen = staffScreens.find(([id]) => pathname === `/merchant/staff/${id}`)
  const ownerPage = storeSettings || teamPage || Boolean(ownerScreen)
  if (!admin && ![home, `${base}/profile`, `${base}/notifications`].includes(pathname) && !ownerPage && !staffScreen) return <Navigate to={home} replace />
  const suspended = tenantStatus === 'SUSPENDED'
  const ownerAccess = !suspended && session.role === 'TENANT_OWNER' && session.membershipStatus === 'ACTIVE' && session.onboardingStatus === 'COMPLETED'
  const staffAccess = !suspended && session.role === 'TENANT_STAFF' && session.membershipStatus === 'ACTIVE'
  if (ownerPage && !ownerAccess) return <Navigate to={home} replace />
  if (staffScreen && (!staffAccess || !staffCan(session, staffScreen[2]))) return <Navigate to={home} replace />
  const requestedDomain = new URLSearchParams(search).get('tenant')
  const wrongStaffDomain = staffAccess && requestedDomain && requestedDomain !== session.tenantDomain
  const title = staffScreen ? staffScreen[1] : ownerScreen ? ownerScreen[1] : storeSettings ? 'Store settings' : teamPage ? 'Team' : profile ? 'Your profile' : notifications ? 'Notifications' : admin ? pathname.startsWith('/admin/tenants') ? 'Tenants' : pathname === '/admin/plans' ? 'Plans & limits' : pathname === '/admin/audit' ? 'Action log' : pathname === '/admin/security' ? 'Security logs' : pathname.startsWith('/admin/shop-alerts') ? 'Shop connection alerts' : pathname.startsWith('/admin/operations') ? 'Operational alerts' : 'Platform overview' : 'Overview'
  const navigation = admin ? [[home, LayoutDashboard, 'Overview'], ['/admin/tenants', Building2, 'Tenants'], ['/admin/plans', CreditCard, 'Plans & limits'], ['/admin/shop-alerts', Link2, 'Shop alerts'], ['/admin/operations', Activity, 'Operational alerts'], ['/admin/audit', ScrollText, 'Activity log'], ['/admin/security', ShieldCheck, 'Security logs'], [`${base}/profile`, CircleUserRound, 'Your profile']] : [[home, LayoutDashboard, 'Overview'], [`${base}/notifications`, Bell, 'Notifications'], [`${base}/profile`, CircleUserRound, 'Your profile']]
  function logout() { signOutDemo(); navigate('/auth/login', { replace: true }) }
  return <div className={styles.shell}>
    <aside className={`${styles.sidebar} ${admin ? styles.platformSidebar : ''}`} aria-label="Workspace navigation">
      <div className={styles.brand}><Brand /></div>
      <div className={styles.workspace}><span className={styles.storeIcon}>{admin ? <ShieldCheck size={19} /> : <Store size={19} />}</span><div><strong>{session.tenantName || (admin ? 'SmartOmni Platform' : 'Your workspace')}</strong><span>{session.roleLabel}</span></div></div>
      <p className={styles.navLabel}>{admin ? 'PLATFORM' : 'WORKSPACE'}</p>
      {admin && <label className={styles.platformMobileNav}><span className="sr-only">Platform navigation</span><select aria-label="Platform navigation" value={navigation.find(([to]) => to !== '/admin' && pathname.startsWith(to))?.[0] || '/admin'} onChange={event => navigate(event.target.value)}>{navigation.map(([to, , label]) => <option value={to} key={to}>{label}</option>)}</select></label>}
      {ownerAccess && <label className={styles.platformMobileNav}><span className="sr-only">Workspace page</span><select aria-label="Workspace page" value={storeSettings ? '/merchant/settings/profile' : pathname} onChange={event => navigate(event.target.value)}>{[...navigation.map(([to, , label]) => [to, label]), ['/merchant/settings/profile', 'Store settings'], ['/merchant/team', 'Team'], ...ownerScreens.map(([id, label]) => [`/merchant/${id}`, label])].map(([to, label]) => <option key={to} value={to}>{label}</option>)}</select></label>}
      {staffAccess && <label className={styles.platformMobileNav}><span className="sr-only">Staff workspace page</span><select aria-label="Staff workspace page" value={pathname} onChange={event => navigate(`${event.target.value}?tenant=${session.tenantDomain}`)}>{[...navigation.map(([to, , label]) => [to, label]), ...staffScreens.filter(([, , permissions]) => staffCan(session, permissions)).map(([id, label]) => [`/merchant/staff/${id}`, label])].map(([to, label]) => <option key={to} value={to}>{label}</option>)}</select></label>}
      <nav>{navigation.map(([to, Icon, label]) => <Link key={to} to={to} aria-current={pathname === to || (to !== home && pathname.startsWith(to + '/')) ? 'page' : undefined}><Icon size={18} aria-hidden="true" />{label}{label === 'Overview' && !ownerAccess && !staffAccess && !admin && <LockKeyhole size={14} className={styles.navLock} aria-label="Locked" />}</Link>)}</nav>
      {ownerAccess && <><p className={styles.navLabel}>STORE OPERATIONS</p><nav>{[['orders', 'Recent orders', Package], ...(tenantFeatures.inventoryAlerts ? [['inventory', 'Inventory alerts', Boxes]] : []), ['channels', 'Sales channels', Store]].map(([id, label, Icon]) => <a key={id} href={`${home}#${id}`}><Icon size={18} aria-hidden="true" />{label}</a>)}<Link to="/merchant/settings/profile" aria-current={storeSettings ? 'page' : undefined}><Store size={18} />Store settings</Link><Link to="/merchant/team" aria-current={teamPage ? 'page' : undefined}><CircleUserRound size={18} />Team</Link></nav></>}
      {ownerAccess && <><p className={styles.navLabel}>BUSINESS WORKSPACE</p><nav>{ownerNavigationGroups.map(([id, label, screens], index) => { const Icon = [CreditCard, Link2, CircleUserRound, Package, LayoutDashboard, Activity, ShieldCheck][index]; return <Link key={id} to={`/merchant/${id}`} aria-current={screens.some(screen => pathname === `/merchant/${screen}`) ? 'page' : undefined}><Icon size={18} aria-hidden="true" />{label}</Link> })}</nav></>}
      {staffAccess && <><p className={styles.navLabel}>STAFF OPERATIONS</p><nav>{staffScreens.filter(([, , permissions]) => staffCan(session, permissions)).map(([id, label], index) => { const Icon = [Package, Store, CreditCard, Boxes, Link2, ScrollText, Activity][index] || ScrollText; return <Link key={id} to={`/merchant/staff/${id}?tenant=${session.tenantDomain}`} aria-current={staffScreen?.[0] === id ? 'page' : undefined}><Icon size={18} aria-hidden="true" />{label}</Link> })}</nav></>}
      <div className={styles.sidebarBottom}><p>Demo workspace<span>Sample data. No live connections.</span></p><Button variant="ghost" onClick={logout}><LogOut size={16} aria-hidden="true" />Sign out</Button></div>
    </aside>
    <div className={styles.main}>
      <header className={styles.topbar}><span>{admin ? 'Platform' : 'Workspace'}<span className={styles.slash}>/</span><strong>{title}</strong></span><div><span className={styles.demoBadge}>Demo mode</span><Link className={styles.bell} to={`${base}/notifications`} aria-label="Notifications"><Bell size={18} /></Link><Link className={styles.avatar} to={`${base}/profile`} aria-label="Your profile">{session.name.split(' ').map(word => word[0]).join('')}</Link><Button variant="ghost" size="icon" className={styles.mobileLogout} aria-label="Sign out" onClick={logout}><LogOut size={18} /></Button></div></header>
      <main id="main-content" tabIndex={-1} className={styles.content}>
        {profile ? <><div className={styles.pageHeading}><p>ACCOUNT</p><h1>Your profile</h1></div><section className={styles.accountCard}><h2>Personal information</h2><dl><dt>Full name</dt><dd>{session.name}</dd><dt>Email address</dt><dd>{session.email}</dd><dt>Role</dt><dd>{session.roleLabel}</dd><dt>Workspace</dt><dd>{session.tenantName || 'No workspace assigned'}</dd></dl><p>This demo profile is read-only.</p></section></>
          : notifications ? <><div className={styles.pageHeading}><p>YOUR INBOX</p><h1>Notifications</h1></div>{session.role === 'TENANT_STAFF' ? <Suspense fallback={<p role="status">Loading invitations…</p>}><StaffInvitations session={session} /></Suspense> : <section className={styles.emptyPanel}><Bell size={28} aria-hidden="true" /><h2>You’re all caught up</h2><p>There are no new account notifications in this demo.</p></section>}</>
            : admin ? <Suspense fallback={<p role="status">Loading platform administration…</p>}><AdminConsole /></Suspense>
              : suspended ? <section className={styles.locked}><span className={styles.lockIcon}><LockKeyhole size={28} aria-hidden="true" /></span><p className={styles.kicker}>WORKSPACE SUSPENDED</p><h1>Workspace access is paused.</h1><p>A platform administrator has suspended this workspace. Contact your administrator for review. Your profile and account notifications remain available.</p><Button asChild><Link to="/merchant/profile">View your profile</Link></Button></section>
              : ownerAccess ? <Suspense fallback={<p role="status">Loading workspace…</p>}>{ownerScreen ? <OwnerConsole /> : storeSettings ? <StoreSettings /> : teamPage ? <TeamPage /> : <OwnerDashboard session={session} />}</Suspense>
                : staffAccess ? wrongStaffDomain ? <section className={styles.locked}><h1>Subdomain access denied.</h1><p>This Staff account is not assigned to the requested demo subdomain.</p><Button asChild><Link to="/merchant/dashboard">Return to assigned workspace</Link></Button></section> : <Suspense fallback={<p role="status">Loading Staff workspace…</p>}>{staffScreen ? <StaffConsole session={session} /> : <StaffWorkspace session={session} />}</Suspense>
                : session.membershipStatus === 'SUSPENDED' ? <section className={styles.locked}><h1>Your staff access is suspended.</h1><p>Ask your owner to restore your workspace membership.</p></section>
                : <section className={styles.locked}><span className={styles.lockIcon}><LockKeyhole size={28} aria-hidden="true" /></span><p className={styles.kicker}>PENDING INVITATION</p><h1>Your workspace is waiting.</h1><p>Your dashboard is locked until a Tenant Owner invites you to their workspace and you accept the invitation.</p><ol><li><span>1</span>Receive an invitation from your store owner</li><li><span>2</span>Review the workspace and your permissions</li><li><span>3</span>Accept to unlock your dashboard</li></ol><Button asChild><Link to="/merchant/notifications">Check invitations</Link></Button><p className={styles.lockedFoot}>You can still view your profile, check notifications and sign out.</p></section>}
      </main>
    </div>
  </div>
}
