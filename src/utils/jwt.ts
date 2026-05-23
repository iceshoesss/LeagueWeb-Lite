import type { JwtPayload } from '../types'

const ALGO = { name: 'HMAC' as const, hash: 'SHA-256' }

function buf2b64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b642buf(s: string): ArrayBuffer {
  const b = s.replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b)
  const buf = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i)
  return buf.buffer
}

async function getKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder().encode(secret)
  return crypto.subtle.importKey('raw', enc, ALGO, false, ['sign', 'verify'])
}

export async function sign(payload: JwtPayload, secret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' }
  const now = Math.floor(Date.now() / 1000)
  payload.iat = now
  payload.exp = now + 86400 * 7

  const enc = new TextEncoder()
  const headerB64 = buf2b64url(enc.encode(JSON.stringify(header)).buffer as ArrayBuffer)
  const payloadB64 = buf2b64url(enc.encode(JSON.stringify(payload)).buffer as ArrayBuffer)
  const data = `${headerB64}.${payloadB64}`

  const key = await getKey(secret)
  const sig = await crypto.subtle.sign(ALGO, key, enc.encode(data))
  return `${data}.${buf2b64url(sig)}`
}

export async function verify(token: string, secret: string): Promise<JwtPayload | null> {
  const parts = token.split('.')
  if (parts.length !== 3) return null

  try {
    const key = await getKey(secret)
    const enc = new TextEncoder()
    const sigBuf = b642buf(parts[2])
    const valid = await crypto.subtle.verify(ALGO, key, sigBuf, enc.encode(`${parts[0]}.${parts[1]}`))
    if (!valid) return null

    const payload: JwtPayload = JSON.parse(new TextDecoder().decode(b642buf(parts[1])))
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}
