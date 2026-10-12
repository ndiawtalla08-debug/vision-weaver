import { body, HttpError, id, int, json, hashPassword, requireAdmin, requireStoreManager, requireUser, safeEqual, sha256, str, type Ctx } from './lib'

type Handler = (c: Ctx) => Promise<Response>
export const routes: [string, string, Handler][] = []
const r = (method: string, path: string, h: Handler) => routes.push([method, path, h])
const SESSION_DAYS = 30

// ---------- Authentification ----------
r('POST', '/auth/register', async c => {
  const b = await body(c.req)
  const email = str(b.email, 'email', 200)!.toLowerCase()
  const password = str(b.password, 'mot de passe', 200)!
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(400, 'Email invalide.')
  if (password.length < 8) throw new HttpError(400, 'Mot de passe : 8 caractères minimum.')
  if (await c.env.DB.prepare('SELECT 1 FROM users WHERE email = ?').bind(email).first()) throw new HttpError(409, 'Email déjà utilisé.')
  const { hash, salt } = await hashPassword(password); const uid = id()
  await c.env.DB.batch([
    c.env.DB.prepare('INSERT INTO users (id, email, password_hash, password_salt) VALUES (?,?,?,?)').bind(uid, email, hash, salt),
    c.env.DB.prepare('INSERT INTO user_profiles (user_id, full_name) VALUES (?,?)').bind(uid, str(b.full_name, 'nom', 120, false)),
  ])
  return json({ user: { id: uid, email, role: 'user' } }, 201)
})

r('POST', '/auth/login', async c => {
  const b = await body(c.req)
  const email = str(b.email, 'email', 200)!.toLowerCase(); const password = str(b.password, 'mot de passe', 200)!
  const u = await c.env.DB.prepare('SELECT id, email, role, status, password_hash, password_salt FROM users WHERE email = ?').bind(email)
    .first<{ id: string; email: string; role: string; status: string; password_hash: string; password_salt: string }>()
  const ok = u && safeEqual((await hashPassword(password, u.password_salt)).hash, u.password_hash)
  if (!u || !ok) throw new HttpError(401, 'Email ou mot de passe incorrect.')
  if (u.status !== 'active') throw new HttpError(403, 'Compte suspendu.')
  const token = id() + id()
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString()
  await c.env.DB.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?,?,?)').bind(await sha256(token), u.id, expires).run()
  return json({ token, expires_at: expires, user: { id: u.id, email: u.email, role: u.role } })
})

r('POST', '/auth/logout', async c => {
  const token = c.req.headers.get('authorization')?.replace(/^Bearer /, '')
  if (token) await c.env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(await sha256(token)).run()
  return json({ ok: true })
})

// ---------- Utilisateurs ----------
r('GET', '/me', async c => {
  const u = requireUser(c)
  const profile = await c.env.DB.prepare('SELECT full_name, phone, city, avatar_url FROM user_profiles WHERE user_id = ?').bind(u.id).first()
  return json({ user: u, profile })
})
r('PATCH', '/me', async c => {
  const u = requireUser(c); const b = await body(c.req)
  await c.env.DB.prepare(`INSERT INTO user_profiles (user_id, full_name, phone, city) VALUES (?1,?2,?3,?4)
    ON CONFLICT(user_id) DO UPDATE SET full_name=?2, phone=?3, city=?4, updated_at=datetime('now')`)
    .bind(u.id, str(b.full_name, 'nom', 120, false), str(b.phone, 'téléphone', 30, false), str(b.city, 'ville', 80, false)).run()
  return json({ ok: true })
})
r('GET', '/admin/users', async c => {
  requireAdmin(c)
  const { results } = await c.env.DB.prepare('SELECT id, email, role, status, created_at FROM users ORDER BY created_at DESC LIMIT 200').all()
  return json({ users: results })
})
r('PATCH', '/admin/users/:id', async c => {
  requireAdmin(c); const b = await body(c.req)
  const role = str(b.role, 'rôle', 10, false); const status = str(b.status, 'statut', 10, false)
  await c.env.DB.prepare(`UPDATE users SET role = COALESCE(?, role), status = COALESCE(?, status), updated_at = datetime('now') WHERE id = ?`)
    .bind(role, status, c.params['id']).run()
  return json({ ok: true })
})

// ---------- Catégories ----------
r('GET', '/categories', async c => {
  const { results } = await c.env.DB.prepare('SELECT id, parent_id, slug, name, position FROM categories ORDER BY position, name').all()
  return json({ categories: results })
})
r('POST', '/categories', async c => {
  requireAdmin(c); const b = await body(c.req); const cid = id()
  await c.env.DB.prepare('INSERT INTO categories (id, parent_id, slug, name, position) VALUES (?,?,?,?,?)')
    .bind(cid, str(b.parent_id, 'parent', 64, false), str(b.slug, 'slug', 80)!, str(b.name, 'nom', 80)!, int(b.position, 'position', false) ?? 0).run()
  return json({ id: cid }, 201)
})

// ---------- Boutiques ----------
r('GET', '/stores', async c => {
  const { results } = await c.env.DB.prepare(`SELECT id, slug, name, description, plan FROM stores WHERE status = 'active' ORDER BY created_at DESC LIMIT 100`).all()
  return json({ stores: results })
})
r('GET', '/stores/:id', async c => {
  const s = await c.env.DB.prepare(`SELECT id, slug, name, description, plan FROM stores WHERE (id = ?1 OR slug = ?1) AND status = 'active'`).bind(c.params['id']).first()
  if (!s) throw new HttpError(404, 'Boutique introuvable.')
  return json({ store: s })
})
r('POST', '/stores', async c => {
  const u = requireUser(c); const b = await body(c.req); const sid = id()
  const plan = str(b.plan, 'formule', 10, false) ?? 'starter'
  await c.env.DB.batch([
    c.env.DB.prepare('INSERT INTO stores (id, owner_id, slug, name, description, plan) VALUES (?,?,?,?,?,?)')
      .bind(sid, u.id, str(b.slug, 'slug', 80)!, str(b.name, 'nom', 120)!, str(b.description, 'description', 2000, false), plan),
    c.env.DB.prepare(`INSERT INTO store_members (store_id, user_id, role) VALUES (?,?,'owner')`).bind(sid, u.id),
  ])
  return json({ id: sid, status: 'pending' }, 201)
})
r('PATCH', '/admin/stores/:id', async c => {
  requireAdmin(c); const b = await body(c.req)
  await c.env.DB.prepare(`UPDATE stores SET status = ?, updated_at = datetime('now') WHERE id = ?`).bind(str(b.status, 'statut', 10)!, c.params['id']).run()
  return json({ ok: true })
})

// ---------- Produits ----------
r('GET', '/products', async c => {
  const store = c.url.searchParams.get('store'); const cat = c.url.searchParams.get('category')
  const { results } = await c.env.DB.prepare(`SELECT p.id, p.store_id, p.category_id, p.name, p.description, p.price, p.old_price, p.stock,
      (SELECT url FROM product_images i WHERE i.product_id = p.id ORDER BY position LIMIT 1) AS image
    FROM products p JOIN stores s ON s.id = p.store_id
    WHERE p.status = 'published' AND s.status = 'active' AND (?1 IS NULL OR p.store_id = ?1) AND (?2 IS NULL OR p.category_id = ?2)
    ORDER BY p.created_at DESC LIMIT 100`).bind(store, cat).all()
  return json({ products: results })
})
r('GET', '/products/:id', async c => {
  const p = await c.env.DB.prepare(`SELECT p.* FROM products p JOIN stores s ON s.id = p.store_id WHERE p.id = ? AND p.status = 'published' AND s.status = 'active'`).bind(c.params['id']).first()
  if (!p) throw new HttpError(404, 'Produit introuvable.')
  const [images, variants] = await Promise.all([
    c.env.DB.prepare('SELECT id, url, position FROM product_images WHERE product_id = ? ORDER BY position').bind(c.params['id']).all(),
    c.env.DB.prepare('SELECT id, size, color, price, stock FROM product_variants WHERE product_id = ?').bind(c.params['id']).all(),
  ])
  return json({ product: p, images: images.results, variants: variants.results })
})
r('POST', '/products', async c => {
  const b = await body(c.req); const storeId = str(b.store_id, 'boutique', 64)!
  await requireStoreManager(c, storeId); const pid = id()
  await c.env.DB.prepare('INSERT INTO products (id, store_id, category_id, name, description, price, old_price, stock, status) VALUES (?,?,?,?,?,?,?,?,?)')
    .bind(pid, storeId, str(b.category_id, 'catégorie', 64, false), str(b.name, 'nom', 120)!, str(b.description, 'description', 5000, false),
      int(b.price, 'prix')!, int(b.old_price, 'ancien prix', false), int(b.stock, 'stock', false) ?? 0, str(b.status, 'statut', 10, false) ?? 'draft').run()
  return json({ id: pid }, 201)
})
r('DELETE', '/products/:id', async c => {
  const p = await c.env.DB.prepare('SELECT store_id FROM products WHERE id = ?').bind(c.params['id']).first<{ store_id: string }>()
  if (!p) throw new HttpError(404, 'Produit introuvable.')
  await requireStoreManager(c, p.store_id)
  await c.env.DB.prepare('DELETE FROM products WHERE id = ?').bind(c.params['id']).run()
  return json({ ok: true })
})

// ---------- Annonces ----------
r('GET', '/announcements', async c => {
  const { results } = await c.env.DB.prepare(`SELECT a.id, a.title, a.description, a.price, a.city, a.category_id, a.created_at,
      (SELECT url FROM announcement_images i WHERE i.announcement_id = a.id ORDER BY position LIMIT 1) AS image
    FROM announcements a WHERE a.status = 'published' ORDER BY a.created_at DESC LIMIT 100`).all()
  return json({ announcements: results })
})
r('POST', '/announcements', async c => {
  const u = requireUser(c); const b = await body(c.req); const aid = id()
  await c.env.DB.prepare('INSERT INTO announcements (id, user_id, category_id, title, description, price, city) VALUES (?,?,?,?,?,?,?)')
    .bind(aid, u.id, str(b.category_id, 'catégorie', 64, false), str(b.title, 'titre', 120)!, str(b.description, 'description', 5000, false),
      int(b.price, 'prix', false), str(b.city, 'ville', 80, false)).run()
  return json({ id: aid, status: 'pending' }, 201)
})
r('PATCH', '/admin/announcements/:id', async c => {
  requireAdmin(c); const b = await body(c.req)
  await c.env.DB.prepare(`UPDATE announcements SET status = ?, updated_at = datetime('now') WHERE id = ?`).bind(str(b.status, 'statut', 10)!, c.params['id']).run()
  return json({ ok: true })
})

// ---------- Favoris ----------
r('GET', '/favorites', async c => {
  const u = requireUser(c)
  const { results } = await c.env.DB.prepare('SELECT product_id, announcement_id, created_at FROM favorites WHERE user_id = ? ORDER BY created_at DESC').bind(u.id).all()
  return json({ favorites: results })
})
r('POST', '/favorites', async c => {
  const u = requireUser(c); const b = await body(c.req)
  const pid = str(b.product_id, 'produit', 64, false); const aid = str(b.announcement_id, 'annonce', 64, false)
  if (!pid === !aid) throw new HttpError(400, 'Indiquez un produit ou une annonce.')
  await c.env.DB.prepare('INSERT OR IGNORE INTO favorites (user_id, product_id, announcement_id) VALUES (?,?,?)').bind(u.id, pid, aid).run()
  return json({ ok: true }, 201)
})
r('DELETE', '/favorites', async c => {
  const u = requireUser(c); const b = await body(c.req)
  await c.env.DB.prepare('DELETE FROM favorites WHERE user_id = ? AND (product_id = ? OR announcement_id = ?)')
    .bind(u.id, str(b.product_id, 'produit', 64, false), str(b.announcement_id, 'annonce', 64, false)).run()
  return json({ ok: true })
})
