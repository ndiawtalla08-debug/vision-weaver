import { createFileRoute } from '@tanstack/react-router'
import { FavoritesPage } from '@/components/content-pages'
import { pageHead } from '@/lib/page-head'
export const Route = createFileRoute('/favoris')({
 head: () => pageHead('Mes favoris', 'Mes favoris sur TOUT∞SUITE ANNONCES au Sénégal. Découvrez nos boutiques et produits en FCFA.'),
 
 component: Page,
})
function Page() { return <FavoritesPage/> }
