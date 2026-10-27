import { Link } from 'react-router-dom'
import { ArrowUpRight, Sparkles } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { useStorefront } from './useStorefront'
import styles from './ShopWelcome.module.css'

export function ShopWelcome() {
  const { store, settings, base } = useStorefront()
  return <section className={styles.welcome} aria-label="Store introduction"><div className={styles.copy}><span>{store.category}</span><h1>{settings.profile.name}</h1><p>{settings.profile.description}</p><Button asChild><Link to={`${base}/assistant`}><Sparkles size={16} aria-hidden="true" />Find your favourites with AI <ArrowUpRight size={16} aria-hidden="true" /></Link></Button></div><div className={styles.art}><img src={store.image} className={store.contain ? styles.contain : ''} alt="" /><span>{store.initials}</span></div></section>
}
