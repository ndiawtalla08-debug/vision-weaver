import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

// Simulated listing: no AI call. The save step writes to the real catalogue like the server does.
const env = Object.fromEntries(readFileSync('.env', 'utf8').split('\n').filter(l => l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')] }))
const url = process.env.SUPABASE_URL || env.VITE_SUPABASE_URL
const srKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const opts = { auth: { persistSession: false } }
const marker = `TEST E2E ${Date.now()}`
const listing = { title: marker, description: 'Fiche simulée pour test.', highlights: ['Solide'], specifications: ['Coton'], tags: ['test'] }
const saved: string[] = []

vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => { const c: any = { inputValidator: () => c, handler: () => c }; return c },
  useServerFn: (fn: unknown) => fn,
}))
vi.mock('@/lib/listing.functions', () => ({
  generateListing: async () => ({ ok: true, listing }),
  saveListing: async ({ data }: any) => {
    const admin = createClient(url, srKey!, opts)
    const { data: row, error } = await admin.from('products').insert({ name: data.input.name, title: data.listing.title, description: data.listing.description, price: Number(data.input.price), category: data.input.category, highlights: data.listing.highlights, specifications: data.listing.specifications, tags: data.listing.tags, image_data: data.input.image }).select('id').single()
    if (error) return { ok: false, error: 'Enregistrement impossible, réessayez.' }
    saved.push(row.id); return { ok: true }
  },
}))

describe('bouton « Enregistrer dans le catalogue »', () => {
  it.skipIf(!srKey)('enregistre une fiche simulée visible dans le catalogue public', async () => {
    const { ListingGenerator } = await import('@/components/listing-generator')
    render(<ListingGenerator />)
    const file = new File([new Uint8Array([137, 80, 78, 71])], 'p.png', { type: 'image/png' })
    fireEvent.change(screen.getByLabelText('Photo du produit'), { target: { files: [file] } })
    await screen.findByAltText('Aperçu du produit')
    fireEvent.change(screen.getByLabelText('Nom du produit'), { target: { value: 'Robe test' } })
    fireEvent.change(screen.getByLabelText('Prix en FCFA'), { target: { value: '15000' } })
    fireEvent.click(screen.getByRole('button', { name: /Rédiger la fiche produit/ }))
    fireEvent.click(await screen.findByRole('button', { name: /Enregistrer dans le catalogue/ }))
    await screen.findByText('Fiche enregistrée au catalogue', {}, { timeout: 10000 })
    try {
      const anon = createClient(url, env.VITE_SUPABASE_PUBLISHABLE_KEY, opts)
      const { data } = await anon.from('products').select('title,price,category').eq('id', saved[0])
      expect(data).toEqual([{ title: marker, price: 15000, category: 'Mode' }])
    } finally {
      await createClient(url, srKey!, opts).from('products').delete().in('id', saved)
    }
  }, 20000)
})
