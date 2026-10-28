import { request } from './client'

const base = '/api/marketplace-connections/shopee'
const id = value => encodeURIComponent(value)
const get = (path, params, signal) => request(base + path, { params, signal })
const post = (path, body, params) => request(base + path, { method: 'POST', body, params })
const importReport = report => ({ ...report, id: report.runId, ...report.counters })

export const shopeeApi = {
  connection: signal => get('', undefined, signal),
  authorize: () => post('/authorization'),
  callback: body => post('/callback', body),
  disconnect: () => post('/disconnect'),
  importProducts: () => post('/products/import').then(importReport),
  importRuns: signal => get('/products/import-runs', { limit: 10 }, signal).then(reports => reports.map(importReport)),
  syncWarehouses: () => post('/warehouses/sync'),
  syncPrices: () => post('/prices/sync'),
  orders: (params, signal) => get('/orders', params, signal),
  localOrders: (params, signal) => request('/api/orders', { params, signal }),
  syncOrder: orderSn => post(`/orders/${id(orderSn)}/sync`),
  batchSync: params => post('/orders/batch-sync', undefined, params),
  cancelOrder: (orderSn, cancelReason) => post(`/orders/${id(orderSn)}/cancel`, { cancelReason }),
  handleCancellation: (orderSn, operation) => post(`/orders/${id(orderSn)}/handle-cancellation`, { operation }),
  logisticsChannels: signal => get('/logistics/channels', undefined, signal),
  shippingParameters: orderSn => get(`/orders/${id(orderSn)}/shipping-parameter`),
  ship: (orderSn, body) => post(`/orders/${id(orderSn)}/ship`, body),
  awb: orderSn => request(`${base}/orders/${id(orderSn)}/shipping-document`, { blob: true }),
  escrow: orderSn => get(`/orders/${id(orderSn)}/escrow`),
  returns: (params, signal) => get('/returns', params, signal),
  returnDetail: returnSn => get(`/returns/${id(returnSn)}`),
  confirmReturn: returnSn => post(`/returns/${id(returnSn)}/confirm`),
  disputeReturn: (returnSn, body) => post(`/returns/${id(returnSn)}/dispute`, body),
}
