import { useCallback } from 'react'
import { tiktokApi } from '@/services/api/tiktok'
import { useApiResource } from './useApiResource'
import { ResourceState } from './ShopeeShared'
import styles from '@/features/portal/OwnerWorkspace.module.css'

export function RejectReasonSelect({ id, value, onChange, disabled, label = 'Reject reason (optional)', defaultLabel = 'Use TikTok default' }) {
  const loader = useCallback(signal => tiktokApi.rejectReasons(id, signal), [id])
  const resource = useApiResource(loader)
  return <>
    <ResourceState resource={resource} />
    <label className={styles.field}>{label}
      <select value={value} disabled={disabled || resource.loading} onChange={event => onChange(event.target.value)}>
        <option value="">{defaultLabel}</option>
        {resource.data?.map(item => <option key={item.name} value={item.name}>{item.text || item.textVi || item.name}</option>)}
      </select>
    </label>
  </>
}
