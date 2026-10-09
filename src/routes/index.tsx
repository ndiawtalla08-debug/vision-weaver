import { createFileRoute } from "@tanstack/react-router";
import { Home } from '@/components/home';
import { pageHead } from '@/lib/page-head';
export const Route = createFileRoute("/")({
  head: () => pageHead('Boutiques & shopping au Sénégal', 'Découvrez les boutiques, produits et offres TOUT∞SUITE ANNONCES au Sénégal. Prix en FCFA.'),
  component: Home,
});
