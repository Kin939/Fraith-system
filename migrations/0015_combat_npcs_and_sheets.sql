-- НПС в бою + редактируемый боевой лист НПС.
--
-- 1. campaign_npcs.sheet_json — АС/HP/характеристики/атаки для мастера.
-- 2. combat_participants.participant_type теперь допускает 'npc', плюс новая
--    колонка npc_id со ссылкой на campaign_npcs.id. CHECK-ограничение в SQLite
--    нельзя изменить на месте, поэтому таблица пересобирается целиком
--    (данные переносятся INSERT ... SELECT).

ALTER TABLE campaign_npcs ADD COLUMN sheet_json TEXT NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS combat_participants_new (
  id TEXT PRIMARY KEY,
  combat_id TEXT NOT NULL,
  participant_type TEXT NOT NULL CHECK (participant_type IN ('player', 'monster', 'npc')),
  user_id INTEGER,
  player_id INTEGER,
  monster_bestiary_id INTEGER,
  -- ссылка на campaign_npcs.id (для участников типа 'npc')
  npc_id INTEGER,
  display_name TEXT NOT NULL,
  image_url TEXT NOT NULL DEFAULT '',
  initiative_value INTEGER NOT NULL DEFAULT 0,
  initiative_order INTEGER NOT NULL DEFAULT 0,
  current_hp INTEGER,
  max_hp INTEGER,
  temp_hp INTEGER NOT NULL DEFAULT 0,
  armor_class INTEGER,
  is_hidden_from_players INTEGER NOT NULL DEFAULT 0,
  hide_name INTEGER NOT NULL DEFAULT 0,
  is_defeated INTEGER NOT NULL DEFAULT 0,
  death_saves_successes INTEGER NOT NULL DEFAULT 0,
  death_saves_failures INTEGER NOT NULL DEFAULT 0,
  is_stable INTEGER NOT NULL DEFAULT 0,
  statblock TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);

INSERT INTO combat_participants_new (
  id, combat_id, participant_type, user_id, player_id, monster_bestiary_id, npc_id,
  display_name, image_url, initiative_value, initiative_order, current_hp, max_hp,
  temp_hp, armor_class, is_hidden_from_players, hide_name, is_defeated,
  death_saves_successes, death_saves_failures, is_stable, statblock, notes, created_at
)
SELECT
  id, combat_id, participant_type, user_id, player_id, monster_bestiary_id, NULL,
  display_name, image_url, initiative_value, initiative_order, current_hp, max_hp,
  temp_hp, armor_class, is_hidden_from_players, hide_name, is_defeated,
  death_saves_successes, death_saves_failures, is_stable, statblock, notes, created_at
FROM combat_participants;

DROP TABLE combat_participants;

ALTER TABLE combat_participants_new RENAME TO combat_participants;

CREATE INDEX IF NOT EXISTS idx_combat_participants_combat
  ON combat_participants(combat_id, initiative_order ASC);
