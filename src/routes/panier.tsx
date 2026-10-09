import { createFileRoute } from '@tanstack/react-router'
import { CartPage } from '@/components/content-pages'
import { pageHead } from '@/lib/page-head'
export const Route = createFileRoute('/panier')({
 head: () => pageHead('Mon panier', 'Mon panier sur TOUT∞SUITE ANNONCES au Sénégal. Découvrez nos boutiques et produits en FCFA.'),
 
 component: Page,
})
function Page() { return <CartPage/> }
