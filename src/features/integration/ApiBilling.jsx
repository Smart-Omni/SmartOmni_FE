import { useState, useEffect } from 'react'
import { Sparkles, Copy, Check, AlertTriangle } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog'
import { DataTable, Feedback, OwnerPanel, SummaryMetrics } from '@/features/portal/components/OwnerWorkspaceUI'
import { subscriptionApi } from '@/services/api/subscription'
import SepayVietQrModal from '@/features/portal/components/SepayVietQrModal'
import styles from '@/features/portal/OwnerWorkspace.module.css'

function money(amount) {
  if (!amount && amount !== 0) return '0 ₫'
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(amount)
}

export default function ApiBilling() {
  const [invoices, setInvoices] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [checkoutData, setCheckoutData] = useState(null)
  const [isCheckingOut, setIsCheckingOut] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [copiedCode, setCopiedCode] = useState(false)

  const loadData = async () => {
    try {
      setLoading(true)
      const [list, sum] = await Promise.all([
        subscriptionApi.getInvoices().catch(() => []),
        subscriptionApi.getSummary().catch(() => null),
      ])
      if (Array.isArray(list)) {
        setInvoices(list)
      }
      if (sum) {
        setSummary(sum)
      }
    } catch (err) {
      console.warn('Could not load billing data:', err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const isPro = Boolean(
    summary?.isPro ||
    summary?.pro ||
    summary?.planName === 'PRO' ||
    invoices.some(inv => String(inv.status).toUpperCase() === 'PAID')
  )
  const canRenewEarly = summary?.canRenewEarly
  const daysRemaining = summary?.daysRemaining ?? 0

  const handleUpgrade = async () => {
    setIsCheckingOut(true)
    setFeedback(null)
    try {
      const data = await subscriptionApi.checkout()
      setCheckoutData(data)
    } catch (err) {
      setFeedback({ error: true, message: err.message || 'Không thể tạo phiên thanh toán SePay. Vui lòng thử lại.' })
    } finally {
      setIsCheckingOut(false)
    }
  }

  const handlePaymentSuccess = () => {
    setFeedback({ message: 'Chúc mừng! Bạn đã thanh toán thành công gói SmartOmni Pro qua cổng SePay.' })
    loadData()
  }

  const copyToClipboard = async text => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(String(text))
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = String(text)
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }
      setCopiedCode(true)
      setTimeout(() => setCopiedCode(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const filteredInvoices = invoices.filter(item => statusFilter === 'ALL' || String(item.status).toUpperCase() === statusFilter)

  return (
    <>
      <SummaryMetrics
        items={[
          ['Gói cước hiện tại', isPro ? 'SmartOmni Pro' : 'Free Tier'],
          ['Hình thức thanh toán', 'VietQR tự động (SePay)'],
          ['Số lượng hóa đơn', invoices.length],
        ]}
      />

      {/* Early Renewal Warning Banner (4-5 days before expiry) */}
      {isPro && canRenewEarly && (
        <div style={{
          background: '#fffbeb',
          border: '1px solid #fef3c7',
          borderRadius: 12,
          padding: '16px 20px',
          marginBottom: 20,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{
              background: '#fef3c7',
              borderRadius: '50%',
              padding: 8,
              color: '#d97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <AlertTriangle size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: '#92400e', marginBottom: 4 }}>
                <span>Gói SmartOmni Pro của bạn sắp hết hạn ({daysRemaining} ngày còn lại)</span>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: '#b45309', lineHeight: 1.5 }}>
                Kỳ cước hiện tại sẽ hết hạn vào ngày <strong>{summary?.periodEnd || 'sắp tới'}</strong>. Bạn có thể thanh toán trước ngay bây giờ để kỳ cước mới tự động nối tiếp liền mạch, không lo gián đoạn trợ lý AI và kết nối các sàn bán lẻ!
              </p>
            </div>
          </div>
          <Button
            style={{ background: '#d97706', color: '#ffffff', fontWeight: 600, flexShrink: 0 }}
            disabled={isCheckingOut}
            onClick={handleUpgrade}
          >
            {isCheckingOut ? 'Đang tạo VietQR...' : 'Gia hạn gói Pro (499.000 ₫)'}
          </Button>
        </div>
      )}

      <OwnerPanel title="Gói dịch vụ & Nâng cấp">
        <p>Chọn gói dịch vụ phù hợp với quy mô doanh nghiệp. Kích hoạt Pro để mở khóa toàn bộ kết nối sàn và trợ lý AI thông minh.</p>
        <div className={styles.grid}>
          {/* Free Plan */}
          <article className={styles.plan}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>Free{!isPro ? ' · Gói hiện tại' : ''}</h3>
              {!isPro && <span style={{ background: '#f1f5f9', color: '#475569', fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px' }}>ACTIVE</span>}
            </div>
            <p style={{ fontWeight: 700, fontSize: '18px', color: '#0f172a' }}>0 ₫ <span style={{ fontSize: '13px', fontWeight: 400, color: '#64748b' }}>/ tháng</span></p>
            <ul>
              <li>Giới hạn 100 sản phẩm / SKU</li>
              <li>Tối đa 1 kết nối sàn thương mại điện tử</li>
              <li>Quản lý đơn hàng và tồn kho cơ bản</li>
            </ul>
            <p className={styles.note}>Gói trải nghiệm cơ bản.</p>
            <Button variant="outline" disabled style={{ color: '#64748b' }}>
              {!isPro ? 'Đang kích hoạt' : 'Gói miễn phí'}
            </Button>
          </article>

          {/* Pro Plan */}
          <article className={styles.plan} style={{ borderColor: isPro ? '#22c55e' : '#2563eb', background: isPro ? 'rgba(34, 197, 94, 0.03)' : 'rgba(37, 99, 235, 0.02)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>SmartOmni Pro{isPro ? ' · Gói hiện tại' : ''}</h3>
              {isPro && (
                <span style={{
                  background: canRenewEarly ? '#fef3c7' : '#dcfce7',
                  color: canRenewEarly ? '#b45309' : '#15803d',
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '4px',
                }}>
                  {canRenewEarly ? `SẮP HẾT HẠN (${daysRemaining} ngày)` : 'ACTIVE'}
                </span>
              )}
            </div>
            <p style={{ fontWeight: 700, fontSize: '18px', color: '#0f172a' }}>499.000 ₫ <span style={{ fontSize: '13px', fontWeight: 400, color: '#64748b' }}>/ tháng</span></p>
            <ul>
              <li>Không giới hạn SKU và sản phẩm</li>
              <li>Kết nối đa sàn Shopee, TikTok Shop tự động</li>
              <li>Trợ lý AI Advisor dự báo tồn kho & xu hướng mua sắm</li>
              <li>Đồng bộ tồn kho & giá bán thời gian thực</li>
              <li>Thanh toán tự động bằng VietQR qua SePay</li>
            </ul>
            <p className={styles.note}>Gói chuyên nghiệp cho nhà bán hàng đa kênh.</p>
            {isPro ? (
              canRenewEarly ? (
                <Button
                  style={{ background: '#d97706', color: '#ffffff', fontWeight: 600 }}
                  disabled={isCheckingOut}
                  onClick={handleUpgrade}
                >
                  {isCheckingOut ? 'Đang tạo VietQR...' : `Gia hạn Pro trước (${daysRemaining} ngày còn lại)`}
                </Button>
              ) : (
                <Button variant="outline" disabled style={{ borderColor: '#22c55e', color: '#15803d' }}>
                  Đang sử dụng gói Pro (Còn {daysRemaining} ngày)
                </Button>
              )
            ) : (
              <Button
                style={{ background: '#2563eb', color: '#ffffff' }}
                disabled={isCheckingOut}
                onClick={handleUpgrade}
              >
                {isCheckingOut ? 'Đang tạo VietQR...' : 'Nâng cấp SmartOmni Pro (499.000 ₫)'}
              </Button>
            )}
          </article>
        </div>
      </OwnerPanel>

      <OwnerPanel title="Lịch sử hóa đơn">
        <div className={styles.filters}>
          <label className={styles.field}>Trạng thái hóa đơn
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="ALL">Tất cả trạng thái</option>
              <option value="PAID">Đã thanh toán (PAID)</option>
              <option value="PENDING">Chờ thanh toán (PENDING)</option>
              <option value="FAILED">Thất bại (FAILED)</option>
            </select>
          </label>
        </div>

        {loading ? (
          <p>Đang tải danh sách hóa đơn...</p>
        ) : filteredInvoices.length === 0 ? (
          <p style={{ color: '#64748b', fontSize: '14px', padding: '12px 0' }}>
            Chưa có hóa đơn nào. Hóa đơn dịch vụ sẽ được tự động xuất và lưu trữ tại đây sau khi thanh toán thành công.
          </p>
        ) : (
          <DataTable label="Lịch sử hóa đơn" headings={['Mã hóa đơn', 'Mã chuyển khoản', 'Kỳ dịch vụ', 'Số tiền', 'Trạng thái', 'Hạn thanh toán', 'Thao tác']}>
            {filteredInvoices.map(inv => (
              <tr key={inv.id}>
                <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{inv.invoiceNumber || `INV-${inv.id}`}</td>
                <td style={{ fontFamily: 'monospace', fontSize: 13, color: '#15803d', fontWeight: 600 }}>
                  {inv.paymentCode || `PRO000${inv.id}`}
                </td>
                <td>{inv.period || '1 tháng'}</td>
                <td style={{ fontWeight: 600 }}>{money(inv.amount)}</td>
                <td>
                  <span
                    className={styles.status}
                    style={{
                      color: String(inv.status).toUpperCase() === 'PAID' ? '#15803d' : String(inv.status).toUpperCase() === 'PENDING' ? '#b45309' : '#dc2626',
                      background: String(inv.status).toUpperCase() === 'PAID' ? '#dcfce7' : String(inv.status).toUpperCase() === 'PENDING' ? '#fef3c7' : '#fee2e2',
                    }}
                  >
                    {String(inv.status).toUpperCase()}
                  </span>
                </td>
                <td>{inv.dueDate || '—'}</td>
                <td>
                  <Button variant="outline" size="sm" onClick={() => setSelectedInvoice(inv)}>
                    Chi tiết
                  </Button>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </OwnerPanel>

      <Feedback value={feedback} />

      {/* Invoice Details Dialog */}
      <Dialog open={Boolean(selectedInvoice)} onOpenChange={open => { if (!open) setSelectedInvoice(null) }}>
        <DialogContent className={styles.dialog}>
          <DialogTitle>{`Chi tiết hóa đơn ${selectedInvoice?.invoiceNumber || `INV-${selectedInvoice?.id}`}`}</DialogTitle>
          <DialogDescription>Thông tin chi tiết và mã đối soát ngân hàng của hóa đơn dịch vụ SmartOmni.</DialogDescription>
          {selectedInvoice && (
            <dl className={styles.details}>
              <div>
                <dt>Mã hóa đơn</dt>
                <dd style={{ fontFamily: 'monospace', fontWeight: 600 }}>{selectedInvoice.invoiceNumber || `INV-${selectedInvoice.id}`}</dd>
              </div>
              <div>
                <dt>Gói dịch vụ</dt>
                <dd>SmartOmni Pro</dd>
              </div>
              <div>
                <dt>Phương thức thanh toán</dt>
                <dd>{selectedInvoice.paymentMethod || 'Chuyển khoản SePay (VietQR)'}</dd>
              </div>
              <div>
                <dt>Mã chuyển khoản (Nội dung CK)</dt>
                <dd style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    color: '#15803d',
                    background: '#f0fdf4',
                    padding: '3px 8px',
                    borderRadius: 4,
                    border: '1px solid #bbf7d0',
                  }}>
                    {selectedInvoice.paymentCode || `PRO000${selectedInvoice.id}`}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    style={{ height: 26, padding: '0 8px', fontSize: 12, gap: 4 }}
                    onClick={() => copyToClipboard(selectedInvoice.paymentCode || `PRO000${selectedInvoice.id}`)}
                  >
                    {copiedCode ? <Check size={12} /> : <Copy size={12} />}
                    {copiedCode ? 'Đã chép' : 'Sao chép'}
                  </Button>
                </dd>
              </div>
              <div>
                <dt>Mã giao dịch SePay (Gateway Txn)</dt>
                <dd style={{ fontFamily: 'monospace', color: '#0f172a' }}>{selectedInvoice.gatewayTransactionId || '—'}</dd>
              </div>
              <div>
                <dt>Kỳ cước</dt>
                <dd>{selectedInvoice.period || '1 tháng'}</dd>
              </div>
              <div>
                <dt>Số tiền</dt>
                <dd style={{ fontWeight: 600, color: '#16a34a' }}>{money(selectedInvoice.amount)}</dd>
              </div>
              <div>
                <dt>Trạng thái</dt>
                <dd>
                  <span style={{
                    background: selectedInvoice.status === 'PAID' ? '#dcfce7' : '#fee2e2',
                    color: selectedInvoice.status === 'PAID' ? '#15803d' : '#dc2626',
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontSize: 12,
                    fontWeight: 600,
                  }}>
                    {selectedInvoice.status}
                  </span>
                </dd>
              </div>
              <div>
                <dt>Thời gian thanh toán</dt>
                <dd>{selectedInvoice.paidAt ? new Date(selectedInvoice.paidAt).toLocaleString('vi-VN') : '—'}</dd>
              </div>
              <div>
                <dt>Hạn thanh toán</dt>
                <dd>{selectedInvoice.dueDate || '—'}</dd>
              </div>
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
  )
}
