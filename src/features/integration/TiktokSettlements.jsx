import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/shared/ui/button'
import { tiktokApi } from '@/services/api/tiktok'
import { DataTable, Feedback, OwnerPanel } from '@/features/portal/components/OwnerWorkspaceUI'
import { useApiResource } from './useApiResource'
import { ResourceState } from './ShopeeShared'
import { dateTime, money } from './apiHelpers'
import styles from '@/features/portal/OwnerWorkspace.module.css'

const isoDate = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const seconds = (date, time) => Math.floor(new Date(`${date}T${time}`).getTime() / 1000)
function defaultRange() {
  const today = new Date()
  const from = new Date(today); from.setDate(today.getDate() - 29)
  return { from: isoDate(from), to: isoDate(today) }
}

export default function TiktokSettlements() {
  const navigate = useNavigate()
  const [draft, setDraft] = useState(defaultRange)
  const [range, setRange] = useState(draft)
  const [rangeError, setRangeError] = useState(null)
  const [tokens, setTokens] = useState([null])
  const pageToken = tokens[tokens.length - 1]
  const loader = useCallback(signal => tiktokApi.settlements({ fromDate: seconds(range.from, '00:00:00'), toDate: seconds(range.to, '23:59:59'), pageSize: 20, pageToken: pageToken || undefined }, signal), [range, pageToken])
  const resource = useApiResource(loader)
  const rows = resource.data?.settlements || []
  function apply(event) {
    event.preventDefault()
    if (!draft.from || !draft.to || draft.from > draft.to) return setRangeError({ error: true, message: 'From date must be on or before To date.' })
    setRangeError(null); setRange({ ...draft }); setTokens([null])
  }
  return <OwnerPanel title="TikTok settlements"><form className={styles.filters} onSubmit={apply}>
    <label className={styles.field}>From date<input type="date" required value={draft.from} onChange={event => setDraft({ ...draft, from: event.target.value })} /></label>
    <label className={styles.field}>To date<input type="date" required value={draft.to} onChange={event => setDraft({ ...draft, to: event.target.value })} /></label>
    <div className={styles.actions}><Button type="submit" variant="outline">Apply</Button><Button type="button" variant="outline" onClick={resource.reload}>Refresh settlements</Button></div>
  </form><Feedback value={rangeError} />
  {resource.errorStatus === 409 ? <><Feedback value={{ error: true, message: 'TikTok Shop is not connected. Connect your TikTok shop to view its settlements.' }} /><Button variant="outline" onClick={() => navigate('/merchant/shops?marketplace=tiktok-shop')}>Connect TikTok Shop</Button></> : <ResourceState resource={resource} />}
  {!resource.loading && !resource.error && <><DataTable label="TikTok settlement statements" headings={['Statement', 'Statement time', 'Amount', 'Status', 'Paid time']}>{rows.map(item => <tr key={item.statementId}><td>{item.statementId}</td><td>{dateTime(item.statementTime)}</td><td>{money(item.settlementAmount)}<p>{item.currency}</p></td><td>{item.status}</td><td>{dateTime(item.paidTime)}</td></tr>)}</DataTable>{!rows.length && <p>No settlements in this period.</p>}
    <div className={styles.actions}><Button variant="secondary" disabled={tokens.length === 1} onClick={() => setTokens(tokens.slice(0, -1))}>Previous page</Button><span>Page {tokens.length}{resource.data?.total != null && ` · ${resource.data.total} statements`}</span><Button variant="secondary" disabled={!resource.data?.nextPageToken} onClick={() => setTokens([...tokens, resource.data.nextPageToken])}>Next page</Button></div></>}
  </OwnerPanel>
}
