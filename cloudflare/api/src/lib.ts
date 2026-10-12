export interface Env { DB: D1Database; ALLOWED_ORIGINS: string }
export type User = { id: string; email: string; role: 'user' | 'seller' | 'admin' }
export type Ctx = { req: Request; env: Env; url: URL; params: Record<string, string>; user: User | null }

export class HttpError extends Error { constructor(public status: number, message: string) { super(message) } }

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } })

export const id = () => crypto.randomUUID()

export async function body<T = Record<string, unknown>>(req: Request): Promise<T> {
  try { return (await req.json()) as T } catch { throw new HttpError(400, 'Corps de requête invalide.') }
}
export function str(v: unknown, field: string, max = 500, required = true): string | null {
  if (v == null || v === '') { if (required) throw new HttpError(400, `Champ requis : ${field}.`); return null }
  if (typeof v !== 'string' || v.length > max) throw new HttpError(400, `Champ invalide : ${field}.`)
  return v.trim()
}
export function int(v: unknown, field: string, required = true): number | null {
  if (v == null || v === '') { if (required) throw new HttpError(400, `Champ requis : ${field}.`); return null }
  const n = Number(v); if (!Number.isInteger(n) || n < 0) throw new HttpError(400, `Champ invalide : ${field}.`)
  return n
}

export function requireUser(c: Ctx): User {
  if (!c.user) throw new HttpError(401, 'Connexion requise.')
  return c.user
}
export function requireAdmin(c: Ctx): User {
  const u = requireUser(c); if (u.role !== 'admin') throw new HttpError(403, 'Accès réservé aux administrateurs.')
  return u
}
/** Vérifie côté serveur que l'utilisateur gère la boutique (propriétaire, gérant) ou est admin. */
export async function requireStoreManager(c: Ctx, storeId: string): Promise<User> {
  const u = requireUser(c); if (u.role === 'admin') return u
  const row = await c.env.DB.prepare(
    `SELECT 1 FROM stores s LEFT JOIN store_members m ON m.store_id = s.id AND m.user_id = ?1
     WHERE s.id = ?2 AND (s.owner_id = ?1 OR m.role IN ('owner','manager'))`).bind(u.id, storeId).first()
  if (!row) throw new HttpError(403, 'Vous ne gérez pas cette boutique.')
  return u
}

// --- Mots de passe : PBKDF2-SHA256, 100 000 itérations, sel aléatoire ---
const b64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf)))
export async function hashPassword(password: string, saltB64?: string) {
  const salt = saltB64 ? Uint8Array.from(atob(saltB64), ch => ch.charCodeAt(0)) : crypto.getRandomValues(new Uint8Array(16))
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100_000 }, key, 256)
  return { hash: b64(bits), salt: b64(salt) }
}
export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}
export async function sha256(text: string) {
  return b64(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))
}
