import { ApiError, request } from './client'

const connectionBase = '/api/v1/marketplace-connections/tiktok-shop'
const tiktokBase = '/api/v1/tiktok'
const productsBase = tiktokBase + '/products'
const importReport = report => ({ ...report, id: report.runId, ...report.counters })
const ordersBase = tiktokBase + '/orders'
const orderPage = data => ({ orders: data?.orders ?? data?.order_list ?? [], nextPageToken: data?.next_page_token || null, totalCount: data?.total_count ?? null })
const logisticsBase = tiktokBase + '/logistics'
const cancellationsBase = tiktokBase + '/cancellations'
const catalogBase = tiktokBase + '/catalog'
const vouchersBase = tiktokBase + '/vouchers'
const aftersaleBase = tiktokBase + '/aftersale'
const financeBase = tiktokBase + '/finance'
const returnsBase = tiktokBase + '/returns'
const returnPath = returnId => `${returnsBase}/${encodeURIComponent(returnId)}`
const returnPage = data => ({ returns: data?.returns ?? data?.return_list ?? data?.return_orders ?? [], nextPageToken: data?.next_page_token || null, totalCount: data?.total_count ?? null })
// BE answers 200 with an empty (or non-PDF) body when TikTok has no label yet.
const labelUnavailable = () => new ApiError('Shipping label is not available from TikTok yet. Please try again later.', 200)
export const tiktokApi = {
  shippingProviders: (packageId, signal) => request(logisticsBase + '/shipping-providers', { params: { packageId }, signal }).then(data => Array.isArray(data) ? data : []),
  shippingDocumentTypes: (packageId, signal) => request(logisticsBase + '/shipping-providers', { params: { packageId }, signal }).then(data => data?.documentTypes?.length ? data.documentTypes : ['SHIPPING_LABEL']),
  escrow: (orderId, signal) => request(`${financeBase}/escrow/${encodeURIComponent(orderId)}`, { signal }),
  // Finance DTOs are camelCase, unlike orders and returns.
  settlements: (params, signal) => request(financeBase + '/settlements', { params, signal }).then(data => ({ settlements: data?.settlements ?? [], nextPageToken: data?.nextPageToken || null, total: data?.total ?? null })),
  returns: (params, signal) => request(returnsBase, { params, signal }).then(returnPage),
  returnDetail: (returnId, signal) => request(returnPath(returnId), { signal }),
  approveReturn: returnId => request(returnPath(returnId) + '/approve', { method: 'POST' }),
  rejectReturn: (returnId, rejectReason) => request(returnPath(returnId) + '/reject', { method: 'POST', body: rejectReason ? { rejectReason } : undefined }),
  cancelOrder: (orderId, cancelReason) => request(cancellationsBase + '/cancel', { method: 'POST', body: { orderId, cancelReason } }),
  cancellations: (params, signal) => request(cancellationsBase, { params, signal }),
  decideCancellation: (id, decision) => request(`${cancellationsBase}/${encodeURIComponent(id)}/${decision}`, { method: 'POST' }),
  aftersaleReasons: signal => request(aftersaleBase + '/reasons', { signal }),
  rejectReasons: (id, signal) => request(aftersaleBase + '/reject-reasons', { params: { returnOrCancelId: id }, signal }),
  aftersaleEligibility: (id, signal) => request(`${aftersaleBase}/eligibility/${encodeURIComponent(id)}`, { signal }),
  shipPackage: body => request(logisticsBase + '/ship-package', { method: 'POST', body }),
  shippingLabel: params => request(logisticsBase + '/shipping-label/download', { params, blob: true }).then(pdf => { if (!pdf?.size) throw labelUnavailable(); return pdf }, error => { throw error.status === 200 || error.code === 'SHIPPING_LABEL_UNAVAILABLE' ? labelUnavailable() : error }),
  orders: (params, signal) => request(ordersBase, { params, signal }).then(orderPage),
  order: (orderId, signal) => request(`${ordersBase}/${encodeURIComponent(orderId)}`, { signal }).then(data => data?.[0] ?? null),
  syncOrders: body => request(ordersBase + '/sync', { method: 'POST', body }),
  connection: signal => request(connectionBase, { signal }),
  authorize: () => request(connectionBase + '/authorization', { method: 'POST' }),
  callback: body => request(connectionBase + '/callback', { method: 'POST', body }),
  disconnect: () => request(connectionBase + '/disconnect', { method: 'POST' }),
  importProducts: () => request(productsBase + '/products/import', { method: 'POST' }).then(importReport),
  autoImport: shopId => request('/api/v1/tiktok/catalog/auto-import', { method: 'POST', params: shopId ? { shopId } : undefined }),
  importRuns: signal => request(productsBase + '/products/import-runs', { params: { limit: 10 }, signal }).then(reports => reports.map(importReport)),
  syncWarehouses: () => request(productsBase + '/warehouses/sync', { method: 'POST' }),
  syncPrices: () => request(productsBase + '/prices/sync', { method: 'POST' }),
  updateStock: (productId, skuId, quantity) => request(productsBase + '/stock', { method: 'PUT', body: { productId, skuId, quantity } }),
  updatePrice: body => request(productsBase + '/price', { method: 'PUT', body }),
  catalog: signal => request(catalogBase, { signal }),
  autoImport: () => request(catalogBase + '/auto-import', { method: 'POST' }),
  vouchers: signal => request(vouchersBase, { signal }),
  createVoucher: body => request(vouchersBase, { method: 'POST', body }),
  syncVouchers: () => request(vouchersBase + '/sync', { method: 'POST' }),
}
