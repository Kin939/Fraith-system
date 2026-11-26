-- dnd.su gallery (all community artworks of a creature) for the bestiary card,
-- plus the compendium dataset version so already-imported rows can be refreshed
-- when new fields (XP, artwork, galleries) appear.
-- Applied idempotently by src/lib/bootstrap.ts as well.

ALTER TABLE bestiary ADD COLUMN gallery_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE bestiary ADD COLUMN compendium_version INTEGER NOT NULL DEFAULT 0;
