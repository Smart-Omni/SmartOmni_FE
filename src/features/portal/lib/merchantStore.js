import { useMemo, useSyncExternalStore } from 'react'
import { recordOwnerSettingActivity } from './ownerAudit'
import { assignedManagerEmail, assignedManagerMember, managerPermissions } from '@/features/auth/data/managerAccess'
export { managerPermissions } from '@/features/auth/data/managerAccess'

export const settingsKey = 'smartomni.store-settings-demo.v1'
export const teamKey = 'smartomni.team-demo.v1'
const changeEvent = 'smartomni:merchant-demo'
export const defaultSettings = {
  profile: { name: 'Everyday Studio', email: '', phone: '', description: 'Considered essentials for your space and your everyday.' },
  appearance: { accent: 'neutral', headline: '', announcement: '', density: 'comfortable' },
  policies: { shipping: '', returns: '', privacy: '' },
}
const accents = ['neutral', 'forest', 'navy']

function raw(key) { try { return localStorage.getItem(key) || '' } catch { return '' } }
function decode(value, fallback) { try { return JSON.parse(value) ?? fallback } catch { return fallback } }
function subscribe(listener) {
  const onStorage = event => { if (!event.key || [settingsKey, teamKey].includes(event.key)) listener() }
  window.addEventListener('storage', onStorage)
  window.addEventListener(changeEvent, listener)
  return () => { window.removeEventListener('storage', onStorage); window.removeEventListener(changeEvent, listener) }
}
function useStored(key, fallback) {
  const value = useSyncExternalStore(subscribe, () => raw(key), () => '')
  return useMemo(() => decode(value, fallback), [value, fallback])
}
const emptyTeam = []
export function useStoreSettings() {
  const stored = useStored(settingsKey, defaultSettings)
  return normalizeSettings(stored)
}
export function useTeam() {
  const stored = useStored(teamKey, emptyTeam)
  return Array.isArray(stored) ? stored : emptyTeam
}
function normalizeSettings(value) {
  const result = {}
  for (const section of Object.keys(defaultSettings)) {
    result[section] = {}
    for (const [field, fallback] of Object.entries(defaultSettings[section])) result[section][field] = typeof value?.[section]?.[field] === 'string' ? value[section][field] : fallback
  }
  if (!accents.includes(result.appearance.accent)) result.appearance.accent = 'neutral'
  if (!['comfortable', 'compact'].includes(result.appearance.density)) result.appearance.density = 'comfortable'
  return result
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { throw new Error('Could not save. Allow browser storage and try again.') }
  recordOwnerSettingActivity(key === settingsKey ? 'Store settings updated' : 'Manager directory updated')
  window.dispatchEvent(new Event(changeEvent))
  window.dispatchEvent(new Event('smartomni:demo-session'))
}
function requireActiveTenant() {
  const platform = decode(raw('smartomni.platform-demo.v1'), {})
  if (platform.tenants?.find(item => item.id === 'demo-tenant')?.status === 'SUSPENDED') throw new Error('This workspace is suspended.')
}
function requireOwner() {
  if (sessionStorage.getItem('smartomni.demo-session') !== 'demo-owner') throw new Error('Only the workspace owner can make this change.')
  requireActiveTenant()
}
export function saveStoreSection(section, values) {
  requireOwner()
  if (!Object.hasOwn(defaultSettings, section)) throw new Error('Unknown settings section.')
  const current = normalizeSettings(decode(raw(settingsKey), defaultSettings))
  const next = normalizeSettings({ ...current, [section]: values })
  for (const field of Object.keys(next[section])) next[section][field] = next[section][field].trim()
  if (section === 'profile' && !next.profile.name) throw new Error('Enter your store name.')
  if (section === 'profile' && next.profile.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.profile.email)) throw new Error('Enter a valid contact email.')
  write(settingsKey, next)
}
export function readManagerMembership(email = 'manager@smartomni.demo') {
  const team = decode(raw(teamKey), [])
  return Array.isArray(team) ? team.find(member => member.email === email && member.status !== 'REVOKED') : undefined
}
export function initializeAssignedManager() {
  const marker = 'smartomni.assigned-manager-seeded.v1'
  if (localStorage.getItem(marker)) return
  const team = readTeam()
  // Explicit fixture initialization on first sign-in only. Deleted/suspended memberships are never recreated by subsequent sign-ins.
  if (!team.some(member => member.email === assignedManagerEmail)) write(teamKey, [...team, structuredClone(assignedManagerMember)])
  localStorage.setItem(marker, 'true')
}
function readTeam() {
  const value = decode(raw(teamKey), [])
  return Array.isArray(value) ? value : []
}
function cleanPermissions(permissions) { return managerPermissions.filter(item => permissions.includes(item.id)).map(item => item.id) }
function managerEmail(email) {
  const normalized = typeof email === 'string' ? email.trim().toLowerCase() : ''
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new Error('Enter a valid email address.')
  if (normalized.length > 254) throw new Error('Email must be 254 characters or fewer.')
  if (['owner@smartomni.demo', 'admin@smartomni.demo'].includes(normalized)) throw new Error('This account cannot be invited as manager.')
  return normalized
}
function managerProfile(profile) {
  const limits = { fullName: 100, phone: 40, jobTitle: 100, notes: 1000 }
  const result = {}
  for (const [field, limit] of Object.entries(limits)) {
    const value = typeof profile[field] === 'string' ? profile[field].trim() : ''
    if (value.length > limit) throw new Error(`${field === 'fullName' ? 'Full name' : field === 'jobTitle' ? 'Job title' : field} must be ${limit} characters or fewer.`)
    result[field] = value
  }
  if (!result.fullName) throw new Error('Enter the manager’s full name.')
  return result
}
function checkManagerRevision(member, expectedRevision) {
  if (expectedRevision && JSON.stringify(member) !== expectedRevision) throw new Error('This manager record changed in another tab. Close and reopen it before saving.')
}
export function inviteManager(email, permissions, profile) {
  requireOwner()
  const normalized = managerEmail(email)
  const team = readTeam()
  if (team.some(item => item.email === normalized && item.status !== 'REVOKED')) throw new Error('This email already has a membership or pending invitation.')
  const allowed = cleanPermissions(permissions)
  if (!allowed.length) throw new Error('Select at least one permission.')
  const details = managerProfile(profile || {})
  const now = new Date().toISOString()
  write(teamKey, [...team.filter(item => item.email !== normalized), { id: crypto.randomUUID(), ...details, email: normalized, permissions: allowed, status: 'INVITED', invitedAt: now, updatedAt: now }])
}
export function updateManager(id, changes, expectedRevision) {
  requireOwner()
  const team = readTeam()
  const member = team.find(item => item.id === id)
  if (!member) throw new Error('This membership is no longer available.')
  checkManagerRevision(member, expectedRevision)
  const status = changes.status || member.status
  const transitions = { INVITED: ['INVITED', 'REVOKED'], ACTIVE: ['ACTIVE', 'SUSPENDED', 'REVOKED'], SUSPENDED: ['SUSPENDED', 'ACTIVE', 'REVOKED'] }
  if (!transitions[member.status]?.includes(status)) throw new Error('This membership can no longer be changed. Refresh the page.')
  const permissions = cleanPermissions(changes.permissions || member.permissions)
  if (!permissions.length && status !== 'REVOKED') throw new Error('Select at least one permission.')
  const email = changes.email === undefined ? member.email : managerEmail(changes.email)
  if (email !== member.email && member.status !== 'INVITED') throw new Error('Email cannot be changed after the invitation is accepted.')
  if (email !== member.email && team.some(item => item.id !== id && item.email === email)) throw new Error('This email already has a manager record.')
  const hasProfileChanges = ['fullName', 'phone', 'jobTitle', 'notes'].some(field => Object.hasOwn(changes, field))
  const profile = hasProfileChanges ? managerProfile({ ...member, ...changes }) : {}
  write(teamKey, team.map(item => item.id === id ? { ...item, ...profile, email, status, permissions, updatedAt: new Date().toISOString() } : item))
}
export function deleteManager(id, expectedRevision) {
  requireOwner()
  const team = readTeam()
  const member = team.find(item => item.id === id)
  if (!member) throw new Error('This manager record has already been deleted.')
  checkManagerRevision(member, expectedRevision)
  write(teamKey, team.filter(item => item.id !== id))
}
export function acceptManagerInvitation(id) {
  if (!['demo-manager', 'demo-active-manager'].includes(sessionStorage.getItem('smartomni.demo-session'))) throw new Error('Sign in as the invited demo manager account.')
  requireActiveTenant()
  const team = readTeam()
  const activeAccount = sessionStorage.getItem('smartomni.demo-session')
  const email = activeAccount === 'demo-active-manager' ? assignedManagerEmail : 'manager@smartomni.demo'
  const invitation = team.find(item => item.id === id && item.email === email && item.status === 'INVITED')
  if (!invitation) throw new Error('This invitation is no longer available.')
  const now = new Date().toISOString()
  write(teamKey, team.map(item => item.id === id ? { ...item, status: 'ACTIVE', acceptedAt: now, updatedAt: now } : item))
}
