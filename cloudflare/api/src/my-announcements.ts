import type { Ctx } from './lib'
import { HttpError, body, id, json, requireUser, str } from './lib'
import { publicContacts } from './announcement-contacts'
import { imageKey, saveProductImage } from './products'

type Handler = (c: Ctx) => Promise<Response>
type Route = [string, string, Handler]

const MAX_IMAGES = 5
const IMAGE_VALUE = /^https:\/\/[^\s]+$|^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/
const FIELDS = ['title', 'description', 'category_id', 'subcategory', 'price', 'negotiable', 'location', 'city', 'attributes', 'images', 'image', 'draft', 'contact_phone', 'contact_email']

const identifier = (value: unknown) => {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(value)) throw new HttpError(400, 'Identifiant invalide.')
  return value
}

/** Statut affiché : brouillon privé, sinon statut de modération. */
export const effectiveStatus = (row: { draft?: number | null; status: string }) => (row.draft ? 'draft' : row.status)

export function parseAttributes(raw: unknown): Record<string, string | number | boolean> | null {
  if (raw == null || raw === '') return null
  let value = raw
  if (typeof raw === 'string') { try { value = JSON.parse(raw) } catch { return null } }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, string | number | boolean>
}

function validAttributes(raw: unknown) {
  if (raw == null) return null
  if (typeof raw !== 'object' || Array.isArray(raw)) throw new HttpError(400, 'Caractéristiques invalides.')
  const entries = Object.entries(raw as Record<string, unknown>).filter(([, v]) => v !== '' && v != null)
  if (entries.length > 15) throw new HttpError(400, '15 caractéristiques maximum.')
  for (const [k, v] of entries) {
    if (!/^[a-z_]{1,40}$/.test(k)) throw new HttpError(400, 'Caractéristique invalide.')
    if (!(typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v)) || (typeof v === 'string' && v.length <= 120))) {
      throw new HttpError(400, `Valeur invalide : ${k}.`)
    }
  }
  return entries.length ? JSON.stringify(Object.fromEntries(entries)) : null
}

function readImages(b: Record<string, unknown>) {
  let images: unknown[] = []
  if (Array.isArray(b['images'])) images = b['images']
  else if (typeof b['image'] === 'string' && b['image']) images = [b['image']]
  if (images.length > MAX_IMAGES) throw new HttpError(400, '5 photos maximum.')
  for (const image of images) if (typeof image !== 'string' || !IMAGE_VALUE.test(image)) throw new HttpError(400, 'Photo invalide.')
  return images as string[]
}

/** Valide les champs présents ; renvoie les colonnes SQL à écrire. */
async function columnsFrom(c: Ctx, b: Record<string, unknown>, creating: boolean) {
  if (Object.keys(b).some(k => !FIELDS.includes(k))) throw new HttpError(400, 'Champ non autorisé.')
  const cols: Record<string, string | number | null> = {}
  if (creating || 'title' in b) {
    const title = str(b['title'], 'titre', 120)
    if (!title || !title.trim()) throw new HttpError(400, 'Titre requis.')
    cols['title'] = title.trim()
  }
  if ('description' in b) cols['description'] = str(b['description'], 'description', 5000, false) || null
  if ('category_id' in b) {
    const category = b['category_id'] == null || b['category_id'] === '' ? null : identifier(b['category_id'])
    if (category && !await c.env.DB.prepare('SELECT id FROM categories WHERE id = ?').bind(category).first()) {
      throw new HttpError(400, 'Catégorie introuvable.')
    }
    cols['category_id'] = category
  }
  if ('subcategory' in b) cols['subcategory'] = str(b['subcategory'], 'sous-catégorie', 80, false) || null
  if ('price' in b) {
    const price = b['price']
    if (price !== null && (typeof price !== 'number' || !Number.isSafeInteger(price) || price < 0)) throw new HttpError(400, 'Prix invalide.')
    cols['price'] = price as number | null
  }
  if ('negotiable' in b) cols['negotiable'] = b['negotiable'] === true ? 1 : 0
  if ('location' in b) cols['location'] = str(b['location'], 'localisation', 120, false) || null
  if ('city' in b) cols['city'] = str(b['city'], 'ville', 80, false) || null
  if ('attributes' in b) cols['attributes'] = validAttributes(b['attributes'])
  if ('contact_phone' in b || 'contact_email' in b) {
    const contacts = publicContacts(b)
    if ('contact_phone' in b) cols['contact_phone'] = contacts.contact_phone
    if ('contact_email' in b) cols['contact_email'] = contacts.contact_email
  }
  if ('draft' in b) cols['draft'] = b['draft'] === true ? 1 : 0
  return cols
}

async function uploadAll(c: Ctx, images: string[], keep: string[]) {
  const urls: string[] = []
  const uploaded: string[] = []
  if (images.some(i => !i.startsWith('data:') && !keep.includes(i))) {
    throw new HttpError(400, 'Photo existante inconnue pour cette annonce.')
  }
  try {
    for (const image of images) {
      if (image.startsWith('data:')) { const url = await saveProductImage(c, image); uploaded.push(url); urls.push(url) }
      else urls.push(image)
    }
  } catch (e) { await removeFromR2(c, uploaded); throw e }
  return { urls, uploaded }
}

async function removeFromR2(c: Ctx, urls: string[]) {
  for (const url of urls) { const key = imageKey(url); if (key) await c.env.IMAGES.delete(key).catch(() => undefined) }
}

async function ownAnnouncement(c: Ctx) {
  const u = requireUser(c)
  const aid = identifier(c.params['id'])
  const a = await c.env.DB.prepare('SELECT id, user_id, status, draft FROM announcements WHERE id = ?')
    .bind(aid).first<{ id: string; user_id: string; status: string; draft: number }>()
  if (!a) throw new HttpError(404, 'Annonce introuvable.')
  if (a.user_id !== u.id) throw new HttpError(403, 'Cette annonce ne vous appartient pas.')
  return a
}

const imageColumns = `
  (SELECT url FROM announcement_images i WHERE i.announcement_id = a.id ORDER BY position LIMIT 1) AS image,
  (SELECT json_group_array(url) FROM (SELECT url FROM announcement_images i WHERE i.announcement_id = a.id ORDER BY position)) AS images_json`

/** Normalise une ligne D1 pour l'API (images[], attributs, négociable). */
export function shapeAnnouncement({ images_json, attributes, negotiable, ...row }: any) {
  let images: string[] = []
  try { images = JSON.parse(images_json || '[]').filter((u: unknown) => typeof u === 'string') } catch { images = [] }
  return { ...row, images, attributes: parseAttributes(attributes), negotiable: !!negotiable }
}

export const publicAnnouncementsSql = `SELECT a.id, a.title, a.description, a.price, a.negotiable, a.city, a.location, a.category_id, a.subcategory, a.attributes,
    a.created_at, a.contact_phone, a.contact_email, ${imageColumns}
  FROM announcements a WHERE a.status = 'published' AND a.draft = 0 ORDER BY a.created_at DESC LIMIT 100`

export const myAnnouncementRoutes: Route[] = [
  /** Annonces de l'utilisateur connecté (tous statuts, brouillons inclus) */
  ['GET', '/me/announcements', async c => {
    const u = requireUser(c)
    const { results } = await c.env.DB.prepare(`SELECT a.id, a.title, a.description, a.price, a.negotiable, a.city, a.location, a.category_id, a.subcategory,
        a.attributes, a.status, a.draft, a.views, a.contact_phone, a.contact_email, a.created_at, a.updated_at, ${imageColumns}
      FROM announcements a WHERE a.user_id = ? ORDER BY a.updated_at DESC LIMIT 200`).bind(u.id).all()
    return json({ announcements: results.map((r: any) => ({ ...shapeAnnouncement(r), status: effectiveStatus(r), draft: undefined })) })
  }],

  /** Création (brouillon ou soumission à la validation), jusqu'à 5 photos */
  ['POST', '/announcements', async c => {
    const u = requireUser(c)
    const b = await body(c.req)
    const cols = await columnsFrom(c, b, true)
    const images = readImages(b)
    const { urls, uploaded } = await uploadAll(c, images, [])
    const aid = id()
    const names = Object.keys(cols)
    const statements = [
      c.env.DB.prepare(`INSERT INTO announcements (id, user_id, status${names.map(n => ', ' + n).join('')}) VALUES (?, ?, 'pending'${names.map(() => ', ?').join('')})`)
        .bind(aid, u.id, ...names.map(n => cols[n] ?? null)),
      ...urls.map((url, position) => c.env.DB.prepare('INSERT INTO announcement_images (id, announcement_id, url, position) VALUES (?,?,?,?)').bind(id(), aid, url, position)),
    ]
    try { await c.env.DB.batch(statements) } catch (e) { await removeFromR2(c, uploaded); throw e }
    return json({ id: aid, status: cols['draft'] ? 'draft' : 'pending', images_count: urls.length }, 201)
  }],

  /** Modification par le propriétaire ; un changement de contenu repasse en validation */
  ['PATCH', '/announcements/:id', async c => {
    const a = await ownAnnouncement(c)
    const b = await body(c.req)
    if (!b || typeof b !== 'object' || Array.isArray(b) || !Object.keys(b).length) throw new HttpError(400, 'Aucune modification fournie.')
    const cols = await columnsFrom(c, b, false)
    const draft = 'draft' in cols ? cols['draft'] : a.draft
    // Toute modification d'une annonce non brouillon repasse en validation (sauf archivée).
    if (!draft && a.status !== 'archived') cols['status'] = 'pending'
    const statements = []
    const names = Object.keys(cols)
    statements.push(c.env.DB.prepare(`UPDATE announcements SET ${names.map(n => `${n} = ?`).join(', ')}${names.length ? ', ' : ''}updated_at = datetime('now') WHERE id = ? AND user_id = ?`)
      .bind(...names.map(n => cols[n] ?? null), a.id, a.user_id))
    let removed: string[] = []
    let uploaded: string[] = []
    if ('images' in b || 'image' in b) {
      const previous = (await c.env.DB.prepare('SELECT url FROM announcement_images WHERE announcement_id = ?').bind(a.id).all<{ url: string }>()).results?.map(r => r.url) ?? []
      const result = await uploadAll(c, readImages(b), previous)
      uploaded = result.uploaded
      removed = previous.filter(url => !result.urls.includes(url))
      statements.push(c.env.DB.prepare('DELETE FROM announcement_images WHERE announcement_id = ?').bind(a.id))
      result.urls.forEach((url, position) => statements.push(
        c.env.DB.prepare('INSERT INTO announcement_images (id, announcement_id, url, position) VALUES (?,?,?,?)').bind(id(), a.id, url, position)))
    }
    try { await c.env.DB.batch(statements) } catch (e) { await removeFromR2(c, uploaded); throw e }
    await removeFromR2(c, removed)
    return json({ id: a.id, status: effectiveStatus({ draft: draft as number, status: (cols['status'] as string) ?? a.status }) })
  }],

  /** Suppression par le propriétaire, photos D1 puis R2 */
  ['DELETE', '/announcements/:id', async c => {
    const a = await ownAnnouncement(c)
    const { results } = await c.env.DB.prepare('SELECT url FROM announcement_images WHERE announcement_id = ?').bind(a.id).all<{ url: string }>()
    await c.env.DB.batch([
      c.env.DB.prepare('DELETE FROM announcements WHERE id = ? AND user_id = ?').bind(a.id, a.user_id),
      c.env.DB.prepare('DELETE FROM announcement_images WHERE announcement_id = ?').bind(a.id),
    ])
    await removeFromR2(c, (results ?? []).map(r => r.url))
    return json({ ok: true })
  }],

  /** Compteur de vues (annonces publiées uniquement) */
  ['POST', '/announcements/:id/views', async c => {
    const aid = identifier(c.params['id'])
    await c.env.DB.prepare(`UPDATE announcements SET views = views + 1 WHERE id = ? AND status = 'published' AND draft = 0`).bind(aid).run()
    return json({ ok: true })
  }],
]
