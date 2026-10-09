import { createFileRoute } from '@tanstack/react-router'
import { TrackingPage } from '@/components/content-pages'
import { pageHead } from '@/lib/page-head'
export const Route = createFileRoute('/suivi')({
 head: () => pageHead('Suivi de commande', 'Suivi de commande sur TOUT∞SUITE ANNONCES au Sénégal. Découvrez nos boutiques et produits en FCFA.'),
 
 component: Page,
})
function Page() { return <TrackingPage/> }
