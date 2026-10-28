import { useCallback } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { Brand } from '@/shared/components/Brand'
import { Button } from '@/shared/ui/button'
import { useDemoSession } from '@/features/auth/hooks/useDemoSession'
import { storefrontApi, storefrontImageUrl, validSubdomain } from '@/services/api/storefront'
import { ApiError } from '@/services/api/client'
import { useApiResource } from '@/features/integration/useApiResource'
import { StorefrontHeader } from './StorefrontHeader'
import shared from '../Storefront.module.css'
import styles from './ApiStorefront.module.css'

export default function ApiStorefront() {
  const { storeSlug } = useParams()
  const session = useDemoSession()
  const { pathname } = useLocation()
  const base = `/store/${storeSlug}`
  const canPreview = Boolean(session && session.tenantDomain === storeSlug)
  const loader = useCallback(async signal => {
    if (!validSubdomain(storeSlug)) throw new ApiError('This store address is invalid.', 404)
    try {
      const profile = await storefrontApi.publicProfile(storeSlug, signal)
      return { profile, ownerPreview: false }
    } catch (error) {
      // Current BE applies tenant RLS to this public route. An existing tenant
      // member may preview only their own shop with their own JWT.
      if (error.status === 404 && canPreview) return { profile: await storefrontApi.publicProfile(storeSlug, signal, true), ownerPreview: true }
      throw error
    }
  }, [storeSlug, canPreview])
  const resource = useApiResource(loader)
  const profile = resource.data?.profile
  const unavailable = !resource.loading && (resource.error || !profile || profile.status?.toUpperCase() !== 'ACTIVE')
  if (resource.loading || unavailable) return <div className={shared.store}><StorefrontHeader base={base} live /><main id="main-content" tabIndex={-1} className={shared.unavailable}>
    {resource.loading ? <><h1>Loading storefront…</h1><p role="status">Getting store information.</p></> : <><h1>Storefront unavailable.</h1><p role="alert">{resource.errorStatus !== 404 && resource.error ? resource.error : 'This store was not found or is not publicly available.'}</p><div className={styles.actions}><Button variant="outline" onClick={resource.reload}>Try again</Button><Button asChild variant="secondary"><Link to="/stores">Find another store</Link></Button></div></>}
  </main></div>
  const color = /^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(profile.primaryColor || '') ? profile.primaryColor : undefined
  const banner = storefrontImageUrl(profile.bannerUrl)
  const logo = storefrontImageUrl(profile.logoUrl)
  const unsupportedPage = pathname.replace(/\/$/, '') !== base
  const phone = profile.supportPhone?.replace(/[^\d+]/g, '')
  return <div className={shared.store}><StorefrontHeader base={base} live />
    <div className={shared.storeIdentityBar}><div><strong>{profile.storeName || profile.subdomain}</strong><span>{profile.subdomain}</span></div><Link to="/stores">Find another store</Link></div>
    <main id="main-content" tabIndex={-1} className={`${shared.main} ${styles.page}`}>
      {resource.data.ownerPreview && <p className={styles.notice} role="status">Workspace preview · this backend currently requires your tenant session to load this storefront.</p>}
      {banner && <img className={styles.banner} src={banner} alt={`${profile.storeName || profile.subdomain} banner`} />}
      <section className={styles.identity} style={{ borderTopColor: color }} aria-label="Store information">
        {logo && <img className={styles.logo} src={logo} alt={`${profile.storeName || profile.subdomain} logo`} />}
        <div><h1>{profile.storeName || profile.subdomain}</h1>{profile.address && <p className={styles.address}>{profile.address}</p>}{profile.supportPhone && <p>{phone ? <a href={`tel:${phone}`}>{profile.supportPhone}</a> : profile.supportPhone}</p>}</div>
      </section>
      <section className={styles.empty} aria-labelledby="catalog-heading"><h2 id="catalog-heading">{unsupportedPage ? 'This page is not available yet.' : 'Products are not available here yet.'}</h2><p>{unsupportedPage ? 'Product details, flash sales and the product assistant are not connected to the current backend.' : 'This storefront is connected to the store profile. Its public product catalog is not available yet.'}</p>{unsupportedPage && <Button asChild variant="outline"><Link to={base}>Back to storefront</Link></Button>}</section>
      <div className={styles.actions}><Button variant="outline" onClick={resource.reload}>Refresh storefront</Button>{canPreview && session.role === 'TENANT_OWNER' && <Button asChild variant="outline"><Link to="/merchant/settings/profile">Edit store information</Link></Button>}</div>
    </main><footer className={shared.footer}><div className={shared.footerBottom}><span>Powered by <Brand /></span></div></footer>
  </div>
}
