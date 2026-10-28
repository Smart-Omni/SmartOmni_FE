import { request } from './client'

const base = '/api/marketplace-connections/tiktok-shop'
const post = path => request(base + path, { method: 'POST' })
const importReport = report => ({ ...report, id: report.runId, ...report.counters })
export const tiktokApi = {
  connection: signal => request(base, { signal }),
  authorize: () => post('/authorization'),
  callback: body => request(base + '/callback', { method: 'POST', body }),
  disconnect: () => post('/disconnect'),
  importProducts: () => post('/products/import').then(importReport),
  importRuns: signal => request(base + '/products/import-runs', { params: { limit: 10 }, signal }).then(reports => reports.map(importReport)),
  syncWarehouses: () => post('/warehouses/sync'),
  syncPrices: () => post('/prices/sync'),
}
