import { createFileRoute } from '@tanstack/react-router'
import { StorePage } from '@/components/content-pages'
import { pageHead } from '@/lib/page-head'
import { storeProductsOptions } from '@/components/store-products'
import { d1Identifier } from '@/lib/d1-products-schema'
export const Route = createFileRoute('/boutique/$id')({
 loader: ({context,params}) => d1Identifier.safeParse(params.id).success ? context.queryClient.ensureQueryData(storeProductsOptions(params.id)) : undefined,
 head: () => pageHead('Boutique vendeur', 'Boutique vendeur sur TOUT∞SUITE ANNONCES au Sénégal. Découvrez nos boutiques et produits en FCFA.'),
 
 component: Page,
})
function Page() { const { id } = Route.useParams(); return <StorePage id={id}/> }
