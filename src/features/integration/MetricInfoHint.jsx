import { useEffect, useId, useRef, useState } from 'react'
import { CircleHelp } from 'lucide-react'
import styles from './InsightsDemo.module.css'

/**
 * Accessible info popover (`?`) triggered on hover, keyboard focus, or click/tap.
 */
export default function MetricInfoHint({ title, definition, formula, period, source, align = 'left' }) {
  const [open, setOpen] = useState(false)
  const [pinned, setPinned] = useState(false)
  const wrapRef = useRef(null)
  const popoverId = useId()

  useEffect(() => {
    if (!open) return undefined
    const handlePointerDown = event => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) {
        setOpen(false)
        setPinned(false)
      }
    }
    const handleKeyDown = event => {
      if (event.key === 'Escape') {
        setOpen(false)
        setPinned(false)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <span
      ref={wrapRef}
      className={`${styles.hintWrap} ${open ? styles.hintWrapOpen : ''}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => { if (!pinned) setOpen(false) }}
    >
      <button
        type="button"
        className={styles.hintButton}
        aria-label={`Giải thích chỉ số: ${title}`}
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        onFocus={() => setOpen(true)}
        onBlur={event => {
          if (!pinned && !wrapRef.current?.contains(event.relatedTarget)) {
            setOpen(false)
          }
        }}
        onClick={event => {
          event.stopPropagation()
          setPinned(prev => {
            const next = !prev
            setOpen(next)
            return next
          })
        }}
      >
        <CircleHelp size={14} aria-hidden="true" />
      </button>
      {open && (
        <span
          id={popoverId}
          role="tooltip"
          className={`${styles.hintPopover} ${align === 'right' ? styles.hintPopoverRight : ''}`}
        >
          <strong>{title}</strong>
          {definition && <span className={styles.hintRow}><b>Ý nghĩa:</b> {definition}</span>}
          {formula && <span className={styles.hintRow}><b>Cách tính:</b> {formula}</span>}
          {period && <span className={styles.hintRow}><b>Chu kỳ:</b> {period}</span>}
          {source && <span className={styles.hintRow}><b>Nguồn:</b> {source}</span>}
        </span>
      )}
    </span>
  )
}
