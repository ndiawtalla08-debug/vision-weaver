import { describe, it, expect } from 'vitest'
import { routes } from '../../cloudflare/api/src/modules'
import { announcementInput, attributesFor, emptyAnnouncement, groupByStatus } from '@/lib/my-announcements-schema'

const url = k => `https://api.toutsuiteannonces.com/images/${k}`
function setup(method, path, data, user = { id: 'alice', email: 'a@x.org', role: 'user' }, o = {}) {
  const writes = [], statements = []
  const db = {
    prepare(sql) {
      const s = { sql, values: [], bind(...v) { this.values = v; return this },
        async first() {
          if (sql.includes('FROM announcements WHERE id')) return o.missing ? null : { id: 'ann-1', user_id: o.owner ?? 'alice', status: o.status ?? 'published', draft: o.draft ?? 0 }
          if (sql.includes('FROM categories')) return o.category ? { id: o.category } : null
          return null
        },
        async all() { if (sql.trim().startsWith('SELECT url FROM announcement_images')) return { results: (o.previous ?? []).map(u => ({ url: u })) }; return { results: o.rows ?? [] } },
        async run() { writes.push(this); return {} } }
      statements.push(s); return s
    },
    async batch(items) { if (o.fail) throw new Error('D1'); writes.push(...items); return [] },
  }
  const r2 = new Map(Object.entries(o.r2 ?? {}))
  const images = { puts: [], deletes: [], async put(k, v) { this.puts.push(k); r2.set(k, v) }, async delete(k) { this.deletes.push(k); r2.delete(k) }, store: r2 }
  const req = new Request(`https://example.org${path}`, { method, ...(data === undefined ? {} : { body: JSON.stringify(data) }) })
  const c = { req, url: new URL(req.url), params: { id: 'ann-1' }, user, env: { DB: db, IMAGES: images } }
  const pattern = path.replace('/ann-1', '/:id')
  const handler = routes.find(r => r[0] === method && r[1] === pattern)?.[2]
  return { c, writes, statements, images, run: () => handler(c) }
}
const png = 'data:image/png;base64,YQ=='

describe('Mes annonces – API', () => {
  it('creates a draft with photos stored in R2 then D1 in order', async () => {
    const t = setup('POST', '/announcements', { title: 'Corolla 2015', draft: true, price: 4500000, negotiable: true, images: [png, png] })
    const r = await (await t.run()).json()
    expect(r.status).toBe('draft'); expect(t.images.puts).toHaveLength(2)
    const insert = t.writes[0]
    expect(insert.sql).toContain("'pending'"); expect(insert.values).toContain(1) // draft = 1
    expect(t.writes.slice(1).map(w => [w.values[2], w.values[3]])).toEqual(t.images.puts.map((k, i) => [url(k), i]))
  })
  it('submits a non-draft announcement to moderation (pending)', async () => {
    const t = setup('POST', '/announcements', { title: 'Appartement Plateau', draft: false })
    expect((await (await t.run()).json()).status).toBe('pending')
  })
  it('requires a session to create, edit or delete', async () => {
    for (const [m, p] of [['POST', '/announcements'], ['PATCH', '/announcements/ann-1'], ['DELETE', '/announcements/ann-1'], ['GET', '/me/announcements']]) {
      const t = setup(m, p, m === 'GET' || m === 'DELETE' ? undefined : { title: 'x x x' }, null)
      await expect(t.run()).rejects.toMatchObject({ status: 401 })
    }
  })
  it('refuses to edit or delete another user’s announcement', async () => {
    for (const m of ['PATCH', 'DELETE']) {
      const t = setup(m, '/announcements/ann-1', m === 'PATCH' ? { title: 'Pirate' } : undefined, undefined, { owner: 'bob', previous: [url('a')], r2: { a: 1 } })
      await expect(t.run()).rejects.toMatchObject({ status: 403 }); expect(t.writes).toHaveLength(0); expect(t.images.deletes).toHaveLength(0)
    }
  })
  it('sends an edited published announcement back to validation', async () => {
    const t = setup('PATCH', '/announcements/ann-1', { title: 'Nouveau titre' })
    const r = await (await t.run()).json()
    expect(r.status).toBe('pending'); expect(t.writes[0].sql).toContain('status = ?')
  })
  it('keeps, adds and removes photos; removed photos leave R2 after success', async () => {
    const t = setup('PATCH', '/announcements/ann-1', { images: [url('a'), png] }, undefined, { previous: [url('a'), url('b')], r2: { a: 1, b: 1 } })
    await t.run()
    expect(t.writes.filter(w => w.sql.includes('INSERT INTO announcement_images')).map(w => [w.values[2], w.values[3]])).toEqual([[url('a'), 0], [url(t.images.puts[0]), 1]])
    expect(t.images.deletes).toEqual(['b'])
  })
  it('refuses photo URLs that do not belong to the announcement', async () => {
    const t = setup('PATCH', '/announcements/ann-1', { images: [url('autre')] }, undefined, { previous: [url('a')] })
    await expect(t.run()).rejects.toMatchObject({ status: 400 }); expect(t.writes).toHaveLength(0)
  })
  it('rejects more than 5 photos and unknown fields', async () => {
    await expect(setup('POST', '/announcements', { title: 'Vélo', images: Array(6).fill(png) }).run()).rejects.toMatchObject({ status: 400 })
    await expect(setup('POST', '/announcements', { title: 'Vélo', user_id: 'bob' }).run()).rejects.toMatchObject({ status: 400 })
  })
  it('deletes the announcement and its R2 photos', async () => {
    const t = setup('DELETE', '/announcements/ann-1', undefined, undefined, { previous: [url('a'), url('b')], r2: { a: 1, b: 1 } })
    await t.run(); expect(t.images.deletes).toEqual(['a', 'b'])
  })
  it('lists only the signed-in user’s announcements with drafts shown as draft', async () => {
    const t = setup('GET', '/me/announcements', undefined, undefined, { rows: [{ id: 'x', title: 'T', status: 'pending', draft: 1, images_json: '["u1","u2"]', attributes: '{"marque":"Toyota"}', negotiable: 1 }] })
    const r = await (await t.run()).json()
    expect(t.statements[0].values).toEqual(['alice'])
    expect(r.announcements[0]).toMatchObject({ status: 'draft', images: ['u1', 'u2'], attributes: { marque: 'Toyota' }, negotiable: true })
  })
  it('public list hides drafts and unpublished announcements', async () => {
    const t = setup('GET', '/announcements', undefined, null)
    await t.run(); expect(t.statements[0].sql).toContain("a.status = 'published' AND a.draft = 0")
  })
  it('counts views only for published, non-draft announcements', async () => {
    const t = setup('POST', '/announcements/ann-1/views', {}, null)
    t.c.params = { id: 'ann-1' }
    const handler = routes.find(r => r[0] === 'POST' && r[1] === '/announcements/:id/views')[2]
    await handler(t.c); expect(t.writes[0].sql).toContain("views = views + 1 WHERE id = ? AND status = 'published' AND draft = 0")
  })
  it('registers each announcement route once', () => {
    const keys = routes.map(r => `${r[0]} ${r[1]}`); expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('Mes annonces – formulaire', () => {
  it('requires a title of at least 3 characters and at most 5 photos', () => {
    expect(announcementInput.safeParse({ ...emptyAnnouncement(), title: 'ab' }).success).toBe(false)
    expect(announcementInput.safeParse({ ...emptyAnnouncement(), title: 'Vélo', images: Array(6).fill(png) }).success).toBe(false)
    expect(announcementInput.safeParse({ ...emptyAnnouncement(), title: 'Vélo' }).success).toBe(true)
  })
  it('keeps only attributes defined for the chosen category', () => {
    expect(attributesFor('vehicules', { marque: 'Toyota', taille: 'M', annee: '' })).toEqual({ marque: 'Toyota' })
  })
  it('groups announcements into published, drafts, pending and rejected tabs', () => {
    const g = groupByStatus([{ status: 'published' }, { status: 'draft' }, { status: 'pending' }, { status: 'rejected' }, { status: 'archived' }])
    expect([g.published.length, g.draft.length, g.pending.length, g.rejected.length]).toEqual([1, 1, 1, 1])
  })
})
