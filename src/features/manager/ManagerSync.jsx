import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog'
import { DataTable, Feedback, OwnerPanel } from '@/features/portal/components/OwnerWorkspaceUI'
import { marketplaceListings } from './data/managerFixtures'
import { mappingIssue, runInventorySync } from './lib/managerStore'
import styles from '@/features/portal/OwnerWorkspace.module.css'

export default function ManagerSync({ data, session }) {
  const [status, setStatus] = useState('ALL')
  const [detailId, setDetailId] = useState(null)
  const [feedback, setFeedback] = useState(null)
  const jobs = data.syncJobs.filter(item => status === 'ALL' || item.status === status)
  const detail = data.syncJobs.find(item => item.id === detailId)
  function run(id) { try { const result = runInventorySync(id); setFeedback({ error: result.failed, message: result.message }) } catch (error) { setFeedback({ error: true, message: error.message }) } }
  return <><OwnerPanel title="Inventory sync jobs"><label className={styles.field}>Inventory sync status<select value={status} onChange={event => setStatus(event.target.value)}><option value="ALL">All jobs</option><option value="FAILED">Failed</option><option value="QUEUED">Queued</option><option value="SUCCEEDED">Succeeded</option></select></label><p>Sync sends the current available quantity in the local scenario. Correct mapping or Owner shop authorization first, then retry. No marketplace API is called.</p><DataTable label="Inventory sync jobs" headings={['Marketplace variant', 'Status / error', 'Attempts', 'Last demo quantity', 'Actions']}>{jobs.map(job => {
    const listing = marketplaceListings.find(item => item.id === job.listingId)
    return <tr key={job.id}><td>{listing?.title}<p>{listing?.platform} · {listing?.externalId}</p></td><td>{job.status}<p>{job.code || job.message}</p></td><td>{job.attempts}</td><td>{job.available ?? 'Not synced'}</td><td><div className={styles.actions}><Button variant="outline" onClick={() => setDetailId(job.id)}>View sync error / history</Button>{['FAILED', 'QUEUED'].includes(job.status) && <Button disabled={!session.permissions.includes('inventory:sync')} onClick={() => run(job.id)}>{job.status === 'FAILED' ? 'Retry inventory sync' : 'Run demo sync'}</Button>}</div></td></tr>
  })}</DataTable>{!jobs.length && <p>No sync jobs match this status.</p>}<Feedback value={feedback} /></OwnerPanel><Dialog open={Boolean(detail)} onOpenChange={open => { if (!open) setDetailId(null) }}><DialogContent className={styles.dialog}><DialogTitle>Inventory sync error & history</DialogTitle><DialogDescription>{detail?.status} · {detail?.message}</DialogDescription>{detail && <><p>{detail.code || 'No current error'} · {detail.attempts} attempt(s)</p><p>Current mapping check: {mappingIssue(data, detail.listingId)?.message || 'Valid sample SKU and warehouse mapping.'}</p>{session.permissions.includes('products:read') && <Button asChild variant="outline"><Link to={`/merchant/manager/mapping?tenant=${session.tenantDomain}&listing=${detail.listingId}`}>Correct warehouse and SKU mapping</Link></Button>}<ul className={styles.list}>{detail.history.map((item, index) => <li key={index}><strong>{item.code}</strong><p>{item.message}</p><span className={styles.note}>{new Date(item.at).toLocaleString('en-GB')}</span></li>)}</ul></>}</DialogContent></Dialog></>
}
