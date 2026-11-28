import { request } from './client'

export const insightsApi = {
  sales: (periodDays = 7, signal) =>
    request('/api/v1/ai/insights/sales', { params: { periodDays }, signal }),
}
