import { useEffect, useRef } from 'react'
import { CheckCircle2, Circle, CircleAlert, PauseCircle, Package, TriangleAlert } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/shared/ui/button'
import { OwnerStep } from '../components/OwnerStep'
import { useOwnerOnboarding } from '../hooks/useOwnerOnboarding'
import { importStates, marketplaces } from '../data/onboardingContent'
import stepStyles from '../components/OwnerStep.module.css'
import styles from './ConfigureImport.module.css'

const icons = { NOT_STARTED: Circle, IN_PROGRESS: PauseCircle, COMPLETED: CheckCircle2, PARTIAL: TriangleAlert, FAILED: CircleAlert }

export function ConfigureImport() {
  const { state, dispatch, confirmedShops } = useOwnerOnboarding()
  const navigate = useNavigate()
  const status = state.initialImportStatus
  const statusHeading = useRef(null)
  const previousStatus = useRef(status)
  useEffect(() => {
    if (previousStatus.current !== status) statusHeading.current?.focus()
    previousStatus.current = status
  }, [status])
  const current = importStates[status]
  const Icon = icons[status]
  return <OwnerStep title="Prepare your first product import." description="Review your connected shops and get ready to bring your catalog into SmartOmni." eyebrow="WORKSPACE SETUP · STEP 03">
    <div className={styles.grid}>
      <section className={stepStyles.card} aria-labelledby="import-shops"><h2 id="import-shops">Confirmed demo shops</h2>
        <ul className={styles.shops}>{confirmedShops.map(shop => <li key={shop.demoKey}><span className={styles.shopIcon}><Package size={18} aria-hidden="true" /></span><div><strong>{shop.name}</strong><p>{marketplaces.find(item => item.key === shop.marketplace).name} · Confirmed in preview</p></div></li>)}</ul>
        <p className={stepStyles.note}>Review the sample shops included in your first catalog synchronization. Completing this preview is required before moving on.</p>
      </section>
      <section className={`${stepStyles.card} ${styles[status] || ''}`} aria-labelledby="sync-preview-title">
        <div className={styles.statusIcon}><Icon size={28} aria-hidden="true" /></div>
        <h2 id="sync-preview-title" ref={statusHeading} tabIndex={-1}>Synchronization preview</h2>
        <div className={styles.statusText} role="status" aria-live="polite" aria-atomic="true"><strong>{current.label}</strong><p>{current.description}</p></div>
        {state.importResult && <dl className={styles.results}><div><dt>Sample records succeeded</dt><dd>{state.importResult.succeeded}</dd></div><div><dt>Sample records needing attention</dt><dd>{state.importResult.needsAttention}</dd></div></dl>}
        {status !== 'IN_PROGRESS' && <Button variant="outline" className={styles.start} onClick={() => dispatch({ type: 'START_IMPORT' })}>{status === 'NOT_STARTED' ? 'Start sync preview' : 'Restart sync preview'}</Button>}
      </section>
    </div>
    {status === 'IN_PROGRESS' && <section className={styles.scenarios} aria-labelledby="demo-outcomes">
      <div><h2 id="demo-outcomes">Choose a demo outcome</h2><p>Explore a sample result and its next steps. No marketplace data is imported.</p></div>
      <div className={styles.scenarioActions}>{['COMPLETED', 'PARTIAL', 'FAILED'].map(outcome => <Button variant="outline" key={outcome} onClick={() => dispatch({ type: 'RESOLVE_IMPORT', outcome })}>Simulate {outcome.toLowerCase()}</Button>)}</div>
    </section>}
    <p className={stepStyles.note}>Only COMPLETED unlocks the Welcome preview. Partial and failed outcomes keep it locked. Record counts are illustrative results for the selected scenario, not live or cumulative import totals.</p>
    <div className={stepStyles.actions}><Button asChild variant="outline"><Link to="/merchant/setup/channels">Back</Link></Button><Button disabled={status !== 'COMPLETED'} onClick={() => navigate('/merchant/setup/welcome')}>Continue</Button></div>
  </OwnerStep>
}
