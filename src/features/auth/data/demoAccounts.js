// Public demo credentials only. Replace this adapter when real authentication is connected.
export const demoPassword = 'Demo@123'

export const demoAccounts = [
  { id: 'customer-1', email: 'customer@smartomni.demo', name: 'Minh Anh', role: 'CUSTOMER', roleLabel: 'Customer', verified: true, tenantId: 'demo-tenant', tenantName: 'Everyday Studio' },
  { id: 'demo-owner', email: 'owner@smartomni.demo', name: 'Alex Morgan', role: 'TENANT_OWNER', roleLabel: 'Tenant Owner', tenantId: 'demo-tenant', tenantName: 'Everyday Studio', membershipStatus: 'ACTIVE', onboardingStatus: 'COMPLETED', permissions: ['orders:read', 'inventory:read', 'products:read'] },
  { id: 'demo-staff', email: 'staff@smartomni.demo', name: 'Jamie Nguyen', role: 'TENANT_STAFF', roleLabel: 'Tenant Staff', tenantId: null, tenantName: null, membershipStatus: 'PENDING_INVITATION', permissions: [] },
  { id: 'demo-active-staff', email: 'staff.active@smartomni.demo', name: 'Sam Nguyen', role: 'TENANT_STAFF', roleLabel: 'Tenant Staff', tenantId: null, tenantName: null, membershipStatus: 'PENDING_INVITATION', permissions: [] },
  { id: 'demo-admin', email: 'admin@smartomni.demo', name: 'Taylor Lee', role: 'SUPER_ADMIN', roleLabel: 'Super Admin', tenantId: null, tenantName: null, membershipStatus: null, permissions: [] },
]
