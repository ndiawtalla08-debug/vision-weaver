import { createFileRoute } from '@tanstack/react-router'
import { D1Account } from '@/components/d1-account'
import { pageHead } from '@/lib/page-head'
export const Route = createFileRoute('/mon-compte')({
 head: () => pageHead('Mon compte', 'Mon compte sur TOUT∞SUITE ANNONCES au Sénégal. Découvrez nos boutiques et produits en FCFA.'),
 
 component: Page,
})
function Page() { return <D1Account/> }
