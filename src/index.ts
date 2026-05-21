import { Hono } from 'hono';
import { html } from 'hono/html';
import { authMiddleware, requireAdmin, requireLogin } from './middleware';
import { createSession, hashPassword, verifyPassword, COOKIE_NAME, SESSION_DURATION } from './auth';
import { Layout } from './templates/layout';
import { seedDefaultAdmin, nowIso, generateUuid, calcPoints, getPlayers, getPlayer, getMatch, getPlayerMatches, getCompletedMatches, getActiveGames } from './db';

type Env = {
  Bindings: { DB: D1Database; SESSION_SECRET: string; SITE_NAME: string; WEB_VERSION: string };
  Variables: { user: { battleTag: string; displayName: string } | null; isAdmin: boolean; isSuperAdmin: boolean };
};

const app = new Hono<Env>();

// ── Global middleware ──
let adminSeeded = false;
app.use('*', async (c, next) => {
  if (!adminSeeded) {
    try {
      await seedDefaultAdmin(c.env.DB, hashPassword);
      adminSeeded = true;
    } catch (e) {
      console.error('Failed to seed admin:', e);
    }
  }
  await next();
});
app.use('*', authMiddleware);

// ── Helper: common layout props ──
async function layoutProps(c: any) {
  const db = c.env.DB;
  const activeGames = await getActiveGames(db);
  const playerCount = await db.prepare('SELECT COUNT(*) as cnt FROM league_players').first();
  return {
    activeCount: activeGames.length,
    playerCount: (playerCount as any)?.cnt || 0,
    currentUser: c.get('user'),
    isAdmin: c.get('isAdmin'),
    isSuperAdmin: c.get('isSuperAdmin'),
    siteName: c.env.SITE_NAME,
    webVersion: c.env.WEB_VERSION,
  };
}

// ══════════════════════════════════════════════════
// PAGES
// ══════════════════════════════════════════════════

// ── 首页: 对阵图 ──
app.get('/', async (c) => {
  const props = await layoutProps(c);
  const db = c.env.DB;

  // Get all tournaments with their groups and players
  const tournaments = new Map<string, any[]>();
  const groups = await db.prepare(
    `SELECT tg.*, GROUP_CONCAT(json_object(
      'battleTag', tgp.battle_tag,
      'displayName', tgp.display_name,
      'heroCardId', tgp.hero_card_id,
      'heroName', tgp.hero_name,
      'isEmpty', tgp.is_empty,
      'position', tgp.position
    )) as players_json
    FROM tournament_groups tg
    LEFT JOIN tournament_group_players tgp ON tgp.group_id = tg.id
    GROUP BY tg.id
    ORDER BY tg.tournament_name, tg.round, tg.group_index`
  ).all();

  // Get rankings for each group
  const groupIds = (groups.results || []).map((g: any) => g.id);
  const rankingsMap = new Map<string, any>();

  for (const g of groups.results || []) {
    if (g.rankings) {
      try { rankingsMap.set(String(g.id), JSON.parse(g.rankings as string)); } catch {}
    }
    const name = (g as any).tournament_name;
    if (!tournaments.has(name)) tournaments.set(name, []);
    const players = (g as any).players_json ? JSON.parse(`[${(g as any).players_json}]`) : [];
    tournaments.get(name)!.push({ ...(g as any), players });
  }

  const tournamentData = [...tournaments.entries()].map(([name, groups]) => {
    // Organize groups by round
    const rounds = new Map<number, any[]>();
    for (const g of groups) {
      const round = g.round || 1;
      if (!rounds.has(round)) rounds.set(round, []);
      rounds.get(round)!.push(g);
    }
    return { name, rounds: [...rounds.entries()].sort((a, b) => a[0] - b[0]) };
  });

  return c.html(Layout({
    ...props,
    title: props.siteName,
    children: renderBracket({ tournaments: tournamentData, rankingsMap, currentUser: props.currentUser }),
  }));
});

// ── 排行榜 ──
app.get('/leaderboard', async (c) => {
  const props = await layoutProps(c);
  const db = c.env.DB;
  const season = c.req.query('season') || 'current';
  const players = await getPlayers(db, season);
  const matches = await getCompletedMatches(db, 10, season);
  const seasons = await db.prepare('SELECT * FROM seasons ORDER BY id DESC').all();

  return c.html(Layout({
    ...props,
    title: `排行榜 — ${props.siteName}`,
    children: renderLeaderboard({ players, matches, seasons: seasons.results || [], filterSeason: season }),
  }));
});

// ── 对局详情 ──
app.get('/match/:uuid', async (c) => {
  const props = await layoutProps(c);
  const match = await getMatch(c.env.DB, c.req.param('uuid'));
  if (!match) return c.html(Layout({ ...props, title: '404', children: html`<div class="text-center py-12 text-hearth-dim">对局不存在</div>` }));

  return c.html(Layout({
    ...props,
    title: `对局详情 — ${props.siteName}`,
    children: renderMatch(match),
  }));
});

// ── 选手详情 ──
app.get('/player/:tag', async (c) => {
  const props = await layoutProps(c);
  const tag = decodeURIComponent(c.req.param('tag'));
  const season = c.req.query('season') || 'current';
  const player = await getPlayer(c.env.DB, tag, season);
  if (!player) return c.html(Layout({ ...props, title: '404', children: html`<div class="text-center py-12 text-hearth-dim">选手不存在</div>` }));

  const matches = await getPlayerMatches(c.env.DB, player.battleTag, player.accountIdLo || null, 50, season);
  const seasons = await c.env.DB.prepare('SELECT * FROM seasons ORDER BY id DESC').all();

  return c.html(Layout({
    ...props,
    title: `${player.displayName} — ${props.siteName}`,
    children: renderPlayer({ player, matches, seasons: seasons.results || [], filterSeason: season }),
  }));
});

// ── 登录/注册 ──
app.get('/register', async (c) => {
  const props = await layoutProps(c);
  return c.html(Layout({
    ...props,
    title: `登录 — ${props.siteName}`,
    children: renderRegister(),
  }));
});

// ── 报名 ──
app.get('/enroll', async (c) => {
  const props = await layoutProps(c);
  const db = c.env.DB;
  const enrollments = await db.prepare(
    'SELECT * FROM tournament_enrollments WHERE status = ? ORDER BY enrolled_at ASC'
  ).bind('enrolled').all();
  const settings = await db.prepare('SELECT * FROM enrollment_settings ORDER BY id DESC LIMIT 1').first();

  return c.html(Layout({
    ...props,
    title: `报名 — ${props.siteName}`,
    children: renderEnroll({ enrollments: enrollments.results || [], settings, currentUser: props.currentUser }),
  }));
});

// ── 管理面板 ──
app.get('/admin', requireLogin, requireAdmin, async (c) => {
  const props = await layoutProps(c);
  return c.html(Layout({
    ...props,
    title: `管理面板 — ${props.siteName}`,
    children: renderAdmin(props),
  }));
});

// ══════════════════════════════════════════════════
// API
// ══════════════════════════════════════════════════

// ── 认证 API ──
app.post('/api/register', async (c) => {
  try {
    const { battleTag, password } = await c.req.json();
    if (!battleTag || !password) return c.json({ ok: false, error: 'BattleTag 和密码不能为空' });
    if (password.length < 4) return c.json({ ok: false, error: '密码至少4位' });

    const db = c.env.DB;
    const existing = await db.prepare('SELECT 1 FROM league_players WHERE battle_tag = ?').bind(battleTag).first();
    if (existing) return c.json({ ok: false, error: '该 BattleTag 已注册' });

    const displayName = battleTag.split('#')[0];
    const hash = await hashPassword(password);
    const now = nowIso();
    await db.prepare(
      'INSERT INTO league_players (battle_tag, display_name, password_hash, created_at) VALUES (?, ?, ?, ?)'
    ).bind(battleTag, displayName, hash, now).run();

    const session = await createSession(c.env.SESSION_SECRET, {
      battleTag, displayName, exp: Date.now() + SESSION_DURATION,
    });

    c.header('Set-Cookie', `${COOKIE_NAME}=${encodeURIComponent(session)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DURATION / 1000}`);
    return c.json({ ok: true });
  } catch (e: any) {
    console.error('Register error:', e);
    return c.json({ ok: false, error: '服务器内部错误: ' + (e.message || 'unknown') });
  }
});

app.post('/api/login', async (c) => {
  try {
    const { battleTag, password } = await c.req.json();
    if (!battleTag || !password) return c.json({ ok: false, error: 'BattleTag 和密码不能为空' });

    const db = c.env.DB;
    const player = await db.prepare('SELECT * FROM league_players WHERE battle_tag = ?').bind(battleTag).first();
    if (!player || !(player as any).password_hash) return c.json({ ok: false, error: 'BattleTag 不存在或未设置密码' });

    const valid = await verifyPassword(password, (player as any).password_hash);
    if (!valid) return c.json({ ok: false, error: '密码错误' });

    await db.prepare('UPDATE league_players SET last_seen = ? WHERE battle_tag = ?').bind(nowIso(), battleTag).run();

    const session = await createSession(c.env.SESSION_SECRET, {
      battleTag, displayName: (player as any).display_name || battleTag, exp: Date.now() + SESSION_DURATION,
    });

    c.header('Set-Cookie', `${COOKIE_NAME}=${encodeURIComponent(session)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DURATION / 1000}`);
    return c.json({ ok: true, battleTag, displayName: (player as any).display_name });
  } catch (e: any) {
    console.error('Login error:', e);
    return c.json({ ok: false, error: '服务器内部错误: ' + (e.message || 'unknown') });
  }
});

app.post('/api/logout', (c) => {
  c.header('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  return c.json({ ok: true });
});

// ── 管理员 API: 手动录入对局 ──
app.post('/api/admin/match', requireLogin, requireAdmin, async (c) => {
  const body = await c.req.json();
  const { players, tournamentGroupId, season } = body;
  if (!players || !Array.isArray(players) || players.length < 2 || players.length > 8) {
    return c.json({ ok: false, error: '对局需要 2-8 名选手' });
  }

  const db = c.env.DB;
  const gameUuid = generateUuid();
  const now = nowIso();

  // 获取分组的积分规则
  let scoringRule: number[] | null = null;
  if (tournamentGroupId) {
    const tg = await db.prepare('SELECT scoring_rule FROM tournament_groups WHERE id = ?').bind(tournamentGroupId).first();
    if (tg && (tg as any).scoring_rule) {
      try { scoringRule = JSON.parse((tg as any).scoring_rule); } catch {}
    }
  }

  const matchResult = await db.prepare(
    'INSERT INTO league_matches (game_uuid, tournament_group_id, season, status, started_at, ended_at, manual_record) VALUES (?, ?, ?, ?, ?, ?, 1)'
  ).bind(gameUuid, tournamentGroupId || null, season || null, 'completed', now, now).run();

  const matchId = matchResult.meta.last_row_id;

  for (const p of players) {
    const points = calcPoints(p.placement, scoringRule);
    await db.prepare(
      'INSERT INTO match_players (match_id, battle_tag, account_id_lo, display_name, hero_card_id, hero_name, placement, points) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(matchId, p.battleTag, p.accountIdLo || null, p.displayName || p.battleTag, p.heroCardId || null, p.heroName || null, p.placement, points).run();
  }

  return c.json({ ok: true, gameUuid });
});

// ── 管理员 API: 编辑对局成绩 ──
app.post('/api/admin/match/:uuid/placement', requireLogin, requireAdmin, async (c) => {
  const uuid = c.req.param('uuid');
  const { placements } = await c.req.json();

  const db = c.env.DB;
  const match = await db.prepare('SELECT * FROM league_matches WHERE game_uuid = ?').bind(uuid).first();
  if (!match) return c.json({ ok: false, error: '对局不存在' });

  let scoringRule: number[] | null = null;
  if ((match as any).tournament_group_id) {
    const tg = await db.prepare('SELECT scoring_rule FROM tournament_groups WHERE id = ?').bind((match as any).tournament_group_id).first();
    if (tg && (tg as any).scoring_rule) {
      try { scoringRule = JSON.parse((tg as any).scoring_rule); } catch {}
    }
  }

  for (const p of placements) {
    const points = calcPoints(p.placement, scoringRule);
    await db.prepare(
      'UPDATE match_players SET placement = ?, points = ? WHERE match_id = ? AND battle_tag = ?'
    ).bind(p.placement, points, (match as any).id, p.battleTag).run();
  }

  return c.json({ ok: true });
});

// ── 管理员 API: 选手管理 ──
app.get('/api/admin/players', requireLogin, requireAdmin, async (c) => {
  const page = parseInt(c.req.query('page') || '1');
  const search = c.req.query('search') || '';
  const limit = 20;
  const offset = (page - 1) * limit;

  let query = 'SELECT * FROM league_players';
  let countQuery = 'SELECT COUNT(*) as cnt FROM league_players';
  const params: any[] = [];

  if (search) {
    query += ' WHERE battle_tag LIKE ? OR display_name LIKE ?';
    countQuery += ' WHERE battle_tag LIKE ? OR display_name LIKE ?';
    params.push(`%${search}%`, `%${search}%`);
  }

  query += ' ORDER BY id DESC LIMIT ? OFFSET ?';

  const total = await c.env.DB.prepare(countQuery).bind(...params).first();
  const players = await c.env.DB.prepare(query).bind(...params, limit, offset).all();

  return c.json({ ok: true, players: players.results, total: (total as any)?.cnt || 0, page, limit });
});

app.post('/api/admin/player', requireLogin, requireAdmin, async (c) => {
  const { battleTag, displayName, password, isSeed } = await c.req.json();
  if (!battleTag) return c.json({ ok: false, error: 'BattleTag 不能为空' });

  const db = c.env.DB;
  const existing = await db.prepare('SELECT 1 FROM league_players WHERE battle_tag = ?').bind(battleTag).first();
  if (existing) return c.json({ ok: false, error: '该 BattleTag 已存在' });

  const hash = password ? await hashPassword(password) : null;
  await db.prepare(
    'INSERT INTO league_players (battle_tag, display_name, password_hash, is_seed, created_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(battleTag, displayName || battleTag.split('#')[0], hash, isSeed ? 1 : 0, nowIso()).run();

  return c.json({ ok: true });
});

// ── 管理员 API: 赛季管理 ──
app.get('/api/admin/seasons', requireLogin, requireAdmin, async (c) => {
  const seasons = await c.env.DB.prepare('SELECT * FROM seasons ORDER BY id DESC').all();
  return c.json({ ok: true, seasons: seasons.results });
});

app.post('/api/admin/season', requireLogin, requireAdmin, async (c) => {
  const { name } = await c.req.json();
  if (!name) return c.json({ ok: false, error: '赛季名称不能为空' });

  const db = c.env.DB;
  const existing = await db.prepare('SELECT 1 FROM seasons WHERE name = ?').bind(name).first();
  if (existing) return c.json({ ok: false, error: '该赛季名称已存在' });

  await db.prepare('INSERT INTO seasons (name, status, created_at) VALUES (?, ?, ?)').bind(name, 'inactive', nowIso()).run();
  return c.json({ ok: true });
});

app.post('/api/admin/season/:id/activate', requireLogin, requireAdmin, async (c) => {
  const db = c.env.DB;
  await db.prepare('UPDATE seasons SET status = ?').bind('inactive').run();
  await db.prepare('UPDATE seasons SET status = ? WHERE id = ?').bind('active', c.req.param('id')).run();
  return c.json({ ok: true });
});

// ── 管理员 API: 赛事管理 ──
app.get('/api/admin/tournaments', requireLogin, requireAdmin, async (c) => {
  const groups = await c.env.DB.prepare(
    'SELECT DISTINCT tournament_name FROM tournament_groups ORDER BY tournament_name'
  ).all();
  return c.json({ ok: true, tournaments: groups.results || [] });
});

app.post('/api/admin/tournament/group', requireLogin, requireAdmin, async (c) => {
  const body = await c.req.json();
  const { tournamentName, round, groupIndex, layout, boN, scoringRule, advancementRule, players } = body;

  if (!tournamentName) return c.json({ ok: false, error: '赛事名称不能为空' });

  const db = c.env.DB;
  const now = nowIso();

  const result = await db.prepare(
    'INSERT INTO tournament_groups (tournament_name, round, group_index, layout, bo_n, scoring_rule, advancement_rule, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(tournamentName, round || 1, groupIndex || 1, layout || 'bracket', boN || 1, scoringRule ? JSON.stringify(scoringRule) : null, advancementRule || 'chicken', 'waiting', now).run();

  const groupId = result.meta.last_row_id;

  if (players && Array.isArray(players)) {
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      await db.prepare(
        'INSERT INTO tournament_group_players (group_id, battle_tag, account_id_lo, display_name, hero_card_id, hero_name, is_empty, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(groupId, p.battleTag || null, p.accountIdLo || null, p.displayName || '待定', p.heroCardId || null, p.heroName || null, p.isEmpty ? 1 : 0, i).run();
    }
  }

  return c.json({ ok: true, groupId });
});

// ── 报名 API ──
app.post('/api/enroll', requireLogin, async (c) => {
  const user = c.get('user')!;
  const db = c.env.DB;

  const existing = await db.prepare(
    'SELECT * FROM tournament_enrollments WHERE battle_tag = ? AND status = ?'
  ).bind(user.battleTag, 'enrolled').first();
  if (existing) return c.json({ ok: false, error: '你已经报名了' });

  const settings = await db.prepare('SELECT * FROM enrollment_settings ORDER BY id DESC LIMIT 1').first();
  if (settings && !(settings as any).is_open) return c.json({ ok: false, error: '报名已关闭' });

  const count = await db.prepare('SELECT COUNT(*) as cnt FROM tournament_enrollments WHERE status = ?').bind('enrolled').first();
  const enrolledSlots = settings ? (settings as any).enrolled_slots : 896;
  const waitlistSlots = settings ? (settings as any).waitlist_slots : 128;
  const totalSlots = enrolledSlots + waitlistSlots;
  const pos = (count as any)?.cnt || 0;

  if (pos >= totalSlots) return c.json({ ok: false, error: '报名已满' });

  const status = pos < enrolledSlots ? 'enrolled' : 'waitlisted';
  const position = pos + 1;

  await db.prepare(
    'INSERT INTO tournament_enrollments (battle_tag, display_name, status, enrolled_at, position) VALUES (?, ?, ?, ?, ?)'
  ).bind(user.battleTag, user.displayName, status, nowIso(), position).run();

  return c.json({ ok: true, status, position });
});

app.post('/api/enroll/withdraw', requireLogin, async (c) => {
  const user = c.get('user')!;
  const db = c.env.DB;

  await db.prepare(
    'UPDATE tournament_enrollments SET status = ?, withdrawn_at = ? WHERE battle_tag = ? AND status IN (?, ?)'
  ).bind('withdrawn', nowIso(), user.battleTag, 'enrolled', 'waitlisted').run();

  return c.json({ ok: true });
});

// ── 排行榜 API ──
app.get('/api/players', async (c) => {
  const season = c.req.query('season') || 'current';
  const players = await getPlayers(c.env.DB, season);
  return c.json({ ok: true, players });
});

app.get('/api/matches', async (c) => {
  const season = c.req.query('season') || 'current';
  const matches = await getCompletedMatches(c.env.DB, 10, season);
  return c.json({ ok: true, matches });
});

app.get('/api/active-games', async (c) => {
  const games = await getActiveGames(c.env.DB);
  return c.json({ ok: true, games });
});



// ── 管理员: 补录对局页面 ──
app.get('/admin/match/new', requireLogin, requireAdmin, async (c) => {
  const props = await layoutProps(c);
  const players = await c.env.DB.prepare('SELECT battle_tag, display_name FROM league_players ORDER BY display_name').all();
  return c.html(Layout({
    ...props,
    title: `补录对局 — ${props.siteName}`,
    children: renderMatchEdit({ match: null, players: players.results || [], editMode: false }),
  }));
});

// ── 管理员: 编辑对局页面 ──
app.get('/admin/match/:uuid/edit', requireLogin, requireAdmin, async (c) => {
  const props = await layoutProps(c);
  const uuid = c.req.param('uuid');
  const db = c.env.DB;
  const match = await db.prepare('SELECT * FROM league_matches WHERE game_uuid = ?').bind(uuid).first();
  if (!match) return c.html(Layout({ ...props, title: '404', children: html`<div class="text-center py-12 text-hearth-dim">对局不存在</div>` }));

  const matchPlayers = await db.prepare(
    'SELECT * FROM match_players WHERE match_id = ? ORDER BY placement ASC NULLS LAST'
  ).bind((match as any).id).all();

  const allPlayers = await db.prepare('SELECT battle_tag, display_name FROM league_players ORDER BY display_name').all();

  return c.html(Layout({
    ...props,
    title: `编辑对局 — ${props.siteName}`,
    children: renderMatchEdit({
      match: { ...(match as any), players: matchPlayers.results || [] },
      players: allPlayers.results || [],
      editMode: true,
    }),
  }));
});

// ── 管理员 API: 创建补录对局 ──
app.post('/api/admin/match/create', requireLogin, requireAdmin, async (c) => {
  const body = await c.req.json();
  const { players, tournamentGroupId, season } = body;
  if (!players || !Array.isArray(players) || players.length < 2 || players.length > 8) {
    return c.json({ ok: false, error: '对局需要 2-8 名选手' });
  }

  const db = c.env.DB;
  const gameUuid = generateUuid();
  const now = nowIso();

  let scoringRule: number[] | null = null;
  if (tournamentGroupId) {
    const tg = await db.prepare('SELECT scoring_rule FROM tournament_groups WHERE id = ?').bind(tournamentGroupId).first();
    if (tg && (tg as any).scoring_rule) {
      try { scoringRule = JSON.parse((tg as any).scoring_rule); } catch {}
    }
  }

  const matchResult = await db.prepare(
    'INSERT INTO league_matches (game_uuid, tournament_group_id, season, status, started_at, ended_at, manual_record) VALUES (?, ?, ?, ?, ?, ?, 1)'
  ).bind(gameUuid, tournamentGroupId || null, season || null, 'completed', now, now).run();

  const matchId = matchResult.meta.last_row_id;

  for (const p of players) {
    const points = calcPoints(p.placement, scoringRule);
    await db.prepare(
      'INSERT INTO match_players (match_id, battle_tag, account_id_lo, display_name, hero_card_id, hero_name, placement, points) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(matchId, p.battleTag || null, p.accountIdLo || null, p.displayName || '', p.heroCardId || null, p.heroName || null, p.placement, points).run();
  }

  return c.json({ ok: true, gameUuid });
});

// ── 管理员 API: 编辑对局排名 ──
app.put('/api/admin/match/:uuid/edit-placement', requireLogin, requireAdmin, async (c) => {
  const uuid = c.req.param('uuid');
  const { placements } = await c.req.json();
  if (!placements || !Array.isArray(placements)) return c.json({ ok: false, error: '缺少排名数据' });

  const db = c.env.DB;
  const match = await db.prepare('SELECT * FROM league_matches WHERE game_uuid = ?').bind(uuid).first();
  if (!match) return c.json({ ok: false, error: '对局不存在' });

  let scoringRule: number[] | null = null;
  if ((match as any).tournament_group_id) {
    const tg = await db.prepare('SELECT scoring_rule FROM tournament_groups WHERE id = ?').bind((match as any).tournament_group_id).first();
    if (tg && (tg as any).scoring_rule) {
      try { scoringRule = JSON.parse((tg as any).scoring_rule); } catch {}
    }
  }

  for (const p of placements) {
    if (p.placement == null) continue;
    const points = calcPoints(p.placement, scoringRule);
    await db.prepare(
      'UPDATE match_players SET placement = ?, points = ? WHERE match_id = ? AND id = ?'
    ).bind(p.placement, points, (match as any).id, p.playerId).run();
  }

  return c.json({ ok: true });
});

// ── 管理员 API: 修改英雄 ──
app.put('/api/admin/match/:uuid/update-hero', requireLogin, requireAdmin, async (c) => {
  const uuid = c.req.param('uuid');
  const { playerId, heroCardId, heroName } = await c.req.json();
  if (!playerId) return c.json({ ok: false, error: '缺少 playerId' });

  const db = c.env.DB;
  const match = await db.prepare('SELECT * FROM league_matches WHERE game_uuid = ?').bind(uuid).first();
  if (!match) return c.json({ ok: false, error: '对局不存在' });

  await db.prepare(
    'UPDATE match_players SET hero_card_id = ?, hero_name = ? WHERE match_id = ? AND id = ?'
  ).bind(heroCardId || null, heroName || null, (match as any).id, playerId).run();

  return c.json({ ok: true });
});

// ── 静态资源 ──
app.get('/public/*', async (c) => {
  return c.text('Not Found', 404);
});

// ── 404 ──
app.notFound(async (c) => {
  const props = await layoutProps(c);
  return c.html(Layout({
    ...props,
    title: '404',
    children: html`<div class="text-center py-12"><h1 class="text-4xl font-bold text-hearth-gold mb-4">404</h1><p class="text-hearth-dim">页面不存在</p><a href="/" class="text-hearth-gold hover:text-hearth-accent mt-4 inline-block">返回首页</a></div>`,
  }));
});

// ── 错误处理 ──
app.onError(async (err, c) => {
  console.error(err);
  const props = await layoutProps(c);
  return c.html(Layout({
    ...props,
    title: '500',
    children: html`<div class="text-center py-12"><h1 class="text-4xl font-bold text-red-400 mb-4">500</h1><p class="text-hearth-dim">服务器错误</p></div>`,
  }));
});

export default app;

// ══════════════════════════════════════════════════
// TEMPLATE RENDERERS (inline for now, will be split into separate files later)
// ══════════════════════════════════════════════════

function renderRegister() {
  return html`
    <div class="max-w-md mx-auto">
      <div class="bg-hearth-card rounded-xl gold-border p-6">
        <h2 class="text-xl font-bold text-hearth-gold mb-4 text-center">登录 / 注册</h2>
        <div class="flex gap-2 mb-4">
          <button onclick="switchAuthTab('login')" id="tab-login" class="flex-1 py-2 text-sm rounded-lg bg-hearth-gold/20 text-hearth-gold transition">登录</button>
          <button onclick="switchAuthTab('register')" id="tab-register" class="flex-1 py-2 text-sm rounded-lg bg-white/5 text-hearth-dim transition">注册</button>
        </div>
        <form id="loginForm" onsubmit="return handleLogin(event)">
          <div class="mb-3">
            <label class="text-xs text-hearth-dim block mb-1">BattleTag</label>
            <input type="text" name="battleTag" required placeholder="玩家#1234" class="w-full bg-black/30 border border-hearth-border rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-hearth-gold/50">
          </div>
          <div class="mb-4">
            <label class="text-xs text-hearth-dim block mb-1">密码</label>
            <input type="password" name="password" required class="w-full bg-black/30 border border-hearth-border rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-hearth-gold/50">
          </div>
          <button type="submit" class="w-full py-2 bg-hearth-gold/20 text-hearth-gold rounded-lg hover:bg-hearth-gold/30 transition">登录</button>
        </form>
        <form id="registerForm" class="hidden" onsubmit="return handleRegister(event)">
          <div class="mb-3">
            <label class="text-xs text-hearth-dim block mb-1">BattleTag</label>
            <input type="text" name="battleTag" required placeholder="玩家#1234" class="w-full bg-black/30 border border-hearth-border rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-hearth-gold/50">
          </div>
          <div class="mb-4">
            <label class="text-xs text-hearth-dim block mb-1">密码</label>
            <input type="password" name="password" required class="w-full bg-black/30 border border-hearth-border rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-hearth-gold/50">
          </div>
          <button type="submit" class="w-full py-2 bg-hearth-gold/20 text-hearth-gold rounded-lg hover:bg-hearth-gold/30 transition">注册</button>
        </form>
        <p id="authError" class="text-red-400 text-xs mt-2 text-center hidden"></p>
      </div>
    </div>
    <script>
    function switchAuthTab(tab) {
      document.getElementById('loginForm').classList.toggle('hidden', tab !== 'login');
      document.getElementById('registerForm').classList.toggle('hidden', tab !== 'register');
      document.getElementById('tab-login').className = tab === 'login' ? 'flex-1 py-2 text-sm rounded-lg bg-hearth-gold/20 text-hearth-gold transition' : 'flex-1 py-2 text-sm rounded-lg bg-white/5 text-hearth-dim transition';
      document.getElementById('tab-register').className = tab === 'register' ? 'flex-1 py-2 text-sm rounded-lg bg-hearth-gold/20 text-hearth-gold transition' : 'flex-1 py-2 text-sm rounded-lg bg-white/5 text-hearth-dim transition';
    }
    async function handleLogin(e) {
      e.preventDefault();
      const form = e.target;
      const battleTag = form.battleTag.value;
      const password = form.password.value;
      try {
        const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ battleTag, password }) });
        if (!res.ok) { showError('服务器错误 (' + res.status + ')'); return false; }
        const data = await res.json();
        if (data.ok) { window.location.href = '/'; }
        else { showError(data.error); }
      } catch(e) { showError('请求失败: ' + e.message); }
      return false;
    }
    async function handleRegister(e) {
      e.preventDefault();
      const form = e.target;
      const battleTag = form.battleTag.value;
      const password = form.password.value;
      try {
        const res = await fetch('/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ battleTag, password }) });
        if (!res.ok) { showError('服务器错误 (' + res.status + ')'); return false; }
        const data = await res.json();
        if (data.ok) { window.location.href = '/'; }
        else { showError(data.error); }
      } catch(e) { showError('请求失败: ' + e.message); }
      return false;
    }
    function showError(msg) {
      const el = document.getElementById('authError');
      el.textContent = msg;
      el.classList.remove('hidden');
    }
    </script>
  `;
}

function renderLeaderboard({ players, matches, seasons, filterSeason }: any) {
  return html`
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div class="lg:col-span-2">
        <div class="bg-hearth-card rounded-xl gold-border overflow-hidden">
          <div class="px-5 py-3 border-b border-hearth-border flex items-center justify-between flex-wrap gap-2">
            <h2 class="text-lg font-bold text-hearth-gold">🏆 排行榜</h2>
            <div class="flex items-center gap-2">
              <select onchange="window.location.href='/leaderboard?season='+this.value" class="bg-black/30 border border-hearth-border rounded px-2 py-1 text-sm text-gray-200 focus:outline-none focus:border-hearth-gold/50 transition cursor-pointer">
                <option value="current" ${filterSeason === 'current' ? 'selected' : ''}>当前赛季</option>
                <option value="all" ${filterSeason === 'all' ? 'selected' : ''}>全部</option>
                ${seasons.map((s: any) => html`<option value="${s.name}" ${s.name === filterSeason ? 'selected' : ''}>${s.name}</option>`)}
              </select>
              <span class="text-xs text-hearth-dim">共 ${players.length} 人</span>
            </div>
          </div>
          <div class="px-4 py-2 border-b border-hearth-border">
            <input type="text" id="playerSearch" placeholder="搜索玩家..." oninput="currentPage=1;renderList()"
              class="w-full bg-black/30 border border-hearth-border rounded px-3 py-1.5 text-sm text-gray-200 placeholder-hearth-dim focus:outline-none focus:border-hearth-gold/50 transition">
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-hearth-dim text-xs uppercase tracking-wider border-b border-hearth-border">
                  <th class="px-4 py-3 text-center w-12">#</th>
                  <th class="px-4 py-3 text-left sort-btn" onclick="sortBy('display_name')">玩家</th>
                  <th class="px-4 py-3 text-right sort-btn" onclick="sortBy('total_points')">积分</th>
                  <th class="px-4 py-3 text-right sort-btn hide-sm" onclick="sortBy('league_games')">场次</th>
                  <th class="px-4 py-3 text-right sort-btn hide-sm" onclick="sortBy('win_rate')">胜率</th>
                  <th class="px-4 py-3 text-right sort-btn hide-md" onclick="sortBy('avg_placement')">场均</th>
                  <th class="px-4 py-3 text-right sort-btn hide-md" onclick="sortBy('chickens')">鸡</th>
                  <th class="px-4 py-3 text-right sort-btn hide-lg" onclick="sortBy('chicken_rate')">鸡率</th>
                </tr>
              </thead>
              <tbody id="leaderboardBody" class="divide-y divide-hearth-border/50"></tbody>
            </table>
          </div>
          <div id="leaderboardPager" class="px-4 py-3 flex items-center justify-center gap-1 border-t border-hearth-border"></div>
        </div>
      </div>
      <div>
        <div class="bg-hearth-card rounded-xl gold-border overflow-hidden">
          <div class="px-5 py-3 border-b border-hearth-border">
            <h3 class="text-sm font-bold text-hearth-gold">📋 最近对局</h3>
          </div>
          <div class="divide-y divide-hearth-border">
            ${matches.length === 0 ? html`<div class="px-5 py-4 text-center text-sm text-hearth-dim">暂无对局</div>` : ''}
            ${matches.slice(0, 10).map((m: any) => html`
              <a href="/match/${m.game_uuid}" class="block px-4 py-3 hover:bg-white/5 transition">
                <div class="grid grid-cols-2 gap-1">
                  ${(m.players || []).filter((p: any) => p.placement != null).map((p: any) => html`
                    <div class="flex items-center gap-1 px-1 py-0.5 rounded bg-white/5">
                      ${p.hero_card_id ? html`
                        <div class="w-5 h-5 rounded-full overflow-hidden flex-shrink-0 bg-hearth-card">
                          <img src="https://art.hearthstonejson.com/v1/256x/${p.hero_card_id}.jpg" alt="" class="w-full h-full object-cover" onerror="this.closest('div').style.display='none'">
                        </div>
                      ` : ''}
                      <div class="min-w-0 flex-1">
                        <div class="text-xs truncate">${p.display_name}</div>
                        <div class="text-[10px] text-hearth-dim">第${p.placement}名 <span class="${p.points > 0 ? 'text-hearth-gold' : 'text-hearth-dim'}">+${p.points}</span></div>
                      </div>
                    </div>
                  `)}
                </div>
              </a>
            `)}
          </div>
        </div>
      </div>
    </div>
    <script>
    const allPlayers = ${JSON.stringify(players)};
    let currentPage = 1;
    let sortKey = 'total_points';
    let sortDir = -1;
    const pageSize = 20;

    function sortBy(key) {
      if (sortKey === key) sortDir *= -1;
      else { sortKey = key; sortDir = key === 'display_name' ? 1 : -1; }
      currentPage = 1;
      renderList();
    }

    function renderList() {
      const search = (document.getElementById('playerSearch')?.value || '').toLowerCase();
      let filtered = allPlayers;
      if (search) filtered = filtered.filter(p => (p.display_name || '').toLowerCase().includes(search) || (p.battle_tag || '').toLowerCase().includes(search));

      filtered.sort((a, b) => {
        const av = a[sortKey] ?? 0, bv = b[sortKey] ?? 0;
        if (typeof av === 'string') return sortDir * av.localeCompare(bv);
        return sortDir * (av - bv);
      });

      const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
      if (currentPage > totalPages) currentPage = totalPages;
      const start = (currentPage - 1) * pageSize;
      const page = filtered.slice(start, start + pageSize);

      const tbody = document.getElementById('leaderboardBody');
      tbody.innerHTML = page.map((p, i) => {
        const rank = start + i + 1;
        const rankClass = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : 'text-hearth-dim';
        return '<tr class="hover:bg-white/5 transition">' +
          '<td class="px-4 py-3 text-center font-bold ' + rankClass + '">' + rank + '</td>' +
          '<td class="px-4 py-3"><a href="/player/' + encodeURIComponent(p.battle_tag) + '" class="text-hearth-gold hover:text-hearth-accent transition">' + (p.display_name || p.battle_tag) + '</a></td>' +
          '<td class="px-4 py-3 text-right font-bold text-hearth-gold">' + p.total_points + '</td>' +
          '<td class="px-4 py-3 text-right hide-sm">' + p.league_games + '</td>' +
          '<td class="px-4 py-3 text-right hide-sm">' + (p.win_rate * 100).toFixed(1) + '%</td>' +
          '<td class="px-4 py-3 text-right hide-md">' + (p.avg_placement || 0).toFixed(1) + '</td>' +
          '<td class="px-4 py-3 text-right hide-md">' + p.chickens + '</td>' +
          '<td class="px-4 py-3 text-right hide-lg">' + (p.chicken_rate * 100).toFixed(1) + '%</td>' +
          '</tr>';
      }).join('');

      const pager = document.getElementById('leaderboardPager');
      if (totalPages <= 1) { pager.innerHTML = ''; return; }
      let btns = '';
      for (let p = 1; p <= totalPages; p++) {
        btns += '<button onclick="currentPage=' + p + ';renderList()" class="px-3 py-1 text-sm rounded ' + (p === currentPage ? 'bg-hearth-gold/20 text-hearth-gold' : 'text-hearth-dim hover:text-hearth-gold') + '">' + p + '</button>';
      }
      pager.innerHTML = btns;
    }
    renderList();
    </script>
  `;
}

function renderBracket({ tournaments, rankingsMap, currentUser }: any) {
  if (tournaments.length === 0) {
    return html`
      <div class="text-center py-12">
        <h1 class="text-2xl font-bold text-hearth-gold mb-4">🍺 对阵图</h1>
        <p class="text-hearth-dim">暂无赛事</p>
        <div class="flex justify-center gap-4 mt-6">
          <a href="/leaderboard" class="px-6 py-2 bg-hearth-gold/20 text-hearth-gold rounded-lg hover:bg-hearth-gold/30 transition">🏆 排行榜</a>
          <a href="/enroll" class="px-6 py-2 bg-hearth-gold/20 text-hearth-gold rounded-lg hover:bg-hearth-gold/30 transition">📝 报名</a>
        </div>
      </div>
    `;
  }

  return html`
    <style>
      .bracket-tournament { margin-bottom: 2rem; }
      .bracket-tournament h2 { font-size: 1.25rem; font-weight: 700; color: #e2b714; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid #2a2a4a; }
      .bracket-round { margin-bottom: 1rem; }
      .bracket-round-title { font-size: 0.875rem; font-weight: 600; color: #8b8b9e; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 0.5rem; padding: 0.25rem 0.75rem; background: rgba(0,0,0,0.2); border-radius: 0.375rem; display: inline-block; }
      .bracket-round-title.gold { color: #e2b714; border: 1px solid rgba(226,183,20,0.3); background: linear-gradient(160deg, #1e1a0e, #16213e); }
      .bracket-groups { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 0.75rem; }
      @media (max-width: 640px) { .bracket-groups { grid-template-columns: 1fr; } }
      .group-card { background: #16213e; border: 1px solid rgba(226,183,20,0.3); border-radius: 0.75rem; overflow: hidden; transition: border-color 0.2s; }
      .group-card:hover { border-color: rgba(226,183,20,0.6); }
      .group-card.active { border-color: rgba(52,211,153,0.5); box-shadow: 0 0 12px rgba(52,211,153,0.08); }
      .group-card.done { border-color: rgba(42,42,74,0.5); }
      .g-head { display: flex; align-items: center; justify-content: space-between; padding: 7px 12px; background: rgba(0,0,0,0.15); border-bottom: 1px solid #2a2a4a; font-size: 12px; font-weight: 600; }
      .g-head .name { color: #e2b714; }
      .g-head .right { display: flex; align-items: center; gap: 6px; }
      .g-head .bo-info { font-size: 10px; color: #8b8b9e; font-weight: 500; }
      .badge { font-size: 10px; padding: 2px 7px; border-radius: 3px; font-weight: 700; }
      .badge.active { background: rgba(52,211,153,0.14); color: #34d399; }
      .badge.done { background: rgba(139,139,158,0.1); color: #8b8b9e; }
      .badge.waiting { background: rgba(226,183,20,0.1); color: #c9a84c; }
      .p-row { display: flex; align-items: center; padding: 0 12px; height: 40px; font-size: 13px; color: #d1d5db; border-bottom: 1px solid rgba(42,42,74,0.4); }
      .p-row:last-child { border-bottom: none; }
      .p-row .pos { width: 20px; font-weight: 700; font-size: 11px; color: #8b8b9e; text-align: center; flex-shrink: 0; }
      .p-row .pos.g { color: #ffd700; }
      .p-row .pos.s { color: #c0c0c0; }
      .p-row .pos.b { color: #cd7f32; }
      .p-row .nm { flex: 1; margin-left: 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .p-row .nm.empty { color: #8b8b9e; font-style: italic; }
      .p-row .nm a { color: inherit; text-decoration: none; transition: color .15s; }
      .p-row .nm a:hover { color: #e2b714; }
      .p-row .pts { font-size: 11px; font-weight: 700; color: #e2b714; margin-left: 4px; flex-shrink: 0; }
      .p-row.q .pos { color: #34d399; }
      .p-row.q .nm { color: #34d399; }
      .p-row.el .nm { color: #8b8b9e; }
    </style>

    ${tournaments.map((t: any) => html`
      <div class="bracket-tournament">
        <h2>🏆 ${t.name}</h2>
        ${t.rounds.map(([roundNum, groups]: [number, any[]]) => html`
          <div class="bracket-round">
            <div class="bracket-round-title ${roundNum === t.rounds[t.rounds.length - 1][0] ? 'gold' : ''}">
              第 ${roundNum} 轮
            </div>
            <div class="bracket-groups">
              ${groups.map((g: any) => {
                const rankings = rankingsMap.get(String(g.id)) || {};
                const statusClass = g.status === 'active' ? 'active' : g.status === 'done' ? 'done' : '';
                const statusBadge = g.status === 'active' ? 'active' : g.status === 'done' ? 'done' : 'waiting';
                const statusText = g.status === 'active' ? '进行中' : g.status === 'done' ? '已结束' : '等待中';
                const isFinal = roundNum === t.rounds[t.rounds.length - 1][0];
                return html`
                  <div class="group-card ${statusClass} ${isFinal ? 'final' : ''}">
                    <div class="g-head">
                      <span class="name">R${roundNum} G${g.group_index}</span>
                      <div class="right">
                        ${g.bo_n > 1 ? html`<span class="bo-info">BO${g.bo_n}</span>` : ''}
                        <span class="badge ${statusBadge}">${statusText}</span>
                      </div>
                    </div>
                    ${g.players.map((p: any, i: number) => {
                      if (p.isEmpty || !p.battleTag) {
                        return html`<div class="p-row"><span class="pos">${i + 1}</span><span class="nm empty">待定</span></div>`;
                      }
                      const rank = rankings[p.accountIdLo || p.battleTag];
                      const isQualified = rank?.qualified;
                      const isEliminated = rank?.eliminated;
                      const pts = rank?.totalPoints;
                      const posClass = i === 0 ? 'g' : i === 1 ? 's' : i === 2 ? 'b' : '';
                      const rowClass = isQualified ? 'q' : isEliminated ? 'el' : '';
                      const isMe = currentUser && currentUser.battleTag === p.battleTag;
                      return html`
                        <div class="p-row ${rowClass}">
                          <span class="pos ${posClass}">${rank?.placement || i + 1}</span>
                          ${p.heroCardId ? html`
                            <div style="width:28px;height:28px;border-radius:50%;overflow:hidden;flex-shrink:0;background:#16213e">
                              <img src="https://art.hearthstonejson.com/v1/256x/${p.heroCardId}.jpg" alt="" style="width:100%;height:100%;object-fit:cover" onerror="this.closest('div').style.display='none'">
                            </div>
                          ` : ''}
                          <span class="nm">
                            <a href="/player/${encodeURIComponent(p.battleTag)}" style="${isMe ? 'color:#ffd700;font-weight:700' : ''}">${p.displayName || p.battleTag}</a>
                          </span>
                          ${pts != null ? html`<span class="pts">${pts}</span>` : ''}
                        </div>
                      `;
                    })}
                  </div>
                `;
              })}
            </div>
          </div>
        `)}
      </div>
    `)}
  `;
}

function renderMatch(match: any) {
  const players = (match.players || []).sort((a: any, b: any) => (a.placement || 999) - (b.placement || 999));
  return html`
    <div class="max-w-2xl mx-auto">
      <div class="bg-hearth-card rounded-xl gold-border overflow-hidden">
        <div class="px-5 py-3 border-b border-hearth-border flex items-center justify-between">
          <h2 class="text-lg font-bold text-hearth-gold">对局详情</h2>
          <span class="text-xs text-hearth-dim">${match.game_uuid?.substring(0, 8).toUpperCase()}</span>
        </div>
        <div class="divide-y divide-hearth-border">
          ${players.map((p: any) => html`
            <div class="px-5 py-3 flex items-center gap-3">
              <span class="text-lg font-bold w-8 text-center ${p.placement === 1 ? 'text-yellow-400' : p.placement === 2 ? 'text-gray-300' : p.placement === 3 ? 'text-orange-400' : 'text-hearth-dim'}">
                ${p.placement || '-'}
              </span>
              ${p.hero_card_id ? html`
                <div class="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-hearth-card">
                  <img src="https://art.hearthstonejson.com/v1/256x/${p.hero_card_id}.jpg" alt="" class="w-full h-full object-cover" onerror="this.closest('div').style.display='none'">
                </div>
              ` : ''}
              <div class="flex-1">
                <a href="/player/${encodeURIComponent(p.battle_tag)}" class="text-hearth-gold hover:text-hearth-accent transition">${p.display_name || p.battle_tag}</a>
                ${p.hero_name ? html`<span class="text-xs text-hearth-dim ml-2">${p.hero_name}</span>` : ''}
              </div>
              <span class="font-bold ${p.points > 0 ? 'text-hearth-gold' : 'text-hearth-dim'}">+${p.points || 0}</span>
            </div>
          `)}
        </div>
        <div class="px-5 py-3 border-t border-hearth-border text-xs text-hearth-dim">
          ${match.ended_at ? `结束于 ${new Date(match.ended_at).toLocaleString('zh-CN')}` : '进行中'}
          ${match.tournament_group_id ? ' · 赛事对局' : ''}
          ${match.manual_record ? ' · 手动录入' : ''}
        </div>
      </div>
    </div>
  `;
}

function renderPlayer({ player, matches, seasons, filterSeason }: any) {
  return html`
    <div class="max-w-4xl mx-auto">
      <div class="bg-hearth-card rounded-xl gold-border overflow-hidden mb-4">
        <div class="px-5 py-4 border-b border-hearth-border flex items-center justify-between">
          <h2 class="text-xl font-bold text-hearth-gold">${player.displayName}</h2>
          <span class="text-sm text-hearth-dim">${player.battleTag}</span>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5">
          <div class="text-center"><div class="text-2xl font-bold text-hearth-gold">${player.totalPoints}</div><div class="text-xs text-hearth-dim">总积分</div></div>
          <div class="text-center"><div class="text-2xl font-bold text-hearth-gold">${player.leagueGames}</div><div class="text-xs text-hearth-dim">总场次</div></div>
          <div class="text-center"><div class="text-2xl font-bold text-hearth-gold">${(player.winRate * 100).toFixed(1)}%</div><div class="text-xs text-hearth-dim">胜率 (前四)</div></div>
          <div class="text-center"><div class="text-2xl font-bold text-hearth-gold">${player.chickens}</div><div class="text-xs text-hearth-dim">吃鸡</div></div>
        </div>
      </div>

      <div class="bg-hearth-card rounded-xl gold-border overflow-hidden">
        <div class="px-5 py-3 border-b border-hearth-border flex items-center justify-between">
          <h3 class="text-sm font-bold text-hearth-gold">对局历史</h3>
          <select onchange="window.location.href='/player/${encodeURIComponent(player.battleTag)}?season='+this.value" class="bg-black/30 border border-hearth-border rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-hearth-gold/50 transition cursor-pointer">
            <option value="current" ${filterSeason === 'current' ? 'selected' : ''}>当前赛季</option>
            <option value="all" ${filterSeason === 'all' ? 'selected' : ''}>全部</option>
            ${seasons.map((s: any) => html`<option value="${s.name}" ${s.name === filterSeason ? 'selected' : ''}>${s.name}</option>`)}
          </select>
        </div>
        <div class="divide-y divide-hearth-border">
          ${matches.length === 0 ? html`<div class="px-5 py-4 text-center text-sm text-hearth-dim">暂无对局记录</div>` : ''}
          ${matches.map((m: any) => html`
            <a href="/match/${m.game_uuid}" class="flex items-center gap-3 px-5 py-3 hover:bg-white/5 transition">
              <span class="text-lg font-bold w-8 text-center ${m.placement === 1 ? 'text-yellow-400' : m.placement === 2 ? 'text-gray-300' : m.placement === 3 ? 'text-orange-400' : 'text-hearth-dim'}">
                ${m.placement || '-'}
              </span>
              ${m.hero_card_id ? html`
                <div class="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-hearth-card">
                  <img src="https://art.hearthstonejson.com/v1/256x/${m.hero_card_id}.jpg" alt="" class="w-full h-full object-cover" onerror="this.closest('div').style.display='none'">
                </div>
              ` : ''}
              <div class="flex-1">
                <span class="text-sm text-hearth-gold">${m.hero_name || '未知英雄'}</span>
              </div>
              <span class="font-bold ${m.points > 0 ? 'text-hearth-gold' : 'text-hearth-dim'}">+${m.points || 0}</span>
              <span class="text-xs text-hearth-dim">${m.ended_at ? new Date(m.ended_at).toLocaleDateString('zh-CN') : ''}</span>
            </a>
          `)}
        </div>
      </div>
    </div>
  `;
}

function renderEnroll({ enrollments, settings, currentUser }: any) {
  const isEnrolled = currentUser && enrollments.some((e: any) => e.battle_tag === currentUser.battleTag);
  return html`
    <div class="max-w-2xl mx-auto">
      <div class="bg-hearth-card rounded-xl gold-border overflow-hidden mb-4">
        <div class="px-5 py-3 border-b border-hearth-border flex items-center justify-between">
          <h2 class="text-lg font-bold text-hearth-gold">📝 报名</h2>
          <span class="text-xs text-hearth-dim">共 ${enrollments.length} 人已报名</span>
        </div>
        <div class="p-5">
          ${currentUser ? html`
            ${isEnrolled ? html`
              <p class="text-green-400 text-sm mb-3">✅ 你已报名</p>
              <button onclick="withdraw()" class="px-4 py-2 text-sm bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition">取消报名</button>
            ` : html`
              <button onclick="enroll()" class="px-6 py-2 bg-hearth-gold/20 text-hearth-gold rounded-lg hover:bg-hearth-gold/30 transition">立即报名</button>
            `}
          ` : html`
            <p class="text-hearth-dim text-sm">请先 <a href="/register" class="text-hearth-gold hover:text-hearth-accent">登录</a> 后报名</p>
          `}
        </div>
      </div>

      <div class="bg-hearth-card rounded-xl gold-border overflow-hidden">
        <div class="px-5 py-3 border-b border-hearth-border">
          <h3 class="text-sm font-bold text-hearth-gold">已报名选手</h3>
        </div>
        <div class="divide-y divide-hearth-border max-h-96 overflow-y-auto">
          ${enrollments.length === 0 ? html`<div class="px-5 py-4 text-center text-sm text-hearth-dim">暂无人报名</div>` : ''}
          ${enrollments.map((e: any, i: number) => html`
            <div class="px-5 py-2 flex items-center gap-3">
              <span class="text-xs text-hearth-dim w-6">${i + 1}</span>
              <a href="/player/${encodeURIComponent(e.battle_tag)}" class="text-hearth-gold hover:text-hearth-accent text-sm">${e.display_name || e.battle_tag}</a>
            </div>
          `)}
        </div>
      </div>
    </div>
    <script>
    async function enroll() {
      try {
        const res = await fetch('/api/enroll', { method: 'POST' });
        const data = await res.json();
        if (data.ok) window.location.reload();
        else await showAlert(data.error || '报名失败');
      } catch { await showAlert('网络错误'); }
    }
    async function withdraw() {
      if (!await showConfirm('确定取消报名吗？')) return;
      try {
        const res = await fetch('/api/enroll/withdraw', { method: 'POST' });
        const data = await res.json();
        if (data.ok) window.location.reload();
        else await showAlert(data.error || '操作失败');
      } catch { await showAlert('网络错误'); }
    }
    </script>
  `;
}

// ── 补录/编辑对局 ──
function renderMatchEdit({ match, players, editMode }: any) {
  const allPlayersJson = JSON.stringify(players);
  const matchJson = JSON.stringify(match);
  const HERO_COUNT = 8;

  // 构建玩家行
  const rows: any[] = [];
  if (editMode && match?.players) {
    for (const p of match.players) {
      rows.push({
        playerId: p.id,
        battleTag: p.battle_tag || '',
        displayName: p.display_name || p.battle_tag || '',
        heroCardId: p.hero_card_id || '',
        heroName: p.hero_name || '',
        placement: p.placement,
        locked: false,
      });
    }
  }
  // 补齐到 8 行
  while (rows.length < HERO_COUNT) {
    rows.push({
      playerId: null,
      battleTag: '',
      displayName: '',
      heroCardId: '',
      heroName: '',
      placement: null,
      locked: false,
    });
  }

  const rowsJson = JSON.stringify(rows);

  return html`
    <div class="max-w-2xl mx-auto">
      <div class="bg-hearth-card rounded-xl gold-border overflow-hidden">
        <div class="px-4 sm:px-6 py-3 sm:py-4 border-b border-hearth-border flex items-center justify-between">
          <h2 class="text-lg font-bold text-hearth-gold">${editMode ? '✏️ 修改排名' : '✏️ 补录排名'}</h2>
          ${editMode && match ? html`<div class="text-xs text-hearth-dim">${match.ended_at || match.started_at || ''}</div>` : ''}
        </div>

        <div class="px-4 sm:px-6 py-3 bg-yellow-500/10 border-b border-hearth-border text-sm text-yellow-300 text-center">
          ${editMode ? '⚠️ 修改模式：所有排名可修改，提交后自动重算' : '👑 管理员模式：补录所有玩家的排名'}
        </div>

        <div class="divide-y divide-hearth-border" id="players-list"></div>

        <div class="px-4 sm:px-6 py-3 sm:py-4 border-t border-hearth-border flex items-center justify-between">
          <div id="error-msg" class="text-sm text-red-400 hidden"></div>
          <button id="submitBtn" onclick="submitPlacements()"
            class="ml-auto px-6 py-2.5 rounded-lg font-bold text-sm transition bg-hearth-gold/20 text-hearth-gold hover:bg-hearth-gold/30 active:scale-[0.98]">
            提交排名
          </button>
        </div>
      </div>

      <div class="mt-4 text-center">
        <a href="/admin" class="text-sm text-hearth-gold hover:underline">← 返回管理面板</a>
      </div>
    </div>

    <!-- 英雄编辑弹窗 -->
    <div id="hero-edit-modal" class="hidden fixed inset-0 bg-black/70 flex items-center justify-center z-[60]" onclick="if(event.target===this)this.classList.add('hidden')">
      <div class="bg-hearth-card rounded-xl gold-border p-6 w-full max-w-sm" onclick="event.stopPropagation()">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-sm font-bold text-hearth-gold">🎮 修改英雄</h3>
          <button onclick="document.getElementById('hero-edit-modal').classList.add('hidden')" class="text-hearth-dim hover:text-white transition text-lg">✕</button>
        </div>
        <div class="text-xs text-hearth-dim mb-3" id="he-player-name"></div>
        <input type="text" id="he-search" class="w-full bg-black/30 border border-hearth-border rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-hearth-dim focus:outline-none focus:border-hearth-gold/50 mb-2" placeholder="输入英雄名搜索...">
        <div id="he-list" class="max-h-52 overflow-y-auto divide-y divide-hearth-border/50"></div>
        <input type="hidden" id="he-row-idx" value="">
      </div>
    </div>

    <script>
    const ALL_PLAYERS = ${allPlayersJson};
    const EDIT_MODE = ${editMode ? 'true' : 'false'};
    const GAME_UUID = ${editMode && match ? JSON.stringify(match.game_uuid) : 'null'};
    let playerRows = ${rowsJson};
    let _heroList = null;

    // ── 渲染玩家行 ──
    function renderRows() {
      const container = document.getElementById('players-list');
      container.innerHTML = playerRows.map((row, i) => {
        const avatarHtml = row.heroCardId
          ? '<img src="https://art.hearthstonejson.com/v1/256x/' + row.heroCardId + '.jpg" alt="' + row.heroName + '" title="' + row.heroName + '" class="w-[150%] h-[150%] object-cover" onerror="this.closest(\\'div\\').style.display=\\'none\\'">'
          : '<div class="w-full h-full flex items-center justify-center text-hearth-dim text-xs">?</div>';
        const editBtn = EDIT_MODE
          ? '<button onclick="toggleHeroEdit(' + i + ')" title="修改英雄" class="absolute top-0 left-0 w-4 h-4 sm:w-5 sm:h-5 bg-black/70 rounded-br flex items-center justify-center text-[8px] sm:text-[10px] text-hearth-gold hover:bg-hearth-gold/30 transition z-10 cursor-pointer leading-none">✏️</button>'
          : '<button onclick="toggleHeroEdit(' + i + ')" title="选择英雄" class="absolute top-0 left-0 w-4 h-4 sm:w-5 sm:h-5 bg-black/70 rounded-br flex items-center justify-center text-[8px] sm:text-[10px] text-hearth-gold hover:bg-hearth-gold/30 transition z-10 cursor-pointer leading-none">🎮</button>';

        // 玩家选择器
        let playerSelect;
        if (EDIT_MODE) {
          playerSelect = '<div class="font-medium truncate">' + (row.displayName || row.battleTag || '未知') + '</div>';
        } else {
          const options = ALL_PLAYERS.map(p =>
            '<option value="' + p.battle_tag + '" data-name="' + (p.display_name || p.battle_tag) + '"' +
            (p.battle_tag === row.battleTag ? ' selected' : '') + '>' +
            (p.display_name || p.battle_tag) + '</option>'
          ).join('');
          playerSelect = '<select data-row="' + i + '" onchange="updatePlayer(' + i + ', this)" class="bg-black/30 border border-hearth-border rounded-lg px-2 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-hearth-gold/50 transition w-full">' +
            '<option value="">选择选手</option>' + options + '</select>';
        }

        // 排名下拉
        let placementSelect;
        if (row.locked) {
          placementSelect = '<div class="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/30 text-sm text-green-400 w-24 justify-center"><span>🔒</span><span>第 ' + row.placement + ' 名</span></div>';
        } else {
          const pOptions = '<option value="">排名</option>' +
            [1,2,3,4,5,6,7,8].map(n =>
              '<option value="' + n + '"' + (row.placement === n ? ' selected' : '') + '>第 ' + n + ' 名</option>'
            ).join('');
          placementSelect = '<select data-row="' + i + '" onchange="updatePlacement(' + i + ', this)" class="placement-select bg-black/30 border border-hearth-border rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-hearth-gold/60 transition w-24 text-center">' +
            pOptions + '</select>';
        }

        return '<div class="flex items-center gap-3 sm:gap-4 px-4 sm:px-6 py-3 sm:py-4">' +
          '<div class="hero-avatar relative w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden flex-shrink-0 bg-hearth-card">' +
          avatarHtml + editBtn + '</div>' +
          '<div class="flex-1 min-w-0">' + playerSelect +
          '<div class="text-xs text-hearth-dim hero-name-text mt-0.5">' + (row.heroName || '') + '</div></div>' +
          '<div class="flex-shrink-0">' + placementSelect + '</div></div>';
      }).join('');
    }

    function updatePlayer(idx, sel) {
      const tag = sel.value;
      const opt = sel.selectedOptions[0];
      playerRows[idx].battleTag = tag;
      playerRows[idx].displayName = opt?.dataset.name || tag;
    }

    function updatePlacement(idx, sel) {
      playerRows[idx].placement = sel.value ? parseInt(sel.value) : null;
    }

    // ── 英雄编辑 ──
    async function loadHeroes() {
      if (_heroList) return _heroList;
      try {
        const data = await fetch('/public/bg_heroes.json').then(r => r.json());
        _heroList = Object.entries(data)
          .filter(([k]) => !k.includes('SKIN'))
          .map(([cardId, name]) => ({ cardId, name }))
          .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
      } catch { _heroList = []; }
      return _heroList;
    }

    function renderHeroList(q) {
      const heroes = _heroList || [];
      const matches = q ? heroes.filter(h => h.name.toLowerCase().includes(q.toLowerCase())).slice(0, 15) : heroes.slice(0, 15);
      const list = document.getElementById('he-list');
      list.innerHTML = matches.length
        ? matches.map(h =>
            '<div class="flex items-center gap-2 px-3 py-2 text-sm text-gray-200 hover:bg-hearth-gold/20 cursor-pointer transition" data-cid="' + h.cardId + '" data-name="' + h.name + '">' +
            '<img src="https://art.hearthstonejson.com/v1/256x/' + h.cardId + '.jpg" class="w-8 h-8 rounded-full object-cover flex-shrink-0" onerror="this.style.display=\\'none\\'">' +
            '<span>' + h.name + '</span></div>'
          ).join('')
        : '<div class="px-3 py-2 text-sm text-hearth-dim">未找到</div>';
      list.querySelectorAll('div[data-cid]').forEach(opt => {
        opt.onclick = () => selectHero(opt.dataset.cid, opt.dataset.name);
      });
    }

    async function toggleHeroEdit(idx) {
      await loadHeroes();
      document.getElementById('he-row-idx').value = idx;
      document.getElementById('he-player-name').textContent = playerRows[idx].displayName || '选手 ' + (idx + 1);
      const search = document.getElementById('he-search');
      search.value = '';
      renderHeroList('');
      document.getElementById('hero-edit-modal').classList.remove('hidden');
      search.focus();
    }

    function selectHero(cardId, name) {
      const idx = parseInt(document.getElementById('he-row-idx').value);
      playerRows[idx].heroCardId = cardId;
      playerRows[idx].heroName = name;
      document.getElementById('hero-edit-modal').classList.add('hidden');
      renderRows();
    }

    document.getElementById('he-search').addEventListener('input', function() {
      renderHeroList(this.value);
    });

    // ── 提交 ──
    async function submitPlacements() {
      document.getElementById('error-msg').classList.add('hidden');
      const btn = document.getElementById('submitBtn');

      // 校验
      const validRows = playerRows.filter(r => r.battleTag || r.displayName);
      if (validRows.length < 2) {
        showError('至少需要 2 名选手');
        return;
      }

      const usedPlacements = new Set();
      for (const r of validRows) {
        if (r.placement == null) {
          showError('"' + (r.displayName || r.battleTag) + '" 未选择排名');
          return;
        }
        if (usedPlacements.has(r.placement)) {
          showError('第 ' + r.placement + ' 名重复');
          return;
        }
        usedPlacements.add(r.placement);
      }

      btn.disabled = true;
      btn.textContent = '提交中...';

      try {
        if (EDIT_MODE && GAME_UUID) {
          // 编辑模式：更新排名
          const placements = validRows.map(r => ({ playerId: r.playerId, placement: r.placement }));
          const res = await fetch('/api/admin/match/' + encodeURIComponent(GAME_UUID) + '/edit-placement', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ placements }),
          });
          const data = await res.json();
          if (data.ok) {
            btn.textContent = '✓ 提交成功';
            btn.className = 'ml-auto px-6 py-2.5 rounded-lg font-bold text-sm bg-green-500/20 text-green-400 cursor-default';
            setTimeout(() => window.location.reload(), 1000);
          } else {
            showError(data.error || '提交失败');
            btn.disabled = false;
            btn.textContent = '提交排名';
          }
        } else {
          // 新建模式
          const players = validRows.map(r => ({
            battleTag: r.battleTag,
            displayName: r.displayName,
            heroCardId: r.heroCardId,
            heroName: r.heroName,
            placement: r.placement,
          }));
          const res = await fetch('/api/admin/match/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ players }),
          });
          const data = await res.json();
          if (data.ok) {
            btn.textContent = '✓ 创建成功';
            btn.className = 'ml-auto px-6 py-2.5 rounded-lg font-bold text-sm bg-green-500/20 text-green-400 cursor-default';
            setTimeout(() => { window.location.href = '/match/' + data.gameUuid; }, 1000);
          } else {
            showError(data.error || '创建失败');
            btn.disabled = false;
            btn.textContent = '提交排名';
          }
        }
      } catch (e) {
        showError('网络错误，请重试');
        btn.disabled = false;
        btn.textContent = '提交排名';
      }
    }

    function showError(msg) {
      const el = document.getElementById('error-msg');
      el.textContent = msg;
      el.classList.remove('hidden');
    }

    renderRows();
    </script>
  `;
}

function renderAdmin(props: any) {
  return html`
    <div class="max-w-7xl mx-auto">
      <div class="flex items-center justify-between mb-4">
        <h1 class="text-xl font-bold text-hearth-gold">⚙️ 管理面板</h1>
        <span class="text-xs text-hearth-dim">${props.currentUser?.battleTag || ''}</span>
      </div>

      <div class="flex gap-1 mb-4 border-b border-hearth-border overflow-x-auto">
        <button onclick="switchTab('dashboard')" data-tab="dashboard" class="tab-btn px-4 py-2 text-sm font-medium rounded-t-lg transition whitespace-nowrap">总览</button>
        <button onclick="switchTab('matches')" data-tab="matches" class="tab-btn px-4 py-2 text-sm font-medium rounded-t-lg transition whitespace-nowrap">对局管理</button>
        <button onclick="switchTab('players')" data-tab="players" class="tab-btn px-4 py-2 text-sm font-medium rounded-t-lg transition whitespace-nowrap">选手管理</button>
        <button onclick="switchTab('tournament')" data-tab="tournament" class="tab-btn px-4 py-2 text-sm font-medium rounded-t-lg transition whitespace-nowrap">赛事管理</button>
        <button onclick="switchTab('season')" data-tab="season" class="tab-btn px-4 py-2 text-sm font-medium rounded-t-lg transition whitespace-nowrap">赛季管理</button>
        <button onclick="switchTab('enrollment')" data-tab="enrollment" class="tab-btn px-4 py-2 text-sm font-medium rounded-t-lg transition whitespace-nowrap">报名管理</button>
        ${props.isSuperAdmin ? html`<button onclick="switchTab('admins')" data-tab="admins" class="tab-btn px-4 py-2 text-sm font-medium rounded-t-lg transition whitespace-nowrap">管理员</button>` : ''}
      </div>

      <div id="tab-dashboard" class="tab-panel">
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <div class="bg-hearth-card rounded-xl gold-border p-4"><div class="text-xs text-hearth-dim mb-1">注册选手</div><div class="text-2xl font-bold text-hearth-gold" id="stat-players">-</div></div>
          <div class="bg-hearth-card rounded-xl gold-border p-4"><div class="text-xs text-hearth-dim mb-1">已完成对局</div><div class="text-2xl font-bold text-hearth-gold" id="stat-matches">-</div></div>
          <div class="bg-hearth-card rounded-xl gold-border p-4"><div class="text-xs text-hearth-dim mb-1">进行中</div><div class="text-2xl font-bold text-green-400" id="stat-active">-</div></div>
          <div class="bg-hearth-card rounded-xl gold-border p-4"><div class="text-xs text-hearth-dim mb-1">已报名</div><div class="text-2xl font-bold text-hearth-gold" id="stat-enrolled">-</div></div>
        </div>
      </div>

      <div id="tab-matches" class="tab-panel hidden">
        <div class="flex items-center gap-2 mb-3">
          <button onclick="showCreateMatch()" class="text-xs px-3 py-1.5 rounded bg-hearth-gold/20 text-hearth-gold hover:bg-hearth-gold/30 transition">+ 录入对局</button>
        </div>
        <div id="admin-matches-list" class="bg-hearth-card rounded-xl gold-border overflow-hidden"><div class="px-6 py-8 text-center text-hearth-dim">加载中...</div></div>
      </div>

      <div id="tab-players" class="tab-panel hidden">
        <div class="flex items-center gap-2 mb-3">
          <input type="text" id="admin-player-search" placeholder="搜索选手..." oninput="loadAdminPlayers()" class="w-64 bg-black/30 border border-hearth-border rounded-lg px-3 py-1.5 text-sm text-gray-200 placeholder-hearth-dim focus:outline-none focus:border-hearth-gold/50">
          <button onclick="showAddPlayer()" class="text-xs px-3 py-1.5 rounded bg-hearth-gold/20 text-hearth-gold hover:bg-hearth-gold/30 transition">+ 添加选手</button>
        </div>
        <div id="admin-players-list" class="bg-hearth-card rounded-xl gold-border overflow-hidden"><div class="px-6 py-8 text-center text-hearth-dim">加载中...</div></div>
      </div>

      <div id="tab-tournament" class="tab-panel hidden">
        <div class="bg-hearth-card rounded-xl gold-border overflow-hidden mb-3">
          <div class="px-5 py-3 border-b border-hearth-border flex items-center justify-between">
            <h3 class="text-sm font-bold text-hearth-gold">🏆 赛事列表</h3>
            <button onclick="showCreateTournament()" class="text-xs px-3 py-1 rounded bg-hearth-gold/20 text-hearth-gold hover:bg-hearth-gold/30 transition">+ 创建赛事</button>
          </div>
          <div id="tournament-list" class="divide-y divide-hearth-border"><div class="px-5 py-4 text-center text-sm text-hearth-dim">加载中...</div></div>
        </div>
      </div>

      <div id="tab-season" class="tab-panel hidden">
        <div class="bg-hearth-card rounded-xl gold-border overflow-hidden mb-3">
          <div class="px-5 py-3 border-b border-hearth-border flex items-center justify-between">
            <h3 class="text-sm font-bold text-hearth-gold">📅 赛季列表</h3>
            <button onclick="showCreateSeason()" class="text-xs px-3 py-1 rounded bg-hearth-gold/20 text-hearth-gold hover:bg-hearth-gold/30 transition">+ 创建赛季</button>
          </div>
          <div id="season-list" class="divide-y divide-hearth-border"><div class="px-5 py-4 text-center text-sm text-hearth-dim">加载中...</div></div>
        </div>
      </div>

      <div id="tab-enrollment" class="tab-panel hidden">
        <div class="bg-hearth-card rounded-xl gold-border overflow-hidden">
          <div class="px-5 py-3 border-b border-hearth-border">
            <h3 class="text-sm font-bold text-hearth-gold">📝 报名管理</h3>
          </div>
          <div id="enrollment-list" class="divide-y divide-hearth-border"><div class="px-5 py-4 text-center text-sm text-hearth-dim">加载中...</div></div>
        </div>
      </div>

      <div id="tab-admins" class="tab-panel hidden">
        <div class="bg-hearth-card rounded-xl gold-border overflow-hidden">
          <div class="px-5 py-3 border-b border-hearth-border">
            <h3 class="text-sm font-bold text-hearth-gold">👑 管理员列表</h3>
          </div>
          <div id="admins-list" class="divide-y divide-hearth-border"><div class="px-5 py-4 text-center text-sm text-hearth-dim">加载中...</div></div>
        </div>
      </div>
    </div>

    <script>
    function switchTab(tab) {
      document.querySelectorAll('.tab-panel').forEach(el => el.classList.add('hidden'));
      document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('bg-hearth-card', 'text-hearth-gold'));
      document.getElementById('tab-' + tab)?.classList.remove('hidden');
      document.querySelector('[data-tab="' + tab + '"]')?.classList.add('bg-hearth-card', 'text-hearth-gold');
      if (tab === 'dashboard') loadDashboard();
      if (tab === 'matches') loadAdminMatches();
      if (tab === 'players') loadAdminPlayers();
      if (tab === 'tournament') loadTournaments();
      if (tab === 'season') loadSeasons();
      if (tab === 'enrollment') loadEnrollments();
    }
    try { switchTab('dashboard'); } catch(e) { console.error('init error:', e); }

    async function loadDashboard() {
      try {
        const [players, matches, active, enrolled] = await Promise.all([
          fetch('/api/admin/players?limit=1').then(r=>r.json()),
          fetch('/api/matches?limit=1').then(r=>r.json()),
          fetch('/api/active-games').then(r=>r.json()),
          fetch('/api/enroll').then(r=>r.json()).catch(()=>({ok:false})),
        ]);
        document.getElementById('stat-players').textContent = players.total || 0;
        document.getElementById('stat-matches').textContent = matches.matches?.length || 0;
        document.getElementById('stat-active').textContent = active.games?.length || 0;
      } catch {}
    }

    async function loadAdminMatches() {
      try {
        const res = await fetch('/api/matches');
        const data = await res.json();
        const el = document.getElementById('admin-matches-list');
        if (!data.matches?.length) { el.innerHTML = '<div class="px-5 py-4 text-center text-sm text-hearth-dim">暂无对局</div>'; return; }
        el.innerHTML = '<div class="divide-y divide-hearth-border">' + data.matches.map(m => {
          const players = (m.players||[]).map(p => '<span class="text-hearth-gold">' + (p.display_name||p.battle_tag) + '</span> 第' + p.placement + '名 +' + p.points).join(', ');
          return '<a href="/match/' + m.game_uuid + '" class="block px-5 py-3 hover:bg-white/5 transition"><div class="text-sm">' + players + '</div><div class="text-xs text-hearth-dim mt-1">' + (m.ended_at ? new Date(m.ended_at).toLocaleString('zh-CN') : '') + '</div></a>';
        }).join('') + '</div>';
      } catch {}
    }

    async function loadAdminPlayers() {
      try {
        const search = document.getElementById('admin-player-search')?.value || '';
        const res = await fetch('/api/admin/players?search=' + encodeURIComponent(search));
        const data = await res.json();
        const el = document.getElementById('admin-players-list');
        if (!data.players?.length) { el.innerHTML = '<div class="px-5 py-4 text-center text-sm text-hearth-dim">暂无选手</div>'; return; }
        el.innerHTML = '<div class="overflow-x-auto"><table class="w-full text-sm"><thead><tr class="text-hearth-dim text-xs uppercase tracking-wider border-b border-hearth-border"><th class="px-4 py-3 text-left">BattleTag</th><th class="px-4 py-3 text-left">显示名称</th><th class="px-4 py-3 text-center">种子</th></tr></thead><tbody class="divide-y divide-hearth-border/50">' +
          data.players.map(p => '<tr class="hover:bg-white/5"><td class="px-4 py-3 text-hearth-gold">' + p.battle_tag + '</td><td class="px-4 py-3">' + (p.display_name||'') + '</td><td class="px-4 py-3 text-center">' + (p.is_seed ? '⭐' : '') + '</td></tr>').join('') +
          '</tbody></table></div>';
      } catch {}
    }

    async function loadTournaments() {
      try {
        const res = await fetch('/api/admin/tournaments');
        const data = await res.json();
        const el = document.getElementById('tournament-list');
        if (!data.tournaments?.length) { el.innerHTML = '<div class="px-5 py-4 text-center text-sm text-hearth-dim">暂无赛事</div>'; return; }
        el.innerHTML = data.tournaments.map(t => '<div class="px-5 py-3"><span class="text-hearth-gold">' + t.tournament_name + '</span></div>').join('');
      } catch {}
    }

    async function loadSeasons() {
      try {
        const res = await fetch('/api/admin/seasons');
        const data = await res.json();
        const el = document.getElementById('season-list');
        if (!data.seasons?.length) { el.innerHTML = '<div class="px-5 py-4 text-center text-sm text-hearth-dim">暂无赛季</div>'; return; }
        el.innerHTML = data.seasons.map(s => '<div class="px-5 py-3 flex items-center justify-between"><span class="text-hearth-gold">' + s.name + '</span><span class="text-xs text-hearth-dim">' + (s.status === 'active' ? '🟢 进行中' : '⚪ ' + s.status) + '</span></div>').join('');
      } catch {}
    }

    async function loadEnrollments() {
      try {
        const res = await fetch('/api/enroll');
        const data = await res.json();
        const el = document.getElementById('enrollment-list');
        const list = data.enrollments || [];
        if (!list.length) { el.innerHTML = '<div class="px-5 py-4 text-center text-sm text-hearth-dim">暂无报名</div>'; return; }
        el.innerHTML = list.map((e, i) => '<div class="px-5 py-2 flex items-center gap-3"><span class="text-xs text-hearth-dim w-6">' + (i+1) + '</span><span class="text-hearth-gold text-sm">' + (e.display_name||e.battle_tag) + '</span><span class="text-xs text-hearth-dim">' + e.status + '</span></div>').join('');
      } catch {}
    }

    function showCreateMatch() {
      showConfirmHTML(
        '<div class="space-y-3">' +
        '<p class="text-hearth-gold font-bold">录入新对局</p>' +
        '<p class="text-xs text-hearth-dim">请输入对局中每位选手的信息（JSON格式）</p>' +
        '<textarea id="matchInput" rows="8" class="w-full bg-black/30 border border-hearth-border rounded-lg px-3 py-2 text-xs text-gray-200 font-mono focus:outline-none focus:border-hearth-gold/50" placeholder=&#39;[{"battleTag":"玩家#1234","displayName":"玩家","placement":1,"heroName":"米尔菲斯","heroCardId":"BG23_HERO_201"}]&#39;></textarea>' +
        '</div>',
        '提交'
      ).then(async (ok) => {
        if (!ok) return;
        try {
          const input = document.getElementById('matchInput')?.value;
          const players = JSON.parse(input);
          const res = await fetch('/api/admin/match', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ players }) });
          const data = await res.json();
          if (data.ok) { await showAlert('对局已创建'); window.location.href = '/match/' + data.gameUuid; }
          else await showAlert(data.error || '创建失败');
        } catch(e) { await showAlert('JSON 格式错误: ' + e.message); }
      });
    }

    function showAddPlayer() {
      showConfirmHTML(
        '<div class="space-y-3">' +
        '<p class="text-hearth-gold font-bold">添加选手</p>' +
        '<input id="addBattleTag" placeholder="BattleTag (如 玩家#1234)" class="w-full bg-black/30 border border-hearth-border rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-hearth-gold/50">' +
        '<input id="addDisplayName" placeholder="显示名称" class="w-full bg-black/30 border border-hearth-border rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-hearth-gold/50">' +
        '<input id="addPassword" type="password" placeholder="密码" class="w-full bg-black/30 border border-hearth-border rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-hearth-gold/50">' +
        '</div>',
        '添加'
      ).then(async (ok) => {
        if (!ok) return;
        const battleTag = document.getElementById('addBattleTag')?.value;
        const displayName = document.getElementById('addDisplayName')?.value;
        const password = document.getElementById('addPassword')?.value;
        if (!battleTag) { await showAlert('BattleTag 不能为空'); return; }
        try {
          const res = await fetch('/api/admin/player', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ battleTag, displayName, password }) });
          const data = await res.json();
          if (data.ok) { await showAlert('选手已添加'); loadAdminPlayers(); }
          else await showAlert(data.error || '添加失败');
        } catch { await showAlert('网络错误'); }
      });
    }

    function showCreateSeason() {
      showConfirmHTML(
        '<div class="space-y-3"><p class="text-hearth-gold font-bold">创建赛季</p><input id="seasonName" placeholder="赛季名称" class="w-full bg-black/30 border border-hearth-border rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-hearth-gold/50"></div>',
        '创建'
      ).then(async (ok) => {
        if (!ok) return;
        const name = document.getElementById('seasonName')?.value;
        if (!name) { await showAlert('名称不能为空'); return; }
        try {
          const res = await fetch('/api/admin/season', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
          const data = await res.json();
          if (data.ok) { await showAlert('赛季已创建'); loadSeasons(); }
          else await showAlert(data.error || '创建失败');
        } catch { await showAlert('网络错误'); }
      });
    }

    function showCreateTournament() {
      showConfirmHTML(
        '<div class="space-y-3">' +
        '<p class="text-hearth-gold font-bold">创建赛事分组</p>' +
        '<input id="tgName" placeholder="赛事名称" class="w-full bg-black/30 border border-hearth-border rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-hearth-gold/50">' +
        '<div class="grid grid-cols-2 gap-2">' +
        '<input id="tgRound" type="number" placeholder="轮次 (默认1)" class="bg-black/30 border border-hearth-border rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-hearth-gold/50">' +
        '<input id="tgGroup" type="number" placeholder="组号 (默认1)" class="bg-black/30 border border-hearth-border rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-hearth-gold/50">' +
        '</div>' +
        '<select id="tgLayout" class="w-full bg-black/30 border border-hearth-border rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-hearth-gold/50"><option value="bracket">淘汰赛 (bracket)</option><option value="grid">网格赛 (grid)</option></select>' +
        '<input id="tgBoN" type="number" placeholder="BO几 (默认1)" class="w-full bg-black/30 border border-hearth-border rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-hearth-gold/50">' +
        '</div>',
        '创建'
      ).then(async (ok) => {
        if (!ok) return;
        const tournamentName = document.getElementById('tgName')?.value;
        const round = parseInt(document.getElementById('tgRound')?.value) || 1;
        const groupIndex = parseInt(document.getElementById('tgGroup')?.value) || 1;
        const layout = document.getElementById('tgLayout')?.value || 'bracket';
        const boN = parseInt(document.getElementById('tgBoN')?.value) || 1;
        if (!tournamentName) { await showAlert('赛事名称不能为空'); return; }
        try {
          const res = await fetch('/api/admin/tournament/group', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tournamentName, round, groupIndex, layout, boN }) });
          const data = await res.json();
          if (data.ok) { await showAlert('分组已创建'); loadTournaments(); }
          else await showAlert(data.error || '创建失败');
        } catch { await showAlert('网络错误'); }
      });
    }
    </script>
  `;
}
