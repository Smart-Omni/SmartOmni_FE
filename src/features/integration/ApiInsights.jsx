import { useCallback, useState, useEffect } from 'react'
import { Sparkles, Lock, CheckCircle2, TrendingUp, Cpu, AlertCircle } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { aiApi, requireId } from '@/services/api/operations'
import { DataTable, Feedback, OwnerPanel } from '@/features/portal/components/OwnerWorkspaceUI'
import { useApiResource } from './useApiResource'
import { ResourceState } from './ShopeeShared'
import { useApiAction } from './apiHelpers'
import { subscriptionApi } from '@/services/api/subscription'
import SepayVietQrModal from '@/features/portal/components/SepayVietQrModal'
import { useDemoSession } from '@/features/auth/hooks/useDemoSession'
import styles from '@/features/portal/OwnerWorkspace.module.css'

export default function ApiInsights() {
  const session = useDemoSession()
  const [skuId, setSkuId] = useState('')
  const [selected, setSelected] = useState(null)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [summary, setSummary] = useState(null)
  const [loadingSummary, setLoadingSummary] = useState(true)
  const [checkoutData, setCheckoutData] = useState(null)
  const [isCheckingOut, setIsCheckingOut] = useState(false)
  const action = useApiAction()

  const checkSubscription = async () => {
    try {
      setLoadingSummary(true)
      const res = await subscriptionApi.getSummary()
      setSummary(res)
    } catch (err) {
      console.warn('Could not load subscription summary:', err.message)
    } finally {
      setLoadingSummary(false)
    }
  }

  useEffect(() => {
    checkSubscription()
  }, [])

  const handleUpgrade = async () => {
    setIsCheckingOut(true)
    try {
      const data = await subscriptionApi.checkout()
      setCheckoutData(data)
    } catch (err) {
      console.error('Failed to start checkout:', err)
    } finally {
      setIsCheckingOut(false)
    }
  }

  const handlePaymentSuccess = () => {
    checkSubscription()
  }

  if (loadingSummary) {
    return (
      <OwnerPanel title="Trợ lý AI & Dự báo nhu cầu">
        <p style={{ color: '#64748b' }}>Đang xác thực thông tin gói cước...</p>
      </OwnerPanel>
    )
  }

  // Feature Lock for non-Pro tenants
  if (!summary?.isPro) {
    return (
      <>
        <OwnerPanel title="Trợ lý AI & Dự báo nhu cầu bán hàng (Demand Forecasts)">
          <div style={{
            textAlign: 'center',
            padding: '36px 16px',
            maxWidth: 640,
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}>
            <div style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 20,
              color: '#2563eb',
              border: '1px solid #bfdbfe',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.12)',
            }}>
              <Lock size={30} />
            </div>

            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: '#eff6ff',
              color: '#1d4ed8',
              fontSize: 12,
              fontWeight: 700,
              padding: '4px 12px',
              borderRadius: 20,
              marginBottom: 12,
              letterSpacing: '0.05em',
            }}>
              <Sparkles size={14} /> TÍNH NĂNG ĐỘC QUYỀN SMARTOMNI PRO
            </div>

            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: '0 0 12px' }}>
              Mở khóa Trợ lý AI và Dự báo Tồn kho thông minh
            </h2>

            <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6, margin: '0 0 28px' }}>
              Mô hình học máy chuyên sâu giúp doanh nghiệp phân tích hành vi mua sắm, tự động dự báo số lượng bán ra theo chu kỳ và đưa ra khuyến nghị số lượng đặt hàng SKU tối ưu.
            </p>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 16,
              width: '100%',
              textAlign: 'left',
              marginBottom: 32,
            }}>
              <div style={{ background: '#f8fafc', padding: '16px 18px', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, color: '#0f172a', marginBottom: 6 }}>
                  <TrendingUp size={18} color="#2563eb" />
                  <span>Dự báo nhu cầu đặt hàng (Forecast)</span>
                </div>
                <p style={{ margin: 0, fontSize: 13, color: '#64748b', lineHeight: 1.4 }}>
                  Mô hình Machine Learning phân tích dữ liệu bán hàng để dự báo số lượng bán ra và lượng tồn cần nhập thêm.
                </p>
              </div>

              <div style={{ background: '#f8fafc', padding: '16px 18px', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, color: '#0f172a', marginBottom: 6 }}>
                  <Cpu size={18} color="#16a34a" />
                  <span>Gợi ý sản phẩm liên quan (Recommendations)</span>
                </div>
                <p style={{ margin: 0, fontSize: 13, color: '#64748b', lineHeight: 1.4 }}>
                  Thuật toán tính toán độ tương đồng giữa các SKU đa kênh để đề xuất combo cross-sell và phân loại sản phẩm.
                </p>
              </div>
            </div>

            {session?.role === 'TENANT_OWNER' ? (
              <Button
                style={{
                  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                  color: '#ffffff',
                  fontWeight: 600,
                  padding: '12px 28px',
                  fontSize: 15,
                  borderRadius: 8,
                  boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
                }}
                disabled={isCheckingOut}
                onClick={handleUpgrade}
              >
                {isCheckingOut ? 'Đang tạo mã VietQR...' : '⚡ Nâng cấp SmartOmni Pro ngay (499.000 ₫/tháng)'}
              </Button>
            ) : (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 13,
                color: '#b45309',
                background: '#fef3c7',
                padding: '10px 16px',
                borderRadius: 8,
              }}>
                <AlertCircle size={16} />
                <span>Vui lòng liên hệ Chủ cửa hàng (Tenant Owner) để nâng cấp tài khoản lên gói SmartOmni Pro.</span>
              </div>
            )}
          </div>
        </OwnerPanel>

        <SepayVietQrModal
          open={Boolean(checkoutData)}
          checkout={checkoutData}
          onClose={() => setCheckoutData(null)}
          onSuccess={handlePaymentSuccess}
        />
      </>
    )
  }

  // Full Unlocked Pro Insights View
  return (
    <>
      <OwnerPanel title="Demand forecasts & product recommendations">
        <p>Look up results for a SKU in this workspace. Forecast generation and uncached recommendations require the AI service to be available.</p>
        <form
          className={styles.form}
          onSubmit={event => {
            event.preventDefault()
            try {
              setSelected(requireId(skuId, 'SKU ID'))
              setRevision(revision + 1)
              setError('')
            } catch (failure) {
              setError(failure.message)
            }
          }}
        >
          <label className={styles.field}>
            SKU ID
            <input required inputMode="numeric" value={skuId} onChange={event => setSkuId(event.target.value)} />
          </label>
          {error && <p role="alert" className={styles.error}>{error}</p>}
          <div className={styles.actions}>
            <Button type="submit">View insights</Button>
            <Button
              type="button"
              variant="outline"
              disabled={action.busy}
              onClick={() => action.run(
                aiApi.runForecast,
                'Forecast request completed. Refresh the selected SKU to view any available results.',
                () => setRevision(revision + 1)
              )}
            >
              {action.busy ? 'Requesting forecast…' : 'Run demand forecast'}
            </Button>
          </div>
        </form>
        <Feedback value={action.feedback} />
      </OwnerPanel>

      {selected && (
        <div className={styles.panelColumns}>
          <Forecasts key={`forecast:${selected}:${revision}`} skuId={selected} />
          <Recommendations key={`recommendations:${selected}:${revision}`} skuId={selected} />
        </div>
      )}
    </>
  )
}

function Forecasts({ skuId }) {
  const loader = useCallback(signal => aiApi.forecast(skuId, signal), [skuId])
  const resource = useApiResource(loader)
  return (
    <OwnerPanel title={`Forecasts · SKU ${skuId}`}>
      <ResourceState resource={resource} />
      {Array.isArray(resource.data) && (resource.data.length ? (
        <DataTable label="SKU demand forecasts" headings={['Date', 'Predicted quantity', 'Recommended reorder quantity', 'Model version']}>
          {resource.data.map((row, index) => (
            <tr key={row.id || index}>
              <td>{row.forecastDate || '—'}</td>
              <td>{row.predictedQuantity ?? '—'}</td>
              <td>{row.recommendedReorderQty ?? '—'}</td>
              <td>{row.modelVersionId ?? '—'}</td>
            </tr>
          ))}
        </DataTable>
      ) : (
        <p>No forecasts are available for this SKU.</p>
      ))}
    </OwnerPanel>
  )
}

function Recommendations({ skuId }) {
  const loader = useCallback(signal => aiApi.recommendations(skuId, signal), [skuId])
  const resource = useApiResource(loader)
  return (
    <OwnerPanel title={`Related SKUs · ${skuId}`}>
      <ResourceState resource={resource} />
      {Array.isArray(resource.data) && (resource.data.length ? (
        <DataTable label="SKU recommendations" headings={['Recommended SKU ID', 'Similarity score']}>
          {resource.data.map((row, index) => (
            <tr key={row.id || index}>
              <td>{row.recommendedSkuId ?? '—'}</td>
              <td>{row.similarityScore ?? '—'}</td>
            </tr>
          ))}
        </DataTable>
      ) : (
        <p>No recommendations are available for this SKU.</p>
      ))}
    </OwnerPanel>
  )
}
