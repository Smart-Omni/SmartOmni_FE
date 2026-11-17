import { Button } from '@/shared/ui/button'
import { Link } from 'react-router-dom'
import { Feedback } from '@/features/portal/components/OwnerWorkspaceUI'
import { isTiktokShopDisconnected } from './marketplaces'

export function ResourceState({ resource }) {
  return resource.loading ? <p role="status">Loading…</p> : resource.error ? <><Feedback value={{ error: true, message: resource.error }} /><Button variant="outline" onClick={resource.reload}>Try again</Button></> : null
}

export function TiktokResourceState({ resource }) {
  if (isTiktokShopDisconnected(resource)) return <>
    <p>Connect a TikTok Shop to use this feature.</p>
    <Button asChild variant="outline"><Link to="/merchant/shops?marketplace=tiktok-shop">Connect TikTok Shop</Link></Button>
  </>
  return <ResourceState resource={resource} />
}
