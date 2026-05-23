import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import type { Bindings } from './types'
import { getOptionalUser } from './middleware/auth'
import {
  getAllPlayers, getTournaments, getGroupsByTournament,
  getGroupPlayerIds, getPlayerById,
  getMatchesByGroup, getPlacements,
  getEnrollments, getEnrollmentSettings,
  getAdminPlayerIds, getAdminByPlayerId,
  getPlayerByTag,
  getGroupById, getTournamentById,
  enrollPlayer, withdrawEnrollment,
} from './db'
import { calcStandings } from './utils/scoring'

async function getNavStats(c: { env: Bindings }): Promise<{ players: number; activeGames: number }> {
  const { getAllPlayers } = await import('./db')
  const players = await getAllPlayers(c.env)
  return { players: players.length, activeGames: 0 }
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('*', cors())

app.use('/static/*', serveStatic({ root: './public' }))

app.get('/favicon.ico', (c) => c.body(null, 204))

app.get('/', async (c) => {
  const user = await getOptionalUser(c)
  const tournaments = await getTournaments(c.env)
  const active = tournaments.filter(t => t.status === 'active').slice(0, 5)

  const enriched = []
  for (const t of active) {
    const groups = await getGroupsByTournament(c.env, t.id)
    enriched.push({ ...t, groups })
  }

  const standings = []
  for (const t of active) {
    const groups = await getGroupsByTournament(c.env, t.id)
    for (const g of groups) {
      if (g.status === 'waiting') continue
      const playerIds = await getGroupPlayerIds(c.env, g.id)
      const players = await Promise.all(
        playerIds.map(async pid => {
          const p = await getPlayerById(c.env, pid)
          return { player_id: pid, battle_tag: p?.battle_tag ?? '?', display_name: p?.display_name ?? null }
        })
      )
      const matches = await getMatchesByGroup(c.env, g.id)
      const allPlacements = (await Promise.all(matches.map(m => getPlacements(c.env, m.id)))).flat()
      const rows = calcStandings(players, allPlacements).map(r => ({
        ...r,
        avg_placement: r.games_played > 0 ? r.total_placements / r.games_played : null,
        wins: r.wins,
      }))
      standings.push({ group: g, rows })
    }
  }

  const stats = await getNavStats(c)
  const { Home } = await import('./pages/home')
  return c.html(<Home user={user} tournaments={enriched} standings={standings} stats={stats} />)
})

app.get('/register', async (c) => {
  const user = await getOptionalUser(c)
  if (user) return c.redirect('/')
  const mode = c.req.query('mode') === 'register' ? 'register' : 'login'
  const error = c.req.query('error') || undefined
  const stats = await getNavStats(c)
  const { getAdminPlayerIds } = await import('./db')
  const adminIds = await getAdminPlayerIds(c.env)
  const firstAdmin = adminIds.length === 0
  const { RegisterPage } = await import('./pages/register')
  return c.html(<RegisterPage user={null} mode={mode} error={error} stats={stats} firstAdmin={firstAdmin} />)
})

app.get('/tournament/:id', async (c) => {
  const user = await getOptionalUser(c)
  const id = parseInt(c.req.param('id'))
  const tournament = await getTournamentById(c.env, id)
  if (!tournament) return c.redirect('/')

  const groups = await getGroupsByTournament(c.env, id)
  const matchesMap: Record<number, any[]> = {}
  const standings = []

  for (const g of groups) {
    const playerIds = await getGroupPlayerIds(c.env, g.id)
    const players = await Promise.all(
      playerIds.map(async pid => {
        const p = await getPlayerById(c.env, pid)
        return { player_id: pid, battle_tag: p?.battle_tag ?? '?', display_name: p?.display_name ?? null }
      })
    )

    const matchRows = await getMatchesByGroup(c.env, g.id)
    const enriched = []
    for (const m of matchRows) {
      const placements = await getPlacements(c.env, m.id)
      const mPlayers = await Promise.all(
        placements.map(async pl => {
          const plObj = await getPlayerById(c.env, pl.player_id)!
          return {
            id: pl.player_id,
            battle_tag: plObj?.battle_tag ?? '?',
            display_name: plObj?.display_name ?? null,
            password_hash: '',
            created_at: '',
            last_seen: null,
            placement: pl.placement,
          }
        })
      )
      enriched.push({ ...m, players: mPlayers })
    }
    matchesMap[g.id] = enriched

    const allPlacements = (await Promise.all(matchRows.map(m => getPlacements(c.env, m.id)))).flat()
    const rows = calcStandings(players, allPlacements).map(r => ({
      ...r,
      avg_placement: r.games_played > 0 ? r.total_placements / r.games_played : null,
      wins: r.wins,
    }))
    standings.push({ group: g, rows })
  }

  const stats = await getNavStats(c)
  const { TournamentPage } = await import('./pages/tournament')
  return c.html(<TournamentPage user={user} tournament={tournament} groups={groups} matches={matchesMap} standings={standings} stats={stats} />)
})

app.get('/match/:uuid/edit', async (c) => {
  const user = await getOptionalUser(c)
  if (!user) return c.redirect('/register')

  const uuid = c.req.param('uuid')
  const { getMatchByUuid, getPlacements } = await import('./db')
  const match = await getMatchByUuid(c.env, uuid)
  if (!match) return c.redirect('/')

  const groupPlayerIds = await getGroupPlayerIds(c.env, match.group_id)
  const isParticipant = groupPlayerIds.includes(user.player_id)
  if (!isParticipant && !user.is_admin) return c.redirect('/')

  const placements = await getPlacements(c.env, match.id)
  const players = await Promise.all(
    placements.map(async pl => {
      const p = await getPlayerById(c.env, pl.player_id)
      return {
        id: pl.player_id,
        battle_tag: p?.battle_tag ?? '?',
        display_name: p?.display_name ?? null,
        password_hash: '',
        created_at: '',
        last_seen: null,
        placement: pl.placement,
      }
    })
  )

  const error = c.req.query('error') || undefined
  const success = c.req.query('success') || undefined

  const stats = await getNavStats(c)
  const { MatchEditPage } = await import('./pages/match-edit')
  return c.html(<MatchEditPage user={user} match={{ ...match, players }} error={error} success={success} stats={stats} />)
})

app.get('/match/:uuid', async (c) => {
  const user = await getOptionalUser(c)
  const uuid = c.req.param('uuid')
  const { getMatchByUuid, getPlacements } = await import('./db')
  const match = await getMatchByUuid(c.env, uuid)
  if (!match) return c.redirect('/')

  const placements = await getPlacements(c.env, match.id)
  const players = await Promise.all(
    placements.map(async pl => {
      const p = await getPlayerById(c.env, pl.player_id)
      return {
        id: pl.player_id,
        battle_tag: p?.battle_tag ?? '?',
        display_name: p?.display_name ?? null,
        password_hash: '',
        created_at: '',
        last_seen: null,
        placement: pl.placement,
      }
    })
  )

  const stats = await getNavStats(c)
  const { MatchPage } = await import('./pages/match')
  return c.html(<MatchPage user={user} match={{ ...match, players }} stats={stats} />)
})

app.get('/player/:battleTag', async (c) => {
  const user = await getOptionalUser(c)
  const player = await getPlayerByTag(c.env, c.req.param('battleTag'))
  if (!player) {
    const stats = await getNavStats(c)
    const { RegisterPage } = await import('./pages/register')
    return c.html(<RegisterPage user={user} error="选手不存在" stats={stats} />, 404)
  }

  const result = await c.env.DB.prepare(`
    SELECT m.*, mp.placement FROM matches m
    JOIN match_placements mp ON mp.match_id = m.id
    WHERE mp.player_id = ? ORDER BY m.created_at DESC LIMIT 20
  `).bind(player.id).all()

  const matches = (result.results as any[]).map(row => {
    const placement = row.placement as number | null
    return {
      game_uuid: row.game_uuid,
      game_number: row.game_number,
      status: row.status,
      placement,
      players: [],
    }
  }) as any[]

  const stats = await getNavStats(c)
  const { PlayerPage } = await import('./pages/player')
  return c.html(<PlayerPage user={user} player={player} matches={matches} stats={stats} />)
})

app.get('/enroll', async (c) => {
  const user = await getOptionalUser(c)
  if (!user) return c.redirect('/register')

  const tournaments = await getTournaments(c.env)
  const enriched = []
  const enrollmentsMap: Record<number, any[]> = {}
  for (const t of tournaments) {
    const settings = await getEnrollmentSettings(c.env, t.id)
    const enrollments = await getEnrollments(c.env, t.id)
    const enrolled = enrollments.some(e => e.player_id === user.player_id)
    enriched.push({ ...t, settings, enrolled })
    enrollmentsMap[t.id] = enrollments
  }

  const error = c.req.query('error') || undefined
  const message = c.req.query('message') || undefined

  const stats = await getNavStats(c)
  const { EnrollPage } = await import('./pages/enroll')
  return c.html(<EnrollPage user={user} tournaments={enriched} enrollments={enrollmentsMap} error={error} message={message} stats={stats} />)
})

app.post('/api/enroll', async (c) => {
  const user = await getOptionalUser(c)
  if (!user) return c.redirect('/register')

  const body = await c.req.parseBody()
  const tournamentId = parseInt(body.tournament_id as string)
  await enrollPlayer(c.env, tournamentId, user.player_id)
  return c.redirect('/enroll?message=报名成功')
})

app.post('/api/enroll/withdraw', async (c) => {
  const user = await getOptionalUser(c)
  if (!user) return c.redirect('/register')

  const body = await c.req.parseBody()
  const tournamentId = parseInt(body.tournament_id as string)
  await withdrawEnrollment(c.env, tournamentId, user.player_id)
  return c.redirect('/enroll?message=已取消报名')
})

app.get('/leaderboard', async (c) => {
  const user = await getOptionalUser(c)
  const tournaments = await getTournaments(c.env)
  const enriched = []

  for (const t of tournaments) {
    const groups = await getGroupsByTournament(c.env, t.id)
    const groupStandings = []
    for (const g of groups) {
      if (g.status === 'waiting') continue
      const playerIds = await getGroupPlayerIds(c.env, g.id)
      const players = await Promise.all(
        playerIds.map(async pid => {
          const p = await getPlayerById(c.env, pid)
          return { player_id: pid, battle_tag: p?.battle_tag ?? '?', display_name: p?.display_name ?? null }
        })
      )
      const matches = await getMatchesByGroup(c.env, g.id)
      const allPlacements = (await Promise.all(matches.map(m => getPlacements(c.env, m.id)))).flat()
      const rows = calcStandings(players, allPlacements).map(r => ({
        ...r,
        avg_placement: r.games_played > 0 ? r.total_placements / r.games_played : null,
        wins: r.wins,
      }))
      groupStandings.push({ group: g, rows })
    }
    if (groupStandings.length > 0) {
      enriched.push({ ...t, groups: groupStandings })
    }
  }

  const stats = await getNavStats(c)
  const { LeaderboardPage } = await import('./pages/leaderboard')
  return c.html(<LeaderboardPage user={user} tournaments={enriched} stats={stats} />)
})

app.get('/admin', async (c) => {
  const user = await getOptionalUser(c)
  if (!user) return c.redirect('/register')

  const admin = await getAdminByPlayerId(c.env, user.player_id)
  if (!admin) return c.redirect('/')

  const players = await getAllPlayers(c.env)
  const tournaments = await getTournaments(c.env)
  const activeGroupsResult = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM tournament_groups WHERE status = 'active'"
  ).first()
  const pendingMatchesResult = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM matches WHERE status = 'pending'"
  ).first()

  const stats = await getNavStats(c)
  const { AdminPage } = await import('./pages/admin')
  return c.html(<AdminPage user={user} stats={{
    players: players.length,
    tournaments: tournaments.length,
    activeGroups: (activeGroupsResult as any)?.count ?? 0,
    pendingMatches: (pendingMatchesResult as any)?.count ?? 0,
  }} navStats={stats} />)
})

app.get('/admin/players', async (c) => {
  const user = await getOptionalUser(c)
  if (!user) return c.redirect('/register')
  const admin = await getAdminByPlayerId(c.env, user.player_id)
  if (!admin) return c.redirect('/')

  const players = await getAllPlayers(c.env)
  const adminIds = await getAdminPlayerIds(c.env)
  const error = c.req.query('error') || undefined
  const message = c.req.query('message') || undefined

  const stats = await getNavStats(c)
  const { AdminPlayersPage } = await import('./pages/admin-players')
  return c.html(<AdminPlayersPage user={user} players={players} adminIds={adminIds} error={error} message={message} stats={stats} />)
})

app.get('/admin/tournaments', async (c) => {
  const user = await getOptionalUser(c)
  if (!user) return c.redirect('/register')
  const admin = await getAdminByPlayerId(c.env, user.player_id)
  if (!admin) return c.redirect('/')

  const tournaments = await getTournaments(c.env)
  const error = c.req.query('error') || undefined
  const message = c.req.query('message') || undefined

  const stats = await getNavStats(c)
  const { AdminTournamentsPage } = await import('./pages/admin-tournaments')
  return c.html(<AdminTournamentsPage user={user} tournaments={tournaments} error={error} message={message} stats={stats} />)
})

app.get('/admin/tournament/:id', async (c) => {
  const user = await getOptionalUser(c)
  if (!user) return c.redirect('/register')
  const admin = await getAdminByPlayerId(c.env, user.player_id)
  if (!admin) return c.redirect('/')

  const id = parseInt(c.req.param('id'))
  const tournament = await getTournamentById(c.env, id)
  if (!tournament) return c.redirect('/admin/tournaments')

  const groups = await getGroupsByTournament(c.env, id)
  const allPlayers = await getAllPlayers(c.env)
  const enrolled = await getEnrollments(c.env, id)
  const enrolledPlayerIds = enrolled.map(e => e.player_id)

  const groupsWithMatches: Record<number, any[]> = {}
  for (const g of groups) {
    if (g.layout === 'bracket' && g.status !== 'waiting') {
      const matches = await getMatchesByGroup(c.env, g.id)
      const enriched = []
      for (const m of matches) {
        const placements = await getPlacements(c.env, m.id)
        const players = await Promise.all(
          placements.map(async pl => {
            const p = await getPlayerById(c.env, pl.player_id)
            return { id: pl.player_id, battle_tag: p?.battle_tag ?? '?', display_name: p?.display_name ?? null, placement: pl.placement }
          })
        )
        enriched.push({ ...m, players })
      }
      groupsWithMatches[g.id] = enriched
    }
  }

  const error = c.req.query('error') || undefined
  const message = c.req.query('message') || undefined

  const stats = await getNavStats(c)
  const { AdminTournamentDetail } = await import('./pages/admin-tournament-detail')
  return c.html(<AdminTournamentDetail
    user={user} tournament={tournament} groups={groups} groupsWithMatches={groupsWithMatches}
    allPlayers={allPlayers} enrolledPlayerIds={enrolledPlayerIds}
    error={error} message={message} stats={stats}
  />)
})

app.get('/admin/group/:id', async (c) => {
  const user = await getOptionalUser(c)
  if (!user) return c.redirect('/register')
  const admin = await getAdminByPlayerId(c.env, user.player_id)
  if (!admin) return c.redirect('/')

  const groupId = parseInt(c.req.param('id'))
  const group = await getGroupById(c.env, groupId)
  if (!group) return c.redirect('/admin/tournaments')

  const tournament = await getTournamentById(c.env, group.tournament_id)
  const matchRows = await getMatchesByGroup(c.env, groupId)
  const enriched = []
  for (const m of matchRows) {
    const placements = await getPlacements(c.env, m.id)
    const players = await Promise.all(
      placements.map(async pl => {
        const p = await getPlayerById(c.env, pl.player_id)
        return {
          id: pl.player_id,
          battle_tag: p?.battle_tag ?? '?',
          display_name: p?.display_name ?? null,
          password_hash: '',
          created_at: '',
          last_seen: null,
          placement: pl.placement,
        }
      })
    )
    enriched.push({ ...m, players })
  }

  const allPlayers = await getAllPlayers(c.env)
  const error = c.req.query('error') || undefined
  const message = c.req.query('message') || undefined

  const stats = await getNavStats(c)
  const { AdminGroupPage } = await import('./pages/admin-group')
  return c.html(<AdminGroupPage
    user={user} group={group} tournament={tournament!}
    matches={enriched} allPlayers={allPlayers}
    error={error} message={message} stats={stats}
  />)
})

app.get('/admin/enrollments', async (c) => {
  const user = await getOptionalUser(c)
  if (!user) return c.redirect('/register')
  const admin = await getAdminByPlayerId(c.env, user.player_id)
  if (!admin) return c.redirect('/')

  const tournaments = await getTournaments(c.env)
  const settingsMap: Record<number, any> = {}
  const enrollmentsMap: Record<number, any[]> = {}

  for (const t of tournaments) {
    settingsMap[t.id] = await getEnrollmentSettings(c.env, t.id)
    enrollmentsMap[t.id] = await getEnrollments(c.env, t.id)
  }

  const error = c.req.query('error') || undefined
  const message = c.req.query('message') || undefined

  const stats = await getNavStats(c)
  const { AdminEnrollmentsPage } = await import('./pages/admin-enrollments')
  return c.html(<AdminEnrollmentsPage
    user={user} tournaments={tournaments}
    settings={settingsMap} enrollments={enrollmentsMap}
    error={error} message={message} stats={stats}
  />)
})

import auth from './routes/auth'
import adminApi from './routes/admin'
import dataApi from './routes/data'
import tournamentApi from './routes/tournament'
import placementApi from './routes/placement'

app.route('/api', auth)
app.route('/api/admin', adminApi)
app.route('/api', dataApi)
app.route('/api/tournament', tournamentApi)
app.route('/api', placementApi)

app.notFound(async (c) => {
  const user = await getOptionalUser(c)
  return c.html(`
    <html lang="zh-CN"><head><meta charset="UTF-8"/>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>body { font-family: 'Noto Sans SC', sans-serif; } .hearth-gradient { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); }</style></head>
    <body class="hearth-gradient text-gray-200 min-h-screen flex items-center justify-center">
      <div class="text-center">
        <h1 class="text-4xl font-bold text-hearth-dim">404</h1>
        <p class="text-hearth-dim mt-2">页面不存在</p>
        <a href="/" class="text-hearth-gold hover:text-hearth-accent mt-4 inline-block transition">返回首页</a>
      </div>
    </body></html>
  `, 404)
})

export default app
