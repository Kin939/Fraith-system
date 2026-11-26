-- Вкладка «Бой»: конструктор боёв и трекер инициативы.
-- Существующие таблицы (в т.ч. bestiary) не изменяются — «Бой» только читает их.

CREATE TABLE IF NOT EXISTS combats (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'setup' CHECK (status IN ('setup', 'active', 'paused', 'finished')),
  current_turn_index INTEGER NOT NULL DEFAULT 0,
  round_number INTEGER NOT NULL DEFAULT 1,
  -- NULL = без таймера
  turn_timer_seconds INTEGER,
  -- Unix ms, если отсчёт идёт прямо сейчас
  turn_timer_ends_at INTEGER,
  -- сколько осталось, если таймер на паузе
  turn_timer_paused_remaining_ms INTEGER,
  -- разрешено ли игроку самому завершать свой ход
  allow_player_turn INTEGER NOT NULL DEFAULT 0,
  show_player_hp INTEGER NOT NULL DEFAULT 1,
  show_other_death_saves INTEGER NOT NULL DEFAULT 0,
  monster_hp_visibility TEXT NOT NULL DEFAULT 'bar'
    CHECK (monster_hp_visibility IN ('hidden', 'bar', 'numbers')),
  created_by INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_combats_campaign ON combats(campaign_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS combat_participants (
  id TEXT PRIMARY KEY,
  combat_id TEXT NOT NULL,
  participant_type TEXT NOT NULL CHECK (participant_type IN ('player', 'monster')),
  -- аккаунт игрока (users.id) и слот персонажа (character_profiles.player_id)
  user_id INTEGER,
  player_id INTEGER,
  -- ссылка на существующий бестиарий (bestiary.id), только чтение
  monster_bestiary_id INTEGER,
  display_name TEXT NOT NULL,
  image_url TEXT NOT NULL DEFAULT '',
  initiative_value INTEGER NOT NULL DEFAULT 0,
  initiative_order INTEGER NOT NULL DEFAULT 0,
  current_hp INTEGER,
  max_hp INTEGER,
  temp_hp INTEGER NOT NULL DEFAULT 0,
  armor_class INTEGER,
  is_hidden_from_players INTEGER NOT NULL DEFAULT 0,
  -- скрыть даже имя (игроки видят «Неизвестное существо»)
  hide_name INTEGER NOT NULL DEFAULT 0,
  is_defeated INTEGER NOT NULL DEFAULT 0,
  death_saves_successes INTEGER NOT NULL DEFAULT 0,
  death_saves_failures INTEGER NOT NULL DEFAULT 0,
  is_stable INTEGER NOT NULL DEFAULT 0,
  -- стат-блок моба (текст из бестиария) — только для мастера
  statblock TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_combat_participants_combat
  ON combat_participants(combat_id, initiative_order ASC);

CREATE TABLE IF NOT EXISTS combat_effects (
  id TEXT PRIMARY KEY,
  combat_id TEXT NOT NULL,
  participant_id TEXT NOT NULL,
  effect_name TEXT NOT NULL,
  effect_type TEXT NOT NULL CHECK (effect_type IN ('condition', 'exhaustion', 'custom')),
  exhaustion_level INTEGER NOT NULL DEFAULT 0,
  duration_type TEXT CHECK (duration_type IN ('rounds', 'until_save', 'until_removed', 'permanent')),
  duration_value INTEGER,
  description TEXT NOT NULL DEFAULT '',
  is_visible_to_players INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_combat_effects_participant
  ON combat_effects(combat_id, participant_id);

CREATE TABLE IF NOT EXISTS combat_log (
  id TEXT PRIMARY KEY,
  combat_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  participant_id TEXT,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_combat_log_combat ON combat_log(combat_id, created_at DESC);
