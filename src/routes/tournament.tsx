import { Hono } from 'hono'
import type { Bindings } from '../types'
import { getTournamentById, getGroupsByTournament } from '../db'

const tournamentApi = new Hono<{ Bindings: Bindings }>()

tournamentApi.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  const t = await getTournamentById(c.env, id)
  if (!t) return c.json({ error: 'not found' }, 404)

  const groups = await getGroupsByTournament(c.env, id)
  return c.json({ ...t, groups })
})

tournamentApi.get('/:id/standings', async (c) => {
  const id = parseInt(c.req.param('id'))
  const t = await getTournamentById(c.env, id)
  if (!t) return c.json({ error: 'not found' }, 404)

  const groups = await getGroupsByTournament(c.env, id)
  const { getMatchesByGroup, getPlacements, getGroupPlayerIds, getPlayerById } = await import('../db')
  const { calcStandings } = await import('../utils/scoring')

  const standings = []
  for (const g of groups) {
    const playerIds = await getGroupPlayerIds(c.env, g.id)
    const players = await Promise.all(
      playerIds.map(async pid => {
        const p = await getPlayerById(c.env, pid)
        return { player_id: pid, battle_tag: p?.battle_tag ?? '?', display_name: p?.display_name ?? null }
      })
    )
    const matches = await getMatchesByGroup(c.env, g.id)
    const allPlacements = (await Promise.all(matches.map(m => getPlacements(c.env, m.id)))).flat()
    standings.push({ group: g, rows: calcStandings(players, allPlacements) })
  }

  return c.json(standings)
})

export default tournamentApi
