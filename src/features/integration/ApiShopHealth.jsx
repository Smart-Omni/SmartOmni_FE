import { Activity, AlertTriangle, CalendarDays, CircleHelp, Clock3, PackageCheck, ShieldAlert, TrendingDown } from 'lucide-react'
import { MarketplaceLogo } from '@/shared/components/MarketplaceLogo'
import ApiOrderOutcomes from './ApiOrderOutcomes'
import MetricInfoHint from './MetricInfoHint'
import styles from './InsightsDemo.module.css'

const DEMO_HEALTH = {
  updatedAtLabel: '27 Thg 11, 2026',
  shopee: {
    quarterLabel: 'Quý 4/2026 (01/10–31/12)',
    weekLabel: 'Tuần 16–22/11, 2026',
    penaltyPoints: 2,
    lateCount: 11,
    lateRate: 6.8,
    lastLateRate: 7.1,
    nfrCount: 3,
    nfrRate: 1.9,
    lastNfrRate: 2.2,
    dueSoon: 3,
  },
  tiktok: {
    windowLabel: '7 ngày · 21–27/11/2026',
    checked: 148,
    lateDispatch: 8,
    lateRate: 5.4,
    sfcrOrders: 3,
    sfcr: 2.1,
    lateCollection: 4,
    collectionRate: 2.7,
    dueSoon: 4,
  },
}

const HINTS = {
  shopeePenalty: {
    title: 'Điểm Sao Quả Tạ · Shopee',
    definition: 'Điểm phạt tích lũy khi shop vi phạm chỉ số vận hành, đăng bán hoặc CSKH.',
    formula: 'Cộng dồn trong quý; từ 3 điểm trở lên bắt đầu bị hạn chế đặc quyền (7 / 14 / 28 ngày).',
    period: 'Quý 4/2026 (01/10–31/12/2026) · cập nhật thứ Hai hàng tuần, reset cuối quý.',
    source: 'Shopee AccountHealth API (get_penalty_point_history).',
  },
  shopeeLsr: {
    title: 'Tỷ lệ giao hàng trễ (LSR) · Shopee',
    definition: 'Phần trăm đơn bàn giao cho đơn vị vận chuyển sau hạn ship_by_date.',
    formula: 'Đơn giao trễ / Tổng đơn đã giao trong kỳ đánh giá. Mục tiêu Shopee: < 10%.',
    period: 'Tuần đánh giá gần nhất (T2–CN: 16–22/11/2026) · Shopee không hỗ trợ lọc 7/30 ngày.',
    source: 'Shopee AccountHealth API (get_shop_performance · metric_id = 1).',
  },
  shopeeNfr: {
    title: 'Tỷ lệ đơn không hoàn tất (NFR) · Shopee',
    definition: 'Phần trăm đơn bị hủy hoặc trả hàng/hoàn tiền phát sinh do lỗi người bán.',
    formula: 'Đơn lỗi người bán / (Đơn thành công + Đơn lỗi người bán). Mục tiêu: < 10% (khuyến nghị < 2%).',
    period: 'Tuần đánh giá gần nhất (T2–CN: 16–22/11/2026) · cập nhật thứ Hai hàng tuần.',
    source: 'Shopee AccountHealth API (get_shop_performance · metric_id = 3).',
  },
  tiktokLdr: {
    title: 'Tỷ lệ gửi hàng muộn (LDR) · TikTok Shop',
    definition: 'Phần trăm đơn chưa chuyển sang trạng thái Đã gửi trước hạn bàn giao của sàn.',
    formula: '(Đơn gửi muộn + Đơn quá hạn chưa gửi) / Tổng đơn hợp lệ. Mục tiêu TikTok VN: < 4%.',
    period: '7 ngày theo lịch gần nhất (21–27/11/2026).',
    source: 'Ước tính từ TikTok Order API (rts_time so với rts_sla_time); không phải số chính thức Seller Center.',
  },
  tiktokSfcr: {
    title: 'Tỷ lệ hủy lỗi người bán (SFCR) · TikTok Shop',
    definition: 'Phần trăm đơn bị shop hủy hoặc hệ thống tự hủy do quá hạn chuẩn bị hàng.',
    formula: 'Đơn hủy lỗi người bán / Tổng đơn đặt trong 7 ngày. Mục tiêu TikTok VN: < 2,5%.',
    period: '7 ngày theo lịch gần nhất (21–27/11/2026).',
    source: 'Ước tính từ TikTok Order & Cancellation API (cancellation_initiator = SELLER/SYSTEM).',
  },
  tiktokCollection: {
    title: 'Trễ mốc hãng vận chuyển nhận hàng · TikTok Shop',
    definition: 'Chẩn đoán nội bộ các đơn được hãng vận chuyển lấy hàng sau hạn collection_due_time / tts_sla_time.',
    formula: 'Đơn có collection_time > collection_due_time trên tổng đơn trong cửa sổ 7 ngày.',
    period: '7 ngày theo lịch gần nhất (21–27/11/2026).',
    source: 'Chẩn đoán SmartOmni từ TikTok Order API; chỉ dùng để theo dõi vận hành.',
  },
  dueSoon: {
    title: 'Đơn gần đến hạn xử lý',
    definition: 'Số đơn đang chờ chuẩn bị (TO_SHIP / AWAITING_SHIPMENT) đã quá hạn hoặc sắp đến hạn giao trong 24 giờ.',
    formula: 'Đếm trực tiếp các đơn mở có sla_deadline <= hiện tại + 24 giờ.',
    period: 'Ảnh chụp thời gian thực (Hiện tại) · không phụ thuộc bộ lọc 7 / 30 ngày.',
    source: 'Tổng hợp trực tiếp từ dữ liệu đơn hàng đồng bộ Shopee & TikTok Shop.',
  },
}

const number = value => new Intl.NumberFormat('vi-VN').format(value)
const percent = value => `${value.toFixed(1).replace('.', ',')}%`

export default function ApiShopHealth() {
  const data = DEMO_HEALTH
  const totalDueSoon = data.shopee.dueSoon + data.tiktok.dueSoon

  return (
    <div className={`${styles.page} ${styles.shopHealthPage}`}>
      <div className={styles.pageHeading}>
        <div>
          <span className={styles.eyebrow}><Activity size={14} /> VẬN HÀNH &amp; SỨC KHỎE SHOP</span>
          <h2>Sức khỏe Shop.</h2>
          <p>Nắm bắt chỉ số vận hành, nguy cơ vi phạm và những đơn cần xử lý theo đúng chu kỳ từng sàn.</p>
        </div>
        <span className={styles.demoPill}><span />Bản demo · dữ liệu minh họa</span>
      </div>

      <div className={styles.toolbar}>
        <span className={styles.dateLabel}><CalendarDays size={15} />Cập nhật đến {data.updatedAtLabel}<span>· GMT+7</span></span>
        <span className={styles.periodHint}>Chỉ số tuân thủ hiển thị theo chu kỳ cố định của Shopee &amp; TikTok Shop; di chuột hoặc bấm vào (?) để xem chi tiết.</span>
      </div>

      <div className={styles.metricGrid}>
        <HealthMetric
          icon={ShieldAlert}
          label="Điểm Sao Quả Tạ · Shopee"
          value={`${number(data.shopee.penaltyPoints)} điểm`}
          detail={`${data.shopee.quarterLabel} · tích lũy theo quý`}
          hint={HINTS.shopeePenalty}
        />
        <HealthMetric
          icon={TrendingDown}
          label="Tỷ lệ giao trễ (LSR) · Shopee"
          value={percent(data.shopee.lateRate)}
          detail={`${data.shopee.weekLabel} · mục tiêu <10%`}
          hint={HINTS.shopeeLsr}
        />
        <HealthMetric
          icon={Clock3}
          label="Tỷ lệ gửi hàng muộn (LDR) · TikTok"
          value={percent(data.tiktok.lateRate)}
          detail={`${data.tiktok.windowLabel} · ước tính · mục tiêu <4%`}
          hint={HINTS.tiktokLdr}
          attention
        />
        <HealthMetric
          icon={AlertTriangle}
          label="Đơn gần đến hạn xử lý"
          value={number(totalDueSoon)}
          detail={`Hiện tại · Shopee ${number(data.shopee.dueSoon)} · TikTok ${number(data.tiktok.dueSoon)}`}
          hint={HINTS.dueSoon}
          hintAlign="right"
          attention
        />
      </div>

      <div className={styles.shopHealthGrid}>
        <ShopeeHealthCard data={data.shopee} />
        <TiktokHealthCard data={data.tiktok} />
      </div>

      <section className={styles.outcomeTrendSection}>
        <div className={styles.outcomeSectionHeading}>
          <div>
            <span className={styles.eyebrow}><PackageCheck size={13} /> CHẤT LƯỢNG ĐƠN HÀNG</span>
            <h3>Hủy &amp; Hoàn</h3>
            <p>Phân tích lý do đơn bị hủy và yêu cầu trả hàng / hoàn tiền theo khoảng thời gian chọn.</p>
          </div>
        </div>
        <ApiOrderOutcomes embedded />
      </section>

      <div className={styles.dataDefinition}>
        <CircleHelp size={16} />
        <p>
          <strong>Cách đọc số liệu:</strong> Tất cả số hiện tại là dữ liệu minh họa. Mỗi sàn có chu kỳ tính riêng:
          Shopee LSR/NFR đánh giá theo tuần (T2–CN) và Sao Quả Tạ cộng dồn theo quý; TikTok LDR/SFCR dùng cửa sổ 7 ngày trượt
          và được SmartOmni ước tính từ Order API vì TikTok không mở Account Health API công khai.
        </p>
      </div>
    </div>
  )
}

function HealthMetric({ icon: Icon, label, value, detail, hint, hintAlign = 'left', attention = false }) {
  return (
    <article className={`${styles.metricCard} ${attention ? styles.healthMetricAttention : ''}`}>
      <span className={styles.metricLabel}>
        {label}
        {hint && <MetricInfoHint {...hint} align={hintAlign} />}
      </span>
      <strong>{value}</strong>
      <span className={styles.metricFoot}>{detail}</span>
      <span className={styles.metricIcon}><Icon size={18} /></span>
    </article>
  )
}

function ShopeeHealthCard({ data }) {
  return (
    <section className={`${styles.card} ${styles.healthPlatformCard} ${styles.healthShopee}`}>
      <div className={styles.healthPlatformHeader}>
        <div>
          <MarketplaceLogo marketplace="shopee" size={29} decorative />
          <div><span>SỨC KHỎE SÀN</span><h3>Shopee</h3></div>
        </div>
        <span className={styles.healthPeriodPill}>{data.weekLabel}</span>
      </div>
      <div className={styles.penaltySummary}>
        <div>
          <span className={styles.metricLabel}>
            Điểm Sao Quả Tạ · {data.quarterLabel}
            <MetricInfoHint {...HINTS.shopeePenalty} />
          </span>
          <strong>{number(data.penaltyPoints)}<small> điểm</small></strong>
        </div>
        <span className={styles.penaltyStatus}><i />Lịch sử minh họa</span>
      </div>
      <div className={styles.penaltyBreakdown}>
        <span><i />03–09/11 · 1 điểm giao trễ</span>
        <span><i />10–16/11 · 1 điểm NFR</span>
        <span className={styles.penaltyCycle}>Ngày và lý do chỉ để minh họa; đối chiếu lịch sử vi phạm từ Shopee khi kết nối API.</span>
      </div>
      <div className={styles.healthDivider} />
      <HealthRate
        label="Tỷ lệ giao trễ (LSR)"
        value={percent(data.lateRate)}
        target="Mục tiêu <10%"
        count={`${number(data.lateCount)} đơn giao trễ · kỳ trước ${percent(data.lastLateRate)} · minh họa`}
        width={data.lateRate * 5}
        platform="shopee"
        hint={HINTS.shopeeLsr}
      />
      <HealthRate
        label="Tỷ lệ đơn không hoàn tất (NFR)"
        value={percent(data.nfrRate)}
        target="Mục tiêu <10%"
        count={`${number(data.nfrCount)} đơn lỗi người bán · kỳ trước ${percent(data.lastNfrRate)} · minh họa`}
        width={data.nfrRate * 5}
        platform="shopee"
        hint={HINTS.shopeeNfr}
      />
      <div className={styles.lateOrdersCallout}>
        <Clock3 size={16} />
        <span>
          <strong>{number(data.dueSoon)} đơn cần chú ý · Hiện tại</strong>
          <small>Đơn trễ hạn hoặc gần đến hạn gửi hàng · dữ liệu minh họa</small>
        </span>
      </div>
      <p className={styles.healthFootnote}>Chỉ tiêu Shopee Mall về giao nhanh và phản hồi chat cần hiển thị riêng theo hạng shop, không áp làm ngưỡng chung.</p>
    </section>
  )
}

function TiktokHealthCard({ data }) {
  return (
    <section className={`${styles.card} ${styles.healthPlatformCard} ${styles.healthTiktok}`}>
      <div className={styles.healthPlatformHeader}>
        <div>
          <MarketplaceLogo marketplace="tiktok" size={29} decorative />
          <div><span>SỨC KHỎE SÀN</span><h3>TikTok Shop</h3></div>
        </div>
        <div className={styles.healthHeaderPills}>
          <span className={styles.inlineEstimateBadge}>Ước tính từ Order API</span>
          <span className={styles.healthPeriodPill}>{data.windowLabel}</span>
        </div>
      </div>
      <div className={`${styles.healthRateHero} ${styles.healthRateHeroWarning}`}>
        <div>
          <span className={styles.metricLabel}>
            Tỷ lệ gửi hàng muộn (LDR · ước tính)
            <MetricInfoHint {...HINTS.tiktokLdr} />
          </span>
          <strong>{percent(data.lateRate)}</strong>
        </div>
        <span>Mục tiêu<br /><b>&lt; 4%</b></span>
      </div>
      <HealthRate
        label="LDR · tỷ lệ đơn quá hạn gửi"
        value={percent(data.lateRate)}
        target="TikTok VN · 7 ngày"
        count={`${number(data.lateDispatch)} / ${number(data.checked)} đơn · ước tính minh họa`}
        width={data.lateRate * 5}
        platform="tiktok"
        warning={data.lateRate >= 4}
        hint={HINTS.tiktokLdr}
      />
      <HealthRate
        label="Tỷ lệ hủy do lỗi người bán (SFCR)"
        value={percent(data.sfcr)}
        target="Mục tiêu <2,5%"
        count={`${number(data.sfcrOrders)} / ${number(data.checked)} đơn lỗi người bán · 7 ngày · minh họa`}
        width={data.sfcr * 5}
        platform="tiktok"
        hint={HINTS.tiktokSfcr}
      />
      <div className={styles.healthDivider} />
      <HealthRate
        label="Trễ mốc hãng vận chuyển nhận hàng"
        value={percent(data.collectionRate)}
        target="Chẩn đoán SmartOmni · không phải LDR"
        count={`${number(data.lateCollection)} / ${number(data.checked)} đơn · minh họa`}
        width={data.collectionRate * 5}
        platform="tiktok"
        hint={HINTS.tiktokCollection}
      />
      <div className={styles.lateOrdersCallout}>
        <Clock3 size={16} />
        <span>
          <strong>{number(data.dueSoon)} đơn gần hạn SLA · Hiện tại</strong>
          <small>Hạn gửi / hạn hãng vận chuyển nhận hàng · minh họa</small>
        </span>
      </div>
      <p className={styles.healthFootnote}>LDR chính thức dựa trên hạn “Đã gửi”. TikTok không mở Account Health API công khai nên các tỷ lệ trên là ước tính chẩn đoán từ Order API.</p>
    </section>
  )
}

function HealthRate({ label, value, target, count, width, platform, hint, warning = false }) {
  return (
    <div className={`${styles.healthRateRow} ${warning ? styles.healthRateWarning : ''}`}>
      <div className={styles.healthRateHeading}>
        <strong className={styles.metricLabel}>
          {label}
          {hint && <MetricInfoHint {...hint} />}
        </strong>
        <span>{value}</span>
      </div>
      <div className={styles.healthRateTrack}>
        <i className={platform === 'shopee' ? styles.healthShopeeBar : styles.healthTiktokBar} style={{ width: `${Math.min(100, Math.max(3, width))}%` }} />
      </div>
      <div className={styles.healthRateMeta}>
        <small>{count}</small>
        <span>{target}</span>
      </div>
    </div>
  )
}
