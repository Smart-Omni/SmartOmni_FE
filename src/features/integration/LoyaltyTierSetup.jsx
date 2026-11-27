import { useState } from 'react'
import { Plus, RefreshCw, Trash2 } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { Feedback, OwnerPanel } from '@/features/portal/components/OwnerWorkspaceUI'
import portal from '@/features/portal/OwnerWorkspace.module.css'
import { loyaltyApi } from '@/services/api/loyalty'
import { channelLabel } from '@/services/api/storefront'
import { tiktokApi } from '@/services/api/tiktok'
import { dateTime, useApiAction } from './apiHelpers'
import { LoyaltyResource } from './LoyaltyResults'
import { useApiResource } from './useApiResource'
import styles from './LoyaltyTierSetup.module.css'

const MAX_TIERS = 10
const noBatches = () => Promise.resolve([])

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

const toRow = tier => ({
  campaignId: tier.campaignId ?? null,
  name: tier.name ?? '',
  requiredPoints: tier.requiredPoints ?? '',
  discountPercent: tier.discountPercent != null ? Number(tier.discountPercent) : '',
  batchTitle: tier.tiktokBatchTitle ?? '',
})

const sameText = (a, b) => (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase()
const givesPercent = (batch, percent) => batch.discountType === 'PERCENT_OFF' && Number(batch.discountValue) === Number(percent)
const discountText = batch => batch.discountType === 'PERCENT_OFF' ? `${Number(batch.discountValue)}%` : `${Number(batch.discountValue).toLocaleString('vi-VN')} VND off`
const batchLabel = batch => `${batch.title} · ${discountText(batch)} · ${batch.freeCodes} free of ${batch.ongoingCodes} · until ${dateTime(batch.endTime)}`

/** The batch a tier would use (exact title, tier percent); null when there is none. */
function batchFor(batches, row) {
  return batches.find(b => sameText(b.title, row.batchTitle) && givesPercent(b, row.discountPercent)) ?? null
}

/** Suggested batch for a tier: its title contains the tier name and it gives the tier's percent. */
function suggestBatch(batches, row) {
  const name = row.name.trim().toLowerCase()
  return (name && batches.find(b => b.title.toLowerCase().includes(name) && givesPercent(b, row.discountPercent)))?.title ?? ''
}

function ShopTiers({ shop, saved }) {
  const tiktok = shop.platform === 'tiktok_shop'
  const batchResource = useApiResource(tiktok ? tiktokApi.voucherBatches : noBatches)
  const batches = batchResource.data || []
  const [rows, setRows] = useState(() => shop.tiers.length ? shop.tiers.map(toRow) : [])
  const [validation, setValidation] = useState('')
  const action = useApiAction()
  const headingId = `tiers-${shop.connectionId}`

  function update(index, field, value) {
    setRows(current => current.map((row, i) => i === index ? { ...row, [field]: value } : row))
  }
  function applySuggestion() {
    // Reuse existing tiers in order so their campaigns (and issued vouchers) are kept.
    setRows(shop.suggested.map((tier, i) => {
      const row = { ...toRow(tier), campaignId: rows[i]?.campaignId ?? null }
      return tiktok ? { ...row, batchTitle: suggestBatch(batches, row) } : row
    }))
    setValidation('')
  }
  function tiktokProblem(tiers) {
    for (const tier of tiers) {
      if (!tier.tiktokBatchTitle) return `Choose the TikTok code batch for ${tier.name}.`
      const titled = batches.filter(b => sameText(b.title, tier.tiktokBatchTitle))
      if (batchResource.data && !titled.length) return `TikTok batch '${tier.tiktokBatchTitle}' has no ongoing codes.`
      if (titled.length && !titled.some(b => givesPercent(b, tier.discountPercent))) {
        return `TikTok batch '${tier.tiktokBatchTitle}' gives ${discountText(titled[0])}, ${tier.name} needs ${tier.discountPercent}%.`
      }
    }
    return new Set(tiers.map(t => t.tiktokBatchTitle.toLowerCase())).size !== tiers.length ? 'Each tier needs its own TikTok code batch.' : ''
  }
  function submit(event) {
    event.preventDefault()
    const tiers = rows.map(row => ({
      campaignId: row.campaignId, name: row.name.trim(), requiredPoints: Number(row.requiredPoints), discountPercent: Number(row.discountPercent),
      ...(tiktok && { tiktokBatchTitle: row.batchTitle.trim() }),
    }))
    const problem = !tiers.length ? 'Add at least one tier.'
      : tiers.some(t => !t.name) ? 'Every tier needs a name.'
        : new Set(tiers.map(t => t.name.toLowerCase())).size !== tiers.length ? 'Tier names must be different.'
          : new Set(tiers.map(t => t.requiredPoints)).size !== tiers.length ? 'Two tiers cannot need the same points.'
            : tiers.some(t => !Number.isInteger(t.discountPercent)) ? (tiktok ? 'TikTok code batches take a whole-number discount.' : 'Shopee vouchers take a whole-number discount.')
              : tiktok ? tiktokProblem(tiers) : ''
    setValidation(problem)
    if (problem) return
    void action.run(() => loyaltyApi.saveTiers({ connectionId: shop.connectionId, tiers }), 'Tiers saved.', saved)
  }

  const columns = tiktok ? styles.tableTiktok : ''
  return <section className={styles.shop} aria-labelledby={headingId}>
    <div className={styles.head}>
      <h3 id={headingId}>{channelLabel(shop.platform)}{shop.shopName ? ` · ${shop.shopName}` : ''}</h3>
      <div className={portal.actions}>
        {tiktok && <Button type="button" variant="outline" size="sm" disabled={batchResource.loading} onClick={batchResource.reload}>
          <RefreshCw size={16} aria-hidden="true" />{batchResource.loading ? 'Loading batches…' : 'Refresh batches'}</Button>}
        <Button type="button" variant="outline" size="sm" disabled={tiktok && batchResource.loading} onClick={applySuggestion}>Use suggestion</Button>
      </div>
    </div>
    <p className={portal.note}>{tiktok
      ? 'TikTok Shop does not let apps create vouchers. For each tier, create a code batch in TikTok Seller Center with the same percent off and enough codes, then choose it here. SmartOmni hands out only codes of that batch, takes its free codes as the tier quantity and ends the tier when the batch ends.'
      : 'SmartOmni creates a single-use Shopee voucher for each customer who reaches a tier.'}</p>
    {tiktok && batchResource.error && <Feedback value={{ error: true, message: `Could not load TikTok code batches: ${batchResource.error}` }} />}
    {tiktok && batchResource.data && !batches.length && <p className={portal.note}>No ongoing code batch found on TikTok Shop yet.</p>}
    <form onSubmit={submit} className={styles.form}>
      {rows.length > 0 && <div className={`${styles.table} ${columns}`} role="group" aria-label={`${channelLabel(shop.platform)} tiers`}>
        <span aria-hidden="true">Tier name</span><span aria-hidden="true">Points needed</span><span aria-hidden="true">Voucher %</span>
        {tiktok && <span aria-hidden="true">TikTok code batch</span>}<span />
        {rows.map((row, i) => {
          const linked = tiktok && row.batchTitle ? batchFor(batches, row) : null
          const missing = tiktok && row.batchTitle && !batches.some(b => sameText(b.title, row.batchTitle))
          return <div key={i} className={styles.row}>
            <input aria-label={`Tier ${i + 1} name`} value={row.name} maxLength={60} required onChange={e => update(i, 'name', e.target.value)} />
            <input aria-label={`Tier ${i + 1} points`} type="number" min="1" step="1" value={row.requiredPoints} required onChange={e => update(i, 'requiredPoints', e.target.value)} />
            <input aria-label={`Tier ${i + 1} voucher percent`} type="number" min="1" max="100" step="1" value={row.discountPercent} required onChange={e => update(i, 'discountPercent', e.target.value)} />
            {tiktok && <select aria-label={`Tier ${i + 1} TikTok code batch`} value={row.batchTitle} onChange={e => update(i, 'batchTitle', e.target.value)}
              aria-invalid={Boolean(row.batchTitle) && !linked} title={linked ? batchLabel(linked) : undefined}>
              <option value="">Choose a code batch</option>
              {missing && <option value={row.batchTitle}>{row.batchTitle} · no ongoing codes</option>}
              {batches.map((b, j) => <option key={j} value={b.title}>{batchLabel(b)}</option>)}
            </select>}
            <Button type="button" variant="ghost" size="icon" aria-label={`Remove tier ${i + 1}`} onClick={() => setRows(current => current.filter((_, j) => j !== i))}><Trash2 size={16} aria-hidden="true" /></Button>
          </div>
        })}
      </div>}
      {tiktok && shop.tiers.some(t => t.tiktokBatchTitle) && <ul className={styles.usage} aria-label="Saved TikTok tiers">
        {shop.tiers.filter(t => t.tiktokBatchTitle).map(t => <li key={t.campaignId}>
          {t.name}: {t.availableQuantity} of {t.quantity} codes left from “{t.tiktokBatchTitle}”, until {dateTime(t.endsAt)}
        </li>)}
      </ul>}
      {!rows.length && <p className={portal.note}>No tiers yet. Use the suggestion (Gold 500 · Platinum 1,000 · Diamond 1,500 points, 10/20/30%) or add your own.</p>}
      <Feedback value={validation ? { error: true, message: validation } : action.feedback} />
      <div className={portal.actions}>
        <Button type="button" variant="outline" disabled={rows.length >= MAX_TIERS} onClick={() => setRows(current => [...current, toRow({})])}><Plus size={16} aria-hidden="true" />Add tier</Button>
        <Button type="submit" disabled={action.busy}>{action.busy ? 'Saving…' : 'Save tiers'}</Button>
      </div>
    </form>
  </section>
}
