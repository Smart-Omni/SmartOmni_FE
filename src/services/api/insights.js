import { request } from './client'

export const insightsApi = {
  sales: (options = 7, signal) => {
    const params = typeof options === 'number'
      ? { periodDays: options }
      : (options?.from && options?.to
          ? { from: options.from, to: options.to }
          : { periodDays: options?.periodDays ?? 7 })
    return request('/api/v1/ai/insights/sales', { params, signal })
  },
}
