import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/shared/ui/button'
import { DataTable, Feedback, OwnerPanel } from '@/features/portal/components/OwnerWorkspaceUI'
import styles from '@/features/portal/OwnerWorkspace.module.css'
import { loyaltyApi } from '@/services/api/loyalty'
import { shopeeApi } from '@/services/api/shopee'
import { tiktokApi } from '@/services/api/tiktok'
import { dateTime, useApiAction } from './apiHelpers'
import { LoyaltyResource, LoyaltyResults } from './LoyaltyResults'
import { useApiResource } from './useApiResource'

const campaignStatuses = ['draft', 'active', 'paused', 'closed']

export default function ApiMerchantLoyalty({ results }) {
  return results ? <MerchantRewards /> : <MerchantCampaigns />
}

function MerchantRewards() {
  const requests = useApiResource(loyaltyApi.rewardRequests)
  return <OwnerPanel title="Voucher requests"><LoyaltyResults resource={requests} merchant /></OwnerPanel>
}

function MerchantCampaigns() {
  const campaigns = useApiResource(loyaltyApi.campaigns)
  const [editor, setEditor] = useState(null)
  const [feedback, setFeedback] = useState(null)
  return <>
    <OwnerPanel title="Campaigns">
      <div className={styles.actions}>
        <Button onClick={() => { setFeedback(null); setEditor({}) }} disabled={Boolean(editor)}>New campaign</Button>
        <Button asChild variant="outline"><Link to="/merchant/voucher-results">View voucher requests</Link></Button>
      </div>
      <Feedback value={feedback} />
      <LoyaltyResource resource={campaigns}>{items => items.length ?
        <DataTable label="Loyalty campaigns" headings={['Campaign', 'Discount', 'Required points', 'Remaining', 'Status', 'Ends', 'Edit']}>
          {items.map(item => <tr key={item.id}>
            <th scope="row">{item.name}<p>{item.shopName || item.platform}</p></th>
            <td>{item.discountPercent}%</td><td>{item.requiredPoints}</td><td>{item.availableQuantity} of {item.quantity}</td>
            <td>{item.status}</td><td>{dateTime(item.endsAt)}</td>
            <td><Button variant="outline" disabled={Boolean(editor)} onClick={() => { setFeedback(null); setEditor(item) }}>Edit campaign</Button></td>
          </tr>)}
        </DataTable> : <p>No voucher campaigns yet.</p>}</LoyaltyResource>
    </OwnerPanel>
    {editor && <CampaignEditor campaign={editor} close={() => setEditor(null)} saved={() => {
      setFeedback({ message: editor.id ? 'Campaign updated.' : 'Campaign created.' })
      setEditor(null)
      campaigns.reload()
    }} />}
  </>
}

function toLocalInput(value) {
  if (!value) return ''
  const date = parseDate(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 19)
}

function parseDate(value) {
  return new Date(typeof value === 'number' ? value * 1000 : value)
}

function campaignDate(input, previous) {
  const localTime = input.length === 16 ? input + ':00' : input
  return previous && localTime === toLocalInput(previous) ? parseDate(previous) : new Date(input)
}

function CampaignEditor({ campaign, close, saved }) {
  const [mode, setMode] = useState(campaign.provisioningMode || 'import')
  const [validation, setValidation] = useState('')
  const action = useApiAction()

  function submit(event) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    const name = fields.get('name').trim()
    const startsAt = campaignDate(fields.get('startsAt'), campaign.startsAt)
    const endsAt = campaignDate(fields.get('endsAt'), campaign.endsAt)
    if (!name || !(endsAt > startsAt)) {
      setValidation(!name ? 'Enter a campaign name.' : 'End time must be after start time.')
      return
    }
    setValidation('')
    const body = {
      name,
      discountPercent: fields.get('discountPercent'),
      requiredPoints: fields.get('requiredPoints'),
      quantity: Number(fields.get('quantity')),
      provisioningMode: mode,
      externalCouponId: mode === 'import' ? fields.get('externalCouponId').trim() : '',
      status: fields.get('status'),
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
    }
    void action.run(
      () => campaign.id ? loyaltyApi.updateCampaign(campaign.id, body) : loyaltyApi.createCampaign({ ...body, connectionId: fields.get('connectionId') }),
      'Saved.',
      saved,
    )
  }

  return <OwnerPanel title={campaign.id ? 'Edit voucher campaign' : 'New voucher campaign'}>
    <form className={styles.form} onSubmit={submit}>
      {campaign.id ? <p>Shop: {campaign.shopName || campaign.platform}</p> : <ConnectedShop />}
      <label className={styles.field}>Campaign name<input name="name" defaultValue={campaign.name} required /></label>
      <label className={styles.field}>Discount (%)<input name="discountPercent" type="number" min="0.01" max="100" step="0.01" defaultValue={campaign.discountPercent} required /></label>
      <label className={styles.field}>Required points<input name="requiredPoints" type="number" min="1" step="1" defaultValue={campaign.requiredPoints} required /></label>
      <label className={styles.field}>Voucher quantity<input name="quantity" type="number" min={Math.max(1, campaign.reservedCount || 0)} max="2147483647" step="1" defaultValue={campaign.quantity} required /></label>
      <label className={styles.field}>Voucher source<select value={mode} onChange={event => setMode(event.target.value)}>
        <option value="import">Use an existing coupon</option><option value="api">Create through marketplace API</option>
      </select></label>
      {mode === 'import' && <label className={styles.field}>Marketplace coupon ID (optional)<input name="externalCouponId" defaultValue={campaign.externalCouponId || ''} /></label>}
      <label className={styles.field}>Status<select name="status" defaultValue={campaign.status || 'draft'}>
        {campaignStatuses.map(status => <option key={status} value={status}>{status}</option>)}
      </select></label>
      <label className={styles.field}>Starts (local time)<input name="startsAt" type="datetime-local" step="1" defaultValue={toLocalInput(campaign.startsAt)} required /></label>
      <label className={styles.field}>Ends (local time)<input name="endsAt" type="datetime-local" step="1" defaultValue={toLocalInput(campaign.endsAt)} required /></label>
      <Feedback value={validation ? { error: true, message: validation } : action.feedback} />
      <div className={styles.actions}>
        <Button type="submit" disabled={action.busy}>{action.busy ? 'Saving…' : 'Save campaign'}</Button>
        <Button type="button" variant="outline" disabled={action.busy} onClick={close}>Cancel</Button>
      </div>
    </form>
  </OwnerPanel>
}

function ConnectedShop() {
  const tiktok = useApiResource(tiktokApi.connection)
  const shopee = useApiResource(shopeeApi.connection)
  const [selected, setSelected] = useState('')
  const shops = [[tiktok.data, 'TikTok Shop'], [shopee.data, 'Shopee']].filter(([shop]) => shop?.status === 'CONNECTED' && shop.id)
  const selectedPlatform = shops.find(([shop]) => String(shop.id) === selected)?.[1]
  return <>
    <label className={styles.field}>Connected shop<select name="connectionId" required value={selected} onChange={event => setSelected(event.target.value)}>
      <option value="">Select a connected shop</option>
      {shops.map(([shop, platform]) => <option key={shop.id} value={shop.id}>{platform} · {shop.shopName || shop.shopId}</option>)}
    </select></label>
    {(tiktok.loading || shopee.loading) && <p role="status">Loading shops…</p>}
    {tiktok.error && <LoyaltyResource resource={tiktok} />}
    {shopee.error && <LoyaltyResource resource={shopee} />}
    {!tiktok.loading && !shopee.loading && !tiktok.error && !shopee.error && !shops.length &&
      <p>Connect a marketplace in <Link to="/merchant/shops">Shop connections</Link> to create a campaign.</p>}
    {selectedPlatform === 'Shopee' && <p className={styles.note}>The backend can save Shopee campaigns. Shopee voucher issuance is currently unavailable.</p>}
  </>
}
