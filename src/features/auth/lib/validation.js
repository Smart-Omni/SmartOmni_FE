const labels = { fullName: 'your full name', email: 'your email address', storeName: 'your store name', targetDomain: 'your target domain', password: 'your password', confirmPassword: 'your password again' }

import { demoDomainIssue } from './demoDomain'

export function validateField(name, value, values = {}) {
  const missing = name === 'password' || name === 'confirmPassword' ? !value : !value.trim()
  if (missing) return `Enter ${labels[name]}.`
  if (name === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return 'Enter a valid email address, like you@example.com.'
  if (name === 'confirmPassword' && value !== values.password) return 'Passwords do not match. Enter the same password.'
  if (name === 'targetDomain') return demoDomainIssue(value)
  // Never transform passwords or invent a password complexity policy.
  return ''
}
