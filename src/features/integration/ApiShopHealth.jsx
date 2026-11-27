import { useState } from 'react'
import { Activity, AlertTriangle, CalendarDays, CircleHelp, Clock3, PackageCheck, ShieldAlert, TrendingDown } from 'lucide-react'
import { MarketplaceLogo } from '@/shared/components/MarketplaceLogo'
import ApiOrderOutcomes from './ApiOrderOutcomes'
import styles from './InsightsDemo.module.css'

const periods = {
  '7 ngày': {
    label: '21–27 Thg 11, 2026',
    shopee: { late: 11, checked: 162, lateRate: 6.8, nfr: 3, dueSoon: 3, periodLabel: '7 ngày gần nhất' },
    tiktok: { lateDispatch: 8, checked: 148, lateRate: 5.4, lateCollection: 4, collectionChecked: 148, collectionRate: 2.7, sfcr: 2.1, sfcrOrders: 3, dueSoon: 4 },
  },
  '30 ngày': {
    label: '29 Thg 10–27 Thg 11, 2026',
    shopee: { late: 27, checked: 365, lateRate: 7.4, nfr: 9, dueSoon: 5, periodLabel: '30 ngày gần nhất' },
    tiktok: { lateDispatch: 8, checked: 148, lateRate: 5.4, lateCollection: 4, collectionChecked: 148, collectionRate: 2.7, sfcr: 2.1, sfcrOrders: 3, dueSoon: 6 },
  },
}

const number = value => new Intl.NumberFormat('vi-VN').format(value)
const percent = value => `${value.toFixed(1).replace('.', ',')}%`

export default function ApiShopHealth() {
  const [period, setPeriod] = useState('7 ngày')
  const data = periods[period]
  const totalDueSoon = data.shopee.dueSoon + data.tiktok.dueSoon
  return <div className={`${styles.page} ${styles.shopHealthPage}`}>
    <div className={styles.pageHeading}>
      <div><span className={styles.eyebrow}><Activity size={14} /> VẬN HÀNH &amp; SỨC KHỎE SHOP</span><h2>Sức khỏe Shop.</h2><p>Nắm bắt chỉ số vận hành, nguy cơ vi phạm và những đơn cần xử lý ở từng sàn.</p></div>
      <span className={styles.demoPill}><span />Bản demo · dữ liệu minh họa</span>
    </div>

    <div className={styles.toolbar}>
      <div className={styles.periodSwitch} role="group" aria-label="Khoảng thời gian báo cáo">{Object.keys(periods).map(value => <button key={value} aria-pressed={period === value} onClick={() => setPeriod(value)}>{value}</button>)}</div>
      <span className={styles.dateLabel}><CalendarDays size={15} />{data.label}<span>· GMT+7</span></span>
      {period === '30 ngày' && <span className={styles.periodHint}>LDR TikTok luôn dùng cửa sổ 7 ngày theo định nghĩa của sàn</span>}
    </div>

    <div className={styles.metricGrid}>
      <HealthMetric icon={ShieldAlert} label="Điểm Sao Quả Tạ · Shopee" value="2 điểm" detail="Cộng dồn trong quý · sự kiện minh họa có ngày bên dưới" />
      <HealthMetric icon={TrendingDown} label={`Tỷ lệ giao trễ (LSR) · ${period}`} value={percent(data.shopee.lateRate)} detail="Mục tiêu chung: dưới 10% · 7 ngày gần nhất" />
      <HealthMetric icon={Clock3} label="Tỷ lệ gửi hàng muộn (LDR) · TikTok" value={percent(data.tiktok.lateRate)} detail="Mục tiêu: dưới 4% · 7 ngày · trên ngưỡng" attention />
      <HealthMetric icon={AlertTriangle} label="Đơn gần đến hạn xử lý" value={number(totalDueSoon)} detail="Shopee và TikTok Shop · dữ liệu minh họa" attention />
    </div>

    <div className={styles.shopHealthGrid}>
      <ShopeeHealthCard data={data.shopee} />
      <TiktokHealthCard data={data.tiktok} />
    </div>

    <section className={styles.outcomeTrendSection}>
      <div className={styles.outcomeSectionHeading}><div><span className={styles.eyebrow}><PackageCheck size={13} /> CHẤT LƯỢNG ĐƠN HÀNG</span><h3>Hủy &amp; Hoàn</h3><p>Phân tích lý do đơn bị hủy và yêu cầu trả hàng / hoàn tiền.</p></div></div>
      <ApiOrderOutcomes embedded selectedPeriod={period} />
    </section>

    <div className={styles.dataDefinition}><CircleHelp size={16} /><p><strong>Cách đọc số liệu:</strong> Tất cả số hiện tại là dữ liệu minh họa. LSR Shopee và LDR/SFCR TikTok dùng cửa sổ 7 ngày; điểm Sao Quả Tạ là lịch sử cộng dồn theo quý nên có ngày phát sinh riêng. TikTok tính LDR theo trạng thái “Đã gửi” trước hạn LDR; các mốc RTS / hãng vận chuyển nhận hàng trong API chỉ dùng làm chẩn đoán theo đơn, không được gọi là LDR chính thức khi chưa khớp quy tắc của sàn.</p></div>
  </div>
}

function HealthMetric({ icon: Icon, label, value, detail, attention = false }) {
  return <article className={`${styles.metricCard} ${attention ? styles.healthMetricAttention : ''}`}><span className={styles.metricLabel}>{label}</span><strong>{value}</strong><span className={styles.metricFoot}>{detail}</span><span className={styles.metricIcon}><Icon size={18} /></span></article>
}

function ShopeeHealthCard({ data }) {
  const nfrRate = data.nfr / data.checked * 100
  return <section className={`${styles.card} ${styles.healthPlatformCard} ${styles.healthShopee}`}>
    <div className={styles.healthPlatformHeader}><div><MarketplaceLogo marketplace="shopee" size={29} decorative /><div><span>SỨC KHỎE SÀN</span><h3>Shopee</h3></div></div><span className={styles.healthPeriodPill}>{data.periodLabel}</span></div>
    <div className={styles.penaltySummary}><div><span>Điểm Sao Quả Tạ · cộng dồn quý</span><strong>2<small> điểm</small></strong></div><span className={styles.penaltyStatus}><i />Lịch sử minh họa</span></div>
    <div className={styles.penaltyBreakdown}>
      <span><i />03–09/11 · 1 điểm giao trễ</span><span><i />10–16/11 · 1 điểm NFR</span>
      <span className={styles.penaltyCycle}>Ngày và lý do chỉ để minh họa; đối chiếu lịch sử vi phạm từ Shopee khi kết nối API.</span>
    </div>
    <div className={styles.healthDivider} />
    <HealthRate label="Tỷ lệ giao trễ (LSR)" value={percent(data.lateRate)} target="Mục tiêu <10%" count={`${number(data.late)} / ${number(data.checked)} đơn · 7 ngày`} width={data.lateRate * 5} platform="shopee" />
    <HealthRate label="Tỷ lệ đơn không hoàn tất (NFR)" value={percent(nfrRate)} target="Mục tiêu <10%" count={`${number(data.nfr)} / ${number(data.checked)} đơn lỗi người bán · minh họa`} width={nfrRate * 5} platform="shopee" />
    <div className={styles.lateOrdersCallout}><Clock3 size={16} /><span><strong>{number(data.dueSoon)} đơn cần chú ý</strong><small>Đơn trễ hạn hoặc gần đến hạn gửi hàng · dữ liệu minh họa</small></span></div>
    <p className={styles.healthFootnote}>Chỉ tiêu Shopee Mall về giao nhanh và phản hồi chat cần hiển thị riêng theo hạng shop, không áp làm ngưỡng chung.</p>
  </section>
}

function TiktokHealthCard({ data }) {
  return <section className={`${styles.card} ${styles.healthPlatformCard} ${styles.healthTiktok}`}>
    <div className={styles.healthPlatformHeader}><div><MarketplaceLogo marketplace="tiktok" size={29} decorative /><div><span>SỨC KHỎE SÀN</span><h3>TikTok Shop</h3></div></div><span className={styles.healthPeriodPill}>Cửa sổ 7 ngày</span></div>
    <div className={`${styles.healthRateHero} ${styles.healthRateHeroWarning}`}><div><span>Tỷ lệ gửi hàng muộn (LDR)</span><strong>{percent(data.lateRate)}</strong></div><span>Mục tiêu<br /><b>&lt; 4%</b></span></div>
    <HealthRate label="LDR · tỷ lệ đơn quá hạn gửi" value={percent(data.lateRate)} target="TikTok VN · 7 ngày" count={`${number(data.lateDispatch)} / ${number(data.checked)} đơn · dữ liệu minh họa`} width={data.lateRate * 5} platform="tiktok" warning={data.lateRate >= 4} />
    <HealthRate label="Tỷ lệ hủy do lỗi người bán (SFCR)" value={percent(data.sfcr)} target="Mục tiêu <2,5%" count={`${number(data.sfcrOrders)} đơn lỗi người bán · 7 ngày · minh họa`} width={data.sfcr * 5} platform="tiktok" />
    <div className={styles.healthDivider} />
    <HealthRate label="Trễ mốc hãng vận chuyển nhận hàng" value={percent(data.collectionRate)} target="Chẩn đoán SmartOmni · không phải LDR" count={`${number(data.lateCollection)} / ${number(data.collectionChecked)} đơn · minh họa`} width={data.collectionRate * 5} platform="tiktok" />
    <div className={styles.lateOrdersCallout}><Clock3 size={16} /><span><strong>{number(data.dueSoon)} đơn gần hạn SLA</strong><small>Hạn gửi / hạn hãng vận chuyển nhận hàng · minh họa</small></span></div>
    <p className={styles.healthFootnote}>LDR chính thức dựa trên hạn “Đã gửi”. RTS và TTS là các mốc SLA riêng trong Order API; cần ánh xạ trạng thái trước khi tính thay cho số liệu Seller Center.</p>
  </section>
}

function HealthRate({ label, value, target, count, width, platform, warning = false }) {
  return <div className={`${styles.healthRateRow} ${warning ? styles.healthRateWarning : ''}`}><div className={styles.healthRateHeading}><strong>{label}</strong><span>{value}</span></div><div className={styles.healthRateTrack}><i className={platform === 'shopee' ? styles.healthShopeeBar : styles.healthTiktokBar} style={{ width: `${Math.min(100, Math.max(3, width))}%` }} /></div><div className={styles.healthRateMeta}><small>{count}</small><span>{target}</span></div></div>
}
