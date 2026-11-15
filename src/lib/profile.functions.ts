import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireD1Session, d1Request, D1AccessError } from './d1-session.server'
import { profileSchema, profileUpdateSchema, avatarUploadSchema } from './d1-auth-schema'

const message = (e: unknown, fallback: string) => e instanceof D1AccessError ? e.message : fallback

/** Signed URL of the session owner's photo, or null when none was uploaded. */
async function avatarUrl(userId: string) {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const { data } = await supabaseAdmin.storage.from('avatars').createSignedUrl(`${userId}.jpg`, 86400)
  return data?.signedUrl ? `${data.signedUrl}&v=${Date.now()}` : null
}

export const readAvatar = createServerFn({ method: 'GET' }).handler(async () => {
  try { const { user } = await requireD1Session(); return { url: await avatarUrl(user.id) } } catch { return { url: null } }
})

export const updateProfile = createServerFn({ method: 'POST' }).inputValidator(profileUpdateSchema).handler(async ({ data }) => {
  try {
    const { token } = await requireD1Session()
    await d1Request('/me', token, 'PATCH', data)
    // Read back so success is only reported once D1 really holds the new values.
    const { profile } = z.object({ profile: profileSchema }).parse(await d1Request('/me', token))
    const saved = profile && (profile.full_name ?? '') === data.full_name && (profile.phone ?? '') === data.phone && (profile.city ?? '') === data.city
    return saved ? { profile, error: null } : { profile: null, error: 'Les modifications n’ont pas été confirmées. Réessayez.' }
  } catch (e) { return { profile: null, error: message(e, 'Impossible d’enregistrer votre profil.') } }
})

export const uploadAvatar = createServerFn({ method: 'POST' }).inputValidator(avatarUploadSchema).handler(async ({ data }) => {
  try {
    const { user } = await requireD1Session()
    const bytes = Uint8Array.from(atob(data.image.split(',')[1] ?? ''), c => c.charCodeAt(0))
    if (bytes.length > 1_500_000) return { url: null, error: 'Photo trop lourde (1,5 Mo maximum).' }
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    // The path comes from the verified session, never from the browser.
    const { error } = await supabaseAdmin.storage.from('avatars').upload(`${user.id}.jpg`, bytes, { contentType: 'image/jpeg', upsert: true, cacheControl: '60' })
    if (error) return { url: null, error: 'Téléversement impossible, réessayez.' }
    const url = await avatarUrl(user.id)
    return url ? { url, error: null } : { url: null, error: 'Photo enregistrée mais illisible, réessayez.' }
  } catch (e) { return { url: null, error: message(e, 'Téléversement impossible, réessayez.') } }
})
