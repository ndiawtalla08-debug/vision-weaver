import { useState } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { Check, Loader2, Save, Sparkles, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { generateListing, saveListing, type Listing } from '@/lib/listing.functions'

export function ListingGenerator() {
  const run = useServerFn(generateListing)
  const save = useServerFn(saveListing)
  const [image, setImage] = useState('')
  const [form, setForm] = useState({ name: '', category: 'Mode', price: '', details: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [listing, setListing] = useState<Listing | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const field = 'w-full rounded-md border border-border bg-card px-3 py-2 text-sm'
  const onFile = (file?: File) => {
    if (!file) return
    if (file.size > 5_000_000) return setError('Photo trop lourde (5 Mo maximum).')
    const reader = new FileReader(); reader.onload = () => { setImage(String(reader.result)); setError('') }; reader.readAsDataURL(file)
  }
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!image) return setError('Ajoutez une photo du produit.')
    setLoading(true); setError(''); setListing(null); setSaved(false)
    try { const r = await run({ data: { image, ...form } }); r.ok ? setListing(r.listing) : setError(r.error) }
    catch (err) { setError(err instanceof Error ? err.message : 'Rédaction impossible.') }
    finally { setLoading(false) }
  }
  const saveToCatalog = async () => {
    if (!listing) return
    setSaving(true); setError('')
    try { const r = await save({ data: { input: { image, ...form }, listing } }); r.ok ? setSaved(true) : setError(r.error ?? 'Enregistrement impossible.') }
    catch { setError('Enregistrement impossible, réessayez.') }
    finally { setSaving(false) }
  }
  return <div className="grid gap-8 md:grid-cols-2">
    <form onSubmit={submit} className="space-y-4">
      <label className="flex aspect-video cursor-pointer flex-col items-center justify-center overflow-hidden rounded-md border border-dashed border-border bg-muted text-sm text-muted-foreground">
        {image ? <img src={image} alt="Aperçu du produit" className="h-full w-full object-contain"/> : <><Upload className="mb-2 size-6"/>Ajouter une photo (5 Mo max.)</>}
        <input type="file" accept="image/*" className="sr-only" aria-label="Photo du produit" onChange={e => onFile(e.target.files?.[0])}/>
      </label>
      <input required className={field} placeholder="Nom du produit" aria-label="Nom du produit" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}/>
      <div className="grid grid-cols-2 gap-3">
        <select className={field} aria-label="Catégorie" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{['Mode','Beauté','Électronique','Maison','Alimentation','Autre'].map(c => <option key={c}>{c}</option>)}</select>
        <input required inputMode="numeric" className={field} placeholder="Prix (FCFA)" aria-label="Prix en FCFA" value={form.price} onChange={e => setForm({ ...form, price: e.target.value.replace(/\D/g, '') })}/>
      </div>
      <textarea className={`${field} min-h-28`} placeholder="Matière, tailles, couleurs, état, origine…" aria-label="Détails" value={form.details} onChange={e => setForm({ ...form, details: e.target.value })}/>
      <Button type="submit" className="w-full" disabled={loading}>{loading ? <Loader2 className="animate-spin"/> : <Sparkles/>}{loading ? 'Rédaction en cours…' : 'Rédiger la fiche produit'}</Button>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </form>
    <div className="rounded-md border border-border bg-card p-6">
      {listing ? <article className="space-y-4 text-sm">
        <h2 className="text-2xl">{listing.title}</h2>
        {form.price && <p className="price text-lg">{new Intl.NumberFormat('fr-FR').format(Number(form.price))} FCFA</p>}
        <p className="leading-relaxed text-muted-foreground">{listing.description}</p>
        <div><h3 className="mb-2 font-semibold">Points forts</h3><ul className="list-disc space-y-1 pl-5">{listing.highlights.map(h => <li key={h}>{h}</li>)}</ul></div>
        <div><h3 className="mb-2 font-semibold">Caractéristiques</h3><ul className="list-disc space-y-1 pl-5">{listing.specifications.map(s => <li key={s}>{s}</li>)}</ul></div>
        <div className="flex flex-wrap gap-2">{listing.tags.map(t => <span key={t} className="rounded bg-muted px-2 py-1 text-xs">#{t}</span>)}</div>
        <div className="flex flex-wrap gap-3">
          <Button onClick={saveToCatalog} disabled={saving || saved}>{saving ? <Loader2 className="animate-spin"/> : saved ? <Check/> : <Save/>}{saved ? 'Fiche enregistrée au catalogue' : saving ? 'Enregistrement…' : 'Enregistrer dans le catalogue'}</Button>
          <Button variant="outline" onClick={() => navigator.clipboard.writeText(`${listing.title}\n\n${listing.description}\n\n${listing.highlights.map(h => `• ${h}`).join('\n')}`)}>Copier la fiche</Button>
        </div>
        {saved && <p className="text-sm text-success">La fiche est visible dans le catalogue, rubrique « Tous les produits ».</p>}
      </article> : <p className="text-sm text-muted-foreground">La fiche rédigée apparaîtra ici. Relisez-la avant de la publier.</p>}
    </div>
  </div>
}
