import { useEffect, useState } from 'react'
import { AlertTriangle, CalendarDays, CircleHelp, PackageX, RotateCcw, ShoppingBag, TrendingDown } from 'lucide-react'
import { insightsApi } from '@/services/api/insights'
import MetricInfoHint from './MetricInfoHint'
import styles from './InsightsDemo.module.css'

const PERIOD_OPTIONS = [
  ['7 ngày', 7],
  ['30 ngày', 30],
]

const number = value => new Intl.NumberFormat('vi-VN').format(Number(value || 0))
const money = value => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(value || 0))
const formatPct = value => `${Number(value || 0).toFixed(1).replace('.', ',')}%`

export default function ApiOrderOutcomes({ embedded = false }) {
  const [period, setPeriod] = useState('7 ngày')
  const [state, setState] = useState({ loading: true, error: '', data: null })
  const periodDays = period === '30 ngày' ? 30 : 7

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    insightsApi.outcomes(periodDays, controller.signal)
      .then(data => {
        if (active) setState({ loading: false, error: '', data })
      })
      .catch(err => {
        if (active && err?.name !== 'CanceledError' && err?.code !== 'ERR_CANCELED') {
          setState(prev => ({ ...prev, loading: false, error: err?.message || 'Không thể tải dữ liệu hủy & hoàn.' }))
        }
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [periodDays])

  const data = state.data

  return (
    <div className={`${styles.page} ${embedded ? styles.embeddedOutcomes : ''}`}>
      {!embedded && (
        <div className={styles.pageHeading}>
          <div>
            <span className={styles.eyebrow}><ShoppingBag size={14} /> CHẤT LƯỢNG ĐƠN HÀNG</span>
            <h2>Hủy đơn &amp; trả hàng.</h2>
            <p>Nhìn rõ lý do, theo dõi xu hướng và tìm vấn đề cần xử lý ở từng sàn.</p>
          </div>
        </div>
      )}

      <div className={`${styles.toolbar} ${embedded ? styles.embeddedToolbar : ''}`}>
        <div className={styles.periodSwitch} role="group" aria-label="Khoảng thời gian Hủy và Hoàn">
          {PERIOD_OPTIONS.map(([label]) => (
            <button key={label} type="button" aria-pressed={period === label} onClick={() => setPeriod(label)}>
              {label}
            </button>
          ))}
        </div>
        <span className={styles.dateLabel}>
          <CalendarDays size={15} />
          {data?.periodLabel || 'Đang tải...'}
          <span>· GMT+7</span>
        </span>
      </div>

      {state.error && <div className={styles.historyRangeNotice}>{state.error}</div>}

      {state.loading && !data ? (
        <div className={styles.card}><p>Đang tổng hợp dữ liệu hủy đơn &amp; trả hàng…</p></div>
      ) : data && (
        <>
          {!embedded && (
            <div className={styles.metricGrid}>
              <OutcomeMetric icon={PackageX} label="Đơn bị hủy" value={number(data.cancelled.total)} detail={`${formatPct(data.cancelled.ratePct)} trên tổng đơn đã đặt`} />
              <OutcomeMetric icon={RotateCcw} label="Yêu cầu trả hàng / hoàn tiền" value={number(data.aftersales.total)} detail={`${formatPct(data.aftersales.ratePct)} trên đơn thành công`} />
              <OutcomeMetric icon={TrendingDown} label="Tiền hoàn đã ghi nhận" value={money(data.aftersales.refunds)} detail="Theo yêu cầu hoàn đã xác nhận" />
              <OutcomeMetric icon={AlertTriangle} label="Lý do hủy phổ biến nhất" value={data.cancelled.topReason} detail="Tổng hợp cả hai sàn" compact />
            </div>
          )}

          <div className={styles.outcomeReasonGrid}>
            <ReasonPanel
              title="Vì sao đơn bị hủy?"
              subtitle={`${number(data.cancelled.total)} đơn · ${formatPct(data.cancelled.ratePct)} trên số đơn đã đặt`}
              icon={PackageX}
              rows={data.cancelReasons || []}
              hint={{
                title: 'Phân nhóm lý do hủy đơn',
                definition: 'Tổng hợp các đơn chuyển sang trạng thái Đã hủy trong khoảng thời gian đã chọn.',
                formula: 'Lý do từ Shopee (cancel_by, cancel_reason) và TikTok (cancellation_initiator, cancel_reason) được quy chuẩn về 5 nhóm chung.',
                period: `${data.periodLabel} (${period})`,
                source: 'Order API & Cancellation API hai sàn.',
              }}
            />
            <ReasonPanel
              title="Vì sao khách yêu cầu trả / hoàn?"
              subtitle={`${number(data.aftersales.total)} yêu cầu · ${formatPct(data.aftersales.ratePct)} trên đơn thành công`}
              icon={RotateCcw}
              rows={data.returnReasons || []}
              hint={{
                title: 'Phân nhóm lý do trả hàng / hoàn tiền',
                definition: 'Yêu cầu trả hàng hoặc hoàn tiền phát sinh sau khi giao hàng.',
                formula: 'Nhóm theo lý do chuẩn hóa; yêu cầu chưa phân loại được đưa vào mục Khác / chưa xác định.',
                period: `${data.periodLabel} (${period})`,
                source: 'Shopee Returns API & TikTok Return Search API.',
              }}
            />
          </div>

          <section className={styles.outcomeTrendSection}>
            <div className={styles.outcomeSectionHeading}>
              <div>
                <h3>Xu hướng theo ngày</h3>
                <p>So sánh số lượng đơn giữa hai sàn trong cùng kỳ</p>
              </div>
              <span className={styles.legend}><i className={styles.shopeeDot} />Shopee <i className={styles.tiktokDot} />TikTok Shop</span>
            </div>
            <div className={styles.outcomeTrendGrid}>
              <TrendPanel title="Đơn bị hủy" series={data.cancelled} dates={data.dates || []} />
              <TrendPanel title="Yêu cầu trả / hoàn" series={data.aftersales} dates={data.dates || []} />
            </div>
          </section>

          <div className={styles.dataDefinition}>
            <CircleHelp size={16} />
            <p>
              <strong>Cách đọc:</strong> Hủy đơn là đơn dừng trước khi hoàn tất. Trả hàng / hoàn tiền là yêu cầu sau mua; hoàn tiền không phải lúc nào cũng có trả hàng vật lý. Lý do từ từng sàn được nhóm vào danh mục chung; lý do trống hoặc chưa ghép được sẽ nằm ở “Khác / chưa xác định”.
            </p>
          </div>
        </>
      )}
    </div>
  )
}

function OutcomeMetric({ icon: Icon, label, value, detail, compact = false }) {
  return (
    <article className={`${styles.metricCard} ${compact ? styles.outcomeMetricCompact : ''}`}>
      <span className={styles.metricLabel}>{label}</span>
      <strong>{value}</strong>
      <span className={styles.metricFoot}>{detail}</span>
      <span className={styles.metricIcon}><Icon size={18} /></span>
    </article>
  )
}

function ReasonPanel({ title, subtitle, icon: Icon, rows, hint }) {
  const max = Math.max(1, ...rows.flatMap(row => [row.shopee, row.tiktok]))
  return (
    <section className={styles.card}>
      <div className={styles.outcomeSectionHeading}>
        <div>
          <h3 className={styles.metricLabel}>{title}{hint && <MetricInfoHint {...hint} />}</h3>
          <p>{subtitle}</p>
        </div>
        <span className={styles.outcomePanelIcon}><Icon size={17} /></span>
      </div>
      <div className={styles.reasonLegend}><span /><span><i className={styles.shopeeDot} />Shopee</span><span><i className={styles.tiktokDot} />TikTok</span></div>
      <div className={styles.reasonList}>
        {rows.map(row => (
          <div className={styles.reasonRow} key={row.label}>
            <strong>{row.label}</strong>
            <ReasonBar label="Shopee" count={row.shopee} max={max} platform="shopee" />
            <ReasonBar label="TikTok Shop" count={row.tiktok} max={max} platform="tiktok" />
          </div>
        ))}
      </div>
      <p className={styles.reasonFoot}>Số lượng theo lý do ghi nhận · kênh được phân biệt bằng màu</p>
    </section>
  )
}

function ReasonBar({ label, count, max, platform }) {
  return (
    <div className={styles.reasonBarLine}>
      <span>{label}</span>
      <div className={styles.reasonBarTrack}>
        <i className={platform === 'shopee' ? styles.reasonShopeeBar : styles.reasonTiktokBar} style={{ width: `${count ? Math.max(7, count / max * 100) : 0}%` }} />
      </div>
      <strong>{count}</strong>
    </div>
  )
}

function TrendPanel({ title, series, dates }) {
  const shopeeSeries = series.seriesShopee || []
  const tiktokSeries = series.seriesTiktok || []
  const maxValue = Math.max(...shopeeSeries, ...tiktokSeries, 1)
  const visibleLabels = dates.length > 10
    ? dates.filter((_, idx) => idx % 5 === 0 || idx === dates.length - 1)
    : dates

  return (
    <section className={styles.outcomeTrendCard}>
      <div className={styles.outcomeTrendHeading}><h4>{title}</h4><span>{number(series.total)} tổng</span></div>
      <div className={styles.outcomeLineChart} role="img" aria-label={`${title}: Shopee ${shopeeSeries.join(', ')}; TikTok Shop ${tiktokSeries.join(', ')}`}>
        <svg viewBox="0 0 600 150" preserveAspectRatio="none" aria-hidden="true">
          {[15, 50, 85, 120].map(y => <line key={y} x1="0" y1={y} x2="600" y2={y} className={styles.outcomeGridLine} />)}
          {shopeeSeries.length > 0 && <polyline points={trendPoints(shopeeSeries, maxValue)} className={styles.shopeeLine} />}
          {tiktokSeries.length > 0 && <polyline points={trendPoints(tiktokSeries, maxValue)} className={styles.tiktokLine} />}
          {shopeeSeries.map((value, index) => (
            <g key={index}>
              <circle cx={trendX(index, dates.length)} cy={trendY(value, maxValue)} r="3.5" className={styles.shopeePoint} />
              <circle cx={trendX(index, dates.length)} cy={trendY(tiktokSeries[index] || 0, maxValue)} r="3.5" className={styles.tiktokPoint} />
            </g>
          ))}
        </svg>
        <div className={styles.outcomeChartDates} style={{ gridTemplateColumns: `repeat(${Math.max(1, visibleLabels.length)}, minmax(0, 1fr))` }}>
          {visibleLabels.map(date => <span key={date}>{date}</span>)}
        </div>
      </div>
    </section>
  )
}

function trendX(index, count) { return 8 + index * (584 / Math.max(1, count - 1)) }
function trendY(value, max) { return 124 - (value / max) * 96 }
function trendPoints(values, max) { return values.map((value, index) => `${trendX(index, values.length)},${trendY(value, max)}`).join(' ') }
