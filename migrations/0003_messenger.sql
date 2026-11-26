-- 0003_messenger.sql
-- Campaign Messenger: Persistent chat, file/photo attachments, reactions, polls & session scheduling

CREATE TABLE IF NOT EXISTS chat_polls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  creator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'general' CHECK (kind IN ('date', 'general')),
  question TEXT NOT NULL,
  allow_multiple INTEGER NOT NULL DEFAULT 1,
  is_anonymous INTEGER NOT NULL DEFAULT 0,
  allow_add_options INTEGER NOT NULL DEFAULT 0,
  is_closed INTEGER NOT NULL DEFAULT 0,
  confirmed_option_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS chat_poll_options (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  poll_id INTEGER NOT NULL REFERENCES chat_polls(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  date_iso TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_chat_poll_options_poll ON chat_poll_options(poll_id ASC, sort_order ASC, id ASC);

CREATE TABLE IF NOT EXISTS chat_poll_votes (
  poll_id INTEGER NOT NULL REFERENCES chat_polls(id) ON DELETE CASCADE,
  option_id INTEGER NOT NULL REFERENCES chat_poll_options(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (option_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_poll_votes_poll ON chat_poll_votes(poll_id ASC);

CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_username TEXT NOT NULL,
  sender_display_name TEXT NOT NULL,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('dm', 'player')),
  sender_player_id INTEGER,
  content TEXT NOT NULL DEFAULT '',
  reply_to_id INTEGER REFERENCES chat_messages(id) ON DELETE SET NULL,
  attachments_json TEXT NOT NULL DEFAULT '[]',
  poll_id INTEGER REFERENCES chat_polls(id) ON DELETE SET NULL,
  is_pinned INTEGER NOT NULL DEFAULT 0,
  edited_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(id ASC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_pinned ON chat_messages(is_pinned DESC, id DESC);

CREATE TABLE IF NOT EXISTS chat_reactions (
  message_id INTEGER NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_chat_reactions_msg ON chat_reactions(message_id ASC);

CREATE TABLE IF NOT EXISTS campaign_next_session (
  campaign_id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  date_iso TEXT,
  note TEXT NOT NULL DEFAULT '',
  poll_id INTEGER REFERENCES chat_polls(id) ON DELETE SET NULL,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
