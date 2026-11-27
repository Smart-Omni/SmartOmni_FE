import { useState, useEffect } from 'react'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog'
import { billingInvoices, paymentHistory } from './data/ownerWorkspace'
import { changeOwnerPlan, effectivePlan, ownerConnections, planLimits, requestRefund } from './lib/ownerWorkspaceStore'
import { ConfirmAction, DataTable, Feedback, OwnerPanel, SummaryMetrics } from './components/OwnerWorkspaceUI'
import { money } from './data/ownerDashboard'
import { subscriptionApi } from '@/services/api/subscription'
import SepayVietQrModal from './components/SepayVietQrModal'
import styles from './OwnerWorkspace.module.css'

export default function BillingWorkspace({ screen, state, tenant, platform }) {
  const [plan, setPlan] = useState(null)
  const [invoice, setInvoice] = useState(null)
  const [refundInvoice, setRefundInvoice] = useState(null)
  const [reason, setReason] = useState('')
  const [feedback, setFeedback] = useState(null)
  const [status, setStatus] = useState('ALL')
  const [checkoutData, setCheckoutData] = useState(null)
  const [isCheckingOut, setIsCheckingOut] = useState(false)
  const [realInvoices, setRealInvoices] = useState([])

  const current = effectivePlan(state, tenant)
  const connections = ownerConnections(state, tenant, platform).length

  const loadInvoices = async () => {
    try {
      const list = await subscriptionApi.getInvoices()
      if (Array.isArray(list) && list.length > 0) {
        setRealInvoices(list)
      }
    } catch (err) {
      console.warn('Could not load backend invoices, showing fallback:', err.message)
    }
  }

  useEffect(() => {
    if (screen === 'invoices') {
      loadInvoices()
    }
  }, [screen])

  const handleUpgradeToPro = async () => {
    setIsCheckingOut(true)
    setFeedback(null)
    try {
      const res = await subscriptionApi.checkout()
      setCheckoutData(res)
    } catch (err) {
      setFeedback({ error: true, message: err.message || 'Không thể tạo phiên thanh toán SePay. Vui lòng thử lại.' })
    } finally {
      setIsCheckingOut(false)
    }
  }

  const handlePaymentSuccess = () => {
    try {
      changeOwnerPlan('Pro')
    } catch (e) {
      console.warn('Plan state update:', e)
    }
    setFeedback({ message: 'Chúc mừng! Gói SmartOmni Pro đã được kích hoạt thành công qua cổng thanh toán SePay.' })
    loadInvoices()
  }

  // Combine real invoices with sample fallback invoices
  const displayInvoices = (realInvoices.length > 0 ? realInvoices.map(inv => ({
    id: inv.invoiceNumber || `INV-${inv.id}`,
    period: inv.periodStart && inv.periodEnd
      ? `${new Date(inv.periodStart).toLocaleDateString('vi-VN')} – ${new Date(inv.periodEnd).toLocaleDateString('vi-VN')}`
      : 'Tháng hiện tại',
    amount: inv.amount,
    status: inv.status,
    plan: inv.planName || 'Pro',
    date: inv.createdAt ? new Date(inv.createdAt).toLocaleDateString('vi-VN') : new Date().toLocaleDateString('vi-VN'),
  })) : billingInvoices).filter(item => status === 'ALL' || item.status === status)

  return <>
    {screen === 'subscription' && <>
      <SummaryMetrics items={[["Current plan", current], ['Connected shops', connections], ['Billing mode', current === 'Pro' ? 'Pro Subscription (SePay)' : 'Free Tier']]} />
      <OwnerPanel title="Subscription plans">
        <p>Chọn gói dịch vụ phù hợp với quy mô kinh doanh của bạn. Nâng cấp ngay để mở khóa toàn bộ giới hạn và trợ lý AI thông minh.</p>
        <div className={styles.grid}>
          {/* Free Plan */}
          <article className={styles.plan}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>Free{current === 'Free' ? ' · Current plan' : ''}</h3>
              {current === 'Free' && <span style={{ background: '#f1f5f9', color: '#475569', fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px' }}>ACTIVE</span>}
            </div>
            <p style={{ fontWeight: 700, fontSize: '18px', color: '#0f172a' }}>0 ₫ <span style={{ fontSize: '13px', fontWeight: 400, color: '#64748b' }}>/ tháng</span></p>
            <ul>
              <li>{planLimits(platform, 'Free').skuLimit} sample SKUs</li>
              <li>{planLimits(platform, 'Free').shopLimit} shop connection</li>
              <li>{planLimits(platform, 'Free').managerLimit} sample manager limit</li>
            </ul>
            <p className={styles.note}>Gói cơ bản trải nghiệm nền tảng.</p>
            <Button variant="outline" disabled={current === 'Free'} onClick={() => setPlan('Free')}>
              {current === 'Free' ? 'Current plan' : 'Switch to Free in demo'}
            </Button>
          </article>

          {/* Pro Plan */}
          <article className={styles.plan} style={{ borderColor: current === 'Pro' ? '#22c55e' : '#2563eb', background: current === 'Pro' ? 'rgba(34, 197, 94, 0.03)' : 'rgba(37, 99, 235, 0.02)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>Pro{current === 'Pro' ? ' · Current plan' : ''}</h3>
              {current === 'Pro' && <span style={{ background: '#dcfce7', color: '#15803d', fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px' }}>ACTIVE</span>}
            </div>
            <p style={{ fontWeight: 700, fontSize: '18px', color: '#0f172a' }}>499.000 ₫ <span style={{ fontSize: '13px', fontWeight: 400, color: '#64748b' }}>/ tháng</span></p>
            <ul>
              <li>{planLimits(platform, 'Pro').skuLimit} sample SKUs</li>
              <li>{planLimits(platform, 'Pro').shopLimit} shop connections</li>
              <li>{planLimits(platform, 'Pro').managerLimit} sample manager limit</li>
              <li>Thanh toán tự động VietQR qua SePay</li>
              <li>Kích hoạt tức thì trong 3 giây</li>
            </ul>
            <p className={styles.note}>Gói chuyên nghiệp cho nhà bán hàng đa kênh.</p>
            {current === 'Pro' ? (
              <Button variant="outline" disabled style={{ borderColor: '#22c55e', color: '#15803d' }}>
                Đang sử dụng gói Pro
              </Button>
            ) : (
              <Button
                style={{ background: '#2563eb', color: '#ffffff' }}
                disabled={isCheckingOut}
                onClick={handleUpgradeToPro}
              >
                {isCheckingOut ? 'Đang tạo VietQR...' : 'Nâng cấp SmartOmni Pro (499.000 ₫)'}
              </Button>
            )}
          </article>
        </div>
      </OwnerPanel>
    </>}

    {screen === 'invoices' && <>
      <OwnerPanel title="Subscription invoices">
        <div className={styles.filters}>
          <label className={styles.field}>Invoice status
            <select value={status} onChange={event => setStatus(event.target.value)}>
              <option value="ALL">All statuses</option>
              <option value="PAID">Paid</option>
              <option value="FAILED">Failed</option>
              <option value="PENDING">Pending</option>
            </select>
          </label>
        </div>
        <DataTable label="Subscription invoices" headings={['Invoice', 'Period', 'Amount', 'Status', 'Actions']}>
          {displayInvoices.map(item => (
            <tr key={item.id}>
              <td style={{ fontFamily: 'monospace' }}>{item.id}</td>
              <td>{item.period}</td>
              <td style={{ fontWeight: 600 }}>{money(item.amount)}</td>
              <td>
                <span className={styles.status} style={{
                  color: item.status === 'PAID' ? '#15803d' : item.status === 'PENDING' ? '#b45309' : '#dc2626',
                  background: item.status === 'PAID' ? '#dcfce7' : item.status === 'PENDING' ? '#fef3c7' : '#fee2e2'
                }}>
                  {item.status}
                </span>
              </td>
              <td>
                <div className={styles.actions}>
                  <Button variant="outline" onClick={() => setInvoice(item)}>View invoice</Button>
                  {item.status === 'PAID' && (
                    <Button
                      variant="outline"
                      disabled={state.refunds.some(refund => refund.invoiceId === item.id)}
                      onClick={() => { setRefundInvoice(item); setReason('') }}
                    >
                      {state.refunds.some(refund => refund.invoiceId === item.id) ? 'Refund requested' : 'Request refund'}
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
        <p className={styles.note}>Lịch sử hóa đơn đăng ký gói cước SmartOmni thanh toán qua SePay.</p>
      </OwnerPanel>
      {state.refunds.length > 0 && (
        <OwnerPanel title="Refund requests">
          <DataTable label="Refund requests" headings={['Invoice', 'Requested amount', 'Status', 'Reason']}>
            {state.refunds.map(item => (
              <tr key={item.id}>
                <td>{item.invoiceId}</td>
                <td>{money(item.amount)}</td>
                <td>{item.status}</td>
                <td>{item.reason}</td>
              </tr>
            ))}
          </DataTable>
          <p>No refund is approved or paid by this demo. Eligibility must be reviewed by the billing service.</p>
        </OwnerPanel>
      )}
    </>}

    {screen === 'payments' && (
      <OwnerPanel title="Payment history">
        <DataTable label="Payment history" headings={['Date', 'Invoice', 'Amount', 'Method', 'Result']}>
          {paymentHistory.map(item => (
            <tr key={item.id}>
              <td>{item.date}</td>
              <td>{item.invoiceId}</td>
              <td>{money(item.amount)}</td>
              <td>{item.method}</td>
              <td><span className={styles.status}>{item.status}</span></td>
            </tr>
          ))}
        </DataTable>
        <p>Failed attempts are not counted as paid. Refund requests remain pending and do not create payment transactions.</p>
      </OwnerPanel>
    )}

    <Feedback value={feedback} />

    {plan && (
      <ConfirmAction
        title={`Switch to ${plan}?`}
        description="Apply this plan immediately to the local demo. No charge, refund or proration is calculated. Existing data will be retained."
        confirmLabel="Apply demo plan"
        onClose={() => setPlan(null)}
        onConfirm={() => { changeOwnerPlan(plan); setFeedback({ message: `${plan} applied in demo. No payment was processed.` }) }}
      >
        {connections > planLimits(platform, plan).shopLimit && (
          <p className={styles.error}>Your existing {connections} shops exceed this plan’s demo limit. They are retained; new connections will be blocked until usage is below the limit.</p>
        )}
      </ConfirmAction>
    )}

    {refundInvoice && (
      <ConfirmAction
        title="Request subscription refund"
        description={`Submit ${refundInvoice.id} (${money(refundInvoice.amount)}) for review in this demo. No money will be returned.`}
        confirmLabel="Submit demo request"
        onClose={() => setRefundInvoice(null)}
        onConfirm={() => { requestRefund(refundInvoice.id, reason); setFeedback({ message: 'Demo refund request saved for review.' }) }}
      >
        <label className={styles.field}>Refund reason
          <textarea value={reason} maxLength={1000} onChange={event => setReason(event.target.value)} />
        </label>
      </ConfirmAction>
    )}

    <Dialog open={Boolean(invoice)} onOpenChange={open => { if (!open) setInvoice(null) }}>
      <DialogContent className={styles.dialog}>
        <DialogTitle>{invoice?.id}</DialogTitle>
        <DialogDescription>Subscription invoice details.</DialogDescription>
        {invoice && (
          <dl className={styles.details}>
            {[
              ['Plan', invoice.plan],
              ['Period', invoice.period],
              ['Issue date', invoice.date],
              ['Amount', money(invoice.amount)],
              ['Status', invoice.status]
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </DialogContent>
    </Dialog>

    <SepayVietQrModal
      open={Boolean(checkoutData)}
      checkout={checkoutData}
      onClose={() => setCheckoutData(null)}
      onSuccess={handlePaymentSuccess}
    />
  </>
}
