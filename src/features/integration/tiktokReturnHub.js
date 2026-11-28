// Maps TikTok Shop return DTOs (snake_case) onto the rows of the return hub.
const toMs = epochSeconds => (epochSeconds ? Number(epochSeconds) * 1000 : null)

// refund_amount is an object {refund_total, ...} with string amounts; older payloads sent a scalar.
export const refundTotal = record => record?.refund_amount?.refund_total ?? record?.refund_amount

// Fallback when aftersale reasons do not provide returnStatuses.
export const FALLBACK_RETURN_STATUSES = ['RETURN_OR_REFUND_REQUEST_PENDING', 'AWAITING_BUYER_SHIP', 'BUYER_SHIPPED_ITEM', 'RETURN_OR_REFUND_REQUEST_SUCCESS', 'RETURN_OR_REFUND_REQUEST_COMPLETE', 'REFUND_OR_RETURN_REQUEST_REJECT', 'REJECT_RECEIVE_PACKAGE', 'RETURN_OR_REFUND_REQUEST_CANCEL']

const STATUS_META = {
  RETURN_OR_REFUND_REQUEST_PENDING: { label: 'Awaiting seller decision', cls: 'statusAction', stage: 'need_action', canDecide: true },
  AWAITING_BUYER_RESPONSE: { label: 'Awaiting buyer response', cls: 'statusAction', stage: 'need_action' },
  AWAITING_BUYER_SHIP: { label: 'Awaiting buyer shipment', cls: 'statusTransit', stage: 'in_return_transit', awaitingShipment: true },
  // TikTok sends no delivery signal: the seller decides once the parcel is in hand.
  BUYER_SHIPPED_ITEM: { label: 'Returning to shop', cls: 'statusTransit', stage: 'in_return_transit', shipped: true, canDecide: true },
  RETURN_OR_REFUND_REQUEST_SUCCESS: { label: 'Refund accepted', cls: 'statusSuccess', stage: 'completed' },
  RETURN_OR_REFUND_REQUEST_COMPLETE: { label: 'Refunded', cls: 'statusSuccess', stage: 'completed' },
  REFUND_OR_RETURN_REQUEST_REJECT: { label: 'Request rejected', cls: 'statusClosed', stage: 'completed' },
  REJECT_RECEIVE_PACKAGE: { label: 'Returned parcel rejected', cls: 'statusClosed', stage: 'completed' },
  RETURN_OR_REFUND_REQUEST_CANCEL: { label: 'Request cancelled', cls: 'statusClosed', stage: 'completed' },
}

export function getTiktokReturnMeta(record) {
  if (record?.arbitration_status === 'IN_ARBITRATION') {
    return { label: 'Under TikTok arbitration', cls: 'statusDispute', stage: 'dispute' }
  }
  // An unrecognised status stays on the default tab so it cannot go unnoticed.
  return STATUS_META[record?.return_status] ?? { label: record?.return_status || 'Unknown status', cls: 'statusClosed', stage: 'need_action' }
}

// TikTok lists one line per returned unit, so identical SKUs are counted together.
function groupItems(lines = []) {
  const items = new Map()
  for (const [index, line] of lines.entries()) {
    const sku = line.seller_sku || line.sku_id
    const key = sku || index
    const item = items.get(key) ?? { sku: sku || '—', name: line.product_name || 'TikTok product', variant: line.sku_name || '', qty: 0 }
    item.qty += line.quantity ?? 1
    items.set(key, item)
  }
  return [...items.values()]
}

export function normalizeTiktokReturn(raw) {
  return {
    id: raw.return_id,
    orderId: raw.order_id,
    refundOnly: raw.return_type === 'REFUND' || raw.return_type === 'REFUND_ONLY',
    reasonText: raw.return_reason_text || raw.return_reason || '—',
    refundAmount: Number(refundTotal(raw) || 0),
    shippingRefund: Number(raw.refund_amount?.refund_shipping_fee || 0),
    trackingNumber: raw.return_tracking_number || raw.tracking_number || '',
    createdAt: toMs(raw.create_time),
    items: groupItems(raw.return_line_items),
    meta: getTiktokReturnMeta(raw),
  }
}
