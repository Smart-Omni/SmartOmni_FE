import { Link } from 'react-router-dom'
import { AuthLayout } from '../components/AuthLayout'
import styles from '../components/AuthForm.module.css'

export default function ApiUnavailablePage() {
  return <AuthLayout showBackLink={false} footer={<Link to="/auth/login">Back to sign in</Link>}><div className={styles.container}><h1>This feature is not connected yet.</h1><p>Owners can register their account and store. Customers can register with an existing store. Staff accounts must be created by an authorized administrator. Customer loyalty features are not available yet.</p><Link to="/auth/register/owner">Create an Owner account</Link><p><Link to="/auth/register/customer">Create a Customer account</Link></p><p><Link to="/customer/profile">Open your profile</Link></p></div></AuthLayout>
}
