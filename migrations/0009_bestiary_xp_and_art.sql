-- Experience points and dnd.su artwork for bestiary monsters.
-- Applied idempotently by src/lib/bootstrap.ts as well.

ALTER TABLE bestiary ADD COLUMN xp INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bestiary ADD COLUMN image_url TEXT NOT NULL DEFAULT '';
ALTER TABLE bestiary ADD COLUMN image_full_url TEXT NOT NULL DEFAULT '';
