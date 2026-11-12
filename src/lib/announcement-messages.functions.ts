import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { messageInput, receivedMessage } from './announcement-messages-schema'
import { d1Request, requireD1Session } from './d1-session.server'

export const sendMessage = createServerFn({method:'POST'}).inputValidator(messageInput).handler(async ({data}) => {
  try {
    const {announcement_id, ...payload} = data
    const result = z.object({id:z.string().min(1)}).parse(await d1Request(`/announcements/${announcement_id}/messages`,undefined,'POST',payload))
    return {id:result.id,error:null}
  } catch { return {id:null,error:'Le message n’a pas été envoyé. Le service de contact nécessite la mise à jour de l’API Cloudflare, ou est momentanément indisponible.'} }
})
export const readMessages = createServerFn({method:'GET'}).handler(async () => {
  try {
    const session = await requireD1Session()
    const result = z.object({messages:z.array(receivedMessage)}).parse(await d1Request('/me/announcement-messages',session.token))
    return {messages:result.messages,error:null}
  } catch { return {messages:[],error:'Connectez-vous pour lire vos messages. Si vous êtes connecté, la mise à jour de l’API Cloudflare est nécessaire.'} }
})