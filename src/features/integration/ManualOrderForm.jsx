import { useState } from 'react'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog'
import { orderApi, requireId } from '@/services/api/operations'
import { Feedback } from '@/features/portal/components/OwnerWorkspaceUI'
import { useApiAction } from './apiHelpers'
import styles from '@/features/portal/OwnerWorkspace.module.css'

export default function ManualOrderForm({ close, onCreated }) {
  const [lines, setLines] = useState([0])
  const [nextLine, setNextLine] = useState(1)
  const action = useApiAction()

  function submit(event) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    action.run(async () => {
      const items = lines.map(line => {
        const id = requireId(fields.get(`sku-${line}`), 'SKU ID')
        const quantity = Number(fields.get(`quantity-${line}`))
        const unitPrice = Number(fields.get(`price-${line}`))
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 2147483647 || !Number.isFinite(unitPrice) || unitPrice < 0) {
          throw new Error('Enter a positive whole quantity and a valid unit price for each item.')
        }
        return { sku_id: Number.isSafeInteger(Number(id)) ? Number(id) : id, quantity, unit_price: unitPrice }
      })
      const body = { platform: fields.get('platform'), items }
      for (const name of ['platform_order_id', 'customer_name', 'customer_phone', 'shipping_address', 'shipping_method']) {
        const value = fields.get(name).trim()
        if (value) body[name] = value
      }
      const order = await orderApi.create(body)
      if (order?.id == null) throw new Error('No order ID was returned. Check the order list before submitting again.')
      return order
    }, 'Order created.', onCreated)
  }

  return <Dialog open onOpenChange={open => { if (!open && !action.busy) close() }}>
    <DialogContent className={`${styles.dialog} ${styles.marketplaceDialog}`}>
      <DialogTitle>Create manual order</DialogTitle>
      <DialogDescription>Add an order to SmartOmni using your internal SKU IDs.</DialogDescription>
      <form className={styles.form} onSubmit={submit}>
        <fieldset disabled={action.busy} className={styles.fieldColumns}>
          <legend>Order details</legend>
          <label className={styles.field}>Marketplace<select name="platform"><option value="SHOPEE">Shopee</option><option value="TIKTOK_SHOP">TikTok Shop</option></select></label>
          <label className={styles.field}>Marketplace order reference<input name="platform_order_id" /></label>
          <label className={styles.field}>Customer name<input name="customer_name" /></label>
          <label className={styles.field}>Customer phone<input name="customer_phone" type="tel" /></label>
          <label className={styles.field}>Shipping address<input name="shipping_address" /></label>
          <label className={styles.field}>Shipping method<input name="shipping_method" /></label>
        </fieldset>
        {lines.map((line, index) => <fieldset key={line} disabled={action.busy} className={styles.fieldColumns}>
          <legend>Item {index + 1}</legend>
          <label className={styles.field}>SKU ID<input name={`sku-${line}`} inputMode="numeric" required /></label>
          <label className={styles.field}>Quantity<input name={`quantity-${line}`} type="number" min="1" max="2147483647" step="1" required /></label>
          <label className={styles.field}>Unit price (VND)<input name={`price-${line}`} type="number" min="0" step="0.01" required /></label>
          {lines.length > 1 && <Button type="button" variant="secondary" onClick={() => setLines(lines.filter(value => value !== line))}>Remove item {index + 1}</Button>}
        </fieldset>)}
        <div className={styles.actions}>
          <Button type="button" variant="outline" disabled={action.busy} onClick={() => {
            setLines([...lines, nextLine])
            setNextLine(nextLine + 1)
          }}>Add item</Button>
          <Button type="submit" disabled={action.busy}>{action.busy ? 'Creating…' : 'Create order'}</Button>
        </div>
        <Feedback value={action.feedback} />
      </form>
    </DialogContent>
  </Dialog>
}
