import type { Product, Shop } from './catalog'

export type DirectoryShop = Shop & { productCount: number; categories: string[] }
export type ShopSort = 'products' | 'name'

/** Enriches published stores with their real published product count and categories. */
export function buildDirectory(shops: Shop[], products: Product[]): DirectoryShop[] {
  return shops.map(shop => {
    const own = products.filter(p => p.storeId ? p.storeId === shop.id : p.store === shop.name)
    const categories = [...new Set(own.map(p => p.category).filter(Boolean))]
    return { ...shop, productCount: own.length, categories, category: shop.category || categories.join(' · ') }
  })
}
export function filterDirectory(list: DirectoryShop[], q: string, category: string, sort: ShopSort, name = '') {
  const t = q.trim().toLowerCase()
  const n = name.trim().toLowerCase()
  return list
    .filter(s => !t || `${s.name} ${s.category} ${s.subtitle}`.toLowerCase().includes(t))
    .filter(s => !n || s.name.toLowerCase().includes(n))
    .filter(s => !category || s.categories.includes(category))
    .sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name, 'fr') : b.productCount - a.productCount || a.name.localeCompare(b.name, 'fr'))
}
