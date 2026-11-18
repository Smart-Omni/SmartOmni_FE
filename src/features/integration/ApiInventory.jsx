import { useCallback, useRef, useState } from 'react'
import { Button } from '@/shared/ui/button'
import { inventoryApi, requireId } from '@/services/api/operations'
import { DataTable, Feedback, OwnerPanel } from '@/features/portal/components/OwnerWorkspaceUI'
import { ResourceState } from './ShopeeShared'
import { useApiResource } from './useApiResource'
import { newIdempotencyKey, useApiAction } from './apiHelpers'
import styles from '@/features/portal/OwnerWorkspace.module.css'

const maximumStock = 2147483647
const stockOperations = {
  adjust: { label: 'Set total on hand', quantityLabel: 'New total quantity', confirmation: 'Confirm stock adjustment', verb: 'Set', direction: 'to' },
  deduct: { label: 'Remove units', quantityLabel: 'Units to remove', confirmation: 'Confirm removal', verb: 'Remove', direction: 'from' },
  restock: { label: 'Add units', quantityLabel: 'Units to add', confirmation: 'Confirm addition', verb: 'Add', direction: 'to' },
}

export default function ApiInventory() {
  const [skuId, setSkuId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [operation, setOperation] = useState('adjust')
  const [pending, setPending] = useState(null)
  const [error, setError] = useState('')
  const quantityInput = useRef(null)
  const action = useApiAction()
  const [page, setPage] = useState(0)
  const loader = useCallback(signal => inventoryApi.list({ page, size: 20 }, signal), [page])
  const resource = useApiResource(loader)
  const rows = resource.data?.content || []
  const operationInfo = stockOperations[operation]
  const minimum = operation === 'adjust' ? 0 : 1

  function clearReview() {
    setPending(null)
    setError('')
  }

  function review(event) {
    event.preventDefault()
    try {
      const id = requireId(skuId, 'SKU ID')
      const amount = Number(quantity)
      if (!/^\d+$/.test(quantity) || amount < minimum || amount > maximumStock) throw new Error(`Enter a whole quantity from ${minimum} to 2,147,483,647.`)
      if (operation !== 'adjust') {
        const row = rows.find(item => String(item.skuId) === id)
        if (!row) throw new Error('Select a SKU from the stock balances to check its current quantity.')
        if (operation === 'deduct' && amount > row.availableQuantity) throw new Error('Units to remove exceed the available stock.')
        if (operation === 'restock' && amount > maximumStock - row.quantityOnHand) throw new Error('The new stock total would exceed 2,147,483,647 units.')
      }
      setError('')
      setPending({
        skuId: id, quantity: amount, operation,
        idempotencyKey: operation === 'restock' ? newIdempotencyKey() : undefined,
      })
    } catch (failure) { setError(failure.message) }
  }

  function refreshStock() {
    clearReview()
    resource.reload()
  }

  function confirm() {
    const { skuId, quantity, operation, idempotencyKey } = pending
    return action.run(async () => {
      try {
        return await inventoryApi[operation](skuId, quantity, idempotencyKey)
      } catch (failure) {
        if (operation === 'deduct' && (!failure.status || failure.status >= 500)) {
          refreshStock()
          throw new Error('Stock removal could not be confirmed. Check the refreshed balance before removing units again.', { cause: failure })
        }
        throw failure
      }
    }, `Stock adjustment accepted for SKU ${skuId}: ${quantity} units.`, refreshStock)
  }

  return <>
    <OwnerPanel title="Stock balances">
      <div className={styles.actions}><Button variant="outline" disabled={action.busy} onClick={refreshStock}>Refresh stock</Button></div>
      <ResourceState resource={resource} />
      {rows.length > 0 && <DataTable label="Stock balances" headings={['Product / SKU', 'On hand', 'Reserved', 'Available', 'Actions']}>
        {rows.map(row => <tr key={row.skuId}>
          <td>{row.productName || '—'}<p>{row.skuCode || row.skuId}</p></td>
          <td>{row.quantityOnHand ?? '—'}</td><td>{row.reservedQuantity ?? '—'}</td><td>{row.availableQuantity ?? '—'}</td>
          <td><Button variant="outline" disabled={action.busy} onClick={() => {
            setSkuId(String(row.skuId))
            setQuantity(operation === 'adjust' ? String(row.quantityOnHand ?? '') : '')
            clearReview()
            quantityInput.current?.focus()
          }}>Select SKU</Button></td>
        </tr>)}
      </DataTable>}
      {resource.data && !rows.length && <p>No stock balances on this page.</p>}
      {(page > 0 || resource.data?.totalPages > 1) && <div className={`${styles.actions} ${styles.pagination}`}>
        <Button variant="secondary" disabled={action.busy || resource.loading || page === 0} onClick={() => { clearReview(); setPage(page - 1) }}>Previous page</Button>
        <span>Page {page + 1}{resource.data?.totalPages > 0 && ` of ${resource.data.totalPages}`}</span>
        <Button variant="secondary" disabled={action.busy || resource.loading || page + 1 >= (resource.data?.totalPages || 0)} onClick={() => { clearReview(); setPage(page + 1) }}>Next page</Button>
      </div>}
    </OwnerPanel>
    <OwnerPanel title="Adjust stock">
      <form className={styles.form} onSubmit={review}>
        <label className={styles.field}>Stock operation
          <select value={operation} disabled={action.busy} onChange={event => {
            setOperation(event.target.value)
            setQuantity('')
            clearReview()
          }}>
            {Object.entries(stockOperations).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}
          </select>
        </label>
        <div className={styles.fieldColumns}>
          <label className={styles.field}>SKU ID
            <input required inputMode="numeric" disabled={action.busy} value={skuId} onChange={event => { setSkuId(event.target.value); clearReview() }} />
          </label>
          <label className={styles.field}>{operationInfo.quantityLabel}
            <input ref={quantityInput} required type="number" min={minimum} max={maximumStock} step="1" disabled={action.busy} value={quantity} onChange={event => { setQuantity(event.target.value); clearReview() }} />
          </label>
        </div>
        <p className={styles.note}>{operation === 'adjust' ? 'Set the full on-hand balance for the SKU.' : 'Use this for a manual stock change outside of order fulfillment or returns.'}</p>
        {error && <p role="alert" className={styles.error}>{error}</p>}
        <div className={styles.actions}><Button type="submit" disabled={action.busy || Boolean(pending) || (operation !== 'adjust' && resource.loading)}>Review stock adjustment</Button></div>
      </form>
      {pending && <div className={styles.message}>
        <p>{operation === 'adjust' ? <>Set SKU {pending.skuId} to <strong>{pending.quantity}</strong> units?</> : <>
          {operationInfo.verb} <strong>{pending.quantity}</strong> units {operationInfo.direction} SKU {pending.skuId}?
        </>} Connected marketplace stock may also be updated.</p>
        <div className={styles.actions}>
          <Button variant="secondary" disabled={action.busy} onClick={clearReview}>Keep current stock</Button>
          <Button disabled={action.busy} onClick={confirm}>{action.busy ? 'Saving…' : operationInfo.confirmation}</Button>
        </div>
      </div>}
      <Feedback value={action.feedback} />
    </OwnerPanel>
  </>
}
