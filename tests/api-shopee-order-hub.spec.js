import { test, expect } from '@playwright/test'
import { openWorkspacePage } from './helpers/workspace-navigation'

const base = '/api/v1/marketplace-connections/shopee'
const auth = {
  access_token: 'access-test',
  refresh_token: 'refresh-test',
  user_info: { id: 7, email: 'owner@example.test', fullName: 'API Owner', role: 'TENANT_ADMIN', tenant_id: 42, subdomain: 'test-store' },
}
const shop = { id: 88, shopId: '727720655', shopName: 'Shopee Test Shop', shopRegion: 'VN', status: 'CONNECTED', needsReconnect: false }

async function json(route, data, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify({ success: status < 400, data, ...(status >= 400 ? { message: data.message } : {}) }),
  })
}

function makeOrders(nowSec) {
  return [
    {
      orderSn: 'SP-LATER',
      orderStatus: 'READY_TO_SHIP',
      currency: 'VND',
      totalAmount: 200000,
      buyerUsername: 'buyer_later',
      recipientAddress: { name: 'Tran B', phone: '0912345678', fullAddress: '99 Nguyen Hue, District 1, HCMC' },
      items: [
        { itemId: 1, itemName: 'Item One', modelSku: 'SKU-A', modelName: 'Red', quantityPurchased: 1, discountedPrice: 50000 },
        { itemId: 2, itemName: 'Item Two', modelSku: 'SKU-B', modelName: 'Blue', quantityPurchased: 1, discountedPrice: 50000 },
        { itemId: 3, itemName: 'Item Three', modelSku: 'SKU-C', modelName: 'Green', quantityPurchased: 1, discountedPrice: 50000 },
        { itemId: 4, itemName: 'Item Four', modelSku: 'SKU-D', modelName: 'Black', quantityPurchased: 1, discountedPrice: 50000 },
      ],
      shipByDate: nowSec + 36 * 3600,
      createTime: nowSec - 12 * 3600,
      updateTime: nowSec - 10 * 3600,
      shippingCarrier: 'SPX Express',
    },
    {
      orderSn: 'SP-OVERDUE',
      orderStatus: 'READY_TO_SHIP',
      currency: 'VND',
      totalAmount: 490000,
      buyerUsername: 'buyer_urgent',
      recipientAddress: { name: 'Nguyen A', phone: '0903412889', fullAddress: '128 Nguyen Dinh Chieu, Quan 3, TP.HCM' },
      items: [
        { itemId: 1, itemName: 'Item One', modelSku: 'SKU-A', modelName: 'Red', quantityPurchased: 2, discountedPrice: 245000 },
      ],
      shipByDate: nowSec - 2 * 3600,
      createTime: nowSec - 50 * 3600,
      updateTime: nowSec - 49 * 3600,
      shippingCarrier: 'SPX Express',
    },
    {
      orderSn: 'SP-STUCK-TRANSIT',
      orderStatus: 'SHIPPED',
      currency: 'VND',
      totalAmount: 350000,
      buyerUsername: 'buyer_stuck',
      recipientAddress: { name: 'Le C', phone: '0988777666', fullAddress: '12 Le Loi, Quan 1, TP.HCM' },
      items: [
        { itemId: 5, itemName: 'Stuck Item', modelSku: 'SKU-STUCK', modelName: 'Std', quantityPurchased: 1, discountedPrice: 350000 },
      ],
      shipByDate: nowSec - 80 * 3600,
      createTime: nowSec - 120 * 3600,
      updateTime: nowSec - 80 * 3600,
      shippingCarrier: 'Giao Hang Nhanh',
      trackingNo: 'GHN998877',
    },
    {
      orderSn: 'SP-IN-CANCEL',
      orderStatus: 'IN_CANCEL',
      currency: 'VND',
      totalAmount: 199000,
      buyerUsername: 'buyer_cancel',
      recipientAddress: { name: 'Pham D', phone: '0977111222', fullAddress: '45 Ton That Tung, Quan 1, TP.HCM' },
      items: [
        { itemId: 6, itemName: 'Cancel Item', modelSku: 'SKU-CAN', modelName: 'Std', quantityPurchased: 1, discountedPrice: 199000 },
      ],
      shipByDate: nowSec + 10 * 3600,
      createTime: nowSec - 20 * 3600,
      updateTime: nowSec - 2 * 3600,
      cancelReason: 'Khach doi y',
      shippingCarrier: 'SPX Express',
    },
  ]
}

async function setupHub(page, handler = async () => false) {
  const nowSec = Math.floor(Date.now() / 1000)
  const orders = makeOrders(nowSec)
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (!path.startsWith('/api/')) return route.continue()
    if (await handler(route, path)) return
    if (path === '/api/v1/auth/login') return json(route, auth)
    if (path === '/api/v1/tenants/subscription/status') return json(route, { isPro: false, planName: 'FREE' })
    if (path === '/api/v1/tenants/subscription/invoices') return json(route, [])
    if (path === base) return json(route, shop)
    if (path === base + '/orders') return json(route, orders)
    if (path === '/api/v1/orders') throw new Error('SmartOmni local orders source must not be called')
    if (path === '/api/v1/tiktok/orders') return json(route, { orders: [] })
    throw new Error(`Unexpected API: ${route.request().method()} ${path}`)
  })
}

async function openOrdersHub(page) {
  await page.goto('/auth/login')
  await page.getByLabel('Email address').fill('owner@example.test')
  await page.getByLabel('Password', { exact: true }).fill('Testing@123')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/merchant\/shops$/)
  await openWorkspacePage(page, 'Orders', 'Đơn hàng & Vận chuyển')
}

test('excludes SmartOmni orders, sorts by SLA deadline, formats valid dates, and masks buyer PII', async ({ page }) => {
  await setupHub(page)
  await openOrdersHub(page)

  const sourceSelect = page.getByLabel('Nguồn đơn hàng')
  await expect(sourceSelect.locator('option')).toHaveText([
    'Shopee (Trực tiếp)',
    'TikTok Shop',
  ])

  const tableRows = page.locator('tbody tr')
  await expect(tableRows).toHaveCount(2)
  await expect(tableRows.nth(0)).toContainText('SP-OVERDUE')
  await expect(tableRows.nth(1)).toContainText('SP-LATER')

  // Verify valid 2026+ year formatting (regression check for year 58869 bug)
  const deadlineText = await tableRows.nth(0).textContent()
  expect(deadlineText).toMatch(/\d{1,2}\/\d{1,2}\/20\d{2}/)
  expect(deadlineText).not.toContain('58869')

  // Verify PII masking on table
  expect(deadlineText).toContain('090****889')
  expect(deadlineText).not.toContain('0903412889')

  // TikTok channel opens the TikTok order screen
  await sourceSelect.selectOption('TIKTOK')
  await expect(page.getByRole('button', { name: 'Sync TikTok orders' })).toBeVisible()
})

test('truncates long item lists on table and shows all items in enlarged detail modal with masked address', async ({ page }) => {
  await setupHub(page)
  await openOrdersHub(page)

  await page.getByRole('button', { name: '… (+2 sản phẩm khác)' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('Chi tiết đơn SP-LATER')
  await expect(dialog).toContainText('091****678')
  await expect(dialog).toContainText('******, District 1, HCMC')
  await expect(dialog).not.toContainText('99 Nguyen Hue')
  await expect(dialog.getByText('Item Four')).toBeVisible()
})

test('aggregates SKUs in Tong hop hang can soan and submits batch shipment', async ({ page }) => {
  const shippedSns = []
  await setupHub(page, async (route, path) => {
    if (path.endsWith('/shipping-parameter')) {
      await json(route, { dropoffBranches: [{ branchId: 101, address: 'Buu cuc Q1' }], pickupAddresses: [] })
      return true
    }
    if (path.endsWith('/ship')) {
      shippedSns.push(path.split('/').slice(-2, -1)[0])
      await json(route, { orderSn: shippedSns[shippedSns.length - 1], status: 'PROCESSED', trackingNumber: 'SPX999' })
      return true
    }
    return false
  })
  await openOrdersHub(page)

  await page.getByRole('button', { name: /Tổng hợp hàng cần soạn/ }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('SKU-A')
  // SP-OVERDUE (qty 2) + SP-LATER (qty 1) = 3
  await expect(dialog.locator('tbody tr').first()).toContainText('3')
  await dialog.getByRole('button', { name: /Chuẩn bị giao hàng loạt/ }).click()

  await page.getByRole('button', { name: 'Xác nhận giao hàng loạt' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByText('Đã xác nhận chuẩn bị giao hàng thành công 2 đơn trên Shopee.')).toBeVisible()
  expect(shippedSns).toEqual(['SP-OVERDUE', 'SP-LATER'])
})

test('highlights stuck orders, handles buyer cancellation, downloads AWB PDF, and shows clamped escrow', async ({ page }) => {
  let cancelOp
  await setupHub(page, async (route, path) => {
    if (path.endsWith('/SP-IN-CANCEL/handle-cancellation')) {
      cancelOp = route.request().postDataJSON()
      await json(route, { orderSn: 'SP-IN-CANCEL', success: true })
      return true
    }
    if (path.endsWith('/SP-STUCK-TRANSIT/shipping-document')) {
      await route.fulfill({ contentType: 'application/pdf', body: Buffer.from('%PDF-1.4\nmock awb') })
      return true
    }
    if (path.endsWith('/SP-STUCK-TRANSIT/escrow')) {
      await json(route, { escrowAmount: -10, buyerTotalAmount: 350000, orderOriginalPrice: 350000, commissionFee: 14000, sellerTransactionFee: 7000 })
      return true
    }
    return false
  })
  await openOrdersHub(page)

  await page.getByRole('tab', { name: /Đơn kẹt \/ Nghi thất lạc/ }).click()
  await expect(page.locator('tbody tr')).toHaveCount(1)
  await expect(page.locator('tbody tr').first()).toContainText('SP-STUCK-TRANSIT')
  await page.getByRole('button', { name: 'Báo CSKH / Tra soát' }).click()
  await expect(page.getByRole('dialog')).toContainText('GHN998877')
  await page.keyboard.press('Escape')

  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'In phiếu gửi' }).click()
  expect((await download).suggestedFilename()).toBe('AWB-SP-STUCK-TRANSIT.pdf')

  await page.getByRole('button', { name: 'Đối soát' }).click()
  await expect(page.getByRole('dialog').getByText('Thực nhận dự kiến')).toBeVisible()
  await expect(page.getByRole('dialog').getByText('Thực nhận dự kiến').locator('..')).not.toContainText('-10')
  await page.keyboard.press('Escape')

  await page.getByRole('tab', { name: /Yêu cầu hủy/ }).click()
  await page.getByRole('button', { name: 'Xử lý yêu cầu hủy' }).click()
  await page.getByRole('button', { name: 'Xác nhận quyết định' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(cancelOp).toEqual({ operation: 'ACCEPT' })
})
