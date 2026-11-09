import { z } from 'zod'
import { productImageUrl } from './api-client'

export const d1BaseUrl = 'https://toutsuite-api.ndiawtalla08.workers.dev'
const nullableText = z.string().nullable().optional()
export const storeSchema = z.object({ id: z.string(), name: z.string(), slug: z.string(), description: nullableText, logo_url: nullableText })
export const productSchema = z.object({ id: z.string(), store_id: z.string(), category_id: nullableText, name: z.string(), description: nullableText, price: z.number().nonnegative(), old_price: z.number().nullable().optional(), stock: z.number().nonnegative(), image: nullableText })
export const categorySchema = z.object({ id: z.string(), name: z.string(), slug: z.string() })
export const announcementSchema = z.object({ id: z.string(), title: z.string(), description: nullableText, price: z.number().nullable().optional(), city: nullableText, category_id: nullableText, created_at: nullableText, image: nullableText, images: z.array(z.string()).optional() }).transform(a => ({ ...a, image: productImageUrl(a.image), images: (a.images ?? []).map(image => productImageUrl(image)) }))
export const catalogSchema = z.object({ stores: z.array(storeSchema), products: z.array(productSchema), categories: z.array(categorySchema), announcements: z.array(announcementSchema) })
export type D1Catalog = z.infer<typeof catalogSchema>