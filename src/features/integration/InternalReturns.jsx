import { useCallback, useState } from 'react'
import { orderApi, returnApi } from '@/services/api/operations'
import { Button } from '@/shared/ui/button'
import { DataTable, OwnerPanel } from '@/features/portal/components/OwnerWorkspaceUI'
import { ConfirmationDialog } from './ConfirmationDialog'
import { useApiResource } from './useApiResource'
import { ResourceState } from './ShopeeShared'
import styles from '@/features/portal/OwnerWorkspace.module.css'

export default function InternalReturns() {
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState(null)
  const loader = useCallback(signal => returnApi.list({ page, size: 20, sort: 'id,desc' }, signal), [page])
  const resource = useApiResource(loader)
  const returns = (resource.data?.content || []).filter(item => !item.external_return_id && !item.return_type)

  async function approve() {
    const order = await orderApi.detail(selected.order_id)
    if (!['SHIPPED', 'DELIVERING', 'COMPLETED'].includes(order?.status)) {
      throw new Error('This order is no longer eligible for a full return. Refresh the list and check its status.')
    }
    return returnApi.approve(selected.id)
  }

  return <OwnerPanel title="Internal return requests">
    <ResourceState resource={resource} />
    {resource.data && (returns.length ? <DataTable label="Internal returns" headings={['Request', 'Order', 'Reason', 'Status', 'Actions']}>
      {returns.map(item => <tr key={item.id}>
        <td>{item.id}</td><td>{item.platform_order_id || item.order_id}</td><td>{item.reason}</td><td>{item.status}</td>
        <td>{item.status === 'REQUESTED' && !item.restocked && <Button variant="outline" onClick={() => setSelected(item)}>Approve and restock</Button>}</td>
      </tr>)}
    </DataTable> : <p>No internal return requests on this page.</p>)}
    {resource.data && (page > 0 || page + 1 < resource.data.totalPages) && <div className={styles.actions}>
      <Button variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous page</Button>
      <span>Page {page + 1} of {resource.data.totalPages}</span>
      <Button variant="secondary" disabled={page + 1 >= resource.data.totalPages} onClick={() => setPage(page + 1)}>Next page</Button>
    </div>}
    {selected && <ConfirmationDialog title="Approve return and restock"
      description={`Confirm receipt of all items for order ${selected.platform_order_id || selected.order_id}. This records the return as completed and restocks the order items in SmartOmni.`}
      submit={approve} close={() => setSelected(null)} done={() => { setSelected(null); resource.reload() }} />}
  </OwnerPanel>
}
