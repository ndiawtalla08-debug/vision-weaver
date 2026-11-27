import { z } from 'zod'

const photo = z.string().max(5_000_000).regex(/^https:\/\/[^\s]+$|^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, 'Photo invalide.')
const attrValue = z.union([z.string().max(120), z.number(), z.boolean()])

export const announcementInput = z.object({
  title: z.string().trim().min(3, 'Titre : 3 caractères minimum.').max(120),
  description: z.string().max(5000),
  category_id: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/).nullable(),
  subcategory: z.string().trim().max(80),
  price: z.number().int().nonnegative().nullable(),
  negotiable: z.boolean(),
  location: z.string().trim().max(120),
  city: z.string().trim().max(80),
  contact_phone: z.string().trim().max(25),
  contact_email: z.union([z.literal(''), z.string().trim().email('Email public invalide.').max(200)]),
  attributes: z.record(z.string().regex(/^[a-z_]{1,40}$/), attrValue).refine(v => Object.keys(v).length <= 15),
  images: z.array(photo).max(5, '5 photos maximum.'),
  draft: z.boolean(),
}).strict()
export type AnnouncementInput = z.infer<typeof announcementInput>

export const announcementStatus = z.enum(['draft', 'pending', 'published', 'rejected', 'archived'])
export type AnnouncementStatus = z.infer<typeof announcementStatus>

const text = z.string().nullable().optional()
export const myAnnouncement = z.object({
  id: z.string(), title: z.string(), description: text, price: z.number().nullable().optional(),
  negotiable: z.boolean().optional(), city: text, location: text, category_id: text, subcategory: text,
  attributes: z.record(attrValue).nullable().optional(), status: announcementStatus,
  views: z.number().nullable().optional(), contact_phone: text, contact_email: text,
  created_at: text, updated_at: text, image: text, images: z.array(z.string()).optional(),
})
export type MyAnnouncement = z.infer<typeof myAnnouncement>

export const statusLabels: Record<AnnouncementStatus, string> = {
  published: 'Publiée', draft: 'Brouillon', pending: 'En attente de validation', rejected: 'Refusée', archived: 'Archivée',
}

export const emptyAnnouncement = (): AnnouncementInput => ({
  title: '', description: '', category_id: null, subcategory: '', price: null, negotiable: false,
  location: '', city: '', contact_phone: '', contact_email: '', attributes: {}, images: [], draft: true,
})

/** Champs spécifiques proposés selon la catégorie (clé D1 → libellé). */
export const categoryFields: Record<string, { key: string; label: string; options?: string[] }[]> = {
  vehicules: [
    { key: 'marque', label: 'Marque' }, { key: 'modele', label: 'Modèle' }, { key: 'annee', label: 'Année' },
    { key: 'kilometrage', label: 'Kilométrage (km)' },
    { key: 'carburant', label: 'Carburant', options: ['Essence', 'Diesel', 'Hybride', 'Électrique'] },
    { key: 'boite', label: 'Boîte de vitesses', options: ['Manuelle', 'Automatique'] },
  ],
  immobilier: [
    { key: 'transaction', label: 'Type de transaction', options: ['Vente', 'Location'] },
    { key: 'type_bien', label: 'Type de bien', options: ['Appartement', 'Maison', 'Terrain', 'Bureau', 'Chambre'] },
    { key: 'surface', label: 'Surface (m²)' }, { key: 'pieces', label: 'Nombre de pièces' },
  ],
  electronique: [
    { key: 'marque', label: 'Marque' }, { key: 'modele', label: 'Modèle' },
    { key: 'etat', label: 'État', options: ['Neuf', 'Comme neuf', 'Bon état', 'À réparer'] },
  ],
  mode: [{ key: 'taille', label: 'Taille' }, { key: 'etat', label: 'État', options: ['Neuf', 'Comme neuf', 'Bon état'] }],
  maison: [{ key: 'etat', label: 'État', options: ['Neuf', 'Comme neuf', 'Bon état'] }],
  beaute: [{ key: 'marque', label: 'Marque' }],
  services: [{ key: 'zone', label: 'Zone d’intervention' }],
}

/** Ne garde que les caractéristiques prévues pour la catégorie choisie. */
export function attributesFor(category: string | null, attributes: Record<string, string | number | boolean>) {
  const keys = new Set((categoryFields[category ?? ''] ?? []).map(f => f.key))
  return Object.fromEntries(Object.entries(attributes).filter(([k, v]) => keys.has(k) && v !== ''))
}

/** Regroupe les annonces par onglet de « Mes annonces ». */
export function groupByStatus(list: MyAnnouncement[]) {
  return {
    published: list.filter(a => a.status === 'published'),
    draft: list.filter(a => a.status === 'draft'),
    pending: list.filter(a => a.status === 'pending'),
    rejected: list.filter(a => a.status === 'rejected'),
  }
}
