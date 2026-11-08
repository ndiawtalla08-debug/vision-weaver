import { describe, it, expect } from 'vitest'
import { routes } from '../../cloudflare/api/src/modules'
import { signupSchema } from '@/lib/d1-auth-schema'

describe('D1 registration', () => {
  it('rejects passwords shorter than eight characters', () => {
    expect(signupSchema.safeParse({ email:'test@example.org', password:'1234567', full_name:'Test' }).success).toBe(false)
  })
  it('writes users, profile and a hashed session then returns a token', async () => {
    const statements = []
    const db = { prepare(sql) { const statement = { sql, values:[], bind(...values) { this.values=values; return this }, async first() { return null } }; return statement }, async batch(items) { statements.push(...items); return [] } }
    const route = routes.find(r => r[0] === 'POST' && r[1] === '/auth/register')
    if (!route) throw new Error('Registration handler missing')
    const req = new Request('https://example.org/auth/register', { method:'POST', body:JSON.stringify({ email:'test@example.org', password:'abcdefgh', full_name:'Profil Test', city:'Dakar' }) })
    const response = await route[2]({req,env:{DB:db},url:new URL(req.url),params:{},user:null})
    const result = await response.json()
    expect(response.status).toBe(201)
    expect(result.token.length).toBeGreaterThan(20)
    expect(statements.map(s => s.sql)).toEqual(expect.arrayContaining([expect.stringContaining('INSERT INTO users'),expect.stringContaining('INSERT INTO user_profiles'),expect.stringContaining('INSERT INTO sessions')]))
    const session = statements.find(s => s.sql.includes('INSERT INTO sessions'))
    expect(session.values[0]).not.toBe(result.token)
    const profile = statements.find(s => s.sql.includes('INSERT INTO user_profiles'))
    expect(profile.values).toEqual([result.user.id,'Profil Test',null,'Dakar'])
  })
})