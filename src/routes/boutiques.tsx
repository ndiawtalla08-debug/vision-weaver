import { createFileRoute } from '@tanstack/react-router'
import { CatalogPage } from '@/components/content-pages'
import { pageHead } from '@/lib/page-head'
export type BoutiquesSearch = { q?: string; nom?: string; categorie?: string; tri?: 'nom' }
export const Route = createFileRoute('/boutiques')({
 head: () => pageHead('Nos boutiques', 'Nos boutiques sur TOUT∞SUITE ANNONCES au Sénégal. Découvrez nos boutiques et produits en FCFA.'),
 validateSearch: (search: Record<string, unknown>): BoutiquesSearch => {
  const out: BoutiquesSearch = {}
  for (const k of ['q', 'nom', 'categorie'] as const) if (typeof search[k] === 'string' && search[k]) out[k] = (search[k] as string).slice(0, 100)
  if (search['tri'] === 'nom') out.tri = 'nom'
  return out
 },
 component: Page,
})
function Page() { const { q } = Route.useSearch(); return <CatalogPage query={q ?? ''}/> }
