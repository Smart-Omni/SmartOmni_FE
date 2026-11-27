export function maskPhone(phone) {
  if (!phone) return '—'
  const trimmed = String(phone).trim()
  if (trimmed.includes('*')) return trimmed
  if (trimmed.length <= 4) return '****'
  if (trimmed.length <= 7) return `${trimmed.slice(0, 2)}****${trimmed.slice(-2)}`
  return `${trimmed.slice(0, 3)}****${trimmed.slice(-3)}`
}

export function maskAddress(fullAddress) {
  if (!fullAddress) return '—'
  const trimmed = String(fullAddress).trim()
  if (trimmed.includes('*')) return trimmed
  const comma = trimmed.indexOf(',')
  if (comma > 0 && comma < trimmed.length - 1) return `******${trimmed.slice(comma)}`
  if (trimmed.length <= 8) return '****'
  return `${trimmed.slice(0, 2)}****${trimmed.slice(-4)}`
}
