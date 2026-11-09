// Client direct conservé pour les futurs appels authentifiés ; les lectures publiques
// passent par d1.functions.ts afin de fonctionner aussi dans la prévisualisation.
// L'adresse vient de VITE_TOUTSUITE_API_URL ; aucune clé secrète n'est utilisée ici.
import { d1BaseUrl } from './d1-schema'
export const apiUrl = (import.meta.env['VITE_TOUTSUITE_API_URL'] as string | undefined)?.replace(/\/$/, '') ?? d1BaseUrl

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message) }
}
export const productImageUrl = (image?: string | null, key?: string | null) => {
  if (key) return `${d1BaseUrl}/images?key=${encodeURIComponent(key)}`
  if (!image) return ''
  if (/^https:\/\/|^data:image\//.test(image)) return image
  return `${d1BaseUrl}/images?key=${encodeURIComponent(image)}`
}

export async function api<T>(path: string, init: RequestInit & { token?: string | undefined } = {}, baseUrl = apiUrl): Promise<T> {
  if (!baseUrl) throw new Error('API Cloudflare non configurée.')
  const headers = new Headers(init.headers)
  headers.set('content-type', 'application/json')
  if (init.token) headers.set('authorization', `Bearer ${init.token}`)
  const res = await fetch(`${baseUrl}${path}`, { ...init, headers })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? `Erreur ${res.status}`)
  return data as T
}
