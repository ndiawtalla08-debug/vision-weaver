import { describe, it, expect } from 'vitest'
import { routes } from '../../cloudflare/api/src/modules'
import { publicContacts } from '../../cloudflare/api/src/announcement-contacts'

function context(userId, data, owner = 'owner') {
  const writes = []
  const db = { prepare(sql) { return { bind(...values) { this.values = values; return this }, async first() { return {id:'ann-1',user_id:owner} }, async run() { writes.push({sql,values:this.values}); return {} } } } }
  const req = new Request('https://example.org/announcements/ann-1/contact', {method:'PATCH', body:JSON.stringify(data)})
  return {ctx:{req,url:new URL(req.url),env:{DB:db},params:{id:'ann-1'},user:userId ? {id:userId,role:'user'} : null},writes}
}
const handler = routes.find(r => r[0] === 'PATCH' && r[1] === '/announcements/:id/contact')?.[2]
describe('D1 announcement public contacts', () => {
  it('rejects anonymous contact changes', async () => {
    const {ctx,writes} = context(null,{contact_phone:'+221771234567'})
    await expect(handler(ctx)).rejects.toMatchObject({status:401})
    expect(writes).toHaveLength(0)
  })
  it('rejects changes by another seller', async () => {
    const {ctx,writes} = context('other',{contact_phone:'+221771234567'})
    await expect(handler(ctx)).rejects.toMatchObject({status:403})
    expect(writes).toHaveLength(0)
  })
  it('stores only the owner’s explicit public contact and preserves omitted email', async () => {
    const {ctx,writes} = context('owner',{contact_phone:'+221771234567'})
    expect((await handler(ctx)).status).toBe(200)
    expect(writes[0].values).toEqual([1,'+221771234567',0,null,'ann-1','owner'])
  })
  it('rejects unsafe emails and invalid phones', () => {
    expect(() => publicContacts({contact_email:'a@b.org?bcc=secret@b.org'})).toThrow()
    expect(() => publicContacts({contact_phone:'-------'})).toThrow()
  })
  it('does not source public contacts from private profiles', () => {
    expect(publicContacts({email:'private@example.org',phone:'+221771234567'})).toEqual({contact_phone:null,contact_email:null})
  })
})