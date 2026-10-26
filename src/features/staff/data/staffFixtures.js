import { createSupportFixture } from './supportFixtures'
export const staffOperationsKey = 'smartomni.staff-operations-demo.v1'
export const warehouses = [{ id: 'WH-HCM', name: 'Ho Chi Minh warehouse' }, { id: 'WH-HN', name: 'Hanoi warehouse' }]
export const marketplaceListings = [
  { id: 'shopee-tote', platform: 'shopee', externalId: 'SHP-101-NAT', title: 'Everyday tote · Natural', expectedSku: 'TOTE-NAT-01', price: 349000, promotion: { name: 'October sample offer', price: 329000, start: '2026-10-23', end: '2026-10-30' } },
  { id: 'shopee-mug', platform: 'shopee', externalId: 'SHP-102-SND', title: 'Ceramic mug · Sand', expectedSku: 'MUG-SND-02', price: 229000, promotion: null },
  { id: 'tiktok-mug', platform: 'tiktok', externalId: 'TT-102-SND', title: 'Ceramic mug · Sand', expectedSku: 'MUG-SND-02', price: 249000, promotion: { name: 'Sample flash offer', price: 219000, start: '2026-10-23', end: '2026-10-24' } },
  { id: 'shopee-charcoal', platform: 'shopee', externalId: 'SHP-101-CHR', title: 'Everyday tote · Charcoal', expectedSku: 'TOTE-CHR-02', price: 349000, promotion: null },
  { id: 'shopee-cushion', platform: 'shopee', externalId: 'SHP-103-OLV', title: 'Linen cushion cover · Olive', expectedSku: 'CSH-OLV-01', price: 289000, promotion: null },
  { id: 'shopee-organizer', platform: 'shopee', externalId: 'SHP-104-WAL', title: 'Desk organizer · Walnut', expectedSku: 'ORG-WAL-01', price: 595000, promotion: null },
]
export const importCandidates = [
  { id: 'import-organizer', platform: 'shopee', externalId: 'SHP-104-WAL', sku: 'ORG-WAL-01', name: 'Desk organizer · Walnut', category: 'Workspace' },
  { id: 'import-mug', platform: 'shopee', externalId: 'SHP-102-SND', sku: 'MUG-SND-02', name: 'Ceramic mug · Sand', category: 'Home' },
  { id: 'import-invalid', platform: 'shopee', externalId: 'SHP-105-UNKNOWN', sku: '', name: 'Sample item without seller SKU', category: 'Home' },
  { id: 'import-tiktok', platform: 'tiktok', externalId: 'TT-104-WAL', sku: 'ORG-WAL-01', name: 'Desk organizer · Walnut', category: 'Workspace' },
]
export const priceHistory = [
  { id: 'price-1', listingId: 'shopee-tote', at: '2026-10-20T03:00:00Z', before: 359000, after: 349000, source: 'Marketplace snapshot · demo' },
  { id: 'price-2', listingId: 'shopee-mug', at: '2026-10-21T03:00:00Z', before: 239000, after: 229000, source: 'Marketplace snapshot · demo' },
  { id: 'price-3', listingId: 'tiktok-mug', at: '2026-10-22T03:00:00Z', before: 239000, after: 249000, source: 'Marketplace snapshot · demo' },
]
export function createStaffFixture() {
  return {
    ...createSupportFixture(),
    products: [
      { id: 'product-tote', sku: 'TOTE-NAT-01', name: 'Everyday tote · Natural', category: 'Everyday', notes: '', source: 'Sample fixture' },
      { id: 'product-mug', sku: 'MUG-SND-02', name: 'Ceramic mug · Sand', category: 'Home', notes: '', source: 'Sample fixture' },
      { id: 'product-charcoal', sku: 'TOTE-CHR-02', name: 'Everyday tote · Charcoal', category: 'Everyday', notes: '', source: 'Sample fixture' },
      { id: 'product-cushion', sku: 'CSH-OLV-01', name: 'Linen cushion cover · Olive', category: 'Home', notes: '', source: 'Sample fixture' },
    ],
    inventory: [
      { id: 'inv-tote-hcm', sku: 'TOTE-NAT-01', warehouseId: 'WH-HCM', onHand: 15, reserved: 3 },
      { id: 'inv-tote-hn', sku: 'TOTE-NAT-01', warehouseId: 'WH-HN', onHand: 5, reserved: 0 },
      { id: 'inv-mug-hcm', sku: 'MUG-SND-02', warehouseId: 'WH-HCM', onHand: 8, reserved: 1 },
      { id: 'inv-charcoal-hcm', sku: 'TOTE-CHR-02', warehouseId: 'WH-HCM', onHand: 4, reserved: 0 },
      { id: 'inv-cushion-hcm', sku: 'CSH-OLV-01', warehouseId: 'WH-HCM', onHand: 0, reserved: 0 },
    ],
    mappings: [
      { listingId: 'shopee-tote', sku: 'TOTE-NAT-01', warehouseId: 'WH-HCM' }, { listingId: 'shopee-mug', sku: 'MUG-SND-02', warehouseId: 'WH-HCM' },
      { listingId: 'tiktok-mug', sku: 'MUG-SND-02', warehouseId: 'WH-HCM' }, { listingId: 'shopee-charcoal', sku: 'MUG-SND-02', warehouseId: 'WH-OLD' },
    ],
    importJobs: [{ id: 'import-seed', platform: 'shopee', at: '2026-10-22T03:00:00Z', status: 'COMPLETED', candidateIds: [], results: [{ name: 'Everyday tote · Natural', sku: 'TOTE-NAT-01', status: 'IMPORTED', message: 'Initial sample import' }] }],
    syncJobs: [
      { id: 'sync-charcoal', listingId: 'shopee-charcoal', status: 'FAILED', attempts: 1, code: 'WAREHOUSE_MAPPING_INVALID', message: 'Warehouse WH-OLD is unavailable; the sample SKU mapping also needs review.', available: null, at: '2026-10-23T03:00:00Z', history: [{ at: '2026-10-23T03:00:00Z', code: 'WAREHOUSE_MAPPING_INVALID', message: 'Sample warehouse mapping validation failed.' }] },
      { id: 'sync-cushion', listingId: 'shopee-cushion', status: 'FAILED', attempts: 1, code: 'SKU_MAPPING_MISSING', message: 'This marketplace variant has no internal SKU or warehouse mapping.', available: null, at: '2026-10-23T03:05:00Z', history: [{ at: '2026-10-23T03:05:00Z', code: 'SKU_MAPPING_MISSING', message: 'No mapping was found.' }] },
      { id: 'sync-tote', listingId: 'shopee-tote', status: 'SUCCEEDED', attempts: 1, code: null, message: 'Sample available stock synchronized.', available: 12, at: '2026-10-23T03:10:00Z', history: [] },
    ],
    orders: [
      { id: 'ST-201', customer: 'Minh Anh', address: 'Demo address · Ho Chi Minh City', platform: 'shopee', status: 'READY_TO_SHIP', warehouseId: 'WH-HCM', items: [{ sku: 'TOTE-NAT-01', quantity: 2, unitPrice: 349000 }, { sku: 'MUG-SND-02', quantity: 1, unitPrice: 229000 }], at: '2026-10-23T02:00:00Z', shipment: null },
      { id: 'ST-202', customer: 'Quang Nguyen', address: 'Demo address · Ho Chi Minh City', platform: 'shopee', status: 'READY_TO_SHIP', warehouseId: 'WH-HCM', items: [{ sku: 'TOTE-NAT-01', quantity: 1, unitPrice: 349000 }], at: '2026-10-23T02:30:00Z', shipment: null },
      { id: 'ST-203', customer: 'Thanh Ha', address: 'Demo address · Hanoi', platform: 'shopee', status: 'SHIPPED', warehouseId: 'WH-HCM', items: [{ sku: 'TOTE-CHR-02', quantity: 1, unitPrice: 349000 }], at: '2026-10-22T03:00:00Z', shipment: { carrier: 'Demo carrier', tracking: 'DEMO-ST-203', status: 'IN_TRANSIT', at: '2026-10-22T06:00:00Z' } },
      { id: 'ST-204', customer: 'Bao Tran', address: 'Demo address · Da Nang', platform: 'shopee', status: 'DELIVERED', warehouseId: 'WH-HCM', items: [{ sku: 'MUG-SND-02', quantity: 1, unitPrice: 229000 }], at: '2026-10-21T03:00:00Z', shipment: { carrier: 'Demo carrier', tracking: 'DEMO-ST-204', status: 'DELIVERED', at: '2026-10-23T01:00:00Z' } },
    ],
    stockLedger: [], audit: [],
  }
}
