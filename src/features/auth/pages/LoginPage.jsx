import { ArrowLeft } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { AuthForm } from '../components/AuthForm'
import { AuthLayout } from '../components/AuthLayout'
import styles from '../components/AuthLayout.module.css'
import pageStyles from './LoginPage.module.css'

export function LoginPage() {
  const [params] = useSearchParams()
  return <AuthLayout showBackLink={false} alignBackBelowInfo formCardClassName={pageStyles.card}
    footerStart={<Link to="/" className={styles.back}><ArrowLeft size={15} aria-hidden="true" />Back to SmartOmni</Link>}
    footer={<>New to SmartOmni? <Link to={params.get('account') === 'customer' ? '/auth/register/customer' : '/auth/register'}>Create account</Link></>}>
    <AuthForm />
  </AuthLayout>
}
