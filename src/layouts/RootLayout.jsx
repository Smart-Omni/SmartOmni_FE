import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import styles from './RootLayout.module.css'

const titles = {
  '/': 'SmartOmni — One workspace for every sales channel',
  '/stores': 'Explore stores — SmartOmni',
  '/auth/login': 'Sign in — SmartOmni',
  '/auth/reset-password': 'Reset password — SmartOmni',
  '/auth/register': 'Create your account — SmartOmni',
  '/auth/register/staff': 'Team registration — SmartOmni',
  '/auth/register/customer': 'Customer registration — SmartOmni',
  '/customer': 'Your membership — SmartOmni',
  '/customer/claim': 'Claim order points — SmartOmni',
  '/customer/history': 'Claim history — SmartOmni',
  '/customer/vouchers': 'Tier vouchers — SmartOmni',
  '/customer/login': 'Customer sign in — SmartOmni',
  '/customer/verify-email': 'Verify your email — SmartOmni',
  '/customer/reset-password': 'Reset customer password — SmartOmni',
  '/auth/register/owner': 'Create tenant account — SmartOmni',
  '/merchant/setup/plan': 'Select your plan — SmartOmni',
  '/merchant/setup/channels': 'Sales channels — SmartOmni',
  '/merchant/setup/import': 'Initial import — SmartOmni',
  '/merchant/setup/welcome': 'Welcome preview — SmartOmni',
}

export function RootLayout() {
  const { pathname } = useLocation()

  useEffect(() => {
    document.title = titles[pathname] || (pathname.startsWith('/merchant/') ? 'Workspace — SmartOmni' : pathname.startsWith('/admin') ? 'Platform — SmartOmni' : pathname.startsWith('/store/') ? 'SmartOmni Storefront — SmartOmni' : 'Page not found — SmartOmni')
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])

  return <><a className={styles.skipLink} href="#main-content">Skip to content</a><Outlet /></>
}
