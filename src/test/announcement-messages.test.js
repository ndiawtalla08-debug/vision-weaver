import { describe, expect, it } from 'vitest'
import { messageInput } from '@/lib/announcement-messages-schema'
import { sendAnnouncementMessage, readAnnouncementMessages } from '../../cloudflare/api/src/announcement-messages'

const valid = {name:'Visiteur Test',email:'visitor@example.org',message:'Bonjour, cette annonce est-elle disponible ?',website:''}
function fixture(user = null, changes = 1, published = true) {
  const writes=[]
  const reads=[]
  const db = {prepare(sql) {let values=[];return {bind(...v) {values=v;return this},async first() {return published ? {id:'ann-1',user_id:'seller'} : null},async run() {writes.push(values);return {meta:{changes}}},async all() {reads.push(values);return {results:[]}}}}}
  const req=new Request('https://example.org/announcements/ann-1/messages',{method:'POST',body:JSON.stringify(valid)})
  return {ctx:{req,url:new URL(req.url),params:{id:'ann-1'},env:{DB:db,ALLOWED_ORIGINS:''},user},writes,reads}
}
describe('announcement messages', () => {
  it('rejects owner injection and honeypot entries', () => {
    expect(messageInput.safeParse({...valid,announcement_id:'ann-1',seller_id:'other'}).success).toBe(false)
    expect(messageInput.safeParse({...valid,announcement_id:'ann-1',website:'spam'}).success).toBe(false)
  })
  it('rejects messages shorter than 10 or longer than 2000 characters', () => {
    expect(messageInput.safeParse({...valid,announcement_id:'ann-1',message:'court'}).success).toBe(false)
    expect(messageInput.safeParse({...valid,announcement_id:'ann-1',message:'a'.repeat(2001)}).success).toBe(false)
  })
  it('derives the recipient from the published announcement', async () => {
    const f=fixture()
    const result=await sendAnnouncementMessage(f.ctx)
    expect(result.status).toBe(201)
    expect(f.writes[0]?.slice(1,6)).toEqual(['ann-1','seller',valid.name,valid.email,valid.message])
  })
  it('rejects unpublished announcements without writing', async () => {
    const f=fixture(null,1,false)
    await expect(sendAnnouncementMessage(f.ctx)).rejects.toMatchObject({status:404})
    expect(f.writes).toHaveLength(0)
  })
  it('rejects an exhausted atomic rate limit without success', async () => {
    const f=fixture(null,0)
    await expect(sendAnnouncementMessage(f.ctx)).rejects.toMatchObject({status:429})
  })
  it('denies anonymous inbox access', async () => {
    const f=fixture()
    await expect(readAnnouncementMessages(f.ctx)).rejects.toMatchObject({status:401})
    expect(f.reads).toHaveLength(0)
  })
  it('scopes inbox reads to the authenticated seller twice', async () => {
    const f=fixture({id:'seller',email:'seller@example.org',role:'user'})
    await readAnnouncementMessages(f.ctx)
    expect(f.reads).toEqual([['seller','seller']])
  })
})