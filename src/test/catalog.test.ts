import { describe, it, expect } from 'vitest'
import { cartTotals, plans, products } from '@/lib/catalog'
describe('Tarifs du cahier des charges', () => {
 it('Starter coûte 5 000 FCFA et limite à 50 produits', () => { expect(plans[0].price).toBe(5000); expect(plans[0].limit).toBe(50) })
 it('Pro coûte 10 000 FCFA et limite à 200 produits', () => { expect(plans[1].price).toBe(10000); expect(plans[1].limit).toBe(200) })
 it('Premium coûte 20 000 FCFA', () => expect(plans[2].price).toBe(20000))
 it('la robe coûte 25 000 FCFA avec ancien prix 30 000', () => { expect(products[0]?.price).toBe(25000); expect(products[0]?.oldPrice).toBe(30000); expect(products[0]?.discount).toBe(17) })
 it('les trois produits donnent 80 000 + 2 000 = 82 000 FCFA', () => expect(cartTotals(products.slice(0,3).map(p => ({ id:p.id,quantity:1,size:'M',color:'Noir' })))).toEqual({ subtotal:80000,delivery:2000,total:82000 }))
 it('un panier vide ne facture pas de livraison', () => expect(cartTotals([]).total).toBe(0))
 it('recalcule les prix selon les quantités', () => expect(cartTotals([{ id:'robe-elegante',quantity:2,size:'M',color:'Noir' }]).total).toBe(52000))
})