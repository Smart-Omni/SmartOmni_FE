// SmartOmni warehouse records for physical Shopee returns, joined onto marketplace requests by return number.
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
  return record?.platform === 'SHOPEE' && record.return_type === 'PHYSICAL_RETURN'
    && record.status === 'REQUESTED' && record.inspection_result === 'PENDING' && !record.restocked
}

// The returns API cannot filter by marketplace return number, so every page is read.
export async function loadWarehouseReturns(signal) {
  const records = []
  let page = 0
  let totalPages
  do {
    const data = await shopeeApi.warehouseReturns({ page, size: PAGE_SIZE, sort: 'id,desc' }, signal)
    records.push(...(data?.content ?? []))
    totalPages = data?.totalPages ?? 0
    page += 1
  } while (page < totalPages)
  return records.filter(item => item.platform === 'SHOPEE' && item.return_type === 'PHYSICAL_RETURN')
}
