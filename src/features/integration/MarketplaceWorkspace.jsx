import { useSearchParams } from 'react-router-dom'
import { marketplaces } from './marketplaces'
import ShopeeConnection from './ShopeeConnection'
import ShopeeCatalog from './ShopeeCatalog'
import styles from '@/features/portal/OwnerWorkspace.module.css'

export default function MarketplaceWorkspace({ session, screen }) {
  const [params, setParams] = useSearchParams()
  const provider = Object.hasOwn(marketplaces, params.get('marketplace')) ? params.get('marketplace') : 'shopee'
  return <><label className={styles.field}>Marketplace<select value={provider} onChange={event => setParams(event.target.value === 'shopee' ? {} : { marketplace: event.target.value })}>{Object.entries(marketplaces).map(([id, item]) => <option key={id} value={id}>{item.name}</option>)}</select></label>{screen === 'shops' ? <ShopeeConnection key={provider} session={session} provider={provider} /> : <ShopeeCatalog key={provider + screen} screen={screen} provider={provider} />}</>
}
