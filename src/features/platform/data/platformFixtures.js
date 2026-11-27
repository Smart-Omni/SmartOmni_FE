export const initialPlans = [
  { id: 'Free', description: 'A starting point for a single connected shop.', skuLimit: 100, shopLimit: 1, managerLimit: 2 },
  { id: 'Pro', description: 'More room for growing, multi-channel teams.', skuLimit: 1000, shopLimit: 3, managerLimit: 10 },
]

export const initialTenants = [
  { id: 'demo-tenant', name: 'Everyday Studio', domain: 'everyday-studio', owner: 'Alex Morgan', email: 'owner@smartomni.demo', plan: 'Pro', status: 'ACTIVE', skus: 248, manager: 3, created: '2026-10-02', shops: [{ platform: 'shopee', name: 'Everyday Studio Official', status: 'Connected' }, { platform: 'tiktok', name: 'Everyday Studio', status: 'Needs attention' }] },
  { id: 'tenant-02', name: 'Moss & Clay', domain: 'moss-and-clay', owner: 'Linh Tran', email: 'linh@moss-clay.example', plan: 'Pro', status: 'ACTIVE', skus: 736, manager: 7, created: '2026-09-18', shops: [{ platform: 'shopee', name: 'Moss & Clay', status: 'Connected' }, { platform: 'tiktok', name: 'Moss & Clay Home', status: 'Connected' }] },
  { id: 'tenant-03', name: 'Sunday Supply', domain: 'sunday-supply', owner: 'Minh Pham', email: 'minh@sunday.example', plan: 'Free', status: 'ACTIVE', skus: 92, manager: 2, created: '2026-10-08', shops: [{ platform: 'shopee', name: 'Sunday Supply', status: 'Connected' }] },
  { id: 'tenant-04', name: 'Northline Goods', domain: 'northline-goods', owner: 'Bao Le', email: 'bao@northline.example', plan: 'Pro', status: 'SUSPENDED', skus: 418, manager: 4, created: '2026-08-25', suspensionReason: 'Demo review: repeated marketplace connection failures.', shops: [{ platform: 'shopee', name: 'Northline Official', status: 'Paused' }, { platform: 'tiktok', name: 'Northline Goods', status: 'Paused' }] },
  { id: 'tenant-05', name: 'Little Leaf', domain: 'little-leaf', owner: 'Ha Nguyen', email: 'ha@little-leaf.example', plan: 'Free', status: 'ONBOARDING', skus: 0, manager: 0, created: '2026-10-23', shops: [] },
  { id: 'tenant-06', name: 'Form & Function — Home and Everyday Essentials', domain: 'form-and-function', owner: 'Quynh Vo', email: 'quynh@form-function.example', plan: 'Pro', status: 'ACTIVE', skus: 965, manager: 8, created: '2026-09-05', shops: [{ platform: 'shopee', name: 'Form & Function', status: 'Connected' }, { platform: 'tiktok', name: 'Form & Function Home', status: 'Connected' }] },
  { id: 'tenant-07', name: 'Daybreak Coffee', domain: 'daybreak-coffee', owner: 'Khanh Do', email: 'khanh@daybreak.example', plan: 'Free', status: 'ACTIVE', skus: 34, manager: 1, created: '2026-10-14', shops: [{ platform: 'shopee', name: 'Daybreak Coffee', status: 'Connected' }] },
  { id: 'tenant-08', name: 'Paper House', domain: 'paper-house', owner: 'Thanh Dang', email: 'thanh@paper-house.example', plan: 'Free', status: 'ACTIVE', skus: 67, manager: 1, created: '2026-10-20', shops: [{ platform: 'tiktok', name: 'Paper House', status: 'Connected' }] },
]

export const initialAudit = [
  { id: 'audit-seed-1', at: '2026-10-22T07:30:00.000Z', actor: 'Taylor Lee', action: 'Tenant suspended', target: 'Northline Goods', tenantId: 'tenant-04', reason: 'Demo review: repeated marketplace connection failures.' },
  { id: 'audit-seed-2', at: '2026-10-20T02:15:00.000Z', actor: 'Taylor Lee', action: 'Tenant reviewed', target: 'Paper House', tenantId: 'tenant-08', reason: 'Initial workspace review completed.' },
]
