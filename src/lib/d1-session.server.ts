import { getCookie, setCookie, deleteCookie, getRequestUrl, setResponseHeader } from '@tanstack/react-start/server'
import { z } from 'zod'
import { d1BaseUrl } from './d1-schema'
import { profileSchema } from './d1-auth-schema'
import { api, ApiError } from './api-client'

const cookieName = 'toutsuite-d1-session'
export const userSchema = z.object({ id: z.string(), email: z.string() })
export class D1AccessError extends Error { constructor(public status: number, message: string) { super(message) } }
type D1Path = '/me/announcement-messages' | `/announcements/${string}/messages` | '/me' | '/favorites' | '/auth/register' | '/auth/login' | '/auth/logout' | '/my/products' | '/me/stores' | '/products' | `/me/products?store=${string}` | `/products/${string}`
export async function d1Request(path: D1Path, token?: string, method = 'GET', body?: unknown) {
  setResponseHeader('cache-control', 'private, no-store')
  try { return await api<unknown>(path, {
    method, signal: AbortSignal.timeout(15000),
    token,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }, d1BaseUrl) } catch (e) {
    if (!(e instanceof ApiError)) throw e
    const response = e
    // Do not log auth response bodies: a provider could echo credentials.
    throw new D1AccessError(response.status, response.status === 404 && (path === '/my/products' || path.startsWith('/me/stores') || path.startsWith('/me/products') || method === 'PATCH' && path.startsWith('/products/')) ? 'La gestion des produits nécessite la mise à jour de votre API Cloudflare.' : response.status === 404 ? 'Produit ou boutique introuvable.' : response.status === 409 ? 'Cette valeur existe déjà.' : response.status === 400 ? 'Les informations envoyées sont invalides.' : response.status === 401 ? 'Connexion requise ou session expirée.' : response.status === 403 ? 'Vous n’avez pas accès à cette boutique.' : 'Le service D1 est momentanément indisponible.')
  }
}
export async function requireD1Session() {
  const token = getCookie(cookieName)
  if (!token) throw new D1AccessError(401, 'Connectez-vous pour accéder à votre compte.')
  const { user, profile } = z.object({ user: userSchema, profile: profileSchema }).parse(await d1Request('/me', token))
  return { token, user, profile }
}
export function storeD1Token(token: string, expiresAt: string) {
  setCookie(cookieName, token, { httpOnly: true, secure: getRequestUrl().protocol === 'https:', sameSite: 'lax', path: '/', maxAge: Math.max(0, Math.min(30 * 86400, Math.floor((Date.parse(expiresAt) - Date.now()) / 1000))) })
}
export function clearD1Token() { deleteCookie(cookieName, { path: '/' }) }