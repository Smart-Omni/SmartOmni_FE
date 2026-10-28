import { useRef, useState } from 'react'

export function useApiAction() {
  const lock = useRef(false)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState(null)
  async function run(action, message, after) {
    if (lock.current) return
    lock.current = true; setBusy(true); setFeedback(null)
    try {
      const result = await action()
      setFeedback({ message: typeof message === 'function' ? message(result) : message })
      after?.(result)
      return result
    } catch (error) { setFeedback({ error: true, message: error.message }); return undefined }
    finally { lock.current = false; setBusy(false) }
  }
  return { busy, feedback, run }
}

export const money = value => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(value || 0))
export const dateTime = value => value ? new Date(typeof value === 'number' ? value * 1000 : value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '—'
