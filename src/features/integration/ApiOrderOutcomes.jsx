import { useState } from 'react'
import { AlertTriangle, CalendarDays, CircleHelp, PackageX, RotateCcw, ShoppingBag, TrendingDown } from 'lucide-react'
import styles from './InsightsDemo.module.css'

const periods = {
  '7 ngày': {
    label: '21–27 Thg 11, 2026',
    cancelled: { total: 14, rate: '4,9%', shopee: 8, tiktok: 6, topReason: 'Người mua đổi ý', seriesShopee: [1, 2, 1, 0, 2, 1, 1], seriesTiktok: [1, 1, 0, 1, 1, 1, 1] },
    aftersales: { total: 9, rate: '3,3%', shopee: 5, tiktok: 4, refunds: 1250000, topReason: 'Sản phẩm lỗi / hư hỏng', seriesShopee: [0, 1, 1, 0, 1, 1, 1], seriesTiktok: [1, 0, 1, 0, 1, 0, 1] },
    cancelReasons: [
      { label: 'Người mua đổi ý', shopee: 3, tiktok: 2 },
      { label: 'Shop hết hàng', shopee: 2, tiktok: 2 },
      { label: 'Không liên hệ được người mua', shopee: 1, tiktok: 1 },
      { label: 'Vận chuyển / nền tảng hủy', shopee: 1, tiktok: 1 },
      { label: 'Khác / chưa xác định', shopee: 1, tiktok: 0 },
    ],
    returnReasons: [
      { label: 'Sản phẩm lỗi / hư hỏng', shopee: 2, tiktok: 1 },
      { label: 'Không đúng mô tả', shopee: 1, tiktok: 1 },
      { label: 'Giao sai / thiếu sản phẩm', shopee: 1, tiktok: 1 },
      { label: 'Người mua đổi ý / khác', shopee: 1, tiktok: 1 },
    ],
    dates: ['21', '22', '23', '24', '25', '26', '27'],
  },
  '30 ngày': {
    label: '29 Thg 10–27 Thg 11, 2026',
    cancelled: { total: 57, rate: '4,8%', shopee: 31, tiktok: 26, topReason: 'Người mua đổi ý', seriesShopee: [4, 5, 4, 5, 7, 6], seriesTiktok: [4, 4, 5, 3, 5, 5] },
    aftersales: { total: 34, rate: '3,1%', shopee: 19, tiktok: 15, refunds: 5000000, topReason: 'Sản phẩm lỗi / hư hỏng', seriesShopee: [2, 3, 3, 3, 4, 4], seriesTiktok: [2, 2, 2, 3, 3, 3] },
    cancelReasons: [
      { label: 'Người mua đổi ý', shopee: 11, tiktok: 9 },
      { label: 'Shop hết hàng', shopee: 8, tiktok: 7 },
      { label: 'Không liên hệ được người mua', shopee: 5, tiktok: 4 },
      { label: 'Vận chuyển / nền tảng hủy', shopee: 4, tiktok: 4 },
      { label: 'Khác / chưa xác định', shopee: 3, tiktok: 2 },
    ],
    returnReasons: [
      { label: 'Sản phẩm lỗi / hư hỏng', shopee: 7, tiktok: 5 },
      { label: 'Không đúng mô tả', shopee: 5, tiktok: 4 },
      { label: 'Giao sai / thiếu sản phẩm', shopee: 4, tiktok: 3 },
      { label: 'Người mua đổi ý / khác', shopee: 3, tiktok: 3 },
    ],
    dates: ['29/10', '03/11', '08/11', '13/11', '18/11', '23/11'],
  },
}

const number = value => new Intl.NumberFormat('vi-VN').format(value)
const money = value => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value)

export default function ApiOrderOutcomes({ embedded = false, selectedPeriod }) {
  const [localPeriod, setLocalPeriod] = useState('7 ngày')
  const period = selectedPeriod || localPeriod
  const data = periods[period]
  return <div className={`${styles.page} ${embedded ? styles.embeddedOutcomes : ''}`}>
    {!embedded && <div className={styles.pageHeading}>
      <div><span className={styles.eyebrow}><ShoppingBag size={14} /> CHẤT LƯỢNG ĐƠN HÀNG</span><h2>Hủy đơn &amp; trả hàng.</h2><p>Nhìn rõ lý do, theo dõi xu hướng và tìm vấn đề cần xử lý ở từng sàn.</p></div>
      <span className={styles.demoPill}><span />Dữ liệu minh họa</span>
    </div>}

    {!embedded && <div className={styles.toolbar}>
      <div className={styles.periodSwitch} role="group" aria-label="Khoảng thời gian báo cáo">{Object.keys(periods).map(value => <button key={value} aria-pressed={period === value} onClick={() => setLocalPeriod(value)}>{value}</button>)}</div>
      <span className={styles.dateLabel}><CalendarDays size={15} />{data.label}<span>· GMT+7</span></span>
      <span className={styles.sampleStatus}><i />Dữ liệu mẫu</span>
    </div>}

    {!embedded && <div className={styles.metricGrid}>
      <OutcomeMetric icon={PackageX} label="Đơn bị hủy" value={number(data.cancelled.total)} detail={`${data.cancelled.rate} trên tổng đơn đã đặt`} />
      <OutcomeMetric icon={RotateCcw} label="Yêu cầu trả hàng / hoàn tiền" value={number(data.aftersales.total)} detail={`${data.aftersales.rate} trên đơn thành công`} />
      <OutcomeMetric icon={TrendingDown} label="Tiền hoàn đã ghi nhận · mẫu" value={money(data.aftersales.refunds)} detail="Theo yêu cầu hoàn đã xác nhận" />
      <OutcomeMetric icon={AlertTriangle} label="Lý do hủy phổ biến nhất" value={data.cancelled.topReason} detail="Tổng hợp cả hai sàn · dữ liệu mẫu" compact />
    </div>}

    <div className={styles.outcomeReasonGrid}>
      <ReasonPanel title="Vì sao đơn bị hủy?" subtitle={`${number(data.cancelled.total)} đơn · ${data.cancelled.rate} trên số đơn đã đặt`} icon={PackageX} rows={data.cancelReasons} />
      <ReasonPanel title="Vì sao khách yêu cầu trả / hoàn?" subtitle={`${number(data.aftersales.total)} yêu cầu · ${data.aftersales.rate} trên đơn thành công`} icon={RotateCcw} rows={data.returnReasons} />
    </div>

    <section className={styles.outcomeTrendSection}>
      <div className={styles.outcomeSectionHeading}><div><h3>Xu hướng theo ngày</h3><p>So sánh số lượng đơn giữa hai sàn trong cùng kỳ</p></div><span className={styles.legend}><i className={styles.shopeeDot} />Shopee <i className={styles.tiktokDot} />TikTok Shop</span></div>
      <div className={styles.outcomeTrendGrid}>
        <TrendPanel title="Đơn bị hủy" series={data.cancelled} dates={data.dates} />
        <TrendPanel title="Yêu cầu trả / hoàn" series={data.aftersales} dates={data.dates} />
      </div>
    </section>

    <div className={styles.dataDefinition}><CircleHelp size={16} /><p><strong>Cách đọc:</strong> Hủy đơn là đơn dừng trước khi hoàn tất. Trả hàng / hoàn tiền là yêu cầu sau mua; hoàn tiền không phải lúc nào cũng có trả hàng vật lý. Lý do từ từng sàn được nhóm vào danh mục chung; lý do trống hoặc chưa ghép được sẽ nằm ở “Khác / chưa xác định”. Số liệu trên trang là dữ liệu minh họa.</p></div>
  </div>
}

function OutcomeMetric({ icon: Icon, label, value, detail, compact = false }) {
  return <article className={`${styles.metricCard} ${compact ? styles.outcomeMetricCompact : ''}`}><span className={styles.metricLabel}>{label}</span><strong>{value}</strong><span className={styles.metricFoot}>{detail}</span><span className={styles.metricIcon}><Icon size={18} /></span></article>
}

function ReasonPanel({ title, subtitle, icon: Icon, rows }) {
  const max = Math.max(...rows.flatMap(row => [row.shopee, row.tiktok]))
  return <section className={styles.card}>
    <div className={styles.outcomeSectionHeading}><div><h3>{title}</h3><p>{subtitle}</p></div><span className={styles.outcomePanelIcon}><Icon size={17} /></span></div>
    <div className={styles.reasonLegend}><span /><span><i className={styles.shopeeDot} />Shopee</span><span><i className={styles.tiktokDot} />TikTok</span></div>
    <div className={styles.reasonList}>{rows.map(row => <div className={styles.reasonRow} key={row.label}>
      <strong>{row.label}</strong>
      <ReasonBar label="Shopee" count={row.shopee} max={max} platform="shopee" />
      <ReasonBar label="TikTok Shop" count={row.tiktok} max={max} platform="tiktok" />
    </div>)}</div>
    <p className={styles.reasonFoot}>Số lượng theo lý do ghi nhận · kênh được phân biệt bằng màu</p>
  </section>
}

function ReasonBar({ label, count, max, platform }) {
  return <div className={styles.reasonBarLine}><span>{label}</span><div className={styles.reasonBarTrack}><i className={platform === 'shopee' ? styles.reasonShopeeBar : styles.reasonTiktokBar} style={{ width: `${count ? Math.max(7, count / max * 100) : 0}%` }} /></div><strong>{count}</strong></div>
}

function TrendPanel({ title, series, dates }) {
  const maxValue = Math.max(...series.seriesShopee, ...series.seriesTiktok, 1)
  return <section className={styles.outcomeTrendCard}>
    <div className={styles.outcomeTrendHeading}><h4>{title}</h4><span>{number(series.total)} tổng</span></div>
    <div className={styles.outcomeLineChart} role="img" aria-label={`${title}: Shopee ${series.seriesShopee.join(', ')}; TikTok Shop ${series.seriesTiktok.join(', ')}`}>
      <svg viewBox="0 0 600 150" preserveAspectRatio="none" aria-hidden="true">
        {[15, 50, 85, 120].map(y => <line key={y} x1="0" y1={y} x2="600" y2={y} className={styles.outcomeGridLine} />)}
        <polyline points={trendPoints(series.seriesShopee, maxValue)} className={styles.shopeeLine} />
        <polyline points={trendPoints(series.seriesTiktok, maxValue)} className={styles.tiktokLine} />
        {series.seriesShopee.map((value, index) => <g key={index}><circle cx={trendX(index, dates.length)} cy={trendY(value, maxValue)} r="3.5" className={styles.shopeePoint} /><circle cx={trendX(index, dates.length)} cy={trendY(series.seriesTiktok[index], maxValue)} r="3.5" className={styles.tiktokPoint} /></g>)}
      </svg>
      <div className={styles.outcomeChartDates} style={{ gridTemplateColumns: `repeat(${dates.length}, minmax(0, 1fr))` }}>{dates.map(date => <span key={date}>{date}</span>)}</div>
    </div>
  </section>
}

function trendX(index, count) { return 8 + index * (584 / Math.max(1, count - 1)) }
function trendY(value, max) { return 124 - (value / max) * 96 }
function trendPoints(values, max) { return values.map((value, index) => `${trendX(index, values.length)},${trendY(value, max)}`).join(' ') }
