import { useState } from 'react'
import { ArrowUpRight, BarChart3, Boxes, CalendarDays, Check, ChevronDown, CircleHelp, Clock3, Lightbulb, MessageCircle, PackageCheck, Send, ShieldCheck, ShoppingBag, Sparkles, TrendingUp } from 'lucide-react'
import styles from './InsightsDemo.module.css'

const products = [
  {
    sku: 'ET-NT-01', name: 'Túi tote Everyday · Màu tự nhiên', channel: 'Shopee + TikTok Shop',
    available: 96, reserved: 12, onHand: 108, incoming: 40, arrival: '05/12', cover: 5.3,
    daily: 18, leadTime: 8, safety: 40, reorderPoint: 184, eoq: 108, suggested: 108,
    units: 112, previousUnits: 92, delta: 22, priority: 'Cần đặt hàng', severity: 'high',
    actual: [9, 11, 13, 10, 14, 16, 18], forecast: [19, 20, 18, 23, 24, 28, 30],
    low: [16, 17, 15, 19, 20, 23, 25], high: [22, 23, 21, 27, 28, 33, 35],
  },
  {
    sku: 'CM-SD-02', name: 'Ly gốm · Màu cát', channel: 'Shopee + TikTok Shop',
    available: 62, reserved: 8, onHand: 70, incoming: 0, arrival: null, cover: 4.8,
    daily: 13, leadTime: 6, safety: 28, reorderPoint: 106, eoq: 72, suggested: 72,
    units: 100, previousUnits: 91, delta: 10, priority: 'Theo dõi', severity: 'watch',
    actual: [8, 10, 11, 9, 13, 12, 15], forecast: [14, 14, 15, 16, 17, 16, 18],
    low: [12, 12, 13, 14, 14, 13, 15], high: [16, 16, 17, 18, 20, 19, 21],
  },
  {
    sku: 'LC-OL-04', name: 'Vỏ gối linen · Xanh olive', channel: 'Shopee + TikTok Shop',
    available: 136, reserved: 14, onHand: 150, incoming: 24, arrival: '08/12', cover: 19.4,
    daily: 7, leadTime: 8, safety: 22, reorderPoint: 78, eoq: 50, suggested: 0,
    units: 54, previousUnits: 55, delta: -2, priority: 'Đủ hàng', severity: 'covered',
    actual: [8, 7, 9, 6, 8, 7, 6], forecast: [7, 8, 7, 7, 8, 7, 8],
    low: [6, 7, 6, 6, 7, 6, 7], high: [8, 9, 8, 8, 9, 8, 9],
  },
]

const number = value => new Intl.NumberFormat('vi-VN').format(value)
const decimal = value => value.toFixed(1).replace('.', ',')
const chartX = (index, totalPoints) => 36 + index * (728 / (totalPoints - 1))
const chartY = value => 198 - value * 4.35
const linePoints = (values, startIndex, totalPoints) => values.map((value, index) => `${chartX(index + startIndex, totalPoints)},${chartY(value)}`).join(' ')
const bandPath = (upper, lower, startIndex, totalPoints) => {
  const top = upper.map((value, index) => `${chartX(index + startIndex, totalPoints)},${chartY(value)}`)
  const bottom = lower.map((value, index) => `${chartX(index + startIndex, totalPoints)},${chartY(value)}`).reverse()
  return `M ${top.join(' L ')} L ${bottom.join(' L ')} Z`
}

export default function ApiInsights() {
  const [sku, setSku] = useState(products[0].sku)
  const [period, setPeriod] = useState(7)
  const [expandedFormula, setExpandedFormula] = useState(false)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const selected = products.find(product => product.sku === sku) || products[0]
  const position = selected.available + selected.incoming
  const futureDemand = Array.from({ length: period }, (_, index) => Math.round(selected.forecast[index % 7] * (1 + Math.floor(index / 7) * 0.03)))
  const futureLow = Array.from({ length: period }, (_, index) => Math.round(selected.low[index % 7] * (1 + Math.floor(index / 7) * 0.03)))
  const futureHigh = Array.from({ length: period }, (_, index) => Math.round(selected.high[index % 7] * (1 + Math.floor(index / 7) * 0.03)))
  const chartPoints = selected.actual.length + futureDemand.length
  const futureLabelStep = period === 7 ? 1 : period === 14 ? 2 : 5
  const forecastLabels = futureDemand.map((_, index) => index === 0 || index === period - 1 || (index + 1) % futureLabelStep === 0 ? `+${index + 1}` : '')
  const chartLabels = ['-6', '-5', '-4', '-3', '-2', '-1', 'Hôm nay', ...forecastLabels]

  function askAdvisor(text = question) {
    const normalized = text.trim()
    if (!normalized) return
    setQuestion(normalized)
    const stockMessage = selected.suggested > 0
      ? `Vị thế tồn sau khi tính hàng đang về là ${number(position)}, thấp hơn điểm đặt hàng lại ${number(selected.reorderPoint)}.`
      : `Vị thế tồn sau khi tính hàng đang về là ${number(position)}, cao hơn điểm đặt hàng lại ${number(selected.reorderPoint)}; hiện chưa cần đặt thêm theo công thức này.`
    setAnswer(`Với ${selected.sku}, tồn khả dụng hiện là ${number(selected.available)} sản phẩm và dự báo bán khoảng ${number(selected.daily)} sản phẩm/ngày. ${stockMessage} Hãy kiểm tra ngày hàng về và thời gian giao của nhà cung cấp trước khi quyết định.`)
  }

  return <div className={`${styles.page} ${styles.advisorPage}`}>
    <div className={styles.pageHeading}>
      <div><span className={styles.eyebrow}><Sparkles size={14} /> AI ADVISOR</span><h2>Trợ lý tăng trưởng kinh doanh</h2><p>Dự báo nhu cầu, ưu tiên việc cần làm và giải thích cơ sở cho từng đề xuất.</p></div>
      <span className={styles.demoPill}><span />Bản demo</span>
    </div>

    <div className={styles.advisorToolbar}>
      <label className={styles.advisorSelect}><span>Gian hàng</span><select aria-label="Chọn gian hàng"><option>Tất cả gian hàng</option><option>Shopee · Everyday Studio</option><option>TikTok Shop · Everyday Studio</option></select><ChevronDown size={15} /></label>
      <label className={styles.advisorSelect}><span>Sản phẩm</span><select aria-label="Chọn sản phẩm" value={sku} onChange={event => setSku(event.target.value)}>{products.map(product => <option value={product.sku} key={product.sku}>{product.sku} · {product.name}</option>)}</select><ChevronDown size={15} /></label>
      <div className={styles.advisorPeriod} role="group" aria-label="Khoảng thời gian dự báo">{[7, 14, 30].map(days => <button type="button" key={days} aria-pressed={period === days} onClick={() => setPeriod(days)}>{days} ngày</button>)}</div>
      <span className={styles.advisorUpdated}><Clock3 size={14} /> Đồng bộ gần nhất · hôm nay, 09:15</span>
    </div>

    <section className={styles.advisorPriority}>
      <div className={styles.advisorPriorityMain}>
        <div className={styles.advisorPriorityTop}><span className={styles.advisorPriorityLabel}><Lightbulb size={15} /> ƯU TIÊN HÔM NAY</span><span className={selected.suggested > 0 ? styles.advisorRisk : styles.advisorRiskOk}><i /> {selected.suggested > 0 ? 'Cần xem xét nhập' : 'Tồn kho ổn định'}</span></div>
        <h3>{selected.suggested > 0 ? `Chuẩn bị nhập thêm ${selected.name.toLowerCase()}.` : `${selected.name} hiện có mức tồn an toàn.`}</h3>
        <p>{selected.suggested > 0 ? `Vị thế tồn kho ${number(position)} sản phẩm thấp hơn điểm đặt hàng lại ${number(selected.reorderPoint)}. Với tốc độ bán hiện tại, hãy xác nhận kế hoạch nhập và ngày hàng về trước khi quyết định.` : `Vị thế tồn kho ${number(position)} sản phẩm đang cao hơn điểm đặt hàng lại ${number(selected.reorderPoint)}. Tiếp tục theo dõi nhịp bán và lịch hàng về trước khi nhập thêm.`}</p>
        <div className={styles.advisorEvidence}>
          <span><Boxes size={14} />{selected.sku}</span>
          <span><TrendingUp size={14} />{number(selected.daily)} sản phẩm/ngày</span>
          <span><CalendarDays size={14} />Còn khoảng {decimal(selected.cover)} ngày hàng</span>
        </div>
      </div>
      <div className={styles.advisorPriorityStat}><span>Lượng nhập gợi ý</span><strong>{selected.suggested ? number(selected.suggested) : '—'} {selected.suggested > 0 && <small>sp</small>}</strong><span>{selected.suggested > 0 ? 'EOQ · làm tròn theo lô nhập' : 'Chưa cần đặt theo điểm đặt lại'}</span><button type="button" onClick={() => setExpandedFormula(value => !value)} aria-expanded={expandedFormula}>{expandedFormula ? 'Ẩn công thức' : 'Xem cơ sở tính'} <ArrowUpRight size={14} /></button></div>
    </section>

    <div className={styles.advisorMetricGrid}>
      <article><span>Đã bán trong 7 ngày</span><strong>{number(selected.units)} <small>sp</small></strong><em className={selected.delta >= 0 ? styles.advisorPositive : styles.advisorNegative}><TrendingUp size={13} /> {selected.delta > 0 ? '+' : ''}{selected.delta}% so với kỳ trước</em></article>
      <article><span>Tồn khả dụng</span><strong>{number(selected.available)} <small>sp</small></strong><em>Đã trừ {number(selected.reserved)} sp giữ chỗ</em></article>
      <article><span>Hàng đang về</span><strong>{number(selected.incoming)} <small>sp</small></strong><em>{selected.arrival ? `Dự kiến ${selected.arrival}` : 'Chưa có đơn nhập đang về'}</em></article>
      <article><span>Điểm đặt hàng lại</span><strong>{number(selected.reorderPoint)} <small>sp</small></strong><em>Tồn vị thế: {number(position)} sp</em></article>
    </div>

    <section className={styles.advisorForecastCard}>
      <div className={styles.advisorSectionHeading}>
        <div><span className={styles.eyebrow}><BarChart3 size={14} /> NHU CẦU &amp; TỒN KHO</span><h3>Dự báo theo SKU</h3><p>{selected.name} · {selected.sku} · {selected.channel}</p></div>
        <div className={styles.advisorLegend}><span><i className={styles.advisorActualDot} />Đã bán</span><span><i className={styles.advisorForecastDot} />Dự báo</span><span><i className={styles.advisorBandDot} />Khoảng dự báo</span></div>
      </div>
      <div className={styles.advisorChart} role="img" aria-label={`Doanh số thực tế và dự báo nhu cầu ${period} ngày cho ${selected.name}`}>
        <svg viewBox="0 0 800 240" preserveAspectRatio="none" aria-hidden="true">
          {[45, 85, 125, 165, 205].map(y => <line key={y} x1="28" y1={y} x2="760" y2={y} className={styles.advisorGridLine} />)}
          <path d={bandPath([selected.actual.at(-1), ...futureHigh], [selected.actual.at(-1), ...futureLow], 6, chartPoints)} className={styles.advisorForecastBand} />
          <polyline points={linePoints(selected.actual, 0, chartPoints)} className={styles.advisorActualLine} />
          <polyline points={linePoints([selected.actual.at(-1), ...futureDemand], 6, chartPoints)} className={styles.advisorForecastLine} />
          {selected.actual.map((value, index) => <circle key={`a-${index}`} cx={chartX(index, chartPoints)} cy={chartY(value)} r="4" className={styles.advisorActualPoint} />)}
          {futureDemand.map((value, index) => <circle key={`f-${index}`} cx={chartX(index + 7, chartPoints)} cy={chartY(value)} r="3.5" className={styles.advisorForecastPoint} />)}
        </svg>
        <div className={styles.advisorChartLabels} style={{ gridTemplateColumns: `repeat(${chartLabels.length}, minmax(0, 1fr))` }}>{chartLabels.map((day, index) => <span className={index === 6 ? styles.advisorToday : index === 7 ? styles.advisorFutureStart : ''} key={`${day}-${index}`}>{day}</span>)}</div>
      </div>
      <div className={styles.advisorForecastFoot}><span><PackageCheck size={14} />Dự báo số lượng bán mỗi ngày · tồn khả dụng không cộng trùng giữa các sàn</span><span>Độ phủ dữ liệu: 84 ngày</span></div>
    </section>

    <div className={styles.advisorLowerGrid}>
      <section className={styles.advisorPanel}>
        <div className={styles.advisorSectionHeading}><div><span className={styles.eyebrow}><Boxes size={14} /> KẾ HOẠCH NHẬP HÀNG</span><h3>SKU cần theo dõi</h3><p>Đề xuất dựa trên tồn khả dụng, hàng đang về và nhu cầu dự báo.</p></div><span className={styles.advisorTableCount}>{products.filter(product => product.suggested > 0).length} SKU cần xem</span></div>
        <div className={styles.advisorReorderTable}>
          <div className={styles.advisorTableHead}><span>Sản phẩm</span><span>Tồn / vị thế</span><span>Điểm đặt lại</span><span>Gợi ý nhập</span></div>
          {products.map(product => <button type="button" className={`${styles.advisorTableRow} ${sku === product.sku ? styles.advisorTableRowSelected : ''}`} key={product.sku} onClick={() => { setSku(product.sku); setExpandedFormula(false) }}>
            <span className={styles.advisorProductCell}><strong>{product.name}</strong><small>{product.sku}</small></span>
            <span className={styles.advisorAvailableCell}>{number(product.available)} <small>({number(product.available + product.incoming)} gồm hàng về)</small></span>
            <span className={styles.advisorRopCell}>{number(product.reorderPoint)} <small>sp</small></span>
            <strong className={product.suggested ? styles.advisorQty : styles.advisorNoAction}>{product.suggested ? `${number(product.suggested)} sp` : 'Chưa cần'}</strong>
          </button>)}
        </div>
        {expandedFormula && <div className={styles.advisorFormula}>
          <div className={styles.advisorFormulaTitle}><CircleHelp size={15} /><strong>Cơ sở tính cho {selected.sku}</strong></div>
          <div><span>Nhu cầu trong thời gian giao hàng</span><strong>{number(selected.daily)} × {selected.leadTime} ngày = {number(selected.daily * selected.leadTime)} sp</strong></div>
          <div><span>Điểm đặt hàng lại</span><strong>{number(selected.daily * selected.leadTime)} + {number(selected.safety)} dự phòng = {number(selected.reorderPoint)} sp</strong></div>
          <div><span>Vị thế tồn kho</span><strong>{number(selected.available)} khả dụng + {number(selected.incoming)} đang về = {number(position)} sp</strong></div>
          <div><span>EOQ gợi ý</span><strong>{number(selected.eoq)} sp · theo lô nhập mẫu</strong></div>
          <p><ShieldCheck size={14} /> Số lượng do công thức tính; AI chỉ giải thích lý do và giả định.</p>
        </div>}
      </section>

      <section className={styles.advisorPanel}>
        <div className={styles.advisorSectionHeading}><div><span className={styles.eyebrow}><Sparkles size={14} /> CƠ HỘI KINH DOANH</span><h3>Gợi ý từ xu hướng bán</h3></div></div>
        <article className={styles.advisorStrategy}><span className={styles.advisorStrategyIcon}><TrendingUp size={16} /></span><div><strong>{selected.delta >= 0 ? `Sức bán tăng ${selected.delta}%` : `Sức bán giảm ${Math.abs(selected.delta)}%`}</strong><p>{number(selected.units)} sản phẩm trong 7 ngày, so với {number(selected.previousUnits)} sản phẩm ở kỳ trước. Kiểm tra lượng hàng trước khi tăng ngân sách khuyến mãi.</p><small><ShoppingBag size={12} /> Dữ liệu bán theo SKU · Shopee + TikTok Shop</small></div></article>
        <article className={styles.advisorStrategy}><span className={styles.advisorStrategyIcon}><CircleHelp size={16} /></span><div><strong>Chưa đủ dữ liệu để đề xuất biên lợi nhuận</strong><p>Cần giá vốn và giao dịch phí đã quyết toán. Tỷ lệ phí ước tính không đủ để kết luận nên tăng giảm giá.</p><small><Check size={12} /> Không tạo đề xuất lợi nhuận khi thiếu đầu vào</small></div></article>
      </section>
    </div>

    <section className={styles.advisorAsk}>
      <div className={styles.advisorAskHeading}><span><MessageCircle size={17} /></span><div><strong>Hỏi về đề xuất này</strong><p>Thử một câu hỏi dựa trên SKU đang chọn</p></div></div>
      <div className={styles.advisorPromptRow}>{['Vì sao nên nhập thêm?', 'Thiếu dữ liệu nào?', 'Nếu nhu cầu tăng 20% thì sao?'].map(prompt => <button type="button" key={prompt} onClick={() => askAdvisor(prompt)}>{prompt}</button>)}</div>
      <form className={styles.advisorAskForm} onSubmit={event => { event.preventDefault(); askAdvisor() }}><input aria-label="Câu hỏi cho AI Advisor" placeholder={`Hỏi về ${selected.sku}...`} value={question} onChange={event => setQuestion(event.target.value)} /><button type="submit" aria-label="Gửi câu hỏi"><Send size={16} /></button></form>
      {answer && <div className={styles.advisorAnswer}><span><Sparkles size={15} /></span><p>{answer}</p></div>}
      <div className={styles.advisorAskNote}>Phần trả lời ở đây là nội dung demo cố định, chưa gọi Gemini hay dữ liệu gian hàng.</div>
    </section>
  </div>
}
