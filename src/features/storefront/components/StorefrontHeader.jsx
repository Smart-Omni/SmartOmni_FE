import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronRight, Heart, Home, Search, UserRound } from 'lucide-react'
import { BrandWordmark } from '@/shared/components/Brand'
import { useSavedProducts } from './useSavedProducts'
import { useDemoSession } from '@/features/auth/hooks/useDemoSession'
import { signOutDemo } from '@/features/auth/lib/demoSession'
import styles from './StorefrontHeader.module.css'

export function StorefrontHeader({ base }) {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { savedIds } = useSavedProducts()
  const session = useDemoSession()
  function search(event) {
    event.preventDefault()
    const query = new FormData(event.currentTarget).get('q').trim()
    navigate(query ? `${base}?q=${encodeURIComponent(query)}` : base)
  }
  return <><header className={styles.header}>
    <div className={styles.inner}>
      <div className={styles.utility}>
        <nav className={styles.accountBar} aria-label="Store account">
        {session?.role === 'CUSTOMER' ? <><Link to="/customer"><UserRound size={15} aria-hidden="true" /><span>{session.name}</span></Link><Link to="/customer">My membership</Link><button type="button" onClick={signOutDemo}>Sign out</button></> : session ? <Link to={session.role === 'SUPER_ADMIN' ? '/admin' : '/merchant/dashboard'}>My workspace</Link> : <><Link to="/auth/login?account=customer">Sign in</Link><Link to="/auth/register/customer">Sign up</Link></>}
        </nav>
      </div>
      <div className={styles.mainRow}>
        <Link to={base} className={styles.brand} aria-label="SmartOmni Storefront home"><BrandWordmark /><small>STOREFRONT</small></Link>
        <div className={styles.searchWrap}>
          <form role="search" aria-label="Search this store" className={styles.search} onSubmit={search}>
            <input key={params.get('q') || ''} type="search" name="q" aria-label="Search products" defaultValue={params.get('q') || ''} placeholder="Search for your next favorite find" autoComplete="off" />
            <button type="submit" aria-label="Search"><Search size={21} strokeWidth={1.7} aria-hidden="true" /></button>
          </form>
          <nav className={styles.suggestions} aria-label="Popular searches">{[['Headphones', '?q=headphones'], ['Workspace essentials', '?category=workspace'], ['Home & Living', '?category=home'], ['Sneakers', '?q=sneakers'], ['Everyday finds', '?category=everyday'], ['Under 500.000 ₫', '?max=500000']].map(([label, query]) => <Link key={label} to={`${base}${query}`}>{label}</Link>)}</nav>
        </div>
        <Link to={`${base}?saved=1`} className={styles.saved} aria-label={`Saved products (${savedIds.length})`}><Heart size={22} strokeWidth={1.5} aria-hidden="true" />{savedIds.length > 0 && <span>{savedIds.length}</span>}</Link>
      </div>
    </div>
  </header>
    <nav className={styles.breadcrumb} aria-label="Workspace navigation"><Link to="/" className={styles.home}><Home size={14} aria-hidden="true" />Home</Link><ChevronRight size={12} aria-hidden="true" /><span aria-current="page">Workspace</span></nav>
  </>
}
