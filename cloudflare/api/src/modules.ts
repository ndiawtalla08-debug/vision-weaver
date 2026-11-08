import { body, HttpError, id, int, json, hashPassword, requireAdmin, requireStoreManager, requireUser, safeEqual, sha256, str, type Ctx } from './lib'
import { productRoutes } from './products'

type Handler = (c: Ctx) => Promise<Response>
export const routes: [string, string, Handler][] = [...productRoutes]
const r = (method: string, path: string, h: Handler) => routes.push([method, path, h])
const SESSION_DAYS = 30

// ---------- Authentification ----------
r('POST', '/auth/register', async c => {
  const b = await body(c.req)
  const emailValue = str(b['email'], 'email', 200)
  const password = str(b['password'], 'mot de passe', 200)
  if (!emailValue || !password) throw new HttpError(400, 'Email et mot de passe requis.')
  const email = emailValue.toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(400, 'Email invalide.')
  if (password.length < 8) throw new HttpError(400, 'Mot de passe : 8 caractères minimum.')
  if (await c.env.DB.prepare('SELECT 1 FROM users WHERE email = ?').bind(email).first()) throw new HttpError(409, 'Email déjà utilisé.')
  const { hash, salt } = await hashPassword(password); const uid = id()
  const token = id() + id()
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString()
  await c.env.DB.batch([
    c.env.DB.prepare('INSERT INTO users (id, email, password_hash, password_salt) VALUES (?,?,?,?)').bind(uid, email, hash, salt),
    c.env.DB.prepare('INSERT INTO user_profiles (user_id, full_name, phone, city) VALUES (?,?,?,?)').bind(uid, str(b['full_name'], 'nom', 120, false), str(b['phone'], 'téléphone', 30, false), str(b['city'], 'ville', 80, false)),
    c.env.DB.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?,?,?)').bind(await sha256(token), uid, expires),
  ])
  return json({ token, expires_at: expires, user: { id: uid, email, role: 'user' } }, 201)
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
r('PATCH', '/products/:id', async c => {
  requireUser(c)
  const productId = str(c.params['id'], 'identifiant produit', 64)
  if (!productId || !/^[A-Za-z0-9_-]+$/.test(productId)) throw new HttpError(400, 'Identifiant produit invalide.')
  const product = await c.env.DB.prepare('SELECT id, store_id, status FROM products WHERE id = ?').bind(productId)
    .first<{ id: string; store_id: string; status: string }>()
  if (!product) throw new HttpError(404, 'Produit introuvable.')
  await requireStoreManager(c, product.store_id)
  const store = await c.env.DB.prepare('SELECT id, status FROM stores WHERE id = ?').bind(product.store_id).first<{ id: string; status: string }>()
  if (!store) throw new HttpError(404, 'Boutique introuvable.')
  if (store.status === 'suspended') throw new HttpError(403, 'Boutique suspendue.')
  const b = await body(c.req)
  if (!b || typeof b !== 'object' || Array.isArray(b)) throw new HttpError(400, 'Données produit invalides.')
  const allowed = ['store_id','name','description','price','old_price','stock','category_id','status','image']
  if (Object.keys(b).some(key => !allowed.includes(key))) throw new HttpError(400, 'Champ non autorisé.')
  if ('store_id' in b && b['store_id'] !== product.store_id) throw new HttpError(400, 'La boutique du produit ne peut pas changer.')
  const columns: string[] = []; const values: (string | number | null)[] = []
  const add = (column: string, value: string | number | null) => { columns.push(`${column}=?`); values.push(value) }
  if ('category_id' in b) {
    const category = str(b['category_id'], 'catégorie', 64, false)
    if (category && (!/^[A-Za-z0-9_-]+$/.test(category) || !await c.env.DB.prepare('SELECT id FROM categories WHERE id = ?').bind(category).first())) throw new HttpError(400, 'Catégorie introuvable.')
    add('category_id', category)
  }
  if ('name' in b) { const name = str(b['name'], 'nom', 120); if (!name) throw new HttpError(400, 'Nom requis.'); add('name', name) }
  if ('description' in b) add('description', str(b['description'], 'description', 5000, false))
  for (const field of ['price','old_price','stock'] as const) {
    if (!(field in b)) continue
    const value = b[field]
    if (field === 'old_price' && value === null) { add(field, null); continue }
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new HttpError(400, `Champ invalide : ${field}.`)
    add(field, value)
  }
  if ('status' in b) {
    if (b['status'] !== 'draft' && b['status'] !== 'published') throw new HttpError(400, 'Choisissez brouillon ou publication.')
    add('status', b['status'])
  }
  const imageProvided = 'image' in b
  const image = imageProvided ? str(b['image'], 'photo', 750000, false) : null
  if (image && !/^https:\/\/[^\s]+$|^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image)) throw new HttpError(400, 'Photo invalide.')
  if (!columns.length && !imageProvided) throw new HttpError(400, 'Aucune modification fournie.')
  // Column names come only from the fixed allowlist; all values remain bound parameters.
  const statements = [c.env.DB.prepare(`UPDATE products SET ${columns.length ? columns.join(', ') + ', ' : ''}updated_at=datetime('now') WHERE id=? AND store_id=?`)
    .bind(...values, product.id, product.store_id)]
  if (imageProvided) {
    statements.push(c.env.DB.prepare('DELETE FROM product_images WHERE product_id = ? AND position = 0').bind(product.id))
    if (image) statements.push(c.env.DB.prepare('INSERT INTO product_images (id, product_id, url, position) VALUES (?,?,?,0)').bind(id(), product.id, image))
  }
  await c.env.DB.batch(statements)
  return json({ id: product.id, store_id: product.store_id, status: b['status'] ?? product.status })
})
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
