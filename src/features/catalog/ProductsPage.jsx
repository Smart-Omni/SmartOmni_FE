import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Search,
  RefreshCw,
  Check,
  CheckCircle2,
  X,
  Package,
  Zap,
  Edit2,
  Star,
  AlertCircle,
  ArrowUpRight
} from 'lucide-react'
import { productApi, inventoryApi } from '@/services/api/operations'
import ReconciliationWizardModal from './components/ReconciliationWizardModal'
import { shopeeApi } from '@/services/api/shopee'
import { tiktokApi } from '@/services/api/tiktok'

function formatMoney(amount) {
  if (amount == null) return '—'
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)
}

const FALLBACK_PRODUCT_IMAGE = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='1.5'><rect width='18' height='18' x='3' y='3' rx='2'/><circle cx='9' cy='9' r='2'/><path d='m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21'/></svg>"

function resolveOptimizedImageUrl(url, size = 160) {
  if (!url) return FALLBACK_PRODUCT_IMAGE
  if (url.includes('googleusercontent.com/d/') && !url.includes('=s') && !url.includes('=w')) {
    return `${url}=s${size}`
  }
  return url
}

function resolveShopeeProductUrl(url, platformItemId) {
  if (url) {
    return url.replace('https://shopee-simulator.onrender.com/product/', 'https://shopiz-kappa.vercel.app/product/')
  }
  if (platformItemId) {
    return `https://shopiz-kappa.vercel.app/product/${platformItemId}`
  }
  return null
}

export default function ProductsPage() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [expandedIds, setExpandedIds] = useState(() => new Set())
  const [searchTerm, setSearchTerm] = useState('')
  const [channelFilter, setChannelFilter] = useState('ALL')
  const [stockFilter, setStockFilter] = useState('ALL')

  // Live Connection Status
  const [isShopeeConnected, setIsShopeeConnected] = useState(false)
  const [isTiktokConnected, setIsTiktokConnected] = useState(false)

  // Sync state
  const [isSyncingShopee, setIsSyncingShopee] = useState(false)
  const [isSyncingTiktok, setIsSyncingTiktok] = useState(false)

  // Modals
  const [mappingModal, setMappingModal] = useState(null)
  const [onboardingWizardOpen, setOnboardingWizardOpen] = useState(false)
  const [comparisonModalProduct, setComparisonModalProduct] = useState(null)
  const [toastMessage, setToastMessage] = useState(null)

  // Inline Stock Edit State
  const [editingStockSkuId, setEditingStockSkuId] = useState(null)
  const [stockInputVal, setStockInputVal] = useState('')
  const [isSavingStock, setIsSavingStock] = useState(false)

  const showToast = useCallback((msg, type = 'success') => {
    setToastMessage({ text: msg, type })
    setTimeout(() => setToastMessage(null), 4000)
  }, [])

  const isPlatformConnected = useCallback((res) => {
    if (!res) return false
    const status = String(res.status || '').toUpperCase()
    if (status === 'CONNECTED') return true
    if ((res.shopId || res.shop_id) && !['DISCONNECTED', 'ERROR', 'REVOKED'].includes(status)) {
      return true
    }
    return false
  }, [])

  // Check channel connections on mount and focus
  const checkConnections = useCallback(async () => {
    try {
      const shopeeRes = await shopeeApi.connection().catch(() => null)
      setIsShopeeConnected(isPlatformConnected(shopeeRes))
    } catch {
      setIsShopeeConnected(false)
    }

    try {
      const tiktokRes = await tiktokApi.connection().catch(() => null)
      setIsTiktokConnected(isPlatformConnected(tiktokRes))
    } catch {
      setIsTiktokConnected(false)
    }
  }, [isPlatformConnected])

  useEffect(() => {
    checkConnections()
    window.addEventListener('focus', checkConnections)
    return () => window.removeEventListener('focus', checkConnections)
  }, [checkConnections])

  // Load Unified Catalog from API
  const loadCatalog = useCallback(async () => {
    setLoading(true)
    setError(null)
    checkConnections()
    try {
      const res = await productApi.unified({ size: 100 })
      const data = res?.content || (Array.isArray(res) ? res : [])
      setProducts(data)
      if (data.length > 0) {
        setExpandedIds(new Set([data[0].id]))
      }
    } catch (err) {
      console.error('Failed to load unified catalog:', err)
      setError(err.message || 'Failed to load catalog from server.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCatalog()
  }, [loadCatalog])

  const toggleExpand = (id) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const expandAll = () => setExpandedIds(new Set(products.map(p => p.id)))
  const collapseAll = () => setExpandedIds(new Set())

  // Inline Stock Update
  const startEditStock = (skuId, currentVal) => {
    setEditingStockSkuId(skuId)
    setStockInputVal(String(currentVal ?? 0))
  }

  const saveEditStock = async (skuId) => {
    const newQty = parseInt(stockInputVal, 10)
    if (isNaN(newQty) || newQty < 0) {
      showToast('Please enter a valid stock number', 'error')
      setEditingStockSkuId(null)
      return
    }

    setIsSavingStock(true)
    try {
      await inventoryApi.adjust(skuId, newQty)
      setProducts(prev => prev.map(p => ({
        ...p,
        skus: p.skus.map(s => s.id === skuId ? { ...s, availableQuantity: newQty } : s)
      })))
      setEditingStockSkuId(null)
      showToast(`Stock updated to ${newQty}. Outbox webhook dispatched to Shopee & TikTok simulators!`)
    } catch (err) {
      console.error('Failed to adjust stock:', err)
      showToast(err.message || 'Failed to adjust stock', 'error')
    } finally {
      setIsSavingStock(false)
    }
  }

  // Bind mapping from Modal
  const handleConfirmBind = async (skuId, platform, selectedListing) => {
    try {
      await productApi.bindMapping({
        skuId,
        platform,
        platformItemId: selectedListing.itemId,
        externalSkuId: selectedListing.externalSkuId,
        sellerSku: selectedListing.sellerSku,
        platformPrice: selectedListing.price,
        productUrl: selectedListing.productUrl
      })

      setMappingModal(null)
      showToast(`Linked SKU to ${platform === 'SHOPEE' ? 'Shopee' : 'TikTok Shop'} (${selectedListing.externalSkuId})!`)
      loadCatalog()
    } catch (err) {
      console.error('Failed to bind SKU mapping:', err)
      showToast(err.message || 'Failed to bind mapping', 'error')
    }
  }

  // Unlink mapping
  const handleUnlink = async (linkId, skuCode, platformLabel) => {
    if (!window.confirm(`Unlink SKU "${skuCode}" from ${platformLabel}?`)) return
    try {
      await productApi.unbindMapping(linkId)
      showToast(`Unlinked ${skuCode} from ${platformLabel}.`)
      loadCatalog()
    } catch (err) {
      console.error('Failed to unbind mapping:', err)
      showToast(err.message || 'Failed to unlink mapping', 'error')
    }
  }

  // Sync actions
  const handleSyncShopee = async () => {
    if (!isShopeeConnected || isSyncingShopee) return
    setIsSyncingShopee(true)
    try {
      const res = await shopeeApi.importProducts()
      showToast(`Shopee sync completed: ${res?.productsSeen || res?.imported || 'Products'} processed.`)
      loadCatalog()
    } catch (err) {
      console.error('Shopee sync failed:', err)
      showToast(err.message || 'Shopee sync failed', 'error')
    } finally {
      setIsSyncingShopee(false)
    }
  }

  const handleSyncTiktok = async () => {
    if (!isTiktokConnected || isSyncingTiktok) return
    setIsSyncingTiktok(true)
    try {
      const res = await tiktokApi.autoImport()
      showToast(`TikTok Shop import ${res?.status ?? 'completed'}: ${res?.importedCount ?? 0} imported, ${res?.linkedExistingCount ?? 0} linked, ${res?.skippedCount ?? 0} skipped.${res?.status === 'STOPPED_SKU_LIMIT' ? ' Plan SKU limit reached.' : ''}`)
      loadCatalog()
    } catch (err) {
      console.error('TikTok sync failed:', err)
      showToast(err.message || 'TikTok Shop sync failed', 'error')
    } finally {
      setIsSyncingTiktok(false)
    }
  }

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchesSearch =
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.skus.some(s => s.skuCode.toLowerCase().includes(searchTerm.toLowerCase()) || (s.variantName && s.variantName.toLowerCase().includes(searchTerm.toLowerCase())))

      if (!matchesSearch) return false

      const totalAvail = product.skus.reduce((sum, s) => sum + (s.availableQuantity || 0), 0)
      if (stockFilter === 'IN_STOCK' && totalAvail <= 0) return false
      if (stockFilter === 'OUT_OF_STOCK' && totalAvail > 0) return false

      if (channelFilter === 'SHOPEE') {
        if (!product.skus.some(s => s.shopeeMapping !== null)) return false
      } else if (channelFilter === 'TIKTOK') {
        if (!product.skus.some(s => s.tiktokMapping !== null)) return false
      } else if (channelFilter === 'UNMAPPED') {
        const hasUnmapped = product.skus.some(s => {
          const missingShopee = isShopeeConnected && !s.shopeeMapping
          const missingTiktok = isTiktokConnected && !s.tiktokMapping
          if (!isShopeeConnected && !isTiktokConnected) {
            return !s.shopeeMapping && !s.tiktokMapping
          }
          return missingShopee || missingTiktok
        })
        if (!hasUnmapped) return false
      } else if (channelFilter === 'SUGGESTIONS') {
        if (!product.skus.some(s => s.suggestedMapping !== null)) return false
      }

      return true
    })
  }, [products, searchTerm, channelFilter, stockFilter, isShopeeConnected, isTiktokConnected])

  const totalSkuCount = useMemo(() => products.reduce((acc, p) => acc + p.skus.length, 0), [products])
  const unmappedSkuCount = useMemo(() => {
    return products.reduce((acc, p) => {
      return acc + p.skus.filter(s => {
        const missingShopee = isShopeeConnected && !s.shopeeMapping
        const missingTiktok = isTiktokConnected && !s.tiktokMapping
        if (!isShopeeConnected && !isTiktokConnected) {
          return !s.shopeeMapping && !s.tiktokMapping
        }
        return missingShopee || missingTiktok
      }).length
    }, 0)
  }, [products, isShopeeConnected, isTiktokConnected])

  const hasSuggestions = useMemo(() => {
    return products.some(p => p.skus.some(s => s.suggestedMapping !== null))
  }, [products])

  const canUseWizard = isShopeeConnected && isTiktokConnected

  return (
    <div style={{ display: 'grid', gap: '20px', maxWidth: '1320px', margin: '0 auto', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      
      {/* Top AI Match Banner */}
      {hasSuggestions && (
        <div style={{
          background: '#ffffff',
          border: '1px solid #171717',
          borderRadius: '12px',
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ background: '#171717', color: '#ffffff', fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px' }}>
              ✨ AI Match Engine
            </span>
            <span style={{ fontSize: '13px', color: '#171717', fontWeight: 500 }}>
              We caught newly synced marketplace listings that match your existing products!
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setChannelFilter('SUGGESTIONS')}
              style={{
                fontSize: '12px',
                fontWeight: 600,
                padding: '6px 12px',
                background: '#171717',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              Filter Suggestions &rarr;
            </button>
            {canUseWizard && (
              <button
                onClick={() => setOnboardingWizardOpen(true)}
                style={{
                  fontSize: '12px',
                  fontWeight: 500,
                  padding: '6px 12px',
                  background: '#ffffff',
                  color: '#171717',
                  border: '1px solid #e5e5e5',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                Reconciliation Wizard
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Catalog View Container */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e5e5e5',
        borderRadius: '12px',
        padding: '24px',
        display: 'grid',
        gap: '20px'
      }}>
        {/* Header with Title and Sync Actions */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '16px',
          paddingBottom: '16px',
          borderBottom: '1px solid #f0f0f0'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 600, letterSpacing: '-0.02em', color: '#171717' }}>
                Products &amp; Channel Mapping
              </h1>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#737373' }}>
              Master catalog mapped across Shopee &amp; TikTok simulators with instant stock adjustment &amp; channel analytics.
            </p>
          </div>

          {/* Sync & Wizard Buttons with Connection Gating Tooltips */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Reconciliation Wizard Button */}
            <div style={{ position: 'relative' }} title={!canUseWizard ? 'Reconciliation Wizard requires both Shopee and TikTok Shop to be connected. Go to Shop connections to link both stores.' : 'Reconcile and verify cross-channel catalog'}>
              <button
                onClick={() => canUseWizard && setOnboardingWizardOpen(true)}
                disabled={!canUseWizard}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: canUseWizard ? '#ffffff' : '#f5f5f5',
                  color: canUseWizard ? '#171717' : '#a3a3a3',
                  border: `1px solid ${canUseWizard ? '#171717' : '#e5e5e5'}`,
                  borderRadius: '8px',
                  padding: '8px 14px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: canUseWizard ? 'pointer' : 'not-allowed',
                  opacity: canUseWizard ? 1 : 0.6
                }}
              >
                <Zap size={13} />
                Reconciliation Wizard
              </button>
            </div>

            {/* Sync Shopee Button */}
            <div style={{ position: 'relative' }} title={!isShopeeConnected ? 'Shopee is not connected. Go to Shop connections to link your Shopee store.' : 'Synchronize products from Shopee Simulator'}>
              <button
                onClick={handleSyncShopee}
                disabled={!isShopeeConnected || isSyncingShopee}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: isShopeeConnected ? '#ffffff' : '#f5f5f5',
                  color: isShopeeConnected ? '#171717' : '#a3a3a3',
                  border: `1px solid ${isShopeeConnected ? '#d4d4d4' : '#e5e5e5'}`,
                  borderRadius: '8px',
                  padding: '8px 14px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: isShopeeConnected && !isSyncingShopee ? 'pointer' : 'not-allowed',
                  opacity: isShopeeConnected ? 1 : 0.6
                }}
              >
                <RefreshCw size={13} className={isSyncingShopee ? 'animate-spin' : ''} />
                {isSyncingShopee ? 'Syncing...' : 'Sync Shopee'}
              </button>
            </div>

            {/* Sync TikTok Button */}
            <div style={{ position: 'relative' }} title={!isTiktokConnected ? 'TikTok Shop is not connected. Go to Shop connections to link your TikTok store.' : 'Synchronize products from TikTok Shop Simulator'}>
              <button
                onClick={handleSyncTiktok}
                disabled={!isTiktokConnected || isSyncingTiktok}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: isTiktokConnected ? '#171717' : '#f5f5f5',
                  color: isTiktokConnected ? '#ffffff' : '#a3a3a3',
                  border: `1px solid ${isTiktokConnected ? '#171717' : '#e5e5e5'}`,
                  borderRadius: '8px',
                  padding: '8px 14px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: isTiktokConnected && !isSyncingTiktok ? 'pointer' : 'not-allowed',
                  opacity: isTiktokConnected ? 1 : 0.6
                }}
              >
                <RefreshCw size={13} className={isSyncingTiktok ? 'animate-spin' : ''} />
                {isSyncingTiktok ? 'Syncing...' : 'Sync TikTok Shop'}
              </button>
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          {/* Search Input */}
          <div style={{ position: 'relative', flex: '1', minWidth: '240px', maxWidth: '380px' }}>
            <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#a3a3a3' }} />
            <input
              type="text"
              placeholder="Search product title or SKU code..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                height: '38px',
                padding: '0 12px 0 34px',
                border: '1px solid #e5e5e5',
                borderRadius: '8px',
                fontSize: '13px',
                outline: 'none',
                background: '#fafafa',
                color: '#171717'
              }}
            />
            {searchTerm && (
              <X
                size={14}
                onClick={() => setSearchTerm('')}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: '#737373' }}
              />
            )}
          </div>

          {/* Filter Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            {[
              { id: 'ALL', label: `All (${products.length})` },
              { id: 'SHOPEE', label: 'Shopee Linked' },
              { id: 'TIKTOK', label: 'TikTok Linked' },
              { id: 'UNMAPPED', label: `Unmapped (${unmappedSkuCount})` },
              ...(hasSuggestions ? [{ id: 'SUGGESTIONS', label: '✨ Suggestions' }] : [])
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setChannelFilter(tab.id)}
                style={{
                  height: '34px',
                  padding: '0 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: channelFilter === tab.id ? 600 : 500,
                  cursor: 'pointer',
                  border: '1px solid',
                  borderColor: channelFilter === tab.id ? '#171717' : '#e5e5e5',
                  background: channelFilter === tab.id ? '#171717' : '#ffffff',
                  color: channelFilter === tab.id ? '#ffffff' : '#525252',
                  transition: 'all 0.15s ease'
                }}
              >
                {tab.label}
              </button>
            ))}

            <select
              value={stockFilter}
              onChange={e => setStockFilter(e.target.value)}
              style={{
                height: '34px',
                padding: '0 10px',
                borderRadius: '6px',
                fontSize: '12px',
                border: '1px solid #e5e5e5',
                background: '#ffffff',
                color: '#525252',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="ALL">All Stock Levels</option>
              <option value="IN_STOCK">In Stock (&gt; 0)</option>
              <option value="OUT_OF_STOCK">Out of Stock (0)</option>
            </select>

            <div style={{ display: 'flex', gap: '4px', marginLeft: '6px' }}>
              <button
                onClick={expandAll}
                style={{
                  fontSize: '11px',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  border: '1px solid #e5e5e5',
                  background: '#ffffff',
                  color: '#737373',
                  cursor: 'pointer'
                }}
              >
                Expand all
              </button>
              <button
                onClick={collapseAll}
                style={{
                  fontSize: '11px',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  border: '1px solid #e5e5e5',
                  background: '#ffffff',
                  color: '#737373',
                  cursor: 'pointer'
                }}
              >
                Collapse all
              </button>
            </div>
          </div>
        </div>

        {/* 2-Tier Product Tree Table */}
        <div style={{
          border: '1px solid #e5e5e5',
          borderRadius: '8px',
          overflow: 'hidden',
          background: '#ffffff'
        }}>
          {loading ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: '#737373' }}>
              <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px' }} />
              <p style={{ margin: 0, fontSize: '13px', fontWeight: 500 }}>Loading unified catalog...</p>
            </div>
          ) : error ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#dc2626' }}>
              <AlertCircle size={28} style={{ margin: '0 auto 10px' }} />
              <p style={{ margin: 0, fontWeight: 600 }}>{error}</p>
              <button
                onClick={loadCatalog}
                style={{ marginTop: '12px', padding: '6px 14px', background: '#171717', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}
              >
                Retry
              </button>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#fafafa', borderBottom: '1px solid #e5e5e5', color: '#737373', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <th style={{ padding: '12px 14px', width: '38px' }}></th>
                  <th style={{ padding: '12px 14px' }}>Product / SKU Code</th>
                  <th style={{ padding: '12px 14px', width: '150px' }}>Available Stock</th>
                  <th style={{ padding: '12px 14px', width: '220px' }}>Shopee (Price & Link)</th>
                  <th style={{ padding: '12px 14px', width: '220px' }}>TikTok Shop (Price & Link)</th>
                  <th style={{ padding: '12px 14px', width: '110px', textAlign: 'right' }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '40px 20px', textAlign: 'center', color: '#737373' }}>
                      <Package size={32} style={{ margin: '0 auto 10px', color: '#d4d4d4' }} />
                      <p style={{ margin: 0, fontWeight: 500 }}>No products matched your criteria.</p>
                      <span style={{ fontSize: '12px' }}>Try adjusting your search terms or filters.</span>
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map(product => {
                    const isExpanded = expandedIds.has(product.id)
                    const totalAvail = product.skus.reduce((sum, s) => sum + (s.availableQuantity || 0), 0)
                    const shopeeMappedCount = product.skus.filter(s => s.shopeeMapping).length
                    const tiktokMappedCount = product.skus.filter(s => s.tiktokMapping).length
                    const isOutOfStock = totalAvail <= 0

                    return (
                      <ProductRowGroup
                        key={product.id}
                        product={product}
                        isExpanded={isExpanded}
                        totalAvail={totalAvail}
                        shopeeMappedCount={shopeeMappedCount}
                        tiktokMappedCount={tiktokMappedCount}
                        isOutOfStock={isOutOfStock}
                        isShopeeConnected={isShopeeConnected}
                        isTiktokConnected={isTiktokConnected}
                        editingStockSkuId={editingStockSkuId}
                        stockInputVal={stockInputVal}
                        isSavingStock={isSavingStock}
                        onStartEditStock={startEditStock}
                        onStockInputChange={setStockInputVal}
                        onSaveEditStock={saveEditStock}
                        onCancelEditStock={() => setEditingStockSkuId(null)}
                        onToggle={() => toggleExpand(product.id)}
                        onOpenMapping={(sku, platform) => setMappingModal({ sku, platform, product })}
                        onOpenComparison={() => setComparisonModalProduct(product)}
                        onUnlink={handleUnlink}
                      />
                    )
                  })
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Catalog Table Footer Summary */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '12px',
          color: '#737373',
          paddingTop: '8px'
        }}>
          <div>
            Showing <strong style={{ color: '#171717' }}>{filteredProducts.length}</strong> of{' '}
            <strong style={{ color: '#171717' }}>{products.length}</strong> products ({totalSkuCount} SKU variants total)
          </div>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <span>● Click available stock to update directly</span>
            <span style={{ color: '#16a34a', fontWeight: 600 }}>API Connected</span>
          </div>
        </div>
      </div>

      {/* Visual SKU Mapping Modal */}
      {mappingModal && (
        <VisualSkuMappingModal
          sku={mappingModal.sku}
          platform={mappingModal.platform}
          product={mappingModal.product}
          onClose={() => setMappingModal(null)}
          onConfirm={handleConfirmBind}
        />
      )}

      {/* Side-by-Side Product Channel Comparison Modal */}
      {comparisonModalProduct && (
        <ProductComparisonModal
          product={comparisonModalProduct}
          onClose={() => setComparisonModalProduct(null)}
        />
      )}

      {/* Onboarding Reconciliation Wizard Modal */}
      {onboardingWizardOpen && (
        <ReconciliationWizardModal
          products={products}
          onClose={() => setOnboardingWizardOpen(false)}
          onNotify={showToast}
          onComplete={() => {
            setOnboardingWizardOpen(false)
            showToast('Catalog reconciliation completed & inventory synced!')
            loadCatalog()
          }}
        />
      )}

      {/* Floating Feedback Toast */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          background: '#171717',
          color: '#ffffff',
          borderRadius: '8px',
          padding: '12px 18px',
          fontSize: '13px',
          fontWeight: 500,
          boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          zIndex: 9999
        }}>
          <CheckCircle2 size={16} style={{ color: '#4ade80' }} />
          <span>{toastMessage.text}</span>
          <X size={14} style={{ cursor: 'pointer', marginLeft: '6px', color: '#a3a3a3' }} onClick={() => setToastMessage(null)} />
        </div>
      )}
    </div>
  )
}

// -------------------------------------------------------------
// Component: ProductRowGroup
// -------------------------------------------------------------
function ProductRowGroup({
  product,
  isExpanded,
  totalAvail,
  shopeeMappedCount,
  tiktokMappedCount,
  isOutOfStock,
  isShopeeConnected,
  isTiktokConnected,
  editingStockSkuId,
  stockInputVal,
  isSavingStock,
  onStartEditStock,
  onStockInputChange,
  onSaveEditStock,
  onCancelEditStock,
  onToggle,
  onOpenMapping,
  onOpenComparison,
  onUnlink
}) {
  const shopeePrices = product.skus.map(s => s.shopeeMapping?.platformPrice).filter(p => p != null && p > 0)
  const tiktokPrices = product.skus.map(s => s.tiktokMapping?.platformPrice).filter(p => p != null && p > 0)

  return (
    <>
      {/* Parent Product Row */}
      <tr
        onClick={onToggle}
        style={{
          borderBottom: '1px solid #e5e5e5',
          background: isExpanded ? '#fafafa' : '#ffffff',
          cursor: 'pointer',
          transition: 'background 0.1s ease'
        }}
      >
        {/* Expand / Collapse Chevron */}
        <td style={{ padding: '14px 10px 14px 14px', textAlign: 'center', color: '#737373' }}>
          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </td>

        {/* Thumbnail & Product Title with Direct Marketplace Links (PRODUCT LEVEL ONLY per instruction) */}
        <td style={{ padding: '14px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img
              src={resolveOptimizedImageUrl(product.imageUrl, 160)}
              alt=""
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              onError={e => {
                e.currentTarget.onerror = null
                e.currentTarget.src = FALLBACK_PRODUCT_IMAGE
              }}
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '6px',
                objectFit: 'cover',
                border: '1px solid #e5e5e5',
                flexShrink: 0,
                backgroundColor: '#f5f5f5'
              }}
            />
            <div>
              <div style={{ fontWeight: 600, color: '#171717', fontSize: '13px' }}>
                {product.name}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11px', color: '#737373' }}>{product.skus.length} SKU variant{product.skus.length > 1 ? 's' : ''}</span>

                {/* Direct Simulator Links on PRODUCT LEVEL ONLY */}
                {resolveShopeeProductUrl(product.shopeeProductUrl, product.skus?.[0]?.shopeeMapping?.platformItemId) && (
                  <a
                    href={resolveShopeeProductUrl(product.shopeeProductUrl, product.skus?.[0]?.shopeeMapping?.platformItemId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '2px',
                      fontSize: '11px',
                      color: '#525252',
                      textDecoration: 'none'
                    }}
                  >
                    Shopee Sim <ArrowUpRight size={11} />
                  </a>
                )}
                {product.tiktokProductUrl && (
                  <a
                    href={product.tiktokProductUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '2px',
                      fontSize: '11px',
                      color: '#525252',
                      textDecoration: 'none'
                    }}
                  >
                    TikTok Sim <ArrowUpRight size={11} />
                  </a>
                )}
              </div>
            </div>
          </div>
        </td>

        {/* Available Stock ONLY */}
        <td style={{ padding: '14px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
              fontSize: '13px',
              color: isOutOfStock ? '#dc2626' : '#171717'
            }}>
              {totalAvail} available
            </span>
          </div>
          {isOutOfStock && (
            <span style={{
              display: 'inline-block',
              fontSize: '10px',
              fontWeight: 600,
              color: '#dc2626',
              background: '#fef2f2',
              padding: '1px 5px',
              borderRadius: '3px',
              marginTop: '2px'
            }}>
              Out of stock
            </span>
          )}
        </td>

        {/* Shopee Summary Badge & Price Range */}
        <td style={{ padding: '14px 14px' }}>
          {isShopeeConnected ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '11px',
                fontWeight: 500,
                padding: '3px 8px',
                borderRadius: '12px',
                width: 'fit-content',
                background: shopeeMappedCount === product.skus.length ? '#f4f4f5' : '#fffbeb',
                color: shopeeMappedCount === product.skus.length ? '#171717' : '#b45309',
                border: `1px solid ${shopeeMappedCount === product.skus.length ? '#e4e4e7' : '#fde68a'}`
              }}>
                <span style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: shopeeMappedCount === product.skus.length ? '#171717' : '#d97706'
                }} />
                Shopee ({shopeeMappedCount}/{product.skus.length})
              </span>
              {shopeePrices.length > 0 && (
                <span style={{ fontSize: '12px', fontWeight: 500, color: '#171717', fontVariantNumeric: 'tabular-nums' }}>
                  {shopeePrices.length === 1
                    ? formatMoney(shopeePrices[0])
                    : `${formatMoney(Math.min(...shopeePrices))} - ${formatMoney(Math.max(...shopeePrices))}`}
                </span>
              )}
            </div>
          ) : (
            <span style={{ fontSize: '11px', color: '#a3a3a3', fontStyle: 'italic' }}>
              Not connected
            </span>
          )}
        </td>

        {/* TikTok Summary Badge & Price Range */}
        <td style={{ padding: '14px 14px' }}>
          {isTiktokConnected ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '11px',
                fontWeight: 500,
                padding: '3px 8px',
                borderRadius: '12px',
                width: 'fit-content',
                background: tiktokMappedCount === product.skus.length ? '#f4f4f5' : '#fffbeb',
                color: tiktokMappedCount === product.skus.length ? '#171717' : '#b45309',
                border: `1px solid ${tiktokMappedCount === product.skus.length ? '#e4e4e7' : '#fde68a'}`
              }}>
                <span style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: tiktokMappedCount === product.skus.length ? '#171717' : '#d97706'
                }} />
                TikTok ({tiktokMappedCount}/{product.skus.length})
              </span>
              {tiktokPrices.length > 0 && (
                <span style={{ fontSize: '12px', fontWeight: 500, color: '#171717', fontVariantNumeric: 'tabular-nums' }}>
                  {tiktokPrices.length === 1
                    ? formatMoney(tiktokPrices[0])
                    : `${formatMoney(Math.min(...tiktokPrices))} - ${formatMoney(Math.max(...tiktokPrices))}`}
                </span>
              )}
            </div>
          ) : (
            <span style={{ fontSize: '11px', color: '#a3a3a3', fontStyle: 'italic' }}>
              Not connected
            </span>
          )}
        </td>

        {/* Actions: View Details / Compare */}
        <td style={{ padding: '14px 14px', textAlign: 'right' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={e => { e.stopPropagation(); onOpenComparison() }}
              title="Compare side-by-side prices, ratings, and metrics across channels"
              style={{
                background: '#ffffff',
                border: '1px solid #d4d4d4',
                color: '#171717',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: '4px'
              }}
            >
              Compare
            </button>
            <button
              onClick={e => { e.stopPropagation(); onToggle() }}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#525252',
                fontSize: '11px',
                fontWeight: 500,
                cursor: 'pointer',
                padding: '4px 6px'
              }}
            >
              {isExpanded ? 'Hide' : 'SKUs'}
            </button>
          </div>
        </td>
      </tr>

      {/* Child Variant Rows */}
      {isExpanded && product.skus.map((sku, index) => {
        const isEditingThisStock = editingStockSkuId === sku.id
        const shopeePrice = sku.shopeeMapping?.platformPrice
        const tiktokPrice = sku.tiktokMapping?.platformPrice

        return (
          <tr
            key={sku.id}
            style={{
              background: index % 2 === 0 ? '#fafafa' : '#f5f5f5',
              borderBottom: '1px solid #eeeeee'
            }}
          >
            {/* Indent Guide */}
            <td style={{ padding: '10px 10px 10px 18px', textAlign: 'center', color: '#a3a3a3', fontSize: '11px' }}>
              └─
            </td>

            {/* Variant Name & Monospace SKU Code */}
            <td style={{ padding: '10px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  fontSize: '11px',
                  fontWeight: 600,
                  background: '#ffffff',
                  border: '1px solid #d4d4d4',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  color: '#171717'
                }}>
                  {sku.skuCode}
                </span>
                <span style={{ fontSize: '12px', color: '#525252' }}>
                  {sku.variantName}
                </span>
              </div>
            </td>

            {/* Direct In-Table Stock Edit */}
            <td style={{ padding: '10px 14px', fontVariantNumeric: 'tabular-nums', fontSize: '12px' }}>
              {isEditingThisStock ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input
                    type="number"
                    min="0"
                    autoFocus
                    disabled={isSavingStock}
                    value={stockInputVal}
                    onChange={e => onStockInputChange(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') onSaveEditStock(sku.id)
                      if (e.key === 'Escape') onCancelEditStock()
                    }}
                    style={{
                      width: '60px',
                      height: '26px',
                      padding: '0 6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      border: '1px solid #171717',
                      borderRadius: '4px',
                      outline: 'none'
                    }}
                  />
                  <button
                    onClick={() => onSaveEditStock(sku.id)}
                    disabled={isSavingStock}
                    title="Save & sync outbox"
                    style={{
                      background: '#171717',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '4px 6px',
                      cursor: 'pointer'
                    }}
                  >
                    <Check size={11} />
                  </button>
                  <button
                    onClick={onCancelEditStock}
                    disabled={isSavingStock}
                    title="Cancel"
                    style={{
                      background: 'transparent',
                      color: '#737373',
                      border: 'none',
                      padding: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    <X size={11} />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => onStartEditStock(sku.id, sku.availableQuantity)}
                  title="Click to adjust central stock and sync with Shopee & TikTok"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    transition: 'background 0.1s ease'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#e5e5e5'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <strong style={{ color: (sku.availableQuantity || 0) > 0 ? '#171717' : '#dc2626' }}>
                    {sku.availableQuantity ?? 0}
                  </strong>
                  <Edit2 size={11} style={{ color: '#a3a3a3' }} />
                </div>
              )}
            </td>

            {/* Shopee Channel Linkage & Price */}
            <td style={{ padding: '10px 14px' }}>
              {sku.shopeeMapping ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '11px',
                      fontWeight: 500,
                      padding: '2px 7px',
                      borderRadius: '4px',
                      background: '#ffffff',
                      color: '#171717',
                      border: '1px solid #d4d4d4'
                    }}
                  >
                    <Check size={11} style={{ color: '#16a34a' }} />
                    Linked
                  </span>
                  {sku.shopeeMapping.platformPrice && (
                    <span style={{ fontSize: '11px', color: '#525252', fontVariantNumeric: 'tabular-nums' }}>
                      {formatMoney(sku.shopeeMapping.platformPrice)}
                    </span>
                  )}
                  <button
                    onClick={() => onUnlink(sku.shopeeMapping.id, sku.skuCode, 'Shopee')}
                    title="Unlink Shopee mapping"
                    style={{ background: 'transparent', border: 'none', color: '#a3a3a3', cursor: 'pointer', padding: '2px' }}
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => isShopeeConnected && onOpenMapping(sku, 'SHOPEE')}
                  disabled={!isShopeeConnected}
                  title={!isShopeeConnected ? 'Shopee is not connected. Go to Shop connections to link your Shopee store.' : 'Link this SKU with a Shopee product'}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    fontWeight: 500,
                    padding: '3px 8px',
                    borderRadius: '4px',
                    background: isShopeeConnected ? '#ffffff' : '#f5f5f5',
                    border: `1px dashed ${isShopeeConnected ? '#a3a3a3' : '#e5e5e5'}`,
                    color: isShopeeConnected ? '#171717' : '#a3a3a3',
                    cursor: isShopeeConnected ? 'pointer' : 'not-allowed'
                  }}
                >
                  + Link Shopee
                </button>
              )}
            </td>

            {/* TikTok Channel Linkage & Price */}
            <td style={{ padding: '10px 14px' }}>
              {sku.tiktokMapping ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '11px',
                      fontWeight: 500,
                      padding: '2px 7px',
                      borderRadius: '4px',
                      background: '#ffffff',
                      color: '#171717',
                      border: '1px solid #d4d4d4'
                    }}
                  >
                    <Check size={11} style={{ color: '#16a34a' }} />
                    Linked
                  </span>
                  {sku.tiktokMapping.platformPrice && (
                    <span style={{ fontSize: '11px', color: '#525252', fontVariantNumeric: 'tabular-nums' }}>
                      {formatMoney(sku.tiktokMapping.platformPrice)}
                    </span>
                  )}
                  <button
                    onClick={() => onUnlink(sku.tiktokMapping.id, sku.skuCode, 'TikTok Shop')}
                    title="Unlink TikTok mapping"
                    style={{ background: 'transparent', border: 'none', color: '#a3a3a3', cursor: 'pointer', padding: '2px' }}
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => isTiktokConnected && onOpenMapping(sku, 'TIKTOK_SHOP')}
                  disabled={!isTiktokConnected}
                  title={!isTiktokConnected ? 'TikTok Shop is not connected. Go to Shop connections to link your TikTok store.' : 'Link this SKU with a TikTok Shop product'}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    fontWeight: 500,
                    padding: '3px 8px',
                    borderRadius: '4px',
                    background: isTiktokConnected ? '#ffffff' : '#f5f5f5',
                    border: `1px dashed ${isTiktokConnected ? '#a3a3a3' : '#e5e5e5'}`,
                    color: isTiktokConnected ? '#171717' : '#a3a3a3',
                    cursor: isTiktokConnected ? 'pointer' : 'not-allowed'
                  }}
                >
                  + Link TikTok
                </button>
              )}
            </td>

            {/* SKU ID */}
            <td style={{ padding: '10px 14px', textAlign: 'right', color: '#a3a3a3', fontSize: '11px', fontFamily: 'monospace' }}>
              #{sku.id}
            </td>
          </tr>
        )
      })}
    </>
  )
}

// -------------------------------------------------------------
// Component: VisualSkuMappingModal
// -------------------------------------------------------------
function VisualSkuMappingModal({ sku, platform, product, onClose, onConfirm }) {
  const [filterText, setFilterText] = useState('')
  const [loading, setLoading] = useState(true)
  const [unmappedListings, setUnmappedListings] = useState([])
  const [selectedListing, setSelectedListing] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const platformLabel = platform === 'SHOPEE' ? 'Shopee' : 'TikTok Shop'

  useEffect(() => {
    async function loadPool() {
      setLoading(true)
      try {
        const res = await productApi.unmappedListings(platform)
        const pool = Array.isArray(res) ? res : (res?.data || [])
        setUnmappedListings(pool)

        // Pre-select AI suggested match if present
        if (sku.suggestedMapping && sku.suggestedMapping.platform === platform) {
          const match = pool.find(i => i.externalSkuId === sku.suggestedMapping.externalSkuId)
          if (match) {
            setSelectedListing(match)
            return
          }
        }
        setSelectedListing(pool[0] || null)
      } catch (err) {
        console.error('Failed to load unmapped listings:', err)
      } finally {
        setLoading(false)
      }
    }
    loadPool()
  }, [platform, sku.suggestedMapping])

  const filteredListings = unmappedListings.filter(item =>
    (item.name && item.name.toLowerCase().includes(filterText.toLowerCase())) ||
    (item.externalSkuId && item.externalSkuId.toLowerCase().includes(filterText.toLowerCase())) ||
    (item.sellerSku && item.sellerSku.toLowerCase().includes(filterText.toLowerCase()))
  )

  const sortedListings = useMemo(() => {
    return [...filteredListings].sort((a, b) => {
      const aIsMatch = sku.suggestedMapping?.externalSkuId === a.externalSkuId ? 1 : 0
      const bIsMatch = sku.suggestedMapping?.externalSkuId === b.externalSkuId ? 1 : 0
      return bIsMatch - aIsMatch
    })
  }, [filteredListings, sku.suggestedMapping])

  const handleConfirm = async () => {
    if (!selectedListing || submitting) return
    setSubmitting(true)
    try {
      await onConfirm(sku.id, platform, selectedListing)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.45)',
      backdropFilter: 'blur(2px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: '16px'
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: '12px',
        border: '1px solid #e5e5e5',
        width: '100%',
        maxWidth: '560px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#171717' }}>
              Select {platformLabel} Listing to Map
            </h3>
            <span style={{ fontSize: '12px', color: '#737373' }}>
              Pick from detected unmapped listings synced from your marketplace store
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#737373', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        {/* Target SKU Summary Card */}
        <div style={{ padding: '16px 24px 0' }}>
          <div style={{
            background: '#fafafa',
            border: '1px solid #e5e5e5',
            borderRadius: '8px',
            padding: '12px 16px',
            fontSize: '12px'
          }}>
            <div style={{ color: '#737373', marginBottom: '4px' }}>Target Internal SKU</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{
                fontFamily: 'monospace',
                fontWeight: 700,
                fontSize: '13px',
                background: '#ffffff',
                border: '1px solid #d4d4d4',
                padding: '2px 8px',
                borderRadius: '4px',
                color: '#171717'
              }}>
                {sku.skuCode}
              </span>
              <span style={{ fontWeight: 600, color: '#171717' }}>{sku.variantName}</span>
              <span style={{ color: '#737373' }}>• {formatMoney(sku.basePrice)}</span>
            </div>
            <div style={{ marginTop: '4px', fontSize: '11px', color: '#a3a3a3' }}>
              Product: {product.name}
            </div>
          </div>
        </div>

        {/* Search */}
        <div style={{ padding: '12px 24px 0' }}>
          <input
            type="text"
            placeholder={`Filter ${platformLabel} listings...`}
            value={filterText}
            onChange={e => setFilterText(e.target.value)}
            style={{
              width: '100%',
              height: '34px',
              padding: '0 10px',
              border: '1px solid #e5e5e5',
              borderRadius: '6px',
              fontSize: '12px',
              outline: 'none'
            }}
          />
        </div>

        {/* Listings Pool */}
        <div style={{ padding: '12px 24px 16px', maxHeight: '280px', overflowY: 'auto', display: 'grid', gap: '8px' }}>
          {loading ? (
            <div style={{ padding: '30px 0', textAlign: 'center', color: '#737373', fontSize: '12px' }}>
              Loading unmapped listings...
            </div>
          ) : sortedListings.length === 0 ? (
            <div style={{ padding: '30px 0', textAlign: 'center', color: '#737373', fontSize: '12px' }}>
              No unmapped listings found for this store.
            </div>
          ) : (
            sortedListings.map(item => {
              const isSelected = selectedListing?.externalSkuId === item.externalSkuId
              const isRecommended = sku.suggestedMapping?.externalSkuId === item.externalSkuId

              return (
                <div
                  key={item.externalSkuId}
                  onClick={() => setSelectedListing(item)}
                  style={{
                    border: '1px solid',
                    borderColor: isSelected ? '#171717' : '#e5e5e5',
                    background: isSelected ? '#fafafa' : '#ffffff',
                    borderRadius: '8px',
                    padding: '12px 14px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                    <div>
                      {isRecommended && (
                        <span style={{
                          display: 'inline-block',
                          background: '#171717',
                          color: '#ffffff',
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: '3px',
                          marginBottom: '4px'
                        }}>
                          ★ Recommended Match ({sku.suggestedMapping.confidence}%)
                        </span>
                      )}
                      <div style={{ fontWeight: 600, fontSize: '13px', color: '#171717' }}>
                        {item.name}
                      </div>
                      <div style={{ fontSize: '11px', color: '#737373', marginTop: '2px' }}>
                        Ext SKU: <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#171717' }}>{item.externalSkuId}</span>
                        {item.sellerSku && <span> • Seller SKU: {item.sellerSku}</span>}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '13px', color: '#171717', fontVariantNumeric: 'tabular-nums' }}>
                        {formatMoney(item.price)}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 24px',
          borderTop: '1px solid #f0f0f0',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '8px',
          background: '#fafafa'
        }}>
          <button
            onClick={onClose}
            disabled={submitting}
            style={{
              padding: '8px 14px',
              background: '#ffffff',
              border: '1px solid #d4d4d4',
              borderRadius: '6px',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedListing || submitting}
            style={{
              padding: '8px 16px',
              background: '#171717',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: selectedListing && !submitting ? 'pointer' : 'not-allowed',
              opacity: selectedListing && !submitting ? 1 : 0.6
            }}
          >
            {submitting ? 'Linking...' : 'Confirm Link'}
          </button>
        </div>
      </div>
    </div>
  )
}

// -------------------------------------------------------------
// Component: ProductComparisonModal
// -------------------------------------------------------------
function ProductComparisonModal({ product, onClose }) {
  const shopeeSku = product.skus.find(s => s.shopeeMapping)?.shopeeMapping
  const tiktokSku = product.skus.find(s => s.tiktokMapping)?.tiktokMapping

  const shopeePrice = shopeeSku?.platformPrice
  const tiktokPrice = tiktokSku?.platformPrice
  const hasPriceVariance = shopeePrice && tiktokPrice && shopeePrice !== tiktokPrice

  const [shopeeMetrics, setShopeeMetrics] = useState(null)
  const [shopeeCategory, setShopeeCategory] = useState(null)
  const [loadingMetrics, setLoadingMetrics] = useState(false)

  useEffect(() => {
    if (!shopeeSku?.platformItemId) {
      setShopeeMetrics(null)
      setShopeeCategory(null)
      return
    }
    let isMounted = true
    setLoadingMetrics(true)

    Promise.allSettled([
      fetch(`https://shopee-simulator.onrender.com/api/v2/simulator/product/extra_info?shop_id=727720655&item_id_list=${shopeeSku.platformItemId}`).then(r => r.json()),
      fetch(`https://shopee-simulator.onrender.com/api/v2/simulator/product/detail?item_id=${shopeeSku.platformItemId}`).then(r => r.json())
    ]).then(([extraRes, detailRes]) => {
      if (!isMounted) return
      if (extraRes.status === 'fulfilled') {
        const metric = extraRes.value?.response?.item_list?.[0]
        setShopeeMetrics(metric || null)
      }
      if (detailRes.status === 'fulfilled') {
        const cat = detailRes.value?.response?.product?.category?.category_name
        setShopeeCategory(cat || null)
      }
    }).catch(err => {
      console.warn('Failed to load Shopee product extra_info:', err)
      if (isMounted) {
        setShopeeMetrics(null)
        setShopeeCategory(null)
      }
    }).finally(() => {
      if (isMounted) setLoadingMetrics(false)
    })

    return () => {
      isMounted = false
    }
  }, [shopeeSku?.platformItemId])

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.45)',
      backdropFilter: 'blur(2px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: '16px'
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: '12px',
        border: '1px solid #e5e5e5',
        width: '100%',
        maxWidth: '820px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#171717' }}>
              Product Channel Comparison
            </h3>
            <span style={{ fontSize: '12px', color: '#737373' }}>
              Side-by-side pricing, inventory, and simulator product links across channels
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#737373', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '20px 24px', display: 'grid', gap: '20px' }}>
          {/* Product Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', paddingBottom: '16px', borderBottom: '1px solid #f0f0f0' }}>
            <img
              src={resolveOptimizedImageUrl(product.imageUrl, 240)}
              alt=""
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              onError={e => {
                e.currentTarget.onerror = null
                e.currentTarget.src = FALLBACK_PRODUCT_IMAGE
              }}
              style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #e5e5e5', backgroundColor: '#f5f5f5' }}
            />
            <div>
              <div style={{ fontWeight: 600, fontSize: '15px', color: '#171717' }}>{product.name}</div>
              <div style={{ fontSize: '12px', color: '#737373', marginTop: '2px' }}>{product.skus.length} SKU variant{product.skus.length > 1 ? 's' : ''}</div>
            </div>
          </div>

          {/* 3 Columns */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '16px' }}>
            {/* SmartOmni Master */}
            <div style={{ background: '#fafafa', border: '1px solid #e5e5e5', borderRadius: '8px', padding: '16px', display: 'grid', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '13px', color: '#171717' }}>SmartOmni Master</strong>
                <span style={{ fontSize: '10px', background: '#e4e4e7', color: '#525252', padding: '1px 5px', borderRadius: '3px', fontWeight: 600 }}>INTERNAL</span>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#737373' }}>Central Available Stock</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#171717', fontVariantNumeric: 'tabular-nums' }}>
                  {product.skus.reduce((sum, s) => sum + (s.availableQuantity || 0), 0)} units
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#737373' }}>Internal Base Price</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#171717', fontVariantNumeric: 'tabular-nums' }}>
                  {product.skus.length === 1
                    ? formatMoney(product.skus[0].basePrice)
                    : `${formatMoney(Math.min(...product.skus.map(s => s.basePrice || 0)))} - ${formatMoney(Math.max(...product.skus.map(s => s.basePrice || 0)))}`}
                </div>
              </div>
            </div>

            {/* Shopee Simulator */}
            <div style={{ background: '#ffffff', border: '1px solid #e5e5e5', borderRadius: '8px', padding: '16px', display: 'grid', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '13px', color: '#171717' }}>Shopee Simulator</strong>
                {resolveShopeeProductUrl(product.shopeeProductUrl, shopeeSku?.platformItemId) && (
                  <a
                    href={resolveShopeeProductUrl(product.shopeeProductUrl, shopeeSku?.platformItemId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: '11px', color: '#525252', display: 'inline-flex', alignItems: 'center', gap: '2px', textDecoration: 'none' }}
                  >
                    Visit ↗
                  </a>
                )}
              </div>
              {shopeeSku ? (
                <>
                  <div>
                    <div style={{ fontSize: '11px', color: '#737373' }}>Channel Listing Price</div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#171717', fontVariantNumeric: 'tabular-nums' }}>
                      {formatMoney(shopeePrice)}
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', paddingTop: '4px', borderTop: '1px solid #f0f0f0' }}>
                    <div>
                      <div style={{ fontSize: '10px', color: '#737373', textTransform: 'uppercase' }}>Rating</div>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#171717', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        {loadingMetrics ? (
                          <span style={{ color: '#a3a3a3', fontSize: '11px', fontWeight: 400 }}>Loading...</span>
                        ) : shopeeMetrics ? (
                          <>
                            <Star size={11} fill={shopeeMetrics.rating_star > 0 ? "#eab308" : "none"} color={shopeeMetrics.rating_star > 0 ? "#eab308" : "#a3a3a3"} />
                            {shopeeMetrics.rating_star > 0 ? Number(shopeeMetrics.rating_star).toFixed(1) : '0.0'}
                            <span style={{ color: '#a3a3a3', fontSize: '10px' }}>({shopeeMetrics.comment_count ?? 0})</span>
                          </>
                        ) : (
                          <span style={{ color: '#a3a3a3', fontSize: '11px', fontWeight: 400 }}>—</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '10px', color: '#737373', textTransform: 'uppercase' }}>Units Sold</div>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#171717', fontVariantNumeric: 'tabular-nums' }}>
                        {loadingMetrics ? (
                          <span style={{ color: '#a3a3a3', fontSize: '11px', fontWeight: 400 }}>Loading...</span>
                        ) : (
                          `${shopeeMetrics?.sale ?? 0} sold`
                        )}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', paddingTop: '6px', borderTop: '1px solid #f0f0f0' }}>
                    <span style={{ color: '#737373' }}>Category</span>
                    <span style={{ fontWeight: 500, color: shopeeCategory ? '#171717' : '#a3a3a3' }}>
                      {loadingMetrics ? 'Loading...' : (shopeeCategory || '—')}
                    </span>
                  </div>
                </>
              ) : (
                <div style={{ color: '#a3a3a3', fontSize: '12px', padding: '20px 0', textAlign: 'center' }}>
                  Not listed on Shopee
                </div>
              )}
            </div>

            {/* TikTok Shop Simulator */}
            <div style={{ background: '#ffffff', border: '1px solid #e5e5e5', borderRadius: '8px', padding: '16px', display: 'grid', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '13px', color: '#171717' }}>TikTok Simulator</strong>
                {product.tiktokProductUrl && (
                  <a href={product.tiktokProductUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: '#525252', display: 'inline-flex', alignItems: 'center', gap: '2px', textDecoration: 'none' }}>
                    Visit ↗
                  </a>
                )}
              </div>
              {tiktokSku ? (
                <>
                  <div>
                    <div style={{ fontSize: '11px', color: '#737373' }}>Channel Listing Price</div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#171717', fontVariantNumeric: 'tabular-nums' }}>
                      {formatMoney(tiktokPrice)}
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', paddingTop: '4px', borderTop: '1px solid #f0f0f0' }}>
                    <div>
                      <div style={{ fontSize: '10px', color: '#737373', textTransform: 'uppercase' }}>Rating</div>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#171717', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <span style={{ color: '#a3a3a3', fontSize: '11px', fontWeight: 400 }}>—</span>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '10px', color: '#737373', textTransform: 'uppercase' }}>Units Sold</div>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#171717', fontVariantNumeric: 'tabular-nums' }}>
                        <span style={{ color: '#a3a3a3', fontSize: '11px', fontWeight: 400 }}>—</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', paddingTop: '6px', borderTop: '1px solid #f0f0f0' }}>
                    <span style={{ color: '#737373' }}>Category</span>
                    <span style={{ color: '#a3a3a3' }}>—</span>
                  </div>
                </>
              ) : (
                <div style={{ color: '#a3a3a3', fontSize: '12px', padding: '20px 0', textAlign: 'center' }}>
                  Not listed on TikTok Shop
                </div>
              )}
            </div>
          </div>

          {/* Price Variance Warning Banner */}
          {hasPriceVariance && (
            <div style={{
              background: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: '8px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontSize: '12px',
              color: '#92400e'
            }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>
                <strong>Price Variance Detected:</strong> Shopee listing is priced at {formatMoney(shopeePrice)} while TikTok Shop is {formatMoney(tiktokPrice)} (diff of {formatMoney(Math.abs(shopeePrice - tiktokPrice))}).
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid #f0f0f0', display: 'flex', justifyContent: 'flex-end', background: '#fafafa' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', background: '#171717', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
            Close Comparison
          </button>
        </div>
      </div>
    </div>
  )
}

