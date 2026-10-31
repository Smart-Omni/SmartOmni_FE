import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog'
import { shopeeApi } from '@/services/api/shopee'
import { tiktokApi } from '@/services/api/tiktok'
import { DataTable, Feedback, OwnerPanel } from '@/features/portal/components/OwnerWorkspaceUI'
import { useApiResource } from './useApiResource'
import { ResourceState } from './ShopeeShared'
import { dateTime, money, useApiAction } from './apiHelpers'
import styles from '@/features/portal/OwnerWorkspace.module.css'

const statuses = ['UNPAID', 'READY_TO_SHIP', 'SHIPPED', 'TO_CONFIRM_RECEIVE', 'COMPLETED', 'CANCELLED', 'TO_RETURN', 'IN_CANCEL']
const localStatuses = ['PENDING', 'TO_SHIP', 'SHIPPED', 'DELIVERING', 'COMPLETED', 'CANCELLED', 'RETURNED', 'ON_HOLD']
const tiktokStatuses = ['UNPAID', 'ON_HOLD', 'AWAITING_SHIPMENT', 'AWAITING_COLLECTION', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED', 'CANCELLED']
const packageIdOf = order => order?.package_id || order?.package_list?.[0]?.package_id || order?.line_items?.[0]?.package_id || null
const tiktokRow = order => ({ ...order, platformOrderId: order.order_id, platform: 'TIKTOK', customerName: order.recipient_address?.name || order.buyer_email, status: order.order_status, totalAmount: order.payment?.total_amount, trackingNumber: order.tracking_number })

export default function ShopeeOrders() {
  const navigate = useNavigate()
  const [source, setSource] = useState('local')
  const [page, setPage] = useState(0)
  const [tokens, setTokens] = useState([null])
  const [status, setStatus] = useState('')
  const [query, setQuery] = useState('')
  const [detail, setDetail] = useState(null)
  const [dialog, setDialog] = useState(null)
  const [notice, setNotice] = useState(null)
  const action = useApiAction()
  const pageToken = tokens[tokens.length - 1]
  const loader = useCallback(signal => source === 'local' ? shopeeApi.localOrders({ page, size: 20, sort: 'createdAt,desc' }, signal) : source === 'tiktok' ? tiktokApi.orders({ pageSize: 20, orderStatus: status || undefined, pageToken: pageToken || undefined }, signal) : shopeeApi.orders({ pageSize: 50, orderStatus: status || undefined }, signal), [source, page, status, pageToken])
  const resource = useApiResource(loader)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(timer) }, [])
  function syncTiktok() {
    const toDate = Math.floor(Date.now() / 1000)
    return action.run(() => tiktokApi.syncOrders({ fromDate: toDate - 7 * 86400, toDate }), result => `Fetched ${result.orders.length} orders from TikTok.`, () => { setTokens([null]); resource.reload() })
  }
  const rows = (source === 'local' ? resource.data?.content || [] : source === 'tiktok' ? (resource.data?.orders || []).map(tiktokRow) : resource.data || []).map(order => ({
    ...order, sn: order.platformOrderId || order.orderSn, label: order.platform || 'SHOPEE',
    buyer: order.customerName || order.buyerUsername, state: order.status || order.orderStatus,
    tracking: order.trackingNumber || order.trackingNo, deadline: order.slaDeadline ? Date.parse(order.slaDeadline) : order.shipByDate ? order.shipByDate * 1000 : null,
  })).filter(order => (!status || order.state === status) && `${order.sn} ${order.buyer || ''} ${order.tracking || ''}`.toLowerCase().includes(query.trim().toLowerCase()))
  async function download(order) {
    await action.run(async () => {
      const pdf = await shopeeApi.awb(order.sn)
      const url = URL.createObjectURL(pdf)
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `AWB-${order.sn.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`; anchor.click()
      setTimeout(() => URL.revokeObjectURL(url), 30_000)
    }, 'Shipping PDF downloaded.')
  }
  return <><OwnerPanel title="Order list & shipment status"><div className={styles.filters}>
    <label className={styles.field}>Order source<select value={source} onChange={event => { setSource(event.target.value); setStatus(''); setPage(0); setTokens([null]); setNotice(null) }}><option value="local">SmartOmni orders</option><option value="shopee">Shopee orders (first 50)</option><option value="tiktok">TikTok Shop orders</option></select></label>
    <label className={styles.field}>Search orders<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Order, buyer or tracking" /></label>
    <label className={styles.field}>Order status<select value={status} onChange={event => { setStatus(event.target.value); setTokens([null]) }}><option value="">All statuses</option>{(source === 'local' ? localStatuses : source === 'tiktok' ? tiktokStatuses : statuses).map(value => <option key={value}>{value}</option>)}</select></label>
  </div><p>{source === 'local' ? 'Filters apply to the current page. Sync Shopee orders to ingest them into SmartOmni.' : source === 'tiktok' ? 'Orders are read directly from TikTok and are not saved to SmartOmni yet.' : 'Shopee currently returns up to 50 orders; its controller does not expose the next cursor.'}</p>
  <div className={styles.actions}>{source === 'tiktok' ? <Button disabled={action.busy} onClick={syncTiktok}>Sync TikTok orders</Button> : <Button disabled={action.busy} onClick={() => action.run(() => shopeeApi.batchSync({ pageSize: 50 }), result => `${result.length} orders submitted for synchronization.`, resource.reload)}>Sync Shopee orders</Button>}<Button variant="outline" disabled={action.busy} onClick={resource.reload}>Refresh orders</Button></div>
  <Feedback value={action.feedback} />{source === 'tiktok' && notice && <Feedback value={notice} />}{source === 'tiktok' && resource.errorStatus === 409 ? <><Feedback value={{ error: true, message: 'TikTok Shop is not connected. Connect your TikTok shop to view its orders.' }} /><Button variant="outline" onClick={() => navigate('/merchant/shops?marketplace=tiktok-shop')}>Connect TikTok Shop</Button></> : <ResourceState resource={resource} />}{!resource.loading && !resource.error && <><DataTable label="Live order list" headings={['Order / buyer', 'Total', 'Status / SLA', 'Tracking', 'Actions']}>{rows.map(order => <tr key={order.id || order.sn}><td>{order.sn}<p>{order.buyer || '—'} · {order.label}</p></td><td>{money(order.totalAmount)}</td><td>{order.state}{order.state === 'ON_HOLD' && <p className={styles.error}>Order held. Review stock and backend processing.</p>}{order.deadline && <p>Ship by {new Date(order.deadline).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })} · {order.deadline < now ? 'Overdue' : `${Math.ceil((order.deadline - now) / 3600000)}h left`}</p>}</td><td>{order.tracking || '—'}</td><td><div className={styles.actions}><Button variant="outline" onClick={() => setDetail(order)}>View order details</Button>{order.label === 'SHOPEE' && <><Button variant="outline" disabled={action.busy} onClick={() => action.run(() => shopeeApi.syncOrder(order.sn), 'Order submitted for synchronization.', resource.reload)}>Sync order</Button><Button variant="outline" onClick={() => setDialog({ type: 'escrow', order })}>View escrow</Button>{['READY_TO_SHIP', 'TO_SHIP'].includes(order.state) && <Button variant="outline" onClick={() => setDialog({ type: 'ship', order })}>Arrange shipment</Button>}{['READY_TO_SHIP', 'TO_SHIP', 'PENDING', 'UNPAID'].includes(order.state) && <Button variant="destructive" onClick={() => setDialog({ type: 'cancel', order })}>Cancel order</Button>}{order.state === 'IN_CANCEL' && <Button variant="outline" onClick={() => setDialog({ type: 'buyer-cancel', order })}>Review buyer cancellation</Button>}{order.tracking && <Button variant="outline" disabled={action.busy} onClick={() => download(order)}>Download AWB PDF</Button>}</>}{order.label === 'TIKTOK' && <>{order.state === 'AWAITING_SHIPMENT' && <Button variant="outline" onClick={() => { setNotice(null); setDialog({ type: 'tiktok-ship', order }) }}>Arrange shipment</Button>}{(['AWAITING_COLLECTION', 'IN_TRANSIT'].includes(order.state) || order.tracking) && <Button variant="outline" onClick={() => setDialog({ type: 'tiktok-label', order })}>Download shipping label</Button>}{order.state !== 'UNPAID' && <Button variant="outline" onClick={() => setDialog({ type: 'tiktok-escrow', order })}>View escrow</Button>}{['UNPAID', 'ON_HOLD', 'AWAITING_SHIPMENT'].includes(order.state) && <Button variant="destructive" onClick={() => { setNotice(null); setDialog({ type: 'tiktok-cancel', order }) }}>Cancel order</Button>}</>}</div></td></tr>)}</DataTable>{!rows.length && <p>No orders match your filters.</p>}{source === 'local' && <div className={styles.actions}><Button variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous page</Button><span>Page {page + 1} of {Math.max(1, resource.data?.totalPages || 0)} · {resource.data?.totalElements || 0} orders</span><Button variant="secondary" disabled={page + 1 >= (resource.data?.totalPages || 0)} onClick={() => setPage(page + 1)}>Next page</Button></div>}{source === 'tiktok' && <div className={styles.actions}><Button variant="secondary" disabled={tokens.length === 1} onClick={() => setTokens(tokens.slice(0, -1))}>Previous page</Button><span>Page {tokens.length}{resource.data?.totalCount != null && ` · ${resource.data.totalCount} orders`}</span><Button variant="secondary" disabled={!resource.data?.nextPageToken} onClick={() => setTokens([...tokens, resource.data.nextPageToken])}>Next page</Button></div>}</>}
  </OwnerPanel>
  <Dialog open={Boolean(detail)} onOpenChange={open => { if (!open) setDetail(null) }}><DialogContent className={styles.dialog}><DialogTitle>Order {detail?.sn}</DialogTitle><DialogDescription>{detail?.buyer} · {detail?.state}</DialogDescription>{detail && (detail.label === 'TIKTOK' ? <TiktokOrderDetail orderId={detail.sn} /> : <><p>{detail.shippingAddress || detail.recipientAddress?.fullAddress}</p><p>Tracking: {detail.tracking || 'Not assigned'} · {money(detail.totalAmount)}</p>{detail.items?.length ? <DataTable label="Order line items" headings={['Item / SKU', 'Quantity', 'Price']}>{detail.items.map((item, index) => <tr key={index}><td>{item.itemName}<p>{item.modelSku || item.itemSku}</p></td><td>{item.quantityPurchased}</td><td>{money(item.discountedPrice ?? item.originalPrice)}</td></tr>)}</DataTable> : <p>Line item details are available in the Shopee order source.</p>}</>)}</DialogContent></Dialog>
  {dialog && (dialog.type === 'tiktok-escrow' ? <TiktokEscrow key={dialog.order.sn} order={dialog.order} close={() => setDialog(null)} /> : dialog.type.startsWith('tiktok-') ? <TiktokOrderAction key={`${dialog.type}:${dialog.order.sn}`} {...dialog} close={() => setDialog(null)} done={message => { setNotice({ message }); setDialog(null); resource.reload() }} /> : <OrderAction key={`${dialog.type}:${dialog.order.sn}`} {...dialog} close={() => setDialog(null)} reload={resource.reload} />)}
  </>
}

function TiktokOrderDetail({ orderId }) {
  const loader = useCallback(signal => tiktokApi.order(orderId, signal), [orderId])
  const resource = useApiResource(loader)
  const order = resource.data
  return <><ResourceState resource={resource} />{!resource.loading && !resource.error && (order ? <><p>{order.recipient_address?.full_address}</p><p>Tracking: {order.tracking_number || 'Not assigned'} · {money(order.payment?.total_amount)}</p>{order.line_items?.length ? <DataTable label="Order line items" headings={['Item / SKU', 'Quantity', 'Price']}>{order.line_items.map((item, index) => <tr key={item.id || index}><td>{item.product_name}<p>{[item.seller_sku, item.sku_name].filter(Boolean).join(' · ')}</p></td><td>{item.quantity}</td><td>{money(item.sale_price ?? item.original_price)}</td></tr>)}</DataTable> : <p>TikTok returned no line items for this order.</p>}</> : <p>TikTok did not return this order.</p>)}</>
}

function TiktokEscrow({ order, close }) {
  const loader = useCallback(signal => tiktokApi.escrow(order.sn, signal), [order.sn])
  const resource = useApiResource(loader)
  const escrow = resource.data
  const net = Number(escrow?.escrowAmount || 0)
  return <Dialog open onOpenChange={open => { if (!open) close() }}><DialogContent className={styles.dialog}><DialogTitle>Escrow breakdown</DialogTitle><DialogDescription>TikTok order {order.sn}</DialogDescription><ResourceState resource={resource} />{escrow && <dl className={styles.details}>{[['Original product price', escrow.orderOriginalPrice], ['Buyer total', escrow.buyerTotalAmount], ['Platform discount', escrow.platformDiscount], ['Seller discount', escrow.sellerDiscount], ['Shipping fee', escrow.shippingFee], ['Commission fee', escrow.commissionFee], ['Service fee', escrow.serviceFee], ['Transaction fee', escrow.transactionFee], ['Refund amount', escrow.refundAmount]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{money(value)}</dd></div>)}<div><dt>Net escrow</dt><dd className={net < 0 ? styles.error : undefined}>{money(net)}</dd></div><div><dt>Payment method</dt><dd>{escrow.paymentMethod || '—'}</dd></div><div><dt>Currency</dt><dd>{escrow.currency || '—'}</dd></div></dl>}</DialogContent></Dialog>
}

function TiktokOrderAction({ type, order, close, done }) {
  const ship = type === 'tiktok-ship'
  const cancel = type === 'tiktok-cancel'
  const action = useApiAction()
  const [documentType, setDocumentType] = useState('SL_PDF')
  const [reason, setReason] = useState('OUT_OF_STOCK')
  const loader = useCallback(async signal => {
    if (cancel) return null
    const [packageId, documentTypes] = await Promise.all([
      ship || !packageIdOf(order) ? tiktokApi.order(order.sn, signal).then(packageIdOf) : packageIdOf(order),
      ship ? null : tiktokApi.shippingDocumentTypes(signal),
    ])
    return { packageId, documentTypes }
  }, [cancel, ship, order])
  const resource = useApiResource(loader)
  const packageId = resource.data?.packageId
  function submit(event) {
    event.preventDefault()
    const shipped = result => result?.tracking_number ? `Shipment confirmed. Tracking: ${result.tracking_number}` : 'Shipment confirmed.'
    if (ship) return action.run(() => tiktokApi.shipPackage({ orderId: order.sn, packageId }), shipped, result => done(shipped(result)))
    if (cancel) return action.run(async () => {
      const result = await tiktokApi.cancelOrder(order.sn, reason)
      if (result?.canceled === false) throw new Error('TikTok did not accept this cancellation.')
      return result
    }, 'Order cancelled.', () => done('Order cancelled.'))
    action.run(async () => {
      const pdf = await tiktokApi.shippingLabel({ packageId, documentType })
      const url = URL.createObjectURL(pdf)
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `TikTok-${documentType}-${order.sn.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`; anchor.click()
      setTimeout(() => URL.revokeObjectURL(url), 30_000)
    }, 'Shipping label downloaded.')
  }
  return <Dialog open onOpenChange={open => { if (!open && !action.busy) close() }}><DialogContent className={styles.dialog}><DialogTitle>{ship ? 'Arrange TikTok shipment' : cancel ? 'Cancel TikTok order' : 'Download shipping label'}</DialogTitle><DialogDescription>TikTok order {order.sn}</DialogDescription><ResourceState resource={resource} />{!resource.loading && !resource.error && <form className={styles.form} onSubmit={submit}>
    {cancel ? <label className={styles.field}>Cancellation reason<select value={reason} onChange={event => setReason(event.target.value)}><option value="OUT_OF_STOCK">Out of stock</option><option value="CUSTOMER_REQUEST">Customer request</option></select></label> : packageId ? <p>Package {packageId}</p> : <p className={styles.error}>TikTok did not return a package for this order.</p>}
    {!ship && !cancel && <label className={styles.field}>Label type<select value={documentType} onChange={event => setDocumentType(event.target.value)}>{resource.data.documentTypes.map(value => <option key={value}>{value}</option>)}</select></label>}
    <Feedback value={action.feedback} /><div className={styles.actions}><Button type="button" variant="secondary" disabled={action.busy} onClick={close}>Back</Button><Button type="submit" variant={cancel ? 'destructive' : undefined} disabled={action.busy || (!cancel && !packageId)}>{action.busy ? 'Submitting…' : ship ? 'Confirm shipment' : cancel ? 'Confirm cancellation' : 'Download label'}</Button></div>
  </form>}</DialogContent></Dialog>
}

function OrderAction({ type, order, close, reload }) {
  const action = useApiAction()
  const [mode, setMode] = useState('dropoff')
  const [address, setAddress] = useState('')
  const [slot, setSlot] = useState('')
  const [branch, setBranch] = useState('')
  const [reason, setReason] = useState('OUT_OF_STOCK')
  const [operation, setOperation] = useState('ACCEPT')
  const loader = useCallback(() => type === 'ship' ? shopeeApi.shippingParameters(order.sn) : type === 'escrow' ? shopeeApi.escrow(order.sn) : Promise.resolve(null), [type, order.sn])
  const resource = useApiResource(loader)
  const parameters = resource.data
  const addresses = parameters?.pickupAddresses || []
  const selectedAddress = addresses.find(item => String(item.addressId) === address)
  function submit(event) {
    event.preventDefault()
    action.run(async () => {
      if (type === 'ship') return shopeeApi.ship(order.sn, mode === 'pickup' ? { shippingMode: mode, addressId: Number(address), pickupTimeId: slot } : { shippingMode: mode, ...(branch ? { branchId: Number(branch) } : {}) })
      const result = type === 'cancel' ? await shopeeApi.cancelOrder(order.sn, reason) : await shopeeApi.handleCancellation(order.sn, operation)
      if (result.canceled === false || result.success === false) throw new Error('Shopee did not accept this request.')
      return result
    }, 'Shopee operation completed.', () => { reload(); close() })
  }
  const title = type === 'ship' ? 'Arrange shipment' : type === 'escrow' ? 'Escrow breakdown' : type === 'cancel' ? 'Cancel order' : 'Review buyer cancellation'
  return <Dialog open onOpenChange={open => { if (!open && !action.busy) close() }}><DialogContent className={styles.dialog}><DialogTitle>{title}</DialogTitle><DialogDescription>Shopee order {order.sn}</DialogDescription><ResourceState resource={resource} />{!resource.loading && !resource.error && (type === 'escrow' ? <dl className={styles.details}>{[['Merchandise subtotal', parameters.orderOriginalPrice], ['Buyer total', parameters.buyerTotalAmount], ['Shopee shipping rebate', parameters.shopeeShippingRebate], ['Commission fee', parameters.commissionFee], ['Transaction fee', parameters.sellerTransactionFee], ['Service fee', parameters.serviceFee], ['Reverse shipping fee', parameters.reverseShippingFee], ['Return refund', parameters.sellerReturnRefund], ['Net escrow', Math.max(0, Number(parameters.escrowAmount || 0))]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{money(value)}</dd></div>)}</dl> : <form className={styles.form} onSubmit={submit}>
    {type === 'ship' ? <><label className={styles.field}>Shipping mode<select value={mode} onChange={event => setMode(event.target.value)}><option value="dropoff">Dropoff</option><option value="pickup">Pickup</option></select></label>{mode === 'pickup' ? <><label className={styles.field}>Pickup address<select required value={address} onChange={event => { setAddress(event.target.value); setSlot('') }}><option value="">Choose address</option>{addresses.map(item => <option key={item.addressId} value={item.addressId}>{item.address}</option>)}</select></label><label className={styles.field}>Pickup time<select required value={slot} onChange={event => setSlot(event.target.value)}><option value="">Choose time slot</option>{selectedAddress?.timeSlots?.map(item => <option key={item.pickupTimeId} value={item.pickupTimeId}>{dateTime(item.date)} · {item.timeText}</option>)}</select></label></> : parameters?.dropoffBranches?.length ? <label className={styles.field}>Dropoff branch<select required value={branch} onChange={event => setBranch(event.target.value)}><option value="">Choose branch</option>{parameters.dropoffBranches.map(item => <option key={item.branchId} value={item.branchId}>{item.address || item.branchId}</option>)}</select></label> : <p>Shopee did not provide a branch selector for this order.</p>}</> : type === 'cancel' ? <label className={styles.field}>Cancellation reason<select value={reason} onChange={event => setReason(event.target.value)}><option value="OUT_OF_STOCK">Out of stock</option><option value="CUSTOMER_REQUEST">Customer request</option></select></label> : <label className={styles.field}>Buyer cancellation decision<select value={operation} onChange={event => setOperation(event.target.value)}><option value="ACCEPT">Accept</option><option value="REJECT">Reject</option></select></label>}
    <Feedback value={action.feedback} /><div className={styles.actions}><Button type="button" variant="secondary" disabled={action.busy} onClick={close}>Back</Button><Button type="submit" disabled={action.busy}>{action.busy ? 'Submitting…' : type === 'ship' ? 'Confirm shipment' : type === 'cancel' ? 'Confirm cancellation' : 'Submit decision'}</Button></div>
  </form>)}</DialogContent></Dialog>
}
