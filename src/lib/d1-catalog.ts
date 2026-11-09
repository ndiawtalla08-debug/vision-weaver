import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { readD1Catalog } from './d1.functions'
import type { Product, Shop } from './catalog'
import { productImageUrl } from './api-client'

export const d1CatalogOptions = queryOptions({ queryKey: ['d1-catalog'], queryFn: () => readD1Catalog(), staleTime: 60000 })
export function useD1Catalog() {
  const query = useSuspenseQuery(d1CatalogOptions)
  const { catalog, error } = query.data
  const products: Product[] = catalog.products.map(p => ({ id: p.id, storeId: p.store_id, name: p.name, description: p.description ?? '', price: p.price, oldPrice: p.old_price ?? 0, discount: p.old_price && p.old_price > p.price ? Math.round((1 - p.price / p.old_price) * 100) : 0, stock: p.stock, image: p.image ?? '', category: catalog.categories.find(c => c.id === p.category_id)?.name ?? '', store: catalog.stores.find(s => s.id === p.store_id)?.name ?? '', rating: '—' }))
  const shops: Shop[] = catalog.stores.map(s => ({ id: s.id, name: s.name, category: '', subtitle: s.description ?? '', image: s.logo_url ?? '', rating: '—', count: 0 }))
  const announcements = catalog.announcements.map(a => ({ ...a, image: productImageUrl(a.image), images: (a.images ?? []).map(image => productImageUrl(image)) }))
  return { products, shops, categories: catalog.categories, announcements, error, refreshing: query.isFetching, retry: () => query.refetch() }
}