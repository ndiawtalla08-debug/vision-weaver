import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { favoriteInput, favoritesSchema, type Favorite } from './favorites-schema'
import { requireD1Session, d1Request, storeD1Token, clearD1Token, userSchema, D1AccessError } from './d1-session.server'

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
export const loginD1 = createServerFn({ method: 'POST' }).inputValidator(input => z.object({ email: z.string().email().max(200), password: z.string().min(8).max(200) }).strict().parse(input)).handler(async ({ data }) => {
  try {
    const result = z.object({ token: z.string().min(20), expires_at: z.string().datetime(), user: userSchema }).parse(await d1Request('/auth/login', undefined, 'POST', data))
    storeD1Token(result.token, result.expires_at)
    return { error: null }
  } catch (error) { return { error: error instanceof D1AccessError && error.status === 401 ? 'Email ou mot de passe incorrect.' : 'Connexion impossible. Veuillez réessayer.' } }
})
export const logoutD1 = createServerFn({ method: 'POST' }).handler(async () => {
  try { const { token } = await requireD1Session(); await d1Request('/auth/logout', token, 'POST'); return { error: null } }
  catch (error) { return { error: error instanceof D1AccessError && error.status === 401 ? null : 'La session locale a été fermée, mais sa révocation D1 n’a pas pu être confirmée.' } }
  finally { clearD1Token() }
})