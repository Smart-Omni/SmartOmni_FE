// TikTok Shop data for the Order Hub: maps the TikTok API onto the order shape the hub renders for Shopee.
import { tiktokApi } from '@/services/api/tiktok'
import { maskAddress, maskPhone } from './orderPrivacy'

export const TIKTOK_PAGE_SIZE = 50

export const TIKTOK_STATUS_META = {
  UNPAID: { label: 'Awaiting payment', cls: 'statusPending', stage: 'all', canCancel: true },
  ON_HOLD: { label: 'On hold', cls: 'statusPending', stage: 'all' },
  AWAITING_SHIPMENT: { label: 'Awaiting preparation', cls: 'statusToShip', stage: 'to_prepare', canPrepare: true, canCancel: true },
  AWAITING_COLLECTION: { label: 'Prepared · Awaiting pickup', cls: 'statusProcessed', stage: 'ready_pickup', hasLabel: true },
  PARTIALLY_SHIPPING: { label: 'Partially shipping', cls: 'statusShipping', stage: 'shipping', hasLabel: true },
  IN_TRANSIT: { label: 'Shipping', cls: 'statusShipping', stage: 'shipping', hasLabel: true },
  DELIVERED: { label: 'Delivered', cls: 'statusShipping', stage: 'shipping' },
  COMPLETED: { label: 'Completed', cls: 'statusDone', stage: 'completed' },
  CANCELLED: { label: 'Cancelled', cls: 'statusDone', stage: 'cancelled' },
}

const PACKED_STATUSES = ['AWAITING_COLLECTION', 'PARTIALLY_SHIPPING', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED']
const CLOSED_RETURN_STATUSES = ['RETURN_OR_REFUND_REQUEST_CANCEL', 'REFUND_OR_RETURN_REQUEST_REJECT', 'REJECT_RECEIVE_PACKAGE']

export const tiktokPackageId = order => order?.package_id || order?.package_list?.[0]?.package_id || order?.line_items?.[0]?.package_id || null

export async function downloadTiktokLabel(order) {
  const packageId = order.packageId || tiktokPackageId(await tiktokApi.order(order.id))
  try {
    return await tiktokApi.shippingLabel({ ...(packageId ? { packageId } : { orderId: order.id }), documentType: 'SHIPPING_LABEL' })
  } catch (error) {
    // The API layer reports "no label yet" with status 200.
    if (error.status === 200) throw new Error('TikTok has no shipping label for this order yet. Please try again later.', { cause: error })
    throw error
  }
}

// Orders drive the screen. Buyer cancellations and returns only enrich it, so their failure must not hide the orders.
export async function loadTiktokHub(pageToken, signal) {
  const optional = promise => promise.catch(error => {
    if (signal?.aborted) throw error
    return null
  })
  const [page, cancellations, returns] = await Promise.all([
    tiktokApi.orders({ pageSize: TIKTOK_PAGE_SIZE, pageToken: pageToken || undefined }, signal),
    optional(tiktokApi.cancellations({ status: 'CANCELLATION_REQUEST_PENDING', pageSize: TIKTOK_PAGE_SIZE }, signal)),
    optional(tiktokApi.returns({ pageSize: TIKTOK_PAGE_SIZE }, signal)),
  ])
  return {
    orders: page.orders,
    nextPageToken: page.nextPageToken,
    totalCount: page.totalCount,
    cancellations: cancellations?.cancellations ?? cancellations?.cancel_list ?? [],
    returns: returns?.returns ?? [],
    warnings: [
      !cancellations && 'cancellation requests',
      !returns && 'return requests',
    ].filter(Boolean),
  }
}

// TikTok returns one line item per unit, so identical SKUs are merged into one row with a quantity.
function groupItems(lineItems = []) {
  const rows = new Map()
  for (const item of lineItems) {
    const price = Number(item.sale_price ?? item.original_price ?? 0)
    const key = `${item.sku_id || item.seller_sku || item.id}::${price}`
    const row = rows.get(key) || {
      sku: item.seller_sku || item.sku_id || '—',
      name: item.product_name || 'TikTok product',
      variant: item.sku_name || 'Default',
      qty: 0,
      price,
      productId: item.product_id,
      skuId: item.sku_id,
    }
    row.qty += item.quantity ?? 1
    rows.set(key, row)
  }
  return Array.from(rows.values())
}

export function normalizeTiktokOrders(data, packedSet) {
  if (!data) return []
  const cancelByOrder = new Map(data.cancellations
    .filter(item => item.cancel_status === 'CANCELLATION_REQUEST_PENDING')
    .map(item => [item.order_id, item]))
  const returnOrderIds = new Set(data.returns
    .filter(item => !CLOSED_RETURN_STATUSES.includes(item.return_status))
    .map(item => item.order_id))

  return data.orders.map(raw => {
    const id = raw.order_id
    const status = raw.order_status || 'UNPAID'
    const createdAt = raw.create_time ? raw.create_time * 1000 : Date.now()
    const updatedAt = raw.update_time ? raw.update_time * 1000 : createdAt
    const cancelRequest = status === 'CANCELLED' ? null : cancelByOrder.get(id) || null
    const base = TIKTOK_STATUS_META[status] || { label: status, cls: 'statusDone', stage: 'all' }
    let meta = base
    if (cancelRequest) {
      meta = { label: 'Buyer requested cancellation', cls: 'statusInCancel', stage: 'cancel_request', isCancelReq: true, hasLabel: base.hasLabel }
    } else if (returnOrderIds.has(id)) {
      meta = { label: 'Return requested', cls: 'statusInCancel', stage: 'returned' }
    }
    const reason = cancelRequest?.cancel_reason_text || cancelRequest?.cancel_reason || raw.cancel_reason

    return {
      id,
      channel: 'TIKTOK',
      rawStatus: status,
      meta,
      paymentLabel: '',
      buyerName: raw.recipient_address?.name || raw.buyer_email || 'TikTok buyer',
      buyerPhone: maskPhone(raw.recipient_address?.phone_number),
      shippingAddress: maskAddress(raw.recipient_address?.full_address),
      buyerNote: reason ? `Cancellation reason: ${reason}` : '',
      carrier: raw.shipping_provider || 'TikTok carrier',
      trackingNumber: raw.tracking_number || '',
      packageId: tiktokPackageId(raw),
      cancelRequest,
      createdAt,
      updatedAt,
      handoverAt: raw.rts_time ? raw.rts_time * 1000 : updatedAt,
      cancelRespondBy: null,
      deadlineAt: raw.rts_sla_time ? raw.rts_sla_time * 1000 : null,
      totalAmount: Number(raw.payment?.total_amount ?? 0),
      packed: packedSet.has(id) || PACKED_STATUSES.includes(status),
      items: groupItems(raw.line_items),
    }
  })
}
