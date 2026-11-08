import { getCookie, setCookie, deleteCookie, getRequestUrl, setResponseHeader } from '@tanstack/react-start/server'
import { z } from 'zod'
import { d1BaseUrl } from './d1-schema'

const cookieName = 'toutsuite-d1-session'
export const userSchema = z.object({ id: z.string(), email: z.string() })
export class D1AccessError extends Error { constructor(public status: number, message: string) { super(message) } }
export async function d1Request(path: '/me' | '/favorites' | '/auth/login' | '/auth/logout', token?: string, method = 'GET', body?: unknown) {
  setResponseHeader('cache-control', 'private, no-store')
  const response = await fetch(`${d1BaseUrl}${path}`, {
    method, signal: AbortSignal.timeout(15000),
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  if (!response.ok) {
    // Do not log auth response bodies: a provider could echo credentials.
    throw new D1AccessError(response.status, response.status === 401 ? 'Connexion requise ou session expirée.' : response.status === 403 ? 'Accès refusé à ce compte.' : 'Le service D1 est momentanément indisponible.')
  }
  return response.json() as Promise<unknown>
}
export async function requireD1Session() {
  const token = getCookie(cookieName)
  if (!token) throw new D1AccessError(401, 'Connectez-vous pour retrouver vos favoris.')
  const { user } = z.object({ user: userSchema }).parse(await d1Request('/me', token))
  return { token, user }
}
export function storeD1Token(token: string, expiresAt: string) {
  setCookie(cookieName, token, { httpOnly: true, secure: getRequestUrl().protocol === 'https:', sameSite: 'lax', path: '/', maxAge: Math.max(0, Math.min(30 * 86400, Math.floor((Date.parse(expiresAt) - Date.now()) / 1000))) })
}
export function clearD1Token() { deleteCookie(cookieName, { path: '/' }) }