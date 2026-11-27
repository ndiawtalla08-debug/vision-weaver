import { useEffect, useState } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Eye, Megaphone, Pencil, Plus, Send, Save, Trash2, X } from 'lucide-react'
import { Button } from './ui/button'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from './ui/alert-dialog'
import { useMarket } from '@/lib/market-context'
import { useD1Catalog } from '@/lib/d1-catalog'
import { formatMoney } from '@/lib/catalog'
import { productImageUrl } from '@/lib/api-client'
import { compressPhoto } from './seller-products'
import { deleteMyAnnouncement, readMyAnnouncements, saveMyAnnouncement } from '@/lib/my-announcements.functions'
import {
  announcementInput, categoryFields, emptyAnnouncement, groupByStatus, statusLabels,
  type AnnouncementInput, type MyAnnouncement,
} from '@/lib/my-announcements-schema'

type Tab = 'published' | 'draft' | 'pending' | 'rejected'
const tabs: { id: Tab; label: string }[] = [
  { id: 'published', label: 'Publiées' },
  { id: 'draft', label: 'Brouillons' },
  { id: 'pending', label: 'En attente' },
  { id: 'rejected', label: 'Refusées' },
]
const badge: Record<string, string> = {
  published: 'bg-success/15 text-success',
  draft: 'bg-muted text-muted-foreground',
  pending: 'bg-primary/20 text-foreground',
  rejected: 'bg-destructive/15 text-destructive',
  archived: 'bg-muted text-muted-foreground',
}

export function MyAnnouncements() {
  const { favoriteState } = useMarket()
  const { categories } = useD1Catalog()
  const cache = useQueryClient()
  const read = useServerFn(readMyAnnouncements)
  const save = useServerFn(saveMyAnnouncement)
  const remove = useServerFn(deleteMyAnnouncement)

  const [list, setList] = useState<MyAnnouncement[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [tab, setTab] = useState<Tab>('published')
  const [form, setForm] = useState<AnnouncementInput | null>(null)
  const [editId, setEditId] = useState<string | undefined>()
  const [deleting, setDeleting] = useState<MyAnnouncement | null>(null)

  async function load() {
    setLoading(true)
    try {
      const r = await read()
      setList(r.announcements)
      setError(r.error)
    } catch {
      setError('Impossible de charger vos annonces.')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    if (favoriteState.user) void load()
    else setLoading(false)
  }, [favoriteState.user?.id])

  const groups = groupByStatus(list)
  const shown = groups[tab]

  async function addPhotos(files: File[]) {
    if (!form) return
    const remaining = 5 - form.images.length
    const valid = files.filter(f => ['image/jpeg', 'image/png', 'image/webp'].includes(f.type)).slice(0, remaining)
    if (!valid.length) { setError(remaining ? 'Format accepté : JPG, PNG ou WebP.' : '5 photos maximum.'); return }
    setBusy(true)
    try {
      const values = await Promise.all(valid.map(compressPhoto))
      setForm(f => (f ? { ...f, images: [...f.images, ...values].slice(0, 5) } : f))
      setError(files.length > remaining ? `Vous ne pouvez ajouter que ${remaining} photo(s) supplémentaire(s).` : null)
    } catch {
      setError('Impossible de lire une ou plusieurs photos.')
    } finally {
      setBusy(false)
    }
  }

  function edit(a: MyAnnouncement) {
    setEditId(a.id)
    setForm({
      title: a.title, description: a.description ?? '', category_id: a.category_id ?? null,
      subcategory: a.subcategory ?? '', price: a.price ?? null, negotiable: !!a.negotiable,
      location: a.location ?? '', city: a.city ?? '', contact_phone: a.contact_phone ?? '',
      contact_email: a.contact_email ?? '', attributes: a.attributes ?? {},
      images: a.images?.length ? a.images : a.image ? [a.image] : [],
      draft: a.status === 'draft',
    })
    setNotice(''); setError(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function submit(draft: boolean) {
    if (!form) return
    const parsed = announcementInput.safeParse({ ...form, draft })
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Vérifiez les informations de l’annonce.'); return }
    setBusy(true); setError(null)
    try {
      const r = await save({ data: { ...(editId ? { id: editId } : {}), announcement: parsed.data } })
      if (r.error) { setError(r.error); return }
      setForm(null); setEditId(undefined)
      await load()
      await cache.invalidateQueries({ queryKey: ['d1-catalog'] })
      const status = (r.status ?? 'pending') as Tab
      setTab(status in groups ? status : 'pending')
      setNotice(draft ? 'Brouillon enregistré.' : 'Annonce envoyée : elle sera visible après validation.')
    } catch {
      setError('Enregistrement non confirmé. Rechargez vos annonces avant de réessayer.')
    } finally {
      setBusy(false)
    }
  }

  const fields = categoryFields[form?.category_id ?? ''] ?? []

  return (
    <main className="container-site page-main">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">Mon compte / Mes annonces</p>
          <h1 className="flex items-center gap-3"><Megaphone className="size-8 text-primary" />Mes annonces</h1>
          <p className="mt-2 text-sm text-muted-foreground">Créez, publiez et gérez vos petites annonces. Pour votre boutique, utilisez « Mes produits ».</p>
        </div>
        {favoriteState.user && !form && (
          <Button onClick={() => { setForm(emptyAnnouncement()); setEditId(undefined); setNotice(''); setError(null) }}><Plus />Créer une annonce</Button>
        )}
      </div>

      {error && <p role="alert" className="notice mb-5">{error}</p>}
      {notice && <p role="status" className="mb-5 rounded-md border border-success/40 bg-success/10 p-3 text-sm">{notice}</p>}

      {!favoriteState.user ? (
        loading || favoriteState.loading ? <p role="status">Chargement…</p> :
        <div className="empty-state"><Megaphone className="mx-auto mb-4 size-10" /><p className="mb-4">Connectez-vous pour gérer vos annonces.</p><Button asChild><Link to="/mon-compte">Me connecter</Link></Button></div>
      ) : form ? (
        <form className="rounded-md border border-border bg-card p-5 sm:p-7" onSubmit={e => { e.preventDefault(); void submit(false) }}>
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-2xl">{editId ? 'Modifier l’annonce' : 'Nouvelle annonce'}</h2>
            <Button type="button" variant="ghost" size="icon" aria-label="Fermer le formulaire" disabled={busy} onClick={() => { setForm(null); setEditId(undefined) }}><X /></Button>
          </div>

          <div className="grid gap-x-6 md:grid-cols-2">
            <label className="mb-4 block text-sm md:col-span-2">Titre de l’annonce
              <input className="form-input mt-2" required minLength={3} maxLength={120} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            </label>
            <label className="mb-4 block text-sm md:col-span-2">Description détaillée
              <textarea className="form-input mt-2 min-h-32" maxLength={5000} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </label>
            <label className="mb-4 block text-sm">Catégorie
              <select className="form-input mt-2" value={form.category_id ?? ''} onChange={e => setForm({ ...form, category_id: e.target.value || null, attributes: {} })}>
                <option value="">Choisir une catégorie</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="mb-4 block text-sm">Sous-catégorie
              <input className="form-input mt-2" maxLength={80} placeholder="Ex. : SUV, Smartphone, Appartement…" value={form.subcategory} onChange={e => setForm({ ...form, subcategory: e.target.value })} />
            </label>
            <label className="mb-4 block text-sm">Prix (FCFA)
              <input className="form-input mt-2" type="number" min={0} step={1} inputMode="numeric" value={form.price ?? ''} onChange={e => setForm({ ...form, price: e.target.value === '' ? null : Math.max(0, Math.floor(Number(e.target.value))) })} />
            </label>
            <label className="mb-4 flex items-center gap-3 self-end pb-3 text-sm">
              <input type="checkbox" className="size-4 accent-primary" checked={form.negotiable} onChange={e => setForm({ ...form, negotiable: e.target.checked })} />Prix négociable
            </label>
            <label className="mb-4 block text-sm">Ville
              <input className="form-input mt-2" maxLength={80} placeholder="Ex. : Dakar" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
            </label>
            <label className="mb-4 block text-sm">Localisation (quartier, adresse)
              <input className="form-input mt-2" maxLength={120} placeholder="Ex. : Plateau, Médina…" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
            </label>
          </div>

          {fields.length > 0 && (
            <fieldset className="mb-4 rounded-md border border-border p-4">
              <legend className="px-2 text-sm font-semibold">Informations spécifiques</legend>
              <div className="grid gap-x-6 sm:grid-cols-2">
                {fields.map(f => (
                  <label key={f.key} className="mb-3 block text-sm">{f.label}
                    {f.options ? (
                      <select className="form-input mt-2" value={String(form.attributes[f.key] ?? '')} onChange={e => setForm({ ...form, attributes: { ...form.attributes, [f.key]: e.target.value } })}>
                        <option value="">—</option>{f.options.map(o => <option key={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input className="form-input mt-2" maxLength={120} value={String(form.attributes[f.key] ?? '')} onChange={e => setForm({ ...form, attributes: { ...form.attributes, [f.key]: e.target.value } })} />
                    )}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <div className="mb-5">
            <p className="mb-2 text-sm font-medium">Photos ({form.images.length} / 5)</p>
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="form-input" aria-label="Ajouter des photos" disabled={busy || form.images.length >= 5}
              onChange={e => { const files = Array.from(e.currentTarget.files ?? []); e.currentTarget.value = ''; void addPhotos(files) }} />
            <p className="mt-2 text-xs text-muted-foreground">JPG, PNG ou WebP. Les grandes photos sont réduites automatiquement. La première est la photo principale.</p>
            {form.images.length > 0 && (
              <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5">
                {form.images.map((img, i) => (
                  <div key={`${i}-${img.slice(-24)}`} className="relative">
                    <img src={img.startsWith('data:') ? img : productImageUrl(img)} alt={`Photo ${i + 1}`} className="aspect-square w-full rounded-md border border-border object-cover" />
                    {i === 0 && <span className="absolute bottom-1 left-1 rounded bg-foreground/75 px-1.5 py-0.5 text-[10px] text-background">Principale</span>}
                    <Button type="button" variant="destructive" size="icon" className="absolute right-1 top-1 size-7" disabled={busy} aria-label={`Retirer la photo ${i + 1}`}
                      onClick={() => setForm({ ...form, images: form.images.filter((_, j) => j !== i) })}><Trash2 /></Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <details className="mb-6 text-sm">
            <summary className="cursor-pointer font-medium">Coordonnées publiques (facultatif)</summary>
            <div className="mt-3 grid gap-x-6 sm:grid-cols-2">
              <label className="mb-3 block">Téléphone affiché<input className="form-input mt-2" maxLength={25} inputMode="tel" value={form.contact_phone} onChange={e => setForm({ ...form, contact_phone: e.target.value })} /></label>
              <label className="mb-3 block">Email affiché<input className="form-input mt-2" type="email" maxLength={200} value={form.contact_email} onChange={e => setForm({ ...form, contact_email: e.target.value })} /></label>
            </div>
          </details>

          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={busy}><Send />{busy ? 'Enregistrement…' : 'Soumettre pour publication'}</Button>
            <Button type="button" variant="outline" disabled={busy} onClick={() => void submit(true)}><Save />Enregistrer le brouillon</Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Une annonce soumise ou modifiée passe en validation avant d’être visible publiquement.</p>
        </form>
      ) : (
        <>
          <div role="tablist" aria-label="Statut des annonces" className="mb-6 flex flex-wrap gap-2 border-b border-border pb-3">
            {tabs.map(t => (
              <Button key={t.id} role="tab" aria-selected={tab === t.id} size="sm" variant={tab === t.id ? 'default' : 'outline'} onClick={() => setTab(t.id)}>
                {t.label} <span className="ml-1 rounded-full bg-background/60 px-1.5 text-xs">{groups[t.id].length}</span>
              </Button>
            ))}
          </div>
          {loading ? <p role="status">Chargement de vos annonces…</p> : shown.length === 0 ? (
            <div className="empty-state"><Megaphone className="mx-auto mb-4 size-10" /><p className="mb-4">Aucune annonce dans « {tabs.find(t => t.id === tab)?.label} ».</p>
              <Button onClick={() => { setForm(emptyAnnouncement()); setEditId(undefined) }}><Plus />Créer une annonce</Button></div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map(a => {
                const photo = productImageUrl(a.image ?? a.images?.[0])
                return (
                  <article key={a.id} className="overflow-hidden rounded-md border border-border bg-card">
                    <div className="relative aspect-[4/3] bg-muted">
                      {photo ? <img src={photo} alt={a.title} className="size-full object-cover" loading="lazy" /> :
                        <div className="flex size-full items-center justify-center text-muted-foreground"><Megaphone className="size-10" /></div>}
                      <span className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-semibold ${badge[a.status]}`}>{statusLabels[a.status]}</span>
                      {(a.images?.length ?? 0) > 1 && <span className="absolute bottom-3 right-3 rounded bg-foreground/75 px-2 py-0.5 text-xs text-background">{a.images?.length} photos</span>}
                    </div>
                    <div className="p-4">
                      <h2 className="line-clamp-2 text-lg">{a.title}</h2>
                      <p className="mt-1 text-sm"><span className="price">{a.price != null ? formatMoney(a.price) : 'Prix sur demande'}</span>{a.negotiable && <span className="ml-2 text-xs text-muted-foreground">Négociable</span>}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{[a.city, a.location].filter(Boolean).join(' · ') || 'Lieu non précisé'}</p>
                      <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground"><Eye className="size-3.5" />{a.views ?? 0} vue{(a.views ?? 0) > 1 ? 's' : ''}</p>
                      <div className="mt-4 flex gap-2">
                        {a.status === 'published' && <Button size="sm" variant="outline" asChild><Link to="/annonce/$id" params={{ id: a.id }}>Voir</Link></Button>}
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => edit(a)} aria-label={`Modifier ${a.title}`}><Pencil />Modifier</Button>
                        <Button size="icon" variant="outline" className="size-8" disabled={busy} onClick={() => setDeleting(a)} aria-label={`Supprimer ${a.title}`}><Trash2 /></Button>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </>
      )}

      <AlertDialog open={!!deleting} onOpenChange={open => { if (!open) setDeleting(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette annonce ?</AlertDialogTitle>
            <AlertDialogDescription>« {deleting?.title} » et ses {deleting?.images?.length ?? 0} photo(s) seront définitivement supprimées.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Annuler</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={async () => {
              if (!deleting) return
              setBusy(true)
              try {
                const r = await remove({ data: { id: deleting.id } })
                if (r.error) setError(r.error)
                else { setNotice('Annonce supprimée.'); await load(); await cache.invalidateQueries({ queryKey: ['d1-catalog'] }) }
              } finally { setBusy(false); setDeleting(null) }
            }}>Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  )
}
