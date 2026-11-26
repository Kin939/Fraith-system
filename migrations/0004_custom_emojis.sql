-- 0004_custom_emojis.sql
-- Custom campaign emojis uploaded by party members & DM

CREATE TABLE IF NOT EXISTS chat_custom_emojis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  image_key TEXT NOT NULL,
  image_url TEXT NOT NULL,
  creator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_chat_custom_emojis_code ON chat_custom_emojis(code ASC);
