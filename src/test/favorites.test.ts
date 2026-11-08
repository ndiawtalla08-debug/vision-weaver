import { describe, it, expect, vi } from 'vitest'
import { routes } from '../../cloudflare/api/src/modules'
import type { Ctx } from '../../cloudflare/api/src/lib'
import { favoriteInput } from '@/lib/favorites-schema'

function context(method: string, payload: unknown, user: Ctx['user']) {
  const bindings: unknown[][] = []
  const sql: string[] = []
  const statement = { bind: (...values: unknown[]) => { bindings.push(values); return statement }, all: async () => ({ results: [] }), run: async () => ({ success: true }) }
  const prepare = vi.fn((query: string) => { sql.push(query); return statement })
  const req = new Request('https://example.org/favorites', { method, ...(method === 'GET' ? {} : { body: JSON.stringify(payload) }) })
  return { c: { req, user, params: {}, url: new URL(req.url), env: { DB: { prepare }, ALLOWED_ORIGINS: '' } } as unknown as Ctx, bindings, sql, prepare }
}
function handler(method: string) { const route = routes.find(r => r[0] === method && r[1] === '/favorites'); if (!route) throw new Error('Missing favorites handler'); return route[2] }
describe('D1 favorite ownership', () => {
  for (const method of ['GET', 'POST', 'DELETE']) {
    it(`rejects unauthenticated ${method} before querying D1`, async () => {
      const { c, prepare } = context(method, { product_id: 'product' }, null)
      await expect(handler(method)(c)).rejects.toMatchObject({ status: 401 })
      expect(prepare).not.toHaveBeenCalled()
    })
  }
  it('reads only the authenticated user, ignoring a supplied owner', async () => {
    const { c, bindings, sql } = context('GET', null, {id:'alice',email:'alice@example.org',role:'user'})
    c.url.searchParams.set('user_id','bob')
    await handler('GET')(c)
    expect(bindings).toEqual([['alice']]); expect(sql[0]).toContain('WHERE user_id = ?')
  })
  it('writes favorites for the verified user, not the supplied owner', async () => {
    const { c, bindings } = context('POST', {product_id:'product',user_id:'bob'}, {id:'alice',email:'alice@example.org',role:'user'})
    await handler('POST')(c)
    expect(bindings).toEqual([['alice','product',null]])
  })
  it('cannot delete another user’s favorites', async () => {
    const { c, bindings, sql } = context('DELETE', {product_id:'product',user_id:'bob'}, {id:'alice',email:'alice@example.org',role:'user'})
    await handler('DELETE')(c)
    expect(bindings).toEqual([['alice','product',null]]); expect(sql[0]).toContain('WHERE user_id = ? AND')
  })
  it('rejects owner injection at the app boundary', () => {
    expect(favoriteInput.safeParse({id:'product',kind:'product',selected:true,user_id:'bob'}).success).toBe(false)
  })
})