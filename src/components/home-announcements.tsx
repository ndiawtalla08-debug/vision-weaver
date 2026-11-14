import { Link } from '@tanstack/react-router'
import { ArrowRight, MapPin } from 'lucide-react'
import { Button } from './ui/button'
import { AnnouncementPhoto } from './announcements'
import { useD1Catalog } from '@/lib/d1-catalog'
import { formatMoney } from '@/lib/catalog'

/** Latest published D1 announcements shown on the home page. */
export function HomeAnnouncements({ limit = 8 }: { limit?: number }) {
  const { announcements, categories } = useD1Catalog()
  const latest = [...announcements].sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''))).slice(0, limit)
  return <section className="container-site shops-section" aria-labelledby="home-annonces">
    <div className="section-heading"><div><div className="eyebrow">PUBLIÉES PAR NOS VENDEURS</div><h2 id="home-annonces">Dernières annonces</h2></div><Button variant="link" size="sm" asChild><Link to="/annonces">Toutes les annonces <ArrowRight/></Link></Button></div>
    {!latest.length && <p className="text-muted-foreground">Aucune annonce publiée pour le moment.</p>}
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">{latest.map(a => <Link key={a.id} to="/annonce/$id" params={{ id: a.id }} className="product-card flex min-w-0 flex-col">
      <AnnouncementPhoto src={a.image || (a.images ?? [])[0] || ''} title={a.title}/>
      <div className="flex flex-1 flex-col gap-2 p-4">
        {a.category_id && <p className="text-xs text-muted-foreground">{categories.find(c => c.id === a.category_id)?.name}</p>}
        <h3 className="break-words text-xl leading-tight">{a.title}</h3>
        {a.city && <p className="flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="size-4 shrink-0"/>{a.city}</p>}
        <p className="price mt-auto">{a.price == null ? 'Prix sur demande' : formatMoney(a.price)}</p>
      </div>
    </Link>)}</div>
  </section>
}
