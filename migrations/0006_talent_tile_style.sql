-- Talent tile appearance: accent, HUD emblem, background pattern & "featured" highlight.
-- Applied idempotently by src/lib/bootstrap.ts (ensureTalentTreeColumns) as well.

ALTER TABLE talent_tree ADD COLUMN tile_accent TEXT;
ALTER TABLE talent_tree ADD COLUMN tile_emblem TEXT;
ALTER TABLE talent_tree ADD COLUMN tile_pattern TEXT NOT NULL DEFAULT 'none';
ALTER TABLE talent_tree ADD COLUMN is_featured INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_talent_tree_featured ON talent_tree(is_featured DESC, id ASC);
