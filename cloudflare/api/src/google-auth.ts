import { HttpError, json, id, sha256, hashPassword, type Ctx } from './lib'

const SITE_URL = 'https://toutsuiteannonces.com/mon-compte'
const CALLBACK_URL = 'https://api.toutsuiteannonces.com/auth/google/callback'

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

const randomToken = (size = 32) => {
  const bytes = crypto.getRandomValues(new Uint8Array(size))
  return b64url(bytes)
}

const digest = async (value: string) =>
  new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  )

const decodeJwtPart = (value: string) => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  return JSON.parse(
    atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='))
  )
}

async function verifyGoogleToken(token: string, nonce: string, clientId: string) {
  const parts = token.split('.')
  if (parts.length !== 3) throw new HttpError(401, 'Jeton Google invalide.')

  const header = decodeJwtPart(parts[0]!) as { alg?: string; kid?: string }
  const payload = decodeJwtPart(parts[1]!) as {
    iss?: string
    aud?: string
    exp?: number
    nonce?: string
    sub?: string
    email?: string
    email_verified?: boolean
    name?: string
  }

  if (header.alg !== 'RS256' || !header.kid) {
    throw new HttpError(401, 'Signature Google invalide.')
  }

  const response = await fetch('https://www.googleapis.com/oauth2/v3/certs')
  if (!response.ok) throw new HttpError(502, 'Vérification Google indisponible.')

  const keys = await response.json() as {
  keys: (JsonWebKey & { kid?: string })[]
}

  const jwk = keys.keys.find(key => key.kid === header.kid)
  if (!jwk) throw new HttpError(401, 'Clé Google introuvable.')

  const publicKey = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  )

  const signature = Uint8Array.from(
    atob(parts[2]!.replace(/-/g, '+').replace(/_/g, '/')),
    c => c.charCodeAt(0)
  )

  const signedData = new TextEncoder().encode(`${parts[0]}.${parts[1]}`)

  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    publicKey,
    signature,
    signedData
  )

  if (!valid) throw new HttpError(401, 'Signature Google incorrecte.')

  if (
    !['accounts.google.com', 'https://accounts.google.com'].includes(payload.iss ?? '') ||
    payload.aud !== clientId ||
    !payload.exp ||
    payload.exp <= Math.floor(Date.now() / 1000) ||
    payload.nonce !== nonce ||
    !payload.sub ||
    !payload.email ||
    payload.email_verified !== true
  ) {
    throw new HttpError(401, 'Identité Google non vérifiée.')
  }

  return payload
}

async function startGoogle(c: Ctx): Promise<Response> {
  const state = randomToken()
  const verifier = randomToken(48)
  const nonce = randomToken()

  const challenge = b64url(await digest(verifier))
  const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString()

  await c.env.DB.prepare(`
    INSERT INTO oauth_states (state_hash, code_verifier, nonce, expires_at)
    VALUES (?, ?, ?, ?)
  `).bind(await sha256(state), verifier, nonce, expires).run()

  const params = new URLSearchParams({
    client_id: c.env.GOOGLE_CLIENT_ID,
    redirect_uri: CALLBACK_URL,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    access_type: 'online'
  })

  return Response.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
    302
  )
}

async function googleCallback(c: Ctx): Promise<Response> {
  const code = c.url.searchParams.get('code')
  const state = c.url.searchParams.get('state')

  if (!code || !state) {
    throw new HttpError(400, 'Réponse Google incomplète.')
  }

  const stateHash = await sha256(state)

  const saved = await c.env.DB.prepare(`
    SELECT code_verifier, nonce
    FROM oauth_states
    WHERE state_hash = ? AND expires_at > ?
  `).bind(stateHash, new Date().toISOString()).first<{
    code_verifier: string
    nonce: string
  }>()

  if (!saved) throw new HttpError(401, 'Session Google expirée ou invalide.')

  await c.env.DB.prepare(
    'DELETE FROM oauth_states WHERE state_hash = ?'
  ).bind(stateHash).run()

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: c.env.GOOGLE_CLIENT_ID,
      client_secret: c.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: CALLBACK_URL,
      grant_type: 'authorization_code',
      code_verifier: saved.code_verifier
    })
  })

  if (!tokenResponse.ok) {
    throw new HttpError(401, 'Google a refusé la connexion.')
  }

  const tokens = await tokenResponse.json() as { id_token?: string }
  if (!tokens.id_token) throw new HttpError(401, 'Jeton Google manquant.')

  const google = await verifyGoogleToken(
    tokens.id_token,
    saved.nonce,
    c.env.GOOGLE_CLIENT_ID
  )

  const email = google.email!.toLowerCase()

  let user = await c.env.DB.prepare(`
    SELECT id, email, role, status
    FROM users WHERE id IN (
      SELECT user_id FROM user_oauth_accounts
      WHERE provider = 'google' AND provider_user_id = ?
    )
  `).bind(google.sub).first<{
    id: string; email: string; role: string; status: string
  }>()

  if (!user) {
    user = await c.env.DB.prepare(`
      SELECT id, email, role, status
      FROM users WHERE email = ?
    `).bind(email).first<{
      id: string; email: string; role: string; status: string
    }>()
  }

  if (user?.status === 'suspended') {
    throw new HttpError(403, 'Ce compte est suspendu.')
  }

  if (!user) {
    const userId = id()
    const { hash, salt } = await hashPassword(randomToken(48))

    await c.env.DB.batch([
      c.env.DB.prepare(`
        INSERT INTO users (id, email, password_hash, password_salt)
        VALUES (?, ?, ?, ?)
      `).bind(userId, email, hash, salt),

      c.env.DB.prepare(`
        INSERT INTO user_profiles (user_id, full_name)
        VALUES (?, ?)
      `).bind(userId, google.name ?? null)
    ])

    user = {
      id: userId,
      email,
      role: 'user',
      status: 'active'
    }
  }

  await c.env.DB.prepare(`
    INSERT OR IGNORE INTO user_oauth_accounts
    (id, user_id, provider, provider_user_id, email)
    VALUES (?, ?, 'google', ?, ?)
  `).bind(id(), user.id, google.sub, email).run()

  const loginCode = randomToken(32)
  const codeHash = await sha256(loginCode)
  const expires = new Date(Date.now() + 60 * 1000).toISOString()

  await c.env.DB.prepare(`
    INSERT INTO google_login_codes (code_hash, user_id, expires_at)
    VALUES (?, ?, ?)
  `).bind(codeHash, user.id, expires).run()

  return Response.redirect(
    `${SITE_URL}?google_code=${encodeURIComponent(loginCode)}`

  )
}

async function exchangeGoogleCode(c: Ctx): Promise<Response> {
  const b = await c.req.json() as { code?: string }

  if (!b.code || typeof b.code !== 'string' || b.code.length > 200) {
    throw new HttpError(400, 'Code de connexion invalide.')
  }

  const codeHash = await sha256(b.code)

  // Suppression atomique : le code ne peut être consommé qu'une fois.
  const consumed = await c.env.DB.prepare(`
    DELETE FROM google_login_codes
    WHERE code_hash = ? AND expires_at > ?
    RETURNING user_id
  `).bind(codeHash, new Date().toISOString()).first<{
    user_id: string
  }>()

  if (!consumed) {
    throw new HttpError(401, 'Code expiré ou déjà utilisé.')
  }

  const user = await c.env.DB.prepare(`
    SELECT id, email, role, status
    FROM users
    WHERE id = ?
  `).bind(consumed.user_id).first<{
    id: string
    email: string
    role: string
    status: string
  }>()

  if (!user || user.status !== 'active') {
    throw new HttpError(403, 'Compte suspendu ou introuvable.')
  }

  const token = randomToken(48)
  const expires = new Date(Date.now() + 30 * 864e5).toISOString()

  await c.env.DB.prepare(`
    INSERT INTO sessions (id, user_id, expires_at)
    VALUES (?, ?, ?)
  `).bind(await sha256(token), user.id, expires).run()

  return json({
    token,
    expires_at: expires,
    user: {
      id: user.id,
      email: user.email,
      role: user.role
    }
  })
}


export const googleAuthRoutes: [string, string, (c: Ctx) => Promise<Response>][] = [
  ['GET', '/auth/google', startGoogle],
  ['GET', '/auth/google/callback', googleCallback],
  ['POST', '/auth/google/exchange', exchangeGoogleCode]
]