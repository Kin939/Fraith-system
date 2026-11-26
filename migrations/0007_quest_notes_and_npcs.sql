-- Party notes attached to quests (written by players & DM, visible to everyone).
-- Applied idempotently by src/lib/bootstrap.ts as well.

CREATE TABLE IF NOT EXISTS quest_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quest_id INTEGER NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
  author_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_quest_notes_quest ON quest_notes(quest_id ASC, created_at ASC);

-- Campaign contacts / NPCs. The DM creates them hidden and reveals them later.
CREATE TABLE IF NOT EXISTS campaign_npcs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT '',
  faction TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  attitude TEXT NOT NULL DEFAULT 'neutral',
  description TEXT NOT NULL DEFAULT '',
  secret_notes TEXT NOT NULL DEFAULT '',
  image_key TEXT,
  is_revealed INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_campaign_npcs_revealed ON campaign_npcs(is_revealed ASC, sort_order ASC);
