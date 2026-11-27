import { useState } from 'react'
import { ArrowDownRight, ArrowUpRight, CalendarDays, CircleHelp, Clock3, PackageCheck, ShoppingBag, TrendingUp } from 'lucide-react'
import { MarketplaceLogo } from '@/shared/components/MarketplaceLogo'
import styles from './InsightsDemo.module.css'

const periods = {
  '7 ngày': {
    label: '21–27 Thg 11, 2026',
    shopee: { sales: 24680000, orders: 148, aov: 166757, refunds: 540000, cancelRate: '2,7%', trend: '+8,4%', orderSeries: [[18, '21'], [20, '22'], [19, '23'], [17, '24'], [23, '25'], [25, '26'], [26, '27']] },
    tiktok: { sales: 19820000, orders: 126, aov: 157302, refunds: 710000, cancelRate: '3,2%', trend: '+12,1%', orderSeries: [[13, '21'], [15, '22'], [16, '23'], [17, '24'], [18, '25'], [23, '26'], [24, '27']] },
    chart: [[28, 25], [35, 31], [42, 38], [34, 29], [49, 43], [58, 55], [62, 59]],
    charges: { shopee: [1480000, 680000, 540000, 120000, 80000], tiktok: [1310000, 720000, 610000, null, 95000] },
    products: {
      shopee: [
        { name: 'Túi tote Everyday · Màu tự nhiên', sku: 'ET-NT-01', units: 56, sales: 8960000 }, { name: 'Ly gốm · Màu cát', sku: 'CM-SD-02', units: 43, sales: 6450000 }, { name: 'Vỏ gối linen · Xanh olive', sku: 'LC-OL-04', units: 29, sales: 4930000 },
        { name: 'Áo sơ mi linen · Trắng', sku: 'LS-WH-03', units: 24, sales: 4560000 }, { name: 'Túi đeo chéo Mini', sku: 'BG-MN-02', units: 26, sales: 4420000 }, { name: 'Bình giữ nhiệt 500ml', sku: 'BT-500-01', units: 31, sales: 4340000 },
        { name: 'Nến thơm · Gỗ tuyết tùng', sku: 'CN-CD-05', units: 27, sales: 4050000 }, { name: 'Khay gỗ chữ nhật', sku: 'WD-RT-02', units: 18, sales: 3780000 }, { name: 'Túi đựng laptop 13 inch', sku: 'LB-13-01', units: 15, sales: 3600000 }, { name: 'Sổ tay bìa vải', sku: 'NB-FB-04', units: 32, sales: 3520000 },
      ],
      tiktok: [
        { name: 'Ly gốm · Màu cát', sku: 'CM-SD-02', units: 52, sales: 7800000 }, { name: 'Túi tote Everyday · Màu tự nhiên', sku: 'ET-NT-01', units: 44, sales: 7040000 }, { name: 'Bàn phím cơ · Trắng', sku: 'MK-WH-08', units: 31, sales: 4960000 },
        { name: 'Áo sơ mi linen · Trắng', sku: 'LS-WH-03', units: 25, sales: 4750000 }, { name: 'Bình giữ nhiệt 500ml', sku: 'BT-500-01', units: 33, sales: 4620000 }, { name: 'Vỏ gối linen · Xanh olive', sku: 'LC-OL-04', units: 26, sales: 4420000 },
        { name: 'Túi đeo chéo Mini', sku: 'BG-MN-02', units: 25, sales: 4250000 }, { name: 'Nến thơm · Gỗ tuyết tùng', sku: 'CN-CD-05', units: 27, sales: 4050000 }, { name: 'Khay gỗ chữ nhật', sku: 'WD-RT-02', units: 19, sales: 3990000 }, { name: 'Sổ tay bìa vải', sku: 'NB-FB-04', units: 34, sales: 3740000 },
      ],
    },
  },
  '30 ngày': {
    label: '29 Thg 10–27 Thg 11, 2026',
    shopee: { sales: 98420000, orders: 592, aov: 166250, refunds: 2140000, cancelRate: '2,9%', trend: '+6,8%', orderSeries: [[96, '29/10–02/11'], [89, '03–07/11'], [102, '08–12/11'], [91, '13–17/11'], [108, '18–22/11'], [106, '23–27/11']] },
    tiktok: { sales: 79360000, orders: 504, aov: 157460, refunds: 2860000, cancelRate: '3,5%', trend: '+10,6%', orderSeries: [[80, '29/10–02/11'], [72, '03–07/11'], [83, '08–12/11'], [77, '13–17/11'], [99, '18–22/11'], [93, '23–27/11']] },
    chart: [[32, 28], [38, 34], [42, 39], [46, 41], [52, 49], [58, 55], [66, 61]],
    charges: { shopee: [5680000, 2740000, 2140000, 430000, 310000], tiktok: [4930000, 2860000, 2860000, null, 390000] },
    products: {
      shopee: [
        { name: 'Túi tote Everyday · Màu tự nhiên', sku: 'ET-NT-01', units: 224, sales: 35840000 }, { name: 'Ly gốm · Màu cát', sku: 'CM-SD-02', units: 173, sales: 25950000 }, { name: 'Vỏ gối linen · Xanh olive', sku: 'LC-OL-04', units: 116, sales: 19720000 },
        { name: 'Áo sơ mi linen · Trắng', sku: 'LS-WH-03', units: 96, sales: 18240000 }, { name: 'Túi đeo chéo Mini', sku: 'BG-MN-02', units: 104, sales: 17680000 }, { name: 'Bình giữ nhiệt 500ml', sku: 'BT-500-01', units: 124, sales: 17360000 },
        { name: 'Nến thơm · Gỗ tuyết tùng', sku: 'CN-CD-05', units: 108, sales: 16200000 }, { name: 'Khay gỗ chữ nhật', sku: 'WD-RT-02', units: 72, sales: 15120000 }, { name: 'Túi đựng laptop 13 inch', sku: 'LB-13-01', units: 60, sales: 14400000 }, { name: 'Sổ tay bìa vải', sku: 'NB-FB-04', units: 128, sales: 14080000 },
      ],
      tiktok: [
        { name: 'Ly gốm · Màu cát', sku: 'CM-SD-02', units: 208, sales: 31200000 }, { name: 'Túi tote Everyday · Màu tự nhiên', sku: 'ET-NT-01', units: 181, sales: 28960000 }, { name: 'Bàn phím cơ · Trắng', sku: 'MK-WH-08', units: 128, sales: 20480000 },
        { name: 'Áo sơ mi linen · Trắng', sku: 'LS-WH-03', units: 100, sales: 19000000 }, { name: 'Bình giữ nhiệt 500ml', sku: 'BT-500-01', units: 132, sales: 18480000 }, { name: 'Vỏ gối linen · Xanh olive', sku: 'LC-OL-04', units: 104, sales: 17680000 },
        { name: 'Túi đeo chéo Mini', sku: 'BG-MN-02', units: 100, sales: 17000000 }, { name: 'Nến thơm · Gỗ tuyết tùng', sku: 'CN-CD-05', units: 108, sales: 16200000 }, { name: 'Khay gỗ chữ nhật', sku: 'WD-RT-02', units: 76, sales: 15960000 }, { name: 'Sổ tay bìa vải', sku: 'NB-FB-04', units: 136, sales: 14960000 },
      ],
    },
  },
}

const chargeLabels = ['Phí sàn', 'Vận chuyển shop chịu', 'Tiền hoàn cho khách', 'Phí ship hàng hoàn', 'Phí khác / điều chỉnh']
const chargeColors = ['#568eb9', '#5a9b83', '#e1a05c', '#d48278', '#99aaa4']
const money = value => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value)
const number = value => new Intl.NumberFormat('vi-VN').format(value)

export default function ApiSalesInsights() {
  const [period, setPeriod] = useState('7 ngày')
  const data = periods[period]
  const totalSales = data.shopee.sales + data.tiktok.sales
  const totalOrders = data.shopee.orders + data.tiktok.orders
  return <div className={styles.page}>
    <div className={styles.pageHeading}>
      <div><span className={styles.eyebrow}><ShoppingBag size={14} /> HIỆU QUẢ THEO KÊNH</span><h2>So sánh hiệu quả hai sàn.</h2><p>Theo dõi doanh số hàng hóa và các tín hiệu vận hành của từng kênh.</p></div>
      <span className={styles.demoPill}><span />Dữ liệu minh họa</span>
    </div>

    <div className={styles.toolbar}><div className={styles.periodSwitch} role="group" aria-label="Khoảng thời gian báo cáo">{Object.keys(periods).map(value => <button key={value} aria-pressed={period === value} onClick={() => setPeriod(value)}>{value}</button>)}</div><span className={styles.dateLabel}><CalendarDays size={15} />{data.label}<span>· GMT+7</span></span><span className={styles.sampleStatus}><i />Dữ liệu mẫu</span></div>

    <div className={styles.metricGrid}>
      <article className={styles.metricCard}><span className={styles.metricLabel}>Tổng giá trị hàng hóa <CircleHelp size={14} /></span><strong>{money(totalSales)}</strong><span className={styles.metricFoot}>Sau giảm giá do shop tài trợ · trước hoàn tiền</span><span className={styles.metricIcon}><TrendingUp size={18} /></span></article>
      <article className={styles.metricCard}><span className={styles.metricLabel}>Số đơn thành công <CircleHelp size={14} /></span><strong>{number(totalOrders)}</strong><span className={styles.metricFoot}>Đơn hợp lệ trong hai kênh mẫu</span><span className={styles.metricIcon}><ShoppingBag size={18} /></span></article>
      <article className={styles.metricCard}><span className={styles.metricLabel}>Tiền hoàn theo phiếu đã xác nhận · mẫu <CircleHelp size={14} /></span><strong>{money(data.shopee.refunds + data.tiktok.refunds)}</strong><span className={styles.metricFoot}>Không phải tổng giá trị của các đơn bị trả</span><span className={styles.metricIcon}><ArrowDownRight size={18} /></span></article>
      <article className={styles.metricCard}><span className={styles.metricLabel}>So với kỳ trước <CircleHelp size={14} /></span><strong className={styles.twoTrend}><span><b className={styles.shopeeText}>S</b> {data.shopee.trend}</span><span><b className={styles.tiktokText}>T</b> {data.tiktok.trend}</span></strong><span className={styles.metricFoot}>So sánh với kỳ trước có cùng độ dài</span><span className={styles.metricIcon}><ArrowUpRight size={18} /></span></article>
    </div>

    <div className={styles.channelGrid}>
      <ChannelCard marketplace="shopee" label="Shopee" data={data.shopee} products={data.products.shopee} max={Math.max(data.shopee.sales, data.tiktok.sales)} deductions={data.charges.shopee} period={period} />
      <ChannelCard marketplace="tiktok" label="TikTok Shop" data={data.tiktok} products={data.products.tiktok} max={Math.max(data.shopee.sales, data.tiktok.sales)} deductions={data.charges.tiktok} period={period} />
    </div>
    <p className={styles.definitionNote}>Tiền hoàn là tổng số tiền ghi nhận trên các yêu cầu hoàn đã xác nhận, không phải toàn bộ giá trị của đơn bị trả. Báo cáo thật cần đối soát với giao dịch tài chính cuối cùng và tránh cộng trùng giữa phiếu hoàn với giao dịch hoàn tiền.</p>

    <section className={styles.card}>
      <div className={styles.sectionTitle}><div><h3>Xu hướng bán hàng theo thời gian</h3><p>So sánh giá trị hàng hóa của Shopee và TikTok Shop trong cùng kỳ</p></div><span className={styles.legend}><i className={styles.shopeeDot} />Shopee <i className={styles.tiktokDot} />TikTok Shop</span></div>
      <div className={styles.lineChartWrap} role="img" aria-label={`Biểu đồ đường so sánh xu hướng giá trị hàng hóa mẫu của Shopee và TikTok Shop trong ${period}`}>
        <svg className={styles.lineChart} viewBox="0 0 700 190" preserveAspectRatio="none" aria-hidden="true">
          {[20, 60, 100, 140, 180].map(y => <line key={y} x1="0" y1={y} x2="700" y2={y} className={styles.chartGridLine} />)}
          <path d={lineArea(data.chart.map(point => point[0]))} className={styles.shopeeArea} />
          <path d={lineArea(data.chart.map(point => point[1]))} className={styles.tiktokArea} />
          <polyline points={linePoints(data.chart.map(point => point[0]))} className={styles.shopeeLine} />
          <polyline points={linePoints(data.chart.map(point => point[1]))} className={styles.tiktokLine} />
          {data.chart.map(([shopee, tiktok], index) => <g key={index}>
            <circle cx={chartX(index, data.chart.length)} cy={chartY(shopee)} r="4" className={styles.shopeePoint} />
            <circle cx={chartX(index, data.chart.length)} cy={chartY(tiktok)} r="4" className={styles.tiktokPoint} />
          </g>)}
        </svg>
        <div className={styles.lineChartDates}>{(period === '7 ngày' ? ['21', '22', '23', '24', '25', '26', '27'] : ['29/10', '03/11', '08/11', '13/11', '18/11', '23/11', '27/11']).map((day, index) => <span key={index}>{day}</span>)}</div>
      </div>
      <div className={styles.chartFoot}><span><CircleHelp size={14} />Chỉ số xu hướng minh họa để so sánh hai đường; chưa phải doanh thu VND từng ngày.</span><span>Dữ liệu mẫu</span></div>
    </section>

    <section className={styles.card}>
      <div className={styles.sectionTitle}><div><h3>Nên bổ sung tín hiệu nào?</h3><p>Để giải thích kết quả theo từng kênh rõ hơn</p></div></div>
      <div className={styles.signalGrid}>
        <div><span className={styles.signalIcon}><PackageCheck size={17} /></span><strong>Chất lượng đơn hàng</strong><p>Tỷ lệ hủy, hoàn, lý do và mốc trạng thái theo quy tắc rõ ràng.</p></div>
        <div><span className={styles.signalIcon}><Clock3 size={17} /></span><strong>Độ đầy đủ dữ liệu</strong><p>Thời điểm đồng bộ, ngày bị thiếu và danh sách shop nằm trong báo cáo.</p></div>
        <div><span className={styles.signalIcon}><TrendingUp size={17} /></span><strong>Cơ cấu sản phẩm</strong><p>Sản phẩm dẫn đầu theo giá trị và số lượng, kèm trạng thái ghép SKU.</p></div>
      </div>
    </section>

    <div className={styles.dataDefinition}><CircleHelp size={16} /><p><strong>Định nghĩa:</strong> doanh số và số đơn dùng đơn thành công; giá trị hàng hóa đã trừ giảm giá do shop tài trợ nhưng chưa trừ tiền hoàn. Tiền hoàn tính riêng theo số tiền hoàn trên phiếu đã xác nhận, không lấy nguyên giá trị đơn. Các chỉ số này không đồng nghĩa doanh thu kế toán, tiền sàn trả về hay lợi nhuận. Trang không gọi API sàn.</p></div>
    <p className={styles.disclaimer}>Chỉ dùng để xem giao diện · Số liệu và biểu đồ đều là dữ liệu giả lập. Báo cáo thật cần thể hiện nguồn, chính sách trạng thái, mốc thời gian, dữ liệu thiếu và lần đồng bộ gần nhất.</p>
  </div>
}

function ChannelCard({ marketplace, label, data, products, max, deductions, period }) {
  const shopee = marketplace === 'shopee'
  const validDeductions = deductions.map((value, index) => value == null ? null : ({ label: shopee ? chargeLabels[index] : ['Phí sàn & thuế', 'Chi phí vận chuyển', 'Tiền hoàn', 'Phí ship hàng hoàn', 'Phí khác / điều chỉnh'][index], value, color: chargeColors[index] })).filter(Boolean)
  const totalDeductions = validDeductions.reduce((sum, item) => sum + item.value, 0)
  let position = 0
  const pie = validDeductions.map(item => {
    const start = position
    position += item.value / totalDeductions * 100
    return `${item.color} ${start}% ${position}%`
  }).join(', ')
  const receivedEstimate = Math.max(0, data.sales - totalDeductions)
  const maxOrders = Math.max(...data.orderSeries.map(([count]) => count))
  return <section className={`${styles.channelCard} ${shopee ? styles.channelShopee : styles.channelTiktok}`}>
    <div className={styles.channelHeader}><div><MarketplaceLogo marketplace={marketplace} size={30} decorative /><div><span>SÀN THƯƠNG MẠI</span><h3>{label}</h3></div></div><span className={`${styles.channelTrend} ${shopee ? styles.shopeeTrend : styles.tiktokTrend}`}><TrendingUp size={14} />{data.trend}</span></div>
    <div className={styles.channelSales}><span>Giá trị hàng hóa</span><strong>{money(data.sales)}</strong><div className={styles.progress}><span style={{ width: `${data.sales / max * 100}%` }} /></div></div>
    <div className={styles.channelStats}><div><span>Số đơn thành công</span><strong>{number(data.orders)}</strong></div><div><span>Giá trị đơn TB</span><strong>{money(data.aov)}</strong></div><div><span>Tiền hoàn cho khách · mẫu</span><strong>{money(data.refunds)}</strong></div><div><span>Tỷ lệ hủy</span><strong>{data.cancelRate}</strong></div></div>
    <div className={styles.orderTrend}>
      <div className={styles.orderTrendHeader}><div><strong>Đơn hàng được đặt</strong><span>{period === '7 ngày' ? 'Số đơn theo ngày' : 'Số đơn theo từng giai đoạn'}</span></div><b>{number(data.orders)} <small>đơn</small></b></div>
      <div className={styles.orderBars} role="img" aria-label={`Số đơn hàng của ${label}: ${data.orderSeries.map(([count, day]) => `${day}: ${count}`).join(', ')}`}>
        {data.orderSeries.map(([count, day]) => <div className={styles.orderBarColumn} key={day}><span>{count}</span><i style={{ height: `${Math.max(8, count / maxOrders * 100)}%` }} /><small>{day}</small></div>)}
      </div>
    </div>
    <div className={styles.receivedBlock}>
      <div className={styles.receivedHeader}><div><span>Giá trị thực nhận</span><strong>{money(receivedEstimate)}</strong></div><span className={styles.estimatedBadge}>Ước tính mẫu</span></div>
      <p className={styles.pieCaption}>Tổng khoản trừ mẫu: <strong>{money(totalDeductions)}</strong></p>
      <div className={styles.financeChartRow}>
        <div className={styles.pieChart} role="img" aria-label={`Tổng khoản trừ mẫu ${money(totalDeductions)} của ${label}; các lát thể hiện tỷ trọng từng khoản trong tổng này, không phải tỷ lệ trên doanh thu`} style={{ background: `conic-gradient(${pie})` }}><span><small>Tổng khoản trừ</small><strong>{money(totalDeductions)}</strong></span></div>
        <div className={styles.financeLegend}>
          <div className={styles.financeLegendHeader}><span>Khoản trừ</span><span>Số tiền · tỷ trọng trong khoản trừ</span></div>
          {validDeductions.map(item => <div className={styles.financeLegendItem} key={item.label}><i style={{ background: item.color }} /><span>{item.label}</span><strong>{money(item.value)}</strong><small>{(item.value / totalDeductions * 100).toFixed(0)}%</small></div>)}
          <p>{shopee ? 'Số liệu minh họa, chưa phải đối soát cuối kỳ.' : 'Phí ship hàng hoàn chưa có dữ liệu nên không nằm trong tổng trừ minh họa.'}</p>
        </div>
      </div>
      <p className={styles.financeFormula}>Mô phỏng: giá trị hàng hóa − các khoản trừ mẫu. Chưa gồm mọi trợ giá, phí thuế, tiền ship khách trả hoặc điều chỉnh; không phải số tiền chuyển về ngân hàng.</p>
    </div>
    <ProductList products={products} />
  </section>
}

function ProductList({ products }) {
  return <div className={styles.channelProducts}>
      <div className={styles.channelProductsHeading}><h4>Sản phẩm bán chạy</h4><span>Top 10 · kỳ này</span></div>
    <div className={styles.productDataHeader}><span>Sản phẩm · Số lượng bán thành công</span><span>Giá trị hàng hóa</span></div>
    {products.map((product, index) => <div className={styles.productRow} key={product.sku}><span className={styles.rank}>{String(index + 1).padStart(2, '0')}</span><div className={styles.productName}><strong>{product.name}</strong><span>{product.sku} · {number(product.units)} sản phẩm đã bán thành công</span></div><strong className={styles.productSales}>{money(product.sales)}</strong></div>)}
    <p className={styles.channelProductsNote}>Giá trị là tổng dòng hàng trong đơn thành công sau giảm giá shop tài trợ, trước hoàn tiền. SKU chưa đối chiếu sẽ được tách riêng.</p>
  </div>
}

function chartX(index, count) { return 8 + index * (684 / (count - 1)) }
function chartY(value) { return 174 - (value - 20) * 2.8 }
function linePoints(values) { return values.map((value, index) => `${chartX(index, values.length)},${chartY(value)}`).join(' ') }
function lineArea(values) {
  const points = values.map((value, index) => `${chartX(index, values.length)},${chartY(value)}`)
  return `M ${points[0]} L ${points.slice(1).join(' L ')} L 692,180 L 8,180 Z`
}
