import { createFileRoute } from '@tanstack/react-router'
import { ListingGenerator } from '@/components/listing-generator'
import { pageHead } from '@/lib/page-head'
export const Route = createFileRoute('/fiche-produit-ia')({
  head: () => pageHead('Rédiger une fiche produit', 'Vendeurs : ajoutez une photo et quelques détails, notre assistant rédige votre fiche produit en français.'),
  component: Page,
})
function Page() { return <main className="container-site py-10"><h1 className="mb-2 text-4xl">Rédiger une fiche produit</h1><p className="mb-8 text-sm text-muted-foreground">Ajoutez une photo et quelques détails : l’assistant rédige titre, description, points forts et mots-clés.</p><ListingGenerator/></main> }
