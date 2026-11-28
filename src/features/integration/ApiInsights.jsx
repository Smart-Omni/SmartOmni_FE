import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ArrowUpRight, Boxes, CalendarDays, Check, ChevronDown, Clock3, History, Lightbulb, MessageCircle, PackageCheck, Plus, RefreshCw, Send, ShieldCheck, ShoppingBag, Sparkles, TrendingUp, X } from 'lucide-react'
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
const snapshotKey = 'smartomni-demo-ai-advisor-snapshot'
const chatHistoryKey = 'smartomni-demo-ai-advisor-chat'
const mockAvailableHistoryDays = 30
const emptyChatMessages = []

function readSnapshot() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(snapshotKey) || 'null')
    return saved?.products?.length ? saved : null
  } catch {
    return null
  }
}

function readChatState() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(chatHistoryKey) || 'null')
    if (Array.isArray(saved)) {
      if (!saved.length) return { conversations: [], activeId: null }
      const firstQuestion = saved.find(message => message.role === 'user')?.text || 'Cuộc trò chuyện cũ'
      const conversation = { id: 'legacy-conversation', title: firstQuestion.slice(0, 42), updatedAt: saved[saved.length - 1].createdAt || new Date().toISOString(), messages: saved }
      return { conversations: [conversation], activeId: conversation.id }
    }
    if (Array.isArray(saved?.conversations)) {
      const activeId = saved.conversations.some(item => item.id === saved.activeId) ? saved.activeId : saved.conversations[0]?.id || null
      return { conversations: saved.conversations, activeId }
    }
    return { conversations: [], activeId: null }
  } catch {
    return { conversations: [], activeId: null }
  }
}

function newConversation() {
  const now = new Date().toISOString()
  return { id: `chat-${Date.now()}`, title: 'Cuộc trò chuyện mới', createdAt: now, updatedAt: now, messages: [] }
}

function conversationDate(date) {
  return new Date(date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
}

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
  const [snapshot, setSnapshot] = useState(readSnapshot)
  const [period, setPeriod] = useState(() => readSnapshot()?.period || '7')
  const [expandedSku, setExpandedSku] = useState('ET-NT-01')
  const [skuQuery, setSkuQuery] = useState('')
  const [skuLookup, setSkuLookup] = useState(null)
  const [skuLookupError, setSkuLookupError] = useState('')
  const [generating, setGenerating] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatDraft, setChatDraft] = useState('')
  const [chatState, setChatState] = useState(readChatState)
  const chatEndRef = useRef(null)
  const products = useMemo(() => snapshot?.products || [], [snapshot])
  const priority = products[0]
  const warningProducts = products.filter(product => product.suggested > 0)
  const riskCount = warningProducts.length
  const periodNeedsMoreHistory = Number(period) > mockAvailableHistoryDays
  const activeConversation = chatState.conversations.find(item => item.id === chatState.activeId)
  const chatMessages = activeConversation?.messages || emptyChatMessages

  useEffect(() => {
    window.localStorage.setItem(chatHistoryKey, JSON.stringify(chatState))
  }, [chatState])

  useEffect(() => {
    if (chatOpen) chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [chatMessages, chatOpen])

  function generateSnapshot() {
    if (periodNeedsMoreHistory) return
    setGenerating(true)
    const nextSnapshot = { generatedAt: new Date().toISOString(), period, products: deriveProducts(period) }
    window.localStorage.setItem(snapshotKey, JSON.stringify(nextSnapshot))
    setSnapshot(nextSnapshot)
    setExpandedSku(nextSnapshot.products[0]?.sku || '')
    setGenerating(false)
  }

  function findSku(event) {
    event.preventDefault()
    const query = skuQuery.trim().toLocaleLowerCase('vi')
    const result = products.find(product => product.sku.toLocaleLowerCase('vi') === query)
      || products.find(product => product.sku.toLocaleLowerCase('vi').includes(query) || product.name.toLocaleLowerCase('vi').includes(query))
    setSkuLookup(result || null)
    setSkuLookupError(result ? '' : `Không tìm thấy SKU hoặc sản phẩm phù hợp với “${skuQuery.trim()}”.`)
  }

  function sendChatMessage(event) {
    event.preventDefault()
    const text = chatDraft.trim()
    if (!text) return
    const messageTime = new Date().toISOString()
    const userMessage = { id: `user-${Date.now()}`, role: 'user', text, createdAt: messageTime }
    const matchingProduct = products.find(product => text.toLocaleLowerCase('vi').includes(product.sku.toLocaleLowerCase('vi')))
    const response = matchingProduct
      ? `${matchingProduct.name} (${matchingProduct.sku}) bán trung bình ${decimal(matchingProduct.velocity)} sản phẩm/ngày. Tồn khả dụng còn ${number(matchingProduct.available)} sản phẩm, tương đương khoảng ${decimal(matchingProduct.coverDays)} ngày. Điểm đặt hàng lại là ${number(matchingProduct.reorderPoint)} sản phẩm; lượng nhập tham khảo hiện tại là ${number(matchingProduct.suggested)} sản phẩm.`
      : priority
        ? `Theo snapshot ${snapshot.period} ngày đang mở, ${priority.sku} cần ưu tiên xem trước: tốc độ bán ${decimal(priority.velocity)} sản phẩm/ngày, tồn khả dụng ${number(priority.available)} sản phẩm và còn đủ khoảng ${decimal(priority.coverDays)} ngày. Đây là câu trả lời mẫu; khi kết nối LLM, câu trả lời sẽ dựa trên snapshot đã lưu và dữ liệu shop.`
        : 'Bạn hãy tạo một bản phân tích trước để mình có dữ liệu snapshot làm ngữ cảnh trả lời. Đây là câu trả lời mẫu; chưa kết nối LLM.'
    const assistantMessage = { id: `assistant-${Date.now()}`, role: 'assistant', text: response, createdAt: new Date().toISOString() }
    setChatState(current => {
      const currentConversation = current.conversations.find(item => item.id === current.activeId) || newConversation()
      const firstMessage = currentConversation.messages.length === 0
      const title = firstMessage ? text.slice(0, 42) : currentConversation.title
      const updatedConversation = { ...currentConversation, title, updatedAt: assistantMessage.createdAt, messages: [...currentConversation.messages, userMessage, assistantMessage] }
      return { conversations: [updatedConversation, ...current.conversations.filter(item => item.id !== updatedConversation.id)], activeId: updatedConversation.id }
    })
    setChatDraft('')
  }

  function openChat() {
    setChatState(current => {
      if (current.activeId && current.conversations.some(item => item.id === current.activeId)) return current
      const conversation = current.conversations[0] || newConversation()
      return { conversations: current.conversations.length ? current.conversations : [conversation], activeId: conversation.id }
    })
    setChatOpen(true)
  }

  function startNewChat() {
    const conversation = newConversation()
    setChatState(current => ({ conversations: [conversation, ...current.conversations], activeId: conversation.id }))
    setChatDraft('')
  }

  return <div className={`${styles.page} ${styles.advisorPage}`}>
    <div className={styles.pageHeading}>
      <div><span className={styles.eyebrow}><Sparkles size={14} /> AI ADVISOR</span><h2>Ưu tiên đúng sản phẩm, đúng thời điểm.</h2><p>Tạo báo cáo khi bạn cần; lần mở sau sẽ hiển thị bản phân tích đã lưu gần nhất.</p></div>
      <span className={styles.demoPill}><span />Bản demo</span>
    </div>

    <div className={styles.advisorToolbar}>
      <label className={styles.advisorSelect}><span>Kỳ tính tốc độ bán</span><select aria-label="Kỳ tính tốc độ bán" value={period} onChange={event => setPeriod(event.target.value)}><optgroup label="Ngắn hạn"><option value="7">7 ngày gần nhất</option><option value="30">30 ngày gần nhất</option></optgroup><optgroup label="Trung hạn"><option value="60">60 ngày gần nhất</option><option value="90">90 ngày gần nhất</option><option value="180">180 ngày gần nhất</option></optgroup><optgroup label="Theo mùa & xu hướng dài hạn"><option value="365">365 ngày · 1 năm</option><option value="730">730 ngày · 2 năm</option><option value="1095">1.095 ngày · 3 năm</option></optgroup></select><ChevronDown size={15} /></label>
      <button type="button" className={styles.advisorGenerateButton} disabled={generating || periodNeedsMoreHistory} onClick={generateSnapshot}><RefreshCw size={15} className={generating ? styles.advisorSpin : ''} />{periodNeedsMoreHistory ? 'Chưa đủ dữ liệu' : snapshot ? 'Tạo phân tích mới' : 'Tạo phân tích'}</button>
      {snapshot ? <span className={styles.advisorUpdated}><Clock3 size={14} /> Lưu trong trình duyệt · {new Date(snapshot.generatedAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}</span> : <span className={styles.advisorUpdated}>Chưa có bản phân tích được lưu</span>}
    </div>

    {periodNeedsMoreHistory && <div className={styles.advisorHistoryError} role="alert"><AlertTriangle size={19} /><div><strong>Không đủ dữ liệu đơn hàng cho kỳ {number(Number(period))} ngày</strong><p>Bản demo hiện có tối đa {mockAvailableHistoryDays} ngày lịch sử. Cần đồng bộ thêm đơn hàng trước khi tính tốc độ bán cho kỳ này.</p><code>INSUFFICIENT_SALES_HISTORY</code></div></div>}

    {!snapshot ? <section className={styles.advisorSnapshotEmpty}><span><Sparkles size={22} /></span><h3>Chưa có báo cáo phân tích</h3><p>Chọn kỳ dữ liệu phía trên rồi tạo phân tích. Báo cáo sẽ được lưu để bạn xem lại khi quay lại trang.</p><button type="button" disabled={periodNeedsMoreHistory} onClick={generateSnapshot}><Sparkles size={15} /> Tạo phân tích đầu tiên</button><small>Bản demo lưu snapshot trong trình duyệt; chưa kết nối API lưu vào cơ sở dữ liệu.</small></section> : <>
    {period !== snapshot.period && <div className={styles.advisorSnapshotNotice}><Clock3 size={15} /><span>Đang xem bản đã lưu cho {snapshot.period} ngày. Chọn “Tạo phân tích mới” để lưu bản theo kỳ {period} ngày.</span></div>}
    <section className={styles.advisorPriority}>
      <div className={styles.advisorPriorityMain}>
        <div className={styles.advisorPriorityTop}><span className={styles.advisorPriorityLabel}><Lightbulb size={15} /> ƯU TIÊN HÔM NAY · SKU #1</span><span className={styles.advisorRisk}><i /> Cần xem xét nhập</span></div>
        <h3>{priority.name} có thể cạn trước thời gian nhập hàng.</h3>
        <p>{priority.sku} bán khoảng {decimal(priority.velocity)} sản phẩm/ngày; tồn khả dụng còn {number(priority.available)} sản phẩm, tương đương {decimal(priority.coverDays)} ngày. Thời gian giao hàng giả định là {priority.leadTime} ngày.</p>
        <div className={styles.advisorEvidence}>
          <span><Boxes size={14} />{priority.sku}</span>
          <span><TrendingUp size={14} />{number(priority.unitsSold)} sản phẩm / {snapshot.period} ngày</span>
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
        <div><span className={styles.eyebrow}><AlertTriangle size={14} /> DANH SÁCH CẦN THEO DÕI</span><h3>Tất cả SKU cần cảnh báo</h3><p>Hiển thị mọi SKU có lượng nhập tham khảo lớn hơn 0, xếp theo mức độ gấp.</p></div>
        <span className={styles.advisorTableCount}>{riskCount} SKU cần xem</span>
      </div>

      <div className={styles.advisorRiskList}>
        {warningProducts.map((product, index) => <article className={`${styles.advisorRiskRow} ${product.sku === priority.sku ? styles.advisorRiskRowPriority : ''}`} key={product.sku}>
          <span className={`${styles.advisorRank} ${product.suggested > 0 ? styles.advisorRankRisk : ''}`}>{index + 1}</span>
          <div className={styles.advisorRiskProduct}><strong>{product.name}</strong><span>{product.sku} · Bán {number(product.unitsSold)} sp trong {snapshot.period} ngày</span></div>
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
        {!warningProducts.length && <div className={styles.advisorNoWarnings}><Check size={18} /><p>Chưa có SKU nào vượt ngưỡng cảnh báo trong kỳ đã chọn.</p></div>}
      </div>
      <div className={styles.advisorFormulaNote}><ShieldCheck size={15} /><p><strong>Cách tính:</strong> số ngày còn hàng = tồn khả dụng ÷ tốc độ bán; điểm đặt lại = bán trung bình/ngày × thời gian nhập + dự trữ an toàn; lượng nhập = phần thiếu, làm tròn lên theo MOQ. Các tham số thời gian nhập, dự trữ và MOQ hiện là giả định của bản demo.</p></div>
    </section>

    <section className={styles.advisorLookup}>
      <div className={styles.advisorSectionHeading}><div><span className={styles.eyebrow}><Boxes size={14} /> PHÂN TÍCH RIÊNG</span><h3>Tìm một SKU bất kỳ</h3><p>Tra cứu SKU để xem tốc độ bán, số ngày tồn còn đủ và điểm đặt hàng lại.</p></div></div>
      <form className={styles.advisorLookupForm} onSubmit={findSku}><input aria-label="Tìm SKU hoặc tên sản phẩm" placeholder="Nhập SKU hoặc tên sản phẩm, ví dụ ET-NT-01" value={skuQuery} onChange={event => { setSkuQuery(event.target.value); setSkuLookupError('') }} /><button type="submit" disabled={!skuQuery.trim()}><ShoppingBag size={15} /> Phân tích SKU</button></form>
      {skuLookupError && <p className={styles.advisorLookupError} role="status">{skuLookupError}</p>}
      {skuLookup && <article className={styles.advisorLookupResult}>
        <div className={styles.advisorLookupTitle}><div><strong>{skuLookup.name}</strong><span>{skuLookup.sku} · dữ liệu {snapshot.period} ngày</span></div><span className={skuLookup.suggested > 0 ? styles.advisorLookupRisk : styles.advisorLookupOk}>{skuLookup.suggested > 0 ? 'Cần xem xét nhập' : 'Chưa cần nhập'}</span></div>
        <div className={styles.advisorLookupMetrics}><div><span>Đã bán</span><strong>{number(skuLookup.unitsSold)} <small>sp</small></strong></div><div><span>Bán trung bình/ngày</span><strong>{decimal(skuLookup.velocity)} <small>sp</small></strong></div><div><span>Tồn khả dụng dùng chung</span><strong>{number(skuLookup.available)} <small>sp</small></strong></div><div><span>Tồn còn đủ khoảng</span><strong>{decimal(skuLookup.coverDays)} <small>ngày</small></strong></div><div><span>Điểm đặt hàng lại</span><strong>{number(skuLookup.reorderPoint)} <small>sp</small></strong></div><div><span>Lượng nhập tham khảo</span><strong>{number(skuLookup.suggested)} <small>sp</small></strong></div></div>
        <p className={styles.advisorLookupFormula}>Tốc độ bán = {number(skuLookup.unitsSold)} ÷ {snapshot.period} ngày. Điểm đặt lại = tốc độ bán × {skuLookup.leadTime} ngày giao hàng + {number(skuLookup.safety)} sp dự trữ an toàn.</p>
      </article>}
    </section>

    <section className={styles.advisorStrategyGrid}>
      <article className={styles.advisorStrategyCard}><span><TrendingUp size={16} /></span><div><strong>Đà bán thay đổi theo kỳ</strong><p>{priority.name}: {priority.trend >= 0 ? `tăng ${decimal(priority.trend)}%` : `giảm ${decimal(Math.abs(priority.trend))}%`} so với kỳ trước. Ưu tiên kiểm tra nguồn hàng trước khi đẩy thêm khuyến mãi.</p></div></article>
    </section>

    </>}

    <button type="button" className={styles.advisorChatLauncher} onClick={openChat}><MessageCircle size={20} /><span>Chat với AI Advisor</span></button>
    {chatOpen && <div className={styles.advisorChatBackdrop} onMouseDown={event => { if (event.target === event.currentTarget) setChatOpen(false) }}><section className={styles.advisorChatModal} role="dialog" aria-modal="true" aria-labelledby="advisor-chat-title">
      <header className={styles.advisorChatHeader}><span><MessageCircle size={19} /></span><div><strong id="advisor-chat-title">Trò chuyện với AI Advisor</strong><small>Bản demo · lịch sử lưu trên trình duyệt · chưa kết nối LLM</small></div><button type="button" aria-label="Đóng khung chat" onClick={() => setChatOpen(false)}><X size={19} /></button></header>
      <div className={styles.advisorChatBody}>
        <aside className={styles.advisorChatSidebar} aria-label="Lịch sử chat">
          <div className={styles.advisorChatSidebarHead}><strong><History size={15} /> Lịch sử</strong><button type="button" onClick={startNewChat}><Plus size={15} /> Cuộc trò chuyện mới</button></div>
          <div className={styles.advisorChatConversationList}>{[...chatState.conversations].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(conversation => <button type="button" key={conversation.id} className={`${styles.advisorChatConversation} ${conversation.id === chatState.activeId ? styles.advisorChatConversationActive : ''}`} aria-current={conversation.id === chatState.activeId ? 'true' : undefined} onClick={() => { setChatState(current => ({ ...current, activeId: conversation.id })); setChatDraft('') }}><span>{conversation.title}</span><small>{conversation.messages.length ? `${conversationDate(conversation.updatedAt)} · ${Math.ceil(conversation.messages.length / 2)} lượt` : 'Chưa có tin nhắn'}</small></button>)}</div>
          {!chatState.conversations.length && <p className={styles.advisorChatSidebarEmpty}>Các cuộc trò chuyện của bạn sẽ xuất hiện ở đây.</p>}
        </aside>
        <main className={styles.advisorChatMain}>
          <div className={styles.advisorChatHistory} aria-live="polite">
            {!chatMessages.length && <div className={styles.advisorChatWelcome}><span><Sparkles size={20} /></span><strong>Bạn muốn tìm hiểu điều gì?</strong><p>Hỏi về SKU có nguy cơ hết hàng, tốc độ bán hoặc lượng nhập tham khảo trong snapshot đang mở.</p><div>{['SKU nào cần nhập trước?', priority ? `Phân tích ${priority.sku}` : 'Cần tạo snapshot trước không?'].map(prompt => <button key={prompt} type="button" onClick={() => setChatDraft(prompt)}>{prompt}</button>)}</div></div>}
            {chatMessages.map(message => <div className={`${styles.advisorChatMessage} ${message.role === 'user' ? styles.advisorChatUser : styles.advisorChatAssistant}`} key={message.id}><span>{message.role === 'user' ? 'Bạn' : 'AI Advisor'}</span><p>{message.text}</p></div>)}
            <div ref={chatEndRef} />
          </div>
          <form className={styles.advisorChatComposer} onSubmit={sendChatMessage}><textarea aria-label="Tin nhắn cho AI Advisor" rows={2} maxLength={1500} placeholder="Nhập câu hỏi của bạn..." value={chatDraft} onChange={event => setChatDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form.requestSubmit() } }} /><button type="submit" aria-label="Gửi tin nhắn" disabled={!chatDraft.trim()}><Send size={17} /></button></form>
        </main>
      </div>
    </section></div>}
  </div>
}
