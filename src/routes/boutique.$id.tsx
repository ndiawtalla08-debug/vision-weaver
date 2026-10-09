import { createFileRoute } from '@tanstack/react-router'
import { StorePage } from '@/components/content-pages'
import { pageHead } from '@/lib/page-head'
export const Route = createFileRoute('/boutique/$id')({
 head: () => pageHead('Boutique vendeur', 'Boutique vendeur sur TOUT∞SUITE ANNONCES au Sénégal. Découvrez nos boutiques et produits en FCFA.'),
 
 component: Page,
})
function Page() { const { id } = Route.useParams(); return <StorePage id={id}/> }
