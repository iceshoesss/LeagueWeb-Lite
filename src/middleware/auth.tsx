import type { Context, MiddlewareHandler } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import type { Bindings, JwtPayload, AppVariables } from '../types'
import { sign, verify } from '../utils/jwt'
import { getAdminByPlayerId } from '../db'

const COOKIE_NAME = 'token'

export async function setAuthCookie(c: Context, payload: JwtPayload): Promise<void> {
  const token = await sign(payload, c.env.JWT_SECRET)
  const isSecure = c.req.url.startsWith('https://')
  setCookie(c, COOKIE_NAME, token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'Lax',
    path: '/',
    maxAge: 86400 * 7,
  })
}

export function clearAuthCookie(c: Context): void {
  deleteCookie(c, COOKIE_NAME, { path: '/' })
}

async function readPayload(c: Context): Promise<JwtPayload | null> {
  const token = getCookie(c, COOKIE_NAME)
  if (!token) return null
  return verify(token, c.env.JWT_SECRET)
}

export async function getAuthPayload(c: Context): Promise<JwtPayload | null> {
  return readPayload(c)
}

export const requireAuth: MiddlewareHandler<{ Bindings: Bindings; Variables: AppVariables }> = async (c, next) => {
  const payload = await readPayload(c)
  if (!payload) return c.redirect('/register')
  c.set('user', payload)
  await next()
}

export const requireAdmin: MiddlewareHandler<{ Bindings: Bindings; Variables: AppVariables }> = async (c, next) => {
  const payload = await readPayload(c)
  if (!payload) return c.redirect('/register')

  const admin = await getAdminByPlayerId(c.env, payload.player_id)
  if (!admin) return c.redirect('/')

  c.set('user', payload)
  c.set('admin', admin)
  await next()
}

export async function getOptionalUser(c: Context): Promise<JwtPayload | null> {
  return readPayload(c)
}
