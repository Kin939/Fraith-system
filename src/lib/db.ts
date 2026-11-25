import { formatCharacterClassesRu, isSpellAllowedForCharacter } from './lss';
import { DEFAULT_ANIME_THEME, parseThemeJson } from './theme';
import type {
  AuthUser,
  BestiaryCreature,
  CharacterProfile,
  DmManagedAccountInfo,
  JournalEntry,
  LearnedSpellRecord,
  PlayerId,
  PurchasedTalent,
  Quest,
  QuestParameters,
  QuestStatus,
  RollLogEntry,
  Spell,
  TalentNode,
  ThemeVariables,
  UserRole,
} from './types';

export function parseCrToNumeric(crRaw: string): number {
  const cleaned = crRaw.trim();
  if (cleaned === '1/8') return 0.125;
  if (cleaned === '1/4') return 0.25;
  if (cleaned === '1/2') return 0.5;
  if (cleaned.includes('/')) {
    const [num, den] = cleaned.split('/').map((n) => Number.parseFloat(n));
    if (Number.isFinite(num) && Number.isFinite(den) && den > 0) {
      return num / den;
    }
  }
  const val = Number.parseFloat(cleaned);
  return Number.isFinite(val) ? val : 0;
}

export interface DbUserRow {
  id: number;
  username: string;
  display_name: string;
  email: string | null;
  password_hash: string;
  role: UserRole;
  player_id: PlayerId | null;
  avatar_key: string | null;
  session_version?: number;
  theme_json: string | null;
}

export function mapUserRowToAuthUser(row: DbUserRow): AuthUser {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    email: row.email,
    role: row.role,
    playerId: row.player_id,
    avatarKey: row.avatar_key,
    theme: row.theme_json ? parseThemeJson(row.theme_json) : { ...DEFAULT_ANIME_THEME },
  };
}

export async function getUserByUsername(db: D1Database, username: string): Promise<DbUserRow | null> {
  return db
    .prepare(
      `SELECT u.*, ut.theme_json
       FROM users u
       LEFT JOIN user_themes ut ON ut.user_id = u.id
       WHERE lower(u.username) = lower(?)`
    )
    .bind(username.trim())
    .first<DbUserRow>();
}

export async function getUserByEmail(db: D1Database, email: string): Promise<DbUserRow | null> {
  return db
    .prepare(
      `SELECT u.*, ut.theme_json
       FROM users u
       LEFT JOIN user_themes ut ON ut.user_id = u.id
       WHERE lower(u.email) = lower(?)`
    )
    .bind(email.trim())
    .first<DbUserRow>();
}

export async function getUserById(db: D1Database, id: number): Promise<DbUserRow | null> {
  return db
    .prepare(
      `SELECT u.*, ut.theme_json
       FROM users u
       LEFT JOIN user_themes ut ON ut.user_id = u.id
       WHERE u.id = ?`
    )
    .bind(id)
    .first<DbUserRow>();
}

export async function listAllUsersWithThemes(db: D1Database): Promise<AuthUser[]> {
  const { results } = await db
    .prepare(
      `SELECT u.*, ut.theme_json
       FROM users u
       LEFT JOIN user_themes ut ON ut.user_id = u.id
       ORDER BY CASE WHEN u.role = 'dm' THEN 0 ELSE 1 END, u.player_id ASC`
    )
    .all<DbUserRow>();
  return results.map(mapUserRowToAuthUser);
}

export async function listDmManagedAccounts(db: D1Database): Promise<DmManagedAccountInfo[]> {
  const { results } = await db
    .prepare(
      `SELECT
         u.id,
         u.username,
         u.display_name,
         u.role,
         u.player_id,
         CASE WHEN u.role = 'player' THEN pc.plain_password ELSE NULL END AS plain_password,
         CASE WHEN u.role = 'player' THEN pc.updated_at ELSE NULL END AS updated_at
       FROM users u
       LEFT JOIN player_credentials pc ON pc.user_id = u.id
       ORDER BY CASE WHEN u.role = 'dm' THEN 0 ELSE 1 END, u.player_id ASC`
    )
    .all<{
      id: number;
      username: string;
      display_name: string;
      role: UserRole;
      player_id: PlayerId | null;
      plain_password: string | null;
      updated_at: string | null;
    }>();

  return results.map((r) => ({
    id: r.id,
    username: r.username,
    displayName: r.display_name,
    role: r.role,
    playerId: r.player_id,
    plainPassword: r.role === 'player' ? r.plain_password : null,
    updatedAt: r.role === 'player' ? r.updated_at : null,
  }));
}

export async function updateAccountPassword(
  db: D1Database,
  userId: number,
  role: UserRole,
  newPasswordHash: string,
  plainPasswordForPlayer: string | null
): Promise<DbUserRow | null> {
  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        `UPDATE users
         SET password_hash = ?,
             session_version = COALESCE(session_version, 2) + 1
         WHERE id = ?`
      )
      .bind(newPasswordHash, userId),
  ];

  if (role === 'player' && plainPasswordForPlayer) {
    statements.push(
      db
        .prepare(
          `INSERT INTO player_credentials (user_id, plain_password, updated_at)
           VALUES (?, ?, datetime('now'))
           ON CONFLICT(user_id) DO UPDATE SET
             plain_password = excluded.plain_password,
             updated_at = datetime('now')`
        )
        .bind(userId, plainPasswordForPlayer)
    );
  } else {
    statements.push(
      db.prepare(`DELETE FROM player_credentials WHERE user_id = ?`).bind(userId)
    );
  }

  await db.batch(statements);
  return getUserById(db, userId);
}

export async function upsertUserTheme(
  db: D1Database,
  userId: number,
  theme: ThemeVariables
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO user_themes (user_id, theme_json, updated_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(user_id) DO UPDATE SET
         theme_json = excluded.theme_json,
         updated_at = datetime('now')`
    )
    .bind(userId, JSON.stringify(theme))
    .run();
}

interface CharacterRow {
  player_id: PlayerId;
  character_name: string;
  char_class: string;
  subclass: string;
  race: string;
  level: number;
  experience_current: number;
  experience_max: number;
  max_spells: number;
  lss_embed_url: string;
  coins_cp: number;
  coins_sp: number;
  coins_ep: number;
  coins_gp: number;
  coins_pp: number;
  hp_current: number;
  hp_max: number;
  hp_temp: number;
  lss_notes: string;
  raw_lss_json: string | null;
  last_synced_at: string | null;
}

function mapCharacterRow(row: CharacterRow): CharacterProfile {
  return {
    playerId: row.player_id,
    characterName: row.character_name,
    charClass: row.char_class,
    subclass: row.subclass,
    race: row.race,
    level: row.level,
    experienceCurrent: row.experience_current ?? 0,
    experienceMax: row.experience_max ?? 0,
    maxSpells: row.max_spells,
    lssEmbedUrl: row.lss_embed_url,
    coins: {
      cp: row.coins_cp,
      sp: row.coins_sp,
      ep: row.coins_ep,
      gp: row.coins_gp,
      pp: row.coins_pp,
    },
    hpCurrent: row.hp_current,
    hpMax: row.hp_max,
    hpTemp: row.hp_temp,
    lssNotes: row.lss_notes,
    hasRawLssJson: Boolean(row.raw_lss_json),
    rawLssJson: row.raw_lss_json,
    lastSyncedAt: row.last_synced_at,
  };
}

export async function getCharacterProfile(
  db: D1Database,
  playerId: PlayerId
): Promise<CharacterProfile | null> {
  const row = await db
    .prepare(`SELECT * FROM character_profiles WHERE player_id = ?`)
    .bind(playerId)
    .first<CharacterRow>();
  return row ? mapCharacterRow(row) : null;
}

export async function listCharacterProfiles(db: D1Database): Promise<CharacterProfile[]> {
  const { results } = await db
    .prepare(`SELECT * FROM character_profiles ORDER BY player_id ASC`)
    .all<CharacterRow>();
  return results.map(mapCharacterRow);
}

export async function getJournalEntry(
  db: D1Database,
  playerId: PlayerId
): Promise<JournalEntry> {
  const row = await db
    .prepare(`SELECT player_id, title, content, updated_at FROM journal_entries WHERE player_id = ?`)
    .bind(playerId)
    .first<{ player_id: PlayerId; title: string; content: string; updated_at: string }>();

  if (!row) {
    return {
      playerId,
      title: `Личный дневник (Игрок ${playerId})`,
      content: '',
      updatedAt: new Date().toISOString(),
    };
  }
  return {
    playerId: row.player_id,
    title: row.title,
    content: row.content,
    updatedAt: row.updated_at,
  };
}

export async function saveJournalEntry(
  db: D1Database,
  playerId: PlayerId,
  title: string,
  content: string
): Promise<JournalEntry> {
  await db
    .prepare(
      `INSERT INTO journal_entries (player_id, title, content, updated_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(player_id) DO UPDATE SET
         title = excluded.title,
         content = excluded.content,
         updated_at = datetime('now')`
    )
    .bind(playerId, title, content)
    .run();

  return getJournalEntry(db, playerId);
}

interface QuestRow {
  id: number;
  title: string;
  short_desc: string;
  full_desc: string;
  reward: string;
  parameters_json: string;
  progress_current: number;
  progress_target: number;
  image_key: string | null;
  status: QuestStatus;
  created_at: string;
}

function mapQuestRow(row: QuestRow): Quest {
  let parameters: QuestParameters = {};
  try {
    parameters = JSON.parse(row.parameters_json || '{}') as QuestParameters;
  } catch {
    parameters = {};
  }
  return {
    id: row.id,
    title: row.title,
    shortDesc: row.short_desc,
    fullDesc: row.full_desc,
    reward: row.reward,
    parameters,
    progressCurrent: row.progress_current,
    progressTarget: row.progress_target,
    imageKey: row.image_key,
    status: row.status,
    createdAt: row.created_at,
  };
}

export async function listQuests(db: D1Database): Promise<Quest[]> {
  const { results } = await db
    .prepare(
      `SELECT * FROM quests
       ORDER BY CASE status
         WHEN 'active' THEN 0
         WHEN 'available' THEN 1
         WHEN 'completed' THEN 2
         ELSE 3
       END, id DESC`
    )
    .all<QuestRow>();
  return results.map(mapQuestRow);
}

interface BestiaryRow {
  id: number;
  name: string;
  cr: string;
  cr_numeric: number;
  creature_type: string;
  ac: number;
  hp: string;
  description: string;
  image_key: string | null;
  is_revealed: number;
  sort_order: number;
}

export async function listBestiary(
  db: D1Database,
  viewerRole: UserRole
): Promise<BestiaryCreature[]> {
  const { results } = await db
    .prepare(`SELECT * FROM bestiary ORDER BY cr_numeric ASC, sort_order ASC, id ASC`)
    .all<BestiaryRow>();

  return results.map((row) => {
    const revealed = Boolean(row.is_revealed);
    if (viewerRole !== 'dm' && !revealed) {
      return {
        id: row.id,
        name: '???',
        cr: '???',
        crNumeric: row.cr_numeric,
        creatureType: 'Неизвестная угроза',
        ac: 0,
        hp: '???',
        description: 'Сразись с этим существом чтобы открыть его в бестиарии',
        imageKey: null,
        isRevealed: false,
        sortOrder: row.sort_order,
      };
    }
    return {
      id: row.id,
      name: row.name,
      cr: row.cr,
      crNumeric: row.cr_numeric,
      creatureType: row.creature_type,
      ac: row.ac,
      hp: row.hp,
      description: row.description,
      imageKey: row.image_key,
      isRevealed: revealed,
      sortOrder: row.sort_order,
    };
  });
}

export interface SpellRow {
  id: number;
  name: string;
  name_en?: string;
  url?: string;
  level: number;
  school: string;
  type_line?: string;
  classes: string;
  subclasses?: string;
  casting_time: string;
  spell_range: string;
  components: string;
  components_badge?: string;
  ritual?: number;
  concentration?: number;
  duration: string;
  description: string;
  description_html?: string;
  source: string;
  source_title?: string;
  is_homebrew: number;
  created_by: number | null;
}

export function mapSpellRow(row: SpellRow): Spell {
  const sourceCode = row.source || (row.is_homebrew ? 'HB' : 'PH14');
  const sourceTitle = row.source_title || sourceCode;
  return {
    id: row.id,
    name: row.name,
    nameEn: row.name_en || '',
    url: row.url || '',
    level: row.level,
    school: row.school,
    typeLine: row.type_line || '',
    classes: row.classes
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean),
    subclasses: row.subclasses || '',
    castingTime: row.casting_time,
    spellRange: row.spell_range,
    components: row.components,
    componentsBadge: row.components_badge || '',
    ritual: Boolean(row.ritual),
    concentration: Boolean(row.concentration),
    duration: row.duration,
    description: row.description,
    descriptionHtml: row.description_html || '',
    source: sourceCode,
    sourceTitle,
    sourceBadges: [{ code: sourceCode, title: sourceTitle }],
    isHomebrew: Boolean(row.is_homebrew),
    createdBy: row.created_by,
  };
}

/**
 * Lists custom DM-added spells stored in D1 (dnd.su official & homebrew catalog is served as static assets).
 */
export async function listSpells(db: D1Database): Promise<Spell[]> {
  const { results } = await db
    .prepare(`SELECT * FROM spells WHERE created_by IS NOT NULL OR id >= 100000 ORDER BY level ASC, name ASC`)
    .all<SpellRow>();
  return results.map(mapSpellRow);
}

/**
 * Caches a dnd.su catalog spell in D1 `spells` so `learned_spells JOIN spells` works seamlessly on Tab 1.
 */
export async function upsertCatalogSpellInDb(db: D1Database, spell: Spell): Promise<void> {
  await db
    .prepare(
      `INSERT INTO spells (
         id, name, name_en, url, level, school, type_line, classes, subclasses,
         casting_time, spell_range, components, components_badge, ritual, concentration,
         duration, description, description_html, source, source_title, is_homebrew, created_by
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         name_en = excluded.name_en,
         url = excluded.url,
         level = excluded.level,
         school = excluded.school,
         type_line = excluded.type_line,
         classes = excluded.classes,
         subclasses = excluded.subclasses,
         casting_time = excluded.casting_time,
         spell_range = excluded.spell_range,
         components = excluded.components,
         components_badge = excluded.components_badge,
         ritual = excluded.ritual,
         concentration = excluded.concentration,
         duration = excluded.duration,
         description = excluded.description,
         description_html = excluded.description_html,
         source = excluded.source,
         source_title = excluded.source_title,
         is_homebrew = excluded.is_homebrew`
    )
    .bind(
      spell.id,
      spell.name,
      spell.nameEn || '',
      spell.url || '',
      spell.level,
      spell.school,
      spell.typeLine || '',
      (spell.classes || []).join(','),
      spell.subclasses || '',
      spell.castingTime || '1 действие',
      spell.spellRange || 'На себя',
      spell.components || '',
      spell.componentsBadge || '',
      spell.ritual ? 1 : 0,
      spell.concentration ? 1 : 0,
      spell.duration || 'Мгновенная',
      spell.description || '',
      spell.descriptionHtml || '',
      spell.source || (spell.isHomebrew ? 'HB' : 'PH14'),
      spell.sourceTitle || spell.source || '',
      spell.isHomebrew ? 1 : 0
    )
    .run();
}

export async function nextCustomSpellId(db: D1Database): Promise<number> {
  const row = await db
    .prepare(`SELECT COALESCE(MAX(CASE WHEN id >= 100000 THEN id ELSE 99999 END), 99999) + 1 AS next_id FROM spells`)
    .first<{ next_id: number }>();
  return row?.next_id ?? 100000;
}

export async function listLearnedSpellsForPlayer(
  db: D1Database,
  playerId: PlayerId
): Promise<LearnedSpellRecord[]> {
  const { results } = await db
    .prepare(
      `SELECT ls.player_id, ls.spell_id, ls.learned_at, s.*
       FROM learned_spells ls
       JOIN spells s ON s.id = ls.spell_id
       WHERE ls.player_id = ?
       ORDER BY s.level ASC, s.name ASC`
    )
    .bind(playerId)
    .all<SpellRow & { player_id: PlayerId; spell_id: number; learned_at: string }>();

  return results.map((row) => ({
    playerId: row.player_id,
    spellId: row.spell_id,
    learnedAt: row.learned_at,
    spell: mapSpellRow(row),
  }));
}

export async function learnSpellForPlayer(
  db: D1Database,
  playerId: PlayerId,
  spellId: number,
  catalogSpell?: Spell | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const profile = await getCharacterProfile(db, playerId);
  if (!profile || !profile.characterName.trim() || !profile.charClass.trim()) {
    return {
      ok: false,
      error:
        'Сначала загрузите чарник персонажа (.json из Long Story Short) во вкладке «Персонаж», чтобы определить класс и лимит заклинаний.',
    };
  }

  let spellRow = await db
    .prepare(`SELECT * FROM spells WHERE id = ?`)
    .bind(spellId)
    .first<SpellRow>();

  if (catalogSpell && (!spellRow || spellRow.created_by === null)) {
    await upsertCatalogSpellInDb(db, catalogSpell);
    spellRow = await db
      .prepare(`SELECT * FROM spells WHERE id = ?`)
      .bind(spellId)
      .first<SpellRow>();
  }

  if (!spellRow) {
    return { ok: false, error: 'Заклинание не найдено в каталоге' };
  }
  const spell = mapSpellRow(spellRow);
  const checkTarget = catalogSpell ? { ...spell, fClass: catalogSpell.fClass } : spell;

  const classMatches = isSpellAllowedForCharacter(
    checkTarget,
    profile.charClass,
    profile.subclass
  );
  if (!classMatches) {
    const reqList = [
      ...(spell.classes || []),
      ...(spell.subclasses ? [spell.subclasses] : []),
    ].join(', ');
    const classLabel = formatCharacterClassesRu(profile.charClass) || profile.charClass;
    return {
      ok: false,
      error: `Заклинание недоступно для вашего класса (${classLabel}). Доступно для: ${reqList || 'особых источников'}`,
    };
  }

  const existing = await db
    .prepare(`SELECT 1 FROM learned_spells WHERE player_id = ? AND spell_id = ?`)
    .bind(playerId, spellId)
    .first();
  if (existing) {
    return { ok: true };
  }

  const countRow = await db
    .prepare(`SELECT COUNT(*) as cnt FROM learned_spells WHERE player_id = ?`)
    .bind(playerId)
    .first<{ cnt: number }>();

  const currentCount = countRow?.cnt ?? 0;
  if (currentCount >= profile.maxSpells) {
    return {
      ok: false,
      error: `Достигнут максимум изученных заклинаний (${currentCount}/${profile.maxSpells})`,
    };
  }

  await db
    .prepare(`INSERT INTO learned_spells (player_id, spell_id, learned_at) VALUES (?, ?, datetime('now'))`)
    .bind(playerId, spellId)
    .run();

  return { ok: true };
}

export async function unlearnSpellForPlayer(
  db: D1Database,
  playerId: PlayerId,
  spellId: number
): Promise<void> {
  await db
    .prepare(`DELETE FROM learned_spells WHERE player_id = ? AND spell_id = ?`)
    .bind(playerId, spellId)
    .run();
}

export async function getTalentsState(
  db: D1Database,
  campaignId: string
): Promise<{
  inspirationPoints: number;
  nodes: TalentNode[];
  purchases: PurchasedTalent[];
}> {
  const pool = await db
    .prepare(`SELECT points FROM inspiration_pool WHERE campaign_id = ?`)
    .bind(campaignId)
    .first<{ points: number }>();

  const { results: nodeRows } = await db
    .prepare(`SELECT * FROM talent_tree ORDER BY id ASC`)
    .all<{
      id: number;
      title: string;
      description: string;
      image_key: string | null;
      cost: number;
      position_x: number;
      position_y: number;
      parent_id: number | null;
      is_unlocked?: number;
      unlocked_at?: string | null;
    }>();

  const { results: purchaseRows } = await db
    .prepare(`SELECT player_id, talent_id, purchased_at FROM purchased_talents`)
    .all<{ player_id: PlayerId; talent_id: number; purchased_at: string }>();

  const legacyUnlockedIds = new Set(purchaseRows.map((p) => p.talent_id));

  return {
    inspirationPoints: pool?.points ?? 0,
    nodes: nodeRows.map((n, idx) => {
      // Auto-convert any old small grid index (0..15) into pixel canvas coordinates
      const px =
        n.position_x >= 0 && n.position_x <= 15 && n.position_y >= 0 && n.position_y <= 15
          ? n.position_x === 0 && n.position_y === 0
            ? 60 + (idx % 4) * 230
            : 40 + n.position_x * 230
          : n.position_x;
      const py =
        n.position_x >= 0 && n.position_x <= 15 && n.position_y >= 0 && n.position_y <= 15
          ? n.position_x === 0 && n.position_y === 0
            ? 60 + Math.floor(idx / 4) * 220
            : 40 + n.position_y * 220
          : n.position_y;

      return {
        id: n.id,
        title: n.title,
        description: n.description,
        imageKey: n.image_key,
        cost: n.cost,
        positionX: px,
        positionY: py,
        parentId: n.parent_id,
        isUnlocked: Boolean(n.is_unlocked) || legacyUnlockedIds.has(n.id),
        unlockedAt: n.unlocked_at ?? null,
      };
    }),
    purchases: purchaseRows.map((p) => ({
      playerId: p.player_id,
      talentId: p.talent_id,
      purchasedAt: p.purchased_at,
    })),
  };
}

export async function unlockTalentForParty(
  db: D1Database,
  campaignId: string,
  talentId: number
): Promise<{ ok: true; remainingPoints: number } | { ok: false; error: string }> {
  const talent = await db
    .prepare(`SELECT * FROM talent_tree WHERE id = ?`)
    .bind(talentId)
    .first<{
      id: number;
      cost: number;
      parent_id: number | null;
      title: string;
      is_unlocked?: number;
    }>();

  if (!talent) {
    return { ok: false, error: 'Талант не найден' };
  }

  if (talent.is_unlocked) {
    return { ok: false, error: 'Этот талант уже открыт для всей группы' };
  }

  if (talent.parent_id !== null) {
    const parent = await db
      .prepare(`SELECT is_unlocked FROM talent_tree WHERE id = ?`)
      .bind(talent.parent_id)
      .first<{ is_unlocked?: number }>();
    if (!parent?.is_unlocked) {
      return {
        ok: false,
        error: 'Сначала необходимо открыть предыдущий узел в ветке талантов',
      };
    }
  }

  await db
    .prepare(`INSERT OR IGNORE INTO inspiration_pool (campaign_id, points) VALUES (?, 0)`)
    .bind(campaignId)
    .run();

  const deductResult = await db
    .prepare(
      `UPDATE inspiration_pool
       SET points = points - ?
       WHERE campaign_id = ? AND points >= ?`
    )
    .bind(talent.cost, campaignId, talent.cost)
    .run();

  if (!deductResult.meta.changes) {
    return { ok: false, error: `Недостаточно общих очков вдохновения (нужно: ${talent.cost})` };
  }

  await db
    .prepare(
      `UPDATE talent_tree
       SET is_unlocked = 1,
           unlocked_at = datetime('now')
       WHERE id = ?`
    )
    .bind(talentId)
    .run();

  const updatedPool = await db
    .prepare(`SELECT points FROM inspiration_pool WHERE campaign_id = ?`)
    .bind(campaignId)
    .first<{ points: number }>();

  return { ok: true, remainingPoints: updatedPool?.points ?? 0 };
}

export async function listRecentRolls(db: D1Database, limit = 20): Promise<RollLogEntry[]> {
  const { results } = await db
    .prepare(`SELECT * FROM roll_log ORDER BY id DESC LIMIT ?`)
    .bind(limit)
    .all<{
      id: number;
      player_id: PlayerId | null;
      character_name: string;
      title: string;
      formula: string;
      breakdown: string;
      total: string;
      is_crit: number;
      crit_kind: 'success' | 'failure' | null;
      created_at: string;
    }>();

  return results.map((r) => ({
    id: r.id,
    playerId: r.player_id,
    characterName: r.character_name,
    title: r.title,
    formula: r.formula,
    breakdown: r.breakdown,
    total: r.total,
    isCrit: Boolean(r.is_crit),
    critKind: r.crit_kind,
    createdAt: r.created_at,
  }));
}
