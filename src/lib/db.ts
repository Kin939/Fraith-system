import { formatCharacterClassesRu, isSpellAllowedForCharacter } from './lss';
import { normalizeQuestAccent, normalizeQuestPattern } from './questStyle';
import { DEFAULT_ANIME_THEME, parseThemeJson } from './theme';
import type {
  AuthUser,
  BestiaryCreature,
  CharacterProfile,
  ChatAttachment,
  ChatMessage,
  ChatParticipantBadge,
  ChatPoll,
  ChatPollKind,
  ChatPollOption,
  ChatReactionSummary,
  ChatReplyPreview,
  CustomCampaignEmoji,
  DmManagedAccountInfo,
  JournalEntry,
  LearnedSpellRecord,
  NextSessionBanner,
  PlayerId,
  PurchasedTalent,
  Quest,
  QuestParameters,
  QuestStatus,
  RollLogEntry,
  Spell,
  SpellCastMode,
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

/**
 * Turns a stored R2 key (or an already-resolved absolute/data URL) into a browser-loadable URL.
 */
export function resolveStoredImageUrl(key?: string | null): string | null {
  const value = (key || '').trim();
  if (!value) return null;
  if (
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('data:') ||
    value.startsWith('blob:') ||
    value.startsWith('/')
  ) {
    return value;
  }
  return `/api/r2/${encodeURIComponent(value)}`;
}

function pickPortraitString(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (
      trimmed.startsWith('http://') ||
      trimmed.startsWith('https://') ||
      trimmed.startsWith('data:') ||
      trimmed.startsWith('/')
    ) {
      return trimmed;
    }
    return null;
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of ['webp', 'jpeg', 'jpg', 'png', 'url', 'path', 'src', 'original']) {
      const found = pickPortraitString(record[key]);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Pulls the portrait URL out of a raw Long Story Short character sheet.
 * Handles both flat sheets and the `{ data: "<json string>" }` wrapper LSS uses.
 */
export function extractLssPortraitUrl(rawLssJson?: string | null): string | null {
  if (!rawLssJson) return null;
  let root: unknown;
  try {
    root = JSON.parse(rawLssJson);
  } catch {
    return null;
  }

  const queue: unknown[] = [root];
  let guard = 0;
  while (queue.length > 0 && guard < 64) {
    guard += 1;
    const node = queue.shift();
    if (!node) continue;
    if (typeof node === 'string') {
      if (node.trim().startsWith('{') || node.trim().startsWith('[')) {
        try {
          queue.push(JSON.parse(node));
        } catch {
          // not JSON — ignore
        }
      }
      continue;
    }
    if (Array.isArray(node)) {
      queue.push(...node.slice(0, 8));
      continue;
    }
    if (typeof node !== 'object') continue;
    const record = node as Record<string, unknown>;
    for (const key of ['avatar', 'avatarUrl', 'portrait', 'portraitUrl', 'token']) {
      if (key === 'token') continue;
      const found = pickPortraitString(record[key]);
      if (found) return found;
    }
    for (const key of ['data', 'sheet', 'character', 'info', 'settings', 'meta']) {
      if (record[key]) queue.push(record[key]);
    }
  }
  return null;
}

interface AvatarSourceRow {
  user_id: number;
  player_id: PlayerId | null;
  avatar_key: string | null;
  raw_lss_json: string | null;
}

interface AvatarIndex {
  byUserId: Map<number, string>;
  byPlayerId: Map<PlayerId, string>;
}

async function loadAvatarIndex(db: D1Database): Promise<AvatarIndex> {
  const byUserId = new Map<number, string>();
  const byPlayerId = new Map<PlayerId, string>();
  let rows: AvatarSourceRow[] = [];
  try {
    const res = await db
      .prepare(
        `SELECT u.id AS user_id, u.player_id AS player_id, u.avatar_key AS avatar_key,
                cp.raw_lss_json AS raw_lss_json
         FROM users u
         LEFT JOIN character_profiles cp ON cp.player_id = u.player_id`
      )
      .all<AvatarSourceRow>();
    rows = res.results ?? [];
  } catch {
    return { byUserId, byPlayerId };
  }

  for (const row of rows) {
    const uploaded = resolveStoredImageUrl(row.avatar_key);
    const sheetPortrait = uploaded ? null : extractLssPortraitUrl(row.raw_lss_json);
    const url = uploaded ?? sheetPortrait;
    if (!url) continue;
    byUserId.set(row.user_id, url);
    if (row.player_id && !byPlayerId.has(row.player_id)) {
      byPlayerId.set(row.player_id, url);
    }
  }
  return { byUserId, byPlayerId };
}

export async function withUserAvatars<T extends AuthUser>(
  db: D1Database,
  users: T[]
): Promise<T[]> {
  if (users.length === 0) return users;
  const index = await loadAvatarIndex(db);
  return users.map((u) => ({ ...u, avatarUrl: index.byUserId.get(u.id) ?? null }));
}

export async function withCharacterAvatars(
  db: D1Database,
  profiles: CharacterProfile[]
): Promise<CharacterProfile[]> {
  if (profiles.length === 0) return profiles;
  const index = await loadAvatarIndex(db);
  return profiles.map((p) => ({
    ...p,
    avatarUrl: index.byPlayerId.get(p.playerId) ?? extractLssPortraitUrl(p.rawLssJson),
  }));
}

export async function setUserAvatarKey(
  db: D1Database,
  userId: number,
  avatarKey: string | null
): Promise<void> {
  await db.prepare(`UPDATE users SET avatar_key = ? WHERE id = ?`).bind(avatarKey, userId).run();
}

export async function getUserAvatarUrl(
  db: D1Database,
  userId: number
): Promise<string | null> {
  const index = await loadAvatarIndex(db);
  return index.byUserId.get(userId) ?? null;
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
  allow_off_class_spells?: number;
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
    allowOffClassSpells: Boolean(row.allow_off_class_spells),
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
  tile_accent?: string | null;
  tile_emblem?: string | null;
  tile_pattern?: string | null;
  is_important?: number | null;
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
    tileStyle: {
      accent: normalizeQuestAccent(row.tile_accent),
      emblem: (row.tile_emblem || '').trim() || null,
      pattern: normalizeQuestPattern(row.tile_pattern),
      isImportant: Boolean(row.is_important),
    },
  };
}

export async function listQuests(db: D1Database): Promise<Quest[]> {
  const { results } = await db
    .prepare(
      `SELECT * FROM quests
       ORDER BY is_important DESC,
       CASE status
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

const VALID_SPELL_CAST_MODES = new Set<SpellCastMode>([
  'slot',
  'at_will',
  'long_rest',
  'short_rest',
  'resource',
  'ritual_only',
  'custom',
]);

function normalizeSpellCastMode(raw?: string | null): SpellCastMode {
  if (raw && VALID_SPELL_CAST_MODES.has(raw as SpellCastMode)) {
    return raw as SpellCastMode;
  }
  return 'slot';
}

export async function listLearnedSpellsForPlayer(
  db: D1Database,
  playerId: PlayerId
): Promise<LearnedSpellRecord[]> {
  const { results } = await db
    .prepare(
      `SELECT ls.player_id,
              ls.spell_id,
              ls.learned_at,
              ls.cast_mode,
              ls.cast_max_uses,
              ls.cast_note,
              ls.granted_by_dm,
              s.*
       FROM learned_spells ls
       JOIN spells s ON s.id = ls.spell_id
       WHERE ls.player_id = ?
       ORDER BY s.level ASC, s.name ASC`
    )
    .bind(playerId)
    .all<
      SpellRow & {
        player_id: PlayerId;
        spell_id: number;
        learned_at: string;
        cast_mode?: string;
        cast_max_uses?: number;
        cast_note?: string;
        granted_by_dm?: number;
      }
    >();

  return results.map((row) => ({
    playerId: row.player_id,
    spellId: row.spell_id,
    learnedAt: row.learned_at,
    castMode: normalizeSpellCastMode(row.cast_mode),
    castMaxUses: Math.max(1, row.cast_max_uses ?? 1),
    castNote: row.cast_note ?? '',
    grantedByDm: Boolean(row.granted_by_dm),
    spell: mapSpellRow(row),
  }));
}

export interface LearnSpellOptions {
  bypassClassCheck?: boolean;
  bypassLimitCheck?: boolean;
  castMode?: SpellCastMode;
  castMaxUses?: number;
  castNote?: string;
  grantedByDm?: boolean;
}

export async function learnSpellForPlayer(
  db: D1Database,
  playerId: PlayerId,
  spellId: number,
  catalogSpell?: Spell | null,
  options?: LearnSpellOptions
): Promise<{ ok: true } | { ok: false; error: string }> {
  const profile = await getCharacterProfile(db, playerId);
  const bypassClass = Boolean(options?.bypassClassCheck || profile?.allowOffClassSpells);
  const bypassLimit = Boolean(options?.bypassLimitCheck);

  if (!bypassClass && (!profile || !profile.characterName.trim() || !profile.charClass.trim())) {
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

  if (!bypassClass && profile) {
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
        error: `Заклинание недоступно для вашего класса (${classLabel}). Мастер может выдать его вручную или включить для персонажа заклинания вне класса. Доступно для: ${reqList || 'особых источников'}`,
      };
    }
  }

  const castMode = normalizeSpellCastMode(options?.castMode);
  const castMaxUses = Math.max(1, Math.min(99, Math.trunc(options?.castMaxUses ?? 1)));
  const castNote = (options?.castNote ?? '').trim();
  const grantedByDm = options?.grantedByDm ? 1 : 0;

  const existing = await db
    .prepare(`SELECT 1 FROM learned_spells WHERE player_id = ? AND spell_id = ?`)
    .bind(playerId, spellId)
    .first();
  if (existing) {
    await db
      .prepare(
        `UPDATE learned_spells
         SET cast_mode = ?,
             cast_max_uses = ?,
             cast_note = ?,
             granted_by_dm = CASE WHEN ? = 1 THEN 1 ELSE granted_by_dm END
         WHERE player_id = ? AND spell_id = ?`
      )
      .bind(castMode, castMaxUses, castNote, grantedByDm, playerId, spellId)
      .run();
    return { ok: true };
  }

  if (!bypassLimit && profile) {
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
  }

  await db
    .prepare(
      `INSERT INTO learned_spells (
         player_id, spell_id, learned_at, cast_mode, cast_max_uses, cast_note, granted_by_dm
       ) VALUES (?, ?, datetime('now'), ?, ?, ?, ?)`
    )
    .bind(playerId, spellId, castMode, castMaxUses, castNote, grantedByDm)
    .run();

  return { ok: true };
}

export async function updateLearnedSpellMeta(
  db: D1Database,
  playerId: PlayerId,
  spellId: number,
  updates: {
    castMode?: SpellCastMode;
    castMaxUses?: number;
    castNote?: string;
  }
): Promise<boolean> {
  const existing = await db
    .prepare(`SELECT 1 FROM learned_spells WHERE player_id = ? AND spell_id = ?`)
    .bind(playerId, spellId)
    .first();
  if (!existing) return false;

  const castMode = normalizeSpellCastMode(updates.castMode);
  const castMaxUses = Math.max(1, Math.min(99, Math.trunc(updates.castMaxUses ?? 1)));
  const castNote = (updates.castNote ?? '').trim();

  await db
    .prepare(
      `UPDATE learned_spells
       SET cast_mode = ?, cast_max_uses = ?, cast_note = ?
       WHERE player_id = ? AND spell_id = ?`
    )
    .bind(castMode, castMaxUses, castNote, playerId, spellId)
    .run();

  return true;
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

// ============================================================================
// Campaign Messenger, Polls, Reactions & Session Scheduling
// ============================================================================

interface RawChatMessageRow {
  id: number;
  user_id: number;
  sender_username: string;
  sender_display_name: string;
  sender_role: UserRole;
  sender_player_id: PlayerId | null;
  content: string;
  reply_to_id: number | null;
  attachments_json: string;
  poll_id: number | null;
  is_pinned: number;
  edited_at: string | null;
  created_at: string;
}

function parseChatAttachments(raw: string | null | undefined): ChatAttachment[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item.key === 'string' && typeof item.url === 'string')
      .map((item) => ({
        key: String(item.key),
        url: String(item.url),
        name: String(item.name || 'file'),
        mimeType: String(item.mimeType || 'application/octet-stream'),
        size: Number(item.size) || 0,
        kind:
          item.kind === 'image' || item.kind === 'audio' || item.kind === 'video'
            ? item.kind
            : 'file',
      }));
  } catch {
    return [];
  }
}

async function loadUsersBadgeMap(db: D1Database): Promise<Map<number, ChatParticipantBadge>> {
  const { results } = await db
    .prepare(`SELECT id, display_name, role, player_id FROM users`)
    .all<{
      id: number;
      display_name: string;
      role: UserRole;
      player_id: PlayerId | null;
    }>();

  const avatarIndex = await loadAvatarIndex(db);

  const map = new Map<number, ChatParticipantBadge>();
  for (const row of results) {
    map.set(row.id, {
      userId: row.id,
      displayName: row.display_name,
      role: row.role,
      playerId: row.player_id,
      avatarUrl: avatarIndex.byUserId.get(row.id) ?? null,
    });
  }
  return map;
}

export async function hydrateChatPollsByIds(
  db: D1Database,
  pollIds: number[],
  usersMap?: Map<number, ChatParticipantBadge>
): Promise<Map<number, ChatPoll>> {
  const result = new Map<number, ChatPoll>();
  const uniqueIds = Array.from(new Set(pollIds.filter((id) => Number.isInteger(id) && id > 0)));
  if (uniqueIds.length === 0) return result;

  const badgeMap = usersMap ?? (await loadUsersBadgeMap(db));
  const minPollId = Math.min(...uniqueIds);
  const maxPollId = Math.max(...uniqueIds);
  const idSet = new Set(uniqueIds);

  const { results: pollRows } = await db
    .prepare(`SELECT * FROM chat_polls WHERE id BETWEEN ? AND ?`)
    .bind(minPollId, maxPollId)
    .all<{
      id: number;
      creator_id: number;
      kind: ChatPollKind;
      question: string;
      allow_multiple: number;
      is_anonymous: number;
      allow_add_options: number;
      is_closed: number;
      confirmed_option_id: number | null;
      created_at: string;
    }>();

  const filteredPolls = pollRows.filter((p) => idSet.has(p.id));
  if (filteredPolls.length === 0) return result;

  const { results: optionRows } = await db
    .prepare(
      `SELECT * FROM chat_poll_options
       WHERE poll_id BETWEEN ? AND ?
       ORDER BY sort_order ASC, id ASC`
    )
    .bind(minPollId, maxPollId)
    .all<{
      id: number;
      poll_id: number;
      label: string;
      date_iso: string | null;
      sort_order: number;
    }>();

  const { results: voteRows } = await db
    .prepare(
      `SELECT poll_id, option_id, user_id
       FROM chat_poll_votes
       WHERE poll_id BETWEEN ? AND ?
       ORDER BY created_at ASC`
    )
    .bind(minPollId, maxPollId)
    .all<{
      poll_id: number;
      option_id: number;
      user_id: number;
    }>();

  const votesByOption = new Map<number, number[]>();
  const distinctVotersByPoll = new Map<number, Set<number>>();

  for (const v of voteRows) {
    if (!idSet.has(v.poll_id)) continue;
    const arr = votesByOption.get(v.option_id) ?? [];
    arr.push(v.user_id);
    votesByOption.set(v.option_id, arr);

    const set = distinctVotersByPoll.get(v.poll_id) ?? new Set<number>();
    set.add(v.user_id);
    distinctVotersByPoll.set(v.poll_id, set);
  }

  const optionsByPoll = new Map<number, RawPollOptionWithVotes[]>();
  interface RawPollOptionWithVotes extends ChatPollOption {}

  for (const opt of optionRows) {
    if (!idSet.has(opt.poll_id)) continue;
    const rawUserIds = votesByOption.get(opt.id) ?? [];
    const list = optionsByPoll.get(opt.poll_id) ?? [];
    list.push({
      id: opt.id,
      pollId: opt.poll_id,
      label: opt.label,
      dateIso: opt.date_iso,
      sortOrder: opt.sort_order,
      voteCount: rawUserIds.length,
      userIds: rawUserIds,
      voters: rawUserIds.map(
        (uid) =>
          badgeMap.get(uid) ?? {
            userId: uid,
            displayName: `Участник #${uid}`,
            role: 'player',
            playerId: null,
          }
      ),
    });
    optionsByPoll.set(opt.poll_id, list);
  }

  for (const p of filteredPolls) {
    const isAnon = Boolean(p.is_anonymous);
    const rawOptions = optionsByPoll.get(p.id) ?? [];
    const creator = badgeMap.get(p.creator_id);

    result.set(p.id, {
      id: p.id,
      creatorId: p.creator_id,
      creatorName: creator?.displayName ?? 'Участник',
      kind: p.kind === 'date' ? 'date' : 'general',
      question: p.question,
      allowMultiple: Boolean(p.allow_multiple),
      isAnonymous: isAnon,
      allowAddOptions: Boolean(p.allow_add_options),
      isClosed: Boolean(p.is_closed),
      confirmedOptionId: p.confirmed_option_id ?? null,
      totalVoters: distinctVotersByPoll.get(p.id)?.size ?? 0,
      options: rawOptions.map((o) => ({
        ...o,
        voters: isAnon ? [] : o.voters,
      })),
      createdAt: p.created_at,
    });
  }

  return result;
}

export async function getChatPollById(
  db: D1Database,
  pollId: number
): Promise<ChatPoll | null> {
  const map = await hydrateChatPollsByIds(db, [pollId]);
  return map.get(pollId) ?? null;
}

async function hydrateChatMessageRows(
  db: D1Database,
  rows: RawChatMessageRow[]
): Promise<ChatMessage[]> {
  if (rows.length === 0) return [];
  const badgeMap = await loadUsersBadgeMap(db);

  const msgIds = rows.map((r) => r.id);
  const minMsgId = Math.min(...msgIds);
  const maxMsgId = Math.max(...msgIds);
  const msgIdSet = new Set(msgIds);

  // Reactions
  const { results: reactionRows } = await db
    .prepare(
      `SELECT message_id, user_id, emoji
       FROM chat_reactions
       WHERE message_id BETWEEN ? AND ?
       ORDER BY created_at ASC`
    )
    .bind(minMsgId, maxMsgId)
    .all<{ message_id: number; user_id: number; emoji: string }>();

  const reactionsByMessage = new Map<number, Map<string, number[]>>();
  for (const r of reactionRows) {
    if (!msgIdSet.has(r.message_id)) continue;
    let emojiMap = reactionsByMessage.get(r.message_id);
    if (!emojiMap) {
      emojiMap = new Map<string, number[]>();
      reactionsByMessage.set(r.message_id, emojiMap);
    }
    const uids = emojiMap.get(r.emoji) ?? [];
    uids.push(r.user_id);
    emojiMap.set(r.emoji, uids);
  }

  // Reply previews
  const replyIds = Array.from(
    new Set(rows.map((r) => r.reply_to_id).filter((id): id is number => id !== null && id > 0))
  );
  const replyMap = new Map<number, ChatReplyPreview>();

  for (const r of rows) {
    if (replyIds.includes(r.id)) {
      const atts = parseChatAttachments(r.attachments_json);
      replyMap.set(r.id, {
        id: r.id,
        senderDisplayName: badgeMap.get(r.user_id)?.displayName ?? r.sender_display_name,
        senderRole: r.sender_role,
        senderPlayerId: r.sender_player_id,
        senderAvatarUrl: badgeMap.get(r.user_id)?.avatarUrl ?? null,
        content: r.content,
        hasAttachments: atts.length > 0,
        hasPoll: r.poll_id !== null,
      });
    }
  }

  const missingReplyIds = replyIds.filter((id) => !replyMap.has(id));
  if (missingReplyIds.length > 0) {
    const minRep = Math.min(...missingReplyIds);
    const maxRep = Math.max(...missingReplyIds);
    const missingSet = new Set(missingReplyIds);
    const { results: extraReplies } = await db
      .prepare(
        `SELECT id, user_id, sender_display_name, sender_role, sender_player_id, content, attachments_json, poll_id
         FROM chat_messages
         WHERE id BETWEEN ? AND ?`
      )
      .bind(minRep, maxRep)
      .all<{
        id: number;
        user_id: number;
        sender_display_name: string;
        sender_role: UserRole;
        sender_player_id: PlayerId | null;
        content: string;
        attachments_json: string;
        poll_id: number | null;
      }>();

    for (const er of extraReplies) {
      if (!missingSet.has(er.id)) continue;
      replyMap.set(er.id, {
        id: er.id,
        senderDisplayName: badgeMap.get(er.user_id)?.displayName ?? er.sender_display_name,
        senderRole: er.sender_role,
        senderPlayerId: er.sender_player_id,
        senderAvatarUrl: badgeMap.get(er.user_id)?.avatarUrl ?? null,
        content: er.content,
        hasAttachments: parseChatAttachments(er.attachments_json).length > 0,
        hasPoll: er.poll_id !== null,
      });
    }
  }

  // Polls
  const pollIds = rows
    .map((r) => r.poll_id)
    .filter((id): id is number => id !== null && id > 0);
  const pollsMap = await hydrateChatPollsByIds(db, pollIds, badgeMap);

  return rows.map((row) => {
    const liveSender = badgeMap.get(row.user_id);
    const emojiMap = reactionsByMessage.get(row.id);
    const reactions: ChatReactionSummary[] = [];
    if (emojiMap) {
      for (const [emoji, userIds] of emojiMap.entries()) {
        reactions.push({
          emoji,
          count: userIds.length,
          userIds,
          users: userIds.map(
            (uid) =>
              badgeMap.get(uid) ?? {
                userId: uid,
                displayName: `Участник #${uid}`,
                role: 'player',
                playerId: null,
              }
          ),
        });
      }
    }

    return {
      id: row.id,
      userId: row.user_id,
      senderUsername: row.sender_username,
      senderDisplayName: liveSender?.displayName ?? row.sender_display_name,
      senderRole: row.sender_role,
      senderPlayerId: row.sender_player_id,
      senderAvatarUrl: liveSender?.avatarUrl ?? null,
      content: row.content,
      replyToId: row.reply_to_id,
      replyPreview: row.reply_to_id ? replyMap.get(row.reply_to_id) ?? null : null,
      attachments: parseChatAttachments(row.attachments_json),
      pollId: row.poll_id,
      poll: row.poll_id ? pollsMap.get(row.poll_id) ?? null : null,
      reactions,
      isPinned: Boolean(row.is_pinned),
      editedAt: row.edited_at,
      createdAt: row.created_at,
    };
  });
}

export async function listChatMessages(
  db: D1Database,
  limit = 200
): Promise<ChatMessage[]> {
  const safeLimit = Math.min(500, Math.max(20, limit));
  const { results } = await db
    .prepare(
      `SELECT * FROM (
         SELECT * FROM chat_messages ORDER BY id DESC LIMIT ?
       ) sub
       ORDER BY id ASC`
    )
    .bind(safeLimit)
    .all<RawChatMessageRow>();

  return hydrateChatMessageRows(db, results);
}

export async function getChatMessageById(
  db: D1Database,
  messageId: number
): Promise<ChatMessage | null> {
  const row = await db
    .prepare(`SELECT * FROM chat_messages WHERE id = ?`)
    .bind(messageId)
    .first<RawChatMessageRow>();

  if (!row) return null;
  const hydrated = await hydrateChatMessageRows(db, [row]);
  return hydrated[0] ?? null;
}

export async function createChatMessage(
  db: D1Database,
  params: {
    user: AuthUser;
    content: string;
    replyToId?: number | null;
    attachments?: ChatAttachment[];
    pollId?: number | null;
  }
): Promise<ChatMessage> {
  const cleanAttachments = (params.attachments ?? []).slice(0, 10);
  const res = await db
    .prepare(
      `INSERT INTO chat_messages (
         user_id, sender_username, sender_display_name, sender_role, sender_player_id,
         content, reply_to_id, attachments_json, poll_id, is_pinned, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'))`
    )
    .bind(
      params.user.id,
      params.user.username,
      params.user.displayName,
      params.user.role,
      params.user.playerId,
      params.content,
      params.replyToId ?? null,
      JSON.stringify(cleanAttachments),
      params.pollId ?? null
    )
    .run();

  const messageId = Number(res.meta.last_row_id);
  const msg = await getChatMessageById(db, messageId);
  if (!msg) {
    throw new Error('Не удалось загрузить отправленное сообщение');
  }
  return msg;
}

export async function createChatPollWithMessage(
  db: D1Database,
  params: {
    user: AuthUser;
    kind: ChatPollKind;
    question: string;
    options: Array<{ label: string; dateIso?: string | null }>;
    allowMultiple: boolean;
    isAnonymous: boolean;
    allowAddOptions: boolean;
    comment?: string;
    pinMessage?: boolean;
  }
): Promise<ChatMessage> {
  const pollRes = await db
    .prepare(
      `INSERT INTO chat_polls (
         creator_id, kind, question, allow_multiple, is_anonymous, allow_add_options, is_closed, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, 0, datetime('now'))`
    )
    .bind(
      params.user.id,
      params.kind === 'date' ? 'date' : 'general',
      params.question.trim(),
      params.allowMultiple ? 1 : 0,
      params.isAnonymous ? 1 : 0,
      params.allowAddOptions ? 1 : 0
    )
    .run();

  const pollId = Number(pollRes.meta.last_row_id);
  const optionStatements = params.options.map((opt, idx) =>
    db
      .prepare(
        `INSERT INTO chat_poll_options (poll_id, label, date_iso, sort_order)
         VALUES (?, ?, ?, ?)`
      )
      .bind(pollId, opt.label.trim(), opt.dateIso?.trim() || null, idx)
  );

  if (optionStatements.length > 0) {
    await db.batch(optionStatements);
  }

  const msg = await createChatMessage(db, {
    user: params.user,
    content: (params.comment ?? '').trim(),
    pollId,
  });

  if (params.pinMessage) {
    await db
      .prepare(`UPDATE chat_messages SET is_pinned = 1 WHERE id = ?`)
      .bind(msg.id)
      .run();
    msg.isPinned = true;
  }

  return msg;
}

export async function updateChatMessageContent(
  db: D1Database,
  messageId: number,
  content: string
): Promise<ChatMessage | null> {
  await db
    .prepare(
      `UPDATE chat_messages
       SET content = ?, edited_at = datetime('now')
       WHERE id = ?`
    )
    .bind(content, messageId)
    .run();
  return getChatMessageById(db, messageId);
}

export async function togglePinChatMessage(
  db: D1Database,
  messageId: number,
  isPinned: boolean
): Promise<ChatMessage | null> {
  await db
    .prepare(`UPDATE chat_messages SET is_pinned = ? WHERE id = ?`)
    .bind(isPinned ? 1 : 0, messageId)
    .run();
  return getChatMessageById(db, messageId);
}

export async function deleteChatMessage(
  db: D1Database,
  messageId: number
): Promise<{ deleted: boolean; pollId: number | null }> {
  const existing = await db
    .prepare(`SELECT id, poll_id FROM chat_messages WHERE id = ?`)
    .bind(messageId)
    .first<{ id: number; poll_id: number | null }>();

  if (!existing) {
    return { deleted: false, pollId: null };
  }

  await db.prepare(`DELETE FROM chat_messages WHERE id = ?`).bind(messageId).run();
  if (existing.poll_id) {
    await db.prepare(`DELETE FROM chat_polls WHERE id = ?`).bind(existing.poll_id).run();
  }
  return { deleted: true, pollId: existing.poll_id };
}

export async function toggleChatReaction(
  db: D1Database,
  messageId: number,
  userId: number,
  emoji: string
): Promise<ChatMessage | null> {
  const existing = await db
    .prepare(
      `SELECT 1 AS ok FROM chat_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?`
    )
    .bind(messageId, userId, emoji)
    .first<{ ok: number }>();

  if (existing) {
    await db
      .prepare(`DELETE FROM chat_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?`)
      .bind(messageId, userId, emoji)
      .run();
  } else {
    await db
      .prepare(
        `INSERT OR IGNORE INTO chat_reactions (message_id, user_id, emoji, created_at)
         VALUES (?, ?, ?, datetime('now'))`
      )
      .bind(messageId, userId, emoji)
      .run();
  }

  return getChatMessageById(db, messageId);
}

export async function toggleChatPollVote(
  db: D1Database,
  pollId: number,
  optionId: number,
  userId: number
): Promise<{ ok: true; poll: ChatPoll } | { ok: false; error: string }> {
  const pollRow = await db
    .prepare(`SELECT id, allow_multiple, is_closed FROM chat_polls WHERE id = ?`)
    .bind(pollId)
    .first<{ id: number; allow_multiple: number; is_closed: number }>();

  if (!pollRow) {
    return { ok: false, error: 'Голосование не найдено' };
  }
  if (pollRow.is_closed) {
    return { ok: false, error: 'Голосование уже закрыто' };
  }

  const optRow = await db
    .prepare(`SELECT id FROM chat_poll_options WHERE id = ? AND poll_id = ?`)
    .bind(optionId, pollId)
    .first<{ id: number }>();

  if (!optRow) {
    return { ok: false, error: 'Вариант ответа не найден' };
  }

  const alreadyVoted = await db
    .prepare(`SELECT 1 AS ok FROM chat_poll_votes WHERE option_id = ? AND user_id = ?`)
    .bind(optionId, userId)
    .first<{ ok: number }>();

  if (alreadyVoted) {
    await db
      .prepare(`DELETE FROM chat_poll_votes WHERE option_id = ? AND user_id = ?`)
      .bind(optionId, userId)
      .run();
  } else {
    if (!pollRow.allow_multiple) {
      await db
        .prepare(`DELETE FROM chat_poll_votes WHERE poll_id = ? AND user_id = ?`)
        .bind(pollId, userId)
        .run();
    }
    await db
      .prepare(
        `INSERT OR IGNORE INTO chat_poll_votes (poll_id, option_id, user_id, created_at)
         VALUES (?, ?, ?, datetime('now'))`
      )
      .bind(pollId, optionId, userId)
      .run();
  }

  const updated = await getChatPollById(db, pollId);
  if (!updated) {
    return { ok: false, error: 'Не удалось обновить результаты голосования' };
  }
  return { ok: true, poll: updated };
}

export async function addChatPollOption(
  db: D1Database,
  pollId: number,
  label: string,
  dateIso: string | null,
  autoVoteUserId?: number
): Promise<{ ok: true; poll: ChatPoll } | { ok: false; error: string }> {
  const pollRow = await db
    .prepare(
      `SELECT id, creator_id, allow_add_options, allow_multiple, is_closed
       FROM chat_polls WHERE id = ?`
    )
    .bind(pollId)
    .first<{
      id: number;
      creator_id: number;
      allow_add_options: number;
      allow_multiple: number;
      is_closed: number;
    }>();

  if (!pollRow) {
    return { ok: false, error: 'Голосование не найдено' };
  }
  if (pollRow.is_closed) {
    return { ok: false, error: 'Голосование уже закрыто' };
  }

  const maxSort = await db
    .prepare(
      `SELECT COALESCE(MAX(sort_order), -1) AS max_sort, COUNT(*) AS cnt
       FROM chat_poll_options WHERE poll_id = ?`
    )
    .bind(pollId)
    .first<{ max_sort: number; cnt: number }>();

  if ((maxSort?.cnt ?? 0) >= 24) {
    return { ok: false, error: 'Достигнут лимит вариантов ответа (24)' };
  }

  const ins = await db
    .prepare(
      `INSERT INTO chat_poll_options (poll_id, label, date_iso, sort_order)
       VALUES (?, ?, ?, ?)`
    )
    .bind(pollId, label.trim(), dateIso?.trim() || null, (maxSort?.max_sort ?? -1) + 1)
    .run();

  const newOptId = Number(ins.meta.last_row_id);
  if (autoVoteUserId) {
    if (!pollRow.allow_multiple) {
      await db
        .prepare(`DELETE FROM chat_poll_votes WHERE poll_id = ? AND user_id = ?`)
        .bind(pollId, autoVoteUserId)
        .run();
    }
    await db
      .prepare(
        `INSERT OR IGNORE INTO chat_poll_votes (poll_id, option_id, user_id, created_at)
         VALUES (?, ?, ?, datetime('now'))`
      )
      .bind(pollId, newOptId, autoVoteUserId)
      .run();
  }

  const updated = await getChatPollById(db, pollId);
  if (!updated) {
    return { ok: false, error: 'Не удалось загрузить обновлённое голосование' };
  }
  return { ok: true, poll: updated };
}

export async function setChatPollClosed(
  db: D1Database,
  pollId: number,
  isClosed: boolean
): Promise<ChatPoll | null> {
  await db
    .prepare(`UPDATE chat_polls SET is_closed = ? WHERE id = ?`)
    .bind(isClosed ? 1 : 0, pollId)
    .run();
  return getChatPollById(db, pollId);
}

export async function getNextSessionBanner(
  db: D1Database,
  campaignId: string
): Promise<NextSessionBanner | null> {
  const row = await db
    .prepare(`SELECT * FROM campaign_next_session WHERE campaign_id = ?`)
    .bind(campaignId)
    .first<{
      campaign_id: string;
      label: string;
      date_iso: string | null;
      note: string;
      poll_id: number | null;
      updated_by: number | null;
      updated_at: string;
    }>();

  if (!row) return null;
  return {
    campaignId: row.campaign_id,
    label: row.label,
    dateIso: row.date_iso,
    note: row.note,
    pollId: row.poll_id,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  };
}

export async function upsertNextSessionBanner(
  db: D1Database,
  params: {
    campaignId: string;
    label: string;
    dateIso?: string | null;
    note?: string;
    pollId?: number | null;
    updatedBy: number;
  }
): Promise<NextSessionBanner> {
  await db
    .prepare(
      `INSERT INTO campaign_next_session (
         campaign_id, label, date_iso, note, poll_id, updated_by, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(campaign_id) DO UPDATE SET
         label = excluded.label,
         date_iso = excluded.date_iso,
         note = excluded.note,
         poll_id = excluded.poll_id,
         updated_by = excluded.updated_by,
         updated_at = datetime('now')`
    )
    .bind(
      params.campaignId,
      params.label.trim(),
      params.dateIso?.trim() || null,
      (params.note ?? '').trim(),
      params.pollId ?? null,
      params.updatedBy
    )
    .run();

  const banner = await getNextSessionBanner(db, params.campaignId);
  if (!banner) {
    throw new Error('Не удалось сохранить дату следующей сессии');
  }
  return banner;
}

export async function clearNextSessionBanner(
  db: D1Database,
  campaignId: string
): Promise<void> {
  await db
    .prepare(`DELETE FROM campaign_next_session WHERE campaign_id = ?`)
    .bind(campaignId)
    .run();
}

export async function confirmPollOptionAsNextSession(
  db: D1Database,
  params: {
    campaignId: string;
    pollId: number;
    optionId: number;
    note?: string;
    updatedBy: number;
  }
): Promise<{ poll: ChatPoll; nextSession: NextSessionBanner } | null> {
  const opt = await db
    .prepare(`SELECT id, label, date_iso FROM chat_poll_options WHERE id = ? AND poll_id = ?`)
    .bind(params.optionId, params.pollId)
    .first<{ id: number; label: string; date_iso: string | null }>();

  if (!opt) return null;

  await db
    .prepare(`UPDATE chat_polls SET confirmed_option_id = ? WHERE id = ?`)
    .bind(opt.id, params.pollId)
    .run();

  const nextSession = await upsertNextSessionBanner(db, {
    campaignId: params.campaignId,
    label: opt.label,
    dateIso: opt.date_iso,
    note: params.note ?? '',
    pollId: params.pollId,
    updatedBy: params.updatedBy,
  });

  const poll = await getChatPollById(db, params.pollId);
  if (!poll) return null;

  return { poll, nextSession };
}

const RU_TRANSLIT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh', з: 'z',
  и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

export function slugifyCustomEmojiCode(raw: string): string {
  const lower = raw.trim().toLowerCase();
  let transliterated = '';
  for (const ch of lower) {
    transliterated += RU_TRANSLIT[ch] !== undefined ? RU_TRANSLIT[ch] : ch;
  }
  const cleaned = transliterated
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24);
  return cleaned || `emote_${Math.random().toString(36).slice(2, 6)}`;
}

export async function listCustomCampaignEmojis(
  db: D1Database
): Promise<CustomCampaignEmoji[]> {
  const { results } = await db
    .prepare(`SELECT * FROM chat_custom_emojis ORDER BY id DESC`)
    .all<{
      id: number;
      code: string;
      name: string;
      image_key: string;
      image_url: string;
      creator_id: number;
      created_at: string;
    }>();

  return results.map((r) => ({
    id: r.id,
    code: r.code,
    token: `:${r.code}:`,
    name: r.name,
    imageUrl: r.image_url,
    creatorId: r.creator_id,
    createdAt: r.created_at,
  }));
}

export async function createCustomCampaignEmoji(
  db: D1Database,
  params: {
    name: string;
    code?: string;
    imageKey: string;
    imageUrl: string;
    creatorId: number;
  }
): Promise<CustomCampaignEmoji> {
  const baseCode = slugifyCustomEmojiCode(params.code || params.name);
  let finalCode = `c_${baseCode}`;
  const existing = await db
    .prepare(`SELECT 1 AS ok FROM chat_custom_emojis WHERE code = ?`)
    .bind(finalCode)
    .first<{ ok: number }>();

  if (existing) {
    finalCode = `c_${baseCode}_${Math.random().toString(36).slice(2, 5)}`;
  }

  await db
    .prepare(
      `INSERT INTO chat_custom_emojis (code, name, image_key, image_url, creator_id, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`
    )
    .bind(finalCode, params.name.trim().slice(0, 48), params.imageKey, params.imageUrl, params.creatorId)
    .run();

  const all = await listCustomCampaignEmojis(db);
  return (
    all.find((e) => e.code === finalCode) ?? {
      id: Date.now(),
      code: finalCode,
      token: `:${finalCode}:`,
      name: params.name.trim(),
      imageUrl: params.imageUrl,
      creatorId: params.creatorId,
      createdAt: new Date().toISOString(),
    }
  );
}

export async function deleteCustomCampaignEmoji(
  db: D1Database,
  id: number
): Promise<boolean> {
  const res = await db
    .prepare(`DELETE FROM chat_custom_emojis WHERE id = ?`)
    .bind(id)
    .run();
  return Boolean(res.meta.changes);
}
