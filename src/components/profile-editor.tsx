import { useRef, useState } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { Camera, Loader2, Pencil, X } from 'lucide-react'
import { Button } from './ui/button'
import { updateProfile, uploadAvatar } from '@/lib/profile.functions'
import { profileUpdateSchema } from '@/lib/d1-auth-schema'

type Profile = { full_name?: string | null; phone?: string | null; city?: string | null } | null

/** Resize to a 512px square JPEG in the browser so uploads stay small. */
async function toSquareJpeg(file: File) {
  const bitmap = await createImageBitmap(file)
  const size = Math.min(bitmap.width, bitmap.height)
  const canvas = Object.assign(document.createElement('canvas'), { width: 512, height: 512 })
  canvas.getContext('2d')!.drawImage(bitmap, (bitmap.width - size) / 2, (bitmap.height - size) / 2, size, size, 0, 0, 512, 512)
  return canvas.toDataURL('image/jpeg', 0.85)
}

export function AvatarUpload({ onUploaded }: { onUploaded: (url: string) => void }) {
  const upload = useServerFn(uploadAvatar)
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const onFile = async (file?: File) => {
    if (!file) return
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return setError('Formats acceptés : JPG, PNG ou WebP.')
    if (file.size > 10_000_000) return setError('Photo trop lourde (10 Mo maximum).')
    setBusy(true); setError(null)
    try { const r = await upload({ data: { image: await toSquareJpeg(file) } }); r.url ? onUploaded(r.url) : setError(r.error) }
    catch { setError('Téléversement impossible, réessayez.') }
    finally { setBusy(false); if (input.current) input.current.value = '' }
  }
  return <>
    <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Choisir une photo de profil" onChange={e => void onFile(e.target.files?.[0])}/>
    <Button type="button" size="icon" variant="secondary" disabled={busy} className="absolute bottom-1 right-1 size-9 rounded-full border-2 border-card shadow" aria-label="Modifier ma photo de profil" onClick={() => input.current?.click()}>{busy ? <Loader2 className="animate-spin"/> : <Camera/>}</Button>
    {error && <p role="alert" className="absolute left-0 top-full mt-2 w-60 text-xs text-destructive">{error}</p>}
  </>
}

export function ProfileForm({ profile, onSaved }: { profile: Profile; onSaved: (p: NonNullable<Profile>) => void }) {
  const save = useServerFn(updateProfile)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  if (!open) return <div><Button variant="outline" className="w-full" onClick={() => { setOpen(true); setOk(false) }}><Pencil/>Modifier mes informations</Button>{ok && <p role="status" className="mt-2 text-sm text-success">Profil mis à jour.</p>}</div>
  return <form className="space-y-3" onSubmit={async e => {
    e.preventDefault(); const f = new FormData(e.currentTarget)
    const parsed = profileUpdateSchema.safeParse({ full_name: String(f.get('full_name') ?? ''), phone: String(f.get('phone') ?? ''), city: String(f.get('city') ?? '') })
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Informations invalides.')
    setBusy(true); setError(null)
    try {
  const r = await save({ data: parsed.data });

  if (r.profile) {
    onSaved({
      full_name: r.profile.full_name ?? null,
      phone: r.profile.phone ?? null,
      city: r.profile.city ?? null,
    });

    setOpen(false);
    setOk(true);
  } else {
    setError(r.error);
  }
}
    catch { setError('Impossible d’enregistrer votre profil.') } finally { setBusy(false) }
  }}>
    <label className="block text-sm">Nom complet<input name="full_name" className="form-input mt-1" required maxLength={120} defaultValue={profile?.full_name ?? ''} autoComplete="name"/></label>
    <label className="block text-sm">Téléphone<input name="phone" type="tel" className="form-input mt-1" maxLength={30} defaultValue={profile?.phone ?? ''} autoComplete="tel"/></label>
    <label className="block text-sm">Ville<input name="city" className="form-input mt-1" maxLength={80} defaultValue={profile?.city ?? ''} autoComplete="address-level2"/></label>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex gap-2"><Button type="submit" disabled={busy} className="flex-1">{busy && <Loader2 className="animate-spin"/>}Enregistrer</Button><Button type="button" variant="outline" disabled={busy} onClick={() => { setOpen(false); setError(null) }}><X/>Annuler</Button></div>
  </form>
}
