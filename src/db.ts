import type {
  Player, Admin, Tournament, TournamentGroup, GroupPlayer,
  Enrollment, EnrollmentSettings, Match, MatchPlacement
} from './types'

export type DBEnv = { DB: D1Database }

function row<T>(data: unknown): T {
  return data as T
}

function rows<T>(data: unknown): T[] {
  return data as T[]
}

export async function getPlayerByTag(env: DBEnv, battleTag: string): Promise<Player | null> {
  const result = await env.DB.prepare('SELECT * FROM players WHERE battle_tag = ?').bind(battleTag).first()
  return result ? row<Player>(result) : null
}

export async function getPlayerById(env: DBEnv, id: number): Promise<Player | null> {
  const result = await env.DB.prepare('SELECT * FROM players WHERE id = ?').bind(id).first()
  return result ? row<Player>(result) : null
}

export async function createPlayer(env: DBEnv, battleTag: string, displayName: string | null, passwordHash: string): Promise<Player> {
  const result = await env.DB.prepare(
    'INSERT INTO players (battle_tag, display_name, password_hash) VALUES (?, ?, ?) RETURNING *'
  ).bind(battleTag, displayName, passwordHash).first()
  return row<Player>(result!)
}

export async function getAllPlayers(env: DBEnv): Promise<Player[]> {
  const result = await env.DB.prepare('SELECT * FROM players ORDER BY created_at DESC').all()
  return rows<Player>(result.results)
}

export async function deletePlayer(env: DBEnv, id: number): Promise<void> {
  await env.DB.prepare('DELETE FROM players WHERE id = ?').bind(id).run()
}

export async function getAdminByPlayerId(env: DBEnv, playerId: number): Promise<Admin | null> {
  const result = await env.DB.prepare('SELECT * FROM admins WHERE player_id = ?').bind(playerId).first()
  return result ? row<Admin>(result) : null
}

export async function setAdmin(env: DBEnv, playerId: number, isSuperAdmin: number): Promise<void> {
  await env.DB.prepare(
    'INSERT OR REPLACE INTO admins (player_id, is_super_admin) VALUES (?, ?)'
  ).bind(playerId, isSuperAdmin).run()
}

export async function removeAdmin(env: DBEnv, playerId: number): Promise<void> {
  await env.DB.prepare('DELETE FROM admins WHERE player_id = ?').bind(playerId).run()
}

export async function getAdminPlayerIds(env: DBEnv): Promise<number[]> {
  const result = await env.DB.prepare('SELECT player_id FROM admins').all()
  return rows<{ player_id: number }>(result.results).map(r => r.player_id)
}

export async function getTournaments(env: DBEnv): Promise<Tournament[]> {
  const result = await env.DB.prepare('SELECT * FROM tournaments ORDER BY created_at DESC').all()
  return rows<Tournament>(result.results)
}

export async function getTournamentById(env: DBEnv, id: number): Promise<Tournament | null> {
  const result = await env.DB.prepare('SELECT * FROM tournaments WHERE id = ?').bind(id).first()
  return result ? row<Tournament>(result) : null
}

export async function createTournament(env: DBEnv, name: string): Promise<Tournament> {
  const result = await env.DB.prepare('INSERT INTO tournaments (name) VALUES (?) RETURNING *').bind(name).first()
  return row<Tournament>(result!)
}

export async function updateTournamentStatus(env: DBEnv, id: number, status: string): Promise<void> {
  await env.DB.prepare('UPDATE tournaments SET status = ? WHERE id = ?').bind(status, id).run()
}

export async function deleteTournament(env: DBEnv, id: number): Promise<void> {
  await env.DB.prepare('DELETE FROM tournaments WHERE id = ?').bind(id).run()
}

export async function deleteTournamentCascade(env: DBEnv, id: number): Promise<void> {
  await env.DB.prepare(`
    DELETE FROM match_placements WHERE match_id IN (
      SELECT m.id FROM matches m JOIN tournament_groups g ON g.id = m.group_id WHERE g.tournament_id = ?
    )
  `).bind(id).run()
  await env.DB.prepare(`
    DELETE FROM matches WHERE group_id IN (
      SELECT id FROM tournament_groups WHERE tournament_id = ?
    )
  `).bind(id).run()
  await env.DB.prepare(`
    DELETE FROM group_players WHERE group_id IN (
      SELECT id FROM tournament_groups WHERE tournament_id = ?
    )
  `).bind(id).run()
  await env.DB.prepare('DELETE FROM tournament_groups WHERE tournament_id = ?').bind(id).run()
  await env.DB.prepare('DELETE FROM enrollments WHERE tournament_id = ?').bind(id).run()
  await env.DB.prepare('DELETE FROM enrollment_settings WHERE tournament_id = ?').bind(id).run()
  await env.DB.prepare('DELETE FROM tournaments WHERE id = ?').bind(id).run()
}

export async function getGroupsByTournament(env: DBEnv, tournamentId: number): Promise<TournamentGroup[]> {
  const result = await env.DB.prepare(
    'SELECT * FROM tournament_groups WHERE tournament_id = ? ORDER BY round, group_index'
  ).bind(tournamentId).all()
  return rows<TournamentGroup>(result.results)
}

export async function getGroupById(env: DBEnv, groupId: number): Promise<TournamentGroup | null> {
  const result = await env.DB.prepare('SELECT * FROM tournament_groups WHERE id = ?').bind(groupId).first()
  return result ? row<TournamentGroup>(result) : null
}

export async function createGroup(env: DBEnv, params: {
  tournament_id: number; name: string | null; round: number;
  group_index: number; bo_n: number; layout: string
}): Promise<TournamentGroup> {
  const { tournament_id, name, round, group_index, bo_n, layout } = params
  const result = await env.DB.prepare(
    'INSERT INTO tournament_groups (tournament_id, name, round, group_index, bo_n, layout) VALUES (?, ?, ?, ?, ?, ?) RETURNING *'
  ).bind(tournament_id, name, round, group_index, bo_n, layout).first()
  return row<TournamentGroup>(result!)
}

export async function updateGroupStatus(env: DBEnv, groupId: number, status: string): Promise<void> {
  await env.DB.prepare('UPDATE tournament_groups SET status = ? WHERE id = ?').bind(status, groupId).run()
}

export async function deleteGroup(env: DBEnv, groupId: number): Promise<void> {
  await env.DB.prepare('DELETE FROM tournament_groups WHERE id = ?').bind(groupId).run()
}

export async function setGroupPlayers(env: DBEnv, groupId: number, playerIds: number[]): Promise<void> {
  await env.DB.prepare('DELETE FROM group_players WHERE group_id = ?').bind(groupId).run()
  for (const pid of playerIds) {
    await env.DB.prepare('INSERT INTO group_players (group_id, player_id) VALUES (?, ?)').bind(groupId, pid).run()
  }
}

export async function getGroupPlayerIds(env: DBEnv, groupId: number): Promise<number[]> {
  const result = await env.DB.prepare('SELECT player_id FROM group_players WHERE group_id = ?').bind(groupId).all()
  return rows<{ player_id: number }>(result.results).map(r => r.player_id)
}

export async function getGroupPlayers(env: DBEnv, groupId: number): Promise<(Player & { placement: number | null })[]> {
  const result = await env.DB.prepare(`
    SELECT p.*, 0 as placement FROM group_players gp
    JOIN players p ON p.id = gp.player_id
    WHERE gp.group_id = ? ORDER BY p.battle_tag
  `).bind(groupId).all()
  return rows<(Player & { placement: number | null })>(result.results)
}

export async function getEnrollments(env: DBEnv, tournamentId: number): Promise<(Enrollment & Player)[]> {
  const result = await env.DB.prepare(`
    SELECT e.*, p.battle_tag, p.display_name FROM enrollments e
    JOIN players p ON p.id = e.player_id
    WHERE e.tournament_id = ? ORDER BY e.created_at
  `).bind(tournamentId).all()
  return rows<(Enrollment & Player)>(result.results)
}

export async function enrollPlayer(env: DBEnv, tournamentId: number, playerId: number): Promise<void> {
  await env.DB.prepare(
    'INSERT OR IGNORE INTO enrollments (tournament_id, player_id) VALUES (?, ?)'
  ).bind(tournamentId, playerId).run()
}

export async function withdrawEnrollment(env: DBEnv, tournamentId: number, playerId: number): Promise<void> {
  await env.DB.prepare(
    'DELETE FROM enrollments WHERE tournament_id = ? AND player_id = ?'
  ).bind(tournamentId, playerId).run()
}

export async function getEnrollmentSettings(env: DBEnv, tournamentId: number): Promise<EnrollmentSettings | null> {
  const result = await env.DB.prepare('SELECT * FROM enrollment_settings WHERE tournament_id = ?').bind(tournamentId).first()
  return result ? row<EnrollmentSettings>(result) : null
}

export async function upsertEnrollmentSettings(env: DBEnv, s: EnrollmentSettings): Promise<void> {
  await env.DB.prepare(
    'INSERT OR REPLACE INTO enrollment_settings (tournament_id, enabled, deadline, max_slots) VALUES (?, ?, ?, ?)'
  ).bind(s.tournament_id, s.enabled, s.deadline, s.max_slots).run()
}

export async function createMatch(env: DBEnv, gameUuid: string, groupId: number, gameNumber: number): Promise<Match> {
  const result = await env.DB.prepare(
    'INSERT INTO matches (game_uuid, group_id, game_number) VALUES (?, ?, ?) RETURNING *'
  ).bind(gameUuid, groupId, gameNumber).first()
  return row<Match>(result!)
}

export async function getMatchesByGroup(env: DBEnv, groupId: number): Promise<Match[]> {
  const result = await env.DB.prepare(
    'SELECT * FROM matches WHERE group_id = ? ORDER BY game_number'
  ).bind(groupId).all()
  return rows<Match>(result.results)
}

export async function getMatchByUuid(env: DBEnv, gameUuid: string): Promise<Match | null> {
  const result = await env.DB.prepare('SELECT * FROM matches WHERE game_uuid = ?').bind(gameUuid).first()
  return result ? row<Match>(result) : null
}

export async function getMatchById(env: DBEnv, matchId: number): Promise<Match | null> {
  const result = await env.DB.prepare('SELECT * FROM matches WHERE id = ?').bind(matchId).first()
  return result ? row<Match>(result) : null
}

export async function completeMatch(env: DBEnv, matchId: number): Promise<void> {
  await env.DB.prepare(
    "UPDATE matches SET status = 'completed', completed_at = datetime('now') WHERE id = ?"
  ).bind(matchId).run()
}

export async function getPlacements(env: DBEnv, matchId: number): Promise<MatchPlacement[]> {
  const result = await env.DB.prepare(
    'SELECT * FROM match_placements WHERE match_id = ?'
  ).bind(matchId).all()
  return rows<MatchPlacement>(result.results)
}

export async function upsertPlacement(env: DBEnv, matchId: number, playerId: number, placement: number | null, enteredBy: number): Promise<void> {
  await env.DB.prepare(
    'INSERT OR REPLACE INTO match_placements (match_id, player_id, placement, entered_by) VALUES (?, ?, ?, ?)'
  ).bind(matchId, playerId, placement, enteredBy).run()
}

export async function initMatchPlacements(env: DBEnv, matchId: number, playerIds: number[]): Promise<void> {
  for (const pid of playerIds) {
    await env.DB.prepare(
      'INSERT OR IGNORE INTO match_placements (match_id, player_id) VALUES (?, ?)'
    ).bind(matchId, pid).run()
  }
}
