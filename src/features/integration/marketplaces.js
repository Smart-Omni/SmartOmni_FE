import { shopeeApi } from '@/services/api/shopee'
import { tiktokApi } from '@/services/api/tiktok'

export const marketplaces = {
  shopee: { name: 'Shopee', api: shopeeApi },
  'tiktok-shop': { name: 'TikTok Shop', api: tiktokApi },
}

export function syncPriceSummary(result) {
  const fields = [['considered', 'prices compared'], ['applied', 'applied'], ['heldAnomaly', 'anomalies flagged'], ['unchanged', 'unchanged'], ['rejected', 'rejected'], ['missing', 'missing']]
  const values = fields.filter(([key]) => typeof result?.[key] === 'number').map(([key, label]) => `${result[key]} ${label}`)
  return values.length ? values.join(' · ') + '.' : 'Price synchronization completed.'
}
