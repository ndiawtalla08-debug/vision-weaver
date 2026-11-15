import { useEffect, useState } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { Link } from '@tanstack/react-router'
import { UserRound, LogOut, Heart, Package, Mail, Phone, MapPin, MessageSquare, ChevronRight, Sparkles, BadgeCheck } from 'lucide-react'
import type { ReactNode } from 'react'
import cover from '@/assets/profile-cover.jpg'
import { loginD1, logoutD1, registerD1, readD1Profile } from '@/lib/favorites.functions'
import { useMarket } from '@/lib/market-context'
import { Button } from './ui/button'

export function D1Account() {
  const { favoriteState } = useMarket()
  const login = useServerFn(loginD1); const logout = useServerFn(logoutD1)
  const register = useServerFn(registerD1); const getProfile = useServerFn(readD1Profile)
  const [signup,setSignup] = useState(false)
  const [profile,setProfile] = useState<Awaited<ReturnType<typeof readD1Profile>>['profile']>(null)
  useEffect(() => { let active = true; if (!favoriteState.user) { setProfile(null); return } void getProfile().then(result => { if (active) { setProfile(result.profile); if (result.error) setError(result.error) } }).catch(() => { if (active) setError('Impossible de récupérer votre profil.') }); return () => { active = false } }, [favoriteState.user?.id])
  const [error,setError] = useState<string|null>(null); const [busy,setBusy] = useState(false)
  return <main className="container-site page-main"><div className={`mx-auto ${favoriteState.user ? 'max-w-5xl' : 'max-w-md'}`}>{!favoriteState.user && <><UserRound className="mb-4 size-9 text-primary"/><h1>{signup ? 'Créer mon compte' : 'Mon compte'}</h1></>}{favoriteState.loading ? <p role="status">Chargement du compte…</p> : favoriteState.user ? <ProfileCard email={favoriteState.user.email} profile={profile} favorites={favoriteState.items.length} logout={<Button variant="outline" disabled={busy} className="w-full" onClick={async () => { setBusy(true); try { const result = await logout(); favoriteState.clear(); setError(result.error) } catch { setError('Déconnexion impossible. Veuillez réessayer.') } finally { setBusy(false) } }}><LogOut/>Me déconnecter</Button>}/> : <form className="mt-7" onSubmit={async e => { e.preventDefault(); const form = new FormData(e.currentTarget); setBusy(true); setError(null); try { const credentials = {email:String(form.get('email')),password:String(form.get('password'))}; const result = signup ? await register({data:{...credentials,full_name:String(form.get('full_name')),phone:String(form.get('phone') || ''),city:String(form.get('city') || '')}}) : await login({data:credentials}); if (result.error) setError(result.error); else await favoriteState.refresh() } catch { setError('Connexion impossible. Veuillez réessayer.') } finally { setBusy(false) } }}>{signup && <><label className="mb-4 block text-sm">Nom complet<input name="full_name" className="form-input mt-2" required maxLength={120} autoComplete="name"/></label><label className="mb-4 block text-sm">Téléphone<input name="phone" className="form-input mt-2" type="tel" maxLength={30} autoComplete="tel"/></label><label className="mb-4 block text-sm">Ville<input name="city" className="form-input mt-2" maxLength={80} autoComplete="address-level2"/></label></>}<label className="mb-4 block text-sm">Adresse email<input name="email" className="form-input mt-2" type="email" required autoComplete="email"/></label><label className="mb-5 block text-sm">Mot de passe<input name="password" className="form-input mt-2" type="password" required minLength={8} autoComplete={signup ? 'new-password' : 'current-password'}/></label><Button className="w-full" type="submit" disabled={busy}>{busy ? (signup ? 'Création…' : 'Connexion…') : signup ? 'Créer mon compte' : 'Me connecter'}</Button><Button type="button" variant="link" disabled={busy} className="mt-3" onClick={() => {setSignup(v => !v);setError(null)}}>{signup ? 'J’ai déjà un compte' : 'Créer un compte'}</Button></form>}{(error || favoriteState.error) && <p role="alert" className="notice mt-4">{error || favoriteState.error}</p>}</div></main>
}

type Profile = Awaited<ReturnType<typeof readD1Profile>>['profile']
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('') || '?'

function ProfileCard({ email, profile, favorites, logout }: { email: string; profile: Profile; favorites: number; logout: ReactNode }) {
  const name = profile?.full_name || email.split('@')[0] || 'Mon compte'
  const avatar = profile?.avatar_url && /^https:\/\//.test(profile.avatar_url) ? profile.avatar_url : ''
  const info = [{ icon: Mail, label: 'Adresse email', value: email }, { icon: Phone, label: 'Téléphone', value: profile?.phone }, { icon: MapPin, label: 'Ville', value: profile?.city }]
  const actions = [
    { to: '/messages' as const, icon: MessageSquare, title: 'Messages reçus', text: 'Répondez aux acheteurs intéressés' },
    { to: '/favoris' as const, icon: Heart, title: 'Mes favoris', text: `${favorites} élément${favorites > 1 ? 's' : ''} enregistré${favorites > 1 ? 's' : ''}` },
    { to: '/mes-produits' as const, icon: Package, title: 'Mes produits', text: 'Gérez vos brouillons et publications' },
    { to: '/fiche-produit-ia' as const, icon: Sparkles, title: 'Fiche produit IA', text: 'Rédigez une fiche à partir d’une photo' },
  ]
  return <div>
    <section className="overflow-hidden rounded-md border border-border bg-card">
      <div className="relative h-40 sm:h-56"><img src={cover} alt="Boutique au Sénégal" width={1600} height={560} className="h-full w-full object-cover"/><div className="absolute inset-0 bg-gradient-to-t from-foreground/70 to-transparent"/></div>
      <div className="flex flex-col gap-4 px-6 pb-6 sm:flex-row sm:items-end">
        <div className="-mt-14 flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-card bg-primary text-4xl font-semibold text-primary-foreground shadow-lg">{avatar ? <img src={avatar} alt={name} className="h-full w-full object-cover"/> : initials(name)}</div>
        <div className="min-w-0 flex-1"><p className="eyebrow">MON COMPTE</p><h1 className="flex items-center gap-2 break-words text-4xl">{name}<BadgeCheck className="size-6 shrink-0 text-success" aria-label="Compte vérifié"/></h1>{profile?.city && <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="size-4"/>{profile.city}, Sénégal</p>}</div>
        <div className="flex gap-6 text-center"><div><p className="text-2xl font-semibold">{favorites}</p><p className="text-xs text-muted-foreground">Favoris</p></div></div>
      </div>
    </section>
    <div className="mt-6 grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <section className="rounded-md border border-border bg-card p-6"><h2 className="mb-4 text-2xl">Informations</h2><dl className="space-y-4">{info.map(({ icon: Icon, label, value }) => <div key={label} className="flex gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary"><Icon className="size-4 text-primary"/></span><div className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="break-words">{value || '—'}</dd></div></div>)}</dl><div className="mt-6">{logout}</div></section>
      <section><h2 className="mb-4 text-2xl">Accès rapides</h2><div className="grid gap-4 sm:grid-cols-2">{actions.map(({ to, icon: Icon, title, text }) => <Link key={to} to={to} className="group flex items-center gap-4 rounded-md border border-border bg-card p-5 transition hover:border-primary hover:shadow-md"><span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"><Icon className="size-5"/></span><span className="min-w-0 flex-1"><strong className="block">{title}</strong><span className="text-sm text-muted-foreground">{text}</span></span><ChevronRight className="size-4 text-muted-foreground transition group-hover:translate-x-1"/></Link>)}</div></section>
    </div>
  </div>
}
