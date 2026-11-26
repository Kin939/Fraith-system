-- Unified notes for quests / NPCs / bestiary monsters (visible to the whole table).
-- Also extends the bestiary with dnd.su compendium metadata.
-- Applied idempotently by src/lib/bootstrap.ts as well.

CREATE TABLE IF NOT EXISTS entity_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('quest', 'npc', 'creature')),
  entity_id INTEGER NOT NULL,
  author_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_entity_notes_entity
  ON entity_notes(entity_type ASC, entity_id ASC, created_at ASC);

-- Carry over notes written before the unified table existed
INSERT INTO entity_notes (entity_type, entity_id, author_user_id, body, created_at, updated_at)
SELECT 'quest', q.quest_id, q.author_user_id, q.body, q.created_at, q.updated_at
FROM quest_notes q
WHERE NOT EXISTS (
  SELECT 1 FROM entity_notes e
  WHERE e.entity_type = 'quest'
    AND e.entity_id = q.quest_id
    AND e.author_user_id = q.author_user_id
    AND e.body = q.body
    AND e.created_at = q.created_at
);

-- Bestiary compendium columns (dnd.su import)
ALTER TABLE bestiary ADD COLUMN name_en TEXT NOT NULL DEFAULT '';
ALTER TABLE bestiary ADD COLUMN size TEXT NOT NULL DEFAULT '';
ALTER TABLE bestiary ADD COLUMN alignment TEXT NOT NULL DEFAULT '';
ALTER TABLE bestiary ADD COLUMN source_title TEXT NOT NULL DEFAULT '';
ALTER TABLE bestiary ADD COLUMN source_url TEXT NOT NULL DEFAULT '';
ALTER TABLE bestiary ADD COLUMN import_key TEXT;
ALTER TABLE bestiary ADD COLUMN is_compendium INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bestiary ADD COLUMN speed TEXT NOT NULL DEFAULT '';
ALTER TABLE bestiary ADD COLUMN senses TEXT NOT NULL DEFAULT '';
ALTER TABLE bestiary ADD COLUMN languages TEXT NOT NULL DEFAULT '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_bestiary_import_key ON bestiary(import_key);
CREATE INDEX IF NOT EXISTS idx_bestiary_name ON bestiary(name ASC, name_en ASC);
