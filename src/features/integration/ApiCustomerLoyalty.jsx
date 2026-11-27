import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/shared/ui/button'
import { DataTable, Feedback, OwnerPanel, SummaryMetrics } from '@/features/portal/components/OwnerWorkspaceUI'
import styles from '@/features/portal/OwnerWorkspace.module.css'
import { loyaltyApi } from '@/services/api/loyalty'
import { dateTime, money, newIdempotencyKey } from './apiHelpers'
import { ConfirmationDialog } from './ConfirmationDialog'
import { LoyaltyResource, LoyaltyResults } from './LoyaltyResults'
import { useApiResource } from './useApiResource'
import { ClaimOrderForm, LoyaltyProgressPage } from './LoyaltyProgress'

export default function ApiCustomerLoyalty({ screen }) {
  if (screen === '/customer/loyalty') return <LoyaltyProgressPage />
  if (screen === '/customer/claim') return <ClaimPoints />
  if (screen === '/customer/history') return <ClaimHistory />
  if (screen === '/customer/vouchers') return <CustomerRewards />
  return <Membership />
}

function Membership() {
  const profile = useApiResource(loyaltyApi.profile)
  return <OwnerPanel title="Loyalty balance">
    <LoyaltyResource resource={profile}>{data => <>
      <SummaryMetrics items={[
        ['Total points', data.totalPoints],
        ['Current tier', data.tier],
        ...(data.nextTier ? [[`Points to ${data.nextTier}`, data.pointsToNextTier]] : []),
      ]} />
      <div className={styles.actions}>
        <Button asChild><Link to="/customer/claim">Claim order points</Link></Button>
        <Button asChild variant="outline"><Link to="/customer/history">View claim history</Link></Button>
      </div>
    </>}</LoyaltyResource>
  </OwnerPanel>
}

function ClaimPoints() {
  return <OwnerPanel title="Claim order points"><ClaimOrderForm /></OwnerPanel>
}

function ClaimHistory() {
  const claims = useApiResource(loyaltyApi.claims)
  return <OwnerPanel title="Claimed orders">
    <LoyaltyResource resource={claims}>{items => items.length ?
      <DataTable label="Claimed orders" headings={['Order ID', 'Eligible amount', 'Points earned', 'Claimed at']}>
        {items.map(item => <tr key={item.id}>
          <th scope="row">{item.orderId}</th><td>{money(item.eligibleAmountVnd)}</td>
          <td>{item.pointsAwarded}</td><td>{dateTime(item.claimedAt)}</td>
        </tr>)}
      </DataTable> : <p>No orders claimed yet.</p>}</LoyaltyResource>
  </OwnerPanel>
}

function CustomerRewards() {
  const profile = useApiResource(loyaltyApi.profile)
  const campaigns = useApiResource(loyaltyApi.campaigns)
  const vouchers = useApiResource(loyaltyApi.myVouchers)
  const [draft, setDraft] = useState(null)
  const [feedback, setFeedback] = useState(null)

  function review(campaign) {
    setFeedback(null)
    setDraft({ campaign, idempotencyKey: newIdempotencyKey() })
  }

  return <>
    <OwnerPanel title="Available campaigns">
      <Feedback value={feedback} />
      <LoyaltyResource resource={profile}>{data => <p>Available loyalty points: {data.totalPoints}</p>}</LoyaltyResource>
      <LoyaltyResource resource={campaigns}>{items => items.length ?
        <DataTable label="Available voucher campaigns" headings={['Campaign', 'Discount', 'Required points', 'Remaining', 'Ends', 'Request']}>
          {items.map(item => {
            const requested = vouchers.data?.some(voucher => voucher.campaignId === item.id && ['pending', 'issued'].includes(voucher.status))
            const eligible = profile.data && profile.data.totalPoints >= item.requiredPoints && item.availableQuantity > 0
            return <tr key={item.id}>
              <th scope="row">{item.name}<p>{item.shopName || item.platform}</p></th>
              <td>{item.discountPercent}%</td><td>{item.requiredPoints}</td><td>{item.availableQuantity}</td><td>{dateTime(item.endsAt)}</td>
              <td>{requested ? 'Requested' : <Button variant="outline" disabled={!eligible || !vouchers.data}
                onClick={() => review(item)}>Request voucher</Button>}</td>
            </tr>
          })}
        </DataTable> : <p>No active voucher campaigns.</p>}</LoyaltyResource>
    </OwnerPanel>
    <OwnerPanel title="My voucher requests"><LoyaltyResults resource={vouchers} /></OwnerPanel>
    {draft && <ConfirmationDialog title="Confirm voucher request"
      description={`Request a ${draft.campaign.discountPercent}% discount from ${draft.campaign.name}. Your points balance stays the same.`}
      close={() => setDraft(null)} submit={() => loyaltyApi.requestReward({ campaignId: draft.campaign.id, idempotencyKey: draft.idempotencyKey })}
      done={() => {
        setDraft(null)
        setFeedback({ message: 'Voucher requested. Refresh your requests to check issuance.' })
        vouchers.reload()
        campaigns.reload()
      }} />}
  </>
}
