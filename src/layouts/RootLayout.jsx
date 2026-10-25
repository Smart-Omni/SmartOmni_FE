import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import styles from './RootLayout.module.css'

const titles = {
  '/': 'SmartOmni — One workspace for every sales channel',
  '/auth/login': 'Sign in — SmartOmni',
  '/auth/register': 'Create your account — SmartOmni',
  '/auth/register/staff': 'Team registration — SmartOmni',
  '/auth/register/customer': 'Customer registration — SmartOmni',
  '/customer': 'Your membership — SmartOmni',
  '/customer/claim': 'Claim order points — SmartOmni',
  '/customer/history': 'Claim history — SmartOmni',
  '/customer/login': 'Customer sign in — SmartOmni',
  '/customer/verify-email': 'Verify your email — SmartOmni',
  '/customer/reset-password': 'Reset customer password — SmartOmni',
  '/auth/register/owner': 'Owner setup — SmartOmni',
  '/auth/register/owner/plan': 'Select your plan — SmartOmni',
  '/auth/register/owner/channels': 'Sales channels — SmartOmni',
  '/auth/register/owner/import': 'Initial import — SmartOmni',
  '/auth/register/owner/welcome': 'Welcome preview — SmartOmni',
}

export function RootLayout() {
  const { pathname } = useLocation()

  useEffect(() => {
    document.title = titles[pathname] || (pathname.startsWith('/merchant/') ? 'Workspace — SmartOmni' : pathname.startsWith('/admin') ? 'Platform — SmartOmni' : pathname.startsWith('/store/') ? 'SmartOmni Storefront — SmartOmni' : 'Page not found — SmartOmni')
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])

  return <><a className={styles.skipLink} href="#main-content">Skip to content</a><Outlet /></>
}
