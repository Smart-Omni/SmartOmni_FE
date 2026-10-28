import axios from 'axios'
import { apiBaseUrl } from './config'
import { clearApiSession, readApiSession, saveApiSession } from './session'

const transport = axios.create({ baseURL: apiBaseUrl, timeout: 120_000 })
let refreshing

export class ApiError extends Error {
  constructor(message, status, code) { super(message); this.name = 'ApiError'; this.status = status; this.code = code }
}

async function failure(error) {
  let body = error.response?.data
  if (body instanceof Blob) {
    try { body = JSON.parse(await body.text()) } catch { body = null }
  }
  return new ApiError(body?.message || (error.response?.status === 502 ? 'Backend is starting or unavailable. Please try again.' : error.response ? `Request failed (${error.response.status}).` : 'Cannot reach SmartOmni API. Check that the backend is running.'), error.response?.status, body?.code || body?.errorCode)
}

async function refresh(session) {
  if (!refreshing) {
    refreshing = transport.post('/api/v1/auth/refresh', { refresh_token: session.refreshToken })
      .then(response => {
        if (!response.data.success) throw new Error('Session expired. Sign in again.')
        if (readApiSession()?.refreshToken === session.refreshToken) saveApiSession(response.data.data)
      }).catch(error => {
        if (readApiSession()?.refreshToken === session.refreshToken) clearApiSession()
        throw error
      }).finally(() => { refreshing = null })
  }
  return refreshing
}

export async function request(path, { method = 'GET', body, params, signal, authenticated = true, blob = false } = {}) {
  const initialSession = readApiSession()
  async function send() {
    const session = readApiSession()
    if (authenticated && !session) throw new ApiError('Your session has expired. Sign in again.', 401)
    return transport.request({ url: path, method, data: body, params, signal, responseType: blob ? 'blob' : 'json', headers: authenticated ? { Authorization: `Bearer ${session.accessToken}` } : {} })
  }
  let response
  try { response = await send() } catch (error) {
    if (axios.isCancel(error)) throw error
    if (error.response?.status === 401 && authenticated && initialSession && path !== '/api/v1/auth/logout') {
      try {
        if (readApiSession()?.refreshToken === initialSession.refreshToken) await refresh(initialSession)
        if (readApiSession()?.account.id !== initialSession.account.id) throw new ApiError('Session changed. Please try again.', 401)
        response = await send()
      } catch (retryError) {
        if (retryError.response?.status === 401) clearApiSession()
        throw await failure(retryError)
      }
    } else { throw error instanceof ApiError ? error : await failure(error) }
  }
  if (blob) {
    if (!response.headers['content-type']?.includes('application/pdf')) throw new ApiError('The server did not return a PDF document.', response.status)
    return response.data
  }
  if (response.data?.success !== true) throw new ApiError(response.data?.message || 'Unexpected API response.', response.status, response.data?.code)
  return response.data.data ?? null
}
