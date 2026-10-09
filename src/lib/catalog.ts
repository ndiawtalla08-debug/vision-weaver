import pinkDress from '@/assets/pink-dress.jpg'
import handbag from '@/assets/handbag.jpg'
import perfume from '@/assets/perfume.jpg'
import blackDress from '@/assets/black-dress.jpg'
import blackBag from '@/assets/black-bag.jpg'
import phone from '@/assets/phone.jpg'

export const products = [
  { id: 'robe-elegante', name: 'Robe élégante', price: 25000, oldPrice: 30000, discount: 17, image: blackDress, category: 'Mode', store: 'SO FAB CLOSET', rating: '4,8', stock: 12 },
  { id: 'sac-luxe', name: 'Sac à main luxe', price: 35000, oldPrice: 0, discount: 0, image: handbag, category: 'Mode', store: 'SO FAB CLOSET', rating: '4,9', stock: 8 },
  { id: 'parfum-femme', name: 'Parfum femme', price: 20000, oldPrice: 0, discount: 0, image: perfume, category: 'Beauté', store: 'TOUBA ESSENCE', rating: '4,7', stock: 15 },
  { id: 'robe-rose', name: 'Robe rose poudré', price: 18000, oldPrice: 0, discount: 0, image: pinkDress, category: 'Mode', store: 'SO FAB CLOSET', rating: '4,8', stock: 9 },
  { id: 'sac-bandouliere', name: 'Sac bandoulière', price: 22000, oldPrice: 0, discount: 0, image: blackBag, category: 'Mode', store: 'SO FAB CLOSET', rating: '4,6', stock: 7 },
  { id: 'smartphone', name: 'Smartphone', price: 150000, oldPrice: 0, discount: 0, image: phone, category: 'Électronique', store: 'TECH DAKAR', rating: '4,9', stock: 5 },
]
export type Product = typeof products[number]
export const shops = [
  { id: 'so-fab-closet', name: 'SO FAB CLOSET', category: 'Mode · Parfums · Accessoires', image: pinkDress, subtitle: 'Votre style, votre signature.', rating: '4,8', count: 120 },
  { id: 'touba-essence', name: 'TOUBA ESSENCE', category: 'Parfums · Beauté', image: perfume, subtitle: 'L’essence de votre élégance.', rating: '4,9', count: 85 },
  { id: 'tech-dakar', name: 'TECH DAKAR', category: 'Téléphones · High-Tech', image: phone, subtitle: 'La technologie à portée de main.', rating: '4,7', count: 96 },
]
export const plans = [
  { id: 'starter', name: 'STARTER', price: 5000, limit: 50, features: ['Jusqu’à 50 produits', 'Page boutique', 'Gestion des commandes', 'Statistiques de base', 'Support par email'] },
  { id: 'pro', name: 'PRO', price: 10000, limit: 200, features: ['Jusqu’à 200 produits', 'Page boutique premium', 'Promotions et réductions', 'Statistiques avancées', 'Badge boutique vérifiée', 'Support prioritaire'] },
  { id: 'premium', name: 'PREMIUM', price: 20000, limit: null, features: ['Produits illimités*', 'Boutique mise en avant', 'Campagnes publicitaires', 'Statistiques complètes', 'Gestion multi-utilisateurs', 'Badge premium', 'Support VIP'] },
] as const
export type CartItem = { id: string; quantity: number; size: string; color: string }
export const formatMoney = (value: number) => `${new Intl.NumberFormat('fr-FR').format(value)} FCFA`
export function cartTotals(items: CartItem[]) {
  const subtotal = items.reduce((total, item) => total + (products.find(p => p.id === item.id)?.price ?? 0) * item.quantity, 0)
  const delivery = subtotal > 0 ? 2000 : 0
  return { subtotal, delivery, total: subtotal + delivery }
}