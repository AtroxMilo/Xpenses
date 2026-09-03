/**
 * Client-side crypto for cloud sync. The passphrase never leaves the browser in
 * the clear: we send only a SHA-256 "account id" to the server, and the backup
 * blob is AES-GCM encrypted with a PBKDF2 key derived from the passphrase.
 */

const PBKDF2_ITERATIONS = 210_000
const enc = new TextEncoder()
const dec = new TextDecoder()

export interface EncryptedBlob {
  v: 1
  salt: string
  iv: string
  ct: string
}

function toB64(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let bin = ''
  for (const b of arr) bin += String.fromCharCode(b)
  return btoa(bin)
}

function fromB64(str: string): Uint8Array<ArrayBuffer> {
  const bin = atob(str)
  const out = new Uint8Array(new ArrayBuffer(bin.length))
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Opaque server-side identity — safe to send, useless without the passphrase. */
export async function deriveAccountId(passphrase: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(`xpenses:acct:${passphrase}`))
  return toHex(digest)
}

/** Hex SHA-256 of an arbitrary string — used to detect local snapshot changes. */
export async function sha256Hex(text: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', enc.encode(text)))
}

async function deriveKey(passphrase: string, salt: BufferSource): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encryptJSON(passphrase: string, plaintext: string): Promise<EncryptedBlob> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(passphrase, salt)
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext))
  return { v: 1, salt: toB64(salt), iv: toB64(iv), ct: toB64(ct) }
}

export class BadPassphraseError extends Error {
  constructor() {
    super('passphrase does not match the cloud data')
    this.name = 'BadPassphraseError'
  }
}

export async function decryptJSON(passphrase: string, blob: EncryptedBlob): Promise<string> {
  try {
    const key = await deriveKey(passphrase, fromB64(blob.salt))
    const pt = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromB64(blob.iv) },
      key,
      fromB64(blob.ct),
    )
    return dec.decode(pt)
  } catch {
    throw new BadPassphraseError()
  }
}
