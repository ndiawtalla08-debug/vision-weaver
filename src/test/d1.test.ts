import { describe, it, expect } from 'vitest'
import { catalogSchema, d1BaseUrl } from '@/lib/d1-schema'
import { cartTotals, type Product } from '@/lib/catalog'
import { productImageUrl } from '@/lib/api-client'

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
  it('resolves deployed R2 announcement paths against the Worker, not the website', () => {
    expect(productImageUrl('/images?key=uploads%2Fphoto.png')).toBe(`${d1BaseUrl}/images?key=uploads%2Fphoto.png`)
    expect(productImageUrl('uploads/photo.png')).toBe(`${d1BaseUrl}/images?key=uploads%2Fphoto.png`)
    expect(productImageUrl('https://example.org/photo.jpg')).toBe('https://example.org/photo.jpg')
  })
  it('accepts live announcements with only an images array and no single image', () => {
    const data = catalogSchema.parse({ stores: [], products: [], categories: [], announcements: [{ id: 'live', title: 'Annonce D1', category_id: null, images: ['/images?key=uploads%2Fphoto.png'] }] })
    expect(data.announcements[0]?.images).toEqual(['/images?key=uploads%2Fphoto.png'])
  })
})