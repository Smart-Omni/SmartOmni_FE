import { request } from './client'

export function requireId(value, label = 'ID') {
  const id = String(value).trim()
  if (!/^[1-9]\d*$/.test(id) || id.length > 19 || BigInt(id) > 9223372036854775807n) throw new Error(`Enter a valid ${label}.`)
  return id
}

export const productApi = {
  list: (params, signal) => request('/api/v1/products', { params, signal }),
  create: body => request('/api/v1/products', { method: 'POST', body }),
  detail: (id, signal) => request(`/api/v1/products/${requireId(id, 'product ID')}`, { signal }),
  skus: (id, signal) => request(`/api/v1/products/${requireId(id, 'product ID')}/skus`, { signal }),
  batchSkus: (ids, signal) => request('/api/v1/products/skus', { params: { productIds: ids.join(',') }, signal }),
}

export const inventoryApi = {
  list: (params, signal) => request('/api/v1/inventory', { params, signal }),
  adjust: (skuId, quantity) => {
    if (!Number.isInteger(quantity) || quantity < 0 || quantity > 2147483647) throw new Error('Enter a whole stock quantity from 0 to 2,147,483,647.')
    return request(`/api/v1/inventory/${requireId(skuId, 'SKU ID')}/adjust`, { method: 'POST', params: { quantity } })
  },
  deduct: (skuId, quantity) => changeStockBy(skuId, 'deduct', quantity),
  restock: (skuId, quantity, idempotencyKey) => changeStockBy(skuId, 'restock', quantity, idempotencyKey),
}

function changeStockBy(skuId, operation, quantity, idempotencyKey) {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 2147483647) throw new Error('Enter a whole quantity from 1 to 2,147,483,647.')
  return request(`/api/v1/inventory/${requireId(skuId, 'SKU ID')}/${operation}`, {
    method: 'POST',
    params: { quantity, idempotencyKey },
  })
}

export const orderApi = {
  detail: (id, signal) => request(`/api/v1/orders/${requireId(id, 'order ID')}`, { signal }),
  create: body => request('/api/v1/orders', { method: 'POST', body }),
  track: (platform, orderId) => request('/api/v1/orders/track', { params: { platform, orderId } }),
  updateStatus: (id, status) => request(`/api/v1/orders/${requireId(id)}/status`, { method: 'PATCH', params: { status } }),
  updateTracking: body => request('/api/v1/orders/tracking', { method: 'PATCH', body }),
}

export const returnApi = {
  list: (params, signal) => request('/api/v1/returns', { params, signal }),
  create: (orderId, reason) => request('/api/v1/returns', { method: 'POST', body: { orderId: requireId(orderId), reason } }),
  approve: id => request(`/api/v1/returns/${requireId(id)}/approve`, { method: 'POST' }),
}

export const aiApi = {
  forecast: (skuId, signal) => request(`/api/v1/ai/forecast/${requireId(skuId, 'SKU ID')}`, { signal }),
  runForecast: () => request('/api/v1/ai/forecast/run', { method: 'POST' }),
  recommendations: (skuId, signal) => request(`/api/v1/ai/recommendations/${requireId(skuId, 'SKU ID')}`, { signal }),
}
