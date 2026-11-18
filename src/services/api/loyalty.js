import { request } from './client'

const base = '/api/v1/loyalty'
const get = (path, signal) => request(base + path, { signal })
const post = (path, body) => request(base + path, { method: 'POST', body })

export const loyaltyApi = {
  profile: signal => get('/me', signal),
  claims: signal => get('/me/claims', signal),
  claim: body => post('/claims', body),
  campaigns: signal => get('/campaigns', signal),
  myVouchers: signal => get('/me/vouchers', signal),
  requestReward: body => post('/me/reward-requests', body),
  rewardRequests: signal => get('/reward-requests', signal),
  createCampaign: body => post('/campaigns', body),
  updateCampaign: (id, body) => request(`${base}/campaigns/${encodeURIComponent(id)}`, { method: 'PATCH', body }),
}
