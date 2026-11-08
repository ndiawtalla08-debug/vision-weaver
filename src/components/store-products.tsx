import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { readStoreProducts } from '@/lib/d1-products.functions'
import { useD1Catalog } from '@/lib/d1-catalog'
import { ProductCard } from './marketplace'
import { Button } from './ui/button'
import type { Product } from '@/lib/catalog'

export const storeProductsOptions = (store_id: string) => queryOptions({ queryKey: ['d1-store-products',store_id], queryFn: () => readStoreProducts({data:{store_id}}), staleTime: 30000 })
export function StoreProducts({ storeId, storeName, promotions }: { storeId: string; storeName: string; promotions: boolean }) {
  const query = useSuspenseQuery(storeProductsOptions(storeId)); const { categories } = useD1Catalog()
  const products: Product[] = query.data.products.map(p => ({ id:p.id,storeId:p.store_id,store:storeName,name:p.name,description:p.description ?? '',price:p.price,oldPrice:p.old_price ?? 0,discount:p.old_price && p.old_price > p.price ? Math.round((1-p.price/p.old_price)*100) : 0,stock:p.stock,image:p.image ?? '',category:categories.find(c => c.id === p.category_id)?.name ?? '',rating:'—' }))
  const visible = products.filter(p => !promotions || p.discount > 0)
  return <>{query.data.error ? <div role="alert" className="notice">{query.data.error}<Button variant="outline" className="ml-3" onClick={() => void query.refetch()}>Réessayer</Button></div> : !visible.length ? <p className="py-6 text-muted-foreground">{promotions ? 'Aucune promotion publiée.' : 'Aucun produit publié dans cette boutique.'}</p> : <div className="products-grid">{visible.map(p => <ProductCard key={p.id} product={p} showDescription/>)}</div>}</>
}