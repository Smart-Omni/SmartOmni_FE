import { useCallback } from 'react'
import { tiktokApi } from '@/services/api/tiktok'
import { useApiResource } from './useApiResource'
import { ResourceState } from './ShopeeShared'
import styles from '@/features/portal/OwnerWorkspace.module.css'

export function RejectReasonSelect({ id, value, onChange, disabled }) {
  const loader = useCallback(signal => tiktokApi.rejectReasons(id, signal), [id])
  const resource = useApiResource(loader)
  return <>
    <ResourceState resource={resource} />
    <label className={styles.field}>Reject reason (optional)
      <select value={value} disabled={disabled || resource.loading} onChange={event => onChange(event.target.value)}>
        <option value="">Use TikTok default</option>
        {resource.data?.map(item => <option key={item.name} value={item.name}>{item.text || item.textVi || item.name}</option>)}
      </select>
    </label>
  </>
}
