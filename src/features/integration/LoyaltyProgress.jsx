import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { Feedback, OwnerPanel } from '@/features/portal/components/OwnerWorkspaceUI'
import portal from '@/features/portal/OwnerWorkspace.module.css'
import { loyaltyApi } from '@/services/api/loyalty'
import { channelLabel } from '@/services/api/storefront'
import { newIdempotencyKey, useApiAction } from './apiHelpers'
import { LoyaltyResource } from './LoyaltyResults'
import { useApiResource } from './useApiResource'
import styles from './LoyaltyProgress.module.css'

const number = value => new Intl.NumberFormat('vi-VN').format(Number(value || 0))

/**
 * Customer loyalty page: one points wallet, and per marketplace a horizontal bar against that shop's tier milestones.
 * A reached milestone can be redeemed once for a voucher on that marketplace; points are never deducted.
 */
export function LoyaltyProgressPage() {
  const profile = useApiResource(loyaltyApi.profile)
  return <>
    <OwnerPanel title="Loyalty points">
      <LoyaltyResource resource={profile}>{data => <Progress profile={data} reload={profile.reload} />}</LoyaltyResource>
    </OwnerPanel>
    <OwnerPanel title="Earn points from an order">
      <ClaimOrderForm claimed={profile.reload} />
      <p className={portal.note}><Link to="/customer/history">View claim history</Link></p>
    </OwnerPanel>
  </>
}

function Progress({ profile, reload }) {
  const platforms = profile.platforms || []
  const [selected, setSelected] = useState(platforms[0]?.connectionId)
  const current = platforms.find(item => item.connectionId === selected) || platforms[0]
  return <div className={styles.progress}>
    <p className={styles.total}><span>Your points</span><strong>{number(profile.totalPoints)}</strong></p>
    {!platforms.length && <p className={portal.note}>This store has not set up loyalty tiers yet. Your points are saved and will count once tiers are available.</p>}
    {platforms.length > 1 && <div role="tablist" aria-label="Choose marketplace" className={styles.tabs}>
      {platforms.map(item => <button key={item.connectionId} type="button" role="tab" id={`tier-tab-${item.connectionId}`}
        aria-selected={item.connectionId === current.connectionId} aria-controls="tier-panel"
        className={item.connectionId === current.connectionId ? styles.tabActive : styles.tab}
        onClick={() => setSelected(item.connectionId)}>{channelLabel(item.platform)}</button>)}
    </div>}
    {current && <div id="tier-panel" role={platforms.length > 1 ? 'tabpanel' : undefined}
      aria-labelledby={platforms.length > 1 ? `tier-tab-${current.connectionId}` : undefined}>
      <TierBar points={profile.totalPoints} platform={current} />
      <p className={styles.next} role="status">{current.nextTier
        ? `${number(current.pointsToNextTier)} more points to ${current.nextTier} on ${channelLabel(current.platform)}.`
        : `You reached the top tier on ${channelLabel(current.platform)}.`}</p>
      <ul className={styles.rewards} aria-label={`${channelLabel(current.platform)} vouchers`}>
        {current.milestones.map(milestone => <Reward key={milestone.campaignId} milestone={milestone} platform={current.platform} reload={reload} />)}
      </ul>
    </div>}
  </div>
}

function TierBar({ points, platform }) {
  const top = Math.max(...platform.milestones.map(m => m.requiredPoints), 1)
  const fill = Math.min(points / top, 1) * 100
  return <div className={styles.barWrap}>
    <div className={styles.bar} role="progressbar" aria-label={`Progress to ${platform.milestones.at(-1)?.name} on ${channelLabel(platform.platform)}`}
      aria-valuemin={0} aria-valuemax={top} aria-valuenow={Math.min(points, top)} aria-valuetext={`${number(points)} of ${number(top)} points`}>
      <div className={styles.fill} style={{ width: `${fill}%` }} />
      {platform.milestones.map(m => <span key={m.campaignId} className={m.reached ? styles.markReached : styles.mark}
        style={{ left: `${(m.requiredPoints / top) * 100}%` }} aria-hidden="true" />)}
    </div>
    <ol className={styles.labels}>
      {platform.milestones.map(m => <li key={m.campaignId} style={{ '--at': `${(m.requiredPoints / top) * 100}%` }} className={m.reached ? styles.reached : undefined}>
        <strong>{m.name}{m.reached && <Check size={13} aria-label=" reached" />}</strong>
        <span>{number(m.requiredPoints)} pts · -{Number(m.discountPercent)}%</span>
      </li>)}
    </ol>
  </div>
}

function Reward({ milestone, platform, reload }) {
  const action = useApiAction()
  const [copied, setCopied] = useState(false)
  const reward = milestone.reward
  const label = `${milestone.name} · ${Number(milestone.discountPercent)}% off on ${channelLabel(platform)}`
  async function copy() {
    try { await navigator.clipboard.writeText(reward.code); setCopied(true) } catch { setCopied(false) }
  }
  let body
  if (reward?.status === 'issued') {
    body = <span className={styles.code}><code>{reward.code}</code><Button variant="outline" size="sm" onClick={copy}><Copy size={14} aria-hidden="true" />{copied ? 'Copied' : 'Copy code'}</Button></span>
  } else if (reward?.status === 'pending') {
    body = <span className={styles.muted}>Creating your voucher… <Button variant="ghost" size="sm" onClick={reload}>Refresh</Button></span>
  } else if (!milestone.reached) {
    body = <span className={styles.muted}>Locked</span>
  } else if (milestone.availableQuantity <= 0) {
    body = <span className={styles.muted}>No vouchers left</span>
  } else {
    body = <Button size="sm" disabled={action.busy} onClick={() => action.run(
      () => loyaltyApi.requestReward({ campaignId: milestone.campaignId, idempotencyKey: newIdempotencyKey() }),
      'Voucher requested.', reload)}>{action.busy ? 'Requesting…' : reward?.status === 'failed' ? 'Try again' : 'Get voucher'}</Button>
  }
  return <li className={styles.reward}>
    <span>{label}{reward?.status === 'failed' && <small className={styles.failed}>Last request failed{reward.failureReason ? `: ${reward.failureReason}` : ''}</small>}</span>
    {body}
    <Feedback value={action.feedback?.error ? action.feedback : null} />
  </li>
}

const claimErrors = {
  ORDER_NOT_FOUND: 'We could not find this order in this store. Check the order number.',
  ORDER_NOT_COMPLETED: 'This order is not completed yet.',
  ORDER_ALREADY_CLAIMED: 'Points for this order have already been claimed.',
  PLATFORM_REQUIRED: 'This order number exists on more than one marketplace. Choose the marketplace and try again.',
  ORDER_SYNCING: 'The order is being synced from TikTok Shop. Try again in a few minutes.',
  ORDER_HAS_APPROVED_RETURN: 'Orders with an approved return or refund do not earn points.',
  TOO_MANY_CLAIM_ATTEMPTS: 'Too many unknown order numbers. Try again in an hour.',
}

function claimMessage(error) {
  if (error.code === 'ORDER_NOT_ELIGIBLE_YET') {
    const date = /eligible from (\d{4}-\d{2}-\d{2})/.exec(error.message)?.[1]
    return date ? `Points can be claimed 15 days after the order is completed, from ${date.split('-').reverse().join('/')}.`
      : 'Points can be claimed 15 days after the order is completed.'
  }
  return claimErrors[error.code] || error.message
}

/** Claim with the order number shown on Shopee or TikTok Shop. Who placed the order is not checked. */
export function ClaimOrderForm({ claimed }) {
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState(null)
  async function submit(event) {
    event.preventDefault()
    const form = event.currentTarget
    const values = new FormData(form)
    setBusy(true); setFeedback(null)
    try {
      const result = await loyaltyApi.claim({ platformOrderId: values.get('platformOrderId').trim(), ...(values.get('platform') ? { platform: values.get('platform') } : {}) })
      setFeedback({ message: `You earned ${number(result.pointsAwarded)} points.` })
      form.reset()
      claimed?.()
    } catch (error) {
      setFeedback({ error: true, message: claimMessage(error) })
    } finally { setBusy(false) }
  }
  return <form className={portal.form} onSubmit={submit}>
    <p className={portal.note}>Paste the order number from Shopee or TikTok Shop. 1,000 VND = 1 point; an order can be claimed once, 15 days after it is completed.</p>
    <label className={portal.field}>Order number<input name="platformOrderId" required maxLength={64} autoComplete="off" inputMode="text" /></label>
    <label className={portal.field}>Marketplace<select name="platform" defaultValue=""><option value="">Detect automatically</option><option value="tiktok_shop">TikTok Shop</option><option value="shopee">Shopee</option></select></label>
    <Feedback value={feedback} />
    <div className={portal.actions}><Button type="submit" disabled={busy}>{busy ? 'Checking…' : 'Claim points'}</Button></div>
  </form>
}
