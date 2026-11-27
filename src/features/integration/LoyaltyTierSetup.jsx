import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { Feedback, OwnerPanel } from '@/features/portal/components/OwnerWorkspaceUI'
import portal from '@/features/portal/OwnerWorkspace.module.css'
import { loyaltyApi } from '@/services/api/loyalty'
import { channelLabel } from '@/services/api/storefront'
import { useApiAction } from './apiHelpers'
import { LoyaltyResource } from './LoyaltyResults'
import { useApiResource } from './useApiResource'
import styles from './LoyaltyTierSetup.module.css'

const MAX_TIERS = 10

/** Tier milestones per connected marketplace: points needed and voucher % (each tier is a reward campaign). */
export function LoyaltyTierSetup({ saved }) {
  const setup = useApiResource(loyaltyApi.tiers)
  return <OwnerPanel title="Loyalty tiers by marketplace">
    <p className={portal.note}>Customers collect one points balance (1,000 VND = 1 point) and redeem each tier once for a voucher on that marketplace.</p>
    <LoyaltyResource resource={setup}>{shops => shops.length
      ? shops.map(shop => <ShopTiers key={`${shop.connectionId}:${shop.tiers.map(t => t.campaignId).join(',')}`} shop={shop}
        saved={() => { setup.reload(); saved?.() }} />)
      : <p>Connect Shopee or TikTok Shop to set up loyalty tiers.</p>}</LoyaltyResource>
  </OwnerPanel>
}

const toRow = tier => ({ campaignId: tier.campaignId ?? null, name: tier.name ?? '', requiredPoints: tier.requiredPoints ?? '', discountPercent: tier.discountPercent != null ? Number(tier.discountPercent) : '' })

function ShopTiers({ shop, saved }) {
  const [rows, setRows] = useState(() => shop.tiers.length ? shop.tiers.map(toRow) : [])
  const [validation, setValidation] = useState('')
  const action = useApiAction()
  const tiktok = shop.platform === 'tiktok_shop'
  const headingId = `tiers-${shop.connectionId}`

  function update(index, field, value) {
    setRows(current => current.map((row, i) => i === index ? { ...row, [field]: value } : row))
  }
  function applySuggestion() {
    // Reuse existing tiers in order so their campaigns (and issued vouchers) are kept.
    setRows(shop.suggested.map((tier, i) => ({ ...toRow(tier), campaignId: rows[i]?.campaignId ?? null })))
    setValidation('')
  }
  function submit(event) {
    event.preventDefault()
    const tiers = rows.map(row => ({ campaignId: row.campaignId, name: row.name.trim(), requiredPoints: Number(row.requiredPoints), discountPercent: Number(row.discountPercent) }))
    const problem = !tiers.length ? 'Add at least one tier.'
      : tiers.some(t => !t.name) ? 'Every tier needs a name.'
        : new Set(tiers.map(t => t.name.toLowerCase())).size !== tiers.length ? 'Tier names must be different.'
          : new Set(tiers.map(t => t.requiredPoints)).size !== tiers.length ? 'Two tiers cannot need the same points.'
            : !tiktok && tiers.some(t => !Number.isInteger(t.discountPercent)) ? 'Shopee vouchers take a whole-number discount.'
              : ''
    setValidation(problem)
    if (problem) return
    void action.run(() => loyaltyApi.saveTiers({ connectionId: shop.connectionId, tiers }), 'Tiers saved.', saved)
  }

  return <section className={styles.shop} aria-labelledby={headingId}>
    <div className={styles.head}>
      <h3 id={headingId}>{channelLabel(shop.platform)}{shop.shopName ? ` · ${shop.shopName}` : ''}</h3>
      <Button type="button" variant="outline" size="sm" onClick={applySuggestion}>Use suggestion</Button>
    </div>
    <p className={portal.note}>{tiktok
      ? 'TikTok Shop does not let apps create vouchers. For each tier, create a code batch in TikTok Seller Center whose title contains the tier name and gives the same discount; SmartOmni hands out its codes.'
      : 'SmartOmni creates a single-use Shopee voucher for each customer who reaches a tier.'}</p>
    <form onSubmit={submit} className={styles.form}>
      {rows.length > 0 && <div className={styles.table} role="group" aria-label={`${channelLabel(shop.platform)} tiers`}>
        <span aria-hidden="true">Tier name</span><span aria-hidden="true">Points needed</span><span aria-hidden="true">Voucher %</span><span />
        {rows.map((row, i) => <div key={i} className={styles.row}>
          <input aria-label={`Tier ${i + 1} name`} value={row.name} maxLength={60} required onChange={e => update(i, 'name', e.target.value)} />
          <input aria-label={`Tier ${i + 1} points`} type="number" min="1" step="1" value={row.requiredPoints} required onChange={e => update(i, 'requiredPoints', e.target.value)} />
          <input aria-label={`Tier ${i + 1} voucher percent`} type="number" min={tiktok ? '0.01' : '1'} max="100" step={tiktok ? '0.01' : '1'} value={row.discountPercent} required onChange={e => update(i, 'discountPercent', e.target.value)} />
          <Button type="button" variant="ghost" size="icon" aria-label={`Remove tier ${i + 1}`} onClick={() => setRows(current => current.filter((_, j) => j !== i))}><Trash2 size={16} aria-hidden="true" /></Button>
        </div>)}
      </div>}
      {!rows.length && <p className={portal.note}>No tiers yet. Use the suggestion (Gold 500 · Platinum 1,000 · Diamond 1,500 points, 10/20/30%) or add your own.</p>}
      <Feedback value={validation ? { error: true, message: validation } : action.feedback} />
      <div className={portal.actions}>
        <Button type="button" variant="outline" disabled={rows.length >= MAX_TIERS} onClick={() => setRows(current => [...current, toRow({})])}><Plus size={16} aria-hidden="true" />Add tier</Button>
        <Button type="submit" disabled={action.busy}>{action.busy ? 'Saving…' : 'Save tiers'}</Button>
      </div>
    </form>
  </section>
}
