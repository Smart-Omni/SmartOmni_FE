import { Link } from 'react-router-dom'
import { useOwnerWorkspace } from '@/features/portal/lib/ownerWorkspaceStore'
import PlanningWorkspace from '@/features/portal/PlanningWorkspace'
import FinanceWorkspace from '@/features/portal/FinanceWorkspace'
import AdvisorWorkspace from '@/features/portal/AdvisorWorkspace'
import { money, weeklySales } from '@/features/portal/data/ownerDashboard'
import { OwnerPanel, SummaryMetrics } from '@/features/portal/components/OwnerWorkspaceUI'
import { availableStock } from './lib/staffStore'
import styles from '@/features/portal/OwnerWorkspace.module.css'

export default function StaffBusinessWorkspace({ screen, session, data }) {
  const { state } = useOwnerWorkspace()
  const can = permission => session.permissions.includes(permission)
  if (['sales-events', 'forecasts'].includes(screen)) return <PlanningWorkspace key={screen} screen={screen} state={state} canWrite={can('planning:write')} />
  if (['costs', 'profit'].includes(screen)) return <><p className={styles.note}>Shared tenant ledger · {can('finance:write') ? 'Read and write access' : 'Read-only access'}</p><FinanceWorkspace key={screen} screen={screen} state={state} canWrite={can('finance:write')} /></>
  if (screen === 'advisor') return <AdvisorWorkspace screen="advisor" state={{ ...state, conversations: state.conversations.filter(item => item.actorId === session.id && (item.requiredPermissions || []).every(can)) }} />
  if (screen === 'strategy') return <OwnerPanel title="Strategic advice for your workspace"><p>Local observations from the sample data available to your role. No AI model is connected.</p><ul className={styles.list}>
    {can('inventory:read') && <li><h3>Review low-stock products</h3><p>{data.inventory.filter(row => availableStock(row) < 10).length} warehouse records have fewer than 10 available units.</p><Link to="/merchant/staff/inventory">Review inventory</Link></li>}
    {can('planning:read') && <li><h3>Plan stock before a sales event</h3><p>{state.salesEvents.length} saved sales events are included in the local scenario.</p><Link to="/merchant/staff/forecasts">View demand forecasts</Link></li>}
    {can('finance:read') && <li><h3>Check cost coverage</h3><p>{state.costs.length} cost entries are recorded. Reconcile returns, fees and taxes before using the profit estimate.</p><Link to="/merchant/staff/profit">Review profit estimate</Link></li>}
    <li><h3>Ask a focused question</h3><p>Ask about a business area the Owner has granted you permission to view.</p><Link to="/merchant/staff/advisor">Open AI advisor</Link></li>
  </ul></OwnerPanel>
  const sales = weeklySales.reduce((sum, amount) => sum + amount, 0)
  return <><SummaryMetrics items={[["Sample sales · 17–23 Oct", money(sales)], ['Operational orders', data.orders.length], ['Ready to ship', data.orders.filter(item => item.status === 'READY_TO_SHIP').length], ['Quarantined units', data.quarantine.reduce((sum, item) => sum + item.quantity, 0)]]} />
    <div className={styles.grid}><OwnerPanel title="Sales trend · 17–23 Oct 2026"><p className={styles.note}>Sample sales by day · VND. Source: the same illustrative series used by Owner finance. Not live marketplace revenue.</p>{weeklySales.map((amount, index) => <div className={styles.barRow} key={index}><span>{17 + index} Oct</span><div className={styles.barTrack}><span style={{ width: `${amount / Math.max(...weeklySales) * 100}%` }} /></div><span>{(amount / 1000000).toFixed(1)}m</span></div>)}</OwnerPanel>
    <OwnerPanel title="Order progress"><p>Current operational sample orders, across all available fixture dates.</p><ul className={styles.list}>{['READY_TO_SHIP', 'SHIPPED', 'DELIVERED', 'CANCELLED'].map(status => <li key={status}><strong>{status.replaceAll('_', ' ')} · {data.orders.filter(item => item.status === status).length}</strong></li>)}</ul>{can('orders:read') && <p><Link to="/merchant/staff/orders">View orders and shipments</Link></p>}</OwnerPanel></div>
    <OwnerPanel title="Tasks needing attention"><ul className={styles.list}>{can('returns:read') && <li><Link to="/merchant/staff/returns">{data.returns.filter(item => item.status !== 'RESTOCKED').length} returns awaiting processing</Link></li>}{can('complaints:read') && <li><Link to="/merchant/staff/complaints">{data.complaints.filter(item => item.status === 'OPEN').length} open complaints</Link></li>}{can('inventory:read') && <li><Link to="/merchant/staff/sync">{data.syncJobs.filter(item => item.status === 'FAILED').length} failed inventory sync jobs</Link></li>}</ul><p>Tasks reflect local operations. Business figures remain illustrative.</p></OwnerPanel>
    <OwnerPanel title="Recent staff activity">{data.audit.length ? <ul className={styles.list}>{data.audit.slice(0, 5).map(item => <li key={item.id}><strong>{item.actor}</strong> · {item.action}<p>{new Date(item.at).toLocaleString('en-GB')}</p></li>)}</ul> : <p>No staff actions recorded yet. Saved operational changes will appear here.</p>}</OwnerPanel>
  </>
}
