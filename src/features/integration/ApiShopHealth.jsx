import { useEffect, useState } from 'react'
import { Activity, AlertTriangle, CalendarDays, Clock3, PackageCheck, RefreshCw, ShieldAlert, TrendingDown } from 'lucide-react'
import { MarketplaceLogo } from '@/shared/components/MarketplaceLogo'
import { insightsApi } from '@/services/api/insights'
import ApiOrderOutcomes from './ApiOrderOutcomes'
import MetricInfoHint from './MetricInfoHint'
import styles from './InsightsDemo.module.css'

const HINTS = {
  shopeePenalty: {
    title: 'Điểm Sao Quả Tạ · Shopee',
    definition: 'Điểm phạt tích lũy khi shop vi phạm chỉ số vận hành, đăng bán hoặc CSKH.',
    formula: 'Cộng dồn trong quý; từ 3 điểm trở lên bắt đầu bị hạn chế đặc quyền (7 / 14 / 28 ngày).',
    period: 'Cộng dồn trong quý hiện tại · cập nhật thứ Hai hàng tuần, reset cuối quý.',
    source: 'Shopee AccountHealth API (get_penalty_point_history).',
  },
  shopeeLsr: {
    title: 'Tỷ lệ giao hàng trễ (LSR) · Shopee',
    definition: 'Phần trăm đơn bàn giao cho đơn vị vận chuyển sau hạn ship_by_date.',
    formula: 'Đơn giao trễ / Tổng đơn đã giao trong kỳ đánh giá. Mục tiêu Shopee: < 10%.',
    period: 'Tuần đánh giá gần nhất (T2–CN) · Shopee không hỗ trợ lọc 7/30 ngày.',
    source: 'Shopee AccountHealth API (get_shop_performance · metric_id = 1).',
  },
  shopeeNfr: {
    title: 'Tỷ lệ đơn không hoàn tất (NFR) · Shopee',
    definition: 'Phần trăm đơn bị hủy hoặc trả hàng/hoàn tiền phát sinh do lỗi người bán.',
    formula: 'Đơn lỗi người bán / (Đơn thành công + Đơn lỗi người bán). Mục tiêu: < 10% (khuyến nghị < 2%).',
    period: 'Tuần đánh giá gần nhất (T2–CN) · cập nhật thứ Hai hàng tuần.',
    source: 'Shopee AccountHealth API (get_shop_performance · metric_id = 3).',
  },
  tiktokLdr: {
    title: 'Tỷ lệ gửi hàng muộn (LDR) · TikTok Shop',
    definition: 'Phần trăm đơn chưa chuyển sang trạng thái Đã gửi trước hạn bàn giao của sàn.',
    formula: '(Đơn gửi muộn + Đơn quá hạn chưa gửi) / Tổng đơn hợp lệ. Mục tiêu TikTok VN: < 4%.',
    period: '7 ngày theo lịch gần nhất.',
    source: 'Ước tính từ TikTok Order API (rts_time so với rts_sla_time); không phải số chính thức Seller Center.',
  },
  tiktokSfcr: {
    title: 'Tỷ lệ hủy lỗi người bán (SFCR) · TikTok Shop',
    definition: 'Phần trăm đơn bị shop hủy hoặc hệ thống tự hủy do quá hạn chuẩn bị hàng.',
    formula: 'Đơn hủy lỗi người bán / Tổng đơn đặt trong 7 ngày. Mục tiêu TikTok VN: < 2,5%.',
    period: '7 ngày theo lịch gần nhất.',
    source: 'Ước tính từ TikTok Order & Cancellation API (cancellation_initiator = SELLER/SYSTEM).',
  },
  tiktokCollection: {
    title: 'Trễ mốc hãng vận chuyển nhận hàng · TikTok Shop',
    definition: 'Chẩn đoán nội bộ các đơn được hãng vận chuyển lấy hàng sau hạn collection_due_time / tts_sla_time.',
    formula: 'Đơn có collection_time > collection_due_time trên tổng đơn trong cửa sổ 7 ngày.',
    period: '7 ngày theo lịch gần nhất.',
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

const number = value => new Intl.NumberFormat('vi-VN').format(Number(value || 0))
const percent = value => (value == null ? '—' : `${Number(value).toFixed(1).replace('.', ',')}%`)

function penaltyTone(points) {
  if (points == null) return null
  if (points <= 0) return 'healthy'
  if (points <= 2) return 'warning'
  return 'danger'
}

function rateTone(value, target) {
  if (value == null || Number.isNaN(Number(value))) return null
  const num = Number(value)
  const limit = Number(target || 10)
  if (num >= limit) return 'danger'
  if (num >= limit * 0.6) return 'warning'
  return 'healthy'
}

function formatVnDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatEpochDay(epochSec) {
  if (!epochSec) return ''
  return new Date(epochSec * 1000).toLocaleDateString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
  })
}

export default function ApiShopHealth() {
  const [reloadTick, setReloadTick] = useState(0)
  const [state, setState] = useState({ loading: true, error: '', data: null })

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    insightsApi.health(controller.signal)
      .then(data => {
        if (active) setState({ loading: false, error: '', data })
      })
      .catch(err => {
        if (active && err?.name !== 'CanceledError' && err?.code !== 'ERR_CANCELED') {
          setState(prev => ({ ...prev, loading: false, error: err?.message || 'Không thể tải dữ liệu sức khỏe shop.' }))
        }
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [reloadTick])

  const data = state.data
  const shopee = data?.shopee
  const tiktok = data?.tiktok
  const shopeeAvailable = shopee?.state === 'AVAILABLE'
  const tiktokAvailable = tiktok?.connected && tiktok?.state !== 'UNAVAILABLE'

  return (
    <div className={`${styles.page} ${styles.shopHealthPage}`}>
      <div className={styles.pageHeading}>
        <div>
          <span className={styles.eyebrow}><Activity size={14} /> VẬN HÀNH &amp; SỨC KHỎE SHOP</span>
          <p>Nắm bắt chỉ số vận hành, nguy cơ vi phạm và những đơn cần xử lý theo đúng chu kỳ từng sàn.</p>
        </div>
        <button
          type="button"
          className={styles.advisorGenerateButton}
          style={{ padding: '6px 12px', fontSize: 12 }}
          disabled={state.loading}
          onClick={() => {
            setState(prev => ({ ...prev, loading: true, error: '' }))
            setReloadTick(t => t + 1)
          }}
        >
          <RefreshCw size={14} className={state.loading ? styles.advisorSpin : ''} /> Làm mới
        </button>
      </div>

      <div className={styles.toolbar}>
        <span className={styles.dateLabel}>
          <CalendarDays size={15} />
          {data ? `Cập nhật lúc ${formatVnDate(data.updatedAt)}` : 'Đang đồng bộ...'}
          <span>· GMT+7</span>
        </span>
        <span className={styles.periodHint}>Chỉ số tuân thủ hiển thị theo chu kỳ cố định của Shopee &amp; TikTok Shop; di chuột hoặc bấm vào (?) để xem chi tiết.</span>
      </div>

      {state.error && (
        <div className={styles.historyRangeNotice}>{state.error}</div>
      )}

      {state.loading && !data ? (
        <div className={styles.card}><p>Đang tổng hợp dữ liệu sức khỏe shop từ các kênh…</p></div>
      ) : data && (
        <>
          <div className={styles.metricGrid}>
            <HealthMetric
              icon={ShieldAlert}
              label="Điểm Sao Quả Tạ · Shopee"
              value={shopeeAvailable && shopee.penaltyPoints != null ? `${number(shopee.penaltyPoints)} điểm` : '—'}
              detail={shopeeAvailable ? `${shopee.quarterLabel} · tích lũy theo quý` : (shopee?.unavailableReason || 'Chưa có dữ liệu từ Shopee')}
              hint={HINTS.shopeePenalty}
              tone={shopeeAvailable ? penaltyTone(shopee.penaltyPoints) : null}
            />
            <HealthMetric
              icon={TrendingDown}
              label="Tỷ lệ giao trễ (LSR) · Shopee"
              value={shopeeAvailable ? percent(shopee.lsr?.currentPeriod) : '—'}
              detail={shopeeAvailable ? `${shopee.weekLabel} · mục tiêu <10%` : 'Không lấy được dữ liệu từ Shopee'}
              hint={HINTS.shopeeLsr}
              tone={shopeeAvailable ? rateTone(shopee.lsr?.currentPeriod, shopee.lsr?.targetValue ?? 10) : null}
            />
            <HealthMetric
              icon={Clock3}
              label="Tỷ lệ gửi hàng muộn (LDR) · TikTok"
              value={tiktokAvailable ? percent(tiktok.estimatedLdr) : '—'}
              detail={tiktokAvailable ? `${tiktok.windowLabel} · ước tính · mục tiêu <4%` : (tiktok?.unavailableReason || 'Chưa kết nối TikTok Shop')}
              hint={HINTS.tiktokLdr}
              tone={tiktokAvailable ? rateTone(tiktok.estimatedLdr, 4) : null}
            />
            <HealthMetric
              icon={AlertTriangle}
              label="Đơn gần đến hạn xử lý"
              value={number(data.totalDueSoon)}
              detail={`Hiện tại · Shopee ${number(shopee?.dueSoon)} · TikTok ${number(tiktok?.dueSoon)}`}
              hint={HINTS.dueSoon}
              hintAlign="right"
              attention={data.totalDueSoon > 0}
            />
          </div>

          <div className={styles.shopHealthGrid}>
            <ShopeeHealthCard data={shopee} />
            <TiktokHealthCard data={tiktok} />
          </div>
        </>
      )}

      <section className={styles.outcomeTrendSection}>
        <div className={styles.outcomeSectionHeading}>
          <div>
            <span className={styles.eyebrow}><PackageCheck size={13} /> CHẤT LƯỢNG ĐƠN HÀNG</span>
            <h3>Hủy &amp; Hoàn</h3>
            <p>Thống kê lý do đơn bị hủy và yêu cầu trả hàng / hoàn tiền theo khoảng thời gian chọn.</p>
          </div>
        </div>
        <ApiOrderOutcomes embedded />
      </section>
    </div>
  )
}

function HealthMetric({ icon: Icon, label, value, detail, hint, hintAlign = 'left', attention = false, tone = null }) {
  const toneClass = tone === 'healthy'
    ? styles.healthMetricHealthy
    : tone === 'warning'
      ? styles.healthMetricWarning
      : tone === 'danger'
        ? styles.healthMetricDanger
        : (attention ? styles.healthMetricAttention : '')
  return (
    <article className={`${styles.metricCard} ${toneClass}`}>
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
  const available = data?.state === 'AVAILABLE'
  const lsrVal = Number(data?.lsr?.currentPeriod ?? 0)
  const nfrVal = Number(data?.nfr?.currentPeriod ?? 0)
  const pTone = available ? penaltyTone(data?.penaltyPoints) : null
  const penaltyToneClass = pTone === 'healthy'
    ? styles.penaltyHealthy
    : pTone === 'warning'
      ? styles.penaltyWarning
      : pTone === 'danger'
        ? styles.penaltyDanger
        : ''

  return (
    <section className={`${styles.card} ${styles.healthPlatformCard} ${styles.healthShopee}`}>
      <div className={styles.healthPlatformHeader}>
        <div>
          <MarketplaceLogo marketplace="shopee" size={29} decorative />
          <div><span>SỨC KHỎE SÀN</span><h3>Shopee</h3></div>
        </div>
        <span className={styles.healthPeriodPill}>{data?.weekLabel || 'Tuần đánh giá gần nhất'}</span>
      </div>

      {!available ? (
        <div className={styles.healthStateNotice}>
          <strong>Chỉ số Shopee không khả dụng</strong>
          {data?.unavailableReason || 'Chưa lấy được dữ liệu AccountHealth từ Shopee.'}
        </div>
      ) : (
        <>
          <div className={`${styles.penaltySummary} ${penaltyToneClass}`}>
            <div>
              <span className={styles.metricLabel}>
                Điểm Sao Quả Tạ · {data.quarterLabel}
                <MetricInfoHint {...HINTS.shopeePenalty} />
              </span>
              <strong>{number(data.penaltyPoints)}<small> điểm</small></strong>
            </div>
            <span className={styles.penaltyStatus}>
              <i />
              {data.ongoingPunishments?.length > 0 ? `${data.ongoingPunishments.length} hạn chế đang áp dụng` : 'Không có hạn chế'}
            </span>
          </div>
          <div className={styles.penaltyBreakdown}>
            {data.penaltyEvents?.length > 0 ? (
              data.penaltyEvents.slice(0, 4).map(ev => (
                <span key={ev.referenceId}>
                  <i />{formatEpochDay(ev.issueTimeEpochSec)} · {ev.points} điểm ({ev.label})
                </span>
              ))
            ) : (
              <span className={styles.penaltyCycle}>Chưa ghi nhận điểm phạt Sao Quả Tạ trong quý này.</span>
            )}
          </div>
          <div className={styles.healthDivider} />
          <HealthRate
            label="Tỷ lệ giao trễ (LSR)"
            value={percent(data.lsr?.currentPeriod)}
            target={`Mục tiêu ${data.lsr?.targetComparator || '<'}${number(data.lsr?.targetValue ?? 10)}%`}
            count={[
              data.lsr?.affectedCount != null ? `${number(data.lsr.affectedCount)} đơn giao trễ` : null,
              data.lsr?.lastPeriod != null ? `kỳ trước ${percent(data.lsr.lastPeriod)}` : null,
            ].filter(Boolean).join(' · ') || 'Số liệu chính thức từ Shopee'}
            width={lsrVal * 5}
            platform="shopee"
            tone={rateTone(data.lsr?.currentPeriod, data.lsr?.targetValue ?? 10)}
            hint={HINTS.shopeeLsr}
          />
          <HealthRate
            label="Tỷ lệ đơn không hoàn tất (NFR)"
            value={percent(data.nfr?.currentPeriod)}
            target={`Mục tiêu ${data.nfr?.targetComparator || '<'}${number(data.nfr?.targetValue ?? 10)}%`}
            count={[
              data.nfr?.affectedCount != null ? `${number(data.nfr.affectedCount)} đơn lỗi người bán` : null,
              data.nfr?.lastPeriod != null ? `kỳ trước ${percent(data.nfr.lastPeriod)}` : null,
            ].filter(Boolean).join(' · ') || 'Số liệu chính thức từ Shopee'}
            width={nfrVal * 5}
            platform="shopee"
            tone={rateTone(data.nfr?.currentPeriod, data.nfr?.targetValue ?? 10)}
            hint={HINTS.shopeeNfr}
          />
        </>
      )}

      <div className={`${styles.lateOrdersCallout} ${(data?.dueSoon ?? 0) > 0 ? styles.lateOrdersCalloutWarning : ''}`}>
        <Clock3 size={16} />
        <span>
          <strong>{number(data?.dueSoon)} đơn cần chú ý · Hiện tại</strong>
          <small>
            {available && data?.lateOrdersCount > 0
              ? `${number(data.lateOrdersCount)} đơn quá hạn từ Shopee · theo dõi sát sla_deadline`
              : 'Đơn trễ hạn hoặc gần đến hạn gửi hàng (24 giờ tới)'}
          </small>
        </span>
      </div>
    </section>
  )
}

function TiktokHealthCard({ data }) {
  const connected = data?.connected && data?.state !== 'UNAVAILABLE'
  const ldrVal = Number(data?.estimatedLdr ?? 0)
  const sfcrVal = Number(data?.estimatedSfcr ?? 0)
  const colVal = Number(data?.collectionDelayRate ?? 0)

  const ldrTone = connected ? rateTone(data.estimatedLdr, 4) : null
  const heroToneClass = ldrTone === 'danger'
    ? styles.healthRateHeroWarning
    : ldrTone === 'warning'
      ? styles.healthRateHeroCaution
      : ldrTone === 'healthy'
        ? styles.healthRateHeroHealthy
        : ''

  return (
    <section className={`${styles.card} ${styles.healthPlatformCard} ${styles.healthTiktok}`}>
      <div className={styles.healthPlatformHeader}>
        <div>
          <MarketplaceLogo marketplace="tiktok" size={29} decorative />
          <div><span>SỨC KHỎE SÀN</span><h3>TikTok Shop</h3></div>
        </div>
        <div className={styles.healthHeaderPills}>
          <span className={styles.inlineEstimateBadge}>Ước tính từ Order API</span>
          <span className={styles.healthPeriodPill}>{data?.windowLabel || '7 ngày gần nhất'}</span>
        </div>
      </div>

      {!connected ? (
        <div className={styles.healthStateNotice}>
          <strong>Chưa có dữ liệu TikTok Shop</strong>
          {data?.unavailableReason || 'Chưa kết nối TikTok Shop đang hoạt động.'}
        </div>
      ) : (
        <>
          <div className={`${styles.healthRateHero} ${heroToneClass}`}>
            <div>
              <span className={styles.metricLabel}>
                Tỷ lệ gửi hàng muộn (LDR · ước tính)
                <MetricInfoHint {...HINTS.tiktokLdr} />
              </span>
              <strong>{percent(data.estimatedLdr)}</strong>
            </div>
            <span>Mục tiêu<br /><b>&lt; 4%</b></span>
          </div>
          <HealthRate
            label="LDR · tỷ lệ đơn quá hạn gửi"
            value={percent(data.estimatedLdr)}
            target="TikTok VN · 7 ngày"
            count={`${number(data.lateDispatchCount)} / ${number(data.checkedOrders)} đơn · ước tính từ rts_sla_time`}
            width={ldrVal * 5}
            platform="tiktok"
            tone={ldrTone}
            hint={HINTS.tiktokLdr}
          />
          <HealthRate
            label="Tỷ lệ hủy do lỗi người bán (SFCR)"
            value={data.sfcrState === 'ESTIMATED' ? percent(data.estimatedSfcr) : '—'}
            target="Mục tiêu <2,5%"
            count={data.sfcrState === 'ESTIMATED'
              ? `${number(data.sfcrOrders)} / ${number(data.checkedOrders)} đơn lỗi người bán · 7 ngày`
              : 'Chưa đồng bộ trường cancellation_initiator từ TikTok'}
            width={sfcrVal * 5}
            platform="tiktok"
            tone={data.sfcrState === 'ESTIMATED' ? rateTone(data.estimatedSfcr, 2.5) : null}
            hint={HINTS.tiktokSfcr}
          />
          <div className={styles.healthDivider} />
          <HealthRate
            label="Trễ mốc hãng vận chuyển nhận hàng"
            value={data.collectionDelayState === 'ESTIMATED' ? percent(data.collectionDelayRate) : '—'}
            target="Chẩn đoán SmartOmni · không phải LDR"
            count={data.collectionDelayState === 'ESTIMATED'
              ? `${number(data.lateCollectionCount)} / ${number(data.checkedOrders)} đơn`
              : 'Chưa đồng bộ hạn collection_due_time / tts_sla_time từ TikTok'}
            width={colVal * 5}
            platform="tiktok"
            tone={data.collectionDelayState === 'ESTIMATED' ? rateTone(data.collectionDelayRate, 5) : null}
            hint={HINTS.tiktokCollection}
          />
        </>
      )}

      <div className={`${styles.lateOrdersCallout} ${(data?.dueSoon ?? 0) > 0 ? styles.lateOrdersCalloutWarning : ''}`}>
        <Clock3 size={16} />
        <span>
          <strong>{number(data?.dueSoon)} đơn gần hạn SLA · Hiện tại</strong>
          <small>Hạn gửi hàng (rts_sla_time) trong 24 giờ tới hoặc đã quá hạn</small>
        </span>
      </div>
      <p className={styles.healthFootnote}>LDR chính thức dựa trên hạn “Đã gửi”. TikTok không mở Account Health API công khai nên các tỷ lệ trên là ước tính chẩn đoán từ Order API.</p>
    </section>
  )
}

function HealthRate({ label, value, target, count, width, platform, hint, tone = null, warning = false }) {
  const barWidth = width > 0 ? Math.min(100, Math.max(3, width)) : 0
  const toneClass = tone === 'danger' || warning
    ? styles.healthRateWarning
    : tone === 'warning'
      ? styles.healthRateCaution
      : tone === 'healthy'
        ? styles.healthRateHealthy
        : ''
  return (
    <div className={`${styles.healthRateRow} ${toneClass}`}>
      <div className={styles.healthRateHeading}>
        <strong className={styles.metricLabel}>
          {label}
          {hint && <MetricInfoHint {...hint} />}
        </strong>
        <span>{value}</span>
      </div>
      <div className={styles.healthRateTrack}>
        <i className={platform === 'shopee' ? styles.healthShopeeBar : styles.healthTiktokBar} style={{ width: `${barWidth}%` }} />
      </div>
      <div className={styles.healthRateMeta}>
        <small>{count}</small>
        <span>{target}</span>
      </div>
    </div>
  )
}
