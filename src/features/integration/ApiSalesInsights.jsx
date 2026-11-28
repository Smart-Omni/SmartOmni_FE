import { useEffect, useState } from 'react'
import { ArrowDownRight, CalendarDays, ChevronDown, CircleHelp, RefreshCw, ShoppingBag, TrendingUp } from 'lucide-react'
import { MarketplaceLogo } from '@/shared/components/MarketplaceLogo'
import { insightsApi } from '@/services/api/insights'
import styles from './InsightsDemo.module.css'

const PRESET_PERIODS = [
  [7, '7 ngày'],
  [30, '30 ngày'],
  [60, '60 ngày'],
  [90, '90 ngày'],
  [180, '180 ngày'],
  [365, '365 ngày'],
  [730, '2 năm'],
  [1095, '3 năm'],
]

function toVnInputValue(ms) {
  const vn = new Date(ms + 7 * 3600_000)
  return vn.toISOString().slice(0, 16)
}

function vnInputToIso(value) {
  if (!value) return null
  const d = new Date(`${value}:00+07:00`)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function formatVnDateTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function toVnDateKey(iso) {
  if (!iso) return ''
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return ''
  return new Date(ms + 7 * 3600_000).toISOString().slice(0, 10)
}

const chargeLabels = ['Phí sàn', 'Vận chuyển shop chịu', 'Tiền hoàn cho khách', 'Phí ship hàng hoàn', 'Phí khác / điều chỉnh']
const chargeColors = ['#568eb9', '#5a9b83', '#e1a05c', '#d48278', '#99aaa4']

const money = value => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(value || 0))
const number = value => new Intl.NumberFormat('vi-VN').format(Number(value || 0))
const formatPct = value => (value == null ? '—' : `${Number(value).toFixed(1).replace('.', ',')}%`)

export default function ApiSalesInsights() {
  const [periodDays, setPeriodDays] = useState(7)
  const [isCustom, setIsCustom] = useState(false)
  const [fromInput, setFromInput] = useState(() => toVnInputValue(Date.now() - 7 * 86400_000))
  const [toInput, setToInput] = useState(() => toVnInputValue(Date.now()))
  const [appliedRange, setAppliedRange] = useState(null)
  const [reloadTick, setReloadTick] = useState(0)
  const [state, setState] = useState({ loading: true, error: '', data: null })

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    const query = isCustom && appliedRange
      ? { from: appliedRange.from, to: appliedRange.to }
      : { periodDays }
    insightsApi.sales(query, controller.signal)
      .then(data => {
        if (active) setState({ loading: false, error: '', data })
      })
      .catch(err => {
        if (active && err?.name !== 'CanceledError' && err?.code !== 'ERR_CANCELED') {
          setState(prev => ({ ...prev, loading: false, error: err?.message || 'Không thể tải dữ liệu doanh thu.' }))
        }
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [isCustom, periodDays, appliedRange, reloadTick])

  function selectPresetDays(nextDays) {
    setPeriodDays(Number(nextDays))
    setIsCustom(false)
    setState(prev => ({ ...prev, loading: true, error: '' }))
  }

  function enableCustomRange() {
    setIsCustom(true)
    const fromIso = vnInputToIso(fromInput)
    const toIso = vnInputToIso(toInput)
    if (fromIso && toIso && fromIso < toIso) {
      setState(prev => ({ ...prev, loading: true, error: '' }))
      setAppliedRange({ from: fromIso, to: toIso })
    } else {
      setState(prev => ({ ...prev, loading: false, error: 'Thời gian kết thúc phải sau thời gian bắt đầu.' }))
    }
  }

  function applyCustomRange(event) {
    event.preventDefault()
    const fromIso = vnInputToIso(fromInput)
    const toIso = vnInputToIso(toInput)
    if (!fromIso || !toIso || fromIso >= toIso) {
      setState(prev => ({ ...prev, loading: false, error: 'Thời gian kết thúc phải sau thời gian bắt đầu.' }))
      return
    }
    setState(prev => ({ ...prev, loading: true, error: '' }))
    setAppliedRange({ from: fromIso, to: toIso })
  }

  const data = state.data
  const shopee = data?.shopee
  const tiktok = data?.tiktok
  const totalSales = Number(data?.totalSales || 0)
  const totalOrders = Number(data?.totalOrders || 0)
  const totalRefunds = Number(data?.totalRefunds || 0)
  const maxChannelSales = Math.max(1, Number(shopee?.sales || 0), Number(tiktok?.sales || 0))

  return <div className={styles.page}>
    <div className={styles.pageHeading}>
      <div><span className={styles.eyebrow}><ShoppingBag size={14} /> HIỆU QUẢ THEO KÊNH</span><p>Theo dõi doanh số hàng hóa và các tín hiệu vận hành của từng kênh.</p></div>
    </div>

    <div className={styles.toolbar}>
      <div className={styles.periodSwitch} role="group" aria-label="Khoảng thời gian báo cáo">
        <label className={`${styles.periodSelectWrap} ${!isCustom ? styles.periodSelectActive : ''}`}>
          <select
            aria-label="Chọn khoảng thời gian"
            value={periodDays}
            onChange={e => selectPresetDays(e.target.value)}
          >
            {PRESET_PERIODS.map(([days, label]) => (
              <option key={days} value={days}>{label}</option>
            ))}
          </select>
          <ChevronDown size={14} className={styles.periodSelectChevron} aria-hidden="true" />
        </label>
        <button type="button" aria-pressed={isCustom} onClick={enableCustomRange}>Tùy chỉnh</button>
      </div>
      {isCustom && (
        <form className={styles.customRangeForm} onSubmit={applyCustomRange}>
          <label className={styles.customRangeField}>
            <span>Từ</span>
            <input type="datetime-local" value={fromInput} onChange={e => setFromInput(e.target.value)} required />
          </label>
          <label className={styles.customRangeField}>
            <span>Đến</span>
            <input type="datetime-local" value={toInput} onChange={e => setToInput(e.target.value)} required />
          </label>
          <button type="submit" className={styles.customRangeApply} disabled={state.loading}>Áp dụng</button>
        </form>
      )}
      <span className={styles.dateLabel}><CalendarDays size={15} />{data?.periodLabel || 'Đang tải…'}<span>· GMT+7</span></span>
      <button
        type="button"
        className={styles.advisorGenerateButton}
        style={{ marginLeft: 'auto', padding: '6px 12px', fontSize: 12 }}
        disabled={state.loading}
        onClick={() => { setState(prev => ({ ...prev, loading: true, error: '' })); setReloadTick(t => t + 1) }}
      >
        <RefreshCw size={14} className={state.loading ? styles.advisorSpin : ''} /> Làm mới
      </button>
    </div>

    {state.error && (
      <div className={styles.advisorHistoryError} role="alert">
        <div><strong>Không tải được dữ liệu so sánh doanh thu</strong><p>{state.error}</p></div>
      </div>
    )}

    {!state.error && isCustom && appliedRange && data && (() => {
      if (!data.earliestOrderAt || !data.latestOrderAt) {
        return (
          <div className={styles.historyRangeNotice} role="status">
            Chưa tìm thấy lịch sử đơn hàng nào trong hệ thống.
          </div>
        )
      }
      const fromDate = toVnDateKey(appliedRange.from)
      const toDate = toVnDateKey(appliedRange.to)
      const minDate = toVnDateKey(data.earliestOrderAt)
      const maxDate = toVnDateKey(data.latestOrderAt)
      if (fromDate < minDate || toDate > maxDate) {
        return (
          <div className={styles.historyRangeNotice} role="status">
            Chỉ tìm thấy lịch sử đơn hàng từ <strong>{formatVnDateTime(data.earliestOrderAt)}</strong> đến <strong>{formatVnDateTime(data.latestOrderAt)}</strong> (GMT+7). Đây là báo cáo trong khoảng thời gian này.
          </div>
        )
      }
      return null
    })()}

    {state.loading && !data ? (
      <div className={styles.card}><p>Đang tổng hợp dữ liệu doanh thu từ các kênh…</p></div>
    ) : data && (
      <>
        <div className={styles.metricGrid}>
          <article className={styles.metricCard}><span className={styles.metricLabel}>Tổng giá trị hàng hóa <CircleHelp size={14} /></span><strong>{money(totalSales)}</strong><span className={styles.metricFoot}>Sau giảm giá do shop tài trợ · trước hoàn tiền</span><span className={styles.metricIcon}><TrendingUp size={18} /></span></article>
          <article className={styles.metricCard}><span className={styles.metricLabel}>Số đơn thành công <CircleHelp size={14} /></span><strong>{number(totalOrders)}</strong><span className={styles.metricFoot}>Đơn hợp lệ trong hai kênh</span><span className={styles.metricIcon}><ShoppingBag size={18} /></span></article>
          <article className={styles.metricCard}><span className={styles.metricLabel}>Tiền hoàn theo phiếu đã xác nhận <CircleHelp size={14} /></span><strong>{money(totalRefunds)}</strong><span className={styles.metricFoot}>Không phải tổng giá trị của các đơn bị trả</span><span className={styles.metricIcon}><ArrowDownRight size={18} /></span></article>
        </div>

        <div className={styles.channelGrid}>
          <ChannelCard marketplace="shopee" label="Shopee" data={shopee} max={maxChannelSales} isDailySeries={!isCustom && periodDays === 7} />
          <ChannelCard marketplace="tiktok" label="TikTok Shop" data={tiktok} max={maxChannelSales} isDailySeries={!isCustom && periodDays === 7} />
        </div>
      </>
    )}
  </div>
}

function ChannelCard({ marketplace, label, data, max, isDailySeries }) {
  const shopee = marketplace === 'shopee'
  const ded = data?.deductions
  const rawDeductions = [
    ded?.platformFees ?? null,
    ded?.sellerShippingCost ?? null,
    ded?.buyerRefunds ?? null,
    ded?.reverseShippingFee ?? null,
    ded?.otherAdjustments ?? null,
  ]
  const deductionRows = rawDeductions.map((value, index) => ({
    label: chargeLabels[index],
    value: value == null ? null : Number(value),
    color: chargeColors[index],
  }))
  const validDeductions = deductionRows.filter(item => item.value != null && item.value > 0)
  const totalDeductions = deductionRows.reduce((sum, item) => sum + (item.value ?? 0), 0)
  let position = 0
  const pie = totalDeductions > 0 && validDeductions.length > 0 ? validDeductions.map(item => {
    const start = position
    position += item.value / totalDeductions * 100
    return `${item.color} ${start}% ${position}%`
  }).join(', ') : '#edf2f0 0% 100%'
  const receivedEstimate = ded?.receivedEstimate != null ? Number(ded.receivedEstimate) : Math.max(0, Number(data?.sales || 0) - totalDeductions)
  const orderSeries = data?.orderSeries || []
  const rawMaxOrders = Math.max(0, ...orderSeries.map(item => Number(item.count || 0)))
  const yMaxOrders = rawMaxOrders <= 2 ? 2 : Math.ceil(rawMaxOrders / 2) * 2
  const yTicks = [yMaxOrders, Math.round(yMaxOrders / 2), 0]
  const salesVal = Number(data?.sales || 0)

  return <section className={`${styles.channelCard} ${shopee ? styles.channelShopee : styles.channelTiktok}`}>
    <div className={styles.channelHeader}>
      <div><MarketplaceLogo marketplace={marketplace} size={30} decorative /><div><span>{data?.connected ? (data.shopName || 'ĐÃ KẾT NỐI') : 'CHƯA KẾT NỐI'}</span><h3>{label}</h3></div></div>
    </div>
    <div className={styles.channelSales}><span>Giá trị hàng hóa</span><strong>{money(salesVal)}</strong><div className={styles.progress}><span style={{ width: `${Math.min(100, salesVal / max * 100)}%` }} /></div></div>
    <div className={styles.channelStats}><div><span>Số đơn thành công</span><strong>{number(data?.orders)}</strong></div><div><span>Giá trị đơn TB</span><strong>{money(data?.aov)}</strong></div><div><span>Tiền hoàn cho khách</span><strong>{money(data?.refunds)}</strong></div><div><span>Tỷ lệ hủy</span><strong>{formatPct(data?.cancelRate)}</strong></div></div>
    <div className={styles.orderTrend}>
      <div className={styles.orderTrendHeader}><div><strong>Đơn hàng được đặt</strong><span>{isDailySeries ? 'Số đơn theo ngày' : 'Số đơn theo từng giai đoạn'}</span></div><b>{number(data?.orders)} <small>đơn</small></b></div>
      <div className={styles.orderLineLegend}><span><i />{shopee ? 'Đơn đặt Shopee' : 'Đơn đặt TikTok Shop'}</span></div>
      <div className={styles.orderLineChart} role="img" aria-label={`Số đơn hàng của ${label}`}>
        <div className={styles.orderYAxis}>{yTicks.map((tick, idx) => <span key={idx}>{number(tick)}</span>)}</div>
        <div className={styles.orderPlotArea}>
          {(() => {
            const count = orderSeries.length
            const getX = idx => (count <= 1 ? 210 : 14 + idx * (392 / (count - 1)))
            const getY = val => 108 - (yMaxOrders > 0 ? (Number(val || 0) / yMaxOrders) * 96 : 0)
            const pts = orderSeries.map((item, idx) => `${getX(idx)},${getY(item.count)}`).join(' ')
            const area = count > 1
              ? `M ${getX(0)},108 L ${orderSeries.map((item, idx) => `${getX(idx)},${getY(item.count)}`).join(' L ')} L ${getX(count - 1)},108 Z`
              : ''
            return (
              <div className={styles.orderPlotBox}>
                <svg viewBox="0 0 420 120" preserveAspectRatio="none" aria-hidden="true">
                  {[12, 60, 108].map(y => <line key={y} x1="0" y1={y} x2="420" y2={y} className={styles.orderGridLine} />)}
                  {area && <path d={area} className={styles.orderLineArea} />}
                  {count > 1 && <polyline points={pts} className={styles.orderLineStroke} vectorEffect="non-scaling-stroke" />}
                </svg>
                {orderSeries.map((item, idx) => (
                  <span
                    key={item.label}
                    className={styles.orderLineDot}
                    style={{ left: `${(getX(idx) / 420) * 100}%`, top: `${(getY(item.count) / 120) * 100}%` }}
                    title={`${item.label}: ${number(item.count)} đơn`}
                  />
                ))}
              </div>
            )
          })()}
          <div className={styles.orderXAxis} style={{ gridTemplateColumns: `repeat(${Math.max(1, orderSeries.length)}, minmax(0, 1fr))` }}>
            {orderSeries.map(item => <span key={item.label} title={`${item.label}: ${number(item.count)} đơn`}>{item.label}</span>)}
          </div>
        </div>
      </div>
    </div>
    <div className={styles.receivedBlock}>
      <div className={styles.receivedHeader}><div><span>Giá trị thực nhận</span><strong>{money(receivedEstimate)}</strong></div><span className={styles.estimatedBadge}>{ded?.estimated === false ? 'Từ đối soát' : 'Ước tính'}</span></div>
      <p className={styles.pieCaption}>Tổng khoản trừ: <strong>{money(totalDeductions)}</strong></p>
      <div className={styles.financeChartRow}>
        <div className={styles.pieChart} role="img" aria-label={`Tổng khoản trừ ${money(totalDeductions)} của ${label}`} style={{ background: `conic-gradient(${pie})` }}><span><small>Tổng khoản trừ</small><strong>{money(totalDeductions)}</strong></span></div>
        <div className={styles.financeLegend}>
          <div className={styles.financeLegendHeader}><span>Khoản trừ</span><span>Số tiền · tỷ trọng trong khoản trừ</span></div>
          {deductionRows.map(item => (
            <div className={styles.financeLegendItem} key={item.label}>
              <i style={{ background: item.color, opacity: item.value == null ? 0.35 : 1 }} />
              <span>{item.label}</span>
              <strong>{item.value == null ? 'Chưa có dữ liệu' : money(item.value)}</strong>
              <small>{item.value == null || totalDeductions <= 0 ? '—' : `${(item.value / totalDeductions * 100).toFixed(0)}%`}</small>
            </div>
          ))}
          <p>{ded?.snapshotCoverageCount > 0 ? `Đã đối soát ${number(ded.snapshotCoverageCount)} đơn từ sàn.` : 'Chưa có snapshot tài chính cho các đơn trong kỳ.'}</p>
        </div>
      </div>
    </div>
    <ProductList products={data?.products || []} />
  </section>
}

function ProductList({ products }) {
  return <div className={styles.channelProducts}>
    <div className={styles.channelProductsHeading}><h4>Sản phẩm bán chạy</h4></div>
    <div className={styles.productDataHeader}><span /><span>Giá trị hàng hóa</span></div>
    {products.length === 0 ? (
      <p className={styles.channelProductsNote}>Chưa có sản phẩm bán ra trong kỳ này.</p>
    ) : (
      products.map((product, index) => (
        <div className={styles.productRow} key={`${product.skuId ?? product.sku}-${index}`}>
          <span className={styles.rank}>{String(index + 1).padStart(2, '0')}</span>
          <div className={styles.productName}><strong>{product.name}</strong><span>{product.sku} · {number(product.units)} sản phẩm đã bán thành công</span></div>
          <strong className={styles.productSales}>{money(product.sales)}</strong>
        </div>
      ))
    )}
  </div>
}
