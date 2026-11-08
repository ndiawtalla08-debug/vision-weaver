import { useState } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { Link } from '@tanstack/react-router'
import { UserRound, LogOut, Heart } from 'lucide-react'
import { loginD1, logoutD1 } from '@/lib/favorites.functions'
import { useMarket } from './marketplace'
import { Button } from './ui/button'

export function D1Account() {
  const { favoriteState } = useMarket()
  const login = useServerFn(loginD1); const logout = useServerFn(logoutD1)
  const [error,setError] = useState<string|null>(null); const [busy,setBusy] = useState(false)
  return <main className="container-site page-main"><div className="mx-auto max-w-md"><UserRound className="mb-4 size-9 text-primary"/><h1>Mon compte</h1>{favoriteState.loading ? <p role="status">Chargement du compte…</p> : favoriteState.user ? <><p className="my-5">{favoriteState.user.email}</p><Button asChild><Link to="/favoris"><Heart/>Mes favoris</Link></Button><Button variant="outline" disabled={busy} className="mt-4 w-full" onClick={async () => { setBusy(true); try { const result = await logout(); favoriteState.clear(); setError(result.error) } catch { setError('Déconnexion impossible. Veuillez réessayer.') } finally { setBusy(false) } }}><LogOut/>Me déconnecter</Button></> : <form className="mt-7" onSubmit={async e => { e.preventDefault(); const form = new FormData(e.currentTarget); setBusy(true); setError(null); try { const result = await login({ data:{email:String(form.get('email')),password:String(form.get('password'))} }); if (result.error) setError(result.error); else await favoriteState.refresh() } catch { setError('Connexion impossible. Veuillez réessayer.') } finally { setBusy(false) } }}><label className="mb-4 block text-sm">Adresse email<input name="email" className="form-input mt-2" type="email" required autoComplete="email"/></label><label className="mb-5 block text-sm">Mot de passe<input name="password" className="form-input mt-2" type="password" required minLength={8} autoComplete="current-password"/></label><Button className="w-full" type="submit" disabled={busy}>{busy ? 'Connexion…' : 'Me connecter'}</Button></form>}{(error || favoriteState.error) && <p role="alert" className="notice mt-4">{error || favoriteState.error}</p>}</div></main>
}