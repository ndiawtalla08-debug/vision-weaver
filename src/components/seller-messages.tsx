import { useEffect, useState } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { Link } from '@tanstack/react-router'
import { Button } from './ui/button'
import { readMessages } from '@/lib/announcement-messages.functions'

export function SellerMessages() {
  const read=useServerFn(readMessages)
  const [result,setResult]=useState<{messages:Awaited<ReturnType<typeof readMessages>>['messages'];error:string|null}|null>(null)
  const [busy,setBusy]=useState(false)
  const load=async () => {setBusy(true);try {setResult(await read())} catch {setResult({messages:[],error:'Impossible de charger vos messages.'})} finally {setBusy(false)}}
  useEffect(() => {void load()},[])
  return <main className="container-site page-main"><div className="flex flex-wrap justify-between gap-3"><h1>Messages reçus</h1><Button variant="outline" disabled={busy} onClick={() => void load()}>Actualiser</Button></div>
    {busy && <p role="status">Chargement…</p>}{result?.error && <p role="alert" className="notice my-5">{result.error}</p>}
    {result && !result.error && !result.messages.length && <p className="my-6 text-muted-foreground">Aucun message reçu.</p>}
    <div className="mt-6 space-y-6">{result?.messages.map(m => <article className="border-b border-border pb-6" key={m.id}><h2 className="text-2xl"><Link to="/annonce/$id" params={{id:m.announcement_id}}>{m.title}</Link></h2><p className="mt-2 break-words text-sm">{m.name} · {m.email}</p><p className="mt-1 text-xs text-muted-foreground">{m.created_at}</p><p className="mt-4 whitespace-pre-wrap break-words">{m.message}</p><Button asChild className="mt-4"><a href={replyLink(m)}>Répondre</a></Button></article>)}</div>
  </main>
}
/** Opens the seller's own mail app with the buyer's address and a quoted message. */
export function replyLink(m:{email:string;title:string;message:string}) {
  const body=`Bonjour,\n\n\n\n— Votre message au sujet de « ${m.title} » :\n${m.message.split('\n').map(l => '> '+l).join('\n')}`
  return `mailto:${encodeURIComponent(m.email)}?subject=${encodeURIComponent('Re : '+m.title)}&body=${encodeURIComponent(body)}`
}
