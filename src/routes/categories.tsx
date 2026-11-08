import { createFileRoute } from '@tanstack/react-router'
import { D1CategoriesPage } from '@/components/content-pages'
import { pageHead } from '@/lib/page-head'
export const Route = createFileRoute('/categories')({ head: () => pageHead('Catégories', 'Consultez Catégories sur TOUT∞SUITE ANNONCES, votre marketplace au Sénégal.'), component: Page })
function Page() { return <D1CategoriesPage/> }
