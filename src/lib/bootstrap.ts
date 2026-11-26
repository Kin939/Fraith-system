let initPromise: Promise<void> | null = null;

const CLEAN_SLATE_MIGRATION_ID = '2026_11_25_clean_empty_campaign_and_dndsu_v1';
const UNIQUE_PASSWORDS_MIGRATION_ID = '2026_11_25_unique_passwords_and_dm_lock_v1';

/**
 * Idempotently initializes all Cloudflare D1 SQLite tables, applies schema upgrades,
 * enforces unique per-account password hashes, and ensures empty character slots.
 */
export function ensureDatabaseInitialized(db: D1Database): Promise<void> {
  if (!initPromise) {
    initPromise = runBootstrap(db).catch((err) => {
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}

async function ensureUsersColumns(db: D1Database): Promise<void> {
  const { results } = await db
    .prepare(`PRAGMA table_info(users)`)
    .all<{ name: string }>();
  const existingCols = new Set(results.map((r) => r.name));

  if (!existingCols.has('session_version')) {
    await db
      .prepare(`ALTER TABLE users ADD COLUMN session_version INTEGER NOT NULL DEFAULT 2`)
      .run();
  }
}

async function ensureQuestStyleColumns(db: D1Database): Promise<void> {
  const { results } = await db
    .prepare(`PRAGMA table_info(quests)`)
    .all<{ name: string }>();
  const existingCols = new Set(results.map((r) => r.name));

  const extraColumns: Array<[string, string]> = [
    ['tile_accent', 'TEXT'],
    ['tile_emblem', 'TEXT'],
    ['tile_pattern', `TEXT NOT NULL DEFAULT 'none'`],
    ['is_important', 'INTEGER NOT NULL DEFAULT 0'],
  ];

  for (const [col, def] of extraColumns) {
    if (!existingCols.has(col)) {
      await db.prepare(`ALTER TABLE quests ADD COLUMN ${col} ${def}`).run();
    }
  }
}

async function ensureTalentTreeColumns(db: D1Database): Promise<void> {
  const { results } = await db
    .prepare(`PRAGMA table_info(talent_tree)`)
    .all<{ name: string }>();
  const existingCols = new Set(results.map((r) => r.name));

  if (!existingCols.has('is_unlocked')) {
    await db
      .prepare(`ALTER TABLE talent_tree ADD COLUMN is_unlocked INTEGER NOT NULL DEFAULT 0`)
      .run();
    await db
      .prepare(
        `UPDATE talent_tree
         SET is_unlocked = 1
         WHERE id IN (SELECT DISTINCT talent_id FROM purchased_talents)`
      )
      .run();
  }
  if (!existingCols.has('unlocked_at')) {
    await db.prepare(`ALTER TABLE talent_tree ADD COLUMN unlocked_at TEXT`).run();
  }
}

async function ensureCharacterProfileColumns(db: D1Database): Promise<void> {
  const { results } = await db
    .prepare(`PRAGMA table_info(character_profiles)`)
    .all<{ name: string }>();
  const existingCols = new Set(results.map((r) => r.name));

  if (!existingCols.has('experience_current')) {
    await db
      .prepare(
        `ALTER TABLE character_profiles ADD COLUMN experience_current INTEGER NOT NULL DEFAULT 0`
      )
      .run();
  }
  if (!existingCols.has('experience_max')) {
    await db
      .prepare(
        `ALTER TABLE character_profiles ADD COLUMN experience_max INTEGER NOT NULL DEFAULT 0`
      )
      .run();
  }
  if (!existingCols.has('allow_off_class_spells')) {
    await db
      .prepare(
        `ALTER TABLE character_profiles ADD COLUMN allow_off_class_spells INTEGER NOT NULL DEFAULT 0`
      )
      .run();
  }
}

async function ensureLearnedSpellsColumns(db: D1Database): Promise<void> {
  const { results } = await db
    .prepare(`PRAGMA table_info(learned_spells)`)
    .all<{ name: string }>();
  const existingCols = new Set(results.map((r) => r.name));

  const extraColumns: Array<[string, string]> = [
    ['cast_mode', `TEXT NOT NULL DEFAULT 'slot'`],
    ['cast_max_uses', `INTEGER NOT NULL DEFAULT 1`],
    ['cast_note', `TEXT NOT NULL DEFAULT ''`],
    ['granted_by_dm', `INTEGER NOT NULL DEFAULT 0`],
  ];

  for (const [col, def] of extraColumns) {
    if (!existingCols.has(col)) {
      await db.prepare(`ALTER TABLE learned_spells ADD COLUMN ${col} ${def}`).run();
    }
  }
}

async function ensureSpellsDndsuColumns(db: D1Database): Promise<void> {
  const { results } = await db
    .prepare(`PRAGMA table_info(spells)`)
    .all<{ name: string }>();
  const existingCols = new Set(results.map((r) => r.name));

  const extraColumns: Array<[string, string]> = [
    ['name_en', `TEXT NOT NULL DEFAULT ''`],
    ['url', `TEXT NOT NULL DEFAULT ''`],
    ['type_line', `TEXT NOT NULL DEFAULT ''`],
    ['subclasses', `TEXT NOT NULL DEFAULT ''`],
    ['components_badge', `TEXT NOT NULL DEFAULT ''`],
    ['ritual', `INTEGER NOT NULL DEFAULT 0`],
    ['concentration', `INTEGER NOT NULL DEFAULT 0`],
    ['description_html', `TEXT NOT NULL DEFAULT ''`],
    ['source_title', `TEXT NOT NULL DEFAULT ''`],
  ];

  for (const [col, def] of extraColumns) {
    if (!existingCols.has(col)) {
      await db.prepare(`ALTER TABLE spells ADD COLUMN ${col} ${def}`).run();
    }
  }
}

async function runBootstrap(db: D1Database): Promise<void> {
  const schemaStatements = [
    `CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      email TEXT,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('dm', 'player')),
      player_id INTEGER UNIQUE CHECK (player_id IN (1, 2, 3) OR player_id IS NULL),
      avatar_key TEXT,
      session_version INTEGER NOT NULL DEFAULT 2,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS player_credentials (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      plain_password TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS user_themes (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      theme_json TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS character_profiles (
      player_id INTEGER PRIMARY KEY CHECK (player_id IN (1, 2, 3)),
      character_name TEXT NOT NULL DEFAULT '',
      char_class TEXT NOT NULL DEFAULT '',
      subclass TEXT NOT NULL DEFAULT '',
      race TEXT NOT NULL DEFAULT '',
      level INTEGER NOT NULL DEFAULT 0,
      experience_current INTEGER NOT NULL DEFAULT 0,
      experience_max INTEGER NOT NULL DEFAULT 0,
      max_spells INTEGER NOT NULL DEFAULT 0,
      lss_embed_url TEXT NOT NULL DEFAULT 'https://longstoryshort.app/iframe/characters/list/',
      coins_cp INTEGER NOT NULL DEFAULT 0,
      coins_sp INTEGER NOT NULL DEFAULT 0,
      coins_ep INTEGER NOT NULL DEFAULT 0,
      coins_gp INTEGER NOT NULL DEFAULT 0,
      coins_pp INTEGER NOT NULL DEFAULT 0,
      hp_current INTEGER NOT NULL DEFAULT 0,
      hp_max INTEGER NOT NULL DEFAULT 0,
      hp_temp INTEGER NOT NULL DEFAULT 0,
      lss_notes TEXT NOT NULL DEFAULT '',
      raw_lss_json TEXT,
      last_synced_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS journal_entries (
      player_id INTEGER PRIMARY KEY CHECK (player_id IN (1, 2, 3)),
      title TEXT NOT NULL DEFAULT 'Личный журнал',
      content TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS quests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      short_desc TEXT NOT NULL,
      full_desc TEXT NOT NULL,
      reward TEXT NOT NULL DEFAULT '',
      parameters_json TEXT NOT NULL DEFAULT '{}',
      progress_current INTEGER NOT NULL DEFAULT 0,
      progress_target INTEGER NOT NULL DEFAULT 1,
      image_key TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed', 'available')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      tile_accent TEXT,
      tile_emblem TEXT,
      tile_pattern TEXT NOT NULL DEFAULT 'none',
      is_important INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS bestiary (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      cr TEXT NOT NULL DEFAULT '1',
      cr_numeric REAL NOT NULL DEFAULT 1.0,
      creature_type TEXT NOT NULL DEFAULT 'Чудовище',
      ac INTEGER NOT NULL DEFAULT 13,
      hp TEXT NOT NULL DEFAULT '22 (4d8 + 4)',
      description TEXT NOT NULL DEFAULT '',
      image_key TEXT,
      is_revealed INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE INDEX IF NOT EXISTS idx_bestiary_cr ON bestiary(cr_numeric ASC, sort_order ASC, id ASC)`,
    `CREATE TABLE IF NOT EXISTS spells (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      name_en TEXT NOT NULL DEFAULT '',
      url TEXT NOT NULL DEFAULT '',
      level INTEGER NOT NULL CHECK (level >= 0 AND level <= 9),
      school TEXT NOT NULL,
      type_line TEXT NOT NULL DEFAULT '',
      classes TEXT NOT NULL,
      subclasses TEXT NOT NULL DEFAULT '',
      casting_time TEXT NOT NULL DEFAULT '1 действие',
      spell_range TEXT NOT NULL DEFAULT '60 футов',
      components TEXT NOT NULL DEFAULT 'В, С',
      components_badge TEXT NOT NULL DEFAULT '',
      ritual INTEGER NOT NULL DEFAULT 0,
      concentration INTEGER NOT NULL DEFAULT 0,
      duration TEXT NOT NULL DEFAULT 'Мгновенная',
      description TEXT NOT NULL,
      description_html TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT 'PH14',
      source_title TEXT NOT NULL DEFAULT '',
      is_homebrew INTEGER NOT NULL DEFAULT 0,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_spells_level_school ON spells(level ASC, school ASC)`,
    `CREATE TABLE IF NOT EXISTS learned_spells (
      player_id INTEGER NOT NULL CHECK (player_id IN (1, 2, 3)),
      spell_id INTEGER NOT NULL REFERENCES spells(id) ON DELETE CASCADE,
      learned_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (player_id, spell_id)
    )`,
    `CREATE TABLE IF NOT EXISTS inspiration_pool (
      campaign_id TEXT PRIMARY KEY,
      points INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS talent_tree (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      image_key TEXT,
      cost INTEGER NOT NULL DEFAULT 1 CHECK (cost >= 0),
      position_x INTEGER NOT NULL DEFAULT 60,
      position_y INTEGER NOT NULL DEFAULT 60,
      parent_id INTEGER REFERENCES talent_tree(id) ON DELETE SET NULL,
      is_unlocked INTEGER NOT NULL DEFAULT 0,
      unlocked_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS purchased_talents (
      player_id INTEGER NOT NULL CHECK (player_id IN (1, 2, 3)),
      talent_id INTEGER NOT NULL REFERENCES talent_tree(id) ON DELETE CASCADE,
      purchased_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (player_id, talent_id)
    )`,
    `CREATE TABLE IF NOT EXISTS roll_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id INTEGER,
      character_name TEXT NOT NULL,
      title TEXT NOT NULL,
      formula TEXT NOT NULL,
      breakdown TEXT NOT NULL,
      total TEXT NOT NULL,
      is_crit INTEGER NOT NULL DEFAULT 0,
      crit_kind TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS media_blobs (
      key TEXT PRIMARY KEY,
      content_type TEXT NOT NULL,
      data_base64 TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS chat_polls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      creator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind TEXT NOT NULL DEFAULT 'general' CHECK (kind IN ('date', 'general')),
      question TEXT NOT NULL,
      allow_multiple INTEGER NOT NULL DEFAULT 1,
      is_anonymous INTEGER NOT NULL DEFAULT 0,
      allow_add_options INTEGER NOT NULL DEFAULT 0,
      is_closed INTEGER NOT NULL DEFAULT 0,
      confirmed_option_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS chat_poll_options (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      poll_id INTEGER NOT NULL REFERENCES chat_polls(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      date_iso TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE INDEX IF NOT EXISTS idx_chat_poll_options_poll ON chat_poll_options(poll_id ASC, sort_order ASC, id ASC)`,
    `CREATE TABLE IF NOT EXISTS chat_poll_votes (
      poll_id INTEGER NOT NULL REFERENCES chat_polls(id) ON DELETE CASCADE,
      option_id INTEGER NOT NULL REFERENCES chat_poll_options(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (option_id, user_id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_chat_poll_votes_poll ON chat_poll_votes(poll_id ASC)`,
    `CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      sender_username TEXT NOT NULL,
      sender_display_name TEXT NOT NULL,
      sender_role TEXT NOT NULL CHECK (sender_role IN ('dm', 'player')),
      sender_player_id INTEGER,
      content TEXT NOT NULL DEFAULT '',
      reply_to_id INTEGER REFERENCES chat_messages(id) ON DELETE SET NULL,
      attachments_json TEXT NOT NULL DEFAULT '[]',
      poll_id INTEGER REFERENCES chat_polls(id) ON DELETE SET NULL,
      is_pinned INTEGER NOT NULL DEFAULT 0,
      edited_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(id ASC)`,
    `CREATE INDEX IF NOT EXISTS idx_chat_messages_pinned ON chat_messages(is_pinned DESC, id DESC)`,
    `CREATE TABLE IF NOT EXISTS chat_reactions (
      message_id INTEGER NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      emoji TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (message_id, user_id, emoji)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_chat_reactions_msg ON chat_reactions(message_id ASC)`,
    `CREATE TABLE IF NOT EXISTS campaign_next_session (
      campaign_id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      date_iso TEXT,
      note TEXT NOT NULL DEFAULT '',
      poll_id INTEGER REFERENCES chat_polls(id) ON DELETE SET NULL,
      updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS chat_custom_emojis (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      image_key TEXT NOT NULL,
      image_url TEXT NOT NULL,
      creator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_chat_custom_emojis_code ON chat_custom_emojis(code ASC)`,
  ];

  await db.batch(schemaStatements.map((sql) => db.prepare(sql)));
  await ensureUsersColumns(db);
  await ensureQuestStyleColumns(db);
  await ensureTalentTreeColumns(db);
  await ensureCharacterProfileColumns(db);
  await ensureSpellsDndsuColumns(db);
  await ensureLearnedSpellsColumns(db);

  const existingUser = await db
    .prepare(`SELECT id FROM users LIMIT 1`)
    .first<{ id: number }>();

  if (!existingUser) {
    // Fresh database: seed ONLY accounts with distinct password hashes, player credentials for DM tab, themes, and empty character slots
    const freshStatements = [
      `INSERT OR IGNORE INTO users (id, username, display_name, email, password_hash, role, player_id, session_version) VALUES
        (1, 'dm', 'Мастер (DM)', NULL, '$2a$10$5L8OD4oKlY29lH9fQL57becOxkeTF38Eaihn776peU0yB3hDe8Ewq', 'dm', NULL, 2),
        (2, 'player1', 'Игрок 1', 'player1@fraith.local', '$2a$10$nZKTFNxwscpUSfv8AvkZCucixnxttT.mFdaimxIbK0xyDxHCbnLCC', 'player', 1, 2),
        (3, 'player2', 'Игрок 2', 'player2@fraith.local', '$2a$10$GXbGJlaO2ZXAVYPEP9DI4OM7Jfa8dfgdfvvcC9HNVK12WWgHkaD1W', 'player', 2, 2),
        (4, 'player3', 'Игрок 3', 'player3@fraith.local', '$2a$10$Nkr8Vh/6m6LcSmcEKyUjVuXLd1ZoPu12hEwgVb6RBguqv8Rj5gZou', 'player', 3, 2)`,

      `INSERT OR REPLACE INTO player_credentials (user_id, plain_password, updated_at) VALUES
        (2, 'Hero1-7394-Blade', datetime('now')),
        (3, 'Hero2-5821-Runes', datetime('now')),
        (4, 'Hero3-6149-Spark', datetime('now'))`,

      `INSERT OR IGNORE INTO user_themes (user_id, theme_json) VALUES
        (1, '{"bg":"#0f0f1a","surface":"#1a1a2e","primary":"#a855f7","accent":"#22d3ee","text":"#f4f4fe","textMuted":"#94a3b8","border":"#2e2e4d","glow":"rgba(168, 85, 247, 0.42)"}'),
        (2, '{"bg":"#0b1020","surface":"#151d36","primary":"#38bdf8","accent":"#f472b6","text":"#f0f7ff","textMuted":"#93a8c7","border":"#26365e","glow":"rgba(56, 189, 248, 0.42)"}'),
        (3, '{"bg":"#130f1c","surface":"#211a30","primary":"#f59e0b","accent":"#fb7185","text":"#fdf8f3","textMuted":"#b5a7c7","border":"#3b2e54","glow":"rgba(245, 158, 11, 0.38)"}'),
        (4, '{"bg":"#120b16","surface":"#201329","primary":"#ec4899","accent":"#2dd4bf","text":"#fdf2f8","textMuted":"#b89cc4","border":"#3d224d","glow":"rgba(236, 72, 153, 0.44)"}')`,

      `INSERT OR IGNORE INTO character_profiles (
        player_id, character_name, char_class, subclass, race, level, max_spells,
        lss_embed_url, coins_cp, coins_sp, coins_ep, coins_gp, coins_pp,
        hp_current, hp_max, hp_temp, lss_notes, raw_lss_json, last_synced_at
      ) VALUES
        (1, '', '', '', '', 0, 0, 'https://longstoryshort.app/iframe/characters/list/', 0, 0, 0, 0, 0, 0, 0, 0, '', NULL, NULL),
        (2, '', '', '', '', 0, 0, 'https://longstoryshort.app/iframe/characters/list/', 0, 0, 0, 0, 0, 0, 0, 0, '', NULL, NULL),
        (3, '', '', '', '', 0, 0, 'https://longstoryshort.app/iframe/characters/list/', 0, 0, 0, 0, 0, 0, 0, 0, '', NULL, NULL)`,

      `INSERT OR IGNORE INTO inspiration_pool (campaign_id, points) VALUES ('fraith-main-campaign', 0)`,
      `INSERT OR IGNORE INTO schema_migrations (version) VALUES ('${CLEAN_SLATE_MIGRATION_ID}')`,
      `INSERT OR IGNORE INTO schema_migrations (version) VALUES ('${UNIQUE_PASSWORDS_MIGRATION_ID}')`,
    ];

    await db.batch(freshStatements.map((sql) => db.prepare(sql)));
    return;
  }

  // Migration 1: one-time cleanup of old demo seed data if upgrading from earliest deploy
  const cleanApplied = await db
    .prepare(`SELECT version FROM schema_migrations WHERE version = ?`)
    .bind(CLEAN_SLATE_MIGRATION_ID)
    .first<{ version: string }>();

  if (!cleanApplied) {
    const cleanupStatements = [
      `UPDATE users SET display_name = 'Мастер (DM)' WHERE username = 'dm'`,
      `UPDATE users SET display_name = 'Игрок 1' WHERE username = 'player1'`,
      `UPDATE users SET display_name = 'Игрок 2' WHERE username = 'player2'`,
      `UPDATE users SET display_name = 'Игрок 3' WHERE username = 'player3'`,
      `UPDATE character_profiles
       SET character_name = '',
           char_class = '',
           subclass = '',
           race = '',
           level = 0,
           max_spells = 0,
           coins_cp = 0,
           coins_sp = 0,
           coins_ep = 0,
           coins_gp = 0,
           coins_pp = 0,
           hp_current = 0,
           hp_max = 0,
           hp_temp = 0,
           lss_notes = '',
           raw_lss_json = NULL,
           last_synced_at = NULL`,
      `DELETE FROM journal_entries`,
      `DELETE FROM quests`,
      `DELETE FROM bestiary`,
      `DELETE FROM purchased_talents`,
      `DELETE FROM talent_tree`,
      `DELETE FROM learned_spells`,
      `DELETE FROM spells`,
      `DELETE FROM roll_log`,
      `UPDATE inspiration_pool SET points = 0`,
      `INSERT OR IGNORE INTO schema_migrations (version) VALUES ('${CLEAN_SLATE_MIGRATION_ID}')`,
    ];

    await db.batch(cleanupStatements.map((sql) => db.prepare(sql)));
  }

  // Migration 2: rotate all 4 accounts to unique passwords, lock DM account, invalidate legacy cookies, and store player credentials for DM tab
  const passwordsApplied = await db
    .prepare(`SELECT version FROM schema_migrations WHERE version = ?`)
    .bind(UNIQUE_PASSWORDS_MIGRATION_ID)
    .first<{ version: string }>();

  if (!passwordsApplied) {
    const passwordStatements = [
      `UPDATE users
       SET password_hash = '$2a$10$5L8OD4oKlY29lH9fQL57becOxkeTF38Eaihn776peU0yB3hDe8Ewq',
           email = NULL,
           session_version = COALESCE(session_version, 1) + 1
       WHERE username = 'dm'`,
      `UPDATE users
       SET password_hash = '$2a$10$nZKTFNxwscpUSfv8AvkZCucixnxttT.mFdaimxIbK0xyDxHCbnLCC',
           session_version = COALESCE(session_version, 1) + 1
       WHERE username = 'player1'`,
      `UPDATE users
       SET password_hash = '$2a$10$GXbGJlaO2ZXAVYPEP9DI4OM7Jfa8dfgdfvvcC9HNVK12WWgHkaD1W',
           session_version = COALESCE(session_version, 1) + 1
       WHERE username = 'player2'`,
      `UPDATE users
       SET password_hash = '$2a$10$Nkr8Vh/6m6LcSmcEKyUjVuXLd1ZoPu12hEwgVb6RBguqv8Rj5gZou',
           session_version = COALESCE(session_version, 1) + 1
       WHERE username = 'player3'`,
      `DELETE FROM player_credentials WHERE user_id IN (SELECT id FROM users WHERE role = 'dm')`,
      `INSERT OR REPLACE INTO player_credentials (user_id, plain_password, updated_at)
       SELECT id, 'Hero1-7394-Blade', datetime('now') FROM users WHERE username = 'player1'`,
      `INSERT OR REPLACE INTO player_credentials (user_id, plain_password, updated_at)
       SELECT id, 'Hero2-5821-Runes', datetime('now') FROM users WHERE username = 'player2'`,
      `INSERT OR REPLACE INTO player_credentials (user_id, plain_password, updated_at)
       SELECT id, 'Hero3-6149-Spark', datetime('now') FROM users WHERE username = 'player3'`,
      `INSERT OR IGNORE INTO schema_migrations (version) VALUES ('${UNIQUE_PASSWORDS_MIGRATION_ID}')`,
    ];

    await db.batch(passwordStatements.map((sql) => db.prepare(sql)));
  }

  // Ensure all 3 character_profiles slots always exist (1, 2, 3)
  await db.batch([
    db.prepare(
      `INSERT OR IGNORE INTO character_profiles (player_id) VALUES (1), (2), (3)`
    ),
  ]);
}
