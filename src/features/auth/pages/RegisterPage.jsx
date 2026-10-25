import { useRef, useState } from 'react'
import { ArrowLeft, ArrowUpRight, ChevronLeft, ChevronRight, Store, Users, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AuthLayout } from '../components/AuthLayout'
import { Button } from '@/shared/ui/button'
import formStyles from '../components/AuthForm.module.css'
import styles from './RegisterPage.module.css'

const roles = [
  { id: 'customer', label: 'Customer', icon: UserRound, title: "I'm a Customer", description: 'Claim points from your purchases and keep track of your membership rewards.', action: 'Continue as Customer' },
  { id: 'owner', label: 'Owner', icon: Store, title: "I'm a Store Owner", description: 'Create and manage your own workspace, connect sales channels, and bring your products together.', action: 'Continue as Owner' },
  { id: 'staff', label: 'Staff', icon: Users, title: "I'm a Team Member", description: 'Create your account and join a workspace when a store owner invites you.', action: 'Continue as Staff' },
]

export function RegisterPage() {
  const [selected, setSelected] = useState(0)
  const [offset, setOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const gesture = useRef(null)
  const choose = index => setSelected(Math.max(0, Math.min(roles.length - 1, index)))
  function startDrag(event) {
    if (!event.isPrimary || event.button !== 0 || event.target.closest('a, button')) return
    gesture.current = { id: event.pointerId, x: event.clientX }
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragging(true)
  }
  function moveDrag(event) {
    if (gesture.current?.id !== event.pointerId) return
    const distance = event.clientX - gesture.current.x
    const atEdge = (selected === 0 && distance > 0) || (selected === roles.length - 1 && distance < 0)
    setOffset(distance * (atEdge ? 0.2 : 1))
  }
  function endDrag(event, cancelled = false) {
    if (gesture.current?.id !== event.pointerId) return
    const distance = event.clientX - gesture.current.x
    const threshold = Math.min(60, event.currentTarget.clientWidth * 0.2)
    if (!cancelled && Math.abs(distance) >= threshold) choose(selected + (distance < 0 ? 1 : -1))
    gesture.current = null
    setOffset(0)
    setDragging(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  function keyDown(event) {
    if (event.target !== event.currentTarget) return
    const target = { ArrowLeft: selected - 1, ArrowRight: selected + 1, Home: 0, End: roles.length - 1 }[event.key]
    if (target === undefined) return
    event.preventDefault()
    choose(target)
  }
  return <AuthLayout showBackLink={false}
    footerStart={<Link to="/" className={styles.back}><ArrowLeft size={15} aria-hidden="true" />Back to SmartOmni</Link>}
    footer={<>Already have an account? <Link to="/auth/login">Sign in</Link></>}><div className={formStyles.container}>
    <div className={formStyles.intro}>
      <p className={formStyles.eyebrow}>YOUR NEXT CHAPTER</p>
      <h1>How will you use SmartOmni?</h1>
      <p className={formStyles.subtitle}>Swipe or use the arrows to choose your role.</p>
    </div>
    <div className={styles.roles} role="region" aria-roledescription="carousel" aria-label="Registration roles">
      <div className={styles.viewport} tabIndex={0} aria-label="Role cards. Use left and right arrow keys to choose a role." onKeyDown={keyDown} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={event => endDrag(event, true)} onLostPointerCapture={event => endDrag(event, true)}>
      <div className={`${styles.track} ${dragging ? styles.dragging : ''}`} style={{ transform: `translateX(calc(${-selected * 100}% - ${selected * 16}px + ${offset}px))` }}>
      {roles.map(({ id, icon: Icon, title, description, action }, index) => <section key={id} className={styles.card} role="group" aria-roledescription="slide" aria-label={`${index + 1} of ${roles.length}`} aria-hidden={selected !== index} inert={selected !== index}>
          <span className={styles.icon}><Icon size={22} aria-hidden="true" /></span>
          <div className={styles.roleCopy}><h2>{title}</h2><p>{description}</p></div>
        <Button asChild className={styles.continue}><Link draggable={false} to={`/auth/register/${id}`}>{action}<ArrowUpRight aria-hidden="true" /></Link></Button>
      </section>)}
      </div></div>
      <div className={styles.controls}>
        <Button type="button" variant="outline" size="icon" aria-label="Previous role" disabled={selected === 0} onClick={() => choose(selected - 1)}><ChevronLeft aria-hidden="true" /></Button>
        <div className={styles.indicators} aria-label="Choose registration role">{roles.map(({ id, label }, index) => <button key={id} type="button" aria-label={`Select ${label}`} aria-pressed={selected === index} className={styles.indicator} onClick={() => choose(index)}><span /></button>)}</div>
        <Button type="button" variant="outline" size="icon" aria-label="Next role" disabled={selected === roles.length - 1} onClick={() => choose(selected + 1)}><ChevronRight aria-hidden="true" /></Button>
      </div>
      <p className={styles.position} role="status" aria-live="polite">{roles[selected].label} · {selected + 1} of {roles.length}</p>
    </div>
  </div></AuthLayout>
}
