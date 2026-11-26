-- Quest tile appearance: accent color, HUD emblem, background pattern & "important" pin.
-- Applied idempotently by src/lib/bootstrap.ts (ensureQuestStyleColumns) as well.

ALTER TABLE quests ADD COLUMN tile_accent TEXT;
ALTER TABLE quests ADD COLUMN tile_emblem TEXT;
ALTER TABLE quests ADD COLUMN tile_pattern TEXT NOT NULL DEFAULT 'none';
ALTER TABLE quests ADD COLUMN is_important INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_quests_important ON quests(is_important DESC, status ASC);
