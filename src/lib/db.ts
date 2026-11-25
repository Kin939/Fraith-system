import { normalizeDndClass } from './lss';
import { DEFAULT_ANIME_THEME, parseThemeJson } from './theme';
import type {
  AuthUser,
  BestiaryCreature,
  CharacterProfile,
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

interface SpellRow {
  id: number;
  name: string;
  level: number;
  school: string;
  classes: string;
  casting_time: string;
  spell_range: string;
  components: string;
  duration: string;
  description: string;
  source: string;
  is_homebrew: number;
  created_by: number | null;
}

export function mapSpellRow(row: SpellRow): Spell {
  return {
    id: row.id,
    name: row.name,
    level: row.level,
    school: row.school,
    classes: row.classes
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean),
    castingTime: row.casting_time,
    spellRange: row.spell_range,
    components: row.components,
    duration: row.duration,
    description: row.description,
    source: row.source,
    isHomebrew: Boolean(row.is_homebrew),
    createdBy: row.created_by,
  };
}

export async function listSpells(db: D1Database): Promise<Spell[]> {
  const { results } = await db
    .prepare(`SELECT * FROM spells ORDER BY level ASC, name ASC`)
    .all<SpellRow>();
  return results.map(mapSpellRow);
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
  spellId: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  const profile = await getCharacterProfile(db, playerId);
  if (!profile) {
    return { ok: false, error: 'Профиль персонажа не найден' };
  }

  const spellRow = await db
    .prepare(`SELECT * FROM spells WHERE id = ?`)
    .bind(spellId)
    .first<SpellRow>();
  if (!spellRow) {
    return { ok: false, error: 'Заклинание не найдено' };
  }
  const spell = mapSpellRow(spellRow);

  const playerClasses = profile.charClass
    .split(',')
    .map((c) => normalizeDndClass(c) ?? c.trim())
    .filter(Boolean);

  const spellAllowedClasses = spell.classes.map((c) => normalizeDndClass(c) ?? c.trim());
  const classMatches = playerClasses.some((pc) =>
    spellAllowedClasses.some((sc) => sc.toLowerCase() === pc.toLowerCase())
  );

  if (!classMatches) {
    return {
      ok: false,
      error: `Заклинание недоступно для вашего класса (${profile.charClass}). Требуется: ${spell.classes.join(', ')}`,
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
    .prepare(`SELECT * FROM talent_tree ORDER BY position_y ASC, position_x ASC, id ASC`)
    .all<{
      id: number;
      title: string;
      description: string;
      image_key: string | null;
      cost: number;
      position_x: number;
      position_y: number;
      parent_id: number | null;
    }>();

  const { results: purchaseRows } = await db
    .prepare(`SELECT player_id, talent_id, purchased_at FROM purchased_talents`)
    .all<{ player_id: PlayerId; talent_id: number; purchased_at: string }>();

  return {
    inspirationPoints: pool?.points ?? 0,
    nodes: nodeRows.map((n) => ({
      id: n.id,
      title: n.title,
      description: n.description,
      imageKey: n.image_key,
      cost: n.cost,
      positionX: n.position_x,
      positionY: n.position_y,
      parentId: n.parent_id,
    })),
    purchases: purchaseRows.map((p) => ({
      playerId: p.player_id,
      talentId: p.talent_id,
      purchasedAt: p.purchased_at,
    })),
  };
}

/**
 * Atomically deducts shared party inspiration points and unlocks the talent for the specific player (`player_id`).
 */
export async function purchaseTalentForPlayer(
  db: D1Database,
  campaignId: string,
  playerId: PlayerId,
  talentId: number
): Promise<{ ok: true; remainingPoints: number } | { ok: false; error: string }> {
  const talent = await db
    .prepare(`SELECT * FROM talent_tree WHERE id = ?`)
    .bind(talentId)
    .first<{ id: number; cost: number; parent_id: number | null; title: string }>();

  if (!talent) {
    return { ok: false, error: 'Талант не найден' };
  }

  const alreadyOwned = await db
    .prepare(`SELECT 1 FROM purchased_talents WHERE player_id = ? AND talent_id = ?`)
    .bind(playerId, talentId)
    .first();
  if (alreadyOwned) {
    return { ok: false, error: 'Этот талант уже приобретён вашим персонажем' };
  }

  if (talent.parent_id !== null) {
    const hasParent = await db
      .prepare(`SELECT 1 FROM purchased_talents WHERE player_id = ? AND talent_id = ?`)
      .bind(playerId, talent.parent_id)
      .first();
    if (!hasParent) {
      return { ok: false, error: 'Сначала необходимо открыть предыдущий узел в ветке талантов' };
    }
  }

  // Ensure pool row exists
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
      `INSERT INTO purchased_talents (player_id, talent_id, purchased_at)
       VALUES (?, ?, datetime('now'))`
    )
    .bind(playerId, talentId)
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
