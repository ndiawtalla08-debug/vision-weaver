import { createFileRoute } from '@tanstack/react-router'
import { CatalogPage } from '@/components/content-pages'
import { pageHead } from '@/lib/page-head'
export const Route = createFileRoute('/boutiques')({
 head: () => pageHead('Nos boutiques', 'Nos boutiques sur TOUT∞SUITE ANNONCES au Sénégal. Découvrez nos boutiques et produits en FCFA.'),
 validateSearch: (search: Record<string, unknown>) => ({ q: typeof search.q === 'string' ? search.q : '' }),
 component: Page,
})
function Page() { const { q } = Route.useSearch(); return <CatalogPage query={q}/> }
