import { z } from 'zod'

export const credentialsSchema = z.object({ email: z.string().trim().email().max(200).transform(v => v.toLowerCase()), password: z.string().min(8).max(200) }).strict()
export const signupSchema = credentialsSchema.extend({ full_name: z.string().trim().min(1).max(120), phone: z.string().trim().max(30).optional(), city: z.string().trim().max(80).optional() })
export const profileSchema = z.object({ full_name: z.string().nullable().optional(), phone: z.string().nullable().optional(), city: z.string().nullable().optional(), avatar_url: z.string().nullable().optional() }).nullable()
export const sessionSchema = z.object({ token: z.string().min(20), expires_at: z.string().datetime(), user: z.object({ id: z.string(), email: z.string() }) })