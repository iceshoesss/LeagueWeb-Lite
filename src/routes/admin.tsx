import { Hono } from 'hono'
import type { Bindings } from '../types'
import {
  getAllPlayers, deletePlayer, setAdmin, removeAdmin, getAdminPlayerIds, getAdminByPlayerId,
  createTournament, updateTournamentStatus, deleteTournament, deleteTournamentCascade,
  createGroup, deleteGroup, updateGroupStatus, setGroupPlayers, getGroupPlayerIds,
  getEnrollments, enrollPlayer, withdrawEnrollment,
  upsertEnrollmentSettings, getEnrollmentSettings,
  createMatch, getMatchesByGroup, getMatchById, completeMatch,
  initMatchPlacements,
} from '../db'
import { generateGridMatches, generateBracketMatches } from '../utils/scoring'
import { requireAdmin } from '../middleware/auth'
import type { TournamentGroup } from '../types'

const admin = new Hono<{ Bindings: Bindings }>()

admin.use('*', requireAdmin)

admin.post('/player', async (c) => {
  const body = await c.req.parseBody()
  const battleTag = (body.battle_tag as string || '').trim()
  const displayName = (body.display_name as string || '').trim() || null
  if (!battleTag) return c.redirect('/admin/players?error=选手ID不能为空')

  const { getPlayerByTag, createPlayer } = await import('../db')
  const existing = await getPlayerByTag(c.env, battleTag)
  if (existing) return c.redirect('/admin/players?error=选手ID已存在')

  await createPlayer(c.env, battleTag, displayName, '')
  return c.redirect('/admin/players?message=选手已添加')
})

admin.post('/player/delete', async (c) => {
  const body = await c.req.parseBody()
  const playerId = parseInt(body.player_id as string)
  await deletePlayer(c.env, playerId)
  return c.redirect('/admin/players?message=已删除')
})

admin.post('/player/make-admin', async (c) => {
  const body = await c.req.parseBody()
  const playerId = parseInt(body.player_id as string)
  await setAdmin(c.env, playerId, 0)
  return c.redirect('/admin/players?message=已设为管理员')
})

admin.post('/tournament', async (c) => {
  const body = await c.req.parseBody()
  const name = (body.name as string || '').trim()
  if (!name) return c.redirect('/admin/tournaments?error=名称不能为空')
  await createTournament(c.env, name)
  return c.redirect('/admin/tournaments?message=赛事已创建')
})

admin.post('/tournament/:id/status', async (c) => {
  const id = parseInt(c.req.param('id'))
  const body = await c.req.parseBody()
  await updateTournamentStatus(c.env, id, body.status as string)
  return c.redirect(`/admin/tournament/${id}`)
})

admin.post('/tournament/:id/delete', async (c) => {
  const id = parseInt(c.req.param('id'))
  await deleteTournamentCascade(c.env, id)
  return c.redirect('/admin/tournaments?message=赛事已删除')
})

admin.post('/tournament/:id/group', async (c) => {
  const tournamentId = parseInt(c.req.param('id'))
  const body = await c.req.parseBody()
  const name = (body.name as string) || null
  const round = parseInt(body.round as string) || 1
  const bo_n = parseInt(body.bo_n as string) || 3
  const layout = body.layout as string || 'grid'

  const { getGroupsByTournament } = await import('../db')
  const groups = await getGroupsByTournament(c.env, tournamentId)
  const groupIndex = groups.filter(g => g.round === round).length

  await createGroup(c.env, { tournament_id: tournamentId, name, round, group_index: groupIndex, bo_n, layout })
  return c.redirect(`/admin/tournament/${tournamentId}?message=分组已创建`)
})

admin.post('/group/:id/assign', async (c) => {
  const groupId = parseInt(c.req.param('id'))
  const body = await c.req.parseBody()
  const rawIds = body.player_ids
  const playerIds = Array.isArray(rawIds) ? rawIds.map(Number) : rawIds ? [Number(rawIds)] : []
  await setGroupPlayers(c.env, groupId, playerIds)
  return c.redirect(`/admin/tournament/${(await getGroupByIdOrThrow(c, groupId)).tournament_id}`)
})

admin.post('/group/:id/auto-assign', async (c) => {
  const groupId = parseInt(c.req.param('id'))
  const { getGroupById } = await import('../db')
  const group = await getGroupById(c.env, groupId)
  if (!group) return c.redirect('/admin/tournaments?error=分组不存在')

  const { getEnrollments } = await import('../db')
  const enrolled = await getEnrollments(c.env, group.tournament_id)
  const allPlayerIds = enrolled.map(e => e.player_id)

  const existingPlayerIds = await getGroupPlayerIds(c.env, groupId)
  const available = allPlayerIds.filter(id => !existingPlayerIds.includes(id))

  const shuffled = available.sort(() => Math.random() - 0.5)
  const selected = shuffled.slice(0, 8)

  await setGroupPlayers(c.env, groupId, [...existingPlayerIds, ...selected])
  return c.redirect(`/admin/tournament/${group.tournament_id}?message=已分配 ${selected.length} 名选手`)
})

admin.post('/group/:id/start', async (c) => {
  const groupId = parseInt(c.req.param('id'))
  const { getGroupById, getGroupPlayerIds, getPlayerById } = await import('../db')
  const group = await getGroupById(c.env, groupId)
  if (!group) return c.redirect('/admin/tournaments?error=分组不存在')

  const playerIds = await getGroupPlayerIds(c.env, groupId)
  if (playerIds.length === 0) return c.redirect(`/admin/group/${groupId}?error=请先分配选手`)

  const existingMatches = await getMatchesByGroup(c.env, groupId)
  let matches: { players: number[]; gameNumber: number }[]

  if (group.layout === 'grid') {
    matches = generateGridMatches(playerIds, group.bo_n, existingMatches.length)
  } else {
    matches = generateBracketMatches(playerIds, existingMatches.length)
  }

  for (const m of matches) {
    const uuid = crypto.randomUUID()
    const match = await createMatch(c.env, uuid, groupId, m.gameNumber)
    await initMatchPlacements(c.env, match.id, m.players)
  }

  await updateGroupStatus(c.env, groupId, 'active')
  return c.redirect(`/admin/group/${groupId}?message=已启动并生成 ${matches.length} 局比赛`)
})

admin.post('/group/:id/finish', async (c) => {
  const groupId = parseInt(c.req.param('id'))
  await updateGroupStatus(c.env, groupId, 'done')
  return c.redirect(`/admin/group/${groupId}?message=分组已结束`)
})

admin.post('/group/:id/delete', async (c) => {
  const groupId = parseInt(c.req.param('id'))
  const { getGroupById } = await import('../db')
  const group = await getGroupById(c.env, groupId)
  if (!group) return c.redirect('/admin/tournaments')
  await deleteGroup(c.env, groupId)
  return c.redirect(`/admin/tournament/${group.tournament_id}`)
})

admin.post('/match/:id/complete', async (c) => {
  const matchId = parseInt(c.req.param('id'))
  const match = await getMatchById(c.env, matchId)
  if (!match) return c.json({ error: 'not found' }, 404)
  await completeMatch(c.env, matchId)
  return c.redirect(`/admin/group/${match.group_id}?message=比赛已完成`)
})

admin.post('/enrollment/:tid/toggle', async (c) => {
  const tid = parseInt(c.req.param('tid'))
  const settings = await getEnrollmentSettings(c.env, tid)
  const enabled = settings?.enabled ? 0 : 1
  await upsertEnrollmentSettings(c.env, {
    tournament_id: tid,
    enabled,
    deadline: null,
    max_slots: settings?.max_slots ?? 1024,
  })
  return c.redirect(`/admin/enrollments?message=${enabled ? '报名已开放' : '报名已关闭'}`)
})

admin.post('/enrollment/:tid/settings', async (c) => {
  const tid = parseInt(c.req.param('tid'))
  const body = await c.req.parseBody()
  const maxSlots = parseInt(body.max_slots as string) || 1024
  const existing = await getEnrollmentSettings(c.env, tid)
  await upsertEnrollmentSettings(c.env, {
    tournament_id: tid,
    enabled: existing?.enabled ?? 0,
    deadline: existing?.deadline ?? null,
    max_slots: maxSlots,
  })
  return c.redirect(`/admin/enrollments?message=已更新`)
})

admin.post('/enrollment/:tid/remove', async (c) => {
  const tid = parseInt(c.req.param('tid'))
  const body = await c.req.parseBody()
  const playerId = parseInt(body.player_id as string)
  await withdrawEnrollment(c.env, tid, playerId)
  return c.redirect(`/admin/enrollments?message=已移除`)
})

async function getGroupByIdOrThrow(c: any, groupId: number): Promise<TournamentGroup> {
  const { getGroupById } = await import('../db')
  const g = await getGroupById(c.env, groupId)
  if (!g) throw new Error('Group not found')
  return g
}

export default admin
