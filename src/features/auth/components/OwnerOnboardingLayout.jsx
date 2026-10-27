import { useEffect, useReducer, useRef } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Brand } from '@/shared/components/Brand'
import { Button } from '@/shared/ui/button'
import { ownerSteps, OWNER_BASE } from '../data/onboardingContent'
import { allowedStep, confirmedShops, createOwnerState, ownerReducer } from '../lib/ownerState'
import { OwnerOnboardingContext } from '../hooks/useOwnerOnboarding'
import { OnboardingStepper } from './OnboardingStepper'
import styles from './OwnerOnboardingLayout.module.css'
import { useDemoSession } from '../hooks/useDemoSession'
import { signOutDemo } from '../lib/demoSession'
import { useTenantAccess } from '../hooks/useTenantAccess'

export function OwnerOnboardingLayout() {
  const session = useDemoSession()
  const tenantStatus = useTenantAccess(session?.tenantId)
  const location = useLocation()
  // Remount redirects for each history entry, including Back after signing out.
  if (!session) return <Navigate key={location.key} to="/auth/login?setup=1" replace />
  if (session.role !== 'TENANT_OWNER' || session.membershipStatus !== 'ACTIVE' || tenantStatus === 'SUSPENDED') return <Navigate key={location.key} to={session.role === 'CUSTOMER' ? '/store/everyday-studio' : session.role === 'SUPER_ADMIN' ? '/admin' : '/merchant/dashboard'} replace />
  return <OwnerSetup key={session.id} session={session} />
}

function OwnerSetup({ session }) {
  const [state, dispatch] = useReducer(ownerReducer, session, account => ({ ...createOwnerState(), ownerInfo: { ...createOwnerState().ownerInfo, fullName: account.name, email: account.email } }))
  const { pathname, key } = useLocation()
  const navigate = useNavigate()
  const content = useRef(null)
  const current = ownerSteps.findIndex(step => step.path === pathname.replace(/\/$/, ''))
  const allowed = allowedStep(state)
  useEffect(() => { content.current?.querySelector('h1')?.focus() }, [pathname])
  if (current > allowed) return <Navigate key={key} replace to={ownerSteps[allowed].path} />
  function reset() { dispatch({ type: 'RESET' }); navigate(`${OWNER_BASE}/plan`, { replace: true }) }
  function logout() { signOutDemo(); navigate('/auth/login?setup=1', { replace: true }) }
  return <OwnerOnboardingContext.Provider value={{ state, dispatch, confirmedShops: confirmedShops(state) }}>
    <main id="main-content" className={styles.page} tabIndex={-1}>
      <header className={styles.header}><div><Brand /><span className={styles.context}>Workspace setup · {session.name}</span></div><div><Button variant="ghost" onClick={reset} className={styles.restart}>Restart preview</Button><Button variant="ghost" onClick={logout}>Sign out</Button></div></header>
      <OnboardingStepper current={Math.max(0, current)} allowed={allowed} />
      <div className={styles.content} ref={content}>
        <div className={styles.step} key={`${pathname}-${state.resetKey}`}><Outlet /></div>
      </div>
      <footer className={styles.footer}><Link to="/merchant/dashboard"><ArrowLeft size={16} aria-hidden="true" />Back to workspace</Link><span>Setup preview · signed in as {session.email}</span></footer>
    </main>
  </OwnerOnboardingContext.Provider>
}
