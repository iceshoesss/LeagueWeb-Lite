import { Hono } from 'hono'
import type { Bindings } from '../types'
import { getPlayerByTag, createPlayer } from '../db'
import { setAuthCookie, clearAuthCookie } from '../middleware/auth'

const auth = new Hono<{ Bindings: Bindings }>()

auth.post('/register', async (c) => {
  const body = await c.req.parseBody()
  const battleTag = (body.battle_tag as string || '').trim()
  const password = body.password as string || ''
  const displayName = (body.display_name as string || '').trim() || null

  if (!battleTag || !password) {
    return c.redirect('/register?mode=register&error=选手ID和密码不能为空')
  }
  if (password.length < 4) {
    return c.redirect('/register?mode=register&error=密码至少4位')
  }

  const existing = await getPlayerByTag(c.env, battleTag)
  if (existing) {
    return c.redirect('/register?mode=register&error=该选手ID已注册')
  }

  const passwordHash = await hashPassword(password)
  const player = await createPlayer(c.env, battleTag, displayName, passwordHash)

  const { getAdminPlayerIds, setAdmin } = await import('../db')
  const adminIds = await getAdminPlayerIds(c.env)
  let isAdmin = false
  if (adminIds.length === 0) {
    await setAdmin(c.env, player.id, 1)
    isAdmin = true
  }

  await setAuthCookie(c, {
    player_id: player.id,
    battle_tag: player.battle_tag,
    is_admin: isAdmin,
  })

  return c.redirect('/')
})

auth.post('/login', async (c) => {
  const body = await c.req.parseBody()
  const battleTag = (body.battle_tag as string || '').trim()
  const password = body.password as string || ''

  if (!battleTag || !password) {
    return c.redirect('/register?error=选手ID和密码不能为空')
  }

  const player = await getPlayerByTag(c.env, battleTag)
  if (!player) {
    return c.redirect('/register?error=选手ID或密码错误')
  }

  const valid = await verifyPassword(password, player.password_hash)
  if (!valid) {
    return c.redirect('/register?error=选手ID或密码错误')
  }

  const { getAdminByPlayerId } = await import('../db')
  const admin = await getAdminByPlayerId(c.env, player.id)

  await setAuthCookie(c, {
    player_id: player.id,
    battle_tag: player.battle_tag,
    is_admin: !!admin,
  })

  return c.redirect('/')
})

auth.post('/logout', async (c) => {
  clearAuthCookie(c)
  return c.redirect('/')
})

auth.get('/me', async (c) => {
  const { getAuthPayload } = await import('../middleware/auth')
  const payload = await getAuthPayload(c)
  if (!payload) return c.json(null)
  return c.json(payload)
})

async function hashPassword(password: string): Promise<string> {
  const enc = new TextEncoder()
  const hash = await crypto.subtle.digest('SHA-256', enc.encode(password))
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return hashPassword(password).then(h => h === hash)
}

export default auth
