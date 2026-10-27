import { useState } from 'react'
import { CheckCircle2, Circle } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/shared/ui/button'
import { MarketplaceLogo } from '@/shared/components/MarketplaceLogo'
import { OwnerStep } from '../components/OwnerStep'
import { useOwnerOnboarding } from '../hooks/useOwnerOnboarding'
import { marketplaces } from '../data/onboardingContent'
import stepStyles from '../components/OwnerStep.module.css'
import styles from './ConfigureChannels.module.css'
import { FormField } from '../components/FormField'
import { useValidatedForm } from '../hooks/useValidatedForm'
import { demoDomainIssue } from '../lib/demoDomain'
import profileStyles from './OwnerBasicInfo.module.css'

export function ConfigureChannels() {
  const { state, dispatch, confirmedShops } = useOwnerOnboarding()
  const navigate = useNavigate()
  const form = useValidatedForm({ storeName: state.ownerInfo.storeName, targetDomain: state.ownerInfo.targetDomain })
  const [domainPreview, setDomainPreview] = useState(null)
  const detailsSaved = state.basicComplete && form.values.storeName.trim() === state.ownerInfo.storeName && form.values.targetDomain.trim() === state.ownerInfo.targetDomain
  function saveDetails(event) {
    if (!form.check(event)) return
    dispatch({ type: 'SAVE_INFO', info: { ...state.ownerInfo, ...form.values } })
  }
  const freeOccupied = state.selectedPlan === 'Free' && state.connections.length >= 1
  return <OwnerStep title="Configure your workspace." description="Add your store details, then connect your sales channels." eyebrow="WORKSPACE SETUP · STEP 02">
    <form className={stepStyles.card} noValidate onSubmit={saveDetails} aria-label="Store configuration">
      <h2>Store information</h2><div className={stepStyles.twoColumns}>
        <FormField name="storeName" label="Store name" autoComplete="organization" placeholder="Your store name" value={form.values.storeName} error={form.errors.storeName} onChange={form.change} onBlur={form.blur} />
        <FormField name="targetDomain" label="Target Domain" autoComplete="off" placeholder="your-store" hint="3–63 lowercase letters, numbers or hyphens. This preview does not reserve DNS." value={form.values.targetDomain} error={form.errors.targetDomain} onChange={form.change} onBlur={form.blur} />
      </div>
      <section className={profileStyles.domainPreview} aria-label="Store address setup"><h2>Set up your store address</h2><p>{form.values.targetDomain.trim() || 'your-store'}.smartomni.example</p><Button type="button" variant="outline" onClick={() => setDomainPreview({ value: form.values.targetDomain, error: demoDomainIssue(form.values.targetDomain) })}>Check demo availability</Button>{domainPreview?.value === form.values.targetDomain && <p role={domainPreview.error ? 'alert' : 'status'}>{domainPreview.error || 'Available in this demo. Save your store details to confirm this preview address.'}</p>}</section>
      <div className={stepStyles.actions}><p className={stepStyles.note}>{detailsSaved ? 'Store details saved for this setup preview.' : 'Save store details before connecting a shop. Editing saved details resets channel and import progress.'}</p><Button type="submit" variant="outline" disabled={detailsSaved}>{detailsSaved ? 'Store details saved' : 'Save store details'}</Button></div>
    </form>
    <div className={styles.context}><span className={stepStyles.badge}>{state.selectedPlan} plan · demo selection</span><p>{state.selectedPlan === 'Free' ? 'Up to 1 shop across all marketplaces. Remove the current demo shop to preview another.' : 'This demo offers one sample shop per marketplace. Production Pro limits are TBD.'}</p></div>
    <div className={stepStyles.twoColumns}>
      {marketplaces.map(marketplace => {
        const shop = state.connections.find(connection => connection.marketplace === marketplace.key)
        const confirmed = shop?.status === 'CONFIRMED'
        return <section className={stepStyles.card} key={marketplace.key} aria-labelledby={`channel-${marketplace.key}`}>
          <div className={styles.channelHeader}><MarketplaceLogo marketplace={marketplace.key} size={48} decorative /><div><h2 id={`channel-${marketplace.key}`}>{marketplace.name}</h2><p>Marketplace connection preview</p></div></div>
          <p className={styles.description}>{marketplace.description}</p>
          <div className={`${styles.status} ${confirmed ? styles.confirmed : ''}`} role="status" aria-live="polite">
            {confirmed ? <CheckCircle2 size={16} aria-hidden="true" /> : <Circle size={16} aria-hidden="true" />}
            <span>{confirmed ? 'Confirmed · demo only' : shop ? 'Awaiting confirmation · demo' : 'Not connected'}</span>
          </div>
          {shop ? <>
            <div className={styles.shop}><strong>{shop.name}</strong><p>Sample fixture. No real shop identity or ownership has been verified.</p></div>
            {!confirmed && <Button variant="outline" className={styles.action} aria-label={`Confirm ${marketplace.name} demo shop`} onClick={() => dispatch({ type: 'CONFIRM_SHOP', marketplace: marketplace.key })}>Confirm demo shop</Button>}
            <Button variant="ghost" className={styles.action} onClick={() => dispatch({ type: 'REMOVE_SHOP', marketplace: marketplace.key })}>Remove {marketplace.name} demo shop</Button>
          </> : <>
            <Button variant="outline" className={styles.action} disabled={freeOccupied || !detailsSaved} onClick={() => dispatch({ type: 'BEGIN_SHOP', marketplace: marketplace.key })}>Connect {marketplace.name} (demo)</Button>
            {freeOccupied && <p className={stepStyles.note}>Free's one-shop allowance is already used in this preview.</p>}
          </>}
        </section>
      })}
    </div>
    <p className={stepStyles.note}>Connection preview and shop confirmation are separate actions. At least one confirmed demo shop is required to continue. Changing shops resets the import preview.</p>
    <div className={stepStyles.actions}><Button asChild variant="outline"><Link to="/merchant/setup/plan">Back</Link></Button><Button disabled={!detailsSaved || !confirmedShops.length} onClick={() => navigate('/merchant/setup/import')}>Continue to Import</Button></div>
  </OwnerStep>
}
