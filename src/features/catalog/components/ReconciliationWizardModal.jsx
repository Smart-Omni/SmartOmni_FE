import React, { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Link2, Sparkles, Unlink, X } from 'lucide-react'
import { productApi } from '@/services/api/operations'

const formatPrice = (val) => {
  if (val == null) return '—'
  return `${Number(val).toLocaleString('vi-VN')} ₫`
}

export default function ReconciliationWizardModal({ products = [], onClose, onComplete, onNotify }) {
  const [activeTab, setActiveTab] = useState('AUTO')
  const [unmappedShopee, setUnmappedShopee] = useState([])
  const [unmappedTiktok, setUnmappedTiktok] = useState([])
  const [loadingPools, setLoadingPools] = useState(true)
  const [busyKey, setBusyKey] = useState(null)

  const [dismissedSkuIds, setDismissedSkuIds] = useState(() => new Set())
  const [approvedSkuIds, setApprovedSkuIds] = useState(() => new Set())
  const [unlinkedSkuIds, setUnlinkedSkuIds] = useState(() => new Set())
  const [customMatchedPairs, setCustomMatchedPairs] = useState([])

  const [selectedShopee, setSelectedShopee] = useState(null)
  const [selectedTiktok, setSelectedTiktok] = useState(null)

  const loadUnmapped = async () => {
    setLoadingPools(true)
    try {
      const [spRes, ttRes] = await Promise.all([
        productApi.unmappedListings('SHOPEE').catch(() => []),
        productApi.unmappedListings('TIKTOK_SHOP').catch(() => [])
      ])
      setUnmappedShopee(Array.isArray(spRes) ? spRes : (Array.isArray(spRes?.data) ? spRes.data : []))
      setUnmappedTiktok(Array.isArray(ttRes) ? ttRes : (Array.isArray(ttRes?.data) ? ttRes.data : []))
    } finally {
      setLoadingPools(false)
    }
  }

  useEffect(() => {
    loadUnmapped()
  }, [])

  const { autoMatched, suggestions, shopeePool, tiktokPool } = useMemo(() => {
    const auto = []
    const suggest = []
    const spOnly = []
    const ttOnly = []

    const matchedExternalKeys = new Set()
    for (const pair of customMatchedPairs) {
      if (pair.shopee?.externalSkuId) matchedExternalKeys.add(`SHOPEE:${pair.shopee.externalSkuId}`)
      if (pair.tiktok?.externalSkuId) matchedExternalKeys.add(`TIKTOK:${pair.tiktok.externalSkuId}`)
    }

    for (const product of products) {
      for (const sku of product.skus || []) {
        const sp = sku.shopeeMapping
        const tt = sku.tiktokMapping
        const wasUnlinked = unlinkedSkuIds.has(sku.id)

        if (sp && tt && !wasUnlinked) {
          const exactSku =
            sp.sellerSku &&
            tt.sellerSku &&
            sp.sellerSku.trim().toLowerCase() === tt.sellerSku.trim().toLowerCase()
          auto.push({
            skuId: sku.id,
            productName: product.name,
            variantName: sku.variantName,
            skuCode: sku.skuCode,
            shopee: sp,
            tiktok: tt,
            reason: exactSku ? `Exact Seller SKU (${sp.sellerSku})` : 'Linked cross-channel SKU'
          })
          continue
        }

        if (
          sku.suggestedMapping &&
          !approvedSkuIds.has(sku.id) &&
          !dismissedSkuIds.has(sku.id) &&
          !wasUnlinked
        ) {
          suggest.push({
            skuId: sku.id,
            productName: product.name,
            variantName: sku.variantName,
            skuCode: sku.skuCode,
            basePrice: sku.basePrice,
            shopee: sp,
            tiktok: tt,
            suggestion: sku.suggestedMapping
          })
        }

        if (sp && (!tt || wasUnlinked) && !matchedExternalKeys.has(`SHOPEE:${sp.externalSkuId}`)) {
          spOnly.push({
            key: `sku-sp-${sku.id}`,
            skuId: sku.id,
            linkId: sp.id,
            productName: product.name,
            variantName: sku.variantName,
            sellerSku: sp.sellerSku || sku.skuCode,
            platformItemId: sp.platformItemId,
            externalSkuId: sp.externalSkuId,
            price: sp.platformPrice ?? sku.basePrice,
            productUrl: sp.productUrl
          })
        }

        if (tt && !sp && !wasUnlinked && !matchedExternalKeys.has(`TIKTOK:${tt.externalSkuId}`)) {
          ttOnly.push({
            key: `sku-tt-${sku.id}`,
            skuId: sku.id,
            linkId: tt.id,
            productName: product.name,
            variantName: sku.variantName,
            sellerSku: tt.sellerSku || sku.skuCode,
            platformItemId: tt.platformItemId,
            externalSkuId: tt.externalSkuId,
            price: tt.platformPrice ?? sku.basePrice,
            productUrl: tt.productUrl
          })
        }
      }
    }

    const seenSp = new Set(spOnly.map(i => i.externalSkuId).filter(Boolean))
    for (const item of unmappedShopee) {
      if (!matchedExternalKeys.has(`SHOPEE:${item.externalSkuId}`) && !seenSp.has(item.externalSkuId)) {
        seenSp.add(item.externalSkuId)
        spOnly.push({
          key: `unmapped-sp-${item.itemId}-${item.externalSkuId}`,
          skuId: null,
          linkId: null,
          productName: item.name,
          variantName: item.variant,
          sellerSku: item.sellerSku,
          platformItemId: item.itemId,
          externalSkuId: item.externalSkuId,
          price: item.price,
          productUrl: item.productUrl
        })
      }
    }

    const seenTt = new Set(ttOnly.map(i => i.externalSkuId).filter(Boolean))
    for (const item of unmappedTiktok) {
      if (!matchedExternalKeys.has(`TIKTOK:${item.externalSkuId}`) && !seenTt.has(item.externalSkuId)) {
        seenTt.add(item.externalSkuId)
        ttOnly.push({
          key: `unmapped-tt-${item.itemId}-${item.externalSkuId}`,
          skuId: null,
          linkId: null,
          productName: item.name,
          variantName: item.variant,
          sellerSku: item.sellerSku,
          platformItemId: item.itemId,
          externalSkuId: item.externalSkuId,
          price: item.price,
          productUrl: item.productUrl
        })
      }
    }

    return {
      autoMatched: [...auto, ...customMatchedPairs],
      suggestions: suggest,
      shopeePool: spOnly,
      tiktokPool: ttOnly
    }
  }, [products, unmappedShopee, unmappedTiktok, dismissedSkuIds, approvedSkuIds, unlinkedSkuIds, customMatchedPairs])

  const handleUnlink = async (row) => {
    const targetLinkId = row.tiktok?.id || row.shopee?.id
    if (!targetLinkId) return
    setBusyKey(`unlink-${row.skuId}`)
    try {
      await productApi.unbindMapping(targetLinkId)
      setUnlinkedSkuIds(prev => new Set(prev).add(row.skuId))
      onNotify?.(`Unlinked ${row.skuCode || row.productName} — moved to Unmatched Pool`)
      await loadUnmapped()
    } catch (err) {
      onNotify?.(err.message || 'Failed to unlink mapping', 'error')
    } finally {
      setBusyKey(null)
    }
  }

  const handleApproveSuggestion = async (item) => {
    const sug = item.suggestion
    setBusyKey(`approve-${item.skuId}`)
    try {
      const payload = {
        targetSkuId: item.skuId,
        platform: sug.platform,
        platformItemId: sug.itemId,
        externalSkuId: sug.externalSkuId,
        sellerSku: sug.sellerSku,
        platformPrice: sug.price,
        productUrl: sug.productUrl
      }
      const res = await productApi.reconcileMapping(payload)
      const createdLink = (res?.externalSkuId ? res : res?.data) || {
        platform: sug.platform,
        platformItemId: sug.itemId,
        externalSkuId: sug.externalSkuId,
        sellerSku: sug.sellerSku,
        platformPrice: sug.price
      }
      setApprovedSkuIds(prev => new Set(prev).add(item.skuId))
      setCustomMatchedPairs(prev => [
        ...prev,
        {
          skuId: item.skuId,
          productName: item.productName,
          variantName: item.variantName,
          skuCode: item.skuCode,
          shopee: sug.platform === 'SHOPEE' ? createdLink : item.shopee,
          tiktok: sug.platform === 'TIKTOK_SHOP' ? createdLink : item.tiktok,
          reason: `Approved Smart Suggestion (${sug.confidence}% · ${sug.reason || 'High confidence'})`
        }
      ])
      onNotify?.(`Approved match for ${item.productName}`)
    } catch (err) {
      onNotify?.(err.message || 'Failed to approve suggestion', 'error')
    } finally {
      setBusyKey(null)
    }
  }

  const handleApproveAllSuggestions = async () => {
    for (const item of suggestions) {
      // eslint-disable-next-line no-await-in-loop
      await handleApproveSuggestion(item)
    }
  }

  const handleMatchSelectedPair = async () => {
    if (!selectedShopee || !selectedTiktok) return
    setBusyKey('match-pair')
    try {
      const targetSkuId = selectedShopee.skuId || selectedTiktok.skuId
      if (!targetSkuId) {
        onNotify?.('At least one side must have a SmartOmni SKU to bind.', 'error')
        setBusyKey(null)
        return
      }
      const bindingTiktok = Boolean(selectedShopee.skuId)
      const source = bindingTiktok ? selectedTiktok : selectedShopee
      const platform = bindingTiktok ? 'TIKTOK_SHOP' : 'SHOPEE'

      const res = await productApi.reconcileMapping({
        targetSkuId,
        platform,
        platformItemId: source.platformItemId,
        externalSkuId: source.externalSkuId,
        sellerSku: source.sellerSku,
        platformPrice: source.price,
        productUrl: source.productUrl,
        sourceLinkId: source.linkId || undefined
      })

      const boundDto = (res?.externalSkuId ? res : res?.data) || {
        platform,
        platformItemId: source.platformItemId,
        externalSkuId: source.externalSkuId,
        sellerSku: source.sellerSku,
        platformPrice: source.price
      }

      setCustomMatchedPairs(prev => [
        ...prev,
        {
          skuId: targetSkuId,
          productName: selectedShopee.productName || selectedTiktok.productName,
          variantName: selectedShopee.variantName || selectedTiktok.variantName,
          skuCode: selectedShopee.sellerSku || selectedTiktok.sellerSku,
          shopee: bindingTiktok ? selectedShopee : boundDto,
          tiktok: bindingTiktok ? boundDto : selectedTiktok,
          reason: 'Manually matched in Reconciliation Wizard'
        }
      ])
      setSelectedShopee(null)
      setSelectedTiktok(null)
      onNotify?.('Matched Shopee & TikTok items and synced inventory!')
    } catch (err) {
      onNotify?.(err.message || 'Failed to match selected pair', 'error')
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Cross-Channel Catalog Reconciliation Wizard"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.45)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '16px'
      }}
    >
      <div style={{
        background: '#ffffff',
        borderRadius: '12px',
        border: '1px solid #e5e5e5',
        width: '100%',
        maxWidth: '960px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '90vh'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#171717' }}>
              Cross-Channel Catalog Reconciliation Wizard
            </h3>
            <span style={{ fontSize: '12px', color: '#737373' }}>
              Review auto-matched products, approve smart suggestions, or manually pair Shopee &amp; TikTok Shop listings
            </span>
          </div>
          <button
            type="button"
            aria-label="Close reconciliation wizard"
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#737373', cursor: 'pointer' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* 3-Step Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e5e5e5', background: '#fafafa', padding: '0 24px', gap: '12px' }}>
          {[
            { id: 'AUTO', label: `1. Auto-Matched (${autoMatched.length})` },
            { id: 'SUGGEST', label: `2. Smart Suggestions (${suggestions.length})` },
            { id: 'UNMATCHED', label: `3. Unmatched Pool (${shopeePool.length} SP · ${tiktokPool.length} TT)` }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '12px 14px',
                border: 'none',
                background: 'transparent',
                borderBottom: `2px solid ${activeTab === tab.id ? '#171717' : 'transparent'}`,
                color: activeTab === tab.id ? '#171717' : '#737373',
                fontWeight: activeTab === tab.id ? 600 : 500,
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {activeTab === 'AUTO' && (
            autoMatched.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px', color: '#737373', fontSize: '13px' }}>
                No cross-channel matched SKUs yet. Check Smart Suggestions or pair items in Unmatched Pool.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e5e5e5', color: '#737373', textAlign: 'left', fontSize: '11px', textTransform: 'uppercase' }}>
                    <th style={{ padding: '8px 10px' }}>Shopee Catalog</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center' }}>Connection &amp; Reason</th>
                    <th style={{ padding: '8px 10px' }}>TikTok Shop Catalog</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {autoMatched.map(row => (
                    <tr key={`${row.skuId}-${row.tiktok?.externalSkuId}`} style={{ borderBottom: '1px solid #f5f5f5' }}>
                      <td style={{ padding: '10px' }}>
                        <div style={{ fontWeight: 600, color: '#171717' }}>{row.productName}</div>
                        <div style={{ fontSize: '11px', color: '#525252' }}>
                          <span style={{ fontFamily: 'monospace' }}>{row.shopee?.sellerSku || row.skuCode}</span> · {formatPrice(row.shopee?.platformPrice)}
                        </div>
                      </td>
                      <td style={{ padding: '10px', textAlign: 'center' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600, color: '#16a34a', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '2px 8px', borderRadius: '12px' }}>
                          <CheckCircle2 size={12} /> Connected
                        </span>
                        <div style={{ fontSize: '11px', color: '#737373', marginTop: '4px' }}>{row.reason}</div>
                      </td>
                      <td style={{ padding: '10px' }}>
                        <div style={{ fontWeight: 600, color: '#171717' }}>{row.productName}</div>
                        <div style={{ fontSize: '11px', color: '#525252' }}>
                          <span style={{ fontFamily: 'monospace' }}>{row.tiktok?.sellerSku || row.skuCode}</span> · {formatPrice(row.tiktok?.platformPrice)}
                        </div>
                      </td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>
                        {row.tiktok?.id && (
                          <button
                            type="button"
                            disabled={busyKey === `unlink-${row.skuId}`}
                            onClick={() => handleUnlink(row)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '5px 10px',
                              borderRadius: '6px',
                              border: '1px solid #e5e5e5',
                              background: '#ffffff',
                              color: '#525252',
                              fontSize: '11px',
                              fontWeight: 500,
                              cursor: 'pointer'
                            }}
                          >
                            <Unlink size={12} /> Unlink
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}

          {activeTab === 'SUGGEST' && (
            suggestions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px', color: '#737373', fontSize: '13px' }}>
                No pending smart suggestions. Use Unmatched Pool to pair remaining items manually.
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
                  <button
                    type="button"
                    onClick={handleApproveAllSuggestions}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: 'none',
                      background: '#171717',
                      color: '#ffffff',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Approve All ({suggestions.length})
                  </button>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e5e5e5', color: '#737373', textAlign: 'left', fontSize: '11px', textTransform: 'uppercase' }}>
                      <th style={{ padding: '8px 10px' }}>Shopee Item</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center' }}>Match Confidence &amp; Reason</th>
                      <th style={{ padding: '8px 10px' }}>TikTok Shop Item</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Decision</th>
                    </tr>
                  </thead>
                  <tbody>
                    {suggestions.map(item => {
                      const sug = item.suggestion
                      const spSide = sug.platform === 'SHOPEE'
                        ? { name: sug.name, sku: sug.sellerSku || sug.externalSkuId, price: sug.price }
                        : { name: item.productName, sku: item.shopee?.sellerSku || item.skuCode, price: item.shopee?.platformPrice ?? item.basePrice }
                      const ttSide = sug.platform === 'TIKTOK_SHOP'
                        ? { name: sug.name, sku: sug.sellerSku || sug.externalSkuId, price: sug.price }
                        : { name: item.productName, sku: item.tiktok?.sellerSku || item.skuCode, price: item.tiktok?.platformPrice ?? item.basePrice }

                      return (
                        <tr key={item.skuId} style={{ borderBottom: '1px solid #f5f5f5' }}>
                          <td style={{ padding: '10px' }}>
                            <div style={{ fontWeight: 600, color: '#171717' }}>{spSide.name}</div>
                            <div style={{ fontSize: '11px', color: '#525252' }}>
                              <span style={{ fontFamily: 'monospace' }}>{spSide.sku}</span> · {formatPrice(spSide.price)}
                            </div>
                          </td>
                          <td style={{ padding: '10px', textAlign: 'center' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, background: '#171717', color: '#ffffff', padding: '2px 8px', borderRadius: '4px' }}>
                              <Sparkles size={11} /> {sug.confidence}% Confidence
                            </span>
                            <div style={{ fontSize: '11px', color: '#737373', marginTop: '4px' }}>
                              {sug.reason || 'Name & price similarity'}
                            </div>
                          </td>
                          <td style={{ padding: '10px' }}>
                            <div style={{ fontWeight: 600, color: '#171717' }}>{ttSide.name}</div>
                            <div style={{ fontSize: '11px', color: '#525252' }}>
                              <span style={{ fontFamily: 'monospace' }}>{ttSide.sku}</span> · {formatPrice(ttSide.price)}
                            </div>
                          </td>
                          <td style={{ padding: '10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <button
                              type="button"
                              disabled={busyKey === `approve-${item.skuId}`}
                              onClick={() => handleApproveSuggestion(item)}
                              style={{
                                padding: '5px 10px',
                                borderRadius: '6px',
                                border: 'none',
                                background: '#16a34a',
                                color: '#ffffff',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                marginRight: '6px'
                              }}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => setDismissedSkuIds(prev => new Set(prev).add(item.skuId))}
                              style={{
                                padding: '5px 10px',
                                borderRadius: '6px',
                                border: '1px solid #e5e5e5',
                                background: '#ffffff',
                                color: '#525252',
                                fontSize: '11px',
                                cursor: 'pointer'
                              }}
                            >
                              Dismiss
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )
          )}

          {activeTab === 'UNMATCHED' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', padding: '10px 14px', background: '#fafafa', border: '1px solid #e5e5e5', borderRadius: '8px' }}>
                <span style={{ fontSize: '12px', color: '#525252' }}>
                  Select one <strong>Shopee</strong> item on the left and one <strong>TikTok Shop</strong> item on the right to link them together.
                </span>
                <button
                  type="button"
                  disabled={!selectedShopee || !selectedTiktok || busyKey === 'match-pair'}
                  onClick={handleMatchSelectedPair}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '7px 14px',
                    borderRadius: '6px',
                    border: 'none',
                    background: selectedShopee && selectedTiktok ? '#171717' : '#e5e5e5',
                    color: selectedShopee && selectedTiktok ? '#ffffff' : '#a3a3a3',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: selectedShopee && selectedTiktok ? 'pointer' : 'not-allowed'
                  }}
                >
                  <Link2 size={14} /> Match Selected Pair
                </button>
              </div>

              {loadingPools ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#737373', fontSize: '12px' }}>
                  Loading unmapped marketplace listings...
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  {/* Shopee Pool */}
                  <div style={{ border: '1px solid #e5e5e5', borderRadius: '8px', overflow: 'hidden' }}>
                    <div style={{ padding: '10px 12px', background: '#fff7ed', borderBottom: '1px solid #fed7aa', fontSize: '12px', fontWeight: 700, color: '#c2410c' }}>
                      Shopee Catalog ({shopeePool.length})
                    </div>
                    <div style={{ maxHeight: '260px', overflowY: 'auto' }}>
                      {shopeePool.length === 0 ? (
                        <div style={{ padding: '20px', textAlign: 'center', color: '#737373', fontSize: '12px' }}>All Shopee items matched!</div>
                      ) : (
                        shopeePool.map(item => {
                          const isSelected = selectedShopee?.key === item.key
                          return (
                            <button
                              key={item.key}
                              type="button"
                              onClick={() => setSelectedShopee(isSelected ? null : item)}
                              style={{
                                width: '100%',
                                textAlign: 'left',
                                padding: '10px 12px',
                                border: 'none',
                                borderBottom: '1px solid #f5f5f5',
                                background: isSelected ? '#fff7ed' : '#ffffff',
                                outline: isSelected ? '2px solid #ea580c' : 'none',
                                cursor: 'pointer',
                                display: 'block'
                              }}
                            >
                              <div style={{ fontWeight: 600, fontSize: '12px', color: '#171717' }}>{item.productName}</div>
                              <div style={{ fontSize: '11px', color: '#737373', marginTop: '2px' }}>
                                <span style={{ fontFamily: 'monospace' }}>{item.sellerSku || item.externalSkuId}</span> · {formatPrice(item.price)}
                              </div>
                            </button>
                          )
                        })
                      )}
                    </div>
                  </div>

                  {/* TikTok Pool */}
                  <div style={{ border: '1px solid #e5e5e5', borderRadius: '8px', overflow: 'hidden' }}>
                    <div style={{ padding: '10px 12px', background: '#f5f5f5', borderBottom: '1px solid #e5e5e5', fontSize: '12px', fontWeight: 700, color: '#171717' }}>
                      TikTok Shop Catalog ({tiktokPool.length})
                    </div>
                    <div style={{ maxHeight: '260px', overflowY: 'auto' }}>
                      {tiktokPool.length === 0 ? (
                        <div style={{ padding: '20px', textAlign: 'center', color: '#737373', fontSize: '12px' }}>All TikTok items matched!</div>
                      ) : (
                        tiktokPool.map(item => {
                          const isSelected = selectedTiktok?.key === item.key
                          return (
                            <button
                              key={item.key}
                              type="button"
                              onClick={() => setSelectedTiktok(isSelected ? null : item)}
                              style={{
                                width: '100%',
                                textAlign: 'left',
                                padding: '10px 12px',
                                border: 'none',
                                borderBottom: '1px solid #f5f5f5',
                                background: isSelected ? '#f4f4f5' : '#ffffff',
                                outline: isSelected ? '2px solid #171717' : 'none',
                                cursor: 'pointer',
                                display: 'block'
                              }}
                            >
                              <div style={{ fontWeight: 600, fontSize: '12px', color: '#171717' }}>{item.productName}</div>
                              <div style={{ fontSize: '11px', color: '#737373', marginTop: '2px' }}>
                                <span style={{ fontFamily: 'monospace' }}>{item.sellerSku || item.externalSkuId}</span> · {formatPrice(item.price)}
                              </div>
                            </button>
                          )
                        })
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 24px',
          borderTop: '1px solid #f0f0f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#fafafa'
        }}>
          <span style={{ fontSize: '11px', color: '#737373' }}>
            All approved mappings sync real-time central available inventory.
          </span>
          <button
            type="button"
            onClick={onComplete}
            style={{
              padding: '8px 16px',
              background: '#171717',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Complete Setup &amp; Sync Inventory
          </button>
        </div>
      </div>
    </div>
  )
}
