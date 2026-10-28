import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/shared/ui/button'
import { useDemoSession } from '@/features/auth/hooks/useDemoSession'
import { validSubdomain } from '@/services/api/storefront'
import { StorefrontHeader } from '../components/StorefrontHeader'
import shared from '../Storefront.module.css'
import styles from '@/features/portal/StoreSettings.module.css'

export default function ApiStoreDirectory() {
  const session = useDemoSession()
  const [subdomain, setSubdomain] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()
  function submit(event) {
    event.preventDefault()
    const value = subdomain.trim().toLowerCase()
    if (!validSubdomain(value)) { setError('Enter a store subdomain with 3–30 lowercase letters, numbers or hyphens.'); return }
    navigate(`/store/${encodeURIComponent(value)}`)
  }
  return <div className={shared.store}><StorefrontHeader base="/stores" directory live /><main id="main-content" tabIndex={-1} className={shared.main}><div className={styles.page}><div className={styles.heading}><div><h1>Find a storefront.</h1><p>Open a store using its SmartOmni subdomain.</p></div></div><section id="stores" className={styles.panel}><h2>Store address</h2><form className={styles.form} onSubmit={submit}><label className={styles.field}>Store subdomain<input required value={subdomain} onChange={event => { setSubdomain(event.target.value); setError('') }} autoCapitalize="none" spellCheck={false} placeholder="your-store" aria-invalid={Boolean(error)} aria-describedby={error ? 'store-subdomain-error' : undefined} /></label>{error && <p id="store-subdomain-error" role="alert" className={styles.error}>{error}</p>}<div className={styles.actions}><Button type="submit">Open storefront</Button>{session?.tenantDomain && <Button asChild variant="outline"><Link to={`/store/${session.tenantDomain}`}>Preview my storefront</Link></Button>}</div></form></section><p className={styles.notice}>The public store directory is not available yet. Ask the seller for their store address.</p></div></main></div>
}
