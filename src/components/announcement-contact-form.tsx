import { useState } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { MessageSquare, Send } from 'lucide-react'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog'
import { messageInput } from '@/lib/announcement-messages-schema'
import { sendMessage } from '@/lib/announcement-messages.functions'

export function AnnouncementContactForm({id,title}: {id:string;title:string}) {
  const send = useServerFn(sendMessage)
  const [open,setOpen] = useState(false)
  const [busy,setBusy] = useState(false)
  const [notice,setNotice] = useState<string|null>(null)
  return <><Button className="w-full" onClick={() => {setOpen(true);setNotice(null)}}><MessageSquare/>Contacter le vendeur</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogTitle>Contacter le vendeur</DialogTitle><DialogDescription>{title}</DialogDescription>
      <form className="space-y-4" onSubmit={async e => {
        e.preventDefault(); const form=e.currentTarget; const values=new FormData(form)
        const parsed=messageInput.safeParse({announcement_id:id,name:values.get('name'),email:values.get('email'),message:values.get('message'),website:values.get('website')})
        if (!parsed.success) {setNotice('Vérifiez votre nom, votre email et votre message (10 à 2 000 caractères).');return}
        setBusy(true);setNotice(null)
        try {const result=await send({data:parsed.data});setNotice(result.error || 'Votre message est enregistré dans la boîte de réception du vendeur.');if (result.id) form.reset()}
        catch {setNotice('Le message n’a pas été envoyé. Veuillez réessayer.')}
        finally {setBusy(false)}
      }}>
        <label className="block text-sm">Votre nom<input name="name" required minLength={2} maxLength={100} autoComplete="name" className="form-input mt-2"/></label>
        <label className="block text-sm">Votre email<input name="email" type="email" required maxLength={200} autoComplete="email" className="form-input mt-2"/></label>
        <label className="block text-sm">Votre message<textarea name="message" required minLength={10} maxLength={2000} className="form-input mt-2 h-32! resize-y"/></label>
        <div hidden aria-hidden="true"><input name="website" tabIndex={-1} autoComplete="off" defaultValue=""/></div>
        <p className="text-xs text-muted-foreground">Votre nom, email et message seront transmis uniquement au vendeur de cette annonce.</p>
        <Button type="submit" disabled={busy} className="w-full"><Send/>{busy ? 'Envoi…' : 'Envoyer le message'}</Button>
        {notice && <p role="status" className="notice">{notice}</p>}
      </form>
    </DialogContent></Dialog>
  </>
}