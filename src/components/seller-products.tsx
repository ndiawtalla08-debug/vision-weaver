import { useEffect, useState } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Package, Pencil, Plus, Save, Trash2, X } from 'lucide-react'
import { Button } from './ui/button'
import { useMarket } from '@/lib/market-context'
import { useD1Catalog } from '@/lib/d1-catalog'
import { readSellerStores, readSellerProducts, saveSellerProduct, deleteSellerProduct } from '@/lib/d1-products.functions'
import { productInput, type ProductInput, type SellerProduct, type SellerStore } from '@/lib/d1-products-schema'
import { formatMoney } from '@/lib/catalog'

const empty = (store_id: string): ProductInput => ({ store_id, category_id: null, name: '', description: '', price: 0, old_price: null, stock: 0, status: 'draft', image: '' })
export function SellerProducts() {
  const { favoriteState } = useMarket(); const { categories } = useD1Catalog(); const cache = useQueryClient()
  const getStores = useServerFn(readSellerStores); const getProducts = useServerFn(readSellerProducts)
  const save = useServerFn(saveSellerProduct); const remove = useServerFn(deleteSellerProduct)
  const [stores,setStores] = useState<SellerStore[]>([]); const [storeId,setStoreId] = useState('')
  const [products,setProducts] = useState<SellerProduct[]>([]); const [loading,setLoading] = useState(true)
  const [busy,setBusy] = useState(false); const [error,setError] = useState<string|null>(null); const [notice,setNotice] = useState('')
  const [form,setForm] = useState<ProductInput|null>(null); const [editId,setEditId] = useState<string|undefined>()
  const [deleting,setDeleting] = useState<SellerProduct|null>(null)
  useEffect(() => {
    let active = true; setStores([]); setProducts([]); setStoreId(''); setForm(null)
    if (!favoriteState.user) { setLoading(false); return }
    setLoading(true)
    void getStores().then(r => { if (active) { setStores(r.stores); setStoreId(r.stores[0]?.id ?? ''); setError(r.error) } }).catch(() => { if (active) setError('Impossible de charger vos boutiques.') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [favoriteState.user?.id])
  useEffect(() => {
    let active = true; setProducts([]); setForm(null); setDeleting(null)
    if (!storeId) return
    setLoading(true)
    void getProducts({ data: { store_id: storeId } }).then(r => { if (active) { setProducts(r.products); setError(r.error) } }).catch(() => { if (active) setError('Impossible de charger vos produits.') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [storeId])
  async function refresh() {
    const r = await getProducts({ data: { store_id: storeId } }); setProducts(r.products); setError(r.error)
    await cache.invalidateQueries({ queryKey: ['d1-catalog'] }); await cache.invalidateQueries({ queryKey: ['d1-store-products',storeId] })
  }
  async function photo(file?: File) {
    if (!file) return
    if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 500000) { setError('Choisissez une photo JPG, PNG ou WebP de 500 Ko maximum.'); return }
    setBusy(true)
    try {
      const value = await new Promise<string>((resolve,reject) => { const reader = new FileReader(); reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(); reader.onerror = reject; reader.readAsDataURL(file) })
      setForm(f => f ? {...f,image:value} : f); setError(null)
    } catch { setError('Impossible de lire cette photo.') } finally { setBusy(false) }
  }
  return <main className="container-site page-main"><div className="section-heading"><h1>Mes produits</h1>{favoriteState.user && storeId && !error && <Button disabled={busy || loading || stores.find(s => s.id === storeId)?.status === 'suspended'} onClick={() => {setEditId(undefined);setForm(empty(storeId));setNotice('')}}><Plus/>Ajouter un produit</Button>}</div>
    {!favoriteState.user ? <Button asChild><Link to="/mon-compte">Me connecter</Link></Button> : <>
      {stores.length > 0 && <label className="my-5 block max-w-lg text-sm">Ma boutique<select className="form-input mt-2" disabled={busy} value={storeId} onChange={e => {setStoreId(e.target.value);setNotice('')}}>{stores.map(s => <option key={s.id} value={s.id}>{s.name}{s.status === 'pending' ? ' — en attente' : s.status === 'suspended' ? ' — suspendue' : ''}</option>)}</select></label>}
      {loading ? <p role="status">Chargement des produits…</p> : !stores.length && !error ? <p className="my-5 text-muted-foreground">Aucune boutique associée à votre compte.</p> : null}
      {error && <p className="notice my-5" role="alert">{error}</p>}{notice && <p className="notice my-5" role="status">{notice}</p>}
      {form && <form className="mb-10 max-w-2xl border-b border-border pb-8" onSubmit={async e => {e.preventDefault();setError(null);setNotice('');const parsed = productInput.safeParse(form);if (!parsed.success) {setError('Vérifiez les champs et la photo du produit.');return}setBusy(true);try {const r = await save({data:{id:editId,product:parsed.data}});if (r.error) setError(r.error);else {setForm(null);await refresh();setNotice('Produit enregistré dans votre boutique.')}}catch {setError('Enregistrement non confirmé. Rechargez vos produits avant de réessayer.')}finally {setBusy(false)}}}>
        <div className="mb-5 flex items-center justify-between"><h2 className="text-2xl">{editId ? 'Modifier le produit' : 'Nouveau produit'}</h2><Button type="button" variant="ghost" size="icon" aria-label="Fermer le formulaire" disabled={busy} onClick={() => setForm(null)}><X/></Button></div>
        <label className="mb-4 block text-sm">Photo<input type="file" accept="image/jpeg,image/png,image/webp" className="form-input mt-2" disabled={busy} onChange={e => void photo(e.target.files?.[0])}/></label>
        {form.image && <div className="mb-5 flex items-center gap-3"><img src={form.image} alt="Photo du produit" className="size-24 rounded object-cover"/><Button type="button" variant="outline" size="icon" aria-label="Retirer la photo" onClick={() => setForm({...form,image:''})}><Trash2/></Button></div>}
        <label className="mb-4 block text-sm">Nom<input className="form-input mt-2" required maxLength={120} value={form.name} onChange={e => setForm({...form,name:e.target.value})}/></label>
        <label className="mb-4 block text-sm">Description<textarea className="form-input mt-2 min-h-28" maxLength={5000} value={form.description} onChange={e => setForm({...form,description:e.target.value})}/></label>
        <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm">Prix (FCFA)<input type="number" className="form-input mt-2" min={0} step={1} required value={form.price} onChange={e => setForm({...form,price:Number(e.target.value)})}/></label><label className="block text-sm">Ancien prix (FCFA)<input type="number" className="form-input mt-2" min={0} step={1} value={form.old_price ?? ''} onChange={e => setForm({...form,old_price:e.target.value === '' ? null : Number(e.target.value)})}/></label><label className="block text-sm">Quantité disponible<input type="number" className="form-input mt-2" min={0} step={1} required value={form.stock} onChange={e => setForm({...form,stock:Number(e.target.value)})}/></label><label className="block text-sm">Catégorie<select className="form-input mt-2" value={form.category_id ?? ''} onChange={e => setForm({...form,category_id:e.target.value || null})}><option value="">Sans catégorie</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label></div>
        <fieldset className="my-5 flex flex-wrap gap-5"><legend className="mb-2 text-sm">Statut</legend>{(['draft','published'] as const).map(s => <label key={s} className="flex items-center gap-2 text-sm"><input type="radio" name="status" checked={form.status === s} onChange={() => setForm({...form,status:s})}/>{s === 'draft' ? 'Brouillon' : 'Publié'}</label>)}</fieldset>
        <Button type="submit" disabled={busy}><Save/>{busy ? 'Enregistrement…' : 'Enregistrer le produit'}</Button>
      </form>}
      {!loading && storeId && !error && !products.length && <p className="my-6 text-muted-foreground">Aucun produit dans cette boutique.</p>}
      <div className="products-grid">{products.map(p => <article className="product-card" key={p.id}><div className="product-image">{p.image ? <img src={p.image} alt={p.name} width={512} height={512}/> : <Package className="m-auto size-16 text-muted-foreground"/>}</div><div className="product-info"><p className="mb-2 text-xs text-muted-foreground">{p.status === 'draft' ? 'Brouillon' : p.status === 'published' ? 'Publié' : 'Archivé'}</p><h2 className="text-xl">{p.name}</h2><span className="price">{formatMoney(p.price)}</span>{p.old_price != null && <span className="old-price">{formatMoney(p.old_price)}</span>}<p className="my-3 whitespace-pre-wrap text-sm">{p.description}</p><p className="text-sm text-muted-foreground">{p.stock > 0 ? `${p.stock} disponibles` : 'Rupture de stock'}</p><div className="mt-4 flex gap-2"><Button variant="outline" size="icon" disabled={busy} aria-label={`Modifier ${p.name}`} onClick={() => {setEditId(p.id);setForm({store_id:p.store_id,category_id:p.category_id ?? null,name:p.name,description:p.description ?? '',price:p.price,old_price:p.old_price ?? null,stock:p.stock,status:p.status === 'published' ? 'published' : 'draft',image:p.image ?? ''});setNotice('')}}><Pencil/></Button><Button variant="outline" size="icon" disabled={busy} aria-label={`Supprimer ${p.name}`} onClick={() => setDeleting(p)}><Trash2/></Button></div>{deleting?.id === p.id && <div className="mt-4"><p className="mb-3 text-sm">Supprimer définitivement ce produit ?</p><div className="flex flex-wrap gap-2"><Button variant="destructive" disabled={busy} onClick={async () => {setBusy(true);setError(null);try {const r = await remove({data:{id:p.id,store_id:p.store_id}});if(r.error)setError(r.error);else {setDeleting(null);if(editId === p.id)setForm(null);await refresh();setNotice('Produit supprimé.')}}catch {setError('Suppression non confirmée. Rechargez vos produits.')}finally {setBusy(false)}}}>Supprimer</Button><Button variant="outline" disabled={busy} onClick={() => setDeleting(null)}>Annuler</Button></div></div>}</div></article>)}</div>
    </>}
  </main>
}