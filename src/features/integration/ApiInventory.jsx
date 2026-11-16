import { useCallback, useRef, useState } from 'react'
import { Button } from '@/shared/ui/button'
import { inventoryApi, requireId } from '@/services/api/operations'
import { DataTable, Feedback, OwnerPanel } from '@/features/portal/components/OwnerWorkspaceUI'
import { ResourceState } from './ShopeeShared'
import { useApiResource } from './useApiResource'
import { useApiAction } from './apiHelpers'
import styles from '@/features/portal/OwnerWorkspace.module.css'

export default function ApiInventory() {
  const [skuId, setSkuId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [pending, setPending] = useState(null)
  const [error, setError] = useState('')
  const quantityInput = useRef(null)
  const action = useApiAction()
  const [page, setPage] = useState(0)
  const loader = useCallback(signal => inventoryApi.list({ page, size: 20 }, signal), [page])
  const resource = useApiResource(loader)
  const rows = resource.data?.content || []
  function review(event) {
    event.preventDefault()
    try {
      const id = requireId(skuId, 'SKU ID')
      const amount = Number(quantity)
      if (!/^\d+$/.test(quantity) || !Number.isInteger(amount) || amount < 0 || amount > 2147483647) throw new Error('Enter a whole quantity from 0 to 2,147,483,647.')
      setError(''); setPending({ skuId: id, quantity: amount })
    } catch (failure) { setError(failure.message) }
  }
  return <>
    <OwnerPanel title="Stock balances">
      <div className={styles.actions}><Button variant="outline" onClick={resource.reload}>Refresh stock</Button></div>
      <ResourceState resource={resource} />
      {rows.length > 0 && <DataTable label="Stock balances" headings={['Product / SKU', 'On hand', 'Reserved', 'Available', 'Actions']}>
        {rows.map(row => <tr key={row.skuId}>
          <td>{row.productName || '—'}<p>{row.skuCode || row.skuId}</p></td>
          <td>{row.quantityOnHand ?? '—'}</td><td>{row.reservedQuantity ?? '—'}</td><td>{row.availableQuantity ?? '—'}</td>
          <td><Button variant="outline" disabled={action.busy} onClick={() => {
            setSkuId(String(row.skuId))
            setQuantity(String(row.quantityOnHand ?? ''))
            setPending(null)
            setError('')
            quantityInput.current?.focus()
          }}>Select SKU</Button></td>
        </tr>)}
      </DataTable>}
      {resource.data && !rows.length && <p>No stock balances on this page.</p>}
      {(page > 0 || resource.data?.totalPages > 1) && <div className={`${styles.actions} ${styles.pagination}`}>
        <Button variant="secondary" disabled={resource.loading || page === 0} onClick={() => setPage(page - 1)}>Previous page</Button>
        <span>Page {page + 1}{resource.data?.totalPages > 0 && ` of ${resource.data.totalPages}`}</span>
        <Button variant="secondary" disabled={resource.loading || page + 1 >= (resource.data?.totalPages || 0)} onClick={() => setPage(page + 1)}>Next page</Button>
      </div>}
    </OwnerPanel>
    <OwnerPanel title="Adjust stock"><p>Set the total on-hand quantity for a SKU. This replaces its current quantity; it does not add to it.</p><form className={styles.form} onSubmit={review}><div className={styles.fieldColumns}><label className={styles.field}>SKU ID<input required inputMode="numeric" disabled={action.busy} value={skuId} onChange={event => { setSkuId(event.target.value); setPending(null) }} /></label><label className={styles.field}>New total quantity<input ref={quantityInput} required type="number" min="0" max="2147483647" step="1" disabled={action.busy} value={quantity} onChange={event => { setQuantity(event.target.value); setPending(null) }} /></label></div>{error && <p role="alert" className={styles.error}>{error}</p>}<div className={styles.actions}><Button type="submit" disabled={action.busy}>Review stock adjustment</Button></div></form>{pending && <div className={styles.message}><p>Set SKU {pending.skuId} to <strong>{pending.quantity}</strong> units? Connected marketplace stock may also be updated.</p><div className={styles.actions}><Button variant="secondary" disabled={action.busy} onClick={() => setPending(null)}>Keep current stock</Button><Button disabled={action.busy} onClick={() => action.run(() => inventoryApi.adjust(pending.skuId, pending.quantity), `Stock adjustment accepted for SKU ${pending.skuId}: ${pending.quantity} units.`, () => { setPending(null); resource.reload() })}>{action.busy ? 'Saving…' : 'Confirm stock adjustment'}</Button></div></div>}<Feedback value={action.feedback} /></OwnerPanel>
  </>
}
