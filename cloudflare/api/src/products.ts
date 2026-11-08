import { body, HttpError, id, int, json, requireStoreManager, requireUser, str, type Ctx } from './lib'

type Handler = (c: Ctx) => Promise<Response>
const identifier = (v: unknown) => {
  const value = str(v, 'identifiant', 64)
  if (!value || !/^[A-Za-z0-9_-]+$/.test(value)) throw new HttpError(400, 'Identifiant invalide.')
  return value
}
async function storeAccess(c: Ctx, storeId: string) {
  requireUser(c)
  const store = await c.env.DB.prepare('SELECT id, status FROM stores WHERE id = ?').bind(storeId).first<{ id: string; status: string }>()
  if (!store) throw new HttpError(404, 'Boutique introuvable.')
  await requireStoreManager(c, storeId)
  if (store.status === 'suspended') throw new HttpError(403, 'Boutique suspendue.')
}
async function productAccess(c: Ctx) {
  requireUser(c)
  const pid = identifier(c.params['id'])
  const product = await c.env.DB.prepare('SELECT id, store_id FROM products WHERE id = ?').bind(pid).first<{ id: string; store_id: string }>()
  if (!product) throw new HttpError(404, 'Produit introuvable.')
  await storeAccess(c, product.store_id)
  return product
}
async function fields(c: Ctx, b: Record<string, unknown>) {
  if (Object.keys(b).some(k => !['store_id','category_id','name','description','price','old_price','stock','status','image'].includes(k))) throw new HttpError(400, 'Champ non autorisé.')
  const category = b['category_id'] == null || b['category_id'] === '' ? null : identifier(b['category_id'])
  if (category && !await c.env.DB.prepare('SELECT id FROM categories WHERE id = ?').bind(category).first()) throw new HttpError(400, 'Catégorie introuvable.')
  const status = b['status'] ?? 'draft'
  if (status !== 'draft' && status !== 'published') throw new HttpError(400, 'Choisissez brouillon ou publication.')
  const name = str(b['name'], 'nom', 120)
  if (!name) throw new HttpError(400, 'Nom requis.')
  const image = str(b['image'], 'photo', 750000, false)
  if (image && !/^https:\/\/[^\s]+$|^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image)) throw new HttpError(400, 'Photo invalide.')
  return { category, name, description: str(b['description'], 'description', 5000, false), price: int(b['price'], 'prix'), oldPrice: int(b['old_price'], 'ancien prix', false), stock: int(b['stock'], 'stock', false) ?? 0, status, image }
}
const selection = `SELECT p.id, p.store_id, p.category_id, p.name, p.description, p.price, p.old_price, p.stock, p.status,
 (SELECT url FROM product_images i WHERE i.product_id = p.id ORDER BY position LIMIT 1) AS image FROM products p`
export const productRoutes: [string, string, Handler][] = [
  ['GET', '/me/stores', async c => {
    const u = requireUser(c)
    const { results } = await c.env.DB.prepare(`SELECT DISTINCT s.id, s.slug, s.name, s.description, s.status FROM stores s
      LEFT JOIN store_members m ON m.store_id = s.id AND m.user_id = ?1
      WHERE s.owner_id = ?1 OR m.role IN ('owner','manager') ORDER BY s.created_at DESC`).bind(u.id).all()
    return json({ stores: results })
  }],
  ['GET', '/me/products', async c => {
    requireUser(c)
    const sid = identifier(c.url.searchParams.get('store'))
    await storeAccess(c, sid)
    const { results } = await c.env.DB.prepare(`${selection} WHERE p.store_id = ? ORDER BY p.created_at DESC`).bind(sid).all()
    return json({ products: results })
  }],
  ['POST', '/products', async c => {
    requireUser(c)
    const b = await body(c.req); const sid = identifier(b['store_id'])
    await storeAccess(c, sid)
    const f = await fields(c, b); const pid = id()
    const statements = [c.env.DB.prepare('INSERT INTO products (id, store_id, category_id, name, description, price, old_price, stock, status) VALUES (?,?,?,?,?,?,?,?,?)')
      .bind(pid, sid, f.category, f.name, f.description, f.price, f.oldPrice, f.stock, f.status)]
    if (f.image) statements.push(c.env.DB.prepare('INSERT INTO product_images (id, product_id, url, position) VALUES (?,?,?,0)').bind(id(), pid, f.image))
    await c.env.DB.batch(statements)
    return json({ id: pid, store_id: sid, status: f.status }, 201)
  }],
  ['PATCH', '/products/:id', async c => {
    const product = await productAccess(c); const b = await body(c.req)
    if (b['store_id'] !== product.store_id) throw new HttpError(400, 'La boutique du produit ne peut pas changer.')
    const f = await fields(c, b)
    const statements = [c.env.DB.prepare(`UPDATE products SET category_id=?, name=?, description=?, price=?, old_price=?, stock=?, status=?, updated_at=datetime('now') WHERE id=? AND store_id=?`)
      .bind(f.category, f.name, f.description, f.price, f.oldPrice, f.stock, f.status, product.id, product.store_id),
      c.env.DB.prepare('DELETE FROM product_images WHERE product_id = ? AND position = 0').bind(product.id)]
    if (f.image) statements.push(c.env.DB.prepare('INSERT INTO product_images (id, product_id, url, position) VALUES (?,?,?,0)').bind(id(), product.id, f.image))
    await c.env.DB.batch(statements)
    return json({ id: product.id, store_id: product.store_id, status: f.status })
  }],
  ['DELETE', '/products/:id', async c => {
    const product = await productAccess(c)
    await c.env.DB.prepare('DELETE FROM products WHERE id = ? AND store_id = ?').bind(product.id, product.store_id).run()
    return json({ ok: true })
  }],
]