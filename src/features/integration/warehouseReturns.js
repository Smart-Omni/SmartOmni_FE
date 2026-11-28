// SmartOmni warehouse records for physical marketplace returns, joined onto marketplace requests by return number.
import { shopeeApi } from '@/services/api/shopee'

const PAGE_SIZE = 100

export const INSPECTION_RESULTS = {
  MATCHED: 'Matched',
  DAMAGED: 'Damaged',
  SWAPPED: 'Swapped',
  MISSING_ITEMS: 'Missing items',
}

export const inspectionLabel = record => INSPECTION_RESULTS[record.inspection_result]
  || (record.inspection_result === 'PENDING' ? 'Pending' : record.inspection_result || '—')

export function pendingInspection(record) {
  if (record?.inspection_result !== 'PENDING') return false
  if (record.platform === 'TIKTOK_SHOP') {
    // Only a shipped parcel with an open decision is waiting; closed returns would otherwise pile up as pending.
    return record.return_type === 'RETURN_AND_REFUND' && record.marketplace_status === 'BUYER_SHIPPED_ITEM'
  }
  return record.platform === 'SHOPEE' && record.return_type === 'PHYSICAL_RETURN'
    && record.status === 'REQUESTED' && !record.restocked
}

// The returns API cannot filter by marketplace return number, so every page is read.
async function loadAllRecords(signal) {
  const records = []
  let page = 0
  let totalPages
  do {
    const data = await shopeeApi.warehouseReturns({ page, size: PAGE_SIZE, sort: 'id,desc' }, signal)
    records.push(...(data?.content ?? []))
    totalPages = data?.totalPages ?? 0
    page += 1
  } while (page < totalPages)
  return records
}

const loadPlatformReturns = (platform, returnType) => async signal =>
  (await loadAllRecords(signal)).filter(item => item.platform === platform && item.return_type === returnType)

export const loadWarehouseReturns = loadPlatformReturns('SHOPEE', 'PHYSICAL_RETURN')
export const loadTiktokWarehouseReturns = loadPlatformReturns('TIKTOK_SHOP', 'RETURN_AND_REFUND')
