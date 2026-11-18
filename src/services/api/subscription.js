import { request } from './client'

const base = '/api/v1/tenants/subscription'

export const subscriptionApi = {
  checkout: () => request(`${base}/checkout`, { method: 'POST' }),
  getOrderStatus: orderCode => request(`${base}/orders/${encodeURIComponent(orderCode)}/status`),
  getInvoices: () => request(`${base}/invoices`),
}

export const createSubscriptionCheckout = () => subscriptionApi.checkout()
export const getSubscriptionOrderStatus = orderCode => subscriptionApi.getOrderStatus(orderCode)
export const getSubscriptionInvoices = () => subscriptionApi.getInvoices()
