import { Link } from 'react-router-dom'
import { AuthLayout } from '../components/AuthLayout'
import styles from '../components/AuthForm.module.css'

export default function ApiUnavailablePage() {
  return <AuthLayout showBackLink={false} footer={<Link to="/auth/login">Back to sign in</Link>}><div className={styles.container}><h1>This feature is not connected yet.</h1><p>Customer accounts can register and manage their profile. Workspace accounts must be created by an authorized administrator. Customer loyalty features are not available yet.</p><Link to="/auth/register/customer">Create a Customer account</Link><p><Link to="/customer/profile">Open your profile</Link></p></div></AuthLayout>
}
