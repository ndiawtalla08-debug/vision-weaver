import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { favoriteInput, favoritesSchema, type Favorite } from './favorites-schema'
import { requireD1Session, d1Request, storeD1Token, clearD1Token, userSchema, D1AccessError } from './d1-session.server'
import { credentialsSchema, signupSchema, sessionSchema } from './d1-auth-schema'

type Result = { user: { id: string; email: string } | null; favorites: Favorite[]; error: string | null; signedOut: boolean }
function failure(error: unknown): Result {
  const signedOut = error instanceof D1AccessError && (error.status === 401 || error.status === 403)
  if (signedOut) clearD1Token()
  return { user: null, favorites: [], error: error instanceof D1AccessError ? error.message : 'Impossible de récupérer vos favoris. Veuillez réessayer.', signedOut }
}
export const readFavorites = createServerFn({ method: 'GET' }).handler(async (): Promise<Result> => {
  try {
    const { user, token } = await requireD1Session()
    const { favorites } = favoritesSchema.parse(await d1Request('/favorites', token))
    return { user, favorites, error: null, signedOut: false }
  } catch (error) { return failure(error) }
})
export const changeFavorite = createServerFn({ method: 'POST' }).inputValidator(input => favoriteInput.parse(input)).handler(async ({ data }): Promise<Result> => {
  try {
    const { user, token } = await requireD1Session()
    const target = data.kind === 'product' ? { product_id: data.id } : { announcement_id: data.id }
    await d1Request('/favorites', token, data.selected ? 'POST' : 'DELETE', target)
    const { favorites } = favoritesSchema.parse(await d1Request('/favorites', token))
    return { user, favorites, error: null, signedOut: false }
  } catch (error) { return failure(error) }
})
export const loginD1 = createServerFn({ method: 'POST' }).inputValidator(input => credentialsSchema.parse(input)).handler(async ({ data }) => {
  try {
    const result = sessionSchema.parse(await d1Request('/auth/login', undefined, 'POST', data))
    storeD1Token(result.token, result.expires_at)
    return { error: null }
  } catch (error) { return { error: error instanceof D1AccessError && error.status === 401 ? 'Email ou mot de passe incorrect.' : 'Connexion impossible. Veuillez réessayer.' } }
})
export const registerD1 = createServerFn({ method: 'POST' }).inputValidator(input => signupSchema.parse(input)).handler(async ({ data }) => {
  let created = false
  try {
    const response = await d1Request('/auth/register', undefined, 'POST', data)
    created = true
    // Compatible with the currently deployed Worker, which creates the account
    // without a token. Exchange the same credentials through its login endpoint.
    const parsed = sessionSchema.safeParse(response)
    const session = parsed.success ? parsed.data : sessionSchema.parse(await d1Request('/auth/login', undefined, 'POST', { email: data.email, password: data.password }))
    storeD1Token(session.token, session.expires_at)
    if (data.phone || data.city) await d1Request('/me', session.token, 'PATCH', { full_name: data.full_name, phone: data.phone || null, city: data.city || null })
    const profile = z.object({ user: userSchema }).parse(await d1Request('/me', session.token))
    if (profile.user.id !== session.user.id) throw new Error('Session identity mismatch')
    return { error: null, created: true }
  } catch (error) {
    return { created, error: created ? 'Votre compte a été créé, mais la connexion ou le profil n’a pas pu être confirmé. Connectez-vous pour vérifier.' : error instanceof D1AccessError ? error.message : 'Inscription impossible. Veuillez réessayer.' }
  }
})
export const readD1Profile = createServerFn({ method: 'GET' }).handler(async () => {
  try { const { user, profile } = await requireD1Session(); return { user, profile, error: null } }
  catch (error) { return { user: null, profile: null, error: error instanceof D1AccessError ? error.message : 'Impossible de récupérer votre profil.' } }
})
export const logoutD1 = createServerFn({ method: 'POST' }).handler(async () => {
  try { const { token } = await requireD1Session(); await d1Request('/auth/logout', token, 'POST'); return { error: null } }
  catch (error) { return { error: error instanceof D1AccessError && error.status === 401 ? null : 'La session locale a été fermée, mais sa révocation D1 n’a pas pu être confirmée.' } }
  finally { clearD1Token() }
})