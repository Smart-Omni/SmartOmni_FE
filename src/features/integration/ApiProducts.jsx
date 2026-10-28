import { useCallback, useState } from 'react'
import { Button } from '@/shared/ui/button'
import { productApi, requireId } from '@/services/api/operations'
import { DataTable, Feedback, OwnerPanel } from '@/features/portal/components/OwnerWorkspaceUI'
import { useApiResource } from './useApiResource'
import { ResourceState } from './ShopeeShared'
import { money, useApiAction } from './apiHelpers'
import styles from '@/features/portal/OwnerWorkspace.module.css'

export default function ApiProducts() {
  const [id, setId] = useState('')
  const [selected, setSelected] = useState(null)
  const [error, setError] = useState('')
  return <><OwnerPanel title="Find an internal product"><p>Enter a product ID. Product browsing and search are not available yet.</p><form className={styles.form} onSubmit={event => { event.preventDefault(); try { setSelected(requireId(id, 'product ID')); setError('') } catch (failure) { setError(failure.message) } }}><label className={styles.field}>Product ID<input required inputMode="numeric" value={id} onChange={event => setId(event.target.value)} /></label><div className={styles.actions}><Button type="submit">Find product</Button></div>{error && <p role="alert" className={styles.error}>{error}</p>}</form></OwnerPanel>{selected && <ProductDetail key={selected} id={selected} />}<ProductCreator onCreated={product => { setId(String(product.id)); setSelected(String(product.id)) }} /></>
}

function ProductDetail({ id }) {
  const loader = useCallback(async signal => {
    const [product, skus] = await Promise.all([productApi.detail(id, signal), productApi.skus(id, signal)])
    return { product, skus }
  }, [id])
  const resource = useApiResource(loader)
  return <OwnerPanel title="Product details"><ResourceState resource={resource} />{resource.data && <><h3>{resource.data.product.name}</h3><p>{resource.data.product.description || 'No description provided.'}</p><p>Product ID: {id}</p><DataTable label="Product SKUs" headings={['SKU ID', 'SKU code', 'Variant', 'Base price']}>{resource.data.skus.map(sku => <tr key={sku.id}><td>{sku.id}</td><td>{sku.skuCode}</td><td>{sku.variantName || '—'}</td><td>{sku.basePrice == null ? '—' : money(sku.basePrice)}</td></tr>)}</DataTable>{!resource.data.skus.length && <p>No SKUs returned for this product.</p>}<Button variant="outline" onClick={resource.reload}>Refresh product</Button></>}</OwnerPanel>
}

function ProductCreator({ onCreated }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [skus, setSkus] = useState([{ key: 0, skuCode: '', variantName: '', basePrice: '' }])
  const [nextKey, setNextKey] = useState(1)
  const action = useApiAction()
  function update(key, field, value) { setSkus(rows => rows.map(row => row.key === key ? { ...row, [field]: value } : row)) }
  function submit(event) {
    event.preventDefault()
    action.run(async () => {
      const codes = skus.map(sku => sku.skuCode.trim())
      if (!name.trim() || codes.some(code => !code)) throw new Error('Enter a product name and SKU codes.')
      if (new Set(codes).size !== codes.length) throw new Error('Each SKU code must be unique in this product.')
      const payload = skus.map(sku => {
        const price = Number(sku.basePrice)
        if (!sku.basePrice.trim() || !Number.isFinite(price) || price < 0) throw new Error('Enter a valid non-negative base price for each SKU.')
        return { skuCode: sku.skuCode.trim(), variantName: sku.variantName.trim(), basePrice: price }
      })
      const product = await productApi.create({ name: name.trim(), description: description.trim(), skus: payload })
      if (!product?.id) throw new Error('Product was submitted but no product ID was returned. Check before submitting again.')
      return product
    }, product => `Product ${product.id} created.`, product => { onCreated(product); setName(''); setDescription(''); setSkus([{ key: 0, skuCode: '', variantName: '', basePrice: '' }]); setNextKey(1) })
  }
  return <OwnerPanel title="Create an internal product"><p>This creates a SmartOmni product. It does not publish a listing to a marketplace.</p><form className={styles.form} onSubmit={submit}><label className={styles.field}>Product name<input required value={name} disabled={action.busy} onChange={event => setName(event.target.value)} /></label><label className={styles.field}>Product description<textarea value={description} disabled={action.busy} onChange={event => setDescription(event.target.value)} /></label>{skus.map((sku, index) => <fieldset key={sku.key} disabled={action.busy}><legend>SKU {index + 1}</legend><label className={styles.field}>SKU code<input required value={sku.skuCode} onChange={event => update(sku.key, 'skuCode', event.target.value)} /></label><label className={styles.field}>Variant name<input value={sku.variantName} onChange={event => update(sku.key, 'variantName', event.target.value)} /></label><label className={styles.field}>Base price (VND)<input required type="number" min="0" step="0.01" value={sku.basePrice} onChange={event => update(sku.key, 'basePrice', event.target.value)} /></label>{skus.length > 1 && <Button type="button" variant="secondary" onClick={() => setSkus(rows => rows.filter(row => row.key !== sku.key))}>Remove SKU {index + 1}</Button>}</fieldset>)}<div className={styles.actions}><Button type="button" variant="outline" disabled={action.busy} onClick={() => { setSkus(rows => [...rows, { key: nextKey, skuCode: '', variantName: '', basePrice: '' }]); setNextKey(nextKey + 1) }}>Add SKU</Button><Button type="submit" disabled={action.busy}>{action.busy ? 'Creating…' : 'Create product'}</Button></div><Feedback value={action.feedback} /></form></OwnerPanel>
}
