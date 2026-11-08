import { z } from 'zod'

// Never accept a user ID: D1 derives the owner exclusively from its verified session.
export const favoriteInput = z.object({ id: z.string().trim().min(1).max(64), kind: z.enum(['product', 'announcement']), selected: z.boolean() }).strict()
export const favoritesSchema = z.object({ favorites: z.array(z.object({ product_id: z.string().nullable(), announcement_id: z.string().nullable(), created_at: z.string().optional() })) })
export type Favorite = z.infer<typeof favoritesSchema>['favorites'][number]