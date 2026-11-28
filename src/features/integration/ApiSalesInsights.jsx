import { useEffect, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, CalendarDays, CircleHelp, RefreshCw, ShoppingBag, TrendingUp } from 'lucide-react'
import { MarketplaceLogo } from '@/shared/components/MarketplaceLogo'
import { insightsApi } from '@/services/api/insights'
import styles from './InsightsDemo.module.css'

const PERIOD_OPTIONS = [
  ['7 ngày', 7],
  ['30 ngày', 30],
]

const chargeLabels = ['Phí sàn', 'Vận chuyển shop chịu', 'Tiền hoàn cho khách', 'Phí ship hàng hoàn', 'Phí khác / điều chỉnh']
const chargeColors = ['#568eb9', '#5a9b83', '#e1a05c', '#d48278', '#99aaa4']

const money = value => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(value || 0))
const number = value => new Intl.NumberFormat('vi-VN').format(Number(value || 0))
const formatPct = value => (value == null ? '—' : `${Number(value).toFixed(1).replace('.', ',')}%`)
const formatTrend = value => {
  if (value == null) return '—'
  const n = Number(value)
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(1).replace('.', ',')}%`
}

export default function ApiSalesInsights() {
  const [period, setPeriod] = useState('7 ngày')
  const [reloadTick, setReloadTick] = useState(0)
  const [state, setState] = useState({ loading: true, error: '', data: null })

  const periodDays = period === '30 ngày' ? 30 : 7

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    insightsApi.sales(periodDays, controller.signal)
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
  }, [periodDays, reloadTick])

  const data = state.data
  const shopee = data?.shopee
  const tiktok = data?.tiktok
  const totalSales = Number(data?.totalSales || 0)
  const totalOrders = Number(data?.totalOrders || 0)
  const totalRefunds = Number(data?.totalRefunds || 0)
  const maxChannelSales = Math.max(1, Number(shopee?.sales || 0), Number(tiktok?.sales || 0))
  const chart = data?.chart || []
  const maxChartSales = Math.max(1, ...chart.flatMap(p => [Number(p.shopeeSales || 0), Number(p.tiktokSales || 0)]))

  return <div className={styles.page}>
    <div className={styles.pageHeading}>
      <div><span className={styles.eyebrow}><ShoppingBag size={14} /> HIỆU QUẢ THEO KÊNH</span><p>Theo dõi doanh số hàng hóa và các tín hiệu vận hành của từng kênh.</p></div>
    </div>

    <div className={styles.toolbar}>
      <div className={styles.periodSwitch} role="group" aria-label="Khoảng thời gian báo cáo">
        {PERIOD_OPTIONS.map(([label]) => (
          <button key={label} aria-pressed={period === label} onClick={() => { setState(prev => ({ ...prev, loading: true, error: '' })); setPeriod(label) }}>{label}</button>
        ))}
      </div>
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

    {state.loading && !data ? (
      <div className={styles.card}><p>Đang tổng hợp dữ liệu doanh thu từ các kênh…</p></div>
    ) : data && (
      <>
        <div className={styles.metricGrid}>
          <article className={styles.metricCard}><span className={styles.metricLabel}>Tổng giá trị hàng hóa <CircleHelp size={14} /></span><strong>{money(totalSales)}</strong><span className={styles.metricFoot}>Sau giảm giá do shop tài trợ · trước hoàn tiền</span><span className={styles.metricIcon}><TrendingUp size={18} /></span></article>
          <article className={styles.metricCard}><span className={styles.metricLabel}>Số đơn thành công <CircleHelp size={14} /></span><strong>{number(totalOrders)}</strong><span className={styles.metricFoot}>Đơn hợp lệ trong hai kênh</span><span className={styles.metricIcon}><ShoppingBag size={18} /></span></article>
          <article className={styles.metricCard}><span className={styles.metricLabel}>Tiền hoàn theo phiếu đã xác nhận <CircleHelp size={14} /></span><strong>{money(totalRefunds)}</strong><span className={styles.metricFoot}>Không phải tổng giá trị của các đơn bị trả</span><span className={styles.metricIcon}><ArrowDownRight size={18} /></span></article>
          <article className={styles.metricCard}><span className={styles.metricLabel}>So với kỳ trước <CircleHelp size={14} /></span><strong className={styles.twoTrend}><span><b className={styles.shopeeText}>S</b> {formatTrend(shopee?.trendPct)}</span><span><b className={styles.tiktokText}>T</b> {formatTrend(tiktok?.trendPct)}</span></strong><span className={styles.metricFoot}>So sánh với kỳ trước có cùng độ dài</span><span className={styles.metricIcon}><ArrowUpRight size={18} /></span></article>
        </div>

        <div className={styles.channelGrid}>
          <ChannelCard marketplace="shopee" label="Shopee" data={shopee} max={maxChannelSales} period={period} />
          <ChannelCard marketplace="tiktok" label="TikTok Shop" data={tiktok} max={maxChannelSales} period={period} />
        </div>
        <p className={styles.definitionNote}>Tiền hoàn là tổng số tiền ghi nhận trên các yêu cầu hoàn đã xác nhận, không phải toàn bộ giá trị của đơn bị trả. Báo cáo đối soát dựa trên snapshot tài chính từ escrow Shopee và sao kê giao dịch TikTok Shop.</p>

        <section className={styles.card}>
          <div className={styles.sectionTitle}><div><h3>Xu hướng bán hàng theo thời gian</h3><p>So sánh giá trị hàng hóa (VND) của Shopee và TikTok Shop trong cùng kỳ</p></div><span className={styles.legend}><i className={styles.shopeeDot} />Shopee <i className={styles.tiktokDot} />TikTok Shop</span></div>
          <div className={styles.lineChartWrap} role="img" aria-label={`Biểu đồ đường so sánh xu hướng giá trị hàng hóa của Shopee và TikTok Shop trong ${period}`}>
            <svg className={styles.lineChart} viewBox="0 0 700 190" preserveAspectRatio="none" aria-hidden="true">
              {[20, 60, 100, 140, 180].map(y => <line key={y} x1="0" y1={y} x2="700" y2={y} className={styles.chartGridLine} />)}
              {chart.length > 1 && <>
                <path d={lineArea(chart.map(p => Number(p.shopeeSales || 0)), maxChartSales)} className={styles.shopeeArea} />
                <path d={lineArea(chart.map(p => Number(p.tiktokSales || 0)), maxChartSales)} className={styles.tiktokArea} />
                <polyline points={linePoints(chart.map(p => Number(p.shopeeSales || 0)), maxChartSales)} className={styles.shopeeLine} />
                <polyline points={linePoints(chart.map(p => Number(p.tiktokSales || 0)), maxChartSales)} className={styles.tiktokLine} />
                {chart.map((point, index) => <g key={point.label}>
                  <circle cx={chartX(index, chart.length)} cy={chartY(Number(point.shopeeSales || 0), maxChartSales)} r="4" className={styles.shopeePoint} />
                  <circle cx={chartX(index, chart.length)} cy={chartY(Number(point.tiktokSales || 0), maxChartSales)} r="4" className={styles.tiktokPoint} />
                </g>)}
              </>}
            </svg>
            <div className={styles.lineChartDates} style={{ gridTemplateColumns: `repeat(${Math.max(1, chart.length)}, minmax(0, 1fr))` }}>
              {chart.map((point, index) => <span key={index} title={`Shopee: ${money(point.shopeeSales)} · TikTok: ${money(point.tiktokSales)}`}>{point.label}</span>)}
            </div>
          </div>
          <div className={styles.chartFoot}><span><CircleHelp size={14} />Giá trị hàng hóa VND theo từng {period === '7 ngày' ? 'ngày' : 'giai đoạn 5 ngày'}; đỉnh trục tương ứng {money(maxChartSales)}.</span></div>
        </section>

        <div className={styles.dataDefinition}><CircleHelp size={16} /><p><strong>Định nghĩa:</strong> doanh số và số đơn dùng đơn hợp lệ (không tính đơn huỷ/chờ thanh toán); giá trị hàng hóa đã trừ giảm giá do shop tài trợ nhưng chưa trừ tiền hoàn. Tiền hoàn tính riêng theo số tiền hoàn trên phiếu đã xác nhận, không lấy nguyên giá trị đơn. Các chỉ số này không đồng nghĩa doanh thu kế toán hay lợi nhuận.</p></div>
      </>
    )}
  </div>
}

function ChannelCard({ marketplace, label, data, max, period }) {
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
      <span className={`${styles.channelTrend} ${shopee ? styles.shopeeTrend : styles.tiktokTrend}`}><TrendingUp size={14} />{formatTrend(data?.trendPct)}</span>
    </div>
    <div className={styles.channelSales}><span>Giá trị hàng hóa</span><strong>{money(salesVal)}</strong><div className={styles.progress}><span style={{ width: `${Math.min(100, salesVal / max * 100)}%` }} /></div></div>
    <div className={styles.channelStats}><div><span>Số đơn thành công</span><strong>{number(data?.orders)}</strong></div><div><span>Giá trị đơn TB</span><strong>{money(data?.aov)}</strong></div><div><span>Tiền hoàn cho khách</span><strong>{money(data?.refunds)}</strong></div><div><span>Tỷ lệ hủy</span><strong>{formatPct(data?.cancelRate)}</strong></div></div>
    <div className={styles.orderTrend}>
      <div className={styles.orderTrendHeader}><div><strong>Đơn hàng được đặt</strong><span>{period === '7 ngày' ? 'Số đơn theo ngày' : 'Số đơn theo từng giai đoạn'}</span></div><b>{number(data?.orders)} <small>đơn</small></b></div>
      <div className={styles.orderLineLegend}><span><i />{shopee ? 'Đơn đặt Shopee' : 'Đơn đặt TikTok Shop'}</span></div>
      <div className={styles.orderLineChart} role="img" aria-label={`Số đơn hàng của ${label}`}>
        <div className={styles.orderYAxis}>{yTicks.map((tick, idx) => <span key={idx}>{number(tick)}</span>)}</div>
        <div className={styles.orderPlotArea}>
          <div className={styles.orderPlotBox}>
            <svg viewBox="0 0 420 120" preserveAspectRatio="none" aria-hidden="true">
              {[12, 60, 108].map(y => <line key={y} x1="0" y1={y} x2="420" y2={y} className={styles.orderGridLine} />)}
              {orderSeries.length > 0 && (() => {
                const count = orderSeries.length
                const getX = idx => (count <= 1 ? 210 : 12 + idx * (396 / (count - 1)))
                const getY = val => 108 - (yMaxOrders > 0 ? (Number(val || 0) / yMaxOrders) * 96 : 0)
                const pts = orderSeries.map((item, idx) => `${getX(idx)},${getY(item.count)}`).join(' ')
                const area = count > 1
                  ? `M ${getX(0)},108 L ${orderSeries.map((item, idx) => `${getX(idx)},${getY(item.count)}`).join(' L ')} L ${getX(count - 1)},108 Z`
                  : ''
                return <>
                  {area && <path d={area} className={styles.orderLineArea} />}
                  {count > 1 && <polyline points={pts} className={styles.orderLineStroke} />}
                  {orderSeries.map((item, idx) => (
                    <circle key={item.label} cx={getX(idx)} cy={getY(item.count)} r="3.5" className={styles.orderLineDot}>
                      <title>{`${item.label}: ${number(item.count)} đơn`}</title>
                    </circle>
                  ))}
                </>
              })()}
            </svg>
          </div>
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
      <p className={styles.financeFormula}>Ước tính: giá trị hàng hóa − các khoản trừ. Chưa gồm mọi trợ giá hoặc điều chỉnh ngoài kỳ; không phải số tiền chuyển về ngân hàng.</p>
    </div>
    <ProductList products={data?.products || []} unmappedUnits={data?.unmappedSkuUnits || 0} unmappedSales={data?.unmappedSkuSales || 0} />
  </section>
}

function ProductList({ products, unmappedUnits, unmappedSales }) {
  return <div className={styles.channelProducts}>
    <div className={styles.channelProductsHeading}><h4>Sản phẩm bán chạy</h4><span>Top 10 · kỳ này</span></div>
    <div className={styles.productDataHeader}><span>Sản phẩm · Số lượng bán thành công</span><span>Giá trị hàng hóa</span></div>
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
    {unmappedUnits > 0 && (
      <p className={styles.channelProductsNote}>Có {number(unmappedUnits)} sản phẩm chưa đối chiếu SKU ({money(unmappedSales)}) được tách riêng khỏi bảng xếp hạng.</p>
    )}
    <p className={styles.channelProductsNote}>Giá trị là tổng dòng hàng trong đơn hợp lệ sau giảm giá shop tài trợ, trước hoàn tiền.</p>
  </div>
}

function chartX(index, count) { return count <= 1 ? 350 : 8 + index * (684 / (count - 1)) }
function chartY(value, max) { return 174 - (max > 0 ? (value / max) * 150 : 0) }
function linePoints(values, max) { return values.map((value, index) => `${chartX(index, values.length)},${chartY(value, max)}`).join(' ') }
function lineArea(values, max) {
  const points = values.map((value, index) => `${chartX(index, values.length)},${chartY(value, max)}`)
  return `M ${points[0]} L ${points.slice(1).join(' L ')} L 692,180 L 8,180 Z`
}
