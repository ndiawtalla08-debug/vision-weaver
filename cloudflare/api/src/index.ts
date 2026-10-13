import { HttpError, json, sha256, type Ctx, type Env, type User } from './lib'
import { routes } from './modules'

function cors(req: Request, env: Env): Record<string, string> {
  const origin = req.headers.get('origin') ?? ''
  const allowed = env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
  if (!allowed.includes(origin)) return {}
  return { 'access-control-allow-origin': origin, 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS', vary: 'origin' }
}

async function currentUser(req: Request, env: Env): Promise<User | null> {
  const token = req.headers.get('authorization')?.replace(/^Bearer /, '')
  if (!token) return null
  return env.DB.prepare(`SELECT u.id, u.email, u.role FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.id = ? AND s.expires_at > ? AND u.status = 'active'`).bind(await sha256(token), new Date().toISOString()).first<User>()
}

function match(pattern: string, path: string): Record<string, string> | null {
  const a = pattern.split('/'), b = path.replace(/\/$/, '').split('/')
  if (a.length !== b.length) return null
  const params: Record<string, string> = {}
  for (let i = 0; i < a.length; i++) {
    if (a[i]!.startsWith(':')) params[a[i]!.slice(1)] = decodeURIComponent(b[i]!)
    else if (a[i] !== b[i]) return null
  }
  return params
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const headers = cors(req, env)
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers })
    const url = new URL(req.url)
    let res: Response
    try {
      if (url.pathname === '/health') {
        // Vraie requête SQL sur D1 : vérifie la connexion ET la présence des tables migrées.
        const ping = await env.DB.prepare('SELECT 1 AS ok').first<{ ok: number }>()
        const { results } = await env.DB.prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('users','user_profiles','stores','categories','products','announcements','favorites')").all<{ name: string }>()
        const tables = results.map(t => t.name).sort()
        res = json({ ok: ping?.ok === 1, database: ping?.ok === 1 ? 'connected' : 'error', tables, migrated: tables.length === 7 }, ping?.ok === 1 ? 200 : 503)
      } else {
        const found = routes.map(([m, p, h]) => ({ m, h, params: match(p, url.pathname) })).find(x => x.params && x.m === req.method)
        if (!found) throw new HttpError(404, 'Route inconnue.')
        const ctx: Ctx = { req, env, url, params: found.params!, user: await currentUser(req, env) }
        res = await found.h(ctx)
      }
    } catch (e) {
      if (url.pathname === '/health') { console.error(e); res = json({ ok: false, database: 'unreachable' }, 503) }
      else if (e instanceof HttpError) res = json({ error: e.message }, e.status)
      else if (String(e).includes('UNIQUE')) res = json({ error: 'Cette valeur existe déjà.' }, 409)
      else { console.error(e); res = json({ error: 'Erreur serveur.' }, 500) }
    }
    for (const [k, v] of Object.entries(headers)) res.headers.set(k, v)
    return res
  },
}
