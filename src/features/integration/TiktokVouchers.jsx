import { tiktokApi } from '@/services/api/tiktok'
import { Button } from '@/shared/ui/button'
import { DataTable, Feedback, OwnerPanel } from '@/features/portal/components/OwnerWorkspaceUI'
import { useApiResource } from './useApiResource'
import { TiktokResourceState } from './ShopeeShared'
import { dateTime, useApiAction } from './apiHelpers'
import styles from '@/features/portal/OwnerWorkspace.module.css'

export default function TiktokVouchers() {
  const resource = useApiResource(tiktokApi.vouchers)
  const action = useApiAction()
  const rows = resource.data || []

  return <OwnerPanel title="TikTok Shop vouchers">
    <div className={styles.actions}>
      <Button variant="outline" disabled={!resource.data || action.busy}
        onClick={() => action.run(tiktokApi.syncVouchers, vouchers => `${vouchers.length} vouchers synchronized.`, resource.reload)}>Sync vouchers</Button>
    </div>
    <Feedback value={action.feedback} />
    <TiktokResourceState resource={resource} />
    {resource.data && (rows.length ? <DataTable label="TikTok vouchers" headings={['Voucher', 'Discount', 'Redeemed', 'Expires', 'Status']}>
      {rows.map(row => <tr key={row.id || row.tiktokVoucherId}><td>{row.title}<p>{row.voucherCode}</p></td>
        <td>{row.discountValue}{row.discountType === 'PERCENT_OFF' ? '%' : ' VND'}</td>
        <td>{row.redeemedCount ?? 0}{row.usageLimit != null && ` / ${row.usageLimit}`}</td>
        <td>{dateTime(row.endTime)}</td><td>{row.status}</td></tr>)}
    </DataTable> : <p>No vouchers found.</p>)}
  </OwnerPanel>
}
