import { z } from 'zod'

export const messageInput = z.object({
  announcement_id: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(200),
  message: z.string().trim().min(10).max(2000),
  website: z.string().max(0).default(''),
}).strict()
export const receivedMessage = z.object({id:z.string(),announcement_id:z.string(),title:z.string(),name:z.string(),email:z.string(),message:z.string(),created_at:z.string()})