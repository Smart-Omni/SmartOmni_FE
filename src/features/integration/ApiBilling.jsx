import { useState, useEffect } from 'react'
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
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [checkoutData, setCheckoutData] = useState(null)
  const [isCheckingOut, setIsCheckingOut] = useState(false)
  const [feedback, setFeedback] = useState(null)

  const loadInvoices = async () => {
    try {
      setLoading(true)
      const list = await subscriptionApi.getInvoices()
      if (Array.isArray(list)) {
        setInvoices(list)
      }
    } catch (err) {
      console.warn('Could not load invoices:', err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadInvoices()
  }, [])

  const isPro = invoices.some(inv => inv.status === 'PAID')

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
    setFeedback({ message: 'Chúc mừng! Bạn đã nâng cấp thành công lên gói SmartOmni Pro qua cổng thanh toán SePay.' })
    loadInvoices()
  }

  const filteredInvoices = invoices.filter(item => statusFilter === 'ALL' || item.status === statusFilter)

  return (
    <>
      <SummaryMetrics
        items={[
          ['Gói cước hiện tại', isPro ? 'SmartOmni Pro' : 'Free Tier'],
          ['Hình thức thanh toán', 'VietQR tự động (SePay)'],
          ['Số lượng hóa đơn', invoices.length],
        ]}
      />

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
              {isPro && <span style={{ background: '#dcfce7', color: '#15803d', fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px' }}>ACTIVE</span>}
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
              <Button variant="outline" disabled style={{ borderColor: '#22c55e', color: '#15803d' }}>
                Đang sử dụng gói Pro
              </Button>
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
          <DataTable label="Lịch sử hóa đơn" headings={['Mã hóa đơn', 'Kỳ dịch vụ', 'Số tiền', 'Trạng thái', 'Hạn thanh toán', 'Thao tác']}>
            {filteredInvoices.map(inv => (
              <tr key={inv.id}>
                <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{`INV-${inv.id}`}</td>
                <td>{inv.period || '1 tháng'}</td>
                <td style={{ fontWeight: 600 }}>{money(inv.amount)}</td>
                <td>
                  <span
                    className={styles.status}
                    style={{
                      color: inv.status === 'PAID' ? '#15803d' : inv.status === 'PENDING' ? '#b45309' : '#dc2626',
                      background: inv.status === 'PAID' ? '#dcfce7' : inv.status === 'PENDING' ? '#fef3c7' : '#fee2e2',
                    }}
                  >
                    {inv.status}
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

      <Dialog open={Boolean(selectedInvoice)} onOpenChange={open => { if (!open) setSelectedInvoice(null) }}>
        <DialogContent className={styles.dialog}>
          <DialogTitle>{`Chi tiết hóa đơn INV-${selectedInvoice?.id}`}</DialogTitle>
          <DialogDescription>Thông tin chi tiết hóa đơn dịch vụ SmartOmni.</DialogDescription>
          {selectedInvoice && (
            <dl className={styles.details}>
              {[
                ['Gói dịch vụ', 'SmartOmni Pro'],
                ['Kỳ cước', selectedInvoice.period || '1 tháng'],
                ['Số tiền', money(selectedInvoice.amount)],
                ['Trạng thái', selectedInvoice.status],
                ['Hạn thanh toán', selectedInvoice.dueDate || '—'],
                ['Ngày tạo', selectedInvoice.createdAt ? new Date(selectedInvoice.createdAt).toLocaleString('vi-VN') : '—'],
              ].map(([lbl, val]) => (
                <div key={lbl}>
                  <dt>{lbl}</dt>
                  <dd>{val}</dd>
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
  )
}
