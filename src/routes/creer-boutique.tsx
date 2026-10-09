import { createFileRoute } from '@tanstack/react-router'
import { SubscribePage } from '@/components/content-pages'
import { pageHead } from '@/lib/page-head'
export const Route = createFileRoute('/creer-boutique')({
 head: () => pageHead('Créer ma boutique', 'Créer ma boutique sur TOUT∞SUITE ANNONCES au Sénégal. Découvrez nos boutiques et produits en FCFA.'),
 validateSearch: (search: Record<string, unknown>) => ({ formule: typeof search.formule === 'string' ? search.formule : 'pro' }),
 component: Page,
})
function Page() { const { formule } = Route.useSearch(); return <SubscribePage formula={formule}/> }
