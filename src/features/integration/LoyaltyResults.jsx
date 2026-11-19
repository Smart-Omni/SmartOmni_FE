import { Button } from '@/shared/ui/button'
import { DataTable, Feedback } from '@/features/portal/components/OwnerWorkspaceUI'
import { dateTime } from './apiHelpers'

export function LoyaltyResource({ resource, children }) {
  if (resource.loading) return <p role="status">Loading…</p>
  if (resource.error) return <>
    <Feedback value={{ error: true, message: resource.error }} />
    <Button variant="outline" onClick={resource.reload}>Retry</Button>
  </>
  return children(resource.data)
}

export function LoyaltyResults({ resource, merchant = false }) {
  const headings = ['Campaign', ...(merchant ? ['Customer ID'] : []), 'Requested', 'Status', ...(merchant ? ['Details'] : ['Voucher code', 'Details'])]
  return <LoyaltyResource resource={resource}>{items => items.length ? <>
    <DataTable headings={headings} label="Voucher requests">
      {items.map(item => <tr key={item.id}>
        <th scope="row">{item.campaignName}</th>
        {merchant && <td>{item.customerId}</td>}
        <td>{dateTime(item.requestedAt)}</td>
        <td>{item.status}</td>
        {!merchant && <td>{item.code || '—'}</td>}
        <td>{item.failureReason || '—'}</td>
      </tr>)}
    </DataTable>
    <Button variant="outline" onClick={resource.reload}>Refresh requests</Button>
  </> : <p>No voucher requests yet.</p>}</LoyaltyResource>
}
