import { useEffect, useRef, useState } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { readFavorites, changeFavorite } from '@/lib/favorites.functions'
import type { Favorite } from '@/lib/favorites-schema'

export function useD1Favorites() {
  const read = useServerFn(readFavorites)
  const change = useServerFn(changeFavorite)
  const [items, setItems] = useState<Favorite[]>([])
  const [user, setUser] = useState<{id:string;email:string} | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const generation = useRef(0)
  const refresh = async () => {
    const version = ++generation.current
    setLoading(true)
    try {
      const result = await read()
      if (version !== generation.current) return
      setItems(result.favorites); setUser(result.user); setError(result.signedOut ? null : result.error)
    } catch { if (version === generation.current) { setItems([]); setUser(null); setError('Impossible de charger vos favoris.'); } }
    finally { if (version === generation.current) setLoading(false) }
  }
  useEffect(() => { void refresh(); return () => { generation.current++ } }, [])
  const toggle = async (id:string, kind:'product'|'announcement' = 'product') => {
    if (lock.current) return
    if (!user) { setError('Connectez-vous dans « Mon compte » pour enregistrer vos favoris.'); return }
    lock.current = true; setBusy(true); setError(null)
    const version = generation.current
    try {
      const selected = !items.some(f => kind === 'product' ? f.product_id === id : f.announcement_id === id)
      const result = await change({ data: { id, kind, selected } })
      if (version !== generation.current) return
      if (result.error) { setError(result.error); if (result.signedOut) { setUser(null); setItems([]) } }
      else { setItems(result.favorites); setUser(result.user) }
    } catch { if (version === generation.current) setError('Le favori n’a pas pu être enregistré. Veuillez réessayer.') }
    finally { lock.current = false; setBusy(false) }
  }
  const clear = () => { generation.current++; setItems([]); setUser(null); setError(null) }
  return { items, user, loading, error, busy, refresh, toggle, clear }
}