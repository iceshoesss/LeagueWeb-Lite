/**
 * Cookie-based session auth using HMAC-SHA256
 */

export interface Session {
  battleTag: string;
  displayName: string;
  exp: number;
}

function base64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(s: string): Uint8Array {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}

async function hmacSign(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return base64url(sig);
}

async function hmacVerify(secret: string, data: string, sig: string): Promise<boolean> {
  const expected = await hmacSign(secret, data);
  if (expected.length !== sig.length) return false;
  let result = 0;
  for (let i = 0; i < expected.length; i++) {
    result |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  }
  return result === 0;
}

function base64Encode(str: string): string {
  const bytes = new TextEncoder().encode(str);
  return btoa(String.fromCharCode(...bytes));
}

function base64Decode(b64: string): string {
  const bin = atob(b64);
  return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
}

export async function createSession(secret: string, session: Session): Promise<string> {
  const payload = base64Encode(JSON.stringify(session));
  const sig = await hmacSign(secret, payload);
  return `${payload}.${sig}`;
}

export async function parseSession(secret: string, cookie: string | undefined): Promise<Session | null> {
  if (!cookie) return null;
  const parts = cookie.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const valid = await hmacVerify(secret, payload, sig);
  if (!valid) return null;
  try {
    const session: Session = JSON.parse(base64Decode(payload));
    if (session.exp && Date.now() > session.exp) return null;
    return session;
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return base64url(hash);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const computed = await hashPassword(password);
  if (computed.length !== hash.length) return false;
  let result = 0;
  for (let i = 0; i < computed.length; i++) {
    result |= computed.charCodeAt(i) ^ hash.charCodeAt(i);
  }
  return result === 0;
}

export const COOKIE_NAME = 'lw_session';
export const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days
