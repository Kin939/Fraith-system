let initPromise: Promise<void> | null = null;

/**
 * Idempotently initializes all Cloudflare D1 SQLite tables and initial seed data
 * on first Worker cold-start so a freshly auto-provisioned D1 database works immediately
 * after `npx wrangler deploy` without manual CLI steps.
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

async function runBootstrap(db: D1Database): Promise<void> {
  const schemaStatements = [
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      email TEXT,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('dm', 'player')),
      player_id INTEGER UNIQUE CHECK (player_id IN (1, 2, 3) OR player_id IS NULL),
      avatar_key TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS user_themes (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      theme_json TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS character_profiles (
      player_id INTEGER PRIMARY KEY CHECK (player_id IN (1, 2, 3)),
      character_name TEXT NOT NULL,
      char_class TEXT NOT NULL DEFAULT 'Wizard',
      subclass TEXT NOT NULL DEFAULT '',
      race TEXT NOT NULL DEFAULT 'Human',
      level INTEGER NOT NULL DEFAULT 1,
      max_spells INTEGER NOT NULL DEFAULT 6,
      lss_embed_url TEXT NOT NULL DEFAULT 'https://longstoryshort.app/iframe/characters/list/',
      coins_cp INTEGER NOT NULL DEFAULT 0,
      coins_sp INTEGER NOT NULL DEFAULT 0,
      coins_ep INTEGER NOT NULL DEFAULT 0,
      coins_gp INTEGER NOT NULL DEFAULT 0,
      coins_pp INTEGER NOT NULL DEFAULT 0,
      hp_current INTEGER NOT NULL DEFAULT 10,
      hp_max INTEGER NOT NULL DEFAULT 10,
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
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
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
      level INTEGER NOT NULL CHECK (level >= 0 AND level <= 9),
      school TEXT NOT NULL,
      classes TEXT NOT NULL,
      casting_time TEXT NOT NULL DEFAULT '1 действие',
      spell_range TEXT NOT NULL DEFAULT '60 футов',
      components TEXT NOT NULL DEFAULT 'В, С',
      duration TEXT NOT NULL DEFAULT 'Мгновенная',
      description TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'SRD 5.1',
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
      position_x INTEGER NOT NULL DEFAULT 0,
      position_y INTEGER NOT NULL DEFAULT 0,
      parent_id INTEGER REFERENCES talent_tree(id) ON DELETE SET NULL
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
  ];

  await db.batch(schemaStatements.map((sql) => db.prepare(sql)));

  // Check if users are already seeded
  const existingUser = await db
    .prepare(`SELECT id FROM users LIMIT 1`)
    .first<{ id: number }>();

  if (existingUser) {
    return;
  }

  const seedStatements = [
    `INSERT OR IGNORE INTO users (id, username, display_name, email, password_hash, role, player_id) VALUES
      (1, 'dm', 'Архитектор Бездны (DM)', 'dm@fraith.local', '$2a$10$lGOJrpCOxWRYIPlNwzbq/e1xVqjRiPD2qlg2Gun27308UyTRRYXMu', 'dm', NULL),
      (2, 'player1', 'Аэлин Звёздный Шёпот', 'player1@fraith.local', '$2a$10$aVa3OdzHko9ix4EJGhoX8.b53GmejM9VXjx7RUAf.H5Cacm2GmfMe', 'player', 1),
      (3, 'player2', 'Каэл Железный Обет', 'player2@fraith.local', '$2a$10$.md.rhwfJG1p4n1/atQSyeuKv4S4xJKuenHgJ6TPFzGCUWPyzv7Cu', 'player', 2),
      (4, 'player3', 'Никс Тень Луны', 'player3@fraith.local', '$2a$10$6fcRLEFELtpfOtgr9U7kWucuRQOjI1FNbr1Bmw8Lkt4Cz5PW29wka', 'player', 3)`,

    `INSERT OR IGNORE INTO user_themes (user_id, theme_json) VALUES
      (1, '{"bg":"#0f0f1a","surface":"#1a1a2e","primary":"#a855f7","accent":"#22d3ee","text":"#f4f4fe","textMuted":"#94a3b8","border":"#2e2e4d","glow":"rgba(168, 85, 247, 0.42)"}'),
      (2, '{"bg":"#0b1020","surface":"#151d36","primary":"#38bdf8","accent":"#f472b6","text":"#f0f7ff","textMuted":"#93a8c7","border":"#26365e","glow":"rgba(56, 189, 248, 0.42)"}'),
      (3, '{"bg":"#130f1c","surface":"#211a30","primary":"#f59e0b","accent":"#fb7185","text":"#fdf8f3","textMuted":"#b5a7c7","border":"#3b2e54","glow":"rgba(245, 158, 11, 0.38)"}'),
      (4, '{"bg":"#120b16","surface":"#201329","primary":"#ec4899","accent":"#2dd4bf","text":"#fdf2f8","textMuted":"#b89cc4","border":"#3d224d","glow":"rgba(236, 72, 153, 0.44)"}')`,

    `INSERT OR IGNORE INTO character_profiles (
      player_id, character_name, char_class, subclass, race, level, max_spells,
      lss_embed_url, coins_cp, coins_sp, coins_ep, coins_gp, coins_pp,
      hp_current, hp_max, hp_temp, lss_notes, last_synced_at
    ) VALUES
      (1, 'Аэлин Звёздный Шёпот', 'Wizard', 'Школа Прорицания', 'Высший эльф', 5, 8, 'https://longstoryshort.app/iframe/characters/list/', 34, 18, 0, 145, 2, 31, 32, 5, 'Хранит осколок Астральной призмы в переплёте гримуара. Долг гильдии картографов Фрейта погашен.', datetime('now')),
      (2, 'Каэл Железный Обет', 'Cleric', 'Домен Сумерек', 'Аасимар', 5, 7, 'https://longstoryshort.app/iframe/characters/list/', 12, 45, 2, 210, 1, 44, 44, 0, 'Реликвия: Кадило Серебряного Затмения (+1 к спасброскам против страха у союзников в 10 футах).', datetime('now')),
      (3, 'Никс Тень Луны', 'Warlock', 'Покровитель: Архифея Вечерней Звезды', 'Тифлинг', 5, 6, 'https://longstoryshort.app/iframe/characters/list/', 88, 9, 5, 95, 4, 35, 38, 8, 'Контракт с Госпожой Хрустального Сада требует принести три истинных имени древних духов.', datetime('now'))`,

    `INSERT OR IGNORE INTO journal_entries (player_id, title, content) VALUES
      (1, 'Гримуар наблюдений Аэлин', 'Сессия IV: В нижних штольнях под Фрейтом мы нашли рунический круг, резонирующий со Школой Прорицания. Нужно расспросить архивариуса Вейна о третьем ключе.'),
      (2, 'Хроники Сумеречного Дозора', 'Сессия IV: Кобольды не просто грабили караваны — кто-то снабдил их алхимическими лампами из Верхнего квартала.'),
      (3, 'Шёпоты Вечерней Звезды', 'Сессия IV: Во сне Покровительница показала мне зеркальный зал под маяком.')`,

    `INSERT OR IGNORE INTO quests (id, title, short_desc, full_desc, reward, parameters_json, progress_current, progress_target, image_key, status) VALUES
      (1, 'Поймай 10 кобольдов', 'Выследить и обезвредить кобольдов-налётчиков в Хрустальных штольнях.', 'Из алхимических складов южного тракта пропали ящики с лунной пылью. Следы ведут в заброшенные Хрустальные штольни, где обосновалась шайка кобольдов-изобретателей под началом «Барона Искры». Страже нужны минимум десятеро для допроса.', '250 ЗМ, Рецепт эликсира тёмного зрения, +2 групповых Вдохновения', '{"location":"Хрустальные штольни","giver":"Капитан Лира Вейл","difficulty":"Средняя (Ур. 4–5)","deadline":"До конца недели затмения"}', 4, 10, 'preset:kobolds', 'active'),
      (2, 'Печать Забытого Архимага', 'Активировать 3 обсидиановых обелиска вокруг разлома Фрейта.', 'Древний барьер, удерживающий астральный шторм над бухтой Фрейта, дал трещину. Героям предстоит отыскать уцелевшие обелиски и прочитать формулу сдерживания.', 'Редкий фокус «Око Фрейта», 600 ЗМ', '{"location":"Окрестности Фрейта","giver":"Верховный маг Сорен","difficulty":"Высокая (Ур. 5–6)","deadline":"3 полнолуния"}', 1, 3, 'preset:obelisks', 'active'),
      (3, 'Тень над Портом Фрейт', 'Раскрыть заговор контрабандистов на причале №7.', 'Отряд проник на склад причала №7, перехватил шифровальную книгу и сорвал ритуал призыва.', '150 ЗМ каждому, Грамота вольного прохода', '{"location":"Причал №7","giver":"Мастер гавани Торн","difficulty":"Обычная","deadline":"Выполнено"}', 1, 1, 'preset:harbor', 'completed'),
      (4, 'Осколки Астрального Клинка', 'Собрать 5 звёздных фрагментов древнего клинка Соларис.', 'Легендарный клинок Соларис раскололся во время Войны Расколотого Неба. Когда все пять осколков соединятся в кузне Лунного Пламени, оружие вновь обретёт голос.', 'Легендарный клинок «Соларис», +5 Вдохновений', '{"location":"Регион Фрейт","giver":"Кузнец Хальвар","difficulty":"Эпическая","deadline":"Сюжетная арка"}', 2, 5, 'preset:blade', 'active')`,

    `INSERT OR IGNORE INTO bestiary (id, name, cr, cr_numeric, creature_type, ac, hp, description, image_key, is_revealed, sort_order) VALUES
      (1, 'Кобольд-изобретатель', '1/4', 0.25, 'Гуманоид (кобольд)', 13, '14 (4d6)', 'Юркий подземный ремесленник с рюкзаком алхимических смесей и пружинных ловушек.', 'preset:kobold', 1, 1),
      (2, 'Гончая Сумеречного Тумана', '1', 1.0, 'Фея', 14, '33 (6d8 + 6)', 'Хищник из пограничья Страны Фей, совершающий туманный шаг в тень жертвы.', 'preset:hound', 1, 2),
      (3, 'Мимик Лунного Сундука', '2', 2.0, 'Чудовище (перевёртыш)', 12, '58 (9d8 + 18)', 'Принимает форму инкрустированного серебром реликвария с клейкими псевдоподиями.', 'preset:mimic', 1, 3),
      (4, 'Рыцарь Пепельной Клятвы', '3', 3.0, 'Нежить', 18, '67 (9d8 + 27)', 'Павший страж старого бастиона в латах из призрачного пламени.', 'preset:knight', 0, 4),
      (5, 'Ночной Кошмар Астрала', '5', 5.0, 'Исчадие', 15, '93 (11d10 + 33)', 'Скакун из тёмного эфира с гривой из фиолетовых молний.', 'preset:nightmare', 1, 5),
      (6, 'Глаз Глубины Разлома', '8', 8.0, 'Аберрация', 16, '136 (16d10 + 48)', 'Парящая сфера искажённой гравитации с шестью лучевыми стебельками.', 'preset:beholder', 0, 6),
      (7, 'Лич-Хранитель Разлома', '13', 13.0, 'Нежить (волшебник)', 17, '150 (20d8 + 60)', 'Бессмертный архимаг первой эпохи Фрейта.', 'preset:lich', 0, 7),
      (8, 'Древний Теневой Дракон', '17', 17.0, 'Дракон', 20, '297 (22d12 + 154)', 'Владыка Беззвёздной Кальдеры, чьё дыхание гасит любой свет.', 'preset:dragon', 0, 8)`,

    `INSERT OR IGNORE INTO spells (id, name, level, school, classes, casting_time, spell_range, components, duration, description, source, is_homebrew, created_by) VALUES
      (1, 'Огненный снаряд (Fire Bolt)', 0, 'Evocation', 'Wizard,Sorcerer', '1 действие', '120 футов', 'В, С', 'Мгновенная', 'Дальнобойная атака заклинанием: цель получает 1d10 урона огнём (2d10 на 5-м уровне).', 'SRD 5.1', 0, NULL),
      (2, 'Мистический заряд (Eldritch Blast)', 0, 'Evocation', 'Warlock', '1 действие', '120 футов', 'В, С', 'Мгновенная', 'Луч энергии наносит 1d10 урона силовым полем при попадании (2 луча на 5-м уровне).', 'SRD 5.1', 0, NULL),
      (3, 'Священное пламя (Sacred Flame)', 0, 'Evocation', 'Cleric', '1 действие', '60 футов', 'В, С', 'Мгновенная', 'Спасбросок Ловкости или 1d8 урона излучением (2d8 на 5-м уровне).', 'SRD 5.1', 0, NULL),
      (4, 'Волшебная рука (Mage Hand)', 0, 'Conjuration', 'Wizard,Sorcerer,Warlock,Bard', '1 действие', '30 футов', 'В, С', '1 минута', 'Призрачная парящая рука манипулирует предметами весом до 10 фунтов.', 'SRD 5.1', 0, NULL),
      (5, 'Злая насмешка (Vicious Mockery)', 0, 'Enchantment', 'Bard', '1 действие', '60 футов', 'В', 'Мгновенная', 'При провале спасброска Мудрости цель получает 1d4 психического урона и помеху на следующую атаку.', 'SRD 5.1', 0, NULL),
      (6, 'Магический доспех (Mage Armor)', 1, 'Abjuration', 'Wizard,Sorcerer', '1 действие', 'Касание', 'В, С, М', '8 часов', 'Базовый КД цели без доспехов становится 13 + модификатор Ловкости.', 'SRD 5.1', 0, NULL),
      (7, 'Щит (Shield)', 1, 'Abjuration', 'Wizard,Sorcerer', '1 реакция', 'На себя', 'В, С', '1 раунд', '+5 к КД до начала вашего следующего хода и защита от Волшебной стрелы.', 'SRD 5.1', 0, NULL),
      (8, 'Волшебная стрела (Magic Missile)', 1, 'Evocation', 'Wizard,Sorcerer', '1 действие', '120 футов', 'В, С', 'Мгновенная', 'Три светящихся дротика автоматически попадают и наносят по 1d4 + 1 урона силовым полем.', 'SRD 5.1', 0, NULL),
      (9, 'Лечебное слово (Healing Word)', 1, 'Evocation', 'Cleric,Bard,Druid', '1 бонусное действие', '60 футов', 'В', 'Мгновенная', 'Восстанавливает существу 1d4 + модификатор базовой характеристики хитов.', 'SRD 5.1', 0, NULL),
      (10, 'Благословение (Bless)', 1, 'Enchantment', 'Cleric,Paladin', '1 действие', '30 футов', 'В, С, М', 'Концентрация, до 1 минуты', 'До трёх существ добавляют 1d4 к броскам атаки и спасброскам.', 'SRD 5.1', 0, NULL),
      (11, 'Сглаз (Hex)', 1, 'Enchantment', 'Warlock', '1 бонусное действие', '90 футов', 'В, С, М', 'Концентрация, до 1 часа', 'Ваши атаки наносят цели +1d6 некротического урона; помеха на проверки выбранной характеристики.', 'SRD 5.1', 0, NULL),
      (12, 'Обнаружение магии (Detect Magic)', 1, 'Divination', 'Wizard,Cleric,Sorcerer,Bard,Druid,Paladin,Ranger', '1 действие (ритуал)', 'На себя (30 футов)', 'В, С', 'Концентрация, до 10 минут', 'Позволяет чувствовать присутствие магии и видеть ауру школы магии.', 'SRD 5.1', 0, NULL),
      (13, 'Туманный шаг (Misty Step)', 2, 'Conjuration', 'Wizard,Sorcerer,Warlock', '1 бонусное действие', 'На себя', 'В', 'Мгновенная', 'Телепортация до 30 футов в видимое свободное пространство.', 'SRD 5.1', 0, NULL),
      (14, 'Божественное оружие (Spiritual Weapon)', 2, 'Evocation', 'Cleric', '1 бонусное действие', '60 футов', 'В, С', '1 минута', 'Парящее призрачное оружие наносит 1d8 + модификатор характеристики урона силовым полем.', 'SRD 5.1', 0, NULL),
      (15, 'Невидимость (Invisibility)', 2, 'Illusion', 'Wizard,Sorcerer,Warlock,Bard', '1 действие', 'Касание', 'В, С, М', 'Концентрация, до 1 часа', 'Существо становится невидимым до первой атаки или сотворения заклинания.', 'SRD 5.1', 0, NULL),
      (16, 'Удержание личности (Hold Person)', 2, 'Enchantment', 'Wizard,Cleric,Sorcerer,Warlock,Bard,Druid', '1 действие', '60 футов', 'В, С, М', 'Концентрация, до 1 минуты', 'Парализует гуманоида при провале спасброска Мудрости.', 'SRD 5.1', 0, NULL),
      (17, 'Огненный шар (Fireball)', 3, 'Evocation', 'Wizard,Sorcerer', '1 действие', '150 футов', 'В, С, М', 'Мгновенная', 'Взрыв пламени радиусом 20 футов наносит 8d6 урона огнём (спасбросок Ловкости уменьшает вдвое).', 'SRD 5.1', 0, NULL),
      (18, 'Контрзаклинание (Counterspell)', 3, 'Abjuration', 'Wizard,Sorcerer,Warlock', '1 реакция', '60 футов', 'С', 'Мгновенная', 'Прерывает накладывание заклинания 3-го круга и ниже (или с проверкой для более высоких).', 'SRD 5.1', 0, NULL),
      (19, 'Духовные стражи (Spirit Guardians)', 3, 'Conjuration', 'Cleric', '1 действие', 'На себя (15 футов)', 'В, С, М', 'Концентрация, до 10 минут', 'Духи замедляют врагов вдвое и наносят 3d8 урона излучением или некротикой.', 'SRD 5.1', 0, NULL),
      (20, 'Возрождение (Revivify)', 3, 'Necromancy', 'Cleric,Paladin,Druid,Ranger', '1 действие', 'Касание', 'В, С, М (бриллианты 300 зм)', 'Мгновенная', 'Возвращает к жизни с 1 хитом существо, умершее не более минуты назад.', 'SRD 5.1', 0, NULL),
      (25, 'Астральный резонанс Фрейта', 3, 'Divination', 'Wizard,Cleric,Warlock', '1 действие', '60 футов', 'В, С, М (осколок призмы)', 'Концентрация, до 1 минуты', 'Авторское заклинание кампании: связывает разум заклинателя и двух союзников единой астральной нитью (+1d4 к инициативе и спасброскам Интеллекта).', 'Homebrew // Fraith', 1, 1)`,

    `INSERT OR IGNORE INTO learned_spells (player_id, spell_id) VALUES
      (1, 1), (1, 6), (1, 7), (1, 12), (1, 13), (1, 17),
      (2, 3), (2, 9), (2, 10), (2, 14), (2, 19),
      (3, 2), (3, 11), (3, 13), (3, 18)`,

    `INSERT OR IGNORE INTO inspiration_pool (campaign_id, points) VALUES ('fraith-main-campaign', 7)`,

    `INSERT OR IGNORE INTO talent_tree (id, title, description, image_key, cost, position_x, position_y, parent_id) VALUES
      (1, 'Искра Путника Разлома', 'Базовый узел пробуждения: +5 футов к перемещению в первом раунде боя.', 'preset:spark', 1, 1, 0, NULL),
      (2, 'Хрустальная Выдержка', 'Раз за короткий отдых добавьте +1d6 к спасброску концентрации.', 'preset:crystal', 2, 0, 1, 1),
      (3, 'Тактический Резонанс', 'При натуральной 20 у союзника рядом вы получаете временные хиты (уровень + 3).', 'preset:resonance', 2, 1, 1, 1),
      (4, 'Шаг Сквозь Сумерки', 'Реакцией на промах врага переместитесь на 10 футов без провоцированных атак.', 'preset:shadowstep', 2, 2, 1, 1),
      (5, 'Печать Эгиды', 'При получении магического лечения ваш КД растёт на +1 до начала следующего хода.', 'preset:aegis', 3, 0, 2, 2),
      (6, 'Синхронизация Ковена', 'Раз в долгий отдых передайте ячейку 1–2 круга союзнику касанием.', 'preset:coven', 4, 1, 2, 3),
      (7, 'Клинок Затмения', 'Первая попавшая атака после телепортации наносит +2d6 урона силовым полем.', 'preset:eclipse', 3, 2, 2, 4),
      (8, 'Аватар Астральной Короны', 'Раз в долгий отдых на 1 минуту дарует полёт 30 футов и сопротивление излучению и некротике.', 'preset:crown', 5, 1, 3, 6)`,

    `INSERT OR IGNORE INTO purchased_talents (player_id, talent_id) VALUES (1, 1), (2, 1), (3, 1)`,
  ];

  await db.batch(seedStatements.map((sql) => db.prepare(sql)));
}
