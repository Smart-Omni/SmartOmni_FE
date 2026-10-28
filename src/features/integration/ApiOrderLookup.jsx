import { useState } from 'react'
import { Button } from '@/shared/ui/button'
import { orderApi } from '@/services/api/operations'
import { Feedback, OwnerPanel } from '@/features/portal/components/OwnerWorkspaceUI'
import { money, useApiAction } from './apiHelpers'
import styles from '@/features/portal/OwnerWorkspace.module.css'

export default function ApiOrderLookup() {
  const [platform, setPlatform] = useState('SHOPEE')
  const [orderId, setOrderId] = useState('')
  const [result, setResult] = useState(null)
  const action = useApiAction()
  function submit(event) {
    event.preventDefault(); setResult(null)
    action.run(() => orderApi.track(platform, orderId.trim()), result => result ? 'Order found.' : 'No order found.', setResult)
  }
  return <OwnerPanel title="Look up a marketplace order"><p>Find an order by its marketplace reference in your current workspace.</p><form className={styles.form} onSubmit={submit}><label className={styles.field}>Marketplace<select value={platform} onChange={event => { setPlatform(event.target.value); setResult(null) }} disabled={action.busy}><option value="SHOPEE">Shopee</option><option value="TIKTOK_SHOP">TikTok Shop</option></select></label><label className={styles.field}>Marketplace order reference<input required value={orderId} onChange={event => { setOrderId(event.target.value); setResult(null) }} disabled={action.busy} /></label><div className={styles.actions}><Button type="submit" disabled={action.busy}>{action.busy ? 'Looking up…' : 'Look up order'}</Button></div><Feedback value={action.feedback} /></form>{result && <dl className={styles.details}>{[['Order', result.platformOrderId || result.orderSn], ['Marketplace', result.platform], ['Status', result.status], ['Customer', result.customerName], ['Tracking', result.trackingNumber], ['Total', result.totalAmount == null ? '—' : money(result.totalAmount)]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || '—'}</dd></div>)}</dl>}</OwnerPanel>
}
