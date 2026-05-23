import { Hono } from 'hono'
import type { Bindings, JwtPayload } from '../types'
import { getMatchByUuid, getPlacements, upsertPlacement, getGroupPlayerIds, getPlayerById, getGroupById, getTournamentById } from '../db'
import { getAuthPayload } from '../middleware/auth'

const placement = new Hono<{ Bindings: Bindings }>()

placement.post('/match/:uuid/placement', async (c) => {
  const user = await getAuthPayload(c)
  if (!user) return c.json({ error: '未登录' }, 401)

  const match = await getMatchByUuid(c.env, c.req.param('uuid'))
  if (!match) return c.json({ error: '比赛不存在' }, 404)
  if (match.status === 'completed') return c.json({ error: '比赛已结束' }, 400)

  const playerIds = await getGroupPlayerIds(c.env, match.group_id)
  const isParticipant = playerIds.includes(user.player_id)
  if (!isParticipant && !user.is_admin) return c.json({ error: '无权限' }, 403)

  const body = await c.req.parseBody()

  if (user.is_admin) {
    for (const [key, value] of Object.entries(body)) {
      if (key.startsWith('placement_')) {
        const pid = parseInt(key.replace('placement_', ''))
        const placement = parseInt(value as string)
        if (!isNaN(placement) && placement >= 1 && placement <= 8) {
          await upsertPlacement(c.env, match.id, pid, placement, user.player_id)
        }
      }
    }
  } else {
    const placementRaw = body.placement as string
    const placementVal = parseInt(placementRaw)
    if (isNaN(placementVal) || placementVal < 1 || placementVal > 8) {
      return c.json({ error: '名次必须在1-8之间' }, 400)
    }
    await upsertPlacement(c.env, match.id, user.player_id, placementVal, user.player_id)
  }

  const placements = await getPlacements(c.env, match.id)
  const allFilled = placements.length === playerIds.length && placements.every(p => p.placement !== null)

  if (allFilled) {
    const { completeMatch } = await import('../db')
    await completeMatch(c.env, match.id)
  }

  const group = await getGroupById(c.env, match.group_id)
  if (group) {
    return c.redirect(`/tournament/${group.tournament_id}`)
  }
  return c.redirect('/')
})

export default placement
