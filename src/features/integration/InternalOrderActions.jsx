import { useState } from 'react'
import { orderApi, returnApi } from '@/services/api/operations'
import { Button } from '@/shared/ui/button'
import { Feedback } from '@/features/portal/components/OwnerWorkspaceUI'
import { useApiAction } from './apiHelpers'
import styles from '@/features/portal/OwnerWorkspace.module.css'

export function InternalOrderActions({ order, reload }) {
  const action = useApiAction()
  const [intent, setIntent] = useState('')
  const [input, setInput] = useState('')
  const [returnId, setReturnId] = useState(null)
  if (!order) return null
  const actions = {
    status: { message: 'Order is ready to ship.', submit: () => orderApi.updateStatus(order.id, 'TO_SHIP') },
    tracking: {
      message: 'Tracking updated.',
      submit: async () => {
        const result = await orderApi.updateTracking({ platform: order.platform, platform_order_id: order.platformOrderId, tracking_number: input.trim() })
        if (!result) throw new Error('The backend could not find this order to update tracking.')
      },
    },
    return: { message: 'Return request created.', submit: () => returnApi.create(order.id, input.trim()) },
  }
  function select(type) {
    setIntent(type)
    setInput(type === 'tracking' ? order.trackingNumber || '' : '')
  }
  function submit(event) {
    event.preventDefault()
    if (intent !== 'status' && !input.trim()) return
    const current = actions[intent]
    action.run(current.submit, current.message, result => {
      setIntent('')
      if (intent === 'return') setReturnId(result?.id)
      if (intent !== 'return') reload()
    })
  }

  return <>
    {order.status && <p>Status: {order.status}</p>}
    <div className={styles.actions}>
      {order.status === 'PENDING' && <Button variant="outline" onClick={() => select('status')} disabled={action.busy}>Mark ready to ship</Button>}
      {order.platform && order.platformOrderId && <Button variant="outline" onClick={() => select('tracking')} disabled={action.busy}>Update tracking</Button>}
      {!returnId && ['SHIPPED', 'DELIVERING', 'COMPLETED'].includes(order.status) && <Button variant="outline" onClick={() => select('return')} disabled={action.busy}>Create return request</Button>}
    </div>
    {intent && <form className={styles.form} onSubmit={submit}>
      {intent === 'status' ? <p>Move this order from pending to ready to ship?</p> :
        <label className={styles.field}>{intent === 'return' ? 'Return reason' : 'Tracking number'}
          <input required value={input} disabled={action.busy} onChange={event => setInput(event.target.value)} />
        </label>}
      <div className={styles.actions}>
        <Button type="button" variant="secondary" disabled={action.busy} onClick={() => setIntent('')}>Back</Button>
        <Button type="submit" disabled={action.busy}>{action.busy ? 'Saving…' : 'Confirm'}</Button>
      </div>
    </form>}
    <Feedback value={action.feedback} />
  </>
}
