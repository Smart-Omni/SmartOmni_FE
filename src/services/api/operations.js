import { request } from './client'

export function requireId(value, label = 'ID') {
  const id = String(value).trim()
  if (!/^[1-9]\d*$/.test(id) || id.length > 19 || BigInt(id) > 9223372036854775807n) throw new Error(`Enter a valid ${label}.`)
  return id
}

export const productApi = {
  create: body => request('/api/v1/products', { method: 'POST', body }),
  detail: (id, signal) => request(`/api/v1/products/${requireId(id, 'product ID')}`, { signal }),
  skus: (id, signal) => request(`/api/v1/products/${requireId(id, 'product ID')}/skus`, { signal }),
}

export const inventoryApi = {
  adjust: (skuId, quantity) => {
    if (!Number.isInteger(quantity) || quantity < 0 || quantity > 2147483647) throw new Error('Enter a whole stock quantity from 0 to 2,147,483,647.')
    return request(`/api/v1/inventory/${requireId(skuId, 'SKU ID')}/adjust`, { method: 'POST', params: { quantity } })
  },
}

export const orderApi = {
  track: (platform, orderId) => request('/api/v1/orders/track', { params: { platform, orderId } }),
}

export const aiApi = {
  forecast: (skuId, signal) => request(`/api/v1/ai/forecast/${requireId(skuId, 'SKU ID')}`, { signal }),
  runForecast: () => request('/api/v1/ai/forecast/run', { method: 'POST' }),
  recommendations: (skuId, signal) => request(`/api/v1/ai/recommendations/${requireId(skuId, 'SKU ID')}`, { signal }),
}
