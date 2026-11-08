import { describe, it, expect } from 'vitest'
import { catalogSchema, d1BaseUrl } from '@/lib/d1-schema'
import { cartTotals, type Product } from '@/lib/catalog'

describe('D1 integration', () => {
  it('uses the corrected Worker address', () => expect(d1BaseUrl).toBe('https://toutsuite-api.ndiawtalla08.workers.dev'))
  it('supports both deployed announcement image formats', () => {
    const data = catalogSchema.parse({ stores: [], products: [], categories: [], announcements: [{ id: '1', title: 'Annonce', image: null, images: ['https://example.org/photo.jpg'] }] })
    expect(data.announcements[0]?.images?.[0]).toBe('https://example.org/photo.jpg')
  })
  it('calculates the selected live product instead of a demo price', () => {
    const product: Product = { id:'d1-product', name:'Produit D1', price:35000, oldPrice:0, discount:0, stock:4, image:'', category:'Mode', store:'Boutique', rating:'—' }
    expect(cartTotals([{ id:product.id, quantity:2, size:'M', color:'Noir' }], [product])).toEqual({ subtotal:70000, delivery:2000, total:72000 })
  })
})