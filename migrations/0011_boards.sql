-- «Доска» — collaborative infinite canvas (Miro/SBoard style) on Durable Objects.
-- Canvas content lives in the per-board Durable Object (SQLite storage via BoardRoom),
-- D1 keeps only metadata, access control and reusable templates.

CREATE TABLE IF NOT EXISTS boards (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS board_access (
  board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission TEXT NOT NULL CHECK (permission IN ('read', 'write')),
  PRIMARY KEY (board_id, user_id)
);

CREATE TABLE IF NOT EXISTS board_templates (
  id TEXT PRIMARY KEY,
  board_id TEXT REFERENCES boards(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  content_json TEXT NOT NULL,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Дополнительные настройки вида доски (фон/сетка) вынесены отдельно,
-- чтобы таблица `boards` оставалась ровно в согласованном контракте.
CREATE TABLE IF NOT EXISTS board_settings (
  board_id TEXT PRIMARY KEY REFERENCES boards(id) ON DELETE CASCADE,
  background TEXT NOT NULL DEFAULT 'dots' CHECK (background IN ('dots', 'lines', 'squares', 'plain')),
  grid_size INTEGER NOT NULL DEFAULT 24
);

CREATE INDEX IF NOT EXISTS idx_board_access_user ON board_access(user_id);
CREATE INDEX IF NOT EXISTS idx_board_templates_board ON board_templates(board_id);
