import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog'
import { Button } from '@/shared/ui/button'
import { DataTable, OwnerPanel } from '@/features/portal/components/OwnerWorkspaceUI'
import { marketplaceListings, priceHistory } from './data/managerFixtures'
import styles from '@/features/portal/OwnerWorkspace.module.css'

const money = amount => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)
export default function ManagerPrices({ data }) {
  const [query, setQuery] = useState('')
  const [listing, setListing] = useState(null)
  const [tab, setTab] = useState('prices')
  const rows = marketplaceListings.filter(item => `${item.title} ${item.expectedSku} ${item.platform}`.toLowerCase().includes(query.trim().toLowerCase()))
  const discrepancies = [...new Set(marketplaceListings.map(item => item.expectedSku))].map(sku => ({ sku, offers: marketplaceListings.filter(item => item.expectedSku === sku) })).filter(item => new Set(item.offers.map(offer => offer.price)).size > 1)
  return <>
    <OwnerPanel title="Marketplace prices & promotions"><div className={styles.actions}><button className={styles.status} aria-pressed={tab === 'prices'} onClick={() => setTab('prices')}>Prices & promotions</button><button className={styles.status} aria-pressed={tab === 'alerts'} onClick={() => setTab('alerts')}>Price discrepancy alerts</button></div><p>Source: illustrative marketplace snapshots as of 23 Oct 2026. Base-price discrepancies compare the same sample SKU before promotions; they do not imply a live pricing error.</p>
      {tab === 'prices' ? <><label className={styles.field}>Search marketplace prices<input type="search" value={query} onChange={event => setQuery(event.target.value)} /></label><DataTable label="Marketplace prices" headings={['Internal SKU / product', 'Marketplace', 'Base price', 'Promotion', 'Actions']}>{rows.map(item => <tr key={item.id}><td>{item.expectedSku}<p>{data.products.find(product => product.sku === item.expectedSku)?.name || item.title}</p></td><td>{item.platform}<p>{item.externalId}</p></td><td>{money(item.price)}</td><td>{item.promotion ? <>{item.promotion.name}<p>{money(item.promotion.price)} · {item.promotion.start} – {item.promotion.end}</p></> : 'No promotion in snapshot'}</td><td><Button variant="outline" onClick={() => setListing(item)}>View price history</Button></td></tr>)}</DataTable>{!rows.length && <p>No prices match your search.</p>}</>
        : discrepancies.length ? <DataTable label="Price discrepancy alerts" headings={['SKU', 'Marketplace base prices', 'Difference', 'Scope']}>{discrepancies.map(item => <tr key={item.sku}><td>{item.sku}</td><td>{item.offers.map(offer => <p key={offer.id}>{offer.platform}: {money(offer.price)}</p>)}</td><td>{money(Math.max(...item.offers.map(offer => offer.price)) - Math.min(...item.offers.map(offer => offer.price)))}</td><td>Sample base-price mismatch; review promotions separately.</td></tr>)}</DataTable> : <p>No base-price discrepancies in the sample.</p>}
    </OwnerPanel>
    <Dialog open={Boolean(listing)} onOpenChange={open => { if (!open) setListing(null) }}><DialogContent className={styles.dialog}><DialogTitle>Price history</DialogTitle><DialogDescription>{listing?.title} · {listing?.platform} · sample snapshots.</DialogDescription>{listing && (priceHistory.some(item => item.listingId === listing.id) ? <DataTable label="Price history rows" headings={['Date', 'Before', 'After', 'Source']}>{priceHistory.filter(item => item.listingId === listing.id).map(item => <tr key={item.id}><td>{new Date(item.at).toLocaleString('en-GB')}</td><td>{money(item.before)}</td><td>{money(item.after)}</td><td>{item.source}</td></tr>)}</DataTable> : <p>No historical change is available for this sample listing.</p>)}</DialogContent></Dialog>
  </>
}
