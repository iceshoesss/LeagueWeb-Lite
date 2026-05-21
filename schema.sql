-- LeagueWeb Lite D1 Schema

-- 选手表
CREATE TABLE IF NOT EXISTS league_players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  battle_tag TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  account_id_lo TEXT,
  password_hash TEXT,
  is_seed INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  last_seen TEXT
);

-- 管理员表
CREATE TABLE IF NOT EXISTS league_admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  battle_tag TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  is_super_admin INTEGER DEFAULT 0,
  added_at TEXT NOT NULL,
  added_by TEXT
);

-- 对局表
CREATE TABLE IF NOT EXISTS league_matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_uuid TEXT UNIQUE NOT NULL,
  tournament_group_id INTEGER,
  tournament_round INTEGER,
  season TEXT,
  status TEXT DEFAULT 'completed',
  started_at TEXT NOT NULL,
  ended_at TEXT,
  manual_record INTEGER DEFAULT 1
);

-- 对局选手表
CREATE TABLE IF NOT EXISTS match_players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id INTEGER NOT NULL REFERENCES league_matches(id),
  battle_tag TEXT NOT NULL,
  account_id_lo TEXT,
  display_name TEXT,
  hero_card_id TEXT,
  hero_name TEXT,
  placement INTEGER,
  points INTEGER
);

-- 赛事分组表
CREATE TABLE IF NOT EXISTS tournament_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament_name TEXT NOT NULL,
  round INTEGER NOT NULL DEFAULT 1,
  group_index INTEGER NOT NULL DEFAULT 1,
  status TEXT DEFAULT 'waiting',
  bo_n INTEGER DEFAULT 1,
  advancement_rule TEXT DEFAULT 'chicken',
  games_played INTEGER DEFAULT 0,
  match_point INTEGER,
  scoring_rule TEXT,
  layout TEXT DEFAULT 'bracket',
  next_round_group_index INTEGER,
  rankings TEXT,
  created_at TEXT,
  started_at TEXT,
  ended_at TEXT
);

-- 分组选手表
CREATE TABLE IF NOT EXISTS tournament_group_players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL REFERENCES tournament_groups(id),
  battle_tag TEXT,
  account_id_lo TEXT,
  display_name TEXT DEFAULT '待定',
  hero_card_id TEXT,
  hero_name TEXT,
  is_empty INTEGER DEFAULT 0,
  position INTEGER NOT NULL
);

-- 赛季表
CREATE TABLE IF NOT EXISTS seasons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'inactive',
  tournaments TEXT,
  created_at TEXT NOT NULL,
  archived_at TEXT
);

-- 报名表
CREATE TABLE IF NOT EXISTS tournament_enrollments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  battle_tag TEXT NOT NULL,
  display_name TEXT,
  status TEXT DEFAULT 'enrolled',
  enrolled_at TEXT NOT NULL,
  withdrawn_at TEXT,
  position INTEGER
);

-- 报名设置表
CREATE TABLE IF NOT EXISTS enrollment_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament_name TEXT,
  enrolled_slots INTEGER DEFAULT 896,
  waitlist_slots INTEGER DEFAULT 128,
  deadline TEXT,
  is_open INTEGER DEFAULT 1
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_matches_uuid ON league_matches(game_uuid);
CREATE INDEX IF NOT EXISTS idx_matches_tg ON league_matches(tournament_group_id);
CREATE INDEX IF NOT EXISTS idx_matches_season ON league_matches(season);
CREATE INDEX IF NOT EXISTS idx_match_players_match ON match_players(match_id);
CREATE INDEX IF NOT EXISTS idx_match_players_lo ON match_players(account_id_lo);
CREATE INDEX IF NOT EXISTS idx_tg_tournament ON tournament_groups(tournament_name, round);
CREATE INDEX IF NOT EXISTS idx_tgp_group ON tournament_group_players(group_id);
CREATE INDEX IF NOT EXISTS idx_players_tag ON league_players(battle_tag);
CREATE INDEX IF NOT EXISTS idx_enroll_tag ON tournament_enrollments(battle_tag);
CREATE INDEX IF NOT EXISTS idx_enroll_status ON tournament_enrollments(status);
