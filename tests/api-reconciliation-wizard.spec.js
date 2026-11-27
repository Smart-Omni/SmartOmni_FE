import { test, expect } from '@playwright/test'

const auth = {
  access_token: 'access-test',
  refresh_token: 'refresh-test',
  user_info: { id: 7, email: 'owner@example.test', fullName: 'API Owner', role: 'TENANT_ADMIN', tenant_id: 42, subdomain: 'test-store' },
}

const shopConnected = (name) => ({ id: 88, shopId: '727720655', shopName: name, shopRegion: 'VN', status: 'CONNECTED', needsReconnect: false })

const unifiedCatalog = {
  content: [
    {
      id: 101,
      name: 'Mechanical Keyboard',
      status: 'ACTIVE',
      skus: [
        {
          id: 1001,
          skuCode: 'KB-RED-01',
          variantName: 'Red Switch',
          basePrice: 790000,
          availableQuantity: 15,
          shopeeMapping: { id: 501, platform: 'SHOPEE', platformItemId: 'SP-101', externalSkuId: 'SP-SKU-1', sellerSku: 'KB-RED-01', platformPrice: 790000 },
          tiktokMapping: { id: 601, platform: 'TIKTOK_SHOP', platformItemId: 'TT-101', externalSkuId: 'TT-SKU-1', sellerSku: 'KB-RED-01', platformPrice: 790000 },
          suggestedMapping: null,
        },
      ],
    },
    {
      id: 102,
      name: '4K Stream Webcam',
      status: 'ACTIVE',
      skus: [
        {
          id: 1002,
          skuCode: 'CAM-4K-PRO',
          variantName: 'Standard',
          basePrice: 650000,
          availableQuantity: 8,
          shopeeMapping: { id: 502, platform: 'SHOPEE', platformItemId: 'SP-102', externalSkuId: 'SP-SKU-2', sellerSku: 'CAM-4K-PRO', platformPrice: 650000 },
          tiktokMapping: null,
          suggestedMapping: {
            platform: 'TIKTOK_SHOP',
            itemId: 'TT-102',
            externalSkuId: 'TT-SKU-2',
            sellerSku: 'TT-CAM-4K',
            name: '4K Stream Webcam Pro',
            price: 650000,
            confidence: 92,
            reason: 'Name similarity (80%) + exact price',
          },
        },
      ],
    },
    {
      id: 103,
      name: 'Aluminum Headphone Stand',
      status: 'ACTIVE',
      skus: [
        {
          id: 1003,
          skuCode: 'SP-STAND-01',
          variantName: 'Silver',
          basePrice: 320000,
          availableQuantity: 20,
          shopeeMapping: { id: 503, platform: 'SHOPEE', platformItemId: 'SP-103', externalSkuId: 'SP-SKU-3', sellerSku: 'SP-STAND-01', platformPrice: 320000 },
          tiktokMapping: null,
          suggestedMapping: null,
        },
      ],
    },
  ],
  totalPages: 1,
  totalElements: 3,
}

async function json(route, data, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ success: status < 400, data }) })
}

test('Reconciliation Wizard renders real 3-step side-by-side catalog and supports approve, unlink, and manual pair matching', async ({ page }) => {
  const reconcileCalls = []
  const unbindCalls = []

  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    const method = route.request().method()
    if (!path.startsWith('/api/')) return route.continue()

    if (path === '/api/v1/auth/login') return json(route, auth)
    if (path === '/api/v1/tenants/subscription/status') return json(route, { status: 'ACTIVE', planName: 'PRO', isPro: true })
    if (path === '/api/v1/marketplace-connections/shopee') return json(route, shopConnected('Shopee Test'))
    if (path === '/api/v1/marketplace-connections/tiktok-shop') return json(route, shopConnected('TikTok Test'))
    if (path === '/api/v1/products/unified') return json(route, unifiedCatalog)
    if (path === '/api/v1/products/mappings/unmapped') {
      const platform = new URL(route.request().url()).searchParams.get('platform')
      if (platform === 'TIKTOK_SHOP') {
        return json(route, [
          { itemId: 'TT-103', externalSkuId: 'TT-SKU-3', sellerSku: 'TT-STAND-SIL', name: 'Headphone Stand Silver', variant: 'Silver', price: 320000 },
        ])
      }
      return json(route, [])
    }
    if (path === '/api/v1/products/mappings/reconcile' && method === 'POST') {
      const body = route.request().postDataJSON()
      reconcileCalls.push(body)
      return json(route, {
        id: 700 + reconcileCalls.length,
        platform: body.platform,
        platformItemId: body.platformItemId,
        externalSkuId: body.externalSkuId,
        sellerSku: body.sellerSku,
        platformPrice: body.platformPrice,
      })
    }
    if (path.startsWith('/api/v1/products/mappings/') && method === 'DELETE') {
      unbindCalls.push(path.split('/').pop())
      return json(route, null)
    }
    return json(route, {})
  })

  await page.goto('/auth/login')
  await page.getByLabel('Email address').fill('owner@example.test')
  await page.getByLabel('Password', { exact: true }).fill('Testing@123')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/merchant\/shops$/)

  await page.goto('/merchant/manager/products')
  await expect(page.getByText('Mechanical Keyboard')).toBeVisible()

  await page.getByRole('button', { name: 'Reconciliation Wizard' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Cross-Channel Catalog Reconciliation Wizard' })
  await expect(dialog).toBeVisible()

  // Step 1: Auto-Matched side-by-side
  await expect(dialog.getByText('1. Auto-Matched (1)')).toBeVisible()
  await expect(dialog.getByText('Exact Seller SKU (KB-RED-01)')).toBeVisible()

  // Step 2: Smart Suggestions -> Approve
  await dialog.getByRole('button', { name: /2\. Smart Suggestions \(1\)/ }).click()
  await expect(dialog.getByText('92% Confidence')).toBeVisible()
  await expect(dialog.getByText('Name similarity (80%) + exact price')).toBeVisible()
  await dialog.getByRole('button', { name: 'Approve', exact: true }).click()
  await expect.poll(() => reconcileCalls.length).toBe(1)
  expect(reconcileCalls[0]).toMatchObject({ targetSkuId: 1002, platform: 'TIKTOK_SHOP', externalSkuId: 'TT-SKU-2' })

  // Step 3: Unmatched Pool -> Click Shopee item + TikTok item -> Match Selected Pair
  await dialog.getByRole('button', { name: /3\. Unmatched Pool/ }).click()
  await dialog.getByRole('button', { name: /Aluminum Headphone Stand/ }).click()
  await dialog.getByRole('button', { name: /Headphone Stand Silver/ }).click()
  await dialog.getByRole('button', { name: 'Match Selected Pair' }).click()
  await expect.poll(() => reconcileCalls.length).toBe(2)
  expect(reconcileCalls[1]).toMatchObject({ targetSkuId: 1003, platform: 'TIKTOK_SHOP', externalSkuId: 'TT-SKU-3' })

  // Step 1 now shows 3 matched pairs; unlink the first one
  await dialog.getByRole('button', { name: /1\. Auto-Matched \(3\)/ }).click()
  await dialog.getByRole('button', { name: 'Unlink' }).first().click()
  await expect.poll(() => unbindCalls.length).toBe(1)
  expect(unbindCalls[0]).toBe('601')
})
