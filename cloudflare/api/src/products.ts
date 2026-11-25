import type { Ctx } from './lib'
import {
  HttpError,
  body,
  id,
  json,
  requireUser,
  str,
} from './lib'

type Handler = (c: Ctx) => Promise<Response>
type Route = [string, string, Handler]

const identifier = (value: unknown): string => {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(value)) {
    throw new HttpError(400, 'Identifiant invalide')
  }
  return value
}

async function storeAccess(c: Ctx, storeId: string) {
  return await (await import('./lib')).requireStoreManager(c, storeId)
}

/**
 * Upload d'une image vers Cloudflare R2
 */
export async function saveProductImage(c: Ctx, image: string): Promise<string> {
  if (!image) return ''

  const match = image.match(
  /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/
)

  if (!match) {
    throw new HttpError(400, 'Format de photo invalide')
  }

  const mime = `image/${match[1]}`
  const base64 = match[2]

  if (base64.length > 5000000) {
    throw new HttpError(400, 'Photo trop volumineuse')
  }

  const binary = Uint8Array.from(atob(base64), char => char.charCodeAt(0))
  const imageId = id()

  await c.env.IMAGES.put(imageId, binary, {
    httpMetadata: {
      contentType: mime,
    },
  })

  return `https://api.toutsuiteannonces.com/images/${imageId}`
}

/**
 * Validation des données produit
 */
function fields(data: any) {
  const store_id = identifier(data.store_id)
  const category_id = data.category_id
    ? identifier(data.category_id)
    : null

  const name = str(data.name, 'nom', 120)
  const description = str(data.description ?? '', 'description', 5000, false) ?? ''

  const price = Number(data.price)

  const old_price =
    data.old_price === null || data.old_price === undefined || data.old_price === ''
      ? null
      : Number(data.old_price)

  const stock = Number(data.stock ?? 0)

  if (!Number.isFinite(price) || price < 0) {
    throw new HttpError(400, 'Prix invalide')
  }

  if (old_price !== null && (!Number.isFinite(old_price) || old_price < 0)) {
    throw new HttpError(400, 'Ancien prix invalide')
  }

  if (!Number.isFinite(stock) || stock < 0) {
    throw new HttpError(400, 'Stock invalide')
  }

  const status = data.status === 'published' ? 'published' : 'draft'

  let images: string[] = []

  if (Array.isArray(data.images)) {
    images = data.images
  } else if (data.image) {
    images = [data.image]
  }

  if (images.length > 5) {
    throw new HttpError(400, '5 photos maximum')
  }

  for (const image of images) {
    if (
      typeof image !== 'string' ||
      !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image)
    ) {
      throw new HttpError(400, 'Format de photo invalide')
    }
  }

  return {
    store_id,
    category_id,
    name,
    description,
    price,
    old_price,
    stock,
    status,
    images,
  }
}

/**
 * Routes produits
 */
export const productRoutes: Route[] = [
  /**
   * GET : Image R2
   */
  [
    'GET',
    '/images/:id',
    async c => {
      const imageId = identifier(c.params.id)
      const object = await c.env.IMAGES.get(imageId)

      if (!object) {
        return new Response('Image introuvable', { status: 404 })
      }

      const headers = new Headers()
      object.writeHttpMetadata(headers)
      headers.set('Cache-Control', 'public, max-age=31536000')
      headers.set('Content-Type', headers.get('Content-Type') || 'image/jpeg')

      return new Response(object.body, { headers })
    },
  ],

  /**
   * GET : Produits du vendeur
   */
  [
    'GET',
    '/my/products',
    async c => {
      const user = requireUser(c)

      const { results } = await c.env.DB.prepare(`
        SELECT
          p.*,
          s.name AS store_name,
          (
            SELECT pi.url
            FROM product_images pi
            WHERE pi.product_id = p.id
            ORDER BY pi.position ASC
            LIMIT 1
          ) AS image
        FROM products p
        JOIN stores s ON s.id = p.store_id
        WHERE s.owner_id = ?
        ORDER BY p.created_at DESC
      `).bind(user.id).all()

      return json({ products: results })
    },
  ],

  /**
   * GET : Boutiques du vendeur
   */
  [
    'GET',
    '/me/stores',
    async c => {
      const user = requireUser(c)

      const { results } = await c.env.DB.prepare(`
        SELECT *
        FROM stores
        WHERE owner_id = ?
      `).bind(user.id).all()

      return json({ stores: results })
    },
  ],

  /**
   * GET : Produits d'une boutique
   */
  [
    'GET',
    '/me/products',
    async c => {
      const storeId = identifier(c.url.searchParams.get('store'))
      await storeAccess(c, storeId)

      const { results } = await c.env.DB.prepare(`
        SELECT
          p.*,
          (
            SELECT pi.url
            FROM product_images pi
            WHERE pi.product_id = p.id
            ORDER BY pi.position ASC
            LIMIT 1
          ) AS image
        FROM products p
        WHERE p.store_id = ?
        ORDER BY p.created_at DESC
      `).bind(storeId).all()

      return json({ products: results })
    },
  ],

  /**
   * GET : Produits publics
   */
  [
    'GET',
    '/products',
    async c => {
      const storeId = c.url.searchParams.get('store')

      let query = `
        SELECT
          p.*,
          (
            SELECT pi.url
            FROM product_images pi
            WHERE pi.product_id = p.id
            ORDER BY pi.position ASC
            LIMIT 1
          ) AS image
        FROM products p
        WHERE p.status = 'published'
      `

      const bindings: string[] = []

      if (storeId) {
        query += ' AND p.store_id = ?'
        bindings.push(identifier(storeId))
      }

      query += ' ORDER BY p.created_at DESC'

      const statement = c.env.DB.prepare(query)

      const { results } = bindings.length
        ? await statement.bind(...bindings).all()
        : await statement.all()

      return json({ products: results })
    },
  ],

  /**
   * POST : Création avec jusqu'à 5 images
   */
  [
    'POST',
    '/products',
    async c => {
      const data = fields(await body(c.req))

      await storeAccess(c, data.store_id)

      const productId = id()

      await c.env.DB.prepare(`
        INSERT INTO products (
          id,
          store_id,
          category_id,
          name,
          description,
          price,
          old_price,
          stock,
          status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        productId,
        data.store_id,
        data.category_id,
        data.name,
        data.description,
        data.price,
        data.old_price,
        data.stock,
        data.status
      ).run()

      for (let position = 0; position < data.images.length; position++) {
        const imageUrl = await saveProductImage(c, data.images[position])

        await c.env.DB.prepare(`
          INSERT INTO product_images (
            id,
            product_id,
            url,
            position
          )
          VALUES (?, ?, ?, ?)
        `).bind(
          id(),
          productId,
          imageUrl,
          position
        ).run()
      }

      return json({
        id: productId,
        store_id: data.store_id,
        status: data.status,
        images_count: data.images.length,
      }, 201)
    },
  ],

  /**
   * DELETE : Suppression d'un produit
   */
  [
    'DELETE',
    '/products/:id',
    async c => {
      const productId = identifier(c.params.id)
      const user = requireUser(c)

      const product = await c.env.DB.prepare(`
        SELECT p.id, p.store_id, s.owner_id
        FROM products p
        JOIN stores s ON s.id = p.store_id
        WHERE p.id = ?
      `).bind(productId).first<any>()

      if (!product) {
        throw new HttpError(404, 'Produit introuvable')
      }

      if (product.owner_id !== user.id && user.role !== 'admin') {
        throw new HttpError(403, 'Accès refusé')
      }

      const images = await c.env.DB.prepare(`
        SELECT url
        FROM product_images
        WHERE product_id = ?
      `).bind(productId).all<any>()

      for (const image of images.results || []) {
        const imageId = String(image.url || '').split('/').pop()

        if (imageId) {
          await c.env.IMAGES.delete(imageId)
        }
      }

      await c.env.DB.prepare(`
        DELETE FROM product_images
        WHERE product_id = ?
      `).bind(productId).run()

      await c.env.DB.prepare(`
        DELETE FROM products
        WHERE id = ?
      `).bind(productId).run()

      return json({ success: true })
    },
  ],
]