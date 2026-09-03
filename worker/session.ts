/**
 * Signed-cookie session for the passphrase auth.
 *
 * The client derives an opaque `accountId` (SHA-256 of the passphrase) and posts
 * it once. We HMAC it with SESSION_SECRET to get the KV id, then hand back a
 * signed cookie carrying that id so later requests don't need the accountId
 * again. The server never sees the passphrase or any plaintext data.
 */

const COOKIE_NAME = 'xp_session'
const MAX_AGE = 60 * 60 * 24 * 365 // 1 year

const enc = new TextEncoder()

function b64urlEncode(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let bin = ''
  for (const b of arr) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlDecode(str: string): Uint8Array {
  const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

/** Stable HMAC-SHA256 hex of an arbitrary string, keyed by the server secret. */
export async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await hmacKey(secret)
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** `kvId` is the account's KV partition — HMAC of the client accountId. */
export function kvIdFor(secret: string, accountId: string): Promise<string> {
  return hmacHex(secret, `acct:${accountId}`)
}

export async function signSession(kvId: string, secret: string): Promise<string> {
  const payload = b64urlEncode(enc.encode(JSON.stringify({ kvId, iat: Date.now() })))
  const key = await hmacKey(secret)
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload))
  return `${payload}.${b64urlEncode(sig)}`
}

export async function verifySession(value: string, secret: string): Promise<string | null> {
  const dot = value.indexOf('.')
  if (dot < 0) return null
  const payload = value.slice(0, dot)
  const sig = value.slice(dot + 1)
  const key = await hmacKey(secret)
  const ok = await crypto.subtle.verify(
    'HMAC',
    key,
    b64urlDecode(sig),
    enc.encode(payload),
  )
  if (!ok) return null
  try {
    const parsed = JSON.parse(new TextDecoder().decode(b64urlDecode(payload))) as {
      kvId?: unknown
    }
    return typeof parsed.kvId === 'string' ? parsed.kvId : null
  } catch {
    return null
  }
}

export function readCookie(req: Request, name = COOKIE_NAME): string | null {
  const header = req.headers.get('Cookie')
  if (!header) return null
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=')
    if (k === name) return decodeURIComponent(rest.join('='))
  }
  return null
}

export function sessionCookie(value: string): string {
  return `${COOKIE_NAME}=${encodeURIComponent(value)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${MAX_AGE}`
}

export function clearCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`
}

export async function sessionKvId(req: Request, secret: string): Promise<string | null> {
  const raw = readCookie(req)
  return raw ? verifySession(raw, secret) : null
}
