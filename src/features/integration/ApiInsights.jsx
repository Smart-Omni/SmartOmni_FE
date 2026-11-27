import { useMemo, useState } from 'react'
import { AlertTriangle, ArrowUpRight, Boxes, CalendarDays, Check, ChevronDown, CircleHelp, Clock3, Lightbulb, MessageCircle, PackageCheck, Send, ShieldCheck, ShoppingBag, Sparkles, TrendingUp } from 'lucide-react'
import { MarketplaceLogo } from '@/shared/components/MarketplaceLogo'
import styles from './InsightsDemo.module.css'

const inventoryExamples = [
  { sku: 'ET-NT-01', name: 'Túi tote Everyday · Màu tự nhiên', available: 96, sold7: 126, sold30: 450, previous7: 112, previous30: 390, leadTime: 8, safety: 40, moq: 12 },
  { sku: 'CN-CD-05', name: 'Nến thơm · Gỗ tuyết tùng', available: 22, sold7: 56, sold30: 210, previous7: 49, previous30: 195, leadTime: 5, safety: 16, moq: 6 },
  { sku: 'CM-SD-02', name: 'Ly gốm · Màu cát', available: 62, sold7: 91, sold30: 360, previous7: 84, previous30: 330, leadTime: 6, safety: 28, moq: 12 },
  { sku: 'MK-WH-08', name: 'Bàn phím cơ · Trắng', available: 46, sold7: 63, sold30: 240, previous7: 56, previous30: 225, leadTime: 4, safety: 20, moq: 10 },
  { sku: 'LC-OL-04', name: 'Vỏ gối linen · Xanh olive', available: 136, sold7: 49, sold30: 210, previous7: 56, previous30: 225, leadTime: 8, safety: 22, moq: 10 },
]

const number = value => new Intl.NumberFormat('vi-VN').format(value)
const decimal = value => value.toFixed(1).replace('.', ',')

function deriveProducts(period) {
  const days = Number(period)
  return inventoryExamples.map(product => {
    const unitsSold = days === 7 ? product.sold7 : product.sold30
    const previousUnits = days === 7 ? product.previous7 : product.previous30
    const velocity = unitsSold / days
    const coverDays = product.available / velocity
    const reorderPoint = Math.ceil(velocity * product.leadTime + product.safety)
    const shortage = Math.max(0, reorderPoint - product.available)
    const suggested = shortage > 0 ? Math.ceil(shortage / product.moq) * product.moq : 0
    return {
      ...product,
      unitsSold,
      previousUnits,
      velocity,
      coverDays,
      reorderPoint,
      suggested,
      trend: previousUnits ? (unitsSold - previousUnits) / previousUnits * 100 : 0,
      daysPastLeadTime: coverDays - product.leadTime,
    }
  }).sort((a, b) => a.daysPastLeadTime - b.daysPastLeadTime)
}

export default function ApiInsights() {
  const [period, setPeriod] = useState('7')
  const [expandedSku, setExpandedSku] = useState('ET-NT-01')
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const products = useMemo(() => deriveProducts(period), [period])
  const priority = products[0]
  const riskCount = products.filter(product => product.suggested > 0).length

  function askAdvisor(prompt = question) {
    if (!prompt.trim()) return
    setQuestion(prompt.trim())
    setAnswer(`Theo tốc độ bán ${decimal(priority.velocity)} sản phẩm/ngày và tồn khả dụng dùng chung ${number(priority.available)} sản phẩm, ${priority.sku} là SKU cần xem trước. Ước tính còn đủ ${decimal(priority.coverDays)} ngày. Số lượng nhập chỉ nên chốt sau khi xác nhận thời gian giao hàng, mức dự trữ an toàn và lô nhập tối thiểu của nhà cung cấp.`)
  }

  return <div className={`${styles.page} ${styles.advisorPage}`}>
    <div className={styles.pageHeading}>
      <div><span className={styles.eyebrow}><Sparkles size={14} /> AI ADVISOR</span><h2>Ưu tiên đúng sản phẩm, đúng thời điểm.</h2><p>Danh sách SKU có nguy cơ cạn hàng và lượng nhập tham khảo theo công thức minh bạch.</p></div>
      <span className={styles.demoPill}><span />Bản demo</span>
    </div>

    <div className={styles.advisorToolbar}>
      <label className={styles.advisorSelect}><span>Kỳ tính tốc độ bán</span><select aria-label="Kỳ tính tốc độ bán" value={period} onChange={event => setPeriod(event.target.value)}><option value="7">7 ngày gần nhất</option><option value="30">30 ngày gần nhất</option></select><ChevronDown size={15} /></label>
      <span className={styles.advisorUpdated}><Clock3 size={14} /> Tồn kho đồng bộ gần nhất · hôm nay, 09:15</span>
    </div>

    <section className={styles.advisorPriority}>
      <div className={styles.advisorPriorityMain}>
        <div className={styles.advisorPriorityTop}><span className={styles.advisorPriorityLabel}><Lightbulb size={15} /> ƯU TIÊN HÔM NAY · SKU #1</span><span className={styles.advisorRisk}><i /> Cần xem xét nhập</span></div>
        <h3>{priority.name} có thể cạn trước thời gian nhập hàng.</h3>
        <p>{priority.sku} bán khoảng {decimal(priority.velocity)} sản phẩm/ngày; tồn khả dụng còn {number(priority.available)} sản phẩm, tương đương {decimal(priority.coverDays)} ngày. Thời gian giao hàng giả định là {priority.leadTime} ngày.</p>
        <div className={styles.advisorEvidence}>
          <span><Boxes size={14} />{priority.sku}</span>
          <span><TrendingUp size={14} />{number(priority.unitsSold)} sản phẩm / {period} ngày</span>
          <span><CalendarDays size={14} />Còn đủ khoảng {decimal(priority.coverDays)} ngày</span>
        </div>
      </div>
      <div className={styles.advisorPriorityStat}><span>Lượng nhập tham khảo</span><strong>{number(priority.suggested)} <small>sp</small></strong><span>Đã làm tròn theo lô tối thiểu {number(priority.moq)} sp</span><button type="button" onClick={() => setExpandedSku(expandedSku === priority.sku ? '' : priority.sku)} aria-expanded={expandedSku === priority.sku}>{expandedSku === priority.sku ? 'Ẩn cách tính' : 'Xem cách tính'} <ArrowUpRight size={14} /></button></div>
    </section>

    <div className={styles.advisorSharedStockNote}>
      <span className={styles.advisorSharedIcon}><Boxes size={17} /></span>
      <div><strong>Một tồn kho SmartOmni dùng chung cho hai sàn</strong><p>Tồn khả dụng được tính từ tồn hiện có trừ hàng giữ chỗ. Không cộng tồn Shopee và TikTok với nhau để tránh đếm trùng.</p></div>
      <div className={styles.advisorMarketplaceMarks}><MarketplaceLogo marketplace="shopee" size={19} decorative /><MarketplaceLogo marketplace="tiktok" size={19} decorative /></div>
    </div>

    <section className={styles.advisorPanel}>
      <div className={styles.advisorSectionHeading}>
        <div><span className={styles.eyebrow}><AlertTriangle size={14} /> DANH SÁCH CẦN THEO DÕI</span><h3>SKU có nguy cơ hết hàng</h3><p>Sắp xếp theo mức độ gấp: số ngày còn hàng so với thời gian nhập.</p></div>
        <span className={styles.advisorTableCount}>{riskCount} SKU cần xem</span>
      </div>

      <div className={styles.advisorRiskList}>
        {products.map((product, index) => <article className={`${styles.advisorRiskRow} ${product.sku === priority.sku ? styles.advisorRiskRowPriority : ''}`} key={product.sku}>
          <span className={`${styles.advisorRank} ${product.suggested > 0 ? styles.advisorRankRisk : ''}`}>{index + 1}</span>
          <div className={styles.advisorRiskProduct}><strong>{product.name}</strong><span>{product.sku} · Bán {number(product.unitsSold)} sp trong {period} ngày</span></div>
          <div className={styles.advisorRiskMetric}><span>Tồn khả dụng · dùng chung</span><strong>{number(product.available)} <small>sp</small></strong></div>
          <div className={styles.advisorRiskMetric}><span>Bán trung bình / ngày</span><strong>{decimal(product.velocity)} <small>sp</small></strong></div>
          <div className={styles.advisorRiskCover}><span>Dự kiến còn đủ</span><strong className={product.daysPastLeadTime < 0 ? styles.advisorUrgentText : ''}>{decimal(product.coverDays)} <small>ngày</small></strong><em>{product.daysPastLeadTime < 0 ? `Gấp hơn thời gian nhập ${decimal(Math.abs(product.daysPastLeadTime))} ngày` : 'Còn trong thời gian nhập'}</em></div>
          <div className={styles.advisorRiskSuggestion}><span>Nhập tham khảo</span><strong>{product.suggested ? `${number(product.suggested)} sp` : 'Chưa cần'}</strong><button type="button" onClick={() => setExpandedSku(expandedSku === product.sku ? '' : product.sku)} aria-expanded={expandedSku === product.sku}>{expandedSku === product.sku ? 'Ẩn' : 'Cách tính'}</button></div>
          {expandedSku === product.sku && <div className={styles.advisorRiskFormula}>
            <div><span>Nhu cầu trong thời gian nhập</span><strong>{decimal(product.velocity)} × {product.leadTime} ngày = {number(Math.ceil(product.velocity * product.leadTime))} sp</strong></div>
            <div><span>Điểm đặt hàng lại</span><strong>{number(Math.ceil(product.velocity * product.leadTime))} + {number(product.safety)} dự trữ = {number(product.reorderPoint)} sp</strong></div>
            <div><span>Thiếu hụt trước điểm đặt lại</span><strong>{number(Math.max(0, product.reorderPoint - product.available))} sp · tồn hiện tại {number(product.available)} sp</strong></div>
            <div><span>Làm tròn theo lô tối thiểu</span><strong>{product.suggested ? `${number(product.suggested)} sp · MOQ ${number(product.moq)}` : 'Chưa phát sinh nhu cầu nhập'}</strong></div>
          </div>}
        </article>)}
      </div>
      <div className={styles.advisorFormulaNote}><ShieldCheck size={15} /><p><strong>Cách tính:</strong> số ngày còn hàng = tồn khả dụng ÷ tốc độ bán; điểm đặt lại = bán trung bình/ngày × thời gian nhập + dự trữ an toàn; lượng nhập = phần thiếu, làm tròn lên theo MOQ. Các tham số thời gian nhập, dự trữ và MOQ hiện là giả định của bản demo.</p></div>
    </section>

    <section className={styles.advisorStrategyGrid}>
      <article className={styles.advisorStrategyCard}><span><TrendingUp size={16} /></span><div><strong>Đà bán thay đổi theo kỳ</strong><p>{priority.name}: {priority.trend >= 0 ? `tăng ${decimal(priority.trend)}%` : `giảm ${decimal(Math.abs(priority.trend))}%`} so với kỳ trước. Ưu tiên kiểm tra nguồn hàng trước khi đẩy thêm khuyến mãi.</p></div></article>
      <article className={styles.advisorStrategyCard}><span><CircleHelp size={16} /></span><div><strong>Chưa kết luận lợi nhuận</strong><p>Cần giá vốn và giao dịch phí đã quyết toán. Tỷ lệ phí ước tính không đủ để khuyên tăng hoặc giảm giá bán.</p></div></article>
    </section>

    <section className={styles.advisorAsk}>
      <div className={styles.advisorAskHeading}><span><MessageCircle size={17} /></span><div><strong>Hỏi về danh sách đề xuất</strong><p>Trợ lý giải thích thứ tự ưu tiên và công thức đang dùng.</p></div></div>
      <div className={styles.advisorPromptRow}>{['SKU nào cần nhập trước?', 'Vì sao chưa có gợi ý lợi nhuận?'].map(prompt => <button type="button" key={prompt} onClick={() => askAdvisor(prompt)}>{prompt}</button>)}</div>
      <form className={styles.advisorAskForm} onSubmit={event => { event.preventDefault(); askAdvisor() }}><input aria-label="Câu hỏi cho AI Advisor" placeholder="Hỏi về các sản phẩm cần nhập..." value={question} onChange={event => setQuestion(event.target.value)} /><button type="submit" aria-label="Gửi câu hỏi"><Send size={16} /></button></form>
      {answer && <div className={styles.advisorAnswer}><span><Sparkles size={15} /></span><p>{answer}</p></div>}
      <div className={styles.advisorAskNote}>Câu trả lời tương tác là nội dung demo cố định; số lượng và xếp hạng được tính trước bằng công thức.</div>
    </section>
  </div>
}
