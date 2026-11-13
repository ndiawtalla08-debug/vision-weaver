import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

// Real backend checks: visitors are refused, the server's privileged client still saves.
const env = Object.fromEntries(readFileSync('.env', 'utf8').split('\n').filter(l => l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')] }))
const url = process.env.SUPABASE_URL || env.VITE_SUPABASE_URL
const row = { name: 'TEST accès', title: 'TEST accès', description: 'test automatique', price: 1, category: 'test', image_data: 'data:,' }
const opts = { auth: { persistSession: false } }

describe('catalogue products insert access', () => {
  it('refuses inserts from visitors with the public key', async () => {
    const anon = createClient(url, env.VITE_SUPABASE_PUBLISHABLE_KEY, opts)
    const { error } = await anon.from('products').insert(row)
    expect(error).not.toBeNull()
  })
  it.skipIf(!process.env.SUPABASE_SERVICE_ROLE_KEY)('accepts the server-side save and cleans up', async () => {
    const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, opts)
    const { data, error } = await admin.from('products').insert(row).select('id').single()
    expect(error).toBeNull()
    const { data: read } = await createClient(url, env.VITE_SUPABASE_PUBLISHABLE_KEY, opts).from('products').select('id').eq('id', data.id)
    expect(read).toHaveLength(1)
    await admin.from('products').delete().eq('id', data.id)
  })
})
