import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { d1Request, D1AccessError, requireD1Session } from './d1-session.server'
import { announcementInput, attributesFor, myAnnouncement, type MyAnnouncement } from './my-announcements-schema'

const id = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/)
const message = (e: unknown) => (e instanceof D1AccessError ? e.message : 'Impossible de gérer vos annonces. Veuillez réessayer.')

async function mine(token: string) {
  return z.object({ announcements: z.array(myAnnouncement) }).parse(await d1Request('/me/announcements', token)).announcements
}

export const readMyAnnouncements = createServerFn({ method: 'GET' }).handler(
  async (): Promise<{ announcements: MyAnnouncement[]; error: string | null }> => {
    try {
      const { token } = await requireD1Session()
      return { announcements: await mine(token), error: null }
    } catch (e) {
      return { announcements: [], error: message(e) }
    }
  },
)

export const saveMyAnnouncement = createServerFn({ method: 'POST' })
  .inputValidator(input => z.object({ id: id.optional(), announcement: announcementInput }).strict().parse(input))
  .handler(async ({ data }) => {
    try {
      const { token } = await requireD1Session()
      const a = data.announcement
      if (data.id && !(await mine(token)).some(x => x.id === data.id)) {
        throw new D1AccessError(403, 'Cette annonce ne vous appartient pas.')
      }
      const payload = {
        ...a,
        description: a.description,
        subcategory: a.subcategory,
        attributes: attributesFor(a.category_id, a.attributes),
      }
      const raw = await d1Request(data.id ? `/announcements/${encodeURIComponent(data.id)}` : '/announcements', token, data.id ? 'PATCH' : 'POST', payload)
      const result = z.object({ id: id, status: z.string() }).parse(raw)
      // Relecture : ne jamais annoncer un succès qui n'est pas enregistré.
      const saved = (await mine(token)).find(x => x.id === result.id)
      if (!saved || saved.title !== a.title || (saved.images?.length ?? 0) !== a.images.length) throw new Error('Announcement not persisted')
      return { id: result.id, status: saved.status, error: null }
    } catch (e) {
      return { id: null, status: null, error: message(e) }
    }
  })

export const deleteMyAnnouncement = createServerFn({ method: 'POST' })
  .inputValidator(input => z.object({ id }).strict().parse(input))
  .handler(async ({ data }) => {
    try {
      const { token } = await requireD1Session()
      if (!(await mine(token)).some(x => x.id === data.id)) throw new D1AccessError(403, 'Cette annonce ne vous appartient pas.')
      await d1Request(`/announcements/${encodeURIComponent(data.id)}`, token, 'DELETE')
      if ((await mine(token)).some(x => x.id === data.id)) throw new Error('Announcement still exists')
      return { error: null }
    } catch (e) {
      return { error: message(e) }
    }
  })

/** Compte une vue d'annonce publiée (sans session, échec silencieux). */
export const recordAnnouncementView = createServerFn({ method: 'POST' })
  .inputValidator(input => z.object({ id }).strict().parse(input))
  .handler(async ({ data }) => {
    try {
      await d1Request(`/announcements/${encodeURIComponent(data.id)}/views`, undefined, 'POST', {})
    } catch {
      /* compteur indisponible : sans effet pour le visiteur */
    }
    return { ok: true }
  })
