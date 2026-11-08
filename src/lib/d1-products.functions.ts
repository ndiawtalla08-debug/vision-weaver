import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { d1Request, D1AccessError, requireD1Session } from './d1-session.server'
import { d1Identifier, productInput, sellerProductSchema, sellerStoreSchema, type SellerProduct, type SellerStore } from './d1-products-schema'
import { d1BaseUrl, productSchema } from './d1-schema'

const message = (e: unknown) => e instanceof D1AccessError ? e.message : 'Impossible de gérer vos produits. Veuillez réessayer.'
async function ownedStore(token: string, storeId: string) {
  const { stores } = z.object({ stores: z.array(sellerStoreSchema) }).parse(await d1Request('/me/stores', token))
  const store = stores.find(s => s.id === storeId)
  if (!store || store.status === 'suspended') throw new D1AccessError(403, 'Vous ne gérez pas cette boutique ou elle est suspendue.')
  return store
}
export const readSellerStores = createServerFn({ method: 'GET' }).handler(async (): Promise<{ stores: SellerStore[]; error: string | null }> => {
  try { const { token } = await requireD1Session(); return { ...z.object({ stores: z.array(sellerStoreSchema) }).parse(await d1Request('/me/stores', token)), error: null } }
  catch (e) { return { stores: [], error: message(e) } }
})
export const readSellerProducts = createServerFn({ method: 'GET' }).inputValidator(input => z.object({ store_id: d1Identifier }).strict().parse(input)).handler(async ({ data }): Promise<{ products: SellerProduct[]; error: string | null }> => {
  try {
    const { token } = await requireD1Session(); await ownedStore(token, data.store_id)
    const { products } = z.object({ products: z.array(sellerProductSchema) }).parse(await d1Request(`/me/products?store=${encodeURIComponent(data.store_id)}`, token))
    if (products.some(p => p.store_id !== data.store_id)) throw new Error('Store identity mismatch')
    return { products, error: null }
  } catch (e) { return { products: [], error: message(e) } }
})
async function myProducts(token: string) {
  return z.object({ products: z.array(sellerProductSchema) }).parse(await d1Request('/my/products', token)).products
}
export const readMyProducts = createServerFn({ method: 'GET' }).handler(async (): Promise<{ products: SellerProduct[]; error: string | null }> => {
  try { const { token } = await requireD1Session(); return { products: await myProducts(token), error: null } }
  catch (e) { return { products: [], error: message(e) } }
})
export const saveSellerProduct = createServerFn({ method: 'POST' }).inputValidator(input => z.object({ id: d1Identifier.optional(), product: productInput }).strict().parse(input)).handler(async ({ data }) => {
  try {
    const { token } = await requireD1Session()
    if (data.id) {
      const products = await myProducts(token)
      if (!products.some(p => p.id === data.id && p.store_id === data.product.store_id)) throw new D1AccessError(403, 'Ce produit n’appartient pas à votre boutique.')
    } else await ownedStore(token, data.product.store_id)
    // Existing R2 images are preserved by omitting image on editing; image upload remains on creation.
    const { image: _image, ...changes } = data.product
    const raw = await d1Request(data.id ? `/products/${encodeURIComponent(data.id)}` : '/products', token, data.id ? 'PATCH' : 'POST', data.id ? changes : data.product)
    const result = z.object({ id: d1Identifier.optional(), store_id: d1Identifier.optional(), status: z.enum(['draft','published']).optional() }).parse(raw)
    const resultId = result.id ?? data.id
    if (!resultId) throw new Error('Missing product identity')
    if (result.store_id && result.store_id !== data.product.store_id || data.id && resultId !== data.id) throw new Error('Product identity mismatch')
    const readback = await myProducts(token)
    const persisted = readback.find(p => p.id === resultId && p.store_id === data.product.store_id)
    if (!persisted || persisted.status !== data.product.status || persisted.name !== data.product.name || (persisted.description ?? '') !== data.product.description || persisted.price !== data.product.price || persisted.stock !== data.product.stock || (persisted.old_price ?? null) !== data.product.old_price || (persisted.category_id ?? null) !== data.product.category_id) throw new Error('Product not persisted')
    return { id: resultId, error: null }
  } catch (e) { return { id: null, error: message(e) } }
})
export const deleteSellerProduct = createServerFn({ method: 'POST' }).inputValidator(input => z.object({ id: d1Identifier, store_id: d1Identifier }).strict().parse(input)).handler(async ({ data }) => {
  try {
    const { token } = await requireD1Session()
    const products = await myProducts(token)
    if (!products.some(p => p.id === data.id && p.store_id === data.store_id)) throw new D1AccessError(403, 'Ce produit n’appartient pas à votre boutique.')
    await d1Request(`/products/${encodeURIComponent(data.id)}`, token, 'DELETE')
    const readback = await myProducts(token)
    if (readback.some(p => p.id === data.id)) throw new Error('Product still exists')
    return { error: null }
  } catch (e) { return { error: message(e) } }
})
export const readStoreProducts = createServerFn({ method: 'GET' }).inputValidator(input => z.object({ store_id: d1Identifier }).strict().parse(input)).handler(async ({ data }) => {
  try {
    const response = await fetch(`${d1BaseUrl}/products?store=${encodeURIComponent(data.store_id)}`, { signal: AbortSignal.timeout(15000) })
    if (!response.ok) throw new Error('Store products unavailable')
    const { products } = z.object({ products: z.array(productSchema.extend({ status: z.literal('published').optional() })) }).parse(await response.json())
    if (products.some(p => p.store_id !== data.store_id)) throw new Error('Store identity mismatch')
    return { products, error: null }
  } catch { return { products: [], error: 'Impossible de charger les produits de cette boutique.' } }
})