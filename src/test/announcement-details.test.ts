import { describe, expect, it } from 'vitest'
import { announcementContact, announcementDate } from '@/lib/announcement-details'
describe('announcement details', () => {
  it('does not invent a contact when D1 provides none', () => {
    expect(announcementContact({})).toBeNull()
  })
  it('creates a phone link from an explicit public contact only', () => {
    expect(announcementContact({ contact_phone: '+221 77 123 45 67' })?.href).toBe('tel:+221771234567')
  })
  it('rejects unsafe contact schemes', () => {
    expect(announcementContact({ contact_phone: 'javascript:alert(1)', contact_email: 'a@b.org?bcc=other@b.org' })).toBeNull()
  })
  it('formats D1 timestamps consistently in Senegal', () => {
    expect(announcementDate('2026-11-05 19:59:22')).toBe('5 novembre 2026')
    expect(announcementDate('invalid')).toBe('Non renseignée')
  })
})