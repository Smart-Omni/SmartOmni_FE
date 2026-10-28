import { Button } from '@/shared/ui/button'
import { Feedback } from '@/features/portal/components/OwnerWorkspaceUI'

export function ResourceState({ resource }) {
  return resource.loading ? <p role="status">Loading…</p> : resource.error ? <><Feedback value={{ error: true, message: resource.error }} /><Button variant="outline" onClick={resource.reload}>Try again</Button></> : null
}
