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
export const saveSellerProduct = createServerFn({ method: 'POST' }).inputValidator(input => z.object({ id: d1Identifier.optional(), product: productInput }).strict().parse(input)).handler(async ({ data }) => {
  try {
    const { token } = await requireD1Session(); await ownedStore(token, data.product.store_id)
    if (data.id) {
      const { products } = z.object({ products: z.array(sellerProductSchema) }).parse(await d1Request(`/me/products?store=${encodeURIComponent(data.product.store_id)}`, token))
      if (!products.some(p => p.id === data.id && p.store_id === data.product.store_id)) throw new D1AccessError(403, 'Ce produit n’appartient pas à votre boutique.')
    }
    const result = z.object({ id: d1Identifier, store_id: d1Identifier, status: z.enum(['draft','published']) }).parse(await d1Request(data.id ? `/products/${encodeURIComponent(data.id)}` : '/products', token, data.id ? 'PATCH' : 'POST', data.product))
    if (result.store_id !== data.product.store_id || data.id && result.id !== data.id) throw new Error('Product identity mismatch')
    const readback = z.object({ products: z.array(sellerProductSchema) }).parse(await d1Request(`/me/products?store=${encodeURIComponent(result.store_id)}`, token))
    if (!readback.products.some(p => p.id === result.id && p.store_id === result.store_id && p.status === result.status)) throw new Error('Product not persisted')
    return { id: result.id, error: null }
  } catch (e) { return { id: null, error: message(e) } }
})
export const deleteSellerProduct = createServerFn({ method: 'POST' }).inputValidator(input => z.object({ id: d1Identifier, store_id: d1Identifier }).strict().parse(input)).handler(async ({ data }) => {
  try {
    const { token } = await requireD1Session(); await ownedStore(token, data.store_id)
    const path = `/me/products?store=${encodeURIComponent(data.store_id)}` as const
    const { products } = z.object({ products: z.array(sellerProductSchema) }).parse(await d1Request(path, token))
    if (!products.some(p => p.id === data.id && p.store_id === data.store_id)) throw new D1AccessError(403, 'Ce produit n’appartient pas à votre boutique.')
    await d1Request(`/products/${encodeURIComponent(data.id)}`, token, 'DELETE')
    const readback = z.object({ products: z.array(sellerProductSchema) }).parse(await d1Request(path, token))
    if (readback.products.some(p => p.id === data.id)) throw new Error('Product still exists')
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