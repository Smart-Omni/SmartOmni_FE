import { useState } from 'react'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog'
import { ConfirmAction, DataTable, Feedback, OwnerPanel } from '@/features/portal/components/OwnerWorkspaceUI'
import { arrangeManagerShipment, cancelManagerOrder, managerShippingLabel } from './lib/managerStore'
import styles from '@/features/portal/OwnerWorkspace.module.css'

const total = order => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(order.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0))
export default function ManagerOrders({ data, session }) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('ALL')
  const [detailId, setDetailId] = useState(null)
  const [arrange, setArrange] = useState(null)
  const [carrier, setCarrier] = useState('Demo standard')
  const [cancel, setCancel] = useState(null)
  const [reason, setReason] = useState('')
  const [feedback, setFeedback] = useState(null)
  const orders = data.orders.filter(order => (status === 'ALL' || order.status === status) && `${order.id} ${order.customer} ${order.shipment?.tracking || ''}`.toLowerCase().includes(query.trim().toLowerCase()))
  const detail = data.orders.find(order => order.id === detailId)
  function label(order, print) {
    try {
      const html = managerShippingLabel(order.id)
      if (print) {
        const popup = window.open('', '_blank', 'width=650,height=800')
        if (!popup) throw new Error('Printing was blocked. Allow popups or download the label and print it locally.')
        popup.opener = null; popup.document.write(html); popup.document.close(); popup.focus(); popup.print()
      } else {
        const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }))
        const anchor = document.createElement('a'); anchor.href = url; anchor.download = `demo-shipping-label-${order.id}.html`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
      }
      setFeedback({ message: 'Demo shipping label prepared. It is not a valid carrier label.' })
    } catch (error) { setFeedback({ error: true, message: error.message }) }
  }
  return <><OwnerPanel title="Order list & shipment status"><div className={styles.filters}><label className={styles.field}>Search manager orders<input type="search" placeholder="Order, customer or tracking" value={query} onChange={event => setQuery(event.target.value)} /></label><label className={styles.field}>Order status<select value={status} onChange={event => setStatus(event.target.value)}><option value="ALL">All statuses</option>{['READY_TO_SHIP', 'ARRANGED', 'SHIPPED', 'DELIVERED', 'CANCELLED'].map(value => <option key={value}>{value}</option>)}</select></label></div><p>Demo rules: cancellation is available before a shipment is arranged; arranging a shipment keeps stock reserved until handover. Real marketplace/carrier policies are not enforced here.</p><DataTable label="Manager order list" headings={['Order / customer', 'Items / total', 'Order status', 'Shipment status', 'Actions']}>{orders.map(order => <tr key={order.id}><td>{order.id}<p>{order.customer} · {order.platform}</p></td><td>{order.items.reduce((sum, item) => sum + item.quantity, 0)} units<p>{total(order)}</p></td><td>{order.status}</td><td>{order.shipment?.status || 'Not arranged'}<p>{order.shipment?.tracking}</p></td><td><div className={styles.actions}><Button variant="outline" onClick={() => setDetailId(order.id)}>View order details</Button>{order.status === 'READY_TO_SHIP' && <><Button variant="outline" disabled={!session.permissions.includes('shipments:arrange')} onClick={() => { setArrange(order); setCarrier('Demo standard') }}>Arrange shipment</Button><Button variant="outline" className={styles.danger} disabled={!session.permissions.includes('orders:cancel')} onClick={() => { setCancel(order); setReason('') }}>Cancel order</Button></>}{order.shipment && <><Button variant="outline" disabled={!session.permissions.includes('labels:print')} onClick={() => label(order, false)}>Download shipping label</Button><Button variant="outline" disabled={!session.permissions.includes('labels:print')} onClick={() => label(order, true)}>Print shipping label</Button></>}</div></td></tr>)}</DataTable>{!orders.length && <p>No orders match your filters.</p>}<Feedback value={feedback} /></OwnerPanel>
    <Dialog open={Boolean(detail)} onOpenChange={open => { if (!open) setDetailId(null) }}><DialogContent className={styles.dialog}><DialogTitle>Order {detail?.id}</DialogTitle><DialogDescription>{detail?.customer} · {detail?.status} · sample order.</DialogDescription>{detail && <><p>{detail.address}</p><p>Warehouse: {detail.warehouseId} · Total: {total(detail)}</p><DataTable label="Order line items" headings={['SKU', 'Quantity', 'Unit price']}>{detail.items.map(item => <tr key={item.sku}><td>{item.sku}</td><td>{item.quantity}</td><td>{item.unitPrice.toLocaleString('vi-VN')} VND</td></tr>)}</DataTable><p>Shipment: {detail.shipment?.status || 'Not arranged'} · {detail.shipment?.tracking || 'No tracking yet'}</p>{detail.cancelReason && <p>Cancellation reason: {detail.cancelReason}</p>}</>}</DialogContent></Dialog>
    {arrange && <ConfirmAction title={`Arrange shipment ${arrange.id}`} description="Create a local shipment preview and tracking reference. No carrier is booked and no marketplace order is changed." confirmLabel="Confirm demo shipment" onClose={() => setArrange(null)} onConfirm={() => { arrangeManagerShipment(arrange.id, carrier, JSON.stringify(arrange)); setFeedback({ message: 'Demo shipment arranged. A sample label is now available.' }) }}><label className={styles.field}>Carrier service<select value={carrier} onChange={event => setCarrier(event.target.value)}><option>Demo standard</option><option>Demo express</option></select></label></ConfirmAction>}
    {cancel && <ConfirmAction title={`Cancel order ${cancel.id}?`} description="Cancel this local order and release its reserved quantities once. This does not send a marketplace cancellation request or issue a refund." confirmLabel="Confirm demo cancellation" danger onClose={() => setCancel(null)} onConfirm={() => { cancelManagerOrder(cancel.id, reason, JSON.stringify(cancel)); setFeedback({ message: 'Order cancelled in demo; reserved stock was released.' }) }}><label className={styles.field}>Cancellation reason<textarea maxLength={500} value={reason} onChange={event => setReason(event.target.value)} /></label></ConfirmAction>}
  </>
}
