import { createContext, useContext } from 'react'
import type { useD1Favorites } from '@/hooks/use-d1-favorites'
import type { CartItem, Product, Shop } from './catalog'

export type MarketState = {
  favoriteState: ReturnType<typeof useD1Favorites>
  products: Product[]
  shops: Shop[]
  cart: CartItem[]
  favorites: string[]
  add: (product: Product, quantity?: number, size?: string, color?: string) => void
  toggle: (id: string) => void
  update: (index: number, quantity: number) => void
  remove: (index: number) => void
  openProduct: (product: Product) => void
  notify: (text: string) => void
}

// Context identity must not change when the UI module is hot-reloaded.
export const MarketContext = createContext<MarketState | null>(null)
export function useMarket() {
  const value = useContext(MarketContext)
  if (!value) throw new Error('Marketplace provider missing')
  return value
}