/**
 * D1 helper functions and data queries
 */

export const DEFAULT_SCORING_RULE = [9, 7, 6, 5, 4, 3, 2, 1];

export function calcPoints(placement: number, scoringRule?: number[] | null): number {
  const rule = scoringRule && scoringRule.length === 8 ? scoringRule : DEFAULT_SCORING_RULE;
  if (placement >= 1 && placement <= 8) return rule[placement - 1];
  return 0;
}

export function parseScoringRule(json: string | null): number[] {
  if (!json) return DEFAULT_SCORING_RULE;
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) && arr.length === 8 ? arr : DEFAULT_SCORING_RULE;
  } catch {
    return DEFAULT_SCORING_RULE;
  }
}

export function generateUuid(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map(b => b.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

// ── 排行榜查询 ──
export async function getPlayers(db: D1Database, season?: string | null) {
  let query = `
    SELECT
      mp.account_id_lo,
      lp.battle_tag,
      COALESCE(lp.display_name, mp.display_name, mp.battle_tag) as display_name,
      SUM(mp.points) as total_points,
      COUNT(*) as league_games,
      SUM(CASE WHEN mp.placement <= 4 THEN 1 ELSE 0 END) as wins,
      SUM(CASE WHEN mp.placement = 1 THEN 1 ELSE 0 END) as chickens,
      ROUND(AVG(mp.placement), 1) as avg_placement,
      ROUND(1.0 * SUM(CASE WHEN mp.placement <= 4 THEN 1 ELSE 0 END) / COUNT(*), 4) as win_rate,
      ROUND(1.0 * SUM(CASE WHEN mp.placement = 1 THEN 1 ELSE 0 END) / COUNT(*), 4) as chicken_rate,
      MAX(lm.ended_at) as last_game_at
    FROM match_players mp
    JOIN league_matches lm ON lm.id = mp.match_id
    LEFT JOIN league_players lp ON lp.battle_tag = mp.battle_tag
    WHERE lm.ended_at IS NOT NULL
      AND mp.points IS NOT NULL
      AND mp.account_id_lo IS NOT NULL
      AND mp.account_id_lo != ''
  `;
  const params: any[] = [];

  if (season && season !== 'all' && season !== 'current') {
    query += ' AND lm.season = ?';
    params.push(season);
  } else if (!season || season === 'current') {
    query += ' AND (lm.season IS NULL OR lm.season = \'\')';
  }

  query += `
    GROUP BY mp.account_id_lo
    ORDER BY total_points DESC
  `;

  const result = await db.prepare(query).bind(...params).all();
  return result.results || [];
}

// ── 选手详情 ──
export async function getPlayer(db: D1Database, battleTag: string, season?: string | null) {
  const lp = await db.prepare(
    'SELECT * FROM league_players WHERE battle_tag = ? OR display_name = ?'
  ).bind(battleTag, battleTag).first();

  if (!lp) return null;

  const realTag = (lp as any).battle_tag || battleTag;
  const realName = (lp as any).display_name || battleTag.split('#')[0];
  const accountIdLo = (lp as any).account_id_lo || null;

  let query = `
    SELECT
      SUM(mp.points) as total_points,
      COUNT(*) as league_games,
      SUM(CASE WHEN mp.placement <= 4 THEN 1 ELSE 0 END) as wins,
      SUM(CASE WHEN mp.placement = 1 THEN 1 ELSE 0 END) as chickens,
      ROUND(AVG(mp.placement), 1) as avg_placement,
      ROUND(1.0 * SUM(CASE WHEN mp.placement <= 4 THEN 1 ELSE 0 END) / COUNT(*), 4) as win_rate,
      ROUND(1.0 * SUM(CASE WHEN mp.placement = 1 THEN 1 ELSE 0 END) / COUNT(*), 4) as chicken_rate,
      MAX(lm.ended_at) as last_game_at
    FROM match_players mp
    JOIN league_matches lm ON lm.id = mp.match_id
    WHERE lm.ended_at IS NOT NULL
      AND mp.points IS NOT NULL
      AND (mp.account_id_lo = ? OR mp.battle_tag = ?)
  `;
  const params: any[] = [accountIdLo || '', realTag];

  if (season && season !== 'all' && season !== 'current') {
    query += ' AND lm.season = ?';
    params.push(season);
  } else if (!season || season === 'current') {
    query += ' AND (lm.season IS NULL OR lm.season = \'\')';
  }

  const stats = await db.prepare(query).bind(...params).first();

  return {
    battleTag: realTag,
    displayName: realName,
    accountIdLo: accountIdLo || '',
    totalPoints: (stats as any)?.total_points || 0,
    leagueGames: (stats as any)?.league_games || 0,
    wins: (stats as any)?.wins || 0,
    chickens: (stats as any)?.chickens || 0,
    avgPlacement: (stats as any)?.avg_placement || 0,
    winRate: (stats as any)?.win_rate || 0,
    chickenRate: (stats as any)?.chicken_rate || 0,
    lastGameAt: (stats as any)?.last_game_at || '',
  };
}

// ── 对局查询 ──
export async function getMatch(db: D1Database, gameUuid: string) {
  const match = await db.prepare(
    'SELECT * FROM league_matches WHERE game_uuid = ?'
  ).bind(gameUuid).first();

  if (!match) return null;

  const players = await db.prepare(
    'SELECT * FROM match_players WHERE match_id = ? ORDER BY placement ASC'
  ).bind((match as any).id).all();

  return { ...(match as any), players: players.results || [] };
}

export async function getPlayerMatches(db: D1Database, battleTag: string, accountIdLo?: string | null, limit = 50, season?: string | null) {
  let query = `
    SELECT lm.game_uuid, lm.ended_at, lm.status, lm.season,
           mp.hero_card_id, mp.hero_name, mp.placement, mp.points
    FROM match_players mp
    JOIN league_matches lm ON lm.id = mp.match_id
    WHERE lm.ended_at IS NOT NULL
      AND (mp.account_id_lo = ? OR mp.battle_tag = ?)
  `;
  const params: any[] = [accountIdLo || '', battleTag];

  if (season && season !== 'all' && season !== 'current') {
    query += ' AND lm.season = ?';
    params.push(season);
  } else if (!season || season === 'current') {
    query += ' AND (lm.season IS NULL OR lm.season = \'\')';
  }

  query += ' ORDER BY lm.ended_at DESC LIMIT ?';
  params.push(limit);

  const result = await db.prepare(query).bind(...params).all();
  return result.results || [];
}

export async function getCompletedMatches(db: D1Database, limit = 10, season?: string | null) {
  let query = `
    SELECT lm.* FROM league_matches lm
    WHERE lm.ended_at IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM match_players mp WHERE mp.match_id = lm.id AND mp.placement IS NULL
      )
  `;
  const params: any[] = [];

  if (season && season !== 'all' && season !== 'current') {
    query += ' AND lm.season = ?';
    params.push(season);
  } else if (!season || season === 'current') {
    query += ' AND (lm.season IS NULL OR lm.season = \'\')';
  }

  query += ' ORDER BY lm.ended_at DESC LIMIT ?';
  params.push(limit);

  const matches = await db.prepare(query).bind(...params).all();

  const results = [];
  for (const m of matches.results || []) {
    const players = await db.prepare(
      'SELECT * FROM match_players WHERE match_id = ? ORDER BY placement ASC'
    ).bind((m as any).id).all();
    results.push({ ...m, players: players.results || [] });
  }
  return results;
}

export async function getActiveGames(db: D1Database) {
  const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const result = await db.prepare(
    'SELECT * FROM league_matches WHERE ended_at IS NULL AND started_at >= ? ORDER BY started_at DESC'
  ).bind(cutoff).all();
  return result.results || [];
}

// ── 管理员判断 ──
export async function isAdmin(db: D1Database, battleTag: string): Promise<boolean> {
  const row = await db.prepare('SELECT 1 FROM league_admins WHERE battle_tag = ?').bind(battleTag).first();
  return !!row;
}

export async function isSuperAdmin(db: D1Database, battleTag: string): Promise<boolean> {
  const row = await db.prepare('SELECT is_super_admin FROM league_admins WHERE battle_tag = ?').bind(battleTag).first();
  return !!(row as any)?.is_super_admin;
}

// ── 默认管理员种子 ──
export async function seedDefaultAdmin(db: D1Database, hashPassword: (pw: string) => Promise<string>) {
  const existing = await db.prepare('SELECT 1 FROM league_admins LIMIT 1').first();
  if (existing) return;
  const hash = await hashPassword('ADMIN123');
  const now = nowIso();
  // 插入 league_players 表（登录需要）
  await db.prepare(
    'INSERT OR IGNORE INTO league_players (battle_tag, display_name, password_hash, created_at) VALUES (?, ?, ?, ?)'
  ).bind('admin#0000', '管理员', hash, now).run();
  // 插入 league_admins 表（权限需要）
  await db.prepare(
    'INSERT INTO league_admins (battle_tag, password_hash, is_super_admin, added_at) VALUES (?, ?, 1, ?)'
  ).bind('admin#0000', hash, now).run();
}
