CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  battle_tag TEXT UNIQUE NOT NULL,
  display_name TEXT,
  password_hash TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  last_seen TEXT
);

CREATE TABLE IF NOT EXISTS admins (
  player_id INTEGER PRIMARY KEY,
  is_super_admin INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (player_id) REFERENCES players(id)
);

CREATE TABLE IF NOT EXISTS tournaments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'upcoming' CHECK(status IN ('upcoming','active','completed')),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tournament_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament_id INTEGER NOT NULL,
  name TEXT,
  round INTEGER DEFAULT 1,
  group_index INTEGER NOT NULL,
  status TEXT DEFAULT 'waiting' CHECK(status IN ('waiting','active','done')),
  bo_n INTEGER DEFAULT 1,
  layout TEXT DEFAULT 'grid' CHECK(layout IN ('grid','bracket')),
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (tournament_id) REFERENCES tournaments(id)
);

CREATE TABLE IF NOT EXISTS group_players (
  group_id INTEGER NOT NULL,
  player_id INTEGER NOT NULL,
  PRIMARY KEY (group_id, player_id),
  FOREIGN KEY (group_id) REFERENCES tournament_groups(id),
  FOREIGN KEY (player_id) REFERENCES players(id)
);

CREATE TABLE IF NOT EXISTS enrollments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament_id INTEGER NOT NULL,
  player_id INTEGER NOT NULL,
  status TEXT DEFAULT 'enrolled' CHECK(status IN ('enrolled','waitlisted')),
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(tournament_id, player_id),
  FOREIGN KEY (tournament_id) REFERENCES tournaments(id),
  FOREIGN KEY (player_id) REFERENCES players(id)
);

CREATE TABLE IF NOT EXISTS enrollment_settings (
  tournament_id INTEGER PRIMARY KEY,
  enabled INTEGER DEFAULT 0,
  deadline TEXT,
  max_slots INTEGER DEFAULT 1024,
  FOREIGN KEY (tournament_id) REFERENCES tournaments(id)
);

CREATE TABLE IF NOT EXISTS matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_uuid TEXT UNIQUE NOT NULL,
  group_id INTEGER NOT NULL,
  game_number INTEGER DEFAULT 1,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending','completed','abandoned')),
  created_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT,
  FOREIGN KEY (group_id) REFERENCES tournament_groups(id)
);

CREATE TABLE IF NOT EXISTS match_placements (
  match_id INTEGER NOT NULL,
  player_id INTEGER NOT NULL,
  placement INTEGER,
  entered_by INTEGER,
  PRIMARY KEY (match_id, player_id),
  FOREIGN KEY (match_id) REFERENCES matches(id),
  FOREIGN KEY (player_id) REFERENCES players(id),
  FOREIGN KEY (entered_by) REFERENCES players(id)
);

CREATE INDEX IF NOT EXISTS idx_matches_group ON matches(group_id);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
CREATE INDEX IF NOT EXISTS idx_group_players_group ON group_players(group_id);
CREATE INDEX IF NOT EXISTS idx_group_players_player ON group_players(player_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_tournament ON enrollments(tournament_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_player ON enrollments(player_id);
CREATE INDEX IF NOT EXISTS idx_tournament_groups_tournament ON tournament_groups(tournament_id);
CREATE INDEX IF NOT EXISTS idx_match_placements_match ON match_placements(match_id);
