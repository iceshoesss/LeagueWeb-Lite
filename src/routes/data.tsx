import { Hono } from 'hono'
import type { Bindings } from '../types'
import { getPlayerByTag, getPlayerById } from '../db'

const data = new Hono<{ Bindings: Bindings }>()

data.get('/players', async (c) => {
  const { getAllPlayers } = await import('../db')
  const players = await getAllPlayers(c.env)
  return c.json(players.map(p => ({ id: p.id, battle_tag: p.battle_tag, display_name: p.display_name })))
})

data.get('/player/:battleTag', async (c) => {
  const player = await getPlayerByTag(c.env, c.req.param('battleTag'))
  if (!player) return c.json({ error: 'not found' }, 404)

  const { getMatchesByGroup, getPlacements, getGroupPlayerIds, getPlayerById, getGroupById, getTournamentById } = await import('../db')
  const { getAllPlayers } = await import('../db')

  const allMatchesRaw = await c.env.DB.prepare(`
    SELECT m.* FROM matches m
    JOIN match_placements mp ON mp.match_id = m.id
    WHERE mp.player_id = ? ORDER BY m.created_at DESC LIMIT 20
  `).bind(player.id).all()

  const matches = []
  for (const row of allMatchesRaw.results) {
    const m = row as any
    const placements = await getPlacements(c.env, m.id)
    const myPlacement = placements.find(p => p.player_id === player.id)?.placement ?? null
    const group = await getGroupById(c.env, m.group_id)
    const tournament = group ? await getTournamentById(c.env, group.tournament_id) : null

    const playerIds = placements.map(p => p.player_id)
    const players = await Promise.all(
      playerIds.map(async pid => {
        const p = await getPlayerById(c.env, pid)
        const pl = placements.find(pl => pl.player_id === pid)
        return {
          battle_tag: p?.battle_tag ?? '?',
          display_name: p?.display_name ?? null,
          placement: pl?.placement ?? null,
        }
      })
    )

    matches.push({
      game_uuid: m.game_uuid,
      game_number: m.game_number,
      status: m.status,
      placement: myPlacement,
      players,
      group_name: group?.name ?? null,
      tournament_name: tournament?.name ?? '?',
    })
  }

  return c.json({
    id: player.id,
    battle_tag: player.battle_tag,
    display_name: player.display_name,
    created_at: player.created_at,
    matches,
  })
})

export default data
