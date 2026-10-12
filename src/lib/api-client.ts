// Client de l'API Cloudflare Workers (D1). Non branché aux pages tant que la connexion n'est pas testée.
// L'adresse vient de VITE_TOUTSUITE_API_URL ; aucune clé secrète n'est utilisée ici.
export const apiUrl = (import.meta.env['VITE_TOUTSUITE_API_URL'] as string | undefined)?.replace(/\/$/, '') ?? ''

export async function api<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  if (!apiUrl) throw new Error('API Cloudflare non configurée.')
  const headers = new Headers(init.headers)
  headers.set('content-type', 'application/json')
  if (init.token) headers.set('authorization', `Bearer ${init.token}`)
  const res = await fetch(`${apiUrl}${path}`, { ...init, headers })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Erreur ${res.status}`)
  return data as T
}
