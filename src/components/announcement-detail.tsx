import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowLeft, ChevronLeft, ChevronRight, Heart, MapPin, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AnnouncementPhoto } from './announcements'
import { useD1Catalog } from '@/lib/d1-catalog'
import { useMarket } from '@/lib/market-context'
import { announcementContact, announcementDate, similarAnnouncements } from '@/lib/announcement-details'
import { formatMoney } from '@/lib/catalog'

export function AnnouncementDetail({ id }: { id: string }) {
  const { announcements, categories } = useD1Catalog()
  const { favoriteState } = useMarket()
  const [index, setIndex] = useState(0)
  const a = announcements.find(item => item.id === id)
  if (!a) return null
  const photos = [...new Set([a.image, ...a.images].filter(Boolean))]
  const contact = announcementContact(a)
  const favorite = favoriteState.items.some(f => f.announcement_id === a.id)
  const similar = similarAnnouncements(a, announcements)
  const details = [
    ['Catégorie', categories.find(c => c.id === a.category_id)?.name || 'Non renseignée'],
    ['Localisation', a.city || 'Non renseignée'],
    ['État', a.condition || 'Non renseigné'],
    ['Date de publication', announcementDate(a.created_at)],
    ['Référence', a.id],
    ...Object.entries(a.attributes ?? {}).map(([key, value]) => [key, typeof value === 'boolean' ? value ? 'Oui' : 'Non' : String(value)]),
  ]
  return <main className="container-site page-main">
    <Button variant="ghost" className="mb-5" asChild><Link to="/annonces"><ArrowLeft/>Toutes les annonces</Link></Button>
    <h1 className="break-words">{a.title}</h1>
    {a.city && <p className="mb-7 flex items-center gap-2 text-sm text-muted-foreground"><MapPin className="size-4"/>{a.city}</p>}
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <section aria-label="Galerie photo" className="min-w-0">
        <AnnouncementPhoto key={photos[index] || a.id} src={photos[index] || ''} title={`${a.title} — photo ${index + 1}`} className="rounded-md"/>
        {photos.length > 1 && <>
          <div className="my-3 flex items-center justify-between"><Button variant="outline" size="icon" aria-label="Photo précédente" onClick={() => setIndex(i => (i - 1 + photos.length) % photos.length)}><ChevronLeft/></Button><span role="status" className="text-sm text-muted-foreground">{index + 1} / {photos.length}</span><Button variant="outline" size="icon" aria-label="Photo suivante" onClick={() => setIndex(i => (i + 1) % photos.length)}><ChevronRight/></Button></div>
          <div className="flex gap-3 overflow-x-auto pb-2">{photos.map((photo, i) => <Button key={photo} variant="outline" className={`h-20 w-24 shrink-0 overflow-hidden p-0 ${index === i ? 'ring-2 ring-primary' : ''}`} aria-label={`Afficher la photo ${i + 1}`} aria-pressed={index === i} onClick={() => setIndex(i)}><img src={photo} alt={`Miniature ${i + 1}`} className="h-full w-full object-contain"/></Button>)}</div>
        </>}
      </section>
      <section className="min-w-0 border-t border-border pt-5 lg:border-t-0 lg:pt-0">
        <p className="mb-6 text-3xl font-bold text-destructive">{a.price == null ? 'Prix sur demande' : formatMoney(a.price)}</p>
        {contact ? <Button className="w-full" asChild><a href={contact.href}><Phone/>{contact.label}</a></Button> : <><Button className="w-full" disabled><Phone/>Contacter le vendeur</Button><p className="mt-2 text-sm text-muted-foreground">Le vendeur n’a pas renseigné de coordonnées publiques.</p></>}
        <Button variant="outline" className="mb-7 mt-3 w-full" aria-pressed={favorite} disabled={favoriteState.busy || favoriteState.loading} onClick={() => void favoriteState.toggle(a.id, 'announcement')}><Heart className={favorite ? 'fill-destructive text-destructive' : ''}/>{favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}</Button>
        <h2 className="mb-4 text-2xl">Caractéristiques</h2><dl>{details.map(([label, value]) => <div key={label} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-4 border-b border-border py-3 text-sm"><dt className="break-words text-muted-foreground">{label}</dt><dd className="break-words text-right">{value}</dd></div>)}</dl>
      </section>
    </div>
    <section className="mt-9 border-t border-border pt-6"><h2 className="mb-4 text-2xl">Description</h2><p className="max-w-3xl whitespace-pre-wrap break-words leading-relaxed">{a.description || 'Aucune description renseignée.'}</p></section>
    <section className="mt-9 border-t border-border pt-6" aria-label="Annonces similaires"><h2 className="mb-5 text-2xl">Annonces similaires</h2>
      {similar.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{similar.map(item => <article key={item.id} className="product-card flex min-w-0 flex-col">
        <Link to="/annonce/$id" params={{id: item.id}} aria-label={`Voir ${item.title}`}><AnnouncementPhoto src={item.image || item.images[0] || ''} title={item.title}/></Link>
        <div className="flex flex-1 flex-col gap-3 p-4"><h3 className="break-words text-xl">{item.title}</h3>{item.city && <p className="flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="size-4"/>{item.city}</p>}<p className="price">{item.price == null ? 'Prix sur demande' : formatMoney(item.price)}</p><Button variant="outline" className="mt-auto" asChild><Link to="/annonce/$id" params={{id:item.id}}>Voir l’annonce</Link></Button></div>
      </article>)}</div> : <p className="text-sm text-muted-foreground">Aucune autre annonce disponible pour le moment.</p>}
    </section>
  </main>
}