import { messageInput } from '../../../src/lib/announcement-messages-schema'
import { body, HttpError, id, json, requireUser, sha256, type Ctx } from './lib'

export async function sendAnnouncementMessage(c: Ctx) {
  const parsed = messageInput.safeParse({...await body(c.req), announcement_id:c.params['id']})
  if (!parsed.success) throw new HttpError(400, 'Nom, email ou message invalide.')
  const data = parsed.data
  const a = await c.env.DB.prepare("SELECT id, user_id FROM announcements WHERE id = ? AND status = 'published'").bind(data.announcement_id).first<{id:string;user_id:string}>()
  if (!a) throw new HttpError(404, 'Annonce indisponible.')
  const messageId = id()
  const rateKey = await sha256(c.req.headers.get('cf-connecting-ip') || 'unknown')
  // A conditional insert enforces both limits atomically under concurrent requests.
  const result = await c.env.DB.prepare(`INSERT INTO announcement_messages (id, announcement_id, seller_id, name, email, message, rate_key)
    SELECT ?,?,?,?,?,?,? WHERE
    (SELECT COUNT(*) FROM announcement_messages WHERE rate_key = ? AND created_at > datetime('now','-1 hour')) < 20 AND
    (SELECT COUNT(*) FROM announcement_messages WHERE email = ? AND created_at > datetime('now','-1 hour')) < 5`)
    .bind(messageId,a.id,a.user_id,data.name,data.email.toLowerCase(),data.message,rateKey,rateKey,data.email.toLowerCase()).run()
  if (!result.meta.changes) throw new HttpError(429, 'Trop de messages. Réessayez plus tard.')
  return json({id:messageId},201)
}
export async function readAnnouncementMessages(c: Ctx) {
  const u = requireUser(c)
  const {results} = await c.env.DB.prepare(`SELECT m.id,m.announcement_id,a.title,m.name,m.email,m.message,m.created_at
    FROM announcement_messages m JOIN announcements a ON a.id = m.announcement_id
    WHERE m.seller_id = ? AND a.user_id = ? ORDER BY m.created_at DESC LIMIT 100`).bind(u.id,u.id).all()
  return json({messages:results})
}