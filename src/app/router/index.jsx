import { createBrowserRouter, Navigate } from 'react-router-dom'
import { RootLayout } from '@/layouts/RootLayout'
import { LandingPage } from '@/features/landing/LandingPage'
import { LoginPage } from '@/features/auth/pages/LoginPage'
import { RegisterPage } from '@/features/auth/pages/RegisterPage'
import { StaffRegisterPage } from '@/features/auth/pages/StaffRegisterPage'
import { OwnerOnboardingLayout } from '@/features/auth/components/OwnerOnboardingLayout'
import { OwnerBasicInfo } from '@/features/auth/onboarding/OwnerBasicInfo'
import { SelectPlan } from '@/features/auth/onboarding/SelectPlan'
import { ConfigureChannels } from '@/features/auth/onboarding/ConfigureChannels'
import { ConfigureImport } from '@/features/auth/onboarding/ConfigureImport'
import { WelcomePage } from '@/features/auth/onboarding/WelcomePage'
import { NotFoundPage } from '@/app/NotFoundPage'
import { apiMode } from '@/services/api/config'
import ApiUnavailablePage from '@/features/auth/pages/ApiUnavailablePage'

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: '/', element: <LandingPage /> },
      { path: '/stores', lazy: async () => ({ Component: (await import('@/features/storefront/pages/StoreDirectory')).StoreDirectory }) },
      { path: '/auth/login', element: <LoginPage /> },
      { path: '/merchant/channels/shopee/callback', lazy: async () => ({ Component: (await import('@/features/integration/ShopeeCallback')).default }) },
      ...['tiktok', 'tiktok-shop'].map(provider => ({ path: `/merchant/channels/${provider}/callback`, lazy: async () => ({ Component: (await import('@/features/integration/TiktokCallback')).default }) })),
      { path: '/auth/reset-password', lazy: async () => ({ Component: (await import('@/features/auth/pages/StaffResetPasswordPage')).default }) },
      { path: '/auth/register', element: <RegisterPage /> },
      { path: '/auth/register/staff', element: apiMode ? <ApiUnavailablePage /> : <StaffRegisterPage /> },
      { path: '/auth/register/customer', lazy: async () => ({ Component: apiMode ? (await import('@/features/auth/pages/ApiRegisterCustomer')).default : (await import('@/features/customer/CustomerRegisterPage')).CustomerRegisterPage }) },
      { path: '/customer/login', element: <Navigate to="/auth/login?account=customer" replace /> },
      { path: '/customer/verify-email', lazy: async () => ({ Component: apiMode ? ApiUnavailablePage : (await import('@/features/customer/CustomerAuth')).CustomerAuth }) },
      { path: '/customer/reset-password', lazy: async () => ({ Component: apiMode ? (await import('@/features/auth/pages/ApiResetPassword')).default : (await import('@/features/customer/CustomerAuth')).CustomerAuth }) },
      { path: '/customer', lazy: async () => ({ Component: apiMode ? ApiUnavailablePage : (await import('@/features/customer/CustomerWorkspace')).CustomerWorkspace }) },
      { path: '/customer/profile', lazy: async () => ({ Component: apiMode ? (await import('@/features/integration/ApiPortal')).default : (await import('@/features/customer/CustomerWorkspace')).CustomerWorkspace }) },
      { path: '/customer/claim', lazy: async () => ({ Component: apiMode ? ApiUnavailablePage : (await import('@/features/customer/CustomerWorkspace')).CustomerWorkspace }) },
      { path: '/customer/history', lazy: async () => ({ Component: apiMode ? ApiUnavailablePage : (await import('@/features/customer/CustomerWorkspace')).CustomerWorkspace }) },
      { path: '/customer/vouchers', lazy: async () => ({ Component: apiMode ? ApiUnavailablePage : (await import('@/features/customer/CustomerWorkspace')).CustomerWorkspace }) },
      { path: '/merchant/*', lazy: async () => ({ Component: (await import('@/features/portal/PortalPage')).PortalPage }) },
      { path: '/admin/*', lazy: async () => ({ Component: (await import('@/features/portal/PortalPage')).PortalPage }) },
      { path: '/store/:storeSlug', lazy: async () => ({ Component: (await import('@/features/storefront/components/StorefrontLayout')).StorefrontLayout }), children: [
        { index: true, lazy: async () => ({ Component: (await import('@/features/storefront/pages/CatalogPage')).CatalogPage }) },
        { path: 'flash-sale', lazy: async () => ({ Component: (await import('@/features/storefront/pages/FlashSalePage')).FlashSalePage }) },
        { path: 'assistant', lazy: async () => ({ Component: (await import('@/features/storefront/pages/ProductAssistant')).ProductAssistant }) },
        { path: 'products/:productId', lazy: async () => ({ Component: (await import('@/features/storefront/pages/ProductDetailPage')).ProductDetailPage }) },
      ] },
      { path: '/auth/register/owner', lazy: async () => ({ Component: apiMode ? (await import('@/features/auth/pages/ApiRegisterOwner')).default : OwnerBasicInfo }) },
      ...['plan', 'channels', 'import', 'welcome'].map(step => ({ path: `/auth/register/owner/${step}`, element: <Navigate to={`/merchant/setup/${step}`} replace /> })),
      { path: '/merchant/setup', element: <OwnerOnboardingLayout />, children: [
        { index: true, element: <Navigate to="plan" replace /> },
        { path: 'plan', element: <SelectPlan /> },
        { path: 'channels', element: <ConfigureChannels /> },
        { path: 'import', element: <ConfigureImport /> },
        { path: 'welcome', element: <WelcomePage /> },
      ] },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
