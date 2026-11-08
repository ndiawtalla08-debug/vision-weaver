import { describe, it, expect } from 'vitest'
import { routes } from '../../cloudflare/api/src/modules'
import worker from '../../cloudflare/api/src/index'
import { productInput } from '@/lib/d1-products-schema'

const payload = { store_id:'store-alice',category_id:null,name:'Produit',description:'Description',price:17000,old_price:20000,stock:3,status:'draft',image:'data:image/png;base64,YQ==' }
function setup(method, path, data = payload, user = {id:'alice',email:'alice@example.org',role:'user'}, options = {}) {
  const statements = [], writes = []
  const db = { prepare(sql) {
    const s = {sql,values:[],bind(...values) {this.values=values;return this},async first() {
      if (sql.includes('SELECT id, store_id')) return options.missingProduct ? null : {id:'product-alice',store_id:'store-alice',status:'published'}
      if (sql.includes('SELECT id, status FROM stores')) return options.missingStore ? null : {id:'store-alice',status:'active'}
      if (sql.includes('SELECT 1 FROM stores')) return user?.id === 'alice' || options.manager ? {ok:1} : null
      if (sql.includes('SELECT id FROM categories')) return options.category ? {id:options.category} : null
      return null
    },async all() {return {results:[]}},async run() {writes.push(this);return {success:true}} }; statements.push(s);return s
  },async batch(items) {writes.push(...items);return []} }
  const req = new Request(`https://example.org${path}`,{method,...(method === 'GET' ? {} : {body:JSON.stringify(data)})})
  const c = {req,url:new URL(req.url),params:{id:'product-alice'},user,env:{DB:db,ALLOWED_ORIGINS:''}}
  const routePath = path.split('?')[0].replace('/products/product-alice','/products/:id')
  const handler = routes.find(r => r[0] === method && r[1] === routePath)?.[2]
  if (!handler) throw new Error('Missing handler')
  return {c,statements,writes,run:()=>handler(c)}
}
describe('D1 seller products', () => {
  for (const [method,path] of [['POST','/products'],['PATCH','/products/product-alice'],['DELETE','/products/product-alice'],['GET','/me/products?store=store-alice']]) {
    it(`requires a session for ${method} ${path}`, async () => {
      const t=setup(method,path,payload,null);await expect(t.run()).rejects.toMatchObject({status:401});expect(t.writes).toHaveLength(0)
    })
    it(`denies another seller ${method} ${path}`, async () => {
      const t=setup(method,path,payload,{id:'bob',email:'bob@example.org',role:'user'});await expect(t.run()).rejects.toMatchObject({status:403});expect(t.writes).toHaveLength(0)
    })
  }
  it('persists the selected store, draft status and photo together', async () => {
    const t=setup('POST','/products');const r=await (await t.run()).json();expect(r).toMatchObject({store_id:'store-alice',status:'draft'})
    expect(t.writes[0].values.slice(1)).toEqual(['store-alice',null,'Produit','Description',17000,20000,3,'draft'])
    expect(t.writes[1].values.slice(1)).toEqual([r.id,'data:image/png;base64,YQ=='])
  })
  it('can update publication and pricing only in the original store', async () => {
    const t=setup('PATCH','/products/product-alice',{...payload,status:'published',price:19000});await t.run()
    expect(t.writes[0].values).toEqual([null,'Produit','Description',19000,20000,3,'published','product-alice','store-alice'])
  })
  it('cannot move a product to another store', async () => {
    const t=setup('PATCH','/products/product-alice',{...payload,store_id:'store-bob'});await expect(t.run()).rejects.toMatchObject({status:400});expect(t.writes).toHaveLength(0)
  })
  it('checks that a store exists before insertion', async () => {
    const t=setup('POST','/products',payload,undefined,{missingStore:true});await expect(t.run()).rejects.toMatchObject({status:404});expect(t.writes).toHaveLength(0)
  })
  it('checks that a product exists before deletion', async () => {
    const t=setup('DELETE','/products/product-alice',payload,undefined,{missingProduct:true});await expect(t.run()).rejects.toMatchObject({status:404});expect(t.writes).toHaveLength(0)
  })
  it('deletes only the verified product and original store', async () => {
    const t=setup('DELETE','/products/product-alice');await t.run();expect(t.writes[0].values).toEqual(['product-alice','store-alice'])
  })
  it('rejects states other than draft or published', async () => {
    const t=setup('POST','/products',{...payload,status:'archived'});await expect(t.run()).rejects.toMatchObject({status:400});expect(t.writes).toHaveLength(0)
  })
  it('rejects a nonexistent category before mutation', async () => {
    const t=setup('POST','/products',{...payload,category_id:'missing'});await expect(t.run()).rejects.toMatchObject({status:400});expect(t.writes).toHaveLength(0)
  })
  it('rejects owner injection at the app boundary', () => {
    expect(productInput.safeParse({...payload,user_id:'bob'}).success).toBe(false)
  })
  it('public reads require published products and an active store with the requested ID', async () => {
    const t=setup('GET','/products?store=store-alice',null,null);await t.run()
    expect(t.statements[0].sql).toContain("p.status = 'published' AND s.status = 'active'")
    expect(t.statements[0].values).toEqual(['store-alice',null])
  })
  it('the HTTP dispatcher routes seller listing rather than the generic me endpoint', async () => {
    const r=await worker.fetch(new Request('https://example.org/me/stores'),{DB:{prepare(){throw new Error('Unexpected DB query')}},ALLOWED_ORIGINS:''})
    expect(r.status).toBe(401)
  })
  it('registers exactly one PATCH product route', () => {
    expect(routes.filter(r => r[0] === 'PATCH' && r[1] === '/products/:id')).toHaveLength(1)
  })
  it('returns 404 for PATCH of a nonexistent product without writing', async () => {
    const t=setup('PATCH','/products/product-alice',{status:'draft'},undefined,{missingProduct:true})
    await expect(t.run()).rejects.toMatchObject({status:404});expect(t.writes).toHaveLength(0)
  })
  it('allows an authorized manager to update only a name without clearing other fields or images', async () => {
    const t=setup('PATCH','/products/product-alice',{name:'Nouveau nom'},{id:'manager',email:'manager@example.org',role:'user'},{manager:true})
    const result=await (await t.run()).json()
    expect(t.writes).toHaveLength(1);expect(t.writes[0].values).toEqual(['Nouveau nom','product-alice','store-alice'])
    expect(result.status).toBe('published')
  })
  for (const status of ['draft','published']) {
    it(`allows a status-only transition to ${status}`, async () => {
      const t=setup('PATCH','/products/product-alice',{status});const result=await (await t.run()).json()
      expect(result.status).toBe(status);expect(t.writes[0].values).toEqual([status,'product-alice','store-alice'])
    })
  }
  it('updates an existing category and clears the old price explicitly', async () => {
    const t=setup('PATCH','/products/product-alice',{category_id:'mode',old_price:null},undefined,{category:'mode'})
    await t.run();expect(t.writes[0].values).toEqual(['mode',null,'product-alice','store-alice'])
  })
  for (const data of [{name:'  '},{price:-1},{price:1.5},{old_price:-1},{stock:-1},{category_id:'missing'},{status:'archived'},{user_id:'bob'},{}]) {
    it(`rejects invalid PATCH ${JSON.stringify(data)} before writing`, async () => {
      const t=setup('PATCH','/products/product-alice',data)
      await expect(t.run()).rejects.toMatchObject({status:400});expect(t.writes).toHaveLength(0)
    })
  }
})