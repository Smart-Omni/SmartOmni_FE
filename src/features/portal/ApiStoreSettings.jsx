import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/shared/ui/button'
import { storefrontApi } from '@/services/api/storefront'
import { useApiResource } from '@/features/integration/useApiResource'
import { ResourceState } from '@/features/integration/ShopeeShared'
import { useApiAction } from '@/features/integration/apiHelpers'
import styles from './StoreSettings.module.css'

const fields = [['storeName', 'Store name', 'text', 100], ['logoUrl', 'Logo URL', 'url', 2000], ['bannerUrl', 'Banner URL', 'url', 2000], ['primaryColor', 'Primary color', 'text', 7], ['supportPhone', 'Contact phone', 'tel', 40], ['address', 'Store address', 'textarea', 1000]]

export default function ApiStoreSettings() {
  const resource = useApiResource(storefrontApi.currentTenant)
  return <div className={styles.page}><div className={styles.heading}><div><h1>Store settings</h1><p>Manage the store information shown on your storefront.</p></div>{resource.data?.subdomain && <Button asChild variant="outline"><Link to={`/store/${resource.data.subdomain}`} target="_blank" rel="noreferrer">Preview storefront</Link></Button>}</div><ResourceState resource={resource} />{resource.data && <ApiSettingsForm key={JSON.stringify(resource.data.storefront)} tenant={resource.data} />}<p className={styles.notice}>The current backend keeps appearance and contact settings in service memory. These fields may reset when the backend restarts.</p></div>
}

function ApiSettingsForm({ tenant }) {
  const initial = Object.fromEntries(fields.map(([name]) => [name, tenant.storefront?.[name] || (name === 'storeName' ? tenant.companyName : '') || '']))
  const [draft, setDraft] = useState(initial)
  const [saved, setSaved] = useState(initial)
  const action = useApiAction()
  function submit(event) {
    event.preventDefault()
    const submitted = { ...draft, storeName: draft.storeName.trim() }
    action.run(() => storefrontApi.update(submitted), 'Store information saved to the backend.', () => setSaved(submitted))
  }
  return <section className={styles.panel}><h2>Store profile & appearance</h2><p>Store address: {tenant.subdomain}</p><form className={styles.form} onSubmit={submit}>{fields.map(([name, label, type, maxLength]) => <label className={styles.field} key={name}>{label}{type === 'textarea' ? <textarea name={name} value={draft[name]} maxLength={maxLength} disabled={action.busy} onChange={event => setDraft({ ...draft, [name]: event.target.value })} /> : <input name={name} type={type} value={draft[name]} required={name === 'storeName'} maxLength={maxLength} pattern={name === 'primaryColor' ? '#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})' : undefined} placeholder={name === 'primaryColor' ? '#234738' : undefined} disabled={action.busy} onChange={event => setDraft({ ...draft, [name]: event.target.value })} />}</label>)}<div className={styles.actions}><Button type="submit" disabled={action.busy}>{action.busy ? 'Saving…' : 'Save changes'}</Button><Button type="button" variant="secondary" disabled={action.busy} onClick={() => setDraft(saved)}>Discard changes</Button></div>{action.feedback && <p role={action.feedback.error ? 'alert' : 'status'} className={`${styles.notice} ${action.feedback.error ? styles.error : ''}`}>{action.feedback.message}</p>}</form></section>
}
