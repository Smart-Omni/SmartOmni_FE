import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button } from '@/shared/ui/button'
import { MarketplaceLogo } from '@/shared/components/MarketplaceLogo'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/shared/ui/dialog'
import { usePlatform } from './hooks/usePlatform'
import { changeTenantStatus, usageIssues } from './lib/platformStore'
import { PageHeading, TenantStatus } from './components/PlatformUI'
import { formatDate, formatTime } from './lib/format'
import portal from '@/features/portal/PortalPage.module.css'
import styles from './Platform.module.css'

export default function TenantDetail() {
  const { tenantId } = useParams()
  const { tenants, plans, audit } = usePlatform()
  const tenant = tenants.find(item => item.id === tenantId)
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  if (!tenant) return <><PageHeading title="Tenant not found" description="This workspace does not exist in the demo directory." /><Link className={styles.backLink} to="/admin/tenants">Back to tenants</Link></>
  const plan = plans.find(item => item.id === tenant.plan)
  const issues = usageIssues(tenant, plan)
  const suspended = tenant.status === 'SUSPENDED'
  function submit(event) {
    event.preventDefault()
    try { changeTenantStatus(tenant.id, reason); setOpen(false); setNotice(suspended ? 'Tenant reactivated. Workspace access has been restored in this demo.' : 'Tenant suspended. Merchant access is now blocked in this demo.') } catch (failure) { setError(failure.message) }
  }
  return <><Link to="/admin/tenants" className={styles.backLink}>‹ Tenants</Link><PageHeading eyebrow="TENANT DETAILS" title={tenant.name} description={`${tenant.domain} · Created ${formatDate(tenant.created)}`} action={tenant.status !== 'ONBOARDING' && <Button variant="outline" className={suspended ? portal.outline : styles.dangerOutline} onClick={() => { setReason(''); setError(''); setOpen(true) }}>{suspended ? 'Reactivate tenant' : 'Suspend tenant'}</Button>} />
    <div className={styles.detailBadges}><TenantStatus status={tenant.status} /><Link to="/admin/plans" className={styles.planLabel}>{tenant.plan} plan</Link></div>
    {suspended && <div className={styles.banner}><strong>Workspace access is suspended</strong><p>{tenant.suspensionReason}</p></div>}
    {issues.length > 0 && <div className={styles.banner}><strong>Usage exceeds the current plan limits</strong><p>{issues.join(' · ')}. Existing demo data is retained.</p></div>}
    <p className={styles.notice} role="status">{notice}</p>
    <div className={styles.detailGrid}><section className={portal.panel}><div className={portal.panelHeading}><h2>Workspace information</h2></div><dl className={styles.descriptionList}><dt>Tenant ID</dt><dd>{tenant.id}</dd><dt>Owner</dt><dd>{tenant.owner}</dd><dt>Email</dt><dd><a href={`mailto:${tenant.email}`}>{tenant.email}</a></dd><dt>Storefront</dt><dd>{tenant.domain}</dd><dt>Onboarding</dt><dd>{tenant.status === 'ONBOARDING' ? 'In progress' : 'Completed'}</dd></dl></section>
      <section className={portal.panel}><div className={portal.panelHeading}><div><h2>Resource usage</h2><p>Against current {tenant.plan} demo limits</p></div><Link className={styles.viewAll} to="/admin/plans">View plan</Link></div><div className={styles.usage}>{[['SKUs', tenant.skus, plan.skuLimit], ['Shop connections', tenant.shops.length, plan.shopLimit], ['Managers', tenant.manager, plan.managerLimit]].map(([label, used, limit]) => <div key={label}><div><span>{label}</span><strong>{used.toLocaleString()} / {limit.toLocaleString()}</strong></div><div className={portal.track}><span style={{ width: `${Math.min(100, used / limit * 100)}%` }} /></div></div>)}</div></section>
      <section className={portal.panel}><div className={portal.panelHeading}><div><h2>Connected shops</h2><p>Connection snapshots · no live provider calls</p></div></div><div className={styles.shopRows}>{tenant.shops.map(shop => <div key={shop.name}><MarketplaceLogo marketplace={shop.platform} size={32} decorative /><div><strong>{shop.name}</strong><span>{shop.platform === 'shopee' ? 'Shopee' : 'TikTok Shop'}</span></div><span className={suspended ? portal.neutral : shop.status === 'Connected' ? portal.success : portal.warning}>{suspended ? 'Paused' : shop.status}</span></div>)}{!tenant.shops.length && <p className={styles.empty}>No shop connections yet. The owner is completing onboarding.</p>}</div></section>
      <section className={portal.panel}><div className={portal.panelHeading}><h2>Tenant action history</h2><Link className={styles.viewAll} to={`/admin/audit?q=${encodeURIComponent(tenant.name)}`}>View all</Link></div><div className={styles.auditPreview}>{audit.filter(entry => entry.tenantId === tenant.id).slice(0, 4).map(entry => <div key={entry.id}><strong>{entry.action}</strong><p>{entry.reason}</p><span>{entry.actor} · {formatTime(entry.at)}</span></div>)}{!audit.some(entry => entry.tenantId === tenant.id) && <p className={styles.empty}>No admin actions for this tenant yet.</p>}</div></section></div>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className={styles.modal} onInteractOutside={event => event.preventDefault()}><form onSubmit={submit}><DialogTitle>{suspended ? 'Reactivate' : 'Suspend'} {tenant.name}?</DialogTitle><DialogDescription className={styles.modalDescription}>{suspended ? 'Restore merchant access for this workspace. Its existing demo data will remain available.' : 'Block merchant dashboard access for this workspace. The owner can still view their profile, notifications and sign out. Existing demo data is retained.'}</DialogDescription><label className={styles.field}>Reason<textarea required maxLength={500} value={reason} onChange={event => { setReason(event.target.value); setError('') }} /></label><p className={styles.fieldError} role="alert">{error}</p><DialogFooter><DialogClose asChild><Button variant="outline" type="button" autoFocus>Cancel</Button></DialogClose><Button type="submit" className={suspended ? '' : styles.dangerButton}>{suspended ? 'Reactivate tenant' : 'Suspend tenant'}</Button></DialogFooter></form></DialogContent></Dialog>
  </>
}

