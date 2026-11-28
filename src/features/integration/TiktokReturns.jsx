import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, PackageCheck, PackageOpen, RefreshCw, Scale, ShieldAlert, Truck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/shared/ui/button'
import { tiktokApi } from '@/services/api/tiktok'
import { DataTable, Feedback, OwnerPanel } from '@/features/portal/components/OwnerWorkspaceUI'
import { useApiResource } from './useApiResource'
import { ResourceState } from './ShopeeShared'
import { isTiktokShopDisconnected } from './marketplaces'
import { dateTime, money } from './apiHelpers'
import { KpiGrid, StageTabs } from './ReturnHubParts'
import TiktokReturnDetail from './TiktokReturnDetail'
import { ConfirmationDialog } from './ConfirmationDialog'
import { InspectionDialog } from './ShopeeWarehouseReturns'
import { inspectionLabel, loadTiktokWarehouseReturns, pendingInspection } from './warehouseReturns'
import { FALLBACK_RETURN_STATUSES, normalizeTiktokReturn } from './tiktokReturnHub'
import styles from '@/features/portal/OwnerWorkspace.module.css'
import demo from './ReturnHubDemo.module.css'

const MAX_VISIBLE_ITEMS = 2
const PAGE_SIZE = 50
const STAGE_TABS = [
  { id: 'need_action', label: 'Needs action' },
  { id: 'in_return_transit', label: 'Return in transit' },
  { id: 'dispute', label: 'In arbitration' },
  { id: 'completed', label: 'Completed / Closed' },
  { id: 'all', label: 'All requests' },
]
const statusCode = item => typeof item === 'string' ? item : item?.code ?? item?.name

export default function TiktokReturns({ sourceSelect }) {
  const navigate = useNavigate()
  const [status, setStatus] = useState('')
  const [orderId, setOrderId] = useState('')
  const [tokens, setTokens] = useState([null])
  const [stage, setStage] = useState('need_action')
  const [focus, setFocus] = useState('')
  const [sortBy, setSortBy] = useState('NEWEST')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)
  const [approveTarget, setApproveTarget] = useState(null)
  const [inspectId, setInspectId] = useState(null)
  const [notice, setNotice] = useState(null)
  const pageToken = tokens[tokens.length - 1]

  const loader = useCallback(signal => tiktokApi.returns({ pageSize: PAGE_SIZE, status: status || undefined, orderId: orderId || undefined, pageToken: pageToken || undefined }, signal), [status, orderId, pageToken])
  const resource = useApiResource(loader)
  const warehouse = useApiResource(loadTiktokWarehouseReturns)
  const reasons = useApiResource(tiktokApi.aftersaleReasons)
  const returnStatuses = reasons.data?.returnStatuses?.map(statusCode).filter(Boolean)
  const statusOptions = returnStatuses?.length ? returnStatuses : FALLBACK_RETURN_STATUSES

  const { reload: reloadReturns } = resource
  const { reload: reloadWarehouse } = warehouse
  const reloadAll = useCallback(() => { reloadReturns(); reloadWarehouse() }, [reloadReturns, reloadWarehouse])

  useEffect(() => {
    window.addEventListener('focus', reloadAll)
    return () => window.removeEventListener('focus', reloadAll)
  }, [reloadAll])

  const rows = useMemo(() => (resource.data?.returns || []).map(normalizeTiktokReturn), [resource.data])

  // The newest record wins when several share a return number (records arrive newest first).
  const warehouseByReturn = useMemo(() => {
    const map = new Map()
    for (const record of warehouse.data ?? []) {
      const key = record.external_return_id
      if (key && (!map.has(key) || (pendingInspection(record) && !pendingInspection(map.get(key))))) map.set(key, record)
    }
    return map
  }, [warehouse.data])

  // Pending inspections with no request on this page would otherwise be unreachable.
  const unmatched = useMemo(() => {
    const shown = new Set(rows.map(r => warehouseByReturn.get(r.id)?.id))
    return (warehouse.data ?? []).filter(record => pendingInspection(record) && !shown.has(record.id))
  }, [rows, warehouse.data, warehouseByReturn])

  const counts = useMemo(() => {
    const result = { need_action: 0, in_return_transit: 0, dispute: 0, completed: 0, all: rows.length }
    for (const r of rows) result[r.meta.stage] += 1
    return result
  }, [rows])
  const awaitingShipment = rows.filter(r => r.meta.awaitingShipment).length
  const shipped = rows.filter(r => r.meta.shipped && r.meta.stage !== 'dispute').length
  const awaitingInspection = rows.filter(r => pendingInspection(warehouseByReturn.get(r.id))).length
  const openRefundTotal = rows.filter(r => r.meta.stage !== 'completed').reduce((sum, r) => sum + r.refundAmount, 0)

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = rows.filter(r => {
      if (stage !== 'all' && r.meta.stage !== stage) return false
      if (focus === 'awaitingShipment' && !r.meta.awaitingShipment) return false
      if (focus === 'shipped' && !r.meta.shipped) return false
      if (focus === 'inspection' && !pendingInspection(warehouseByReturn.get(r.id))) return false
      if (!q) return true
      const itemsText = r.items.map(i => `${i.sku} ${i.name}`).join(' ')
      return `${r.id} ${r.orderId} ${r.trackingNumber} ${itemsText}`.toLowerCase().includes(q)
    })
    return list.sort((a, b) => sortBy === 'AMOUNT_DESC' ? b.refundAmount - a.refundAmount : (b.createdAt ?? 0) - (a.createdAt ?? 0))
  }, [rows, stage, focus, warehouseByReturn, sortBy, query])

  function showStage(nextStage, nextFocus = '') {
    setStage(nextStage)
    setFocus(nextFocus)
  }

  function changeStatus(value) {
    setStatus(value)
    setTokens([null])
    // A status filter would otherwise be filtered again by the stage tab.
    showStage(value ? 'all' : 'need_action')
  }

  // Quick search filters this page; the order ID lookup asks TikTok, which covers every page.
  function searchOrder(value) {
    setOrderId(value)
    setQuery('')
    setTokens([null])
    showStage(value ? 'all' : 'need_action')
  }

  async function approveReturn() {
    const result = await tiktokApi.approveReturn(approveTarget.id)
    if (result?.approved === false) throw new Error('TikTok did not accept this request.')
    return result
  }

  function openDetail(id, intent = '') {
    setNotice(null)
    setSelected({ id, intent })
  }

  const disconnected = isTiktokShopDisconnected(resource)
  const toggle = (nextStage, nextFocus) => () => focus === nextFocus ? showStage('all') : showStage(nextStage, nextFocus)

  return (
    <div className={demo.hub}>
      <OwnerPanel title="Returns &amp; refunds overview">
        <KpiGrid cards={[
          { label: 'Needs action', value: counts.need_action, hint: 'Approve the request or reject it', icon: AlertTriangle, color: '#dc2626', tone: 'kpiAction', active: stage === 'need_action', onClick: () => showStage('need_action') },
          { label: 'Awaiting buyer shipment', value: awaitingShipment, hint: 'Approved, parcel not sent yet', icon: PackageOpen, color: '#d97706', tone: 'kpiUrgent', active: focus === 'awaitingShipment', onClick: toggle('in_return_transit', 'awaitingShipment') },
          { label: 'Returning to shop', value: shipped, hint: 'Confirm once the parcel arrives', icon: Truck, color: '#2563eb', tone: 'kpiWarehouse', active: focus === 'shipped', onClick: toggle('in_return_transit', 'shipped') },
          { label: 'Awaiting inspection', value: warehouse.data ? awaitingInspection : '—', hint: 'Warehouse checks still pending', icon: PackageCheck, color: '#2563eb', tone: 'kpiWarehouse', active: focus === 'inspection', onClick: toggle('all', 'inspection') },
          { label: 'In arbitration', value: counts.dispute, hint: 'Waiting for the TikTok ruling', icon: Scale, color: '#7c3aed', tone: 'kpiDispute', active: stage === 'dispute', onClick: () => showStage('dispute') },
          { label: 'Open refund value', value: money(openRefundTotal), hint: 'Value of requests not yet closed', icon: ShieldAlert, tone: 'kpiTotal', active: stage === 'all' && !focus, onClick: () => showStage('all') },
        ]} />
      </OwnerPanel>

      <OwnerPanel title="Return &amp; refund requests">
        <StageTabs tabs={STAGE_TABS} stage={stage} counts={counts} onSelect={id => showStage(id)} />

        <form className={styles.filters} onSubmit={event => event.preventDefault()}>
          {sourceSelect}

          <label className={styles.field}>
            Return status
            <select value={status} onChange={e => changeStatus(e.target.value)}>
              <option value="">All statuses</option>
              {statusOptions.map(value => <option key={value}>{value}</option>)}
            </select>
          </label>

          <label className={styles.field}>
            Sort by
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="NEWEST">Newest</option>
              <option value="AMOUNT_DESC">Highest refund</option>
            </select>
          </label>

          <label className={styles.field}>
            Quick search
            <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Return, order or SKU" />
          </label>

          <div className={styles.actions}>
            <Button type="button" size="sm" variant="outline" disabled={resource.loading} onClick={reloadAll}>
              <RefreshCw size={14} /> {resource.loading ? 'Loading…' : 'Refresh returns'}
            </Button>
          </div>
        </form>

        {orderId && (
          <div className={styles.actions}>
            <span className={styles.note}>Showing TikTok returns for order {orderId}.</span>
            <Button size="sm" variant="outline" onClick={() => searchOrder('')}>Clear order search</Button>
          </div>
        )}
        <Feedback value={notice} />
        {warehouse.error && (
          <>
            <Feedback value={{ error: true, message: `Warehouse inspections could not be loaded: ${warehouse.error}` }} />
            <Button size="sm" variant="outline" onClick={warehouse.reload}>Retry inspections</Button>
          </>
        )}
        {disconnected ? (
          <>
            <Feedback value={{ error: true, message: 'TikTok Shop is not connected. Connect your TikTok shop to view its returns.' }} />
            <Button variant="outline" onClick={() => navigate('/merchant/shops?marketplace=tiktok-shop')}>Connect TikTok Shop</Button>
          </>
        ) : <ResourceState resource={resource} />}

        {!resource.loading && !resource.error && (visible.length ? (
          <DataTable
            label="TikTok return requests"
            headings={['Return / Channel', 'Returned items', 'Refund', 'Status', 'Reason', 'Warehouse inspection', 'Actions']}
          >
            {visible.map(ret => {
              const shownItems = ret.items.slice(0, MAX_VISIBLE_ITEMS)
              const extraCount = ret.items.length - shownItems.length
              const record = warehouseByReturn.get(ret.id)
              return (
                <tr key={ret.id} className={ret.meta.stage === 'dispute' ? demo.rowDispute : ''}>
                  <td>
                    <strong>{ret.id}</strong>
                    <p className={styles.note}>Order: {ret.orderId}</p>
                    <p>
                      <span className={`${demo.channelBadge} ${demo.channelTiktok}`}>TikTok Shop</span>
                      <span className={demo.typeBadge}>{ret.refundOnly ? 'Refund only' : 'Return & refund'}</span>
                    </p>
                  </td>
                  <td>
                    <div className={demo.itemPreview}>
                      {shownItems.length ? shownItems.map(item => (
                        <div key={item.sku + item.name}>
                          <strong>{item.qty}×</strong>{' '}
                          <span className={demo.itemName} title={item.name}>{item.name}</span>
                          <div className={demo.skuCode}>{[item.sku, item.variant].filter(Boolean).join(' · ')}</div>
                        </div>
                      )) : <span className={styles.note}>—</span>}
                      {extraCount > 0 && (
                        <button type="button" className={demo.moreItemsBtn} onClick={() => openDetail(ret.id)}>
                          … (+{extraCount} more items)
                        </button>
                      )}
                    </div>
                  </td>
                  <td>
                    <strong style={{ whiteSpace: 'nowrap' }}>{money(ret.refundAmount)}</strong>
                    {ret.shippingRefund > 0 && <p className={styles.note}>Includes shipping: {money(ret.shippingRefund)}</p>}
                  </td>
                  <td>
                    <span className={`${demo.statusBadge} ${demo[ret.meta.cls]}`}>{ret.meta.label}</span>
                    {ret.createdAt && <p className={styles.note}>Created: {dateTime(ret.createdAt)}</p>}
                    {ret.trackingNumber && <p className={styles.note}>Return tracking: <strong>{ret.trackingNumber}</strong></p>}
                  </td>
                  <td>{ret.reasonText}</td>
                  <td>
                    {warehouse.loading ? 'Loading…' : warehouse.error ? 'Unavailable' : record ? inspectionLabel(record) : '—'}
                  </td>
                  <td>
                    <div className={demo.compactActions}>
                      {ret.meta.canDecide && (
                        <>
                          <Button onClick={() => { setNotice(null); setApproveTarget(ret) }}>
                            {ret.meta.shipped ? 'Confirm receipt & refund' : ret.refundOnly ? 'Accept refund' : 'Approve return'}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => openDetail(ret.id, 'reject')}>Reject return</Button>
                        </>
                      )}
                      {record && (
                        <Button size="sm" variant="outline" onClick={() => setInspectId(record.id)}>
                          {pendingInspection(record) ? 'Inspect' : 'View inspection'}
                        </Button>
                      )}
                      <Button variant="outline" onClick={() => openDetail(ret.id)}>Review return</Button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </DataTable>
        ) : (
          <>
            <p className={styles.empty}>No returns match your filters.</p>
            {query.trim() && (
              <Button size="sm" variant="outline" onClick={() => searchOrder(query.trim())}>
                Search all pages for order ID {query.trim()}
              </Button>
            )}
          </>
        ))}
        {!resource.loading && !resource.error && (tokens.length > 1 || resource.data?.nextPageToken) && (
          <div className={`${styles.actions} ${styles.pagination}`}>
            <Button variant="secondary" disabled={tokens.length === 1} onClick={() => setTokens(tokens.slice(0, -1))}>Previous page</Button>
            <span>Page {tokens.length}{resource.data?.totalCount != null && ` · ${resource.data.totalCount} returns`} · Counts and filters apply to this page</span>
            <Button variant="secondary" disabled={!resource.data?.nextPageToken} onClick={() => setTokens([...tokens, resource.data.nextPageToken])}>Next page</Button>
          </div>
        )}
      </OwnerPanel>

      {!resource.loading && unmatched.length > 0 && (
        <OwnerPanel title="Unmatched warehouse returns">
          <p className={styles.note}>Pending inspections that have no matching request on this page.</p>
          <DataTable label="Unmatched warehouse returns" headings={['Return', 'Order', 'Status', 'Action']}>
            {unmatched.map(item => (
              <tr key={item.id}>
                <td>{item.external_return_id || item.id}</td>
                <td>{item.platform_order_id || item.order_id}</td>
                <td>{item.marketplace_status || item.status}</td>
                <td><Button variant="outline" onClick={() => setInspectId(item.id)}>Inspect</Button></td>
              </tr>
            ))}
          </DataTable>
        </OwnerPanel>
      )}

      {inspectId !== null && <InspectionDialog key={inspectId} returnId={inspectId} close={() => setInspectId(null)} reload={reloadAll} />}

      {approveTarget && (
        <ConfirmationDialog
          title={approveTarget.meta.shipped ? 'Confirm receipt & refund' : approveTarget.refundOnly ? 'Accept refund' : 'Approve return'}
          description={approveTarget.meta.shipped
            ? `Confirm the parcel for return ${approveTarget.id} arrived and refund ${money(approveTarget.refundAmount)} on TikTok?`
            : approveTarget.refundOnly
              ? `Confirm a refund of ${money(approveTarget.refundAmount)} for return ${approveTarget.id} on TikTok?`
              : `Approve return ${approveTarget.id}? The buyer then ships the items back before the refund of ${money(approveTarget.refundAmount)}.`}
          submit={approveReturn}
          close={() => setApproveTarget(null)}
          done={() => {
            setNotice({ message: `TikTok return ${approveTarget.id} approved.` })
            setApproveTarget(null)
            reloadAll()
          }}
        />
      )}

      {selected && (
        <TiktokReturnDetail
          key={selected.id}
          returnId={selected.id}
          initialIntent={selected.intent}
          close={() => setSelected(null)}
          done={message => { setNotice({ message }); setSelected(null); reloadAll() }}
        />
      )}
    </div>
  )
}
