import { createFileRoute } from '@tanstack/react-router'
import { MyAnnouncements } from '@/components/my-announcements'
import { pageHead } from '@/lib/page-head'

export const Route = createFileRoute('/mes-annonces')({
  head: () => pageHead('Mes annonces', 'Créez, publiez et gérez vos petites annonces TOUT∞SUITE ANNONCES au Sénégal : brouillons, validation, photos et vues.'),
  component: MyAnnouncements,
})
