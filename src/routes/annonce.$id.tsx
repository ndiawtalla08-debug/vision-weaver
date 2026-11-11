import { createFileRoute, Link, notFound, useRouter } from '@tanstack/react-router'
import { AnnouncementDetail } from '@/components/announcement-detail'
import { Button } from '@/components/ui/button'
import { d1CatalogOptions } from '@/lib/d1-catalog'
import { pageHead } from '@/lib/page-head'
import { productImageUrl } from '@/lib/api-client'

export const Route = createFileRoute('/annonce/$id')({
  loader: async ({ params, context }) => {
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(params.id)) throw notFound()
    const data = await context.queryClient.ensureQueryData(d1CatalogOptions)
    if (data.error) throw new Error(data.error)
    const announcement = data.catalog.announcements.find(a => a.id === params.id)
    if (!announcement) throw notFound()
    return announcement
  },
  head: ({ loaderData }) => {
    const head = pageHead(loaderData?.title || 'Annonce indisponible', loaderData?.description || 'Consultez les annonces TOUT∞SUITE au Sénégal, prix en FCFA.')
    const image = productImageUrl(loaderData?.image || loaderData?.images?.[0])
    return { meta: [...head.meta, ...(image.startsWith('https://') ? [{property: 'og:image', content: image}, {name: 'twitter:image', content: image}] : [])] }
  },
  component: Page,
  notFoundComponent: () => <main className="container-site page-main"><h1>Annonce introuvable</h1><p className="mb-6 text-muted-foreground">Cette annonce n’est plus disponible.</p><Button asChild><Link to="/annonces">Voir les annonces</Link></Button></main>,
  errorComponent: ({ reset }) => { const router = useRouter(); return <main className="container-site page-main"><h1>Annonces indisponibles</h1><p role="alert" className="mb-5">Impossible de charger cette annonce pour le moment.</p><Button onClick={() => {void router.invalidate(); reset()}}>Réessayer</Button></main> },
})
function Page() { const { id } = Route.useParams(); return <AnnouncementDetail key={id} id={id}/> }