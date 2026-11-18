import { useState, useEffect, useRef } from 'react'
import { Check, Copy, Clock, CircleCheck, AlertCircle, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog'
import { Button } from '@/shared/ui/button'
import { cn } from '@/shared/lib/utils'
import { subscriptionApi } from '@/services/api/subscription'
import styles from './SepayVietQrModal.module.css'

function formatVnd(amount) {
  if (!amount && amount !== 0) return '0 ₫'
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)
}

function formatTimer(seconds) {
  const m = Math.floor(Math.max(0, seconds) / 60)
  const s = Math.max(0, seconds) % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function SepayVietQrModal({ checkout, open, onClose, onSuccess }) {
  const [copiedField, setCopiedField] = useState(null)
  const [secondsRemaining, setSecondsRemaining] = useState(900)
  const [paymentStatus, setPaymentStatus] = useState('PENDING')
  const [paidDetails, setPaidDetails] = useState(null)
  const [isSimulating, setIsSimulating] = useState(false)
  const [simError, setSimError] = useState(null)
  const pollTimerRef = useRef(null)

  const handleSimulatePayment = async () => {
    if (!checkout?.orderCode) return
    setIsSimulating(true)
    setSimError(null)
    try {
      await subscriptionApi.simulatePayment(checkout.orderCode)
      const res = await subscriptionApi.getOrderStatus(checkout.orderCode)
      if (res?.status === 'PAID') {
        setPaymentStatus('PAID')
        setPaidDetails(res)
        if (onSuccess) {
          onSuccess(res)
        }
      }
    } catch (err) {
      console.error('Simulation error:', err)
      setSimError(err.message || 'Không thể giả lập thanh toán')
    } finally {
      setIsSimulating(false)
    }
  }

  useEffect(() => {
    if (!open || !checkout) {
      setPaymentStatus('PENDING')
      setPaidDetails(null)
      return
    }

    setPaymentStatus('PENDING')
    setPaidDetails(null)

    // Calculate initial countdown from expiresAt if provided
    if (checkout.expiresAt) {
      const diffSec = Math.floor((new Date(checkout.expiresAt).getTime() - Date.now()) / 1000)
      setSecondsRemaining(diffSec > 0 ? diffSec : 900)
    } else {
      setSecondsRemaining(900)
    }

    // 1. Countdown timer
    const countdownInterval = setInterval(() => {
      setSecondsRemaining(prev => {
        if (prev <= 1) {
          clearInterval(countdownInterval)
          setPaymentStatus('EXPIRED')
          return 0
        }
        return prev - 1
      })
    }, 1000)

    // 2. Status polling
    const pollStatus = async () => {
      try {
        const res = await subscriptionApi.getOrderStatus(checkout.orderCode)
        if (res?.status === 'PAID') {
          clearInterval(countdownInterval)
          clearInterval(pollTimerRef.current)
          setPaymentStatus('PAID')
          setPaidDetails(res)
          if (onSuccess) {
            onSuccess(res)
          }
        } else if (res?.status === 'EXPIRED' || res?.status === 'FAILED') {
          clearInterval(countdownInterval)
          clearInterval(pollTimerRef.current)
          setPaymentStatus(res.status)
        }
      } catch (err) {
        // Silently continue polling on intermittent network errors
        console.warn('SePay status polling check:', err.message)
      }
    }

    // Initial check after 2 seconds, then poll every 2.5s
    pollTimerRef.current = setInterval(pollStatus, 2500)

    return () => {
      clearInterval(countdownInterval)
      clearInterval(pollTimerRef.current)
    }
  }, [open, checkout, onSuccess])

  const copyToClipboard = async (text, fieldName) => {
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
      setCopiedField(fieldName)
      setTimeout(() => setCopiedField(null), 2000)
    } catch (err) {
      console.error('Failed to copy to clipboard:', err)
    }
  }

  if (!open || !checkout) return null

  return (
    <Dialog open={open} onOpenChange={val => { if (!val) onClose() }}>
      <DialogContent className={cn("sm:max-w-3xl md:max-w-4xl !max-w-[800px] w-full", styles.dialog)}>
        {paymentStatus === 'PAID' ? (
          <div className={styles.successView}>
            <CircleCheck className={styles.successIcon} />
            <DialogTitle className={styles.successTitle}>Thanh toán thành công!</DialogTitle>
            <DialogDescription className={styles.successDesc}>
              Doanh nghiệp của bạn đã được nâng cấp thành công lên gói <strong>SmartOmni Pro</strong> qua cổng thanh toán SePay.
            </DialogDescription>

            <div className={styles.successCard}>
              <div className={styles.successRow}>
                <span>Gói dịch vụ</span>
                <span>SmartOmni {paidDetails?.planName || checkout.planName || 'PRO'}</span>
              </div>
              <div className={styles.successRow}>
                <span>Mã giao dịch</span>
                <span style={{ fontFamily: 'monospace' }}>{checkout.orderCode}</span>
              </div>
              <div className={styles.successRow}>
                <span>Số tiền thanh toán</span>
                <span style={{ color: '#16a34a' }}>{formatVnd(checkout.amount)}</span>
              </div>
              <div className={styles.successRow}>
                <span>Trạng thái</span>
                <span style={{ color: '#16a34a' }}>ĐÃ KÍCH HOẠT</span>
              </div>
            </div>

            <Button onClick={onClose} style={{ minWidth: 160 }}>
              Bắt đầu sử dụng Pro
            </Button>
          </div>
        ) : paymentStatus === 'EXPIRED' ? (
          <div className={styles.expiredView}>
            <AlertCircle className={styles.expiredIcon} />
            <DialogTitle className={styles.successTitle}>Phiên thanh toán đã hết hạn</DialogTitle>
            <DialogDescription className={styles.successDesc}>
              Mã VietQR cho đơn hàng này đã hết hiệu lực sau 15 phút. Vui lòng tạo mã thanh toán mới để tiếp tục nâng cấp.
            </DialogDescription>
            <div className={styles.footer}>
              <Button variant="outline" onClick={onClose}>
                Đóng
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <div className={styles.header}>
              <DialogTitle>Nâng cấp SmartOmni Pro</DialogTitle>
              <DialogDescription>
                Quét mã VietQR bằng ứng dụng Ngân hàng bất kỳ để hoàn tất thanh toán tự động qua SePay.
              </DialogDescription>
            </div>

            <div className={styles.layout}>
              {/* Cột trái: QR Code và đếm ngược */}
              <div className={styles.qrContainer}>
                <img
                  src={checkout.qrUrl}
                  alt={`VietQR thanh toan ${checkout.orderCode}`}
                  className={styles.qrImage}
                />
                <div className={styles.timer}>
                  <Clock size={15} />
                  <span>Hiệu lực: {formatTimer(secondsRemaining)}</span>
                </div>
                <div className={styles.pulseStatus}>
                  <span className={styles.pulseDot} />
                  <span>Đang chờ chuyển khoản...</span>
                </div>
              </div>

              {/* Cột phải: Thông tin chuyển khoản */}
              <div className={styles.detailsList}>
                <div className={styles.detailRow}>
                  <div className={styles.detailLabel}>
                    <span>Ngân hàng thụ hưởng</span>
                    <span className={styles.detailValue}>{checkout.bankId || 'MBBank'}</span>
                  </div>
                </div>

                <div className={styles.detailRow}>
                  <div className={styles.detailLabel}>
                    <span>Số tài khoản</span>
                    <span className={styles.detailValue}>{checkout.accountNumber || '0388656111'}</span>
                  </div>
                  <button
                    type="button"
                    className={`${styles.copyButton} ${copiedField === 'acc' ? styles.copied : ''}`}
                    onClick={() => copyToClipboard(checkout.accountNumber || '0388656111', 'acc')}
                  >
                    {copiedField === 'acc' ? <Check size={14} /> : <Copy size={14} />}
                    {copiedField === 'acc' ? 'Đã chép' : 'Sao chép'}
                  </button>
                </div>

                <div className={styles.detailRow}>
                  <div className={styles.detailLabel}>
                    <span>Chủ tài khoản</span>
                    <span className={styles.detailValue}>{checkout.accountHolder || 'CTCP CONG NGHE SMARTOUNI'}</span>
                  </div>
                </div>

                <div className={styles.detailRow}>
                  <div className={styles.detailLabel}>
                    <span>Số tiền</span>
                    <span className={`${styles.detailValue} ${styles.amountValue}`}>
                      {formatVnd(checkout.amount)}
                    </span>
                  </div>
                  <button
                    type="button"
                    className={`${styles.copyButton} ${copiedField === 'amount' ? styles.copied : ''}`}
                    onClick={() => copyToClipboard(checkout.amount, 'amount')}
                  >
                    {copiedField === 'amount' ? <Check size={14} /> : <Copy size={14} />}
                    {copiedField === 'amount' ? 'Đã chép' : 'Sao chép'}
                  </button>
                </div>

                <div className={`${styles.detailRow} ${styles.memoRow}`}>
                  <div className={styles.detailLabel}>
                    <span style={{ color: '#15803d', fontWeight: 600 }}>Nội dung chuyển khoản (Memo)</span>
                    <span className={`${styles.detailValue} ${styles.memoValue}`}>
                      {checkout.memo || checkout.orderCode}
                    </span>
                  </div>
                  <button
                    type="button"
                    className={`${styles.copyButton} ${copiedField === 'memo' ? styles.copied : ''}`}
                    onClick={() => copyToClipboard(checkout.memo || checkout.orderCode, 'memo')}
                  >
                    {copiedField === 'memo' ? <Check size={14} /> : <Copy size={14} />}
                    {copiedField === 'memo' ? 'Đã chép' : 'Sao chép'}
                  </button>
                </div>

                <div className={styles.memoNotice}>
                  <strong>Lưu ý quan trọng:</strong> Vui lòng giữ nguyên nội dung chuyển khoản để hệ thống SePay nhận diện và tự động kích hoạt gói Pro tức thì.
                </div>

                <div className={styles.simulationBox}>
                  <div className={styles.simulationHeader}>
                    <span>🧪 Môi trường thử nghiệm (Sandbox / Dev)</span>
                  </div>
                  <p className={styles.simulationText}>
                    Bạn có thể nhấn nút bên dưới để giả lập ngân hàng gửi thông báo biến động số dư thành công đến SePay:
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={isSimulating}
                    onClick={handleSimulatePayment}
                    className={styles.simulateBtn}
                  >
                    {isSimulating ? <Loader2 size={15} className="animate-spin" /> : null}
                    {isSimulating ? 'Đang xử lý giao dịch...' : '⚡ Giả lập thanh toán SePay thành công'}
                  </Button>
                  {simError && <p className={styles.simulationError}>{simError}</p>}
                </div>
              </div>
            </div>

            <div className={styles.footer}>
              <Button variant="outline" onClick={onClose}>
                Hủy bỏ
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
