import { useMemo } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { Search, X } from 'lucide-react'
import { Button } from './ui/button'
import { ShopCard } from './marketplace'
import { useMarket } from '@/lib/market-context'
import { buildDirectory, filterDirectory, type ShopSort } from '@/lib/store-directory'

export function StoreDirectory({ q, setQ }: { q: string; setQ: (v: string) => void }) {
  const { products, shops } = useMarket()
  const search = useSearch({ from: '/boutiques' })
  const navigate = useNavigate({ from: '/boutiques' })
  const category = search.categorie ?? ''
  const name = search.nom ?? ''
  const sort: ShopSort = search.tri === 'nom' ? 'name' : 'products'
  // Filters live in the URL so a precise view can be shared; typing replaces history.
  const update = (patch: { nom?: string | undefined; categorie?: string | undefined; tri?: 'nom' | undefined }) => void navigate({ search: prev => ({ ...prev, ...patch }) as never, replace: true, resetScroll: false })
  const setCategory = (c: string) => update({ categorie: c || undefined })
  const setSort = (s: ShopSort) => update({ tri: s === 'name' ? 'nom' : undefined })
  const all = useMemo(() => buildDirectory(shops, products), [shops, products])
  const cats = useMemo(() => [...new Set(all.flatMap(s => s.categories))].sort((a, b) => a.localeCompare(b, 'fr')), [all])
  const list = filterDirectory(all, q, category, sort, name)
  const reset = () => { setQ(''); update({ nom: undefined, categorie: undefined }) }
  return <section aria-label="Annuaire des boutiques">
    <div className="mb-4 flex max-w-md gap-2"><input className="form-input" type="search" placeholder="Nom de la boutique…" aria-label="Rechercher une boutique par son nom" value={name} onChange={e => update({ nom: e.target.value.slice(0, 100) || undefined })}/></div>
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <Button size="sm" variant={category ? 'outline' : 'default'} onClick={() => setCategory('')}>Toutes</Button>
      {cats.map(c => <Button key={c} size="sm" variant={category === c ? 'default' : 'outline'} aria-pressed={category === c} onClick={() => setCategory(category === c ? '' : c)}>{c}</Button>)}
      <label className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">Trier
        <select className="form-input w-auto py-1" aria-label="Trier les boutiques" value={sort} onChange={e => setSort(e.target.value as ShopSort)}><option value="products">Plus de produits</option><option value="name">Nom (A–Z)</option></select>
      </label>
    </div>
    <p className="mb-5 text-sm text-muted-foreground" role="status">{list.length} boutique{list.length > 1 ? 's' : ''} sur {all.length}</p>
    {!!all.length && !list.length && <div className="mb-8 flex flex-wrap items-center gap-3 text-muted-foreground"><Search className="size-4"/>Aucune boutique ne correspond à votre recherche.<Button size="sm" variant="outline" onClick={reset}><X/>Effacer les filtres</Button></div>}
    <div className="shops-grid">{list.map(shop => <div key={shop.id}><ShopCard shop={shop}/><p className="mt-2 text-xs text-muted-foreground">{shop.productCount} produit{shop.productCount > 1 ? 's' : ''} publié{shop.productCount > 1 ? 's' : ''}</p></div>)}</div>
  </section>
}
