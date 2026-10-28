import { Link } from 'react-router-dom'
import { AuthLayout } from '../components/AuthLayout'
import styles from '../components/AuthForm.module.css'

export default function ApiUnavailablePage() {
  return <AuthLayout showBackLink={false} footer={<Link to="/auth/login">Back to sign in</Link>}><div className={styles.container}><h1>This feature is not connected yet.</h1><p>The current backend does not provide account registration or customer loyalty APIs. Use an account provisioned by your administrator to sign in.</p></div></AuthLayout>
}
