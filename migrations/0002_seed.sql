-- 0002_seed.sql
-- Clean initial accounts with distinct per-account password hashes & empty player slots.

INSERT OR IGNORE INTO users (id, username, display_name, email, password_hash, role, player_id, session_version) VALUES
  (1, 'dm', 'Мастер (DM)', NULL, '$2a$10$5L8OD4oKlY29lH9fQL57becOxkeTF38Eaihn776peU0yB3hDe8Ewq', 'dm', NULL, 2),
  (2, 'player1', 'Игрок 1', 'player1@fraith.local', '$2a$10$nZKTFNxwscpUSfv8AvkZCucixnxttT.mFdaimxIbK0xyDxHCbnLCC', 'player', 1, 2),
  (3, 'player2', 'Игрок 2', 'player2@fraith.local', '$2a$10$GXbGJlaO2ZXAVYPEP9DI4OM7Jfa8dfgdfvvcC9HNVK12WWgHkaD1W', 'player', 2, 2),
  (4, 'player3', 'Игрок 3', 'player3@fraith.local', '$2a$10$Nkr8Vh/6m6LcSmcEKyUjVuXLd1ZoPu12hEwgVb6RBguqv8Rj5gZou', 'player', 3, 2);

INSERT OR REPLACE INTO player_credentials (user_id, plain_password, updated_at) VALUES
  (2, 'Hero1-7394-Blade', datetime('now')),
  (3, 'Hero2-5821-Runes', datetime('now')),
  (4, 'Hero3-6149-Spark', datetime('now'));

INSERT OR IGNORE INTO user_themes (user_id, theme_json) VALUES
  (1, '{"bg":"#0f0f1a","surface":"#1a1a2e","primary":"#a855f7","accent":"#22d3ee","text":"#f4f4fe","textMuted":"#94a3b8","border":"#2e2e4d","glow":"rgba(168, 85, 247, 0.42)"}'),
  (2, '{"bg":"#0b1020","surface":"#151d36","primary":"#38bdf8","accent":"#f472b6","text":"#f0f7ff","textMuted":"#93a8c7","border":"#26365e","glow":"rgba(56, 189, 248, 0.42)"}'),
  (3, '{"bg":"#130f1c","surface":"#211a30","primary":"#f59e0b","accent":"#fb7185","text":"#fdf8f3","textMuted":"#b5a7c7","border":"#3b2e54","glow":"rgba(245, 158, 11, 0.38)"}'),
  (4, '{"bg":"#120b16","surface":"#201329","primary":"#ec4899","accent":"#2dd4bf","text":"#fdf2f8","textMuted":"#b89cc4","border":"#3d224d","glow":"rgba(236, 72, 153, 0.44)"}');

INSERT OR IGNORE INTO character_profiles (
  player_id, character_name, char_class, subclass, race, level, max_spells,
  lss_embed_url, coins_cp, coins_sp, coins_ep, coins_gp, coins_pp,
  hp_current, hp_max, hp_temp, lss_notes, raw_lss_json, last_synced_at
) VALUES
  (1, '', '', '', '', 0, 0, 'https://longstoryshort.app/iframe/characters/list/', 0, 0, 0, 0, 0, 0, 0, 0, '', NULL, NULL),
  (2, '', '', '', '', 0, 0, 'https://longstoryshort.app/iframe/characters/list/', 0, 0, 0, 0, 0, 0, 0, 0, '', NULL, NULL),
  (3, '', '', '', '', 0, 0, 'https://longstoryshort.app/iframe/characters/list/', 0, 0, 0, 0, 0, 0, 0, 0, '', NULL, NULL);

INSERT OR IGNORE INTO inspiration_pool (campaign_id, points) VALUES ('fraith-main-campaign', 0);

INSERT OR IGNORE INTO schema_migrations (version) VALUES
  ('2026_11_25_clean_empty_campaign_and_dndsu_v1'),
  ('2026_11_25_unique_passwords_and_dm_lock_v1');
