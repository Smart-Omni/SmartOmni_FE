import { useState } from 'react'
import { Button } from '@/shared/ui/button'
import { inventoryApi, requireId } from '@/services/api/operations'
import { Feedback, OwnerPanel } from '@/features/portal/components/OwnerWorkspaceUI'
import { useApiAction } from './apiHelpers'
import styles from '@/features/portal/OwnerWorkspace.module.css'

export default function ApiInventory() {
  const [skuId, setSkuId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [pending, setPending] = useState(null)
  const [error, setError] = useState('')
  const action = useApiAction()
  function review(event) {
    event.preventDefault()
    try {
      const id = requireId(skuId, 'SKU ID')
      const amount = Number(quantity)
      if (!/^\d+$/.test(quantity) || !Number.isInteger(amount) || amount < 0 || amount > 2147483647) throw new Error('Enter a whole quantity from 0 to 2,147,483,647.')
      setError(''); setPending({ skuId: id, quantity: amount })
    } catch (failure) { setError(failure.message) }
  }
  return <OwnerPanel title="Adjust stock"><p>Set the total on-hand quantity for a SKU. This replaces its current quantity; it does not add to it.</p><p>Stock balances and adjustment history are not available to read here yet. Check the current balance with your operations team before making an adjustment.</p><form className={styles.form} onSubmit={review}><label className={styles.field}>SKU ID<input required inputMode="numeric" disabled={action.busy} value={skuId} onChange={event => { setSkuId(event.target.value); setPending(null) }} /></label><label className={styles.field}>New total quantity<input required type="number" min="0" max="2147483647" step="1" disabled={action.busy} value={quantity} onChange={event => { setQuantity(event.target.value); setPending(null) }} /></label>{error && <p role="alert" className={styles.error}>{error}</p>}<div className={styles.actions}><Button type="submit" disabled={action.busy}>Review stock adjustment</Button></div></form>{pending && <div className={styles.message}><p>Set SKU {pending.skuId} to <strong>{pending.quantity}</strong> units? Connected marketplace stock may also be updated.</p><div className={styles.actions}><Button variant="secondary" disabled={action.busy} onClick={() => setPending(null)}>Keep current stock</Button><Button disabled={action.busy} onClick={() => action.run(() => inventoryApi.adjust(pending.skuId, pending.quantity), `Stock adjustment accepted for SKU ${pending.skuId}: ${pending.quantity} units.`, () => setPending(null))}>{action.busy ? 'Saving…' : 'Confirm stock adjustment'}</Button></div></div>}<Feedback value={action.feedback} /></OwnerPanel>
}
