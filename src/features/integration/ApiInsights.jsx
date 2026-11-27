import { ArrowDownRight, ArrowUpRight, BarChart3, Boxes, CalendarDays, Check, CircleHelp, Lightbulb, Sparkles, TrendingDown, TrendingUp } from 'lucide-react'
import { MarketplaceLogo } from '@/shared/components/MarketplaceLogo'
import styles from './InsightsDemo.module.css'

const forecast = [
  { day: 'Hôm nay', demand: 18, stock: 42 }, { day: 'Thứ Bảy', demand: 22, stock: 37 },
  { day: 'Chủ nhật', demand: 25, stock: 32 }, { day: 'Thứ Hai', demand: 17, stock: 28 },
  { day: 'Thứ Ba', demand: 20, stock: 24 }, { day: 'Thứ Tư', demand: 24, stock: 19 },
  { day: 'Thứ Năm', demand: 28, stock: 13 },
]
const risks = [
  { name: 'Túi tote Everyday · Màu tự nhiên', sku: 'ET-NT-01', stock: 42, days: 1.9, level: 'Cần xử lý', severity: 'urgent' },
  { name: 'Ly gốm · Màu cát', sku: 'CM-SD-02', stock: 58, days: 3.1, level: 'Theo dõi', severity: 'watch' },
  { name: 'Vỏ gối linen · Xanh olive', sku: 'LC-OL-04', stock: 91, days: 7.0, level: 'Đủ hàng', severity: 'covered' },
]

export default function ApiInsights() {
  return <div className={styles.page}>
    <div className={styles.pageHeading}>
      <div><span className={styles.eyebrow}><Sparkles size={14} /> TRỢ LÝ PHÂN TÍCH KINH DOANH</span><h2>Chọn bước tiếp theo dựa trên dữ liệu.</h2><p>Dự báo nhu cầu và gợi ý hành động cho các gian hàng của bạn.</p></div>
      <span className={styles.demoPill}><span />Bản minh họa</span>
    </div>

    <section className={styles.hero} aria-label="AI advisor overview">
      <div className={styles.heroCopy}><span className={styles.heroEyebrow}><Lightbulb size={15} /> TÍN HIỆU TUẦN NÀY</span><h3>Tránh hết hàng với mẫu túi tote bán chạy.</h3><p>Nếu tốc độ bán gần đây tiếp tục, lượng hàng trên các kênh có thể chỉ còn đủ khoảng 2 ngày. Hãy kiểm tra kế hoạch nhập thêm hoặc điều chỉnh lượng phân bổ trước cuối tuần.</p><div className={styles.heroMeta}><span><Boxes size={14} /> ET-NT-01 · Túi tote Everyday · Màu tự nhiên</span><span><CalendarDays size={14} /> Dự báo 7 ngày</span></div></div>
      <div className={styles.heroStat}><span>Số ngày hàng còn đủ</span><strong>1,9 <small>ngày</small></strong><span className={styles.urgent}><TrendingDown size={14} /> Thấp hơn ngưỡng 3 ngày</span></div>
      <div className={styles.heroArt} aria-hidden="true"><div className={styles.orbit}><Sparkles size={24} /></div><span className={styles.artDot} /></div>
    </section>

    <div className={styles.sectionTitle}><div><h3>Dự báo nhu cầu</h3><p>Dự báo minh họa theo ngày · số lượng trên cả hai kênh</p></div><span className={styles.countPill}>7 ngày tới</span></div>
    <section className={styles.forecastCard}>
      <div className={styles.chartLegend}><span><i className={styles.demandDot} />Nhu cầu ước tính</span><span><i className={styles.stockDot} />Tồn kho khả dụng</span><span className={styles.chartNote}>Dự báo mẫu, chưa kiểm chứng</span></div>
      <div className={styles.chart} role="img" aria-label="Dự báo nhu cầu minh họa trong 7 ngày, khoảng 17 đến 28 sản phẩm mỗi ngày. Tồn kho khả dụng dự kiến giảm từ 42 còn 13 sản phẩm.">
        <div className={styles.axis}><span>60</span><span>40</span><span>20</span><span>0</span></div>
        {forecast.map((point, index) => <div className={styles.chartColumn} key={point.day}><div className={styles.barGroup}><span className={styles.demandBar} style={{ height: `${point.demand / 60 * 100}%` }} title={`Nhu cầu ước tính ${point.demand} sản phẩm`} /><span className={styles.stockBar} style={{ height: `${point.stock / 60 * 100}%` }} title={`Tồn kho khả dụng ${point.stock} sản phẩm`} /></div><span className={styles.day}>{point.day}</span>{index === 0 && <span className={styles.todayMark}>HIỆN TẠI</span>}</div>)}
      </div>
      <div className={styles.chartFoot}><span><CircleHelp size={14} />Giả định tốc độ đơn gần đây tiếp tục; chưa có thời gian nhập hàng hoặc đơn mua đang về.</span><span>Kịch bản mẫu · 27/11/2026</span></div>
    </section>

    <div className={styles.lowerGrid}>
      <section className={styles.card}>
        <div className={styles.sectionTitle}><div><h3>Sản phẩm cần theo dõi tồn kho</h3><p>Số ngày đủ hàng theo tốc độ bán mẫu</p></div><span className={styles.countPill}>3 SKU</span></div>
        <div className={styles.riskList}>{risks.map(item => <article className={styles.riskRow} key={item.sku}>
          <span className={`${styles.riskIcon} ${item.severity === 'urgent' ? styles.riskUrgent : item.severity === 'watch' ? styles.riskWatch : ''}`}><Boxes size={17} /></span>
          <div className={styles.riskName}><strong>{item.name}</strong><span>{item.sku} · Còn {item.stock} sản phẩm</span></div>
          <div className={styles.riskCover}><strong>{String(item.days).replace('.', ',')} ngày</strong><span>ước tính còn đủ hàng</span></div>
          <span className={`${styles.riskBadge} ${item.severity === 'urgent' ? styles.badgeUrgent : item.severity === 'watch' ? styles.badgeWatch : ''}`}>{item.level}</span>
        </article>)}</div>
        <p className={styles.helper}>Đây là tín hiệu theo tồn kho từng kênh. Bản mẫu chưa tính tồn vật lý dùng chung, hàng đã giữ chỗ, đơn nhập đang về và thời gian giao hàng của nhà cung cấp.</p>
      </section>

      <section className={styles.card}>
        <div className={styles.sectionTitle}><div><h3>Gợi ý bước tiếp theo</h3><p>Đưa bằng chứng, chủ shop quyết định</p></div><span className={styles.aiMark}><Sparkles size={14} />Trợ lý</span></div>
        <div className={styles.recommendation}><span className={styles.recNumber}>01</span><div><strong>Kiểm tra tồn bán được trên từng sàn</strong><p>Xác nhận số lượng túi tote có thể bán trên Shopee và TikTok Shop trước khi chuyển hàng.</p><span className={styles.recSource}><Check size={13} /> Tín hiệu: mẫu còn đủ hàng 1,9 ngày</span></div><ArrowUpRight size={17} /></div>
        <div className={styles.recommendation}><span className={styles.recNumber}>02</span><div><strong>Rà soát thời điểm nhập thêm</strong><p>So sánh thời gian nhà cung cấp giao hàng với nhu cầu cuối tuần. Bản mẫu chưa đề xuất số lượng nhập.</p><span className={styles.recSource}><CircleHelp size={13} /> Cần dữ liệu thời gian giao và đơn mua</span></div><ArrowUpRight size={17} /></div>
        <div className={styles.recommendation}><span className={styles.recNumber}>03</span><div><strong>Cân nhắc ảnh hưởng của khuyến mãi</strong><p>Kiểm tra liệu chương trình sắp tới có thể làm nhu cầu tăng cao hơn mức bán gần đây không.</p><span className={styles.recSource}><BarChart3 size={13} /> Chưa mô hình hóa mức tăng do chiến dịch</span></div><ArrowDownRight size={17} /></div>
      </section>
    </div>

    <section className={styles.aiNote}><span className={styles.aiNoteIcon}><Sparkles size={18} /></span><div><strong>Trợ lý AI dự kiến sẽ hoạt động như thế nào?</strong><p>Dịch vụ phân tích của SmartOmni tính chỉ số và kịch bản dự báo. Một LLM bên thứ ba như Gemini có thể giải thích kết quả, trả lời câu hỏi tiếp theo và so sánh lựa chọn. LLM không tự tính số liệu tài chính, bịa dữ liệu còn thiếu hay tự thay đổi thông tin trên sàn. Trang này dùng nội dung mẫu cố định, không gọi AI hoặc API sàn.</p></div></section>
    <section className={styles.escrowNote}><span className={styles.escrowIcon}><CircleHelp size={18} /></span><div><strong>Dữ liệu quyết toán là một luồng riêng</strong><p>Shopee có API chi tiết escrow theo đơn. TikTok Open API cũng có giao dịch tài chính theo đơn, gồm doanh thu, phí, vận chuyển và hoàn tiền; SmartOmni BE hiện chưa tích hợp luồng giao dịch này. Dữ liệu mẫu chưa phải đối soát thực tế.</p></div><MarketplaceLogo marketplace="shopee" size={20} decorative /><MarketplaceLogo marketplace="tiktok" size={20} decorative /></section>
    <p className={styles.disclaimer}>Chỉ dùng để xem giao diện · Mọi số liệu, dự báo và đề xuất trên trang đều là minh họa. Không đọc dữ liệu từ gian hàng đã kết nối.</p>
  </div>
}
