import { useMemo, useState } from 'react'
import { CalendarDays, Check, Clock3, Plus, Radio, Sparkles, Store, Tag, X } from 'lucide-react'
import styles from './InsightsDemo.module.css'

const EVENT_STORAGE_KEY = 'smartomni-demo-shop-sales-events'
const months = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12']
const doubleDays = Array.from({ length: 12 }, (_, index) => `${index + 1}.${index + 1}`)

function getBlackFriday(year) {
  const date = new Date(year, 10, 30)
  while (date.getDay() !== 5) date.setDate(date.getDate() - 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function makeSchedule(year) {
  const schedule = Array.from({ length: 12 }, (_, index) => ({ month: index, events: [] }))
  const add = (month, label, platform, kind = 'Lịch tham khảo') => schedule[month].events.push({ label, platform, kind })
  for (let month = 0; month < 12; month += 1) {
    const day = month + 1
    add(month, `${day}.${day}`, 'Cả hai sàn', 'Ngày đôi')
    add(month, `Ngày ${day}, 15, 25`, 'Shopee', 'Lịch hàng tháng')
    add(month, 'Ngày 13–15', 'TikTok Shop', 'Giữa tháng')
    add(month, 'Ngày 24–25', 'TikTok Shop', 'Lương về')
  }
  add(0, 'Tết & mùa xuân · tháng 1–2', 'Cả hai sàn', 'Theo mùa')
  add(1, 'Tết & mùa xuân · tháng 1–2', 'Cả hai sàn', 'Theo mùa')
  add(5, '6.6 · cao điểm giữa năm', 'Cả hai sàn', 'Chiến dịch lớn')
  add(8, '9.9 · mở đầu mùa cao điểm', 'Cả hai sàn', 'Chiến dịch lớn')
  add(9, '10.10', 'Cả hai sàn', 'Ngày đôi')
  add(9, '20.10 · Ngày Phụ nữ Việt Nam', 'Shopee', 'Theo mùa')
  add(10, `Black Friday · ${new Date(`${getBlackFriday(year)}T00:00:00`).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}`, 'Cả hai sàn', 'Theo mùa')
  add(11, '12.12', 'Cả hai sàn', 'Ngày đôi')
  if (year === 2026) add(11, '5–15.12 · chiến dịch TikTok Shop 2026', 'TikTok Shop', 'Cần xác nhận')
  add(11, 'Giáng sinh & năm mới', 'Shopee', 'Theo mùa')
  add(2, '8.3 · Ngày Quốc tế Phụ nữ', 'Shopee', 'Theo mùa')
  return schedule
}

function readSavedEvents() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(EVENT_STORAGE_KEY) || '[]')
    return Array.isArray(saved) ? saved : []
  } catch {
    return []
  }
}

function formatDate(date) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function ApiSalesCalendar() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [events, setEvents] = useState(readSavedEvents)
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState('Tất cả')
  const [eventForm, setEventForm] = useState({ name: '', platform: 'Cả hai sàn', type: 'Livestream', start: '', end: '', status: 'Dự kiến', details: '' })
  const schedule = useMemo(() => makeSchedule(year), [year])
  const visibleEvents = events.filter(event => filter === 'Tất cả' || (filter === 'Sắp tới' ? event.start >= today.toISOString().slice(0, 10) : event.start < today.toISOString().slice(0, 10)))
    .sort((a, b) => a.start.localeCompare(b.start))

  const saveEvent = event => {
    event.preventDefault()
    const newEvent = { ...eventForm, id: `shop-event-${Date.now()}`, end: eventForm.end || eventForm.start }
    const next = [...events, newEvent]
    setEvents(next)
    window.localStorage.setItem(EVENT_STORAGE_KEY, JSON.stringify(next))
    setEventForm({ name: '', platform: 'Cả hai sàn', type: 'Livestream', start: '', end: '', status: 'Dự kiến', details: '' })
    setShowForm(false)
  }

  return <div className={styles.salesCalendar}>
    <header className={styles.salesCalendarHero}>
      <div><span className={styles.eyebrow}><CalendarDays size={15} /> KẾ HOẠCH BÁN HÀNG</span><h2>Lên kế hoạch cho mùa cao điểm</h2><p>Ghi lại mùa sale của sàn và kế hoạch riêng của shop để AI có thêm bối cảnh khi phân tích.</p></div>
      <button type="button" className={styles.salesCalendarAdd} onClick={() => setShowForm(true)}><Plus size={16} /> Thêm sự kiện</button>
    </header>

    <div className={styles.salesCalendarNotice}><Clock3 size={17} /><p><strong>Lịch sàn chỉ mang tính dự kiến.</strong> Ngày và điều kiện tham gia có thể thay đổi theo từng chiến dịch; hãy xác nhận trong Seller Center. Sự kiện shop nhập chỉ được lưu trên trình duyệt ở bản demo.</p></div>

    <section className={styles.salesCalendarPatterns} aria-labelledby="sale-patterns-title">
      <div className={styles.salesCalendarSectionHead}><div><span className={styles.eyebrow}>MÙA SALE THAM KHẢO</span><h3 id="sale-patterns-title">Nhịp bán hàng trong năm</h3></div><label className={styles.salesCalendarYear}>Năm<select value={year} onChange={event => setYear(Number(event.target.value))}><option value={today.getFullYear() - 1}>{today.getFullYear() - 1}</option><option value={today.getFullYear()}>{today.getFullYear()}</option><option value={today.getFullYear() + 1}>{today.getFullYear() + 1}</option></select></label></div>
      <div className={styles.salesCalendarPlatformGrid}>
        <article className={`${styles.salesCalendarPlatform} ${styles.salesCalendarShopee}`}><div className={styles.salesCalendarPlatformTitle}><span className={styles.salesCalendarPlatformDot} /><div><strong>Shopee</strong><small>Ngày lặp lại & mùa mua sắm</small></div></div><div className={styles.salesCalendarPattern}><Tag size={15} /><p><strong>Ngày đôi</strong><span>{doubleDays.join(' · ')}</span></p></div><div className={styles.salesCalendarPattern}><CalendarDays size={15} /><p><strong>Nhịp hàng tháng</strong><span>Ngày 1 · 15 · 25</span></p></div><div className={styles.salesCalendarPattern}><Sparkles size={15} /><p><strong>Mùa & dịp nổi bật</strong><span>Tết (tháng 1–2), 8.3, 6.6, 20.10, Black Friday, Giáng sinh & năm mới</span></p></div></article>
        <article className={`${styles.salesCalendarPlatform} ${styles.salesCalendarTiktok}`}><div className={styles.salesCalendarPlatformTitle}><span className={styles.salesCalendarPlatformDot} /><div><strong>TikTok Shop</strong><small>Ngày lặp lại & chiến dịch theo mùa</small></div></div><div className={styles.salesCalendarPattern}><Tag size={15} /><p><strong>Ngày đôi</strong><span>{doubleDays.join(' · ')}</span></p></div><div className={styles.salesCalendarPattern}><CalendarDays size={15} /><p><strong>Giữa tháng & lương về</strong><span>Khoảng ngày 13–15 · 24–25 hàng tháng</span></p></div><div className={styles.salesCalendarPattern}><Sparkles size={15} /><p><strong>Mùa cao điểm</strong><span>1.1–3.3 đầu năm · 4.4–8.8 giữa năm · 9.9–12.12, Black Friday cuối năm</span></p></div></article>
      </div>
    </section>

    <section className={styles.salesCalendarTimeline} aria-labelledby="sales-calendar-year-title">
      <div className={styles.salesCalendarSectionHead}><div><span className={styles.eyebrow}>TỔNG QUAN THEO THÁNG</span><h3 id="sales-calendar-year-title">Các mốc sale dự kiến · {year}</h3></div><span className={styles.salesCalendarKey}><i /> Mốc tham khảo</span></div>
      <div className={styles.salesCalendarMonthGrid}>{schedule.map(month => <article className={styles.salesCalendarMonth} key={month.month}><h4>{months[month.month]}</h4><div>{month.events.map((event, index) => <div className={styles.salesCalendarMonthEvent} key={`${event.label}-${index}`}><span className={event.platform === 'Shopee' ? styles.salesCalendarShopeePill : event.platform === 'TikTok Shop' ? styles.salesCalendarTikTokPill : styles.salesCalendarBothPill}>{event.platform === 'Cả hai sàn' ? 'Shopee · TikTok' : event.platform}</span><p>{event.label}</p></div>)}</div></article>)}</div>
    </section>

    <section className={styles.salesCalendarCustom} aria-labelledby="shop-events-title">
      <div className={styles.salesCalendarSectionHead}><div><span className={styles.eyebrow}>KẾ HOẠCH RIÊNG CỦA SHOP</span><h3 id="shop-events-title">Sự kiện của bạn</h3><p>Thêm cả sự kiện đã diễn ra lẫn kế hoạch sắp tới để lưu bối cảnh bán hàng.</p></div><div className={styles.salesCalendarEventControls}><div className={styles.salesCalendarFilters}>{['Tất cả', 'Sắp tới', 'Đã qua'].map(option => <button key={option} type="button" aria-pressed={filter === option} onClick={() => setFilter(option)}>{option}</button>)}</div><button type="button" className={styles.salesCalendarAddSecondary} onClick={() => setShowForm(true)}><Plus size={15} /> Thêm sự kiện</button></div></div>
      {visibleEvents.length ? <div className={styles.salesCalendarEventList}>{visibleEvents.map(event => <article className={styles.salesCalendarEvent} key={event.id}><div className={styles.salesCalendarEventIcon}><Radio size={17} /></div><div className={styles.salesCalendarEventInfo}><div className={styles.salesCalendarEventTitle}><strong>{event.name}</strong><span>{event.status}</span></div><p>{event.platform} · {event.type} · {formatDate(event.start)}{event.end !== event.start ? ` – ${formatDate(event.end)}` : ''}</p>{event.details && <small>{event.details}</small>}</div></article>)}</div> : <div className={styles.salesCalendarEmpty}><Store size={22} /><strong>Chưa có sự kiện {filter === 'Sắp tới' ? 'sắp tới' : filter === 'Đã qua' ? 'đã qua' : 'nào'}</strong><span>Thêm livestream, chương trình giảm giá hoặc chiến dịch riêng của shop.</span><button type="button" onClick={() => setShowForm(true)}><Plus size={15} /> Tạo sự kiện đầu tiên</button></div>}
      <div className={styles.salesCalendarAiNote}><Sparkles size={16} /><p><strong>Dữ liệu này giúp AI phân tích sát thực tế hơn.</strong> Về sau, sự kiện đã qua có thể được đối chiếu với đơn hàng và doanh số thực tế; sự kiện tương lai chỉ dùng làm bối cảnh/kịch bản khi shop xác nhận.</p></div>
    </section>

    {showForm && <div className={styles.salesCalendarBackdrop} onMouseDown={event => { if (event.target === event.currentTarget) setShowForm(false) }}><section className={styles.salesCalendarModal} role="dialog" aria-modal="true" aria-labelledby="sales-event-modal-title"><div className={styles.salesCalendarModalHeading}><div><span className={styles.eyebrow}><CalendarDays size={14} /> SỰ KIỆN CỦA SHOP</span><h3 id="sales-event-modal-title">Thêm kế hoạch bán hàng</h3></div><button type="button" aria-label="Đóng" onClick={() => setShowForm(false)}><X size={18} /></button></div><form onSubmit={saveEvent}>
      <label>Tên sự kiện<input required maxLength={100} placeholder="Ví dụ: Livestream ra mắt bộ sưu tập" value={eventForm.name} onChange={event => setEventForm({ ...eventForm, name: event.target.value })} /></label>
      <div className={styles.salesCalendarFormGrid}><label>Sàn áp dụng<select value={eventForm.platform} onChange={event => setEventForm({ ...eventForm, platform: event.target.value })}><option>Cả hai sàn</option><option>Shopee</option><option>TikTok Shop</option></select></label><label>Loại sự kiện<select value={eventForm.type} onChange={event => setEventForm({ ...eventForm, type: event.target.value })}><option>Livestream</option><option>Khuyến mãi riêng</option><option>Chiến dịch sàn</option><option>Ra mắt sản phẩm</option><option>Khác</option></select></label></div>
      <div className={styles.salesCalendarFormGrid}><label>Ngày bắt đầu<input required type="date" value={eventForm.start} onChange={event => setEventForm({ ...eventForm, start: event.target.value })} /></label><label>Ngày kết thúc<input type="date" min={eventForm.start || undefined} value={eventForm.end} onChange={event => setEventForm({ ...eventForm, end: event.target.value })} /></label></div>
      <label>Trạng thái<select value={eventForm.status} onChange={event => setEventForm({ ...eventForm, status: event.target.value })}><option>Dự kiến</option><option>Đã đăng ký</option><option>Đã xác nhận</option><option>Đã diễn ra</option><option>Đã hủy</option></select></label>
      <label>Ghi chú <span>(tuỳ chọn)</span><textarea maxLength={300} rows={3} placeholder="Sản phẩm tham gia, ưu đãi, kết quả thực tế..." value={eventForm.details} onChange={event => setEventForm({ ...eventForm, details: event.target.value })} /></label>
      <p className={styles.salesCalendarModalNote}>Bản demo lưu trên trình duyệt hiện tại. Ngày trong quá khứ được hỗ trợ để ghi lại chiến dịch đã chạy.</p><div className={styles.salesCalendarModalActions}><button type="button" onClick={() => setShowForm(false)}>Huỷ</button><button type="submit"><Check size={15} /> Lưu sự kiện</button></div>
    </form></section></div>}
  </div>
}
