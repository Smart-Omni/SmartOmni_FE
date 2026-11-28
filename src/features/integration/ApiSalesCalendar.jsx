import { useMemo, useState } from 'react'
import { CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, Plus, Sparkles, Store, X } from 'lucide-react'
import styles from './InsightsDemo.module.css'

const EVENT_STORAGE_KEY = 'smartomni-demo-shop-sales-events'
const DECISION_STORAGE_KEY = 'smartomni-demo-sale-participation'
const months = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12']
const weekdays = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật']

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function campaign(id, name, platform, year, month, startDay, endDay = startDay, kind = 'Lịch sàn') {
  return { id: `${year}-${id}`, name, platform, start: dateKey(new Date(year, month, startDay)), end: dateKey(new Date(year, month, endDay)), kind, source: 'platform' }
}

function getBlackFridayDay(year) {
  const date = new Date(year, 10, 30)
  while (date.getDay() !== 5) date.setDate(date.getDate() - 1)
  return date.getDate()
}

function buildPlatformEvents(year) {
  const events = []
  for (let month = 0; month < 12; month += 1) {
    const pair = month + 1
    events.push(campaign(`double-${pair}`, `Ngày đôi ${pair}.${pair}`, 'Cả hai sàn', year, month, pair))
    ;[1, 15, 25].forEach(day => events.push(campaign(`shopee-monthly-${month}-${day}`, `Sale ngày ${day}`, 'Shopee', year, month, day)))
    events.push(campaign(`tiktok-mid-${month}`, 'Sale giữa tháng', 'TikTok Shop', year, month, 13, 15))
    events.push(campaign(`tiktok-payday-${month}`, 'Sale lương về', 'TikTok Shop', year, month, 24, 25))
  }
  events.push(campaign('tet', 'Tết & mùa mua sắm xuân', 'Cả hai sàn', year, 0, 1, 1, 'Theo mùa'))
  events.push(campaign('tet-feb', 'Tết & mùa mua sắm xuân', 'Cả hai sàn', year, 1, 1, 1, 'Theo mùa'))
  events.push(campaign('women-day', 'Ngày Quốc tế Phụ nữ 8.3', 'Shopee', year, 2, 8, 8, 'Theo mùa'))
  events.push(campaign('mid-year', 'Cao điểm giữa năm · 6.6', 'Cả hai sàn', year, 5, 6, 6, 'Chiến dịch lớn'))
  events.push(campaign('women-vn', 'Ngày Phụ nữ Việt Nam 20.10', 'Shopee', year, 9, 20, 20, 'Theo mùa'))
  events.push(campaign('black-friday', 'Black Friday', 'Cả hai sàn', year, 10, getBlackFridayDay(year), getBlackFridayDay(year), 'Theo mùa'))
  if (year === 2026) events.push(campaign('tiktok-1212-campaign', 'Chiến dịch 12.12 · 5–15.12', 'TikTok Shop', year, 11, 5, 15, 'Cần xác nhận'))
  events.push(campaign('christmas', 'Giáng sinh & năm mới', 'Shopee', year, 11, 24, 25, 'Theo mùa'))
  return events
}

function buildSeasonNotes(year, month) {
  const notes = []
  if (month <= 1) notes.push({ id: `${year}-tet-note`, name: 'Mùa Tết & mua sắm đầu xuân', platform: 'Cả hai sàn', start: dateKey(new Date(year, month, 1)), end: dateKey(new Date(year, month + 1, 0)), kind: 'Theo mùa', source: 'platform' })
  if (month >= 3 && month <= 7) notes.push({ id: `${year}-midyear-note`, name: 'Giai đoạn sale giữa năm · 4.4–8.8', platform: 'TikTok Shop', start: dateKey(new Date(year, month, 1)), end: dateKey(new Date(year, month + 1, 0)), kind: 'Theo mùa', source: 'platform' })
  if (month >= 8) notes.push({ id: `${year}-peak-note`, name: 'Mùa mua sắm cao điểm cuối năm · 9.9–12.12', platform: 'Cả hai sàn', start: dateKey(new Date(year, month, 1)), end: dateKey(new Date(year, month + 1, 0)), kind: 'Theo mùa', source: 'platform' })
  return notes
}

function readStorage(key, fallback) {
  try {
    const value = JSON.parse(window.localStorage.getItem(key) || 'null')
    return value ?? fallback
  } catch {
    return fallback
  }
}

function formatDate(date) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function dateRange(start, end) {
  return start === end ? formatDate(start) : `${formatDate(start)} – ${formatDate(end)}`
}

export default function ApiSalesCalendar() {
  const now = new Date()
  const [shownMonth, setShownMonth] = useState(now.getMonth())
  const [shownYear, setShownYear] = useState(now.getFullYear())
  const [shopEvents, setShopEvents] = useState(() => readStorage(EVENT_STORAGE_KEY, []))
  const [decisions, setDecisions] = useState(() => readStorage(DECISION_STORAGE_KEY, {}))
  const [showForm, setShowForm] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [selectedDate, setSelectedDate] = useState(null)
  const [form, setForm] = useState({ name: '', platform: 'Cả hai sàn', type: 'Livestream', start: '', end: '', details: '' })

  const events = useMemo(() => [...buildPlatformEvents(shownYear), ...shopEvents], [shownYear, shopEvents])
  const seasonNotes = useMemo(() => buildSeasonNotes(shownYear, shownMonth), [shownYear, shownMonth])
  const calendarDays = useMemo(() => {
    const firstOffset = (new Date(shownYear, shownMonth, 1).getDay() + 6) % 7
    const daysInMonth = new Date(shownYear, shownMonth + 1, 0).getDate()
    const cells = Array.from({ length: firstOffset }, (_, index) => ({ key: `blank-${index}`, blank: true }))
    for (let day = 1; day <= daysInMonth; day += 1) cells.push({ key: dateKey(new Date(shownYear, shownMonth, day)), date: dateKey(new Date(shownYear, shownMonth, day)), day })
    while (cells.length % 7) cells.push({ key: `end-${cells.length}`, blank: true })
    return cells
  }, [shownMonth, shownYear])

  const eventsByDate = useMemo(() => {
    const map = new Map()
    const monthStart = dateKey(new Date(shownYear, shownMonth, 1))
    const monthEnd = dateKey(new Date(shownYear, shownMonth + 1, 0))
    events.forEach(event => {
      if (event.end < monthStart || event.start > monthEnd) return
      const start = event.start < monthStart ? monthStart : event.start
      const end = event.end > monthEnd ? monthEnd : event.end
      const cursor = new Date(`${start}T00:00:00`)
      const last = new Date(`${end}T00:00:00`)
      while (cursor <= last) {
        const key = dateKey(cursor)
        map.set(key, [...(map.get(key) || []), event])
        cursor.setDate(cursor.getDate() + 1)
      }
    })
    return map
  }, [events, shownMonth, shownYear])

  const changeMonth = delta => {
    const date = new Date(shownYear, shownMonth + delta, 1)
    setShownYear(date.getFullYear())
    setShownMonth(date.getMonth())
  }

  const updateDecision = (id, decision) => {
    const next = { ...decisions, [id]: decision }
    setDecisions(next)
    window.localStorage.setItem(DECISION_STORAGE_KEY, JSON.stringify(next))
    setSelectedEvent(null)
  }

  const saveEvent = event => {
    event.preventDefault()
    const newEvent = { ...form, id: `shop-event-${Date.now()}`, end: form.end || form.start, kind: 'Sự kiện shop', source: 'shop' }
    const next = [...shopEvents, newEvent]
    setShopEvents(next)
    window.localStorage.setItem(EVENT_STORAGE_KEY, JSON.stringify(next))
    const [year, month] = form.start.split('-').map(Number)
    setShownYear(year)
    setShownMonth(month - 1)
    setForm({ name: '', platform: 'Cả hai sàn', type: 'Livestream', start: '', end: '', details: '' })
    setShowForm(false)
  }

  const selectedDayEvents = selectedDate ? eventsByDate.get(selectedDate) || [] : []

  return <div className={styles.salesCalendar}>
    <header className={styles.salesCalendarHero}>
      <div><span className={styles.eyebrow}><CalendarDays size={15} /> KẾ HOẠCH BÁN HÀNG</span><h2>Lên kế hoạch cho mùa cao điểm</h2><p>Chọn các chiến dịch shop sẽ tham gia và thêm chương trình riêng vào lịch.</p></div>
      <button type="button" className={styles.salesCalendarAdd} onClick={() => setShowForm(true)}><Plus size={16} /> Thêm đợt sale của shop</button>
    </header>

    <div className={styles.salesCalendarNotice}><Clock3 size={17} /><p><strong>Lịch sale sàn là mốc tham khảo.</strong> Xác nhận ngày và điều kiện tham gia trên Seller Center. Lựa chọn tham gia ở đây chỉ là kế hoạch của shop, chưa đăng ký với sàn.</p></div>

    <section className={styles.salesCalendarPlanner} aria-labelledby="sales-calendar-title">
      <div className={styles.salesCalendarPlannerHead}>
        <div><span className={styles.eyebrow}>LỊCH CHIẾN DỊCH</span><h3 id="sales-calendar-title">Xem và lên kế hoạch theo tháng</h3></div>
        <div className={styles.salesCalendarMonthControls}>
          <button type="button" aria-label="Tháng trước" onClick={() => changeMonth(-1)}><ChevronLeft size={17} /></button>
          <label><select aria-label="Chọn tháng" value={shownMonth} onChange={event => setShownMonth(Number(event.target.value))}>{months.map((month, index) => <option value={index} key={month}>{month}</option>)}</select><select aria-label="Chọn năm" value={shownYear} onChange={event => setShownYear(Number(event.target.value))}>{[shownYear - 1, shownYear, shownYear + 1].map(year => <option key={year} value={year}>{year}</option>)}</select></label>
          <button type="button" aria-label="Tháng sau" onClick={() => changeMonth(1)}><ChevronRight size={17} /></button>
        </div>
      </div>

      {seasonNotes.length > 0 && <div className={styles.salesCalendarSeasonNotes}><span><Sparkles size={14} /> Mốc theo mùa</span>{seasonNotes.map(note => <button type="button" key={note.id} onClick={() => setSelectedEvent(note)}>{note.name}<small>{note.platform}</small></button>)}</div>}

      <div className={styles.salesCalendarLegend}><span><i className={styles.salesCalendarLegendShopee} /> Shopee</span><span><i className={styles.salesCalendarLegendTikTok} /> TikTok Shop</span><span><i className={styles.salesCalendarLegendBoth} /> Cả hai sàn</span><span><i className={styles.salesCalendarLegendShop} /> Sự kiện shop</span><small>Chọn một đợt sale để xác nhận kế hoạch tham gia</small></div>

      <div className={styles.salesCalendarGrid}>
        {weekdays.map(day => <div className={styles.salesCalendarWeekday} key={day}>{day}</div>)}
        {calendarDays.map(cell => {
          if (cell.blank) return <div className={styles.salesCalendarBlank} key={cell.key} />
          const dayEvents = eventsByDate.get(cell.date) || []
          const visible = dayEvents.slice(0, 2)
          const isToday = cell.date === dateKey(now)
          return <div className={`${styles.salesCalendarDay} ${isToday ? styles.salesCalendarToday : ''}`} key={cell.key}>
            <span className={styles.salesCalendarDayNumber}>{cell.day}</span>
            <div className={styles.salesCalendarDayEvents}>{visible.map(event => <button type="button" title={`${event.name} · ${event.platform}`} className={`${styles.salesCalendarChip} ${event.platform === 'Shopee' ? styles.salesCalendarChipShopee : event.platform === 'TikTok Shop' ? styles.salesCalendarChipTikTok : event.source === 'shop' ? styles.salesCalendarChipShop : styles.salesCalendarChipBoth}`} onClick={() => setSelectedEvent(event)} key={event.id}><span>{event.name}</span>{decisions[event.id] && <i>{decisions[event.id] === 'join' ? 'Tham gia' : 'Không tham gia'}</i>}</button>)}</div>
            {dayEvents.length > 2 && <button type="button" className={styles.salesCalendarMore} onClick={() => setSelectedDate(cell.date)}>+{dayEvents.length - 2} đợt sale</button>}
          </div>
        })}
      </div>

      <div className={styles.salesCalendarOverlapNote}><span className={styles.salesCalendarOverlapMark}>+</span><p><strong>Có thể có nhiều đợt sale trùng ngày.</strong> Các đợt được xếp chồng trong cùng ô; bấm “+N đợt sale” để xem toàn bộ lịch của ngày đó.</p></div>
    </section>

    <div className={styles.salesCalendarAiNote}><Sparkles size={16} /><p><strong>Lịch sử sự kiện sẽ giúp AI có thêm bối cảnh.</strong> Sau này, sự kiện đã qua có thể được đối chiếu với doanh số thực tế; kế hoạch tương lai chỉ là tín hiệu tham khảo cho dự báo.</p></div>

    {showForm && <div className={styles.salesCalendarBackdrop} onMouseDown={event => { if (event.target === event.currentTarget) setShowForm(false) }}><section className={styles.salesCalendarModal} role="dialog" aria-modal="true" aria-labelledby="sales-event-modal-title"><div className={styles.salesCalendarModalHeading}><div><span className={styles.eyebrow}><CalendarDays size={14} /> SỰ KIỆN CỦA SHOP</span><h3 id="sales-event-modal-title">Thêm đợt sale riêng</h3></div><button type="button" aria-label="Đóng" onClick={() => setShowForm(false)}><X size={18} /></button></div><form onSubmit={saveEvent}>
      <label>Tên đợt sale<input required maxLength={100} placeholder="Ví dụ: Livestream ra mắt bộ sưu tập" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></label>
      <div className={styles.salesCalendarFormGrid}><label>Sàn áp dụng<select value={form.platform} onChange={event => setForm({ ...form, platform: event.target.value })}><option>Cả hai sàn</option><option>Shopee</option><option>TikTok Shop</option></select></label><label>Loại sự kiện<select value={form.type} onChange={event => setForm({ ...form, type: event.target.value })}><option>Livestream</option><option>Khuyến mãi riêng</option><option>Chiến dịch sàn</option><option>Ra mắt sản phẩm</option><option>Khác</option></select></label></div>
      <div className={styles.salesCalendarFormGrid}><label>Ngày bắt đầu<input required type="date" value={form.start} onChange={event => setForm({ ...form, start: event.target.value })} /></label><label>Ngày kết thúc<input type="date" min={form.start || undefined} value={form.end} onChange={event => setForm({ ...form, end: event.target.value })} /></label></div>
      <label>Ghi chú <span>(tuỳ chọn)</span><textarea maxLength={300} rows={3} placeholder="Sản phẩm, ưu đãi hoặc kết quả thực tế..." value={form.details} onChange={event => setForm({ ...form, details: event.target.value })} /></label>
      <p className={styles.salesCalendarModalNote}>Có thể nhập ngày trong quá khứ để lưu lại đợt sale đã chạy. Sự kiện sẽ xuất hiện trên đúng tháng trong lịch.</p><div className={styles.salesCalendarModalActions}><button type="button" onClick={() => setShowForm(false)}>Huỷ</button><button type="submit"><Check size={15} /> Thêm vào lịch</button></div>
    </form></section></div>}

    {selectedEvent && <div className={styles.salesCalendarBackdrop} onMouseDown={event => { if (event.target === event.currentTarget) setSelectedEvent(null) }}><section className={styles.salesCalendarModal} role="dialog" aria-modal="true" aria-labelledby="sale-detail-title"><div className={styles.salesCalendarModalHeading}><div><span className={styles.eyebrow}>{selectedEvent.source === 'shop' ? 'SỰ KIỆN SHOP' : selectedEvent.kind?.toUpperCase()}</span><h3 id="sale-detail-title">{selectedEvent.name}</h3></div><button type="button" aria-label="Đóng" onClick={() => setSelectedEvent(null)}><X size={18} /></button></div><div className={styles.salesCalendarSaleDetails}><p><span>Sàn</span><strong>{selectedEvent.platform}</strong></p><p><span>Thời gian</span><strong>{dateRange(selectedEvent.start, selectedEvent.end)}</strong></p>{selectedEvent.type && <p><span>Loại sự kiện</span><strong>{selectedEvent.type}</strong></p>}{selectedEvent.details && <p><span>Ghi chú</span><strong>{selectedEvent.details}</strong></p>}{selectedEvent.source !== 'shop' && <p className={styles.salesCalendarSourceNote}>Mốc tham khảo từ lịch mùa vụ. Hãy kiểm tra và đăng ký trực tiếp trên Seller Center.</p>}</div><div className={styles.salesCalendarJoinPrompt}><strong>Shop dự định tham gia đợt sale này?</strong><span>Lựa chọn này chỉ ghi nhận kế hoạch trong SmartOmni.</span><div><button type="button" className={decisions[selectedEvent.id] === 'join' ? styles.salesCalendarJoinActive : ''} onClick={() => updateDecision(selectedEvent.id, 'join')}><Check size={15} /> Tham gia</button><button type="button" className={decisions[selectedEvent.id] === 'skip' ? styles.salesCalendarSkipActive : ''} onClick={() => updateDecision(selectedEvent.id, 'skip')}><X size={15} /> Không tham gia</button></div></div></section></div>}

    {selectedDate && <div className={styles.salesCalendarBackdrop} onMouseDown={event => { if (event.target === event.currentTarget) setSelectedDate(null) }}><section className={styles.salesCalendarModal} role="dialog" aria-modal="true" aria-labelledby="sale-day-title"><div className={styles.salesCalendarModalHeading}><div><span className={styles.eyebrow}>CÁC ĐỢT SALE TRÙNG NGÀY</span><h3 id="sale-day-title">Ngày {formatDate(selectedDate)}</h3></div><button type="button" aria-label="Đóng" onClick={() => setSelectedDate(null)}><X size={18} /></button></div><div className={styles.salesCalendarDayList}>{selectedDayEvents.map(event => <button type="button" key={event.id} onClick={() => { setSelectedDate(null); setSelectedEvent(event) }}><span>{event.name}<small>{event.platform} · {event.source === 'shop' ? 'Shop tạo' : event.kind}</small></span><ChevronRight size={16} /></button>)}</div><button type="button" className={styles.salesCalendarDayAdd} onClick={() => { setSelectedDate(null); setShowForm(true) }}><Plus size={15} /> Thêm đợt sale trùng ngày</button></section></div>}
  </div>
}
