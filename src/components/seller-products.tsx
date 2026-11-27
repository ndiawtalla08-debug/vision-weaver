import { useEffect, useState } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Package, Pencil, Plus, Save, Trash2, X } from 'lucide-react'
import { Button } from './ui/button'
import { useMarket } from '@/lib/market-context'
import { useD1Catalog } from '@/lib/d1-catalog'
import {
  readSellerStores,
  readSellerProducts,
  saveSellerProduct,
  deleteSellerProduct,
} from '@/lib/d1-products.functions'
import {
  productInput,
  type ProductInput,
  type SellerProduct,
  type SellerStore,
} from '@/lib/d1-products-schema'
import { formatMoney } from '@/lib/catalog'

const empty = (store_id: string): ProductInput => ({
  store_id,
  category_id: null,
  name: '',
  description: '',
  price: 0,
  old_price: null,
  stock: 0,
  status: 'draft',
  image: '',
  images: [],
})

export function SellerProducts() {
  const { favoriteState } = useMarket()
  const { categories } = useD1Catalog()
  const cache = useQueryClient()

  const getStores = useServerFn(readSellerStores)
  const getProducts = useServerFn(readSellerProducts)
  const save = useServerFn(saveSellerProduct)
  const remove = useServerFn(deleteSellerProduct)

  const [stores, setStores] = useState<SellerStore[]>([])
  const [storeId, setStoreId] = useState('')
  const [products, setProducts] = useState<SellerProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [form, setForm] = useState<ProductInput | null>(null)
  const [editId, setEditId] = useState<string | undefined>()
  const [deleting, setDeleting] = useState<SellerProduct | null>(null)

  useEffect(() => {
    let active = true

    setStores([])
    setProducts([])
    setStoreId('')
    setForm(null)

    if (!favoriteState.user) {
      setLoading(false)
      return
    }

    setLoading(true)

    void getStores()
      .then(r => {
        if (active) {
          setStores(r.stores)
          setStoreId(r.stores[0]?.id ?? '')
          setError(r.error)
        }
      })
      .catch(() => {
        if (active) setError('Impossible de charger vos boutiques.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [favoriteState.user?.id])

  useEffect(() => {
    let active = true

    setProducts([])
    setForm(null)
    setDeleting(null)

    if (!storeId) return

    setLoading(true)

    void getProducts({ data: { store_id: storeId } })
      .then(r => {
        if (active) {
          setProducts(r.products)
          setError(r.error)
        }
      })
      .catch(() => {
        if (active) setError('Impossible de charger vos produits.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [storeId])

  async function refresh() {
    const r = await getProducts({ data: { store_id: storeId } })

    setProducts(r.products)
    setError(r.error)

    await cache.invalidateQueries({ queryKey: ['d1-catalog'] })
    await cache.invalidateQueries({
      queryKey: ['d1-store-products', storeId],
    })
  }

  // Ajouter plusieurs photos en une seule sélection
  async function photos(files: File[]) {
    if (!files.length || !form) return

    const remaining = 5 - (form.images?.length ?? 0)
    if (remaining <= 0) {
      setError('5 photos maximum pour un produit.')
      return
    }

    const selected = files.slice(0, remaining)
    if (files.length > remaining) {
      setError(`Vous ne pouvez ajouter que ${remaining} photo(s) supplémentaire(s).`)
    }

    const validFiles = selected.filter(file =>
      ['image/jpeg', 'image/png', 'image/webp'].includes(file.type),
    )
    const ignored = selected.length - validFiles.length
    if (!validFiles.length) {
      setError('Format accepté : JPG, PNG ou WebP.')
      return
    }

    setBusy(true)
    try {
      // Les photos de téléphone (souvent plusieurs Mo) sont réduites dans le
      // navigateur au lieu d'être ignorées en silence.
      const values = await Promise.all(validFiles.map(compressPhoto))
      setForm(current =>
        current
          ? {
              ...current,
              images: [...(current.images ?? []), ...values].slice(0, 5),
              image: current.images?.[0] ?? values[0] ?? '',
            }
          : current,
      )
      setError(
        ignored
          ? `${ignored} photo(s) ignorée(s) : format accepté JPG, PNG ou WebP.`
          : files.length > remaining
            ? `Vous ne pouvez ajouter que ${remaining} photo(s) supplémentaire(s).`
            : null,
      )
    } catch {
      setError('Impossible de lire une ou plusieurs photos.')
    } finally {
      setBusy(false)
    }
  }

  // Supprimer une photo de la galerie
  function removePhoto(index: number) {
    if (!form) return

    const updatedImages = (form.images ?? []).filter(
      (_, i) => i !== index,
    )

    setForm({
      ...form,
      images: updatedImages,
      image: updatedImages[0] ?? '',
    })
  }

  return (
    <main className="container-site page-main">
      <div className="section-heading">
        <h1>Mes produits</h1>

        {favoriteState.user && storeId && !error && (
          <Button
            disabled={
              busy ||
              loading ||
              stores.find(s => s.id === storeId)?.status === 'suspended'
            }
            onClick={() => {
              setEditId(undefined)
              setForm(empty(storeId))
              setNotice('')
              setError(null)
            }}
          >
            <Plus />
            Ajouter un produit
          </Button>
        )}
      </div>

      {!favoriteState.user ? (
        <Button asChild>
          <Link to="/mon-compte">Me connecter</Link>
        </Button>
      ) : (
        <>
          {stores.length > 0 && (
            <label className="my-5 block max-w-lg text-sm">
              Ma boutique
              <select
                className="form-input mt-2"
                disabled={busy}
                value={storeId}
                onChange={e => {
                  setStoreId(e.target.value)
                  setNotice('')
                }}
              >
                {stores.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.status === 'pending'
                      ? ' — en attente'
                      : s.status === 'suspended'
                        ? ' — suspendue'
                        : ''}
                  </option>
                ))}
              </select>
            </label>
          )}

          {loading ? (
            <p role="status">Chargement des produits…</p>
          ) : !stores.length && !error ? (
            <p className="my-5 text-muted-foreground">
              Aucune boutique associée à votre compte.
            </p>
          ) : null}

          {error && (
            <p className="notice my-5" role="alert">
              {error}
            </p>
          )}

          {notice && (
            <p className="notice my-5" role="status">
              {notice}
            </p>
          )}

          {form && (
            <form
              className="mb-10 max-w-2xl border-b border-border pb-8"
              onSubmit={async e => {
                e.preventDefault()
                setError(null)
                setNotice('')

                const parsed = productInput.safeParse(form)

                if (!parsed.success) {
                  setError('Vérifiez les champs et les photos du produit.')
                  return
                }

                setBusy(true)

                try {
                  const r = await save({
                    data: {
                      id: editId,
                      product: {
                        ...parsed.data,
                        image: parsed.data.images?.[0] ?? '',
                      },
                    },
                  })

                  if (r.error) {
                    setError(r.error)
                  } else {
                    setForm(null)
                    await refresh()
                    setNotice('Produit enregistré dans votre boutique.')
                  }
                } catch {
                  setError(
                    'Enregistrement non confirmé. Rechargez vos produits avant de réessayer.',
                  )
                } finally {
                  setBusy(false)
                }
              }}
            >
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-2xl">
                  {editId ? 'Modifier le produit' : 'Nouveau produit'}
                </h2>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Fermer le formulaire"
                  disabled={busy}
                  onClick={() => setForm(null)}
                >
                  <X />
                </Button>
              </div>

              {/* Galerie de photos */}
              <div className="mb-5">
                <label className="mb-2 block text-sm font-medium">
                  Photos du produit (5 maximum)
                </label>

                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="form-input"
                  disabled={busy || (form.images?.length ?? 0) >= 5}
                  onChange={e => {
                    const files = Array.from(e.currentTarget.files ?? [])
                    e.currentTarget.value = ''
                    void photos(files)
                  }}
                />

                <p className="mt-2 text-sm text-muted-foreground">
                  JPG, PNG ou WebP — 500 Ko maximum par photo.
                  {(form.images?.length ?? 0)} / 5 photos
                </p>
              </div>

              {/* Aperçu et suppression */}
              {(form.images?.length ?? 0) > 0 && (
                <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {(form.images ?? []).map((img, index) => (
                    <div
                      key={`${index}-${img.slice(0, 30)}`}
                      className="relative"
                    >
                      <img
                        src={img}
                        alt={`Photo ${index + 1}`}
                        className="aspect-square w-full rounded-lg border object-cover"
                      />

                      {index === 0 && (
                        <span className="absolute bottom-2 left-2 rounded bg-black/70 px-2 py-1 text-xs text-white">
                          Photo principale
                        </span>
                      )}

                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute right-2 top-2"
                        disabled={busy}
                        aria-label={`Supprimer la photo ${index + 1}`}
                        onClick={() => removePhoto(index)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <label className="mb-4 block text-sm">
                Nom
                <input
                  className="form-input mt-2"
                  required
                  maxLength={120}
                  value={form.name}
                  onChange={e =>
                    setForm({ ...form, name: e.target.value })
                  }
                />
              </label>

              <label className="mb-4 block text-sm">
                Description
                <textarea
                  className="form-input mt-2 min-h-28"
                  maxLength={5000}
                  value={form.description}
                  onChange={e =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm">
                  Prix (FCFA)
                  <input
                    type="number"
                    className="form-input mt-2"
                    min={0}
                    step={1}
                    required
                    value={form.price}
                    onChange={e =>
                      setForm({ ...form, price: Number(e.target.value) })
                    }
                  />
                </label>

                <label className="block text-sm">
                  Ancien prix (FCFA)
                  <input
                    type="number"
                    className="form-input mt-2"
                    min={0}
                    step={1}
                    value={form.old_price ?? ''}
                    onChange={e =>
                      setForm({
                        ...form,
                        old_price:
                          e.target.value === ''
                            ? null
                            : Number(e.target.value),
                      })
                    }
                  />
                </label>

                <label className="block text-sm">
                  Quantité disponible
                  <input
                    type="number"
                    className="form-input mt-2"
                    min={0}
                    step={1}
                    required
                    value={form.stock}
                    onChange={e =>
                      setForm({ ...form, stock: Number(e.target.value) })
                    }
                  />
                </label>

                <label className="block text-sm">
                  Catégorie
                  <select
                    className="form-input mt-2"
                    value={form.category_id ?? ''}
                    onChange={e =>
                      setForm({
                        ...form,
                        category_id: e.target.value || null,
                      })
                    }
                  >
                    <option value="">Sans catégorie</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <fieldset className="my-5 flex flex-wrap gap-5">
                <legend className="mb-2 text-sm">Statut</legend>

                {(['draft', 'published'] as const).map(s => (
                  <label
                    key={s}
                    className="flex items-center gap-2 text-sm"
                  >
                    <input
                      type="radio"
                      name="status"
                      checked={form.status === s}
                      onChange={() => setForm({ ...form, status: s })}
                    />

                    {s === 'draft' ? 'Brouillon' : 'Publié'}
                  </label>
                ))}
              </fieldset>

              <Button type="submit" disabled={busy}>
                <Save />
                {busy ? 'Enregistrement…' : 'Enregistrer le produit'}
              </Button>
            </form>
          )}

          {!loading && storeId && !error && !products.length && (
            <p className="my-6 text-muted-foreground">
              Aucun produit dans cette boutique.
            </p>
          )}

          {/* Liste des produits */}
          <div className="products-grid">
            {products.map(p => (
              <article className="product-card" key={p.id}>
                <div className="product-image">
                  {p.image ? (
                    <img
                      src={p.image}
                      alt={p.name}
                      width={512}
                      height={512}
                    />
                  ) : (
                    <Package className="m-auto size-16 text-muted-foreground" />
                  )}
                </div>

                <div className="product-info">
                  <p className="mb-2 text-xs text-muted-foreground">
                    {p.status === 'draft'
                      ? 'Brouillon'
                      : p.status === 'published'
                        ? 'Publié'
                        : 'Archivé'}
                  </p>

                  <h2 className="text-xl">{p.name}</h2>

                  <span className="price">{formatMoney(p.price)}</span>

                  {p.old_price != null && (
                    <span className="old-price">
                      {formatMoney(p.old_price)}
                    </span>
                  )}

                  <p className="my-3 whitespace-pre-wrap text-sm">
                    {p.description}
                  </p>

                  <p className="text-sm text-muted-foreground">
                    {p.stock > 0
                      ? `${p.stock} disponibles`
                      : 'Rupture de stock'}
                  </p>

                  <div className="mt-4 flex gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      disabled={busy}
                      aria-label={`Modifier ${p.name}`}
                      onClick={() => {
                        setEditId(p.id)

                        const gallery =
                          p.images?.length
                            ? p.images
                            : p.image
                              ? [p.image]
                              : []

                        setForm({
                          store_id: p.store_id,
                          category_id: p.category_id ?? null,
                          name: p.name,
                          description: p.description ?? '',
                          price: p.price,
                          old_price: p.old_price ?? null,
                          stock: p.stock,
                          status:
                            p.status === 'published'
                              ? 'published'
                              : 'draft',
                          image: gallery[0] ?? '',
                          images: gallery,
                        })

                        setNotice('')
                        setError(null)
                      }}
                    >
                      <Pencil />
                    </Button>

                    <Button
                      variant="outline"
                      size="icon"
                      disabled={busy}
                      aria-label={`Supprimer ${p.name}`}
                      onClick={() => setDeleting(p)}
                    >
                      <Trash2 />
                    </Button>
                  </div>

                  {deleting?.id === p.id && (
                    <div className="mt-4">
                      <p className="mb-3 text-sm">
                        Supprimer définitivement ce produit ?
                      </p>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="destructive"
                          disabled={busy}
                          onClick={async () => {
                            setBusy(true)
                            setError(null)

                            try {
                              const r = await remove({
                                data: {
                                  id: p.id,
                                  store_id: p.store_id,
                                },
                              })

                              if (r.error) {
                                setError(r.error)
                              } else {
                                setDeleting(null)

                                if (editId === p.id) setForm(null)

                                await refresh()
                                setNotice('Produit supprimé.')
                              }
                            } catch {
                              setError(
                                'Suppression non confirmée. Rechargez vos produits.',
                              )
                            } finally {
                              setBusy(false)
                            }
                          }}
                        >
                          Supprimer
                        </Button>

                        <Button
                          variant="outline"
                          disabled={busy}
                          onClick={() => setDeleting(null)}
                        >
                          Annuler
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </main>
  )
}

const readDataUrl = (file: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => (typeof reader.result === 'string' ? resolve(reader.result) : reject())
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

/** Photo ≤ 500 Ko gardée telle quelle ; sinon réduite (1600 px max, JPEG). */
export async function compressPhoto(file: File): Promise<string> {
  if (file.size <= 500_000) return readDataUrl(file)
  const bitmap = await createImageBitmap(file)
  for (const [max, quality] of [[1600, 0.82], [1200, 0.75], [900, 0.7]] as const) {
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', quality))
    if (blob && blob.size <= 1_500_000) return readDataUrl(blob)
  }
  throw new Error('Photo trop volumineuse')
}
