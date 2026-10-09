import { createFileRoute } from '@tanstack/react-router'
import { ProductPage } from '@/components/content-pages'
import { pageHead } from '@/lib/page-head'
export const Route = createFileRoute('/produit/$id')({
 head: () => pageHead('Fiche produit', 'Fiche produit sur TOUT∞SUITE ANNONCES au Sénégal. Découvrez nos boutiques et produits en FCFA.'),
 
 component: Page,
})
function Page() { const { id } = Route.useParams(); return <ProductPage id={id}/> }
