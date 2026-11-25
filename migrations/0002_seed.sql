-- 0002_seed.sql
-- Clean initial accounts & empty player slots (no invented demo characters, quests, monsters, or spells).
-- Passwords (bcrypt cost 10):
--   dm      -> master123
--   player1 -> player123
--   player2 -> player123
--   player3 -> player123

INSERT OR IGNORE INTO users (id, username, display_name, email, password_hash, role, player_id) VALUES
  (1, 'dm', 'Мастер (DM)', 'dm@fraith.local', '$2a$10$lGOJrpCOxWRYIPlNwzbq/e1xVqjRiPD2qlg2Gun27308UyTRRYXMu', 'dm', NULL),
  (2, 'player1', 'Игрок 1', 'player1@fraith.local', '$2a$10$aVa3OdzHko9ix4EJGhoX8.b53GmejM9VXjx7RUAf.H5Cacm2GmfMe', 'player', 1),
  (3, 'player2', 'Игрок 2', 'player2@fraith.local', '$2a$10$.md.rhwfJG1p4n1/atQSyeuKv4S4xJKuenHgJ6TPFzGCUWPyzv7Cu', 'player', 2),
  (4, 'player3', 'Игрок 3', 'player3@fraith.local', '$2a$10$6fcRLEFELtpfOtgr9U7kWucuRQOjI1FNbr1Bmw8Lkt4Cz5PW29wka', 'player', 3);

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

INSERT OR IGNORE INTO schema_migrations (version) VALUES ('2026_11_25_clean_empty_campaign_and_dndsu_v1');
