import { z } from 'zod'
import { productSchema, storeSchema } from './d1-schema'

export const d1Identifier = z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/)
export const productInput = z.object({
  store_id: d1Identifier, category_id: d1Identifier.nullable(), name: z.string().trim().min(1).max(120),
  description: z.string().max(5000), price: z.number().int().nonnegative(), old_price: z.number().int().nonnegative().nullable(),
  stock: z.number().int().nonnegative(), status: z.enum(['draft','published']),
  image: z.string().max(750000).refine(v => !v || /^https:\/\/[^\s]+$|^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v), 'Photo invalide.'),
}).strict()
export const sellerProductSchema = productSchema.extend({ status: z.enum(['draft','published','archived']), store_name: z.string().nullable().optional(), created_at: z.string().nullable().optional(), image_key: z.string().nullable().optional() })
export const sellerCounts = (products: SellerProduct[]) => ({ total: products.length, published: products.filter(p => p.status === 'published').length, drafts: products.filter(p => p.status === 'draft').length })
export const sellerStoreSchema = storeSchema.extend({ status: z.enum(['pending','active','suspended']) })
export type SellerProduct = z.infer<typeof sellerProductSchema>
export type SellerStore = z.infer<typeof sellerStoreSchema>
export type ProductInput = z.infer<typeof productInput>