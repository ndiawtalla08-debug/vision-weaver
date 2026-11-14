import { describe, expect, it } from 'vitest'
import { buildDirectory, filterDirectory } from '@/lib/store-directory'
import { products, shops } from '@/lib/catalog'

describe('annuaire des boutiques', () => {
  const dir = buildDirectory(shops, products)
  it('compte les produits publiés de chaque boutique', () => {
    expect(dir.find(s => s.id === 'so-fab-closet')?.productCount).toBe(4)
    expect(dir.find(s => s.id === 'tech-dakar')?.categories).toEqual(['Électronique'])
  })
  it('filtre par catégorie et trie par nombre de produits', () => {
    expect(filterDirectory(dir, '', 'Beauté', 'products').map(s => s.id)).toEqual(['touba-essence'])
    expect(filterDirectory(dir, '', '', 'products')[0]?.id).toBe('so-fab-closet')
    expect(filterDirectory(dir, '', '', 'name').map(s => s.name)).toEqual(['SO FAB CLOSET', 'TECH DAKAR', 'TOUBA ESSENCE'])
  })
})

describe('recherche par nom', () => {
  it('ne garde que les boutiques dont le nom correspond', () => {
    const dir = buildDirectory(shops, products)
    expect(filterDirectory(dir, '', '', 'products', 'tech').map(s => s.id)).toEqual(['tech-dakar'])
    expect(filterDirectory(dir, '', '', 'products', 'parfums')).toEqual([])
  })
})
