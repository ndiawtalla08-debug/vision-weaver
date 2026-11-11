import type { z } from 'zod'
import type { announcementSchema } from './d1-schema'

export function announcementContact(a: Pick<z.infer<typeof announcementSchema>, 'contact_phone' | 'contact_email'>) {
  const phone = a.contact_phone?.trim()
  if (phone && /^\+?[\d\s().-]{7,25}$/.test(phone)) return { href: `tel:${phone.replace(/[\s().-]/g, '')}`, label: 'Appeler le vendeur' }
  const email = a.contact_email?.trim()
  if (email && /^[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/.test(email)) return { href: `mailto:${email}`, label: 'Contacter le vendeur' }
  return null
}

export function announcementDate(value?: string | null) {
  if (!value) return 'Non renseignée'
  const date = new Date(value.includes('T') ? value : value.replace(' ', 'T') + 'Z')
  return Number.isNaN(date.getTime()) ? 'Non renseignée' : new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'Africa/Dakar' }).format(date)
}