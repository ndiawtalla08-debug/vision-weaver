import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Heart, Megaphone, MapPin, RefreshCw, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { useD1Catalog } from '@/lib/d1-catalog'
import { useMarket } from '@/lib/market-context'
import { formatMoney } from '@/lib/catalog'

export function AnnouncementPhoto({ src, title, className = '' }: { src: string; title: string; className?: string }) {
  const [failed, setFailed] = useState(false)
  return <div className={`aspect-[4/3] overflow-hidden bg-secondary ${className}`}>
    {src && !failed ? <img src={src} alt={title} loading="lazy" className="h-full w-full object-contain" onError={() => setFailed(true)}/> : <div role="img" aria-label={`${title} — aucune photo`} className="flex h-full flex-col items-center justify-center gap-2 bg-muted text-muted-foreground"><span className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground"><Megaphone className="size-7"/></span><span className="text-xs font-semibold tracking-widest">TOUT∞SUITE</span><span className="text-xs">Aucune photo</span></div>}
  </div>
}

export function AnnouncementsPage() {
  const { announcements, categories, error, refreshing, retry } = useD1Catalog()
  const { favoriteState } = useMarket()
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [photoIndex, setPhotoIndex] = useState(0)
  const selected = announcements.find(a => a.id === selectedId)
  const filtered = announcements.filter(a => (!category || a.category_id === category) && `${a.title} ${a.description ?? ''} ${a.city ?? ''}`.toLocaleLowerCase('fr').includes(q.trim().toLocaleLowerCase('fr')))
  const photos = selected ? [...new Set([selected.image, ...selected.images].filter(Boolean))] : []
  return <main className="container-site page-main">
    <div className="flex flex-wrap items-center justify-between gap-3"><h1>Annonces</h1><Button variant="outline" size="sm" disabled={refreshing} onClick={() => void retry()}><RefreshCw className={refreshing ? 'animate-spin' : ''}/>Actualiser</Button></div>
    <div className="my-7 grid gap-3 md:grid-cols-[minmax(0,1fr)_280px]">
      <label className="relative"><Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground"/><input className="form-input pl-10!" aria-label="Rechercher une annonce" placeholder="Rechercher une annonce…" value={q} onChange={e => setQ(e.target.value)}/></label>
      <select className="form-input" aria-label="Catégorie des annonces" value={category} onChange={e => setCategory(e.target.value)}><option value="">Toutes les catégories</option>{categories.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}</select>
    </div>
    {error ? <div role="alert" className="notice mb-6">{error}</div> : <p role="status" className="mb-5 text-sm text-muted-foreground">{filtered.length} annonce{filtered.length !== 1 ? 's' : ''}</p>}
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">{filtered.map(a => {
      const favorite = favoriteState.items.some(f => f.announcement_id === a.id)
      return <article className="product-card flex min-w-0 flex-col" key={a.id}>
        <AnnouncementPhoto key={a.image || a.images[0]} src={a.image || a.images[0] || ''} title={a.title}/>
        <Button variant="ghost" size="icon" className="product-favorite" aria-label={`Favori : ${a.title}`} aria-pressed={favorite} disabled={favoriteState.busy || favoriteState.loading} onClick={() => void favoriteState.toggle(a.id, 'announcement')}><Heart className={favorite ? 'fill-destructive text-destructive' : ''}/></Button>
        <div className="flex flex-1 flex-col gap-3 p-4">
          {a.category_id && <p className="text-xs text-muted-foreground">{categories.find(c => c.id === a.category_id)?.name}</p>}
          <h2 className="break-words text-2xl leading-tight">{a.title}</h2>
          {a.city && <p className="flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="size-4 shrink-0"/>{a.city}</p>}
          <p className="price">{a.price == null ? 'Prix sur demande' : formatMoney(a.price)}</p>
          <p className="line-clamp-2 break-words text-sm text-muted-foreground">{a.description}</p>
          <Button variant="outline" className="mt-auto w-full" asChild><Link to="/annonce/$id" params={{id: a.id}}>Voir l’annonce</Link></Button>
          <Button variant="ghost" size="sm" onClick={() => { setSelectedId(a.id); setPhotoIndex(0) }}>Aperçu rapide</Button>
        </div>
      </article>
    })}</div>
    {!error && !filtered.length && <div className="empty-state"><Search className="mx-auto mb-4 size-8"/><p>{announcements.length ? 'Aucune annonce ne correspond à votre recherche.' : 'Aucune annonce publiée pour le moment.'}</p>{(q || category) && <Button variant="outline" className="mt-4" onClick={() => {setQ(''); setCategory('')}}>Réinitialiser les filtres</Button>}</div>}
    <Dialog open={Boolean(selected)} onOpenChange={open => {if (!open) setSelectedId(null)}}>
      {selected && <DialogContent className="max-w-2xl"><DialogTitle className="pr-7 text-3xl break-words">{selected.title}</DialogTitle><DialogDescription>{selected.city || 'Annonce TOUT∞SUITE'}</DialogDescription>
        <AnnouncementPhoto key={photos[photoIndex] || selected.id} src={photos[photoIndex] || ''} title={selected.title}/>
        {photos.length > 1 && <div className="flex flex-wrap gap-2">{photos.map((photo, i) => <Button key={photo} variant={photoIndex === i ? 'default' : 'outline'} size="sm" aria-label={`Photo ${i + 1}`} aria-pressed={photoIndex === i} onClick={() => setPhotoIndex(i)}>{i + 1}</Button>)}</div>}
        <p className="price">{selected.price == null ? 'Prix sur demande' : formatMoney(selected.price)}</p><p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{selected.description}</p>
      </DialogContent>}
    </Dialog>
  </main>
}