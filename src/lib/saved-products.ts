import { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import type { Product } from '@/lib/catalog'

// Fiches produit enregistrées par les vendeurs via le générateur IA.
export function useSavedProducts(): Product[] {
  const [items, setItems] = useState<Product[]>([])
  useEffect(() => {
    let active = true
    supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (!active || !data) return
        setItems(data.map(row => ({
          id: row.id,
          name: row.title,
          price: row.price,
          oldPrice: 0,
          discount: 0,
          image: row.image_data,
          category: row.category,
          store: 'Marketplace',
          rating: '—',
          stock: 1,
        })))
      })
    return () => { active = false }
  }, [])
  return items
}
