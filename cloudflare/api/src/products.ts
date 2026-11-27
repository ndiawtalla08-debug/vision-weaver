import type { Ctx } from './lib'
import { HttpError, body, id, int, json, requireStoreManager, requireUser, str } from './lib'

type Handler = (c: Ctx) => Promise<Response>
type Route = [string, string, Handler]

/** Domaine public des photos (domaine personnalisé du Worker toutsuite-api, vérifié). */
export const IMAGE_BASE_URL = 'https://api.toutsuiteannonces.com/images/'
const MAX_IMAGES = 5
const DATA_IMAGE = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/
const IMAGE_VALUE = /^https:\/\/[^\s]+$|^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/

const identifier = (value: unknown): string => {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(value)) {
    throw new HttpError(400, 'Identifiant invalide')
  }
  return value
}

/** Clé R2 d'une URL servie par ce Worker (/images/:id), sinon null. */
export function imageKey(url: string): string | null {
  return url.match(/\/images\/([A-Za-z0-9_-]{1,64})$/)?.[1] ?? null
}

/** Boutique existante, gérée par l'utilisateur et non suspendue. */
async function storeAccess(c: Ctx, storeId: string) {
  requireUser(c)
  const store = await c.env.DB.prepare('SELECT id, status FROM stores WHERE id = ?')
    .bind(storeId).first<{ id: string; status: string }>()
  if (!store) throw new HttpError(404, 'Boutique introuvable.')
  await requireStoreManager(c, storeId)
  if (store.status === 'suspended') throw new HttpError(403, 'Boutique suspendue.')
}

/** Upload d'une photo data URL vers Cloudflare R2 ; renvoie son URL publique. */
export async function saveProductImage(c: Ctx, image: string): Promise<string> {
  const match = image.match(DATA_IMAGE)
  if (!match) throw new HttpError(400, 'Format de photo invalide')
  const base64 = match[2]!
  if (base64.length > 5_000_000) throw new HttpError(400, 'Photo trop volumineuse')
  const binary = Uint8Array.from(atob(base64), ch => ch.charCodeAt(0))
  const imageId = id()
  await c.env.IMAGES.put(imageId, binary, { httpMetadata: { contentType: `image/${match[1]}` } })
  return `${IMAGE_BASE_URL}${imageId}`
}

/** Liste ordonnée de photos (images[] prioritaire, sinon image unique). */
export function readImages(b: Record<string, unknown>): string[] {
  let images: unknown[] = []
  if ('images' in b) {
    if (!Array.isArray(b['images'])) throw new HttpError(400, 'Photos invalides.')
    images = b['images']
  }
  if (!images.length && typeof b['image'] === 'string' && b['image']) images = [b['image']]
  if (images.length > MAX_IMAGES) throw new HttpError(400, '5 photos maximum.')
  for (const image of images) {
    if (typeof image !== 'string' || !IMAGE_VALUE.test(image)) throw new HttpError(400, 'Photo invalide.')
  }
  return images as string[]
}

/** Ajoute le tableau images (ordre de position) à partir de images_json. */
function withImages(rows: any[]) {
  return rows.map(({ images_json, ...row }) => {
    let images: string[] = []
    try { images = JSON.parse(images_json || '[]').filter((u: unknown) => typeof u === 'string') } catch { images = [] }
    return { ...row, images }
  })
}

const imageColumns = `
  (SELECT url FROM product_images i WHERE i.product_id = p.id ORDER BY position LIMIT 1) AS image,
  (SELECT json_group_array(url) FROM (SELECT url FROM product_images i WHERE i.product_id = p.id ORDER BY position)) AS images_json`

async function createFields(c: Ctx, b: Record<string, unknown>) {
  const allowed = ['store_id', 'category_id', 'name', 'description', 'price', 'old_price', 'stock', 'status', 'image', 'images']
  if (Object.keys(b).some(k => !allowed.includes(k))) throw new HttpError(400, 'Champ non autorisé.')
  const category = b['category_id'] == null || b['category_id'] === '' ? null : identifier(b['category_id'])
  if (category && !await c.env.DB.prepare('SELECT id FROM categories WHERE id = ?').bind(category).first()) {
    throw new HttpError(400, 'Catégorie introuvable.')
  }
  const status = b['status'] ?? 'draft'
  if (status !== 'draft' && status !== 'published') throw new HttpError(400, 'Choisissez brouillon ou publication.')
  const name = str(b['name'], 'nom', 120)
  if (!name) throw new HttpError(400, 'Nom requis.')
  return {
    category, name, status: status as string,
    description: str(b['description'], 'description', 5000, false),
    price: int(b['price'], 'prix'),
    oldPrice: int(b['old_price'], 'ancien prix', false),
    stock: int(b['stock'], 'stock', false) ?? 0,
    images: readImages(b),
  }
}

export const productRoutes: Route[] = [
  /** Photo R2 */
  ['GET', '/images/:id', async c => {
    const object = await c.env.IMAGES.get(identifier(c.params['id']))
    if (!object) return new Response('Image introuvable', { status: 404 })
    const headers = new Headers()
    object.writeHttpMetadata(headers)
    headers.set('Cache-Control', 'public, max-age=31536000')
    headers.set('Content-Type', headers.get('Content-Type') || 'image/jpeg')
    return new Response(object.body, { headers })
  }],

  /** Produits de toutes les boutiques gérées par le vendeur */
  ['GET', '/my/products', async c => {
    const u = requireUser(c)
    const { results } = await c.env.DB.prepare(`SELECT p.*, s.name AS store_name, ${imageColumns}
      FROM products p JOIN stores s ON s.id = p.store_id
      WHERE s.owner_id = ?1 OR EXISTS (SELECT 1 FROM store_members m WHERE m.store_id = s.id AND m.user_id = ?1 AND m.role IN ('owner','manager'))
      ORDER BY p.created_at DESC`).bind(u.id).all()
    return json({ products: withImages(results) })
  }],

  /** Boutiques gérées (propriétaire ou gestionnaire) */
  ['GET', '/me/stores', async c => {
    const u = requireUser(c)
    const { results } = await c.env.DB.prepare(`SELECT DISTINCT s.id, s.slug, s.name, s.description, s.logo_url, s.status FROM stores s
      LEFT JOIN store_members m ON m.store_id = s.id AND m.user_id = ?1
      WHERE s.owner_id = ?1 OR m.role IN ('owner','manager') ORDER BY s.created_at DESC`).bind(u.id).all()
    return json({ stores: results })
  }],

  /** Produits (brouillons inclus) d'une boutique gérée */
  ['GET', '/me/products', async c => {
    requireUser(c)
    const storeId = identifier(c.url.searchParams.get('store'))
    await storeAccess(c, storeId)
    const { results } = await c.env.DB.prepare(`SELECT p.*, ${imageColumns} FROM products p WHERE p.store_id = ? ORDER BY p.created_at DESC`)
      .bind(storeId).all()
    return json({ products: withImages(results) })
  }],

  /** Produits publics : publiés et boutique active */
  ['GET', '/products', async c => {
    const store = c.url.searchParams.get('store')
    const cat = c.url.searchParams.get('category')
    const { results } = await c.env.DB.prepare(`SELECT p.id, p.store_id, p.category_id, p.name, p.description, p.price, p.old_price, p.stock, ${imageColumns}
      FROM products p JOIN stores s ON s.id = p.store_id
      WHERE p.status = 'published' AND s.status = 'active' AND (?1 IS NULL OR p.store_id = ?1) AND (?2 IS NULL OR p.category_id = ?2)
      ORDER BY p.created_at DESC LIMIT 100`).bind(store ? identifier(store) : null, cat ? identifier(cat) : null).all()
    return json({ products: withImages(results) })
  }],

  /** Création avec jusqu'à 5 photos (R2 puis D1, ordre conservé) */
  ['POST', '/products', async c => {
    requireUser(c)
    const b = await body(c.req)
    const storeId = identifier(b['store_id'])
    await storeAccess(c, storeId)
    const f = await createFields(c, b)
    const productId = id()
    const urls: string[] = []
    const uploaded: string[] = []
    for (const image of f.images) {
      if (image.startsWith('data:')) { const url = await saveProductImage(c, image); uploaded.push(url); urls.push(url) }
      else urls.push(image)
    }
    const statements = [
      c.env.DB.prepare('INSERT INTO products (id, store_id, category_id, name, description, price, old_price, stock, status) VALUES (?,?,?,?,?,?,?,?,?)')
        .bind(productId, storeId, f.category, f.name, f.description, f.price, f.oldPrice, f.stock, f.status),
      ...urls.map((url, position) =>
        c.env.DB.prepare('INSERT INTO product_images (id, product_id, url, position) VALUES (?,?,?,?)').bind(id(), productId, url, position)),
    ]
    try {
      await c.env.DB.batch(statements)
    } catch (e) {
      // D1 a échoué : on retire les photos tout juste envoyées dans R2.
      for (const url of uploaded) { const key = imageKey(url); if (key) await c.env.IMAGES.delete(key).catch(() => undefined) }
      throw e
    }
    return json({ id: productId, store_id: storeId, status: f.status, images_count: urls.length }, 201)
  }],

  /** Suppression d'un produit, de ses photos D1 puis R2 */
  ['DELETE', '/products/:id', async c => {
    requireUser(c)
    const productId = identifier(c.params['id'])
    const product = await c.env.DB.prepare('SELECT id, store_id, status FROM products WHERE id = ?')
      .bind(productId).first<{ id: string; store_id: string }>()
    if (!product) throw new HttpError(404, 'Produit introuvable.')
    await storeAccess(c, product.store_id)
    const { results } = await c.env.DB.prepare('SELECT url FROM product_images WHERE product_id = ?')
      .bind(product.id).all<{ url: string }>()
    await c.env.DB.batch([
      c.env.DB.prepare('DELETE FROM products WHERE id = ? AND store_id = ?').bind(product.id, product.store_id),
      c.env.DB.prepare('DELETE FROM product_images WHERE product_id = ?').bind(product.id),
    ])
    for (const row of results ?? []) {
      const key = imageKey(row.url)
      if (key) await c.env.IMAGES.delete(key).catch(() => undefined)
    }
    return json({ ok: true, success: true })
  }],
]
