-- 0001_schema.sql
-- Cloudflare D1 Schema for Fraith D&D Campaign System (3 Players + 1 DM)

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  email TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('dm', 'player')),
  player_id INTEGER UNIQUE CHECK (player_id IN (1, 2, 3) OR player_id IS NULL),
  avatar_key TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_themes (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  theme_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS character_profiles (
  player_id INTEGER PRIMARY KEY CHECK (player_id IN (1, 2, 3)),
  character_name TEXT NOT NULL DEFAULT '',
  char_class TEXT NOT NULL DEFAULT '',
  subclass TEXT NOT NULL DEFAULT '',
  race TEXT NOT NULL DEFAULT '',
  level INTEGER NOT NULL DEFAULT 0,
  max_spells INTEGER NOT NULL DEFAULT 0,
  lss_embed_url TEXT NOT NULL DEFAULT 'https://longstoryshort.app/iframe/characters/list/',
  coins_cp INTEGER NOT NULL DEFAULT 0,
  coins_sp INTEGER NOT NULL DEFAULT 0,
  coins_ep INTEGER NOT NULL DEFAULT 0,
  coins_gp INTEGER NOT NULL DEFAULT 0,
  coins_pp INTEGER NOT NULL DEFAULT 0,
  hp_current INTEGER NOT NULL DEFAULT 0,
  hp_max INTEGER NOT NULL DEFAULT 0,
  hp_temp INTEGER NOT NULL DEFAULT 0,
  lss_notes TEXT NOT NULL DEFAULT '',
  raw_lss_json TEXT,
  last_synced_at TEXT
);

CREATE TABLE IF NOT EXISTS journal_entries (
  player_id INTEGER PRIMARY KEY CHECK (player_id IN (1, 2, 3)),
  title TEXT NOT NULL DEFAULT 'Личный журнал',
  content TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS quests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  short_desc TEXT NOT NULL,
  full_desc TEXT NOT NULL,
  reward TEXT NOT NULL DEFAULT '',
  parameters_json TEXT NOT NULL DEFAULT '{}',
  progress_current INTEGER NOT NULL DEFAULT 0,
  progress_target INTEGER NOT NULL DEFAULT 1,
  image_key TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed', 'available')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bestiary (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  cr TEXT NOT NULL DEFAULT '1',
  cr_numeric REAL NOT NULL DEFAULT 1.0,
  creature_type TEXT NOT NULL DEFAULT 'Чудовище',
  ac INTEGER NOT NULL DEFAULT 13,
  hp TEXT NOT NULL DEFAULT '22 (4d8 + 4)',
  description TEXT NOT NULL DEFAULT '',
  image_key TEXT,
  is_revealed INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_bestiary_cr ON bestiary(cr_numeric ASC, sort_order ASC, id ASC);

CREATE TABLE IF NOT EXISTS spells (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  name_en TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  level INTEGER NOT NULL CHECK (level >= 0 AND level <= 9),
  school TEXT NOT NULL,
  type_line TEXT NOT NULL DEFAULT '',
  classes TEXT NOT NULL,
  subclasses TEXT NOT NULL DEFAULT '',
  casting_time TEXT NOT NULL DEFAULT '1 действие',
  spell_range TEXT NOT NULL DEFAULT '60 футов',
  components TEXT NOT NULL DEFAULT 'В, С',
  components_badge TEXT NOT NULL DEFAULT '',
  ritual INTEGER NOT NULL DEFAULT 0,
  concentration INTEGER NOT NULL DEFAULT 0,
  duration TEXT NOT NULL DEFAULT 'Мгновенная',
  description TEXT NOT NULL,
  description_html TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'PH14',
  source_title TEXT NOT NULL DEFAULT '',
  is_homebrew INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_spells_level_school ON spells(level ASC, school ASC);

CREATE TABLE IF NOT EXISTS learned_spells (
  player_id INTEGER NOT NULL CHECK (player_id IN (1, 2, 3)),
  spell_id INTEGER NOT NULL REFERENCES spells(id) ON DELETE CASCADE,
  learned_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (player_id, spell_id)
);

CREATE TABLE IF NOT EXISTS inspiration_pool (
  campaign_id TEXT PRIMARY KEY,
  points INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS talent_tree (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  image_key TEXT,
  cost INTEGER NOT NULL DEFAULT 1 CHECK (cost >= 0),
  position_x INTEGER NOT NULL DEFAULT 0,
  position_y INTEGER NOT NULL DEFAULT 0,
  parent_id INTEGER REFERENCES talent_tree(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS purchased_talents (
  player_id INTEGER NOT NULL CHECK (player_id IN (1, 2, 3)),
  talent_id INTEGER NOT NULL REFERENCES talent_tree(id) ON DELETE CASCADE,
  purchased_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (player_id, talent_id)
);

CREATE TABLE IF NOT EXISTS roll_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER,
  character_name TEXT NOT NULL,
  title TEXT NOT NULL,
  formula TEXT NOT NULL,
  breakdown TEXT NOT NULL,
  total TEXT NOT NULL,
  is_crit INTEGER NOT NULL DEFAULT 0,
  crit_kind TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS media_blobs (
  key TEXT PRIMARY KEY,
  content_type TEXT NOT NULL,
  data_base64 TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
