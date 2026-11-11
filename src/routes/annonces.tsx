import { createFileRoute } from '@tanstack/react-router'
import { AnnouncementsPage } from '@/components/announcements'
import { pageHead } from '@/lib/page-head'
export const Route = createFileRoute('/annonces')({ head: () => pageHead('Annonces', 'Consultez Annonces sur TOUT∞SUITE ANNONCES, votre marketplace au Sénégal.'), component: Page })
function Page() { return <AnnouncementsPage/> }
