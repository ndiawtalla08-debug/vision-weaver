import { useEffect, useRef } from 'react'
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
  const seen = useRef(new Set<string>())
  const grid = useRef<HTMLDivElement>(null)
  // One view event per card per page load, when at least half of the card is visible.
  useEffect(() => {
    const el = grid.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      const id = (e.target as HTMLElement).dataset['announcementId']
      if (!e.isIntersecting || !id || seen.current.has(id)) return
      seen.current.add(id)
      window.__lovableEvents?.track?.('project.home_announcement_viewed', { announcement_id: id, position: Number((e.target as HTMLElement).dataset['position']) })
    }), { threshold: 0.5 })
    el.querySelectorAll('[data-announcement-id]').forEach(c => io.observe(c))
    return () => io.disconnect()
  }, [latest.map(a => a.id).join()])
  return <section className="container-site shops-section" aria-labelledby="home-annonces">
    <div className="section-heading"><div><div className="eyebrow">PUBLIÉES PAR NOS VENDEURS</div><h2 id="home-annonces">Dernières annonces</h2></div><Button variant="link" size="sm" asChild><Link to="/annonces">Toutes les annonces <ArrowRight/></Link></Button></div>
    {!latest.length && <p className="text-muted-foreground">Aucune annonce publiée pour le moment.</p>}
    <div ref={grid} className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">{latest.map((a, i) => <Link key={a.id} data-announcement-id={a.id} data-position={i + 1} onClick={() => window.__lovableEvents?.track?.('project.home_announcement_clicked', { announcement_id: a.id, position: i + 1 })} to="/annonce/$id" params={{ id: a.id }} className="product-card flex min-w-0 flex-col">
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
