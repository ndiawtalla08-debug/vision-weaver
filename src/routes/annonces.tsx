import { createFileRoute } from '@tanstack/react-router'
import { InfoPage } from '@/components/content-pages'
import { pageHead } from '@/lib/page-head'
export const Route = createFileRoute('/annonces')({ head: () => pageHead('Annonces', 'Consultez Annonces sur TOUT∞SUITE ANNONCES, votre marketplace au Sénégal.'), component: Page })
function Page() { return <InfoPage kind="annonces"/> }
