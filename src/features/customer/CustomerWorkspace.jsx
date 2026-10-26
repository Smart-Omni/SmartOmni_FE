import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { ArrowDownLeft, ArrowLeft, ArrowRight, ArrowUpRight, Check, ChevronRight, CircleCheck, Clock3, Crown, History, LogOut, PackageCheck, Plus, Search, ShieldCheck, Sparkles, Store, UserRound } from 'lucide-react'
import { Link, NavLink, Navigate, useLocation } from 'react-router-dom'
import { BrandWordmark } from '@/shared/components/Brand'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog'
import { Tabs, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { useDemoSession } from '@/features/auth/hooks/useDemoSession'
import { signOutDemo } from '@/features/auth/lib/demoSession'
import { checkEligibility, claimOrder, customerEvent, readClaims, tiers } from './customerStore'
import styles from './Customer.module.css'
import CustomerVouchers from './CustomerVouchers'

const format = value => value.toLocaleString('en-GB')
const date = value => new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' })
const navigation = [{ to: '/customer', label: 'My membership', icon: Sparkles }, { to: '/customer/claim', label: 'Claim order points', icon: PackageCheck }, { to: '/customer/history', label: 'Claim history', icon: History }, { to: '/customer/vouchers', label: 'Tier vouchers', icon: Plus }]

export function CustomerWorkspace() {
  const session = useDemoSession()
  const [leaving, setLeaving] = useState(false)
  if (leaving) return <Navigate to="/store/everyday-studio" replace />
  function logout() {
    // Commit the destination before the external session update invokes the route guard.
    flushSync(() => setLeaving(true))
    signOutDemo()
  }
  return session?.role === 'CUSTOMER' && session.verified ? <Workspace key={session.id} account={session} onSignOut={logout} /> : <Navigate to="/auth/login?account=customer" replace />
}

function Workspace({ account, onSignOut }) {
  const { pathname } = useLocation()
  const [claims, setClaims] = useState(() => readClaims(account.id))
  const [detail, setDetail] = useState(null)
  useEffect(() => {
    const refresh = () => setClaims(readClaims(account.id))
    window.addEventListener(customerEvent, refresh)
    window.addEventListener('storage', refresh)
    return () => { window.removeEventListener(customerEvent, refresh); window.removeEventListener('storage', refresh) }
  }, [account.id])
  const points = claims.reduce((sum, item) => sum + item.points, 0)
  const tier = [...tiers].reverse().find(item => points >= item.minimum)
  const next = tiers[tiers.indexOf(tier) + 1]
  const screen = pathname.endsWith('/vouchers') ? 'vouchers' : pathname.endsWith('/claim') ? 'claim' : pathname.endsWith('/history') ? 'history' : 'membership'
  return <div className={styles.workspace}>
    <header className={styles.header}><Link to="/" aria-label="SmartOmni home"><BrandWordmark /></Link><span className={styles.headerDivider} /><span className={styles.headerLabel}>Customer space</span><Link to="/store/everyday-studio" className={styles.storeLink}><Store size={16} />Back to store<ArrowUpRight size={14} /></Link><span className={styles.avatar} aria-label={account.name}>{account.name.split(' ').map(part => part[0]).slice(0, 2).join('')}</span></header>
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarTop}><span className={styles.eyebrow}>YOUR ACCOUNT</span><nav aria-label="Customer navigation">{navigation.map(({ to, label, icon: Icon }) => <NavLink key={to} end to={to} className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}><Icon size={18} strokeWidth={1.6} />{label}</NavLink>)}</nav></div>
        <div className={styles.sidebarBottom}><div className={styles.profile}><span className={styles.profileIcon}><UserRound size={18} /></span><div><strong>{account.name}</strong><span>{account.email}</span></div></div><Button variant="ghost" className={styles.signOut} onClick={onSignOut}><LogOut size={16} />Sign out</Button></div>
      </aside>
      <main id="main-content" className={styles.main} tabIndex={-1}>
        <div className={styles.breadcrumb}><span>My account</span><ChevronRight size={12} /><span>{navigation.find(item => item.to === pathname)?.label || 'My membership'}</span></div>
        {screen === 'membership' ? <>
          <div className={styles.pageHeading}><div><span className={styles.eyebrow}>A LITTLE THANK YOU, EVERY DAY</span><h1>Your everyday, rewarded.</h1><p>Welcome back, {account.name.split(' ')[0]}. Here’s your membership at a glance.</p></div><Button asChild><Link to="/customer/claim"><Plus size={16} />Claim order points</Link></Button></div>
          <div className={styles.overviewGrid}>
            <section className={styles.pointsCard} aria-label="Loyalty points"><div className={styles.cardTop}><span>YOUR LOYALTY POINTS</span><Sparkles size={22} strokeWidth={1.4} /></div><div className={styles.pointsValue}>{format(points)}<span>points</span></div><p>Every eligible order brings you a little further.</p><div className={styles.pointsFooter}><span><ArrowDownLeft size={16} />{claims.length} claimed {claims.length === 1 ? 'order' : 'orders'}</span><span>Everyday Studio</span></div></section>
            <section className={styles.panel}><div className={styles.sectionHeading}><h2>Your membership</h2><Crown size={20} strokeWidth={1.5} /></div><div className={styles.tierHeading}><strong>{tier.name}</strong><span className={styles.badge}>Current tier</span></div><p className={styles.muted}>{next ? `${format(next.minimum - points)} more points to ${next.name}.` : 'You’ve reached the highest demo tier.'}</p><div className={styles.progress} role="progressbar" aria-label={next ? `Progress to ${next.name}` : 'Highest tier reached'} aria-valuemin={0} aria-valuemax={next?.minimum || 1000} aria-valuenow={Math.min(points, next?.minimum || 1000)}><span style={{ width: `${Math.min(100, points / (next?.minimum || 1000) * 100)}%` }} /></div><div className={styles.tierScale}>{tiers.map(item => <span key={item.name} className={item.name === tier.name ? styles.currentTier : ''}>{item.name}<small>{format(item.minimum)} pts</small></span>)}</div></section>
          </div>
          <div className={styles.lowerGrid}><section className={styles.panel}><div className={styles.sectionHeading}><h2>Recent claims</h2><Link to="/customer/history">View history<ArrowRight size={14} /></Link></div><ClaimList claims={claims.slice(0, 3)} onDetail={setDetail} /></section><section className={styles.panel}><div className={styles.sectionHeading}><h2>A simple way to earn</h2></div><ol className={styles.steps}>{[['Find your order', 'Use the order ID from your marketplace purchase.'], ['Check eligibility', 'We check the order before any points are added.'], ['Make it count', 'Confirm your claim and follow your points here.']].map(([title, copy], index) => <li key={title}><span>{index + 1}</span><div><strong>{title}</strong><p>{copy}</p></div></li>)}</ol></section></div>
          <section className={styles.tierSection}><div className={styles.sectionHeading}><h2>Your membership journey</h2><span className={styles.muted}>Demo tier thresholds</span></div><div className={styles.tierCards}>{tiers.map((item, index) => <div key={item.name}><div><span className={styles.tierNumber}>0{index + 1}</span>{points >= item.minimum && <Check size={16} aria-label="Reached" />}</div><h3>{item.name}</h3><p>{format(item.minimum)}{index === 2 ? '+' : `–${format(tiers[index + 1].minimum - 1)}`} points</p><span>{item.name === tier.name ? 'Your current tier' : points >= item.minimum ? 'Tier reached' : `${format(item.minimum - points)} points to go`}</span></div>)}</div></section>
        </> : screen === 'vouchers' ? <CustomerVouchers /> : screen === 'claim' ? <ClaimScreen account={account} onClaim={setClaims} /> : <HistoryScreen claims={claims} onDetail={setDetail} />}
        <footer className={styles.footer}><span><ShieldCheck size={14} />Your customer space · Everyday Studio</span><span>Demo data · points, eligibility and tiers are illustrative</span></footer>
      </main>
    </div>
    <Dialog open={Boolean(detail)} onOpenChange={open => { if (!open) setDetail(null) }}><DialogContent className={styles.detailDialog}><DialogTitle>Claim details</DialogTitle><DialogDescription>Points credited to your Everyday Studio membership.</DialogDescription>{detail && <><span className={styles.successBadge}><CircleCheck size={14} />Claimed</span><dl className={styles.details}><div><dt>Order ID</dt><dd>{detail.orderId}</dd></div><div><dt>Marketplace</dt><dd>{detail.channel}</dd></div><div><dt>Claim date</dt><dd>{date(detail.at)}</dd></div><div><dt>Points earned</dt><dd>+{format(detail.points)} points</dd></div></dl><Button variant="outline" onClick={() => setDetail(null)}>Close details</Button></>}</DialogContent></Dialog>
  </div>
}

function ClaimList({ claims, onDetail }) {
  if (!claims.length) return <div className={styles.empty}><History size={28} strokeWidth={1.4} /><h3>No claims yet</h3><p>Your claimed orders will appear here.</p><Button asChild variant="outline"><Link to="/customer/claim">Claim your first order</Link></Button></div>
  return <div className={styles.claimList}>{claims.map(item => <button className={styles.claimRow} key={item.id} onClick={() => onDetail(item)} aria-label={`View claim ${item.orderId}`}><span className={styles.rowIcon}><PackageCheck size={19} strokeWidth={1.5} /></span><span className={styles.rowCopy}><strong>{item.orderId}</strong><span>{item.channel} <span aria-hidden="true">·</span> {date(item.at)}</span></span><span className={styles.rowPoints}>+{format(item.points)}<small><CircleCheck size={12} />Claimed</small></span><ChevronRight size={14} className={styles.muted} /></button>)}</div>
}

function ClaimScreen({ account, onClaim }) {
  const [orderId, setOrderId] = useState('')
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(null)
  function check(event) {
    event.preventDefault(); setError(''); setPreview(null); setSuccess(null)
    try { setPreview(checkEligibility(account, orderId)) } catch (failure) { setError(failure.message) }
  }
  function confirm() {
    try { const claims = claimOrder(account, preview.id); onClaim(claims); setSuccess(claims[0]); setPreview(null); setError('') } catch (failure) { setError(failure.message); setPreview(null) }
  }
  return <><div className={styles.pageHeading}><div><span className={styles.eyebrow}>MAKE YOUR ORDER COUNT</span><h1>Claim order points.</h1><p>A few details. A quick check. More points for you.</p></div></div><div className={styles.claimGrid}><section className={styles.panel}><div className={styles.sectionHeading}><h2>{success ? 'Points added to your membership' : 'Find your order'}</h2><PackageCheck size={20} /></div>{success ? <div className={styles.claimSuccess} role="status"><span className={styles.bigSuccess}><Check size={24} /></span><h2>That’s +{success.points} points.</h2><p>Order {success.orderId} has been claimed successfully.</p><Button asChild><Link to="/customer">View my membership</Link></Button><Button variant="outline" onClick={() => { setSuccess(null); setOrderId('') }}>Claim another order</Button></div> : <><p className={styles.muted}>Enter the marketplace order ID associated with your customer account.</p><form className={styles.claimForm} onSubmit={check}><label className={styles.field}>Order ID <span aria-hidden="true">*</span><input required name="orderId" placeholder="e.g. ESO-1048" value={orderId} aria-invalid={Boolean(error)} aria-describedby="order-hint claim-error" onChange={event => { setOrderId(event.target.value); setPreview(null); setError('') }} /></label><p id="order-hint" className={styles.hint}>Find this in the order details on your marketplace.</p><p id="claim-error" className={styles.error} role="alert">{error}</p><Button type="submit" variant={preview ? 'outline' : 'default'}>Check eligibility</Button></form>{preview && <div className={styles.eligibility} role="status"><span className={styles.successBadge}><CircleCheck size={14} />Eligible for points</span><dl className={styles.details}><div><dt>Order</dt><dd>{preview.id}</dd></div><div><dt>Marketplace</dt><dd>{preview.channel}</dd></div><div><dt>Order status</dt><dd>{preview.status}</dd></div><div><dt>Order total</dt><dd>{format(preview.total)} ₫</dd></div><div><dt>Points to earn</dt><dd>+{preview.points} points</dd></div></dl><Button onClick={confirm}>Confirm claim</Button></div>}</>}</section><aside className={styles.claimAside}><section className={styles.panel}><div className={styles.sectionHeading}><h2>Before you claim</h2><ShieldCheck size={19} /></div><ul className={styles.rules}><li><Check size={16} />The order belongs to your account.</li><li><Check size={16} />The order is delivered and not cancelled.</li><li><Check size={16} />Points haven’t already been claimed.</li></ul><p className={styles.hint}>These checks describe the demo rules. Production eligibility requires backend validation.</p></section><div className={styles.demoSamples}><span className={styles.eyebrow}>TRY THE DEMO</span>{account.id === 'customer-1' ? <><p>Use one of these sample orders:</p>{[['ESO-1048', 'Delivered · eligible'], ['ESO-1049', 'In transit · not eligible'], ['ESO-1050', 'Cancelled · not eligible'], ['ESO-1042', 'Already claimed']].map(([id, label]) => <button key={id} onClick={() => { setOrderId(id); setPreview(null); setError(''); setSuccess(null) }}><strong>{id}</strong><span>{label}</span><ArrowUpRight size={14} /></button>)}</> : <p>New demo accounts start with no orders or points. The published customer fixture has sample orders for testing.</p>}</div></aside></div></>
}

function HistoryScreen({ claims, onDetail }) {
  const [query, setQuery] = useState('')
  const [channel, setChannel] = useState('all')
  const filtered = claims.filter(item => item.orderId.toLowerCase().includes(query.trim().toLowerCase()) && (channel === 'all' || item.channel === channel))
  return <><div className={styles.pageHeading}><div><span className={styles.eyebrow}>EVERY ORDER, ACCOUNTED FOR</span><h1>Your claim history.</h1><p>All the orders that helped your points grow.</p></div><Button asChild variant="outline"><Link to="/customer/claim"><Plus size={16} />Claim an order</Link></Button></div><section className={styles.panel}><div className={styles.historySummary}><span className={styles.rowIcon}><Clock3 size={22} /></span><div><strong>{claims.length} claimed {claims.length === 1 ? 'order' : 'orders'}</strong><p>{format(claims.reduce((sum, item) => sum + item.points, 0))} points earned in total</p></div></div><div className={styles.filters}><Tabs value={channel} onValueChange={setChannel}><TabsList aria-label="Filter claims by marketplace"><TabsTrigger value="all">All channels</TabsTrigger><TabsTrigger value="Shopee">Shopee</TabsTrigger><TabsTrigger value="TikTok Shop">TikTok Shop</TabsTrigger></TabsList></Tabs><label className={styles.search}><Search size={16} /><input aria-label="Search claim history" type="search" placeholder="Search order ID" value={query} onChange={event => setQuery(event.target.value)} /></label></div><div className={styles.sectionHeading}><h2>Claimed orders</h2><span className={styles.muted}>{filtered.length} results</span></div>{filtered.length || !claims.length ? <ClaimList claims={filtered} onDetail={onDetail} /> : <div className={styles.empty}><Search size={28} /><h3>No matching claims</h3><p>Try another order ID or marketplace.</p><Button variant="outline" onClick={() => { setQuery(''); setChannel('all') }}>Clear filters</Button></div>}</section><Link className={styles.textLink} to="/customer"><ArrowLeft size={14} />Back to membership</Link></>
}
