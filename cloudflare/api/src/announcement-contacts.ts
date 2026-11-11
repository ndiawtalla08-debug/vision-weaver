import { HttpError, str } from './lib'

export function publicContacts(b: Record<string, unknown>) {
  const phone = str(b['contact_phone'], 'téléphone public', 25, false)
  const email = str(b['contact_email'], 'email public', 200, false)
  if (phone && (!/^\+?[\d\s().-]+$/.test(phone) || phone.replace(/\D/g, '').length < 7 || phone.replace(/\D/g, '').length > 15)) throw new HttpError(400, 'Téléphone public invalide.')
  if (email && !/^[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/.test(email)) throw new HttpError(400, 'Email public invalide.')
  return { contact_phone: phone || null, contact_email: email || null }
}