import { createFileRoute } from '@tanstack/react-router'
import { AccountPage } from '@/components/content-pages'
import { pageHead } from '@/lib/page-head'
export const Route = createFileRoute('/mon-compte')({
 head: () => pageHead('Mon compte', 'Mon compte sur TOUT∞SUITE ANNONCES au Sénégal. Découvrez nos boutiques et produits en FCFA.'),
 
 component: Page,
})
function Page() { return <AccountPage/> }
