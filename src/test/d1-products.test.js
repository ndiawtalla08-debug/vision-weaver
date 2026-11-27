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
    },async all() {if (sql.includes('FROM product_images') && options.previousImages) return {results:options.previousImages.map(url=>({url}))};return {results:[]}},async run() {writes.push(this);return {success:true}} }; statements.push(s);return s
  },async batch(items) {if (options.failBatch) throw new Error('D1 down');writes.push(...items);return []} }
  // Faux bucket R2 : reproduit put/get/delete du binding IMAGES
  const r2 = new Map(Object.entries(options.r2 ?? {}))
  const images = {puts:[],deletes:[],async put(key,value,opts){this.puts.push(key);r2.set(key,{value,opts})},async get(key){return r2.get(key) ?? null},async delete(key){this.deletes.push(key);r2.delete(key)},store:r2}
  const req = new Request(`https://example.org${path}`,{method,...(method === 'GET' ? {} : {body:JSON.stringify(data)})})
  const c = {req,url:new URL(req.url),params:{id:'product-alice'},user,env:{DB:db,IMAGES:images,ALLOWED_ORIGINS:''}}
  const routePath = path.split('?')[0].replace('/products/product-alice','/products/:id')
  const handler = routes.find(r => r[0] === method && r[1] === routePath)?.[2]
  if (!handler) throw new Error('Missing handler')
  return {c,statements,writes,images,run:()=>handler(c)}
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
    // La photo est envoyée dans R2 ; D1 enregistre son URL publique en position 0
    expect(t.images.puts).toHaveLength(1)
    expect(t.writes[1].values.slice(1)).toEqual([r.id,`https://api.toutsuiteannonces.com/images/${t.images.puts[0]}`,0])
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

  // ---------- Galerie de photos (R2 + D1) ----------
  const png='data:image/png;base64,YQ==', jpg='data:image/jpeg;base64,Yg==', webp='data:image/webp;base64,Yw=='
  const url=k=>`https://api.toutsuiteannonces.com/images/${k}`
  const imageInserts=t=>t.writes.filter(w=>w.sql.includes('INSERT INTO product_images')).map(w=>w.values)
  it('creates a product with several photos uploaded to R2 and stored in order in product_images', async () => {
    const t=setup('POST','/products',{...payload,image:undefined,images:[png,jpg,webp]})
    const r=await (await t.run()).json()
    expect(r.images_count).toBe(3);expect(t.images.puts).toHaveLength(3)
    expect(imageInserts(t).map(v=>[v[1],v[2],v[3]])).toEqual(t.images.puts.map((k,i)=>[r.id,url(k),i]))
    expect(t.images.store.get(t.images.puts[0]).opts.httpMetadata.contentType).toBe('image/png')
  })
  it('rejects more than 5 photos before any R2 upload or D1 write', async () => {
    const t=setup('POST','/products',{...payload,images:[png,png,png,png,png,png]})
    await expect(t.run()).rejects.toMatchObject({status:400});expect(t.images.puts).toHaveLength(0);expect(t.writes).toHaveLength(0)
  })
  it('removes freshly uploaded R2 photos when the D1 write fails', async () => {
    const t=setup('POST','/products',{...payload,images:[png,jpg]},undefined,{failBatch:true})
    await expect(t.run()).rejects.toThrow();expect(t.images.deletes).toEqual(t.images.puts)
  })
  it('keeps existing photos, adds new ones, preserves order and deletes only removed photos from R2', async () => {
    const t=setup('PATCH','/products/product-alice',{images:[url('a'),jpg,url('c')]},undefined,{previousImages:[url('a'),url('b'),url('c')],r2:{a:1,b:1,c:1}})
    await t.run()
    expect(imageInserts(t).map(v=>[v[2],v[3]])).toEqual([[url('a'),0],[url(t.images.puts[0]),1],[url('c'),2]])
    expect(t.images.deletes).toEqual(['b']);expect([...t.images.store.keys()].sort()).toEqual(['a','c',t.images.puts[0]].sort())
  })
  it('does not touch the gallery when a PATCH sends no photos', async () => {
    const t=setup('PATCH','/products/product-alice',{price:5000},undefined,{previousImages:[url('a')]})
    await t.run();expect(imageInserts(t)).toHaveLength(0);expect(t.images.deletes).toHaveLength(0)
  })
  it('refuses to keep a photo URL that does not belong to the product', async () => {
    const t=setup('PATCH','/products/product-alice',{images:[url('autre-produit')]},undefined,{previousImages:[url('a')],r2:{a:1}})
    await expect(t.run()).rejects.toMatchObject({status:400});expect(t.writes).toHaveLength(0);expect(t.images.deletes).toHaveLength(0)
  })
  it('keeps R2 photos intact when the D1 update fails', async () => {
    const t=setup('PATCH','/products/product-alice',{images:[png]},undefined,{previousImages:[url('a')],r2:{a:1},failBatch:true})
    await expect(t.run()).rejects.toThrow();expect(t.images.store.has('a')).toBe(true);expect(t.images.deletes).toEqual(t.images.puts)
  })
  it('deletes the product photos from R2 after deleting the product', async () => {
    const t=setup('DELETE','/products/product-alice',payload,undefined,{previousImages:[url('a'),url('b')],r2:{a:1,b:1}})
    await t.run();expect(t.images.deletes).toEqual(['a','b'])
  })
  it('public list returns every photo in position order', async () => {
    const t=setup('GET','/products',null,null);await t.run()
    expect(t.statements[0].sql).toContain('json_group_array(url)');expect(t.statements[0].sql).toMatch(/ORDER BY position\)\)\s+AS images_json/)
  })
  it('serves an R2 photo through GET /images/:id', async () => {
    const t=setup('GET','/products',null,null);t.c.params={id:'abc'}
    const handler=routes.find(r=>r[0]==='GET'&&r[1]==='/images/:id')[2]
    t.images.store.set('abc',{body:'x',writeHttpMetadata(h){h.set('Content-Type','image/png')}})
    const res=await handler(t.c);expect(res.status).toBe(200);expect(res.headers.get('Content-Type')).toBe('image/png')
  })
  it('registers exactly one route per product method and path', () => {
    const keys=routes.map(r=>`${r[0]} ${r[1]}`);expect(new Set(keys).size).toBe(keys.length)
  })
})
