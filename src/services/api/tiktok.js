import { ApiError, request } from './client'

const base = '/api/marketplace-connections/tiktok-shop'
const post = path => request(base + path, { method: 'POST' })
const importReport = report => ({ ...report, id: report.runId, ...report.counters })
const ordersBase = '/api/marketplace-connections/tiktok/orders'
const orderPage = data => ({ orders: data?.orders ?? data?.order_list ?? [], nextPageToken: data?.next_page_token || null, totalCount: data?.total_count ?? null })
const logisticsBase = '/api/marketplace-connections/tiktok/logistics'
const cancellationsBase = '/api/marketplace-connections/tiktok/cancellations'
// BE answers 200 with an empty (or non-PDF) body when TikTok has no label yet.
const labelUnavailable = () => new ApiError('Shipping label is not available from TikTok yet. Please try again later.', 200)
export const tiktokApi = {
  shippingDocumentTypes: signal => request(logisticsBase + '/shipping-providers', { signal }).then(data => data?.documentTypes?.length ? data.documentTypes : ['SL_PDF']),
  cancelOrder: (orderId, cancelReason) => request(cancellationsBase + '/cancel', { method: 'POST', body: { orderId, cancelReason } }),
  shipPackage: body => request(logisticsBase + '/ship-package', { method: 'POST', body }),
  shippingLabel: params => request(logisticsBase + '/shipping-label/download', { params, blob: true }).then(pdf => { if (!pdf?.size) throw labelUnavailable(); return pdf }, error => { throw error.status === 200 ? labelUnavailable() : error }),
  orders: (params, signal) => request(ordersBase, { params, signal }).then(orderPage),
  order: (orderId, signal) => request(`${ordersBase}/${encodeURIComponent(orderId)}`, { signal }).then(data => data?.[0] ?? null),
  syncOrders: body => request(ordersBase + '/sync', { method: 'POST', body }).then(orderPage),
  connection: signal => request(base, { signal }),
  authorize: () => post('/authorization'),
  callback: body => request(base + '/callback', { method: 'POST', body }),
  disconnect: () => post('/disconnect'),
  importProducts: () => post('/products/import').then(importReport),
  importRuns: signal => request(base + '/products/import-runs', { params: { limit: 10 }, signal }).then(reports => reports.map(importReport)),
  syncWarehouses: () => post('/warehouses/sync'),
  syncPrices: () => post('/prices/sync'),
}
