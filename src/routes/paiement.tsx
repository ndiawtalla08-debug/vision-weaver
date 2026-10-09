import { createFileRoute } from '@tanstack/react-router'
import { PaymentPage } from '@/components/content-pages'
import { pageHead } from '@/lib/page-head'
export const Route = createFileRoute('/paiement')({
 head: () => pageHead('Paiement', 'Paiement sur TOUT∞SUITE ANNONCES au Sénégal. Découvrez nos boutiques et produits en FCFA.'),
 
 component: Page,
})
function Page() { return <PaymentPage/> }
