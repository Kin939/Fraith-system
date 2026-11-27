import { Hono } from 'hono';
import { handle } from 'hono/cloudflare-pages';
import {
  buildLogoutSetCookie,
  buildSessionSetCookie,
  hashPassword,
  parseCookieHeader,
  SESSION_COOKIE_NAME,
  signSessionJwt,
  verifyPassword,
  verifySessionJwt,
} from '../../src/lib/auth';
import { ensureDatabaseInitialized } from '../../src/lib/bootstrap';
import {
  addChatPollOption,
  clearNextSessionBanner,
  confirmPollOptionAsNextSession,
  createChatMessage,
  createChatPollWithMessage,
  createEntityNote,
  createCustomCampaignEmoji,
  deleteChatMessage,
  deleteCustomCampaignEmoji,
  deleteEntityNote,
  getBestiaryCreature,
  getBestiaryImportStatus,
  type CompendiumCreatureInput,
  getCharacterProfile,
  getChatMessageById,
  getEntityNoteMeta,
  getJournalEntry,
  getNextSessionBanner,
  getNpcById,
  getTalentsState,
  getUserByEmail,
  getUserById,
  getUserByUsername,
  learnSpellForPlayer,
  listAllUsersWithThemes,
  listBestiary,
  listCharacterProfiles,
  listChatMessages,
  listCustomCampaignEmojis,
  listDmManagedAccounts,
  listLearnedSpellsForPlayer,
  listEntityNotes,
  listNpcs,
  listQuests,
  listRecentRolls,
  listSpells,
  canViewQuest,
  parseVisibleUserIds,
  mapUserRowToAuthUser,
  NOTE_MAX_LENGTH,
  nextCustomSpellId,
  normalizeNpcAttitude,
  parseCrToNumeric,
  saveJournalEntry,
  setChatPollClosed,
  toggleChatPollVote,
  toggleChatReaction,
  togglePinChatMessage,
  unlearnSpellForPlayer,
  unlockTalentForParty,
  updateAccountPassword,
  updateChatMessageContent,
  updateEntityNote,
  updateLearnedSpellMeta,
  upsertNextSessionBanner,
  upsertUserTheme,
  setUserAvatarKey,
  getUserAvatarUrl,
  upsertCompendiumCreatures,
  withCharacterAvatars,
  withUserAvatars,
} from '../../src/lib/db';
import {
  normalizeQuestAccent,
  normalizeQuestPattern,
} from '../../src/lib/questStyle';
import { normalizeNpcSheet, serializeNpcSheet } from '../../src/lib/npcSheet';
import {
  canViewLiterature,
  createLiteratureFile,
  deleteLiteratureFile,
  detectLiteratureKind,
  getLiteratureRow,
  listLiteratureFiles,
  normalizeVisibleUserIds,
  serializeVisibleUserIds,
  updateLiteratureFile,
} from '../../src/lib/literatureDb';
import { isHudAssetKey } from '../../src/lib/hudIcons';
import { parseLssCharacterPayload } from '../../src/lib/lss';
import {
  deleteLiteratureFromStorage,
  getChatAttachmentFromR2,
  getImageFromR2,
  readLiteratureFileFromStorage,
  uploadChatAttachmentToR2,
  uploadImageToR2,
  uploadLiteratureFileToStorage,
} from '../../src/lib/r2';
import { registerBoardRoutes } from '../../workers/board-routes';
import { registerCombatRoutes } from '../../workers/combat-routes';
import { parseThemeJson } from '../../src/lib/theme';
import type {
  AuthUser,
  ChatAttachment,
  ChatPollKind,
  NoteEntityKind,
  PlayerId,
  QuestStatus,
  Spell,
  SpellCastMode,
  ThemeVariables,
  UserRole,
} from '../../src/lib/types';

export interface Env {
  DB: D1Database;
  BUCKET?: R2Bucket;
  CAMPAIGN_DO: DurableObjectNamespace;
  BOARD_ROOM?: DurableObjectNamespace;
  COMBAT_ROOM?: DurableObjectNamespace;
  ASSETS?: Fetcher;
  JWT_SECRET?: string;
  CAMPAIGN_ID?: string;
  CF_ACCESS_ENABLED?: string;
}

export type Variables = {
  user: AuthUser | null;
};

export const app = new Hono<{ Bindings: Env; Variables: Variables }>().basePath('/api');

function getJwtSecret(env: Env): string {
  return env.JWT_SECRET || 'dev-fraith-secret-change-in-production';
}

function getCampaignId(env: Env): string {
  return env.CAMPAIGN_ID || 'fraith-main-campaign';
}

async function broadcastCampaignEvent(
  env: Env,
  type: string,
  payload: unknown,
  senderId?: number,
  targetUserId?: number
): Promise<void> {
  if (!env.CAMPAIGN_DO) return;
  try {
    const id = env.CAMPAIGN_DO.idFromName(getCampaignId(env));
    const stub = env.CAMPAIGN_DO.get(id);
    await stub.fetch('https://campaign-do.internal/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, payload, senderId, targetUserId }),
    });
  } catch {
    // Non-fatal in case standalone DO dev worker is temporarily restarting
  }
}

function parseValidPlayerId(raw: string): PlayerId | null {
  const n = Number.parseInt(raw, 10);
  if (n === 1 || n === 2 || n === 3) return n;
  return null;
}

// Global database bootstrap + authentication resolver (JWT httpOnly cookie OR Cloudflare Access Zero Trust email)
app.use('*', async (c, next) => {
  await ensureDatabaseInitialized(c.env.DB);
  let resolvedUser: AuthUser | null = null;

  // 1. Optional Cloudflare Access (Zero Trust) identity header — NEVER allowed to bypass DM password
  if (c.env.CF_ACCESS_ENABLED === 'true') {
    const cfEmail = c.req.header('Cf-Access-Authenticated-User-Email');
    if (cfEmail) {
      const row = await getUserByEmail(c.env.DB, cfEmail);
      if (row && row.role !== 'dm') {
        resolvedUser = mapUserRowToAuthUser(row);
      }
    }
  }

  // 2. JWT httpOnly session cookie (strictly matched against current session_version)
  if (!resolvedUser) {
    const token = parseCookieHeader(c.req.header('Cookie'), SESSION_COOKIE_NAME);
    if (token) {
      const payload = await verifySessionJwt(token, getJwtSecret(c.env));
      if (payload) {
        const row = await getUserById(c.env.DB, payload.sub);
        const expectedVersion = row?.session_version ?? 2;
        if (
          row &&
          payload.ver === expectedVersion &&
          payload.role === row.role &&
          payload.username === row.username
        ) {
          resolvedUser = mapUserRowToAuthUser(row);
        }
      }
    }
  }

  c.set('user', resolvedUser);
  await next();
});

// ============================================================================
// Health & Real-time WebSocket Upgrade
// ============================================================================

app.get('/health', (c) => {
  return c.json({ ok: true, campaignId: getCampaignId(c.env) });
});

app.get('/ws', async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Требуется авторизация для WebSocket-подключения' }, 401);
  }
  if (c.req.header('Upgrade')?.toLowerCase() !== 'websocket') {
    return c.json({ error: 'Expected WebSocket Upgrade' }, 426);
  }
  if (!c.env.CAMPAIGN_DO) {
    return c.json({ error: 'Durable Object binding CAMPAIGN_DO is not configured' }, 503);
  }

  const doId = c.env.CAMPAIGN_DO.idFromName(getCampaignId(c.env));
  const stub = c.env.CAMPAIGN_DO.get(doId);

  const doUrl = new URL('https://campaign-do.internal/ws');
  doUrl.searchParams.set('userId', String(user.id));
  doUrl.searchParams.set('username', user.username);
  doUrl.searchParams.set('displayName', user.displayName);
  doUrl.searchParams.set('role', user.role);
  doUrl.searchParams.set('playerId', String(user.playerId));

  return stub.fetch(new Request(doUrl.toString(), c.req.raw));
});

// ============================================================================
// Authentication Routes
// ============================================================================

app.post('/auth/login', async (c) => {
  const body = await c.req
    .json<{ username?: string; password?: string }>()
    .catch((): { username?: string; password?: string } => ({}));
  const username = (body.username || '').trim();
  const password = body.password || '';

  if (!username || !password) {
    return c.json({ error: 'Введите логин и пароль' }, 400);
  }

  const row = await getUserByUsername(c.env.DB, username);
  if (!row || !verifyPassword(password, row.password_hash)) {
    return c.json({ error: 'Неверный логин или пароль' }, 401);
  }

  const authUser = mapUserRowToAuthUser(row);
  const jwt = await signSessionJwt(
    {
      id: authUser.id,
      username: authUser.username,
      role: authUser.role,
      playerId: authUser.playerId,
      sessionVersion: row.session_version ?? 2,
    },
    getJwtSecret(c.env)
  );

  const isSecure = new URL(c.req.url).protocol === 'https:';
  c.header('Set-Cookie', buildSessionSetCookie(jwt, isSecure));

  return c.json({ user: authUser });
});

app.post('/auth/logout', (c) => {
  const isSecure = new URL(c.req.url).protocol === 'https:';
  c.header('Set-Cookie', buildLogoutSetCookie(isSecure));
  return c.json({ ok: true });
});

app.get('/auth/me', async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ user: null }, 401);
  }
  const [withAvatar] = await withUserAvatars(c.env.DB, [user]);
  return c.json({ user: withAvatar });
});

// ---------------------------------------------------------------------------
// Character portrait upload (available to every player; DM may target a slot)
// ---------------------------------------------------------------------------

app.post('/profile/avatar', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Необходима авторизация' }, 401);

  let formData: FormData;
  try {
    formData = await c.req.formData();
  } catch {
    return c.json({ error: 'Некорректные данные формы' }, 400);
  }

  const file = formData.get('file') as unknown;
  if (!file || typeof file !== 'object' || !(file instanceof File)) {
    return c.json({ error: 'Файл портрета не передан' }, 400);
  }

  const requestedPlayerId = parseValidPlayerId(String(formData.get('playerId') || ''));
  const targetPlayerId =
    user.role === 'dm' ? requestedPlayerId ?? user.playerId : user.playerId;

  if (user.role === 'dm' && !targetPlayerId) {
    return c.json({ error: 'Мастеру нужно указать слот игрока (1–3)' }, 400);
  }
  if (targetPlayerId && user.role !== 'dm' && targetPlayerId !== user.playerId) {
    return c.json({ error: 'Можно менять только свой портрет' }, 403);
  }

  let targetUserId = user.id;
  if (user.role === 'dm' && targetPlayerId) {
    const row = await c.env.DB.prepare(`SELECT id FROM users WHERE player_id = ?`)
      .bind(targetPlayerId)
      .first<{ id: number }>();
    if (!row) return c.json({ error: 'Аккаунт игрока не найден' }, 404);
    targetUserId = row.id;
  }

  try {
    const uploaded = await uploadImageToR2(c.env.BUCKET, c.env.DB, file, 'avatars');
    await setUserAvatarKey(c.env.DB, targetUserId, uploaded.key);

    const [updatedUser] = await withUserAvatars(c.env.DB, [
      {
        ...user,
        id: targetUserId,
        playerId: targetPlayerId ?? user.playerId,
      } as AuthUser,
    ]);

    const resolvedAvatarUrl = updatedUser?.avatarUrl ?? uploaded.url;

    await broadcastCampaignEvent(
      c.env,
      'party:avatars_updated',
      {
        userId: targetUserId,
        playerId: targetPlayerId ?? user.playerId,
        avatarUrl: resolvedAvatarUrl,
      },
      user.id
    );

    return c.json({
      key: uploaded.key,
      url: uploaded.url,
      avatarUrl: resolvedAvatarUrl,
      userId: targetUserId,
      playerId: targetPlayerId ?? user.playerId,
    });
  } catch (err) {
    return c.json(
      { error: err instanceof Error ? err.message : 'Не удалось загрузить портрет' },
      400
    );
  }
});

app.delete('/profile/avatar', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Необходима авторизация' }, 401);

  const requestedPlayerId = parseValidPlayerId(c.req.query('playerId') || '');
  const targetPlayerId =
    user.role === 'dm' ? requestedPlayerId ?? user.playerId : user.playerId;

  let targetUserId = user.id;
  if (user.role === 'dm' && targetPlayerId) {
    const row = await c.env.DB.prepare(`SELECT id FROM users WHERE player_id = ?`)
      .bind(targetPlayerId)
      .first<{ id: number }>();
    if (!row) return c.json({ error: 'Аккаунт игрока не найден' }, 404);
    targetUserId = row.id;
  }

  await setUserAvatarKey(c.env.DB, targetUserId, null);
  // Falls back to the character-sheet portrait, if the sheet has one
  const fallbackAvatarUrl = await getUserAvatarUrl(c.env.DB, targetUserId);
  await broadcastCampaignEvent(
    c.env,
    'party:avatars_updated',
    {
      userId: targetUserId,
      playerId: targetPlayerId ?? user.playerId,
      avatarUrl: fallbackAvatarUrl,
    },
    user.id
  );
  return c.json({
    ok: true,
    userId: targetUserId,
    playerId: targetPlayerId ?? user.playerId,
    avatarUrl: fallbackAvatarUrl,
  });
});

// ============================================================================
// R2 Object Storage Routes (Public read for authenticated party, DM upload)
// ============================================================================

app.get('/r2/:key{.*}', async (c) => {
  const rawKey = decodeURIComponent(c.req.param('key'));
  return getImageFromR2(c.env.BUCKET, c.env.DB, rawKey);
});

// ============================================================================
// Role Guard Middleware for Protected Routes
// ============================================================================

app.use('/dm/*', async (c, next) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Необходима авторизация' }, 401);
  if (user.role !== 'dm') {
    return c.json({ error: 'Доступ разрешён только Мастеру (dm)' }, 403);
  }
  await next();
});

/**
 * Квесты бывают личными, поэтому рассылать один общий список нельзя — игроки
 * получили бы чужие квесты. Вместо payload отправляем сигнал, и каждый клиент
 * перечитывает /api/quests уже со своей фильтрацией.
 */
async function broadcastQuestsChanged(env: Env, senderId?: number): Promise<void> {
  await broadcastCampaignEvent(env, 'quests:updated', { refetch: true }, senderId);
}

/** Литература: тот же принцип — сигнал вместо списка файлов. */
async function broadcastLiteratureChanged(env: Env, senderId?: number): Promise<void> {
  await broadcastCampaignEvent(env, 'literature:updated', { refetch: true }, senderId);
}

// ============================================================================
// Tab 1: Characters, Personal Journal & Long Story Short (LSS) Sync
// ============================================================================

app.get('/characters', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Необходима авторизация' }, 401);

  // Resolve portraits first — the raw sheet JSON is stripped from the summary response.
  const allProfiles = await withCharacterAvatars(
    c.env.DB,
    await listCharacterProfiles(c.env.DB)
  );
  // Strip bulky rawLssJson from the summary list (full rawLssJson is fetched via /api/player/:id)
  if (user.role === 'dm') {
    return c.json({
      characters: allProfiles.map((p) => ({ ...p, rawLssJson: null })),
    });
  }

  // Players get their own summary + party summary names/classes
  const filtered = allProfiles.map((p) =>
    p.playerId === user.playerId
      ? { ...p, rawLssJson: null }
      : {
          ...p,
          lssNotes: '',
          rawLssJson: null,
          coins: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
        }
  );
  return c.json({ characters: filtered });
});

app.get('/player/:id', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Необходима авторизация' }, 401);

  const playerId = parseValidPlayerId(c.req.param('id'));
  if (!playerId) return c.json({ error: 'Некорректный playerId (ожидается 1, 2 или 3)' }, 400);

  if (user.role !== 'dm' && user.playerId !== playerId) {
    return c.json({ error: 'Вы можете просматривать только своего персонажа' }, 403);
  }

  const [profileRow, journal, learnedSpells] = await Promise.all([
    getCharacterProfile(c.env.DB, playerId),
    getJournalEntry(c.env.DB, playerId),
    listLearnedSpellsForPlayer(c.env.DB, playerId),
  ]);

  const profile = profileRow
    ? (await withCharacterAvatars(c.env.DB, [profileRow]))[0]
    : null;

  return c.json({ profile, journal, learnedSpells });
});

app.get('/player/:id/lss-cache', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Необходима авторизация' }, 401);

  const playerId = parseValidPlayerId(c.req.param('id'));
  if (!playerId) return c.json({ error: 'Некорректный playerId' }, 400);

  if (user.role !== 'dm' && user.playerId !== playerId) {
    return c.json({ error: 'Нет доступа к чужому листу LSS' }, 403);
  }

  const profile = await getCharacterProfile(c.env.DB, playerId);
  return c.json({ profile });
});

/**
 * POST /api/player/:id/sync-lss
 * Accepts:
 *  - Full LSS character JSON (`{ lssJson: object | string }`) conforming to
 *    https://longstoryshort.app/schema/v1/character.json or LSS file export
 *  - Live health / URL / coins / notes updates (`{ lssEmbedUrl, hpCurrent, hpMax, hpTemp, coins, notes }`)
 */
app.post('/player/:id/sync-lss', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Необходима авторизация' }, 401);

  const playerId = parseValidPlayerId(c.req.param('id'));
  if (!playerId) return c.json({ error: 'Некорректный playerId' }, 400);

  if (user.role !== 'dm' && user.playerId !== playerId) {
    return c.json({ error: 'Синхронизация разрешена только владельцу персонажа или Мастеру' }, 403);
  }

  const current = await getCharacterProfile(c.env.DB, playerId);
  if (!current) {
    return c.json({ error: 'Профиль игрока не найден' }, 404);
  }

  const body = await c.req
    .json<Record<string, unknown>>()
    .catch((): Record<string, unknown> => ({}));

  let nextName = current.characterName;
  let nextClass = current.charClass;
  let nextSubclass = current.subclass;
  let nextRace = current.race;
  let nextLevel = current.level;
  let nextMaxSpells = current.maxSpells;
  let nextEmbedUrl = current.lssEmbedUrl;
  let nextCoins = { ...current.coins };
  let nextHpCurrent = current.hpCurrent;
  let nextHpMax = current.hpMax;
  let nextHpTemp = current.hpTemp;
  let nextNotes = current.lssNotes;
  let rawJsonToStore: string | null = null;

  // Case 1: Full LSS JSON payload passed directly or under `lssJson`
  const candidateJson = body.lssJson !== undefined ? body.lssJson : body.$schema || body.data || body.vitality || body.info ? body : null;
  if (candidateJson !== null) {
    try {
      const parsed = parseLssCharacterPayload(candidateJson);
      if (parsed.characterName) nextName = parsed.characterName;
      if (parsed.charClass) nextClass = parsed.charClass;
      if (parsed.subclass !== undefined) nextSubclass = parsed.subclass;
      if (parsed.race) nextRace = parsed.race;
      if (parsed.level !== undefined) nextLevel = parsed.level;
      if (parsed.maxSpells !== undefined) nextMaxSpells = parsed.maxSpells;
      if (parsed.coins) {
        nextCoins = {
          cp: parsed.coins.cp ?? nextCoins.cp,
          sp: parsed.coins.sp ?? nextCoins.sp,
          ep: parsed.coins.ep ?? nextCoins.ep,
          gp: parsed.coins.gp ?? nextCoins.gp,
          pp: parsed.coins.pp ?? nextCoins.pp,
        };
      }
      if (parsed.hpCurrent !== undefined) nextHpCurrent = parsed.hpCurrent;
      if (parsed.hpMax !== undefined) nextHpMax = parsed.hpMax;
      if (parsed.hpTemp !== undefined) nextHpTemp = parsed.hpTemp;
      if (parsed.notes !== undefined) nextNotes = parsed.notes;

      rawJsonToStore =
        typeof candidateJson === 'string' ? candidateJson : JSON.stringify(candidateJson);
    } catch (err) {
      return c.json(
        { error: err instanceof Error ? err.message : 'Ошибка разбора JSON Long Story Short' },
        400
      );
    }
  }

  // Case 2: Explicit overrides (e.g. dnd:health postMessage sync, embed URL update, or fallback coin/notes fields)
  if (typeof body.lssEmbedUrl === 'string' && body.lssEmbedUrl.startsWith('https://longstoryshort.app/')) {
    nextEmbedUrl = body.lssEmbedUrl.trim();
  }
  if (typeof body.hpCurrent === 'number') nextHpCurrent = Math.trunc(body.hpCurrent);
  if (typeof body.hpMax === 'number') nextHpMax = Math.trunc(body.hpMax);
  if (typeof body.hpTemp === 'number') nextHpTemp = Math.trunc(body.hpTemp);
  if (typeof body.lssNotes === 'string') nextNotes = body.lssNotes;
  if (body.coins && typeof body.coins === 'object') {
    const co = body.coins as Record<string, unknown>;
    if (typeof co.cp === 'number') nextCoins.cp = Math.max(0, Math.trunc(co.cp));
    if (typeof co.sp === 'number') nextCoins.sp = Math.max(0, Math.trunc(co.sp));
    if (typeof co.ep === 'number') nextCoins.ep = Math.max(0, Math.trunc(co.ep));
    if (typeof co.gp === 'number') nextCoins.gp = Math.max(0, Math.trunc(co.gp));
    if (typeof co.pp === 'number') nextCoins.pp = Math.max(0, Math.trunc(co.pp));
  }

  // Optional slot reset so player/DM can clear a character slot back to empty state
  if (body.reset === true) {
    await c.env.DB.batch([
      c.env.DB.prepare(
        `UPDATE character_profiles
         SET character_name = '',
             char_class = '',
             subclass = '',
             race = '',
             level = 0,
             experience_current = 0,
             experience_max = 0,
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
             last_synced_at = NULL
         WHERE player_id = ?`
      ).bind(playerId),
      c.env.DB.prepare(`DELETE FROM learned_spells WHERE player_id = ?`).bind(playerId),
      c.env.DB.prepare(`UPDATE users SET display_name = ? WHERE player_id = ?`).bind(
        `Игрок ${playerId}`,
        playerId
      ),
    ]);
    const cleared = await getCharacterProfile(c.env.DB, playerId);
    await broadcastCampaignEvent(c.env, 'character:updated', { playerId, profile: cleared }, user.id);
    await broadcastCampaignEvent(
      c.env,
      'learned_spells:updated',
      { playerId, learnedSpells: [] },
      user.id
    );
    return c.json({ profile: cleared });
  }

  // Enforce DM-only experience points: if a player syncs JSON, preserve current DB XP inside rawJsonToStore
  if (rawJsonToStore && user.role !== 'dm') {
    try {
      const parsedRoot = JSON.parse(rawJsonToStore) as Record<string, unknown>;
      if (typeof parsedRoot.data === 'string') {
        const inner = JSON.parse(parsedRoot.data) as Record<string, unknown>;
        if (!inner.info || typeof inner.info !== 'object') inner.info = {};
        (inner.info as Record<string, unknown>).experience = { value: current.experienceCurrent };
        parsedRoot.data = JSON.stringify(inner);
      } else if (parsedRoot.info && typeof parsedRoot.info === 'object') {
        (parsedRoot.info as Record<string, unknown>).experience = {
          value: current.experienceCurrent,
        };
      }
      rawJsonToStore = JSON.stringify(parsedRoot);
    } catch {
      // Keep rawJsonToStore as-is if non-standard
    }
  }

  await c.env.DB.prepare(
    `UPDATE character_profiles
     SET character_name = ?,
         char_class = ?,
         subclass = ?,
         race = ?,
         level = ?,
         max_spells = ?,
         lss_embed_url = ?,
         coins_cp = ?,
         coins_sp = ?,
         coins_ep = ?,
         coins_gp = ?,
         coins_pp = ?,
         hp_current = ?,
         hp_max = ?,
         hp_temp = ?,
         lss_notes = ?,
         raw_lss_json = COALESCE(?, raw_lss_json),
         last_synced_at = datetime('now')
     WHERE player_id = ?`
  )
    .bind(
      nextName,
      nextClass,
      nextSubclass,
      nextRace,
      nextLevel,
      nextMaxSpells,
      nextEmbedUrl,
      nextCoins.cp,
      nextCoins.sp,
      nextCoins.ep,
      nextCoins.gp,
      nextCoins.pp,
      nextHpCurrent,
      nextHpMax,
      nextHpTemp,
      nextNotes,
      rawJsonToStore,
      playerId
    )
    .run();

  if (nextName.trim()) {
    await c.env.DB.prepare(`UPDATE users SET display_name = ? WHERE player_id = ?`)
      .bind(nextName.trim(), playerId)
      .run();
  }

  const updated = await getCharacterProfile(c.env.DB, playerId);
  await broadcastCampaignEvent(c.env, 'character:updated', { playerId, profile: updated }, user.id);

  return c.json({ profile: updated });
});

app.put('/player/:id/journal', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Необходима авторизация' }, 401);

  const playerId = parseValidPlayerId(c.req.param('id'));
  if (!playerId) return c.json({ error: 'Некорректный playerId' }, 400);

  // On Tab 1 only the owning player edits their personal journal; DM views read-only
  if (user.role !== 'player' || user.playerId !== playerId) {
    return c.json({ error: 'Личный журнал редактируется только самим игроком' }, 403);
  }

  const body = await c.req
    .json<{ title?: string; content?: string }>()
    .catch((): { title?: string; content?: string } => ({}));
  const title = (body.title ?? 'Личный журнал').trim() || 'Личный журнал';
  const content = body.content ?? '';

  const journal = await saveJournalEntry(c.env.DB, playerId, title, content);
  await broadcastCampaignEvent(c.env, 'journal:updated', { playerId, journal }, user.id);

  return c.json({ journal });
});

app.get('/rolls', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Необходима авторизация' }, 401);
  const rolls = await listRecentRolls(c.env.DB, 20);
  return c.json({ rolls });
});

app.post('/rolls', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Необходима авторизация' }, 401);

  const body = await c.req
    .json<{
      characterName?: string;
      title?: string;
      formula?: string;
      breakdown?: string;
      total?: string;
      isCrit?: boolean;
      critKind?: 'success' | 'failure';
    }>()
    .catch(
      (): {
        characterName?: string;
        title?: string;
        formula?: string;
        breakdown?: string;
        total?: string;
        isCrit?: boolean;
        critKind?: 'success' | 'failure';
      } => ({})
    );

  const characterName = (body.characterName || user.displayName).slice(0, 80);
  const title = (body.title || 'Бросок кубика').slice(0, 120);
  const formula = (body.formula || '1d20').slice(0, 80);
  const breakdown = (body.breakdown || '').slice(0, 120);
  const total = String(body.total ?? '0').slice(0, 40);
  const isCrit = body.isCrit ? 1 : 0;
  const critKind = body.critKind ?? null;

  await c.env.DB.prepare(
    `INSERT INTO roll_log (player_id, character_name, title, formula, breakdown, total, is_crit, crit_kind, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  )
    .bind(user.playerId, characterName, title, formula, breakdown, total, isCrit, critKind)
    .run();

  const rollEntry = {
    playerId: user.playerId,
    characterName,
    title,
    formula,
    breakdown,
    total,
    isCrit: Boolean(isCrit),
    critKind,
    createdAt: new Date().toISOString(),
  };

  await broadcastCampaignEvent(c.env, 'lss:roll', rollEntry, user.id);
  return c.json({ roll: rollEntry });
});

// ============================================================================
// Tab 2: Quests (Read for all, CRUD in /api/dm/quests)
// ============================================================================

interface QuestMutationBody {
  title: string;
  shortDesc: string;
  fullDesc: string;
  reward?: string;
  parameters?: Record<string, string>;
  progressCurrent?: number;
  progressTarget?: number;
  imageKey?: string | null;
  status?: QuestStatus;
  tileAccent?: string | null;
  tileEmblem?: string | null;
  tilePattern?: string | null;
  isImportant?: boolean;
  /** Личные квесты: id игроков, которым квест открыт ([] = всей партии) */
  visibleUserIds?: number[];
}

function normalizeQuestTileStyle(body: QuestMutationBody): {
  accent: string | null;
  emblem: string | null;
  pattern: string;
  isImportant: boolean;
} {
  return {
    accent: normalizeQuestAccent(body.tileAccent),
    emblem: isHudAssetKey(body.tileEmblem) ? (body.tileEmblem as string) : null,
    pattern: normalizeQuestPattern(body.tilePattern),
    isImportant: Boolean(body.isImportant),
  };
}

app.get('/quests', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Необходима авторизация' }, 401);

  const quests = await listQuests(c.env.DB, {
    userId: user.id,
    isDm: user.role === 'dm',
  });
  return c.json({ quests });
});

app.post('/dm/quests', async (c) => {
  const user = c.get('user')!;
  const body = await c.req.json<QuestMutationBody>();

  if (!body.title?.trim() || !body.shortDesc?.trim()) {
    return c.json({ error: 'Укажите название и краткое описание квеста' }, 400);
  }

  const status: QuestStatus = ['active', 'completed', 'failed', 'available'].includes(
    body.status as string
  )
    ? (body.status as QuestStatus)
    : 'active';

  const tile = normalizeQuestTileStyle(body);

  await c.env.DB.prepare(
    `INSERT INTO quests (title, short_desc, full_desc, reward, parameters_json, progress_current, progress_target, image_key, status, tile_accent, tile_emblem, tile_pattern, is_important, visible_user_ids, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  )
    .bind(
      body.title.trim(),
      body.shortDesc.trim(),
      (body.fullDesc || '').trim(),
      (body.reward || '').trim(),
      JSON.stringify(body.parameters || {}),
      Math.max(0, Math.trunc(body.progressCurrent ?? 0)),
      Math.max(1, Math.trunc(body.progressTarget ?? 1)),
      body.imageKey || null,
      status,
      tile.accent,
      tile.emblem,
      tile.pattern,
      tile.isImportant ? 1 : 0,
      serializeVisibleUserIds(normalizeVisibleUserIds(body.visibleUserIds))
    )
    .run();

  const quests = await listQuests(c.env.DB);
  await broadcastQuestsChanged(c.env, user.id);
  return c.json({ quests });
});

app.put('/dm/quests/:id', async (c) => {
  const user = c.get('user')!;
  const id = Number.parseInt(c.req.param('id'), 10);
  const body = await c.req.json<QuestMutationBody>();

  const status: QuestStatus = ['active', 'completed', 'failed', 'available'].includes(
    body.status as string
  )
    ? (body.status as QuestStatus)
    : 'active';

  const tile = normalizeQuestTileStyle(body);

  await c.env.DB.prepare(
    `UPDATE quests
     SET title = ?,
         short_desc = ?,
         full_desc = ?,
         reward = ?,
         parameters_json = ?,
         progress_current = ?,
         progress_target = ?,
         image_key = ?,
         status = ?,
         tile_accent = ?,
         tile_emblem = ?,
         tile_pattern = ?,
         is_important = ?,
         visible_user_ids = ?
     WHERE id = ?`
  )
    .bind(
      body.title.trim(),
      body.shortDesc.trim(),
      (body.fullDesc || '').trim(),
      (body.reward || '').trim(),
      JSON.stringify(body.parameters || {}),
      Math.max(0, Math.trunc(body.progressCurrent ?? 0)),
      Math.max(1, Math.trunc(body.progressTarget ?? 1)),
      body.imageKey || null,
      status,
      tile.accent,
      tile.emblem,
      tile.pattern,
      tile.isImportant ? 1 : 0,
      serializeVisibleUserIds(normalizeVisibleUserIds(body.visibleUserIds)),
      id
    )
    .run();

  const quests = await listQuests(c.env.DB);
  await broadcastQuestsChanged(c.env, user.id);
  return c.json({ quests });
});

// Quick tile styling: star/unstar a quest or recolor it without a full edit form.
app.patch('/dm/quests/:id/tile', async (c) => {
  const user = c.get('user')!;
  const id = Number.parseInt(c.req.param('id'), 10);
  if (!Number.isFinite(id) || id <= 0) {
    return c.json({ error: 'Некорректный id квеста' }, 400);
  }

  type TilePatchBody = {
    accent?: string | null;
    emblem?: string | null;
    pattern?: string | null;
    isImportant?: boolean;
  };

  const body = await c.req
    .json<TilePatchBody>()
    .catch((): TilePatchBody => ({}));

  const current = await c.env.DB.prepare(
    `SELECT tile_accent, tile_emblem, tile_pattern, is_important FROM quests WHERE id = ?`
  )
    .bind(id)
    .first<{
      tile_accent: string | null;
      tile_emblem: string | null;
      tile_pattern: string | null;
      is_important: number;
    }>();

  if (!current) return c.json({ error: 'Квест не найден' }, 404);

  const accent =
    body.accent === undefined ? current.tile_accent : normalizeQuestAccent(body.accent);
  const emblem =
    body.emblem === undefined
      ? current.tile_emblem
      : isHudAssetKey(body.emblem)
        ? (body.emblem as string)
        : null;
  const pattern =
    body.pattern === undefined
      ? current.tile_pattern || 'none'
      : normalizeQuestPattern(body.pattern);
  const isImportant =
    body.isImportant === undefined ? Boolean(current.is_important) : Boolean(body.isImportant);

  await c.env.DB.prepare(
    `UPDATE quests
     SET tile_accent = ?, tile_emblem = ?, tile_pattern = ?, is_important = ?
     WHERE id = ?`
  )
    .bind(accent, emblem, pattern, isImportant ? 1 : 0, id)
    .run();

  const quests = await listQuests(c.env.DB);
  await broadcastQuestsChanged(c.env, user.id);
  return c.json({ quests });
});

app.delete('/dm/quests/:id', async (c) => {
  const user = c.get('user')!;
  const id = Number.parseInt(c.req.param('id'), 10);
  await c.env.DB.prepare(`DELETE FROM quests WHERE id = ?`).bind(id).run();

  const quests = await listQuests(c.env.DB);
  await broadcastQuestsChanged(c.env, user.id);
  return c.json({ quests });
});

// ============================================================================
// Литература — файлы мастера (PDF, Word, TXT, картинки), вкладка после «Доски»
// ============================================================================

/** Опасные расширения не пускаем даже как «литературу». */
const LITERATURE_BLOCKED_EXTENSIONS = new Set([
  'html',
  'htm',
  'xhtml',
  'svg',
  'js',
  'mjs',
  'cjs',
  'exe',
  'bat',
  'cmd',
  'com',
  'sh',
  'msi',
  'php',
  'phtml',
  'jar',
]);

function literatureSlug(name: string): string {
  const base = name
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return base || 'file';
}

function literatureExtOf(name: string, mime: string): string {
  const match = name.match(/\.([a-zA-Z0-9]{1,8})$/);
  if (match) return match[1].toLowerCase();
  const fromMime = mime.split('/')[1]?.split(';')[0]?.trim();
  return (fromMime || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'bin';
}

app.get('/literature', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Необходима авторизация' }, 401);
  const files = await listLiteratureFiles(c.env.DB, {
    userId: user.id,
    isDm: user.role === 'dm',
  });
  return c.json({ files, isDm: user.role === 'dm' });
});

/** Сам файл: инлайн для PDF/картинок/текста, вложение — для остального. */
app.get('/literature/:id/file', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Необходима авторизация' }, 401);

  const id = Number.parseInt(c.req.param('id'), 10);
  if (!Number.isFinite(id) || id <= 0) return c.json({ error: 'Некорректный id' }, 400);

  const row = await getLiteratureRow(c.env.DB, id);
  if (!row) return c.json({ error: 'Файл не найден' }, 404);
  if (!(await canViewLiterature(c.env.DB, row, { userId: user.id, isDm: user.role === 'dm' }))) {
    return c.json({ error: 'Файл не найден' }, 404);
  }

  const stored = await readLiteratureFileFromStorage(c.env.BUCKET, c.env.DB, row.file_key);
  const body = stored.bytes ?? stored.body;
  if (!body) return c.json({ error: 'Файл не найден' }, 404);

  const inlineSafe = row.kind === 'pdf' || row.kind === 'image' || row.kind === 'text';
  const asDownload = c.req.query('download') === '1';
  const disposition = inlineSafe && !asDownload ? 'inline' : 'attachment';
  const fileName = encodeURIComponent(row.file_name || `${row.title}.${row.file_ext || 'bin'}`);

  const headers = new Headers();
  headers.set('Content-Type', stored.contentType || row.mime_type || 'application/octet-stream');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Cache-Control', 'private, max-age=300');
  headers.set('Content-Disposition', `${disposition}; filename*=UTF-8''${fileName}`);
  if (stored.bytes) headers.set('Content-Length', String(stored.bytes.byteLength));

  return new Response(body as BodyInit, { headers });
});

app.post('/dm/literature', async (c) => {
  const user = c.get('user')!;

  let form: FormData;
  try {
    form = await c.req.formData();
  } catch {
    return c.json({ error: 'Не удалось прочитать форму загрузки' }, 400);
  }

  const rawFile = form.get('file');
  if (!rawFile || typeof rawFile !== 'object' || !(rawFile instanceof File)) {
    return c.json({ error: 'Файл не передан' }, 400);
  }

  const fileName = (rawFile.name || 'file').slice(0, 200);
  const mime = (rawFile.type || 'application/octet-stream').split(';')[0].trim().toLowerCase();
  const ext = literatureExtOf(fileName, mime);

  if (LITERATURE_BLOCKED_EXTENSIONS.has(ext)) {
    return c.json({ error: `Файлы .${ext} запрещены из соображений безопасности` }, 400);
  }

  const title = (String(form.get('title') || '').trim() || fileName).slice(0, 140);
  const description = String(form.get('description') || '').slice(0, 2000);

  let visibleUserIds: number[] = [];
  const rawVisible = form.get('visibleUserIds');
  if (typeof rawVisible === 'string' && rawVisible.trim()) {
    try {
      visibleUserIds = normalizeVisibleUserIds(JSON.parse(rawVisible));
    } catch {
      visibleUserIds = [];
    }
  }

  const kind = detectLiteratureKind(ext, mime);
  const key = `literature/${Date.now()}-${literatureSlug(fileName)}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

  try {
    await uploadLiteratureFileToStorage(c.env.BUCKET, c.env.DB, rawFile, key);
    const file = await createLiteratureFile(c.env.DB, {
      title,
      description,
      fileKey: key,
      fileName,
      mimeType: mime,
      fileExt: ext,
      fileSize: rawFile.size,
      kind,
      visibleUserIds,
      uploadedBy: user.id,
    });
    await broadcastLiteratureChanged(c.env, user.id);
    return c.json({ file });
  } catch (err) {
    // Не оставляем «сиротские» чанки/объекты, если запись в таблицу не удалась.
    await deleteLiteratureFromStorage(c.env.BUCKET, c.env.DB, key).catch(() => undefined);
    return c.json({ error: err instanceof Error ? err.message : 'Не удалось загрузить файл' }, 400);
  }
});

app.patch('/dm/literature/:id', async (c) => {
  const user = c.get('user')!;
  const id = Number.parseInt(c.req.param('id'), 10);
  if (!Number.isFinite(id) || id <= 0) return c.json({ error: 'Некорректный id' }, 400);

  const body = await c.req
    .json<{ title?: string; description?: string; visibleUserIds?: number[] }>()
    .catch((): { title?: string; description?: string; visibleUserIds?: number[] } => ({}));

  const file = await updateLiteratureFile(c.env.DB, id, {
    title: typeof body.title === 'string' ? body.title : undefined,
    description: typeof body.description === 'string' ? body.description : undefined,
    visibleUserIds: body.visibleUserIds !== undefined ? normalizeVisibleUserIds(body.visibleUserIds) : undefined,
  });
  if (!file) return c.json({ error: 'Файл не найден' }, 404);

  await broadcastLiteratureChanged(c.env, user.id);
  return c.json({ file });
});

app.delete('/dm/literature/:id', async (c) => {
  const user = c.get('user')!;
  const id = Number.parseInt(c.req.param('id'), 10);
  if (!Number.isFinite(id) || id <= 0) return c.json({ error: 'Некорректный id' }, 400);

  const row = await deleteLiteratureFile(c.env.DB, id);
  if (!row) return c.json({ error: 'Файл не найден' }, 404);
  await deleteLiteratureFromStorage(c.env.BUCKET, c.env.DB, row.file_key);

  await broadcastLiteratureChanged(c.env, user.id);
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Party notes — quests, NPCs and bestiary monsters share one attributed feed
// ---------------------------------------------------------------------------

const NOTE_COLLECTION_TO_KIND: Record<string, NoteEntityKind> = {
  quests: 'quest',
  npcs: 'npc',
  bestiary: 'creature',
};

const NOTE_KIND_TO_TABLE: Record<NoteEntityKind, string> = {
  quest: 'quests',
  npc: 'campaign_npcs',
  creature: 'bestiary',
};

async function isNoteEntityVisibleToPlayers(
  env: Env,
  kind: NoteEntityKind,
  entityId: number
): Promise<boolean> {
  if (kind === 'quest') {
    // Заметки к личному квесту не должны улетать всей партии.
    const row = await env.DB.prepare(`SELECT visible_user_ids FROM quests WHERE id = ?`)
      .bind(entityId)
      .first<{ visible_user_ids: string | null }>();
    return parseVisibleUserIds(row?.visible_user_ids).length === 0;
  }
  const table = NOTE_KIND_TO_TABLE[kind];
  const row = await env.DB.prepare(`SELECT is_revealed FROM ${table} WHERE id = ?`)
    .bind(entityId)
    .first<{ is_revealed: number }>();
  return Boolean(row?.is_revealed);
}

async function broadcastEntityNotes(
  env: Env,
  kind: NoteEntityKind,
  entityId: number,
  senderId?: number
) {
  const notes = await listEntityNotes(env.DB, kind, entityId);
  // Notes on a still-hidden NPC / monster would be a spoiler broadcast to every
  // connected player, so those stay DM-local (the response still has them).
  if (await isNoteEntityVisibleToPlayers(env, kind, entityId)) {
    await broadcastCampaignEvent(env, 'notes:updated', { kind, entityId, notes }, senderId);
  }
  return notes;
}

/**
 * Notes on hidden NPCs / monsters stay invisible to players — they cannot read
 * or write them until the DM reveals the card.
 */
async function canAccessNoteEntity(
  env: Env,
  kind: NoteEntityKind,
  entityId: number,
  user: AuthUser
): Promise<boolean> {
  if (kind === 'quest') {
    // Личный квест не должен «протекать» через заметки к нему.
    return canViewQuest(env.DB, entityId, {
      userId: user.id,
      isDm: user.role === 'dm',
    });
  }
  const table = NOTE_KIND_TO_TABLE[kind];
  const row = await env.DB.prepare(`SELECT is_revealed FROM ${table} WHERE id = ?`)
    .bind(entityId)
    .first<{ is_revealed: number }>();
  if (!row) return false;
  return user.role === 'dm' || Boolean(row.is_revealed);
}

function parsePositiveInt(raw: string | undefined): number | null {
  const value = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(value) && value > 0 ? value : null;
}

for (const collection of Object.keys(NOTE_COLLECTION_TO_KIND)) {
  const kind = NOTE_COLLECTION_TO_KIND[collection];

  app.get(`/${collection}/:id/notes`, async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Необходима авторизация' }, 401);

    const entityId = parsePositiveInt(c.req.param('id'));
    if (!entityId) return c.json({ error: 'Некорректный id' }, 400);
    if (!(await canAccessNoteEntity(c.env, kind, entityId, user))) {
      return c.json({ error: 'Запись не найдена' }, 404);
    }

    const notes = await listEntityNotes(c.env.DB, kind, entityId);
    return c.json({ notes });
  });

  app.post(`/${collection}/:id/notes`, async (c) => {
    const user = c.get('user')!;
    const entityId = parsePositiveInt(c.req.param('id'));
    if (!entityId) return c.json({ error: 'Некорректный id' }, 400);
    if (!(await canAccessNoteEntity(c.env, kind, entityId, user))) {
      return c.json({ error: 'Запись не найдена' }, 404);
    }

    const body = await c.req
      .json<{ body?: string }>()
      .catch((): { body?: string } => ({}));
    const text = (body.body || '').trim();
    if (!text) return c.json({ error: 'Заметка не может быть пустой' }, 400);
    if (text.length > NOTE_MAX_LENGTH) {
      return c.json({ error: `Заметка длиннее ${NOTE_MAX_LENGTH} символов` }, 400);
    }

    await createEntityNote(c.env.DB, kind, entityId, user.id, text);
    const notes = await broadcastEntityNotes(c.env, kind, entityId, user.id);
    return c.json({ notes });
  });
}

app.put('/notes/:noteId', async (c) => {
  const user = c.get('user')!;
  const noteId = parsePositiveInt(c.req.param('noteId'));
  if (!noteId) return c.json({ error: 'Некорректный id заметки' }, 400);

  const note = await getEntityNoteMeta(c.env.DB, noteId);
  if (!note) return c.json({ error: 'Заметка не найдена' }, 404);
  if (note.authorId !== user.id && user.role !== 'dm') {
    return c.json({ error: 'Можно редактировать только свои заметки' }, 403);
  }

  const body = await c.req
    .json<{ body?: string }>()
    .catch((): { body?: string } => ({}));
  const text = (body.body || '').trim();
  if (!text) return c.json({ error: 'Заметка не может быть пустой' }, 400);
  if (text.length > NOTE_MAX_LENGTH) {
    return c.json({ error: `Заметка длиннее ${NOTE_MAX_LENGTH} символов` }, 400);
  }

  await updateEntityNote(c.env.DB, noteId, text);
  const notes = await broadcastEntityNotes(c.env, note.kind, note.entityId, user.id);
  return c.json({ notes });
});

app.delete('/notes/:noteId', async (c) => {
  const user = c.get('user')!;
  const noteId = parsePositiveInt(c.req.param('noteId'));
  if (!noteId) return c.json({ error: 'Некорректный id заметки' }, 400);

  const note = await getEntityNoteMeta(c.env.DB, noteId);
  if (!note) return c.json({ error: 'Заметка не найдена' }, 404);
  if (note.authorId !== user.id && user.role !== 'dm') {
    return c.json({ error: 'Можно удалять только свои заметки' }, 403);
  }

  await deleteEntityNote(c.env.DB, noteId);
  const notes = await broadcastEntityNotes(c.env, note.kind, note.entityId, user.id);
  return c.json({ notes });
});

// ============================================================================
// Tab 3: Bestiary (Role-masked read, CR sorting, DM CRUD + dnd.su compendium)
// ============================================================================

app.get('/bestiary', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Необходима авторизация' }, 401);

  const creatures = await listBestiary(c.env.DB, user.role);
  return c.json({ creatures });
});

app.get('/bestiary/:id', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Необходима авторизация' }, 401);

  const id = parsePositiveInt(c.req.param('id'));
  if (!id) return c.json({ error: 'Некорректный id существа' }, 400);

  const creature = await getBestiaryCreature(c.env.DB, id, user.role);
  if (!creature) return c.json({ error: 'Существо не найдено' }, 404);

  return c.json({ creature });
});

/**
 * Bestiary artwork proxy: dnd.su blocks nothing but its files are third-party,
 * so we stream them through the Worker and cache them at the edge forever.
 * Same-origin images also survive strict referrer policies in the browser.
 */
const DNDSU_ART_FILE_RE = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,180}\.(?:jpe?g|png|webp|gif)$/i;

app.get('/media/dndsu/:file', async (c) => {
  const file = c.req.param('file');
  if (!DNDSU_ART_FILE_RE.test(file)) {
    return c.json({ error: 'Некорректное имя файла' }, 400);
  }

  const cache = typeof caches !== 'undefined' ? caches.default : null;
  const cacheKey = new Request(c.req.url, { method: 'GET' });
  if (cache) {
    const hit = await cache.match(cacheKey);
    if (hit) return hit;
  }

  let upstream: Response;
  try {
    upstream = await fetch(`https://dnd.su/gallery/bestiary/${file}`, {
      headers: {
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        Referer: 'https://dnd.su/',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
      },
    });
  } catch {
    return c.json({ error: 'Источник картинки недоступен' }, 502);
  }

  const contentType = upstream.headers.get('Content-Type') || '';
  if (!upstream.ok || !upstream.body || !contentType.startsWith('image/')) {
    return c.json({ error: 'Картинка не найдена' }, 404);
  }

  const response = new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
      'Access-Control-Allow-Origin': '*',
    },
  });

  if (cache) {
    c.executionCtx.waitUntil(cache.put(cacheKey, response.clone()));
  }
  return response;
});

app.get('/dm/bestiary/import-status', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Необходима авторизация' }, 401);
  if (user.role !== 'dm') return c.json({ error: 'Недостаточно прав' }, 403);

  const status = await getBestiaryImportStatus(c.env.DB);
  return c.json({ status });
});

app.post('/dm/bestiary/import', async (c) => {
  const user = c.get('user')!;
  if (user.role !== 'dm') return c.json({ error: 'Недостаточно прав' }, 403);

  const body = await c.req
    .json<{ items?: CompendiumCreatureInput[] }>()
    .catch((): { items?: CompendiumCreatureInput[] } => ({}));
  const items = Array.isArray(body.items) ? body.items : [];

  if (!items.length) return c.json({ error: 'Пустой список существ' }, 400);
  if (items.length > 250) {
    return c.json({ error: 'Слишком большой пакет — импортируйте частями' }, 400);
  }

  // Everything lands hidden: the DM reveals monsters one by one
  const imported = await upsertCompendiumCreatures(
    c.env.DB,
    items.filter((item) => item && typeof item.importKey === 'string' && item.importKey)
  );

  // Hidden monsters are invisible to players, so no table-wide invalidation is
  // needed here — the importing DM refreshes their own list when done.
  const status = await getBestiaryImportStatus(c.env.DB);
  return c.json({ imported, status });
});

app.patch('/dm/bestiary/:id/reveal', async (c) => {
  const user = c.get('user')!;
  const id = parsePositiveInt(c.req.param('id'));
  if (!id) return c.json({ error: 'Некорректный id существа' }, 400);

  const body = await c.req
    .json<{ isRevealed?: boolean }>()
    .catch((): { isRevealed?: boolean } => ({}));

  const existing = await c.env.DB.prepare(`SELECT id FROM bestiary WHERE id = ?`)
    .bind(id)
    .first<{ id: number }>();
  if (!existing) return c.json({ error: 'Существо не найдено' }, 404);

  const revealed = body.isRevealed ? 1 : 0;
  await c.env.DB.prepare(`UPDATE bestiary SET is_revealed = ? WHERE id = ?`)
    .bind(revealed, id)
    .run();

  await broadcastCampaignEvent(c.env, 'bestiary:updated', { updatedAt: Date.now() }, user.id);
  return c.json({ id, isRevealed: Boolean(revealed) });
});

app.post('/dm/bestiary', async (c) => {
  const user = c.get('user')!;
  if (user.role !== 'dm') return c.json({ error: 'Недостаточно прав' }, 403);
  const body = await c.req.json<{
    name: string;
    cr: string;
    creatureType?: string;
    size?: string;
    alignment?: string;
    ac?: number;
    hp?: string;
    xp?: number;
    description?: string;
    imageKey?: string | null;
    isRevealed?: boolean;
    sortOrder?: number;
  }>();

  if (!body.name?.trim()) {
    return c.json({ error: 'Укажите имя существа' }, 400);
  }

  const crStr = (body.cr || '1').trim();
  const crNumeric = parseCrToNumeric(crStr);

  await c.env.DB.prepare(
    `INSERT INTO bestiary
       (name, cr, cr_numeric, creature_type, size, alignment, ac, hp, xp, description, image_key,
        is_revealed, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      body.name.trim(),
      crStr,
      crNumeric,
      (body.creatureType || 'Чудовище').trim(),
      (body.size || '').trim(),
      (body.alignment || '').trim(),
      Math.max(1, Math.trunc(body.ac ?? 13)),
      (body.hp || '27 (5d8 + 5)').trim(),
      Math.max(0, Math.trunc(body.xp ?? 0)),
      (body.description || '').trim(),
      body.imageKey || null,
      body.isRevealed ? 1 : 0,
      Math.trunc(body.sortOrder ?? 0)
    )
    .run();

  // Send invalidation signal without unmasked spoilers so players re-fetch masked view
  await broadcastCampaignEvent(c.env, 'bestiary:updated', { updatedAt: Date.now() }, user.id);
  return c.json({ ok: true });
});

app.put('/dm/bestiary/:id', async (c) => {
  const user = c.get('user')!;
  const id = parsePositiveInt(c.req.param('id'));
  if (!id) return c.json({ error: 'Некорректный id существа' }, 400);
  const body = await c.req.json<{
    name: string;
    cr: string;
    creatureType?: string;
    size?: string;
    alignment?: string;
    ac?: number;
    hp?: string;
    xp?: number;
    description?: string;
    imageKey?: string | null;
    isRevealed?: boolean;
    sortOrder?: number;
  }>();

  if (!body.name?.trim()) {
    return c.json({ error: 'Укажите имя существа' }, 400);
  }

  const crStr = (body.cr || '1').trim();
  const crNumeric = parseCrToNumeric(crStr);

  await c.env.DB.prepare(
    `UPDATE bestiary
     SET name = ?,
         cr = ?,
         cr_numeric = ?,
         creature_type = ?,
         size = ?,
         alignment = ?,
         ac = ?,
         hp = ?,
         xp = ?,
         description = ?,
         image_key = ?,
         is_revealed = ?,
         sort_order = ?
     WHERE id = ?`
  )
    .bind(
      body.name.trim(),
      crStr,
      crNumeric,
      (body.creatureType || 'Чудовище').trim(),
      (body.size || '').trim(),
      (body.alignment || '').trim(),
      Math.max(1, Math.trunc(body.ac ?? 13)),
      (body.hp || '27 (5d8 + 5)').trim(),
      Math.max(0, Math.trunc(body.xp ?? 0)),
      (body.description || '').trim(),
      body.imageKey || null,
      body.isRevealed ? 1 : 0,
      Math.trunc(body.sortOrder ?? 0),
      id
    )
    .run();

  await broadcastCampaignEvent(c.env, 'bestiary:updated', { updatedAt: Date.now() }, user.id);
  return c.json({ ok: true });
});

app.delete('/dm/bestiary/:id', async (c) => {
  const user = c.get('user')!;
  const id = parsePositiveInt(c.req.param('id'));
  if (!id) return c.json({ error: 'Некорректный id существа' }, 400);
  await c.env.DB.batch([
    c.env.DB.prepare(
      `DELETE FROM entity_notes WHERE entity_type = 'creature' AND entity_id = ?`
    ).bind(id),
    c.env.DB.prepare(`DELETE FROM bestiary WHERE id = ?`).bind(id),
  ]);

  await broadcastCampaignEvent(c.env, 'bestiary:updated', { updatedAt: Date.now() }, user.id);
  return c.json({ ok: true });
});

// ============================================================================
// Connections tab: campaign NPCs (players see revealed contacts only)
// ============================================================================

const NPC_TEXT_LIMIT = 4000;

interface NpcMutationBody {
  name?: string;
  role?: string;
  faction?: string;
  location?: string;
  attitude?: string;
  description?: string;
  secretNotes?: string;
  imageKey?: string | null;
  isRevealed?: boolean;
  sortOrder?: number;
  /** Боевой лист: АС, HP, характеристики, атаки (только мастер) */
  sheet?: unknown;
}

function normalizeNpcBody(body: NpcMutationBody) {
  return {
    name: (body.name || '').trim().slice(0, 80),
    role: (body.role || '').trim().slice(0, 80),
    faction: (body.faction || '').trim().slice(0, 80),
    location: (body.location || '').trim().slice(0, 80),
    attitude: normalizeNpcAttitude(body.attitude),
    description: (body.description || '').trim().slice(0, NPC_TEXT_LIMIT),
    secretNotes: (body.secretNotes || '').trim().slice(0, NPC_TEXT_LIMIT),
    imageKey: body.imageKey || null,
    isRevealed: Boolean(body.isRevealed),
    sortOrder: Math.trunc(body.sortOrder ?? 0),
    // sheet не передан вовсе (например, старый клиент или reveal) — лист не трогаем
    sheetJson: body.sheet === undefined ? null : serializeNpcSheet(normalizeNpcSheet(body.sheet)),
  };
}

async function broadcastNpcUpdate(env: Env, senderId?: number): Promise<void> {
  // Invalidation only — the masked list is re-fetched per role so secrets never leak
  await broadcastCampaignEvent(env, 'npcs:updated', { updatedAt: Date.now() }, senderId);
}

app.get('/npcs', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Необходима авторизация' }, 401);

  const npcs = await listNpcs(c.env.DB, user.role);
  return c.json({ npcs });
});

app.post('/dm/npcs', async (c) => {
  const user = c.get('user')!;
  const body = await c.req
    .json<NpcMutationBody>()
    .catch((): NpcMutationBody => ({}));
  const npc = normalizeNpcBody(body);

  if (!npc.name) return c.json({ error: 'Укажите имя NPC' }, 400);

  await c.env.DB.prepare(
    `INSERT INTO campaign_npcs
       (name, role, faction, location, attitude, description, secret_notes, image_key, is_revealed, sort_order, sheet_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
  )
    .bind(
      npc.name,
      npc.role,
      npc.faction,
      npc.location,
      npc.attitude,
      npc.description,
      npc.secretNotes,
      npc.imageKey,
      npc.isRevealed ? 1 : 0,
      npc.sortOrder,
      npc.sheetJson ?? '{}'
    )
    .run();

  await broadcastNpcUpdate(c.env, user.id);
  const npcs = await listNpcs(c.env.DB, 'dm');
  return c.json({ npcs });
});

app.put('/dm/npcs/:id', async (c) => {
  const user = c.get('user')!;
  const id = Number.parseInt(c.req.param('id'), 10);
  if (!Number.isFinite(id) || id <= 0) return c.json({ error: 'Некорректный id NPC' }, 400);
  if (!(await getNpcById(c.env.DB, id))) return c.json({ error: 'NPC не найден' }, 404);

  const body = await c.req
    .json<NpcMutationBody>()
    .catch((): NpcMutationBody => ({}));
  const npc = normalizeNpcBody(body);
  if (!npc.name) return c.json({ error: 'Укажите имя NPC' }, 400);

  await c.env.DB.prepare(
    `UPDATE campaign_npcs
     SET name = ?, role = ?, faction = ?, location = ?, attitude = ?,
         description = ?, secret_notes = ?, image_key = ?, is_revealed = ?,
         sort_order = ?, sheet_json = COALESCE(?, sheet_json), updated_at = datetime('now')
     WHERE id = ?`
  )
    .bind(
      npc.name,
      npc.role,
      npc.faction,
      npc.location,
      npc.attitude,
      npc.description,
      npc.secretNotes,
      npc.imageKey,
      npc.isRevealed ? 1 : 0,
      npc.sortOrder,
      npc.sheetJson,
      id
    )
    .run();

  await broadcastNpcUpdate(c.env, user.id);
  const npcs = await listNpcs(c.env.DB, 'dm');
  return c.json({ npcs });
});

/**
 * Сохранить только боевой лист НПС — из карточки «Связей» или прямо из трекера
 * боя, где мастер правит статы на ходу.
 */
app.patch('/dm/npcs/:id/sheet', async (c) => {
  const user = c.get('user')!;
  const id = Number.parseInt(c.req.param('id'), 10);
  if (!Number.isFinite(id) || id <= 0) return c.json({ error: 'Некорректный id NPC' }, 400);
  if (!(await getNpcById(c.env.DB, id))) return c.json({ error: 'NPC не найден' }, 404);

  const body = await c.req
    .json<{ sheet?: unknown }>()
    .catch((): { sheet?: unknown } => ({}));
  const sheetJson = serializeNpcSheet(normalizeNpcSheet(body.sheet));

  await c.env.DB.prepare(
    `UPDATE campaign_npcs SET sheet_json = ?, updated_at = datetime('now') WHERE id = ?`
  )
    .bind(sheetJson, id)
    .run();

  await broadcastNpcUpdate(c.env, user.id);
  const npcs = await listNpcs(c.env.DB, 'dm');
  return c.json({ npcs });
});

// One-tap reveal / hide from the connections grid
app.patch('/dm/npcs/:id/reveal', async (c) => {
  const user = c.get('user')!;
  const id = Number.parseInt(c.req.param('id'), 10);
  if (!Number.isFinite(id) || id <= 0) return c.json({ error: 'Некорректный id NPC' }, 400);

  const existing = await getNpcById(c.env.DB, id);
  if (!existing) return c.json({ error: 'NPC не найден' }, 404);

  const body = await c.req
    .json<{ isRevealed?: boolean }>()
    .catch((): { isRevealed?: boolean } => ({}));
  const isRevealed =
    body.isRevealed === undefined ? !existing.isRevealed : Boolean(body.isRevealed);

  await c.env.DB.prepare(
    `UPDATE campaign_npcs SET is_revealed = ?, updated_at = datetime('now') WHERE id = ?`
  )
    .bind(isRevealed ? 1 : 0, id)
    .run();

  await broadcastNpcUpdate(c.env, user.id);
  const npcs = await listNpcs(c.env.DB, 'dm');
  return c.json({ npcs });
});

app.delete('/dm/npcs/:id', async (c) => {
  const user = c.get('user')!;
  const id = Number.parseInt(c.req.param('id'), 10);
  if (!Number.isFinite(id) || id <= 0) return c.json({ error: 'Некорректный id NPC' }, 400);

  await c.env.DB.batch([
    c.env.DB.prepare(`DELETE FROM entity_notes WHERE entity_type = 'npc' AND entity_id = ?`).bind(id),
    c.env.DB.prepare(`DELETE FROM campaign_npcs WHERE id = ?`).bind(id),
  ]);
  await broadcastNpcUpdate(c.env, user.id);
  const npcs = await listNpcs(c.env.DB, 'dm');
  return c.json({ npcs });
});

// ============================================================================
// Tab 4: Spells Catalog (dnd.su Official + Homebrew Static Assets + Custom DM Spells)
// ============================================================================

let dndsuCatalogCache: Map<number, Spell> | null = null;

function stripHtmlForPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|li|tr|h2|h3|h4|blockquote|div)>/gi, '\n')
    .replace(/<td[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&laquo;/g, '«')
    .replace(/&raquo;/g, '»')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function resolveDndsuSpellFromAssets(
  env: Env,
  requestUrl: string,
  spellId: number
): Promise<Spell | null> {
  if (dndsuCatalogCache) {
    return dndsuCatalogCache.get(spellId) ?? null;
  }
  if (!env.ASSETS) {
    return null;
  }
  try {
    const origin = new URL(requestUrl).origin;
    const [offRes, hbRes] = await Promise.all([
      env.ASSETS.fetch(new Request(`${origin}/data/dndsu-spells-official.json`)),
      env.ASSETS.fetch(new Request(`${origin}/data/dndsu-spells-homebrew.json`)),
    ]);
    if (!offRes.ok || !hbRes.ok) return null;
    const [offJson, hbJson] = (await Promise.all([offRes.json(), hbRes.json()])) as [
      Array<Spell>,
      Array<Spell>,
    ];
    const map = new Map<number, Spell>();
    for (const sp of [...offJson, ...hbJson]) {
      const descHtml = sp.descriptionHtml || '';
      map.set(sp.id, {
        ...sp,
        description: sp.description || stripHtmlForPlainText(descHtml),
        createdBy: null,
      });
    }
    dndsuCatalogCache = map;
    return map.get(spellId) ?? null;
  } catch {
    return null;
  }
}

app.get('/spells', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Необходима авторизация' }, 401);

  const spells = await listSpells(c.env.DB);
  let learnedSpellIds: number[] = [];
  if (user.role === 'player' && user.playerId) {
    const learned = await listLearnedSpellsForPlayer(c.env.DB, user.playerId);
    learnedSpellIds = learned.map((l) => l.spellId);
  }
  return c.json({ spells, learnedSpellIds });
});

app.post('/spells/:id/learn', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Необходима авторизация' }, 401);
  if (user.role !== 'player' || !user.playerId) {
    return c.json({ error: 'Только игрок может изучать заклинания через эту кнопку (Мастер использует панель выдачи ниже)' }, 403);
  }

  const spellId = Number.parseInt(c.req.param('id'), 10);
  if (!Number.isFinite(spellId) || spellId <= 0) {
    return c.json({ error: 'Некорректный идентификатор заклинания' }, 400);
  }

  const body = await c.req
    .json<{
      spell?: Spell;
      castMode?: SpellCastMode;
      castMaxUses?: number;
      castNote?: string;
    }>()
    .catch((): {
      spell?: Spell;
      castMode?: SpellCastMode;
      castMaxUses?: number;
      castNote?: string;
    } => ({}));

  let catalogSpell = await resolveDndsuSpellFromAssets(c.env, c.req.url, spellId);
  if (!catalogSpell && body.spell && body.spell.id === spellId && body.spell.name) {
    catalogSpell = body.spell;
  }

  const res = await learnSpellForPlayer(c.env.DB, user.playerId, spellId, catalogSpell, {
    castMode: body.castMode,
    castMaxUses: body.castMaxUses,
    castNote: body.castNote,
  });
  if (!res.ok) {
    return c.json({ error: res.error }, 400);
  }

  const learnedSpells = await listLearnedSpellsForPlayer(c.env.DB, user.playerId);
  await broadcastCampaignEvent(
    c.env,
    'learned_spells:updated',
    { playerId: user.playerId, learnedSpells },
    user.id
  );
  return c.json({ learnedSpells });
});

app.put('/spells/:id/learn-meta', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Необходима авторизация' }, 401);

  const spellId = Number.parseInt(c.req.param('id'), 10);
  if (!Number.isFinite(spellId) || spellId <= 0) {
    return c.json({ error: 'Некорректный идентификатор заклинания' }, 400);
  }

  const body = await c.req.json<{
    playerId?: number;
    castMode?: SpellCastMode;
    castMaxUses?: number;
    castNote?: string;
  }>();

  const targetPlayerId: PlayerId | null =
    user.role === 'dm'
      ? parseValidPlayerId(String(body.playerId ?? ''))
      : user.playerId;

  if (!targetPlayerId) {
    return c.json({ error: 'Не указан корректный игрок (1, 2 или 3)' }, 400);
  }

  const updated = await updateLearnedSpellMeta(c.env.DB, targetPlayerId, spellId, {
    castMode: body.castMode,
    castMaxUses: body.castMaxUses,
    castNote: body.castNote,
  });
  if (!updated) {
    return c.json({ error: 'Заклинание ещё не изучено этим персонажем' }, 404);
  }

  const learnedSpells = await listLearnedSpellsForPlayer(c.env.DB, targetPlayerId);
  await broadcastCampaignEvent(
    c.env,
    'learned_spells:updated',
    { playerId: targetPlayerId, learnedSpells },
    user.id
  );
  return c.json({ learnedSpells });
});

app.delete('/spells/:id/learn', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Необходима авторизация' }, 401);
  if (user.role !== 'player' || !user.playerId) {
    return c.json({ error: 'Только игрок может управлять своими изученными заклинаниями' }, 403);
  }

  const spellId = Number.parseInt(c.req.param('id'), 10);
  await unlearnSpellForPlayer(c.env.DB, user.playerId, spellId);

  const learnedSpells = await listLearnedSpellsForPlayer(c.env.DB, user.playerId);
  await broadcastCampaignEvent(
    c.env,
    'learned_spells:updated',
    { playerId: user.playerId, learnedSpells },
    user.id
  );
  return c.json({ learnedSpells });
});

app.post('/dm/players/:playerId/spells/:spellId/learn', async (c) => {
  const dmUser = c.get('user')!;
  const playerId = parseValidPlayerId(c.req.param('playerId'));
  if (!playerId) return c.json({ error: 'Некорректный playerId (ожидается 1, 2 или 3)' }, 400);

  const spellId = Number.parseInt(c.req.param('spellId'), 10);
  if (!Number.isFinite(spellId) || spellId <= 0) {
    return c.json({ error: 'Некорректный идентификатор заклинания' }, 400);
  }

  const body = await c.req
    .json<{
      spell?: Spell;
      bypassLimit?: boolean;
      castMode?: SpellCastMode;
      castMaxUses?: number;
      castNote?: string;
    }>()
    .catch((): {
      spell?: Spell;
      bypassLimit?: boolean;
      castMode?: SpellCastMode;
      castMaxUses?: number;
      castNote?: string;
    } => ({}));

  let catalogSpell = await resolveDndsuSpellFromAssets(c.env, c.req.url, spellId);
  if (!catalogSpell && body.spell && body.spell.id === spellId && body.spell.name) {
    catalogSpell = body.spell;
  }

  const res = await learnSpellForPlayer(c.env.DB, playerId, spellId, catalogSpell, {
    bypassClassCheck: true,
    bypassLimitCheck: body.bypassLimit !== false,
    castMode: body.castMode,
    castMaxUses: body.castMaxUses,
    castNote: body.castNote,
    grantedByDm: true,
  });
  if (!res.ok) {
    return c.json({ error: res.error }, 400);
  }

  const learnedSpells = await listLearnedSpellsForPlayer(c.env.DB, playerId);
  await broadcastCampaignEvent(
    c.env,
    'learned_spells:updated',
    { playerId, learnedSpells },
    dmUser.id
  );
  return c.json({ learnedSpells });
});

app.delete('/dm/players/:playerId/spells/:spellId/learn', async (c) => {
  const dmUser = c.get('user')!;
  const playerId = parseValidPlayerId(c.req.param('playerId'));
  if (!playerId) return c.json({ error: 'Некорректный playerId' }, 400);

  const spellId = Number.parseInt(c.req.param('spellId'), 10);
  await unlearnSpellForPlayer(c.env.DB, playerId, spellId);

  const learnedSpells = await listLearnedSpellsForPlayer(c.env.DB, playerId);
  await broadcastCampaignEvent(
    c.env,
    'learned_spells:updated',
    { playerId, learnedSpells },
    dmUser.id
  );
  return c.json({ learnedSpells });
});

app.post('/dm/spells', async (c) => {
  const user = c.get('user')!;
  const body = await c.req.json<{
    name: string;
    nameEn?: string;
    level: number;
    school: string;
    classes: string[] | string;
    subclasses?: string;
    castingTime?: string;
    spellRange?: string;
    components?: string;
    ritual?: boolean;
    concentration?: boolean;
    duration?: string;
    description: string;
    source?: string;
    isHomebrew?: boolean;
  }>();

  if (!body.name?.trim() || !body.description?.trim()) {
    return c.json({ error: 'Укажите название и описание заклинания' }, 400);
  }

  const classesCsv = Array.isArray(body.classes)
    ? body.classes.map((cl) => cl.trim()).filter(Boolean).join(',')
    : (body.classes || 'волшебник').trim();

  const level = Math.min(9, Math.max(0, Math.trunc(body.level ?? 0)));
  const customId = await nextCustomSpellId(c.env.DB);
  const school = (body.school || 'Воплощение').trim();
  const ritual = Boolean(body.ritual);
  const concentration = Boolean(body.concentration);
  const compStr = (body.components || 'В, С').trim();
  const hasV = /(^|[\s,])В([\s,(]|$)/i.test(compStr);
  const hasS = /(^|[\s,])С([\s,(]|$)/i.test(compStr);
  const hasM = /(^|[\s,])М([\s,(]|$)/i.test(compStr);
  const componentsBadge = `${hasV ? 'В' : '.'}${hasS ? 'С' : '.'}${hasM ? 'М' : '.'}`;
  const typeLine = `${level === 0 ? 'Заговор' : `${level} уровень`}, ${school.toLowerCase()}${
    ritual ? ' (ритуал)' : ''
  }`;

  await c.env.DB.prepare(
    `INSERT INTO spells (
       id, name, name_en, level, school, type_line, classes, subclasses,
       casting_time, spell_range, components, components_badge, ritual, concentration,
       duration, description, source, is_homebrew, created_by
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      customId,
      body.name.trim(),
      (body.nameEn || '').trim(),
      level,
      school,
      typeLine,
      classesCsv,
      (body.subclasses || '').trim(),
      (body.castingTime || '1 действие').trim(),
      (body.spellRange || '60 футов').trim(),
      compStr,
      componentsBadge,
      ritual ? 1 : 0,
      concentration ? 1 : 0,
      (body.duration || 'Мгновенная').trim(),
      body.description.trim(),
      (body.source || (body.isHomebrew !== false ? 'HB' : 'PH14')).trim(),
      body.isHomebrew !== false ? 1 : 0,
      user.id
    )
    .run();

  const spells = await listSpells(c.env.DB);
  await broadcastCampaignEvent(c.env, 'spells:updated', { spells }, user.id);
  return c.json({ spells });
});

app.post('/dm/spells/import', async (c) => {
  const user = c.get('user')!;
  const body = await c.req
    .json<{ spells?: Array<Record<string, unknown>> }>()
    .catch((): { spells?: Array<Record<string, unknown>> } => ({}));
  const items: Array<Record<string, unknown>> = Array.isArray(body.spells) ? body.spells : [];
  if (items.length === 0) {
    return c.json({ error: 'Передайте непустой массив заклинаний в формате JSON' }, 400);
  }

  let nextId = await nextCustomSpellId(c.env.DB);
  const stmt = c.env.DB.prepare(
    `INSERT INTO spells (id, name, name_en, level, school, classes, casting_time, spell_range, components, duration, description, source, is_homebrew, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const batch = items.slice(0, 100).map((raw) => {
    const id = nextId++;
    const name = String(raw.name || 'Заклинание без названия').trim();
    const nameEn = String(raw.nameEn || raw.name_en || '').trim();
    const level = Math.min(
      9,
      Math.max(0, Number.parseInt(String(raw.level_int ?? raw.level ?? 0), 10) || 0)
    );
    const school = String(raw.school || 'Воплощение').trim();
    const classes = Array.isArray(raw.classes)
      ? raw.classes.join(',')
      : String(raw.dnd_class || raw.classes || 'волшебник').replace(/\s*,\s*/g, ',');
    const castingTime = String(raw.casting_time || raw.castingTime || '1 действие');
    const spellRange = String(raw.range || raw.spellRange || '60 футов');
    const components = String(raw.components || 'В, С');
    const duration = String(raw.duration || 'Мгновенная');
    const description = String(raw.desc || raw.description || '');
    const source = String(raw.document__title || raw.source || 'HB');
    const isHomebrew = raw.isHomebrew !== false ? 1 : 0;
    return stmt.bind(
      id,
      name,
      nameEn,
      level,
      school,
      classes,
      castingTime,
      spellRange,
      components,
      duration,
      description,
      source,
      isHomebrew,
      user.id
    );
  });

  await c.env.DB.batch(batch);
  const spells = await listSpells(c.env.DB);
  await broadcastCampaignEvent(c.env, 'spells:updated', { spells }, user.id);
  return c.json({ imported: batch.length, spells });
});

app.put('/dm/spells/:id', async (c) => {
  const user = c.get('user')!;
  const id = Number.parseInt(c.req.param('id'), 10);
  const body = await c.req.json<{
    name: string;
    level: number;
    school: string;
    classes: string[] | string;
    castingTime?: string;
    spellRange?: string;
    components?: string;
    duration?: string;
    description: string;
    source?: string;
    isHomebrew?: boolean;
  }>();

  const classesCsv = Array.isArray(body.classes)
    ? body.classes.map((cl) => cl.trim()).filter(Boolean).join(',')
    : (body.classes || 'Wizard').trim();

  await c.env.DB.prepare(
    `UPDATE spells
     SET name = ?,
         level = ?,
         school = ?,
         classes = ?,
         casting_time = ?,
         spell_range = ?,
         components = ?,
         duration = ?,
         description = ?,
         source = ?,
         is_homebrew = ?
     WHERE id = ?`
  )
    .bind(
      body.name.trim(),
      Math.min(9, Math.max(0, Math.trunc(body.level ?? 0))),
      (body.school || 'Evocation').trim(),
      classesCsv,
      (body.castingTime || '1 действие').trim(),
      (body.spellRange || '60 футов').trim(),
      (body.components || 'В, С').trim(),
      (body.duration || 'Мгновенная').trim(),
      body.description.trim(),
      (body.source || 'SRD 5.1').trim(),
      body.isHomebrew ? 1 : 0,
      id
    )
    .run();

  const spells = await listSpells(c.env.DB);
  await broadcastCampaignEvent(c.env, 'spells:updated', { spells }, user.id);
  return c.json({ spells });
});

app.delete('/dm/spells/:id', async (c) => {
  const user = c.get('user')!;
  const id = Number.parseInt(c.req.param('id'), 10);
  await c.env.DB.prepare(`DELETE FROM spells WHERE id = ?`).bind(id).run();

  const spells = await listSpells(c.env.DB);
  await broadcastCampaignEvent(c.env, 'spells:updated', { spells }, user.id);
  return c.json({ spells });
});

// ============================================================================
// Tab 5: Talent Tree & Shared Party Inspiration Pool
// ============================================================================

app.get('/talents', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Необходима авторизация' }, 401);

  const state = await getTalentsState(c.env.DB, getCampaignId(c.env));
  return c.json(state);
});

app.post('/talents/:id/purchase', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Необходима авторизация' }, 401);

  const talentId = Number.parseInt(c.req.param('id'), 10);
  const campaignId = getCampaignId(c.env);
  const res = await unlockTalentForParty(c.env.DB, campaignId, talentId);
  if (!res.ok) {
    return c.json({ error: res.error }, 400);
  }

  const state = await getTalentsState(c.env.DB, campaignId);
  await broadcastCampaignEvent(c.env, 'talents:updated', state, user.id);
  return c.json(state);
});

app.post('/dm/inspiration', async (c) => {
  const user = c.get('user')!;
  const campaignId = getCampaignId(c.env);
  const body = await c.req.json<{ delta?: number; setPoints?: number }>();

  await c.env.DB.prepare(
    `INSERT OR IGNORE INTO inspiration_pool (campaign_id, points) VALUES (?, 0)`
  )
    .bind(campaignId)
    .run();

  if (typeof body.setPoints === 'number') {
    await c.env.DB.prepare(`UPDATE inspiration_pool SET points = ? WHERE campaign_id = ?`)
      .bind(Math.max(0, Math.trunc(body.setPoints)), campaignId)
      .run();
  } else if (typeof body.delta === 'number') {
    await c.env.DB.prepare(
      `UPDATE inspiration_pool SET points = MAX(0, points + ?) WHERE campaign_id = ?`
    )
      .bind(Math.trunc(body.delta), campaignId)
      .run();
  }

  const state = await getTalentsState(c.env.DB, campaignId);
  await broadcastCampaignEvent(
    c.env,
    'inspiration:updated',
    { inspirationPoints: state.inspirationPoints },
    user.id
  );
  return c.json(state);
});

interface TalentMutationBody {
  title: string;
  description: string;
  imageKey?: string | null;
  cost?: number;
  positionX?: number;
  positionY?: number;
  parentId?: number | null;
  tileAccent?: string | null;
  tileEmblem?: string | null;
  tilePattern?: string | null;
  isFeatured?: boolean;
}

function normalizeTalentTileStyle(body: TalentMutationBody): {
  accent: string | null;
  emblem: string | null;
  pattern: string;
  isFeatured: boolean;
} {
  return {
    accent: normalizeQuestAccent(body.tileAccent),
    emblem: isHudAssetKey(body.tileEmblem) ? (body.tileEmblem as string) : null,
    pattern: normalizeQuestPattern(body.tilePattern),
    isFeatured: Boolean(body.isFeatured),
  };
}

app.post('/dm/talents', async (c) => {
  const user = c.get('user')!;
  const campaignId = getCampaignId(c.env);
  const body = await c.req.json<TalentMutationBody>();

  if (!body.title?.trim()) {
    return c.json({ error: 'Укажите название таланта' }, 400);
  }

  const tile = normalizeTalentTileStyle(body);

  await c.env.DB.prepare(
    `INSERT INTO talent_tree (title, description, image_key, cost, position_x, position_y, parent_id, is_unlocked, tile_accent, tile_emblem, tile_pattern, is_featured)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`
  )
    .bind(
      body.title.trim(),
      (body.description || '').trim(),
      body.imageKey || null,
      Math.max(0, Math.trunc(body.cost ?? 1)),
      Math.max(16, Math.trunc(body.positionX ?? 80)),
      Math.max(16, Math.trunc(body.positionY ?? 80)),
      body.parentId || null,
      tile.accent,
      tile.emblem,
      tile.pattern,
      tile.isFeatured ? 1 : 0
    )
    .run();

  const state = await getTalentsState(c.env.DB, campaignId);
  await broadcastCampaignEvent(c.env, 'talents:updated', state, user.id);
  return c.json(state);
});

app.put('/dm/talents/:id', async (c) => {
  const user = c.get('user')!;
  const id = Number.parseInt(c.req.param('id'), 10);
  const campaignId = getCampaignId(c.env);
  const body = await c.req.json<TalentMutationBody>();

  const safeParentId = body.parentId && body.parentId !== id ? body.parentId : null;
  const tile = normalizeTalentTileStyle(body);

  await c.env.DB.prepare(
    `UPDATE talent_tree
     SET title = ?,
         description = ?,
         image_key = ?,
         cost = ?,
         position_x = COALESCE(?, position_x),
         position_y = COALESCE(?, position_y),
         parent_id = ?,
         tile_accent = ?,
         tile_emblem = ?,
         tile_pattern = ?,
         is_featured = ?
     WHERE id = ?`
  )
    .bind(
      body.title.trim(),
      (body.description || '').trim(),
      body.imageKey || null,
      Math.max(0, Math.trunc(body.cost ?? 1)),
      typeof body.positionX === 'number' ? Math.max(16, Math.trunc(body.positionX)) : null,
      typeof body.positionY === 'number' ? Math.max(16, Math.trunc(body.positionY)) : null,
      safeParentId,
      tile.accent,
      tile.emblem,
      tile.pattern,
      tile.isFeatured ? 1 : 0,
      id
    )
    .run();

  const state = await getTalentsState(c.env.DB, campaignId);
  await broadcastCampaignEvent(c.env, 'talents:updated', state, user.id);
  return c.json(state);
});

app.patch('/dm/talents/:id/position', async (c) => {
  const user = c.get('user')!;
  const id = Number.parseInt(c.req.param('id'), 10);
  const campaignId = getCampaignId(c.env);
  const body = await c.req.json<{ positionX: number; positionY: number }>();

  const px = Math.max(16, Math.min(4000, Math.round(body.positionX)));
  const py = Math.max(16, Math.min(3000, Math.round(body.positionY)));

  await c.env.DB.prepare(
    `UPDATE talent_tree SET position_x = ?, position_y = ? WHERE id = ?`
  )
    .bind(px, py, id)
    .run();

  const state = await getTalentsState(c.env.DB, campaignId);
  await broadcastCampaignEvent(c.env, 'talents:updated', state, user.id);
  return c.json(state);
});

// Quick talent tile styling: feature/unfeature or recolor a node without the full form.
app.patch('/dm/talents/:id/tile', async (c) => {
  const user = c.get('user')!;
  const id = Number.parseInt(c.req.param('id'), 10);
  const campaignId = getCampaignId(c.env);
  if (!Number.isFinite(id) || id <= 0) {
    return c.json({ error: 'Некорректный id таланта' }, 400);
  }

  type TalentTilePatch = {
    accent?: string | null;
    emblem?: string | null;
    pattern?: string | null;
    isFeatured?: boolean;
  };

  const body = await c.req
    .json<TalentTilePatch>()
    .catch((): TalentTilePatch => ({}));

  const current = await c.env.DB.prepare(
    `SELECT tile_accent, tile_emblem, tile_pattern, is_featured FROM talent_tree WHERE id = ?`
  )
    .bind(id)
    .first<{
      tile_accent: string | null;
      tile_emblem: string | null;
      tile_pattern: string | null;
      is_featured: number;
    }>();

  if (!current) return c.json({ error: 'Талант не найден' }, 404);

  const accent =
    body.accent === undefined ? current.tile_accent : normalizeQuestAccent(body.accent);
  const emblem =
    body.emblem === undefined
      ? current.tile_emblem
      : isHudAssetKey(body.emblem)
        ? (body.emblem as string)
        : null;
  const pattern =
    body.pattern === undefined
      ? current.tile_pattern || 'none'
      : normalizeQuestPattern(body.pattern);
  const isFeatured =
    body.isFeatured === undefined ? Boolean(current.is_featured) : Boolean(body.isFeatured);

  await c.env.DB.prepare(
    `UPDATE talent_tree
     SET tile_accent = ?, tile_emblem = ?, tile_pattern = ?, is_featured = ?
     WHERE id = ?`
  )
    .bind(accent, emblem, pattern, isFeatured ? 1 : 0, id)
    .run();

  const state = await getTalentsState(c.env.DB, campaignId);
  await broadcastCampaignEvent(c.env, 'talents:updated', state, user.id);
  return c.json(state);
});

app.post('/dm/talents/:id/toggle-unlock', async (c) => {
  const user = c.get('user')!;
  const id = Number.parseInt(c.req.param('id'), 10);
  const campaignId = getCampaignId(c.env);

  await c.env.DB.prepare(
    `UPDATE talent_tree
     SET is_unlocked = CASE WHEN COALESCE(is_unlocked, 0) = 1 THEN 0 ELSE 1 END,
         unlocked_at = CASE WHEN COALESCE(is_unlocked, 0) = 1 THEN NULL ELSE datetime('now') END
     WHERE id = ?`
  )
    .bind(id)
    .run();

  const state = await getTalentsState(c.env.DB, campaignId);
  await broadcastCampaignEvent(c.env, 'talents:updated', state, user.id);
  return c.json(state);
});

app.delete('/dm/rolls', async (c) => {
  const user = c.get('user')!;
  await c.env.DB.prepare(`DELETE FROM roll_log`).run();
  await broadcastCampaignEvent(c.env, 'rolls:cleared', {}, user.id);
  return c.json({ ok: true, rolls: [] });
});

app.delete('/dm/talents/:id', async (c) => {
  const user = c.get('user')!;
  const id = Number.parseInt(c.req.param('id'), 10);
  const campaignId = getCampaignId(c.env);

  await c.env.DB.prepare(`DELETE FROM talent_tree WHERE id = ?`).bind(id).run();

  const state = await getTalentsState(c.env.DB, campaignId);
  await broadcastCampaignEvent(c.env, 'talents:updated', state, user.id);
  return c.json(state);
});

// ============================================================================
// Tab 6: DM Uploads (R2), Per-Account Theme Customizer & Character Settings
// ============================================================================

app.post('/dm/upload', async (c) => {
  const formData = await c.req.formData();
  const file = formData.get('file') as unknown;
  const folder = String(formData.get('folder') || 'quests');

  if (!file || typeof file !== 'object' || !(file instanceof File)) {
    return c.json({ error: 'Файл изображения не передан' }, 400);
  }

  try {
    const uploaded = await uploadImageToR2(c.env.BUCKET, c.env.DB, file, folder);
    return c.json(uploaded);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Ошибка загрузки в R2' }, 400);
  }
});

/** Короткий ростер партии для выбора видимости (квесты, литература). */
app.get('/dm/players', async (c) => {
  const users = await listAllUsersWithThemes(c.env.DB);
  const characters = await withCharacterAvatars(c.env.DB, await listCharacterProfiles(c.env.DB));
  const players = users
    .filter((u) => u.role === 'player')
    .map((u) => {
      const character = characters.find((p) => p.playerId != null && p.playerId === u.playerId);
      return {
        userId: u.id,
        playerId: u.playerId ?? null,
        displayName: u.displayName,
        characterName: character?.characterName ?? null,
        charClass: character?.charClass ?? null,
        avatarUrl: character?.avatarUrl ?? u.avatarUrl ?? null,
      };
    })
    .sort((a, b) => (a.playerId ?? 99) - (b.playerId ?? 99));
  return c.json({ players });
});

app.get('/dm/users', async (c) => {
  const users = await listAllUsersWithThemes(c.env.DB);
  const characters = await listCharacterProfiles(c.env.DB);
  return c.json({ users, characters });
});

app.get('/dm/accounts', async (c) => {
  const accounts = await listDmManagedAccounts(c.env.DB);
  return c.json({ accounts });
});

app.put('/dm/accounts/:userId/password', async (c) => {
  const dmUser = c.get('user')!;
  const targetUserId = Number.parseInt(c.req.param('userId'), 10);
  if (!Number.isFinite(targetUserId) || targetUserId <= 0) {
    return c.json({ error: 'Некорректный userId' }, 400);
  }

  const targetRow = await getUserById(c.env.DB, targetUserId);
  if (!targetRow) {
    return c.json({ error: 'Аккаунт не найден' }, 404);
  }

  const body = await c.req
    .json<{ newPassword?: string; currentPassword?: string }>()
    .catch((): { newPassword?: string; currentPassword?: string } => ({}));
  const newPassword = (body.newPassword || '').trim();

  if (newPassword.length < 6 || newPassword.length > 128) {
    return c.json(
      { error: 'Пароль должен содержать от 6 до 128 символов' },
      400
    );
  }

  if (targetRow.role === 'dm') {
    const currentPassword = body.currentPassword || '';
    if (!currentPassword || !verifyPassword(currentPassword, targetRow.password_hash)) {
      return c.json(
        { error: 'Для смены пароля Мастера укажите верный текущий пароль DM' },
        403
      );
    }
  }

  const newHash = hashPassword(newPassword);
  const updatedRow = await updateAccountPassword(
    c.env.DB,
    targetRow.id,
    targetRow.role,
    newHash,
    targetRow.role === 'player' ? newPassword : null
  );

  // If DM changed their own password, keep their active session alive with a rotated token
  if (updatedRow && updatedRow.id === dmUser.id) {
    const jwt = await signSessionJwt(
      {
        id: updatedRow.id,
        username: updatedRow.username,
        role: updatedRow.role,
        playerId: updatedRow.player_id,
        sessionVersion: updatedRow.session_version ?? 2,
      },
      getJwtSecret(c.env)
    );
    const isSecure = new URL(c.req.url).protocol === 'https:';
    c.header('Set-Cookie', buildSessionSetCookie(jwt, isSecure));
  }

  const accounts = await listDmManagedAccounts(c.env.DB);
  return c.json({ accounts, ok: true });
});

app.put('/dm/themes/:userId', async (c) => {
  const dmUser = c.get('user')!;
  const targetUserId = Number.parseInt(c.req.param('userId'), 10);
  const body = await c.req.json<{ theme?: Partial<ThemeVariables> }>();

  const normalizedTheme = parseThemeJson(JSON.stringify(body.theme || {}));
  await upsertUserTheme(c.env.DB, targetUserId, normalizedTheme);

  // Push live theme update to that specific account immediately via Durable Object WebSocket
  await broadcastCampaignEvent(
    c.env,
    'theme:updated',
    { userId: targetUserId, theme: normalizedTheme },
    dmUser.id,
    targetUserId
  );

  const users = await listAllUsersWithThemes(c.env.DB);
  return c.json({ users, theme: normalizedTheme });
});

app.put('/dm/characters/:playerId', async (c) => {
  const dmUser = c.get('user')!;
  const playerId = parseValidPlayerId(c.req.param('playerId'));
  if (!playerId) return c.json({ error: 'Некорректный playerId' }, 400);

  const body = await c.req.json<{
    characterName: string;
    charClass: string;
    subclass?: string;
    race?: string;
    level?: number;
    maxSpells?: number;
    allowOffClassSpells?: boolean;
    lssEmbedUrl?: string;
  }>();

  const trimmedName = (body.characterName || '').trim();
  const trimmedClass = (body.charClass || '').trim();

  await c.env.DB.batch([
    c.env.DB.prepare(
      `UPDATE character_profiles
       SET character_name = ?,
           char_class = ?,
           subclass = ?,
           race = ?,
           level = ?,
           max_spells = ?,
           allow_off_class_spells = COALESCE(?, allow_off_class_spells),
           lss_embed_url = COALESCE(?, lss_embed_url)
       WHERE player_id = ?`
    ).bind(
      trimmedName,
      trimmedClass,
      (body.subclass || '').trim(),
      (body.race || '').trim(),
      trimmedName ? Math.max(1, Math.min(20, Math.trunc(body.level ?? 1))) : 0,
      Math.max(0, Math.trunc(body.maxSpells ?? 0)),
      typeof body.allowOffClassSpells === 'boolean' ? (body.allowOffClassSpells ? 1 : 0) : null,
      body.lssEmbedUrl?.trim() || null,
      playerId
    ),
    c.env.DB.prepare(`UPDATE users SET display_name = ? WHERE player_id = ?`).bind(
      trimmedName || `Игрок ${playerId}`,
      playerId
    ),
  ]);

  const profile = await getCharacterProfile(c.env.DB, playerId);
  await broadcastCampaignEvent(c.env, 'character:updated', { playerId, profile }, dmUser.id);
  return c.json({ profile });
});

app.post('/dm/characters/:playerId/xp', async (c) => {
  const dmUser = c.get('user')!;
  const playerId = parseValidPlayerId(c.req.param('playerId'));
  if (!playerId) return c.json({ error: 'Некорректный playerId' }, 400);

  const current = await getCharacterProfile(c.env.DB, playerId);
  if (!current) return c.json({ error: 'Профиль не найден' }, 404);

  const body = await c.req
    .json<{
      delta?: number;
      setXp?: number;
      setMaxXp?: number | null;
      levelUp?: boolean;
    }>()
    .catch(
      (): {
        delta?: number;
        setXp?: number;
        setMaxXp?: number | null;
        levelUp?: boolean;
      } => ({})
    );

  let nextXp = current.experienceCurrent ?? 0;
  if (typeof body.setXp === 'number' && Number.isFinite(body.setXp)) {
    nextXp = Math.max(0, Math.trunc(body.setXp));
  } else if (typeof body.delta === 'number' && Number.isFinite(body.delta)) {
    nextXp = Math.max(0, Math.trunc(nextXp + body.delta));
  }

  let nextMaxXp = current.experienceMax ?? 0;
  if (body.setMaxXp === null) {
    nextMaxXp = 0; // 0 = auto D&D 5e next-level threshold
  } else if (typeof body.setMaxXp === 'number' && Number.isFinite(body.setMaxXp)) {
    nextMaxXp = Math.max(0, Math.trunc(body.setMaxXp));
  }

  let nextLevel = current.level || 1;
  if (body.levelUp === true && nextLevel < 20) {
    nextLevel = Math.min(20, nextLevel + 1);
  }

  // Also synchronize XP and level inside raw_lss_json if present
  let nextRawJson = current.rawLssJson ?? null;
  if (nextRawJson) {
    try {
      const parsedRoot = JSON.parse(nextRawJson) as Record<string, unknown>;
      if (typeof parsedRoot.data === 'string') {
        const inner = JSON.parse(parsedRoot.data) as Record<string, unknown>;
        if (!inner.info || typeof inner.info !== 'object') inner.info = {};
        const infoObj = inner.info as Record<string, unknown>;
        infoObj.experience = { value: nextXp };
        if (body.levelUp === true) {
          infoObj.level = { value: nextLevel };
        }
        parsedRoot.data = JSON.stringify(inner);
      } else if (parsedRoot.info && typeof parsedRoot.info === 'object') {
        const infoObj = parsedRoot.info as Record<string, unknown>;
        infoObj.experience = { value: nextXp };
        if (body.levelUp === true) {
          infoObj.level = { value: nextLevel };
        }
      }
      nextRawJson = JSON.stringify(parsedRoot);
    } catch {
      // Ignore malformed raw json
    }
  }

  await c.env.DB.prepare(
    `UPDATE character_profiles
     SET experience_current = ?,
         experience_max = ?,
         level = ?,
         raw_lss_json = COALESCE(?, raw_lss_json)
     WHERE player_id = ?`
  )
    .bind(nextXp, nextMaxXp, nextLevel, nextRawJson, playerId)
    .run();

  const profile = await getCharacterProfile(c.env.DB, playerId);
  await broadcastCampaignEvent(c.env, 'character:updated', { playerId, profile }, dmUser.id);
  return c.json({ profile });
});

// ============================================================================
// Tab 6: Campaign Messenger, File/Photo Sharing, Polls & Session Scheduling
// ============================================================================

app.use('/chat/*', async (c, next) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Необходима авторизация' }, 401);
  }
  await next();
});

app.get('/chat', async (c) => {
  const limitParam = Number.parseInt(c.req.query('limit') || '200', 10);
  const campaignId = c.env.CAMPAIGN_ID || 'fraith-main';
  const [messages, nextSession, rawPartyUsers, customEmojis] = await Promise.all([
    listChatMessages(c.env.DB, Number.isFinite(limitParam) ? limitParam : 200),
    getNextSessionBanner(c.env.DB, campaignId),
    listAllUsersWithThemes(c.env.DB),
    listCustomCampaignEmojis(c.env.DB),
  ]);
  const partyUsers = await withUserAvatars(c.env.DB, rawPartyUsers);
  return c.json({ messages, nextSession, partyUsers, customEmojis });
});

app.post('/chat/emojis', async (c) => {
  const user = c.get('user')!;
  let formData: FormData;
  try {
    formData = await c.req.formData();
  } catch {
    return c.json({ error: 'Некорректные данные формы загрузки эмодзи' }, 400);
  }

  const file = formData.get('file');
  const rawName = String(formData.get('name') || '').trim();
  if (!(file instanceof File)) {
    return c.json({ error: 'Выберите изображение эмодзи (PNG, WEBP, GIF или JPG)' }, 400);
  }
  if (file.size > 2 * 1024 * 1024) {
    return c.json({ error: 'Максимальный размер кастомного эмодзи — 2 МБ' }, 400);
  }

  try {
    const uploaded = await uploadChatAttachmentToR2(c.env.BUCKET, c.env.DB, file);
    if (uploaded.kind !== 'image') {
      return c.json({ error: 'Для эмодзи подходят только изображения (PNG, WEBP, GIF, JPG)' }, 400);
    }

    const cleanName =
      rawName || file.name.replace(/\.[^.]+$/, '').slice(0, 32) || 'Кастомный эмодзи';

    const emoji = await createCustomCampaignEmoji(c.env.DB, {
      name: cleanName,
      imageKey: uploaded.key,
      imageUrl: uploaded.url,
      creatorId: user.id,
    });
    const customEmojis = await listCustomCampaignEmojis(c.env.DB);
    await broadcastCampaignEvent(c.env, 'chat:emojis_updated', { customEmojis }, user.id);
    return c.json({ emoji, customEmojis });
  } catch (err) {
    return c.json(
      { error: err instanceof Error ? err.message : 'Ошибка при сохранении эмодзи' },
      400
    );
  }
});

app.delete('/chat/emojis/:id', async (c) => {
  const user = c.get('user')!;
  const emojiId = Number.parseInt(c.req.param('id'), 10);
  if (!Number.isFinite(emojiId) || emojiId <= 0) {
    return c.json({ error: 'Некорректный идентификатор эмодзи' }, 400);
  }

  const row = await c.env.DB.prepare(
    `SELECT id, creator_id FROM chat_custom_emojis WHERE id = ?`
  )
    .bind(emojiId)
    .first<{ id: number; creator_id: number }>();

  if (!row) {
    return c.json({ error: 'Эмодзи не найден' }, 404);
  }
  if (row.creator_id !== user.id && user.role !== 'dm') {
    return c.json({ error: 'Удалить чужой кастомный эмодзи может только Мастер' }, 403);
  }

  await deleteCustomCampaignEmoji(c.env.DB, emojiId);
  const customEmojis = await listCustomCampaignEmojis(c.env.DB);
  await broadcastCampaignEvent(c.env, 'chat:emojis_updated', { customEmojis }, user.id);
  return c.json({ ok: true, customEmojis });
});

app.post('/chat/upload', async (c) => {
  let formData: FormData;
  try {
    formData = await c.req.formData();
  } catch {
    return c.json({ error: 'Некорректные данные формы загрузки файла' }, 400);
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return c.json({ error: 'Файл не передан' }, 400);
  }

  try {
    const attachment = await uploadChatAttachmentToR2(c.env.BUCKET, c.env.DB, file);
    return c.json({ attachment });
  } catch (err) {
    return c.json(
      { error: err instanceof Error ? err.message : 'Ошибка при загрузке файла' },
      400
    );
  }
});

app.get('/chat/files/:key{.*}', async (c) => {
  const rawKey = decodeURIComponent(c.req.param('key'));
  const downloadName = c.req.query('name') || null;
  return getChatAttachmentFromR2(c.env.BUCKET, c.env.DB, rawKey, downloadName);
});

app.post('/chat/messages', async (c) => {
  const user = c.get('user')!;
  const body = await c.req
    .json<{
      content?: string;
      replyToId?: number | null;
      attachments?: ChatAttachment[];
    }>()
    .catch(
      (): {
        content?: string;
        replyToId?: number | null;
        attachments?: ChatAttachment[];
      } => ({})
    );

  const content = (body.content ?? '').trim().slice(0, 6000);
  const attachments = Array.isArray(body.attachments) ? body.attachments.slice(0, 10) : [];
  const replyToId =
    typeof body.replyToId === 'number' && Number.isInteger(body.replyToId) && body.replyToId > 0
      ? body.replyToId
      : null;

  if (!content && attachments.length === 0) {
    return c.json({ error: 'Введите текст сообщения или прикрепите файл' }, 400);
  }

  const message = await createChatMessage(c.env.DB, {
    user,
    content,
    replyToId,
    attachments,
  });

  await broadcastCampaignEvent(c.env, 'chat:message_created', { message }, user.id);
  return c.json({ message });
});

app.put('/chat/messages/:id', async (c) => {
  const user = c.get('user')!;
  const messageId = Number.parseInt(c.req.param('id'), 10);
  if (!Number.isFinite(messageId) || messageId <= 0) {
    return c.json({ error: 'Некорректный идентификатор сообщения' }, 400);
  }

  const existing = await getChatMessageById(c.env.DB, messageId);
  if (!existing) {
    return c.json({ error: 'Сообщение не найдено' }, 404);
  }
  if (existing.userId !== user.id) {
    return c.json({ error: 'Редактировать можно только свои сообщения' }, 403);
  }

  const body = await c.req.json<{ content?: string }>().catch((): { content?: string } => ({}));
  const content = (body.content ?? '').trim().slice(0, 6000);
  if (!content && existing.attachments.length === 0 && !existing.pollId) {
    return c.json({ error: 'Текст сообщения не может быть пустым' }, 400);
  }

  const message = await updateChatMessageContent(c.env.DB, messageId, content);
  if (!message) {
    return c.json({ error: 'Сообщение не найдено' }, 404);
  }

  await broadcastCampaignEvent(c.env, 'chat:message_updated', { message }, user.id);
  return c.json({ message });
});

app.delete('/chat/messages/:id', async (c) => {
  const user = c.get('user')!;
  const messageId = Number.parseInt(c.req.param('id'), 10);
  if (!Number.isFinite(messageId) || messageId <= 0) {
    return c.json({ error: 'Некорректный идентификатор сообщения' }, 400);
  }

  const existing = await getChatMessageById(c.env.DB, messageId);
  if (!existing) {
    return c.json({ error: 'Сообщение не найдено' }, 404);
  }
  if (existing.userId !== user.id && user.role !== 'dm') {
    return c.json({ error: 'Удалить чужое сообщение может только Мастер' }, 403);
  }

  await deleteChatMessage(c.env.DB, messageId);
  await broadcastCampaignEvent(c.env, 'chat:message_deleted', { messageId }, user.id);
  return c.json({ ok: true, messageId });
});

app.post('/chat/messages/:id/pin', async (c) => {
  const user = c.get('user')!;
  const messageId = Number.parseInt(c.req.param('id'), 10);
  if (!Number.isFinite(messageId) || messageId <= 0) {
    return c.json({ error: 'Некорректный идентификатор сообщения' }, 400);
  }

  const existing = await getChatMessageById(c.env.DB, messageId);
  if (!existing) {
    return c.json({ error: 'Сообщение не найдено' }, 404);
  }

  const body = await c.req
    .json<{ isPinned?: boolean }>()
    .catch((): { isPinned?: boolean } => ({}));
  const nextPinned = typeof body.isPinned === 'boolean' ? body.isPinned : !existing.isPinned;

  const message = await togglePinChatMessage(c.env.DB, messageId, nextPinned);
  if (!message) {
    return c.json({ error: 'Сообщение не найдено' }, 404);
  }

  await broadcastCampaignEvent(c.env, 'chat:message_updated', { message }, user.id);
  return c.json({ message });
});

app.post('/chat/messages/:id/react', async (c) => {
  const user = c.get('user')!;
  const messageId = Number.parseInt(c.req.param('id'), 10);
  if (!Number.isFinite(messageId) || messageId <= 0) {
    return c.json({ error: 'Некорректный идентификатор сообщения' }, 400);
  }

  const body = await c.req.json<{ emoji?: string }>().catch((): { emoji?: string } => ({}));
  const emoji = (body.emoji ?? '').trim().slice(0, 64);
  if (!emoji) {
    return c.json({ error: 'Выберите эмодзи для реакции' }, 400);
  }

  const existing = await getChatMessageById(c.env.DB, messageId);
  if (!existing) {
    return c.json({ error: 'Сообщение не найдено' }, 404);
  }

  const message = await toggleChatReaction(c.env.DB, messageId, user.id, emoji);
  if (!message) {
    return c.json({ error: 'Сообщение не найдено' }, 404);
  }

  await broadcastCampaignEvent(c.env, 'chat:message_updated', { message }, user.id);
  return c.json({ message });
});

app.post('/chat/polls', async (c) => {
  const user = c.get('user')!;
  const body = await c.req
    .json<{
      kind?: ChatPollKind;
      question?: string;
      options?: Array<{ label?: string; dateIso?: string | null }>;
      allowMultiple?: boolean;
      isAnonymous?: boolean;
      allowAddOptions?: boolean;
      comment?: string;
      pinMessage?: boolean;
    }>()
    .catch(
      (): {
        kind?: ChatPollKind;
        question?: string;
        options?: Array<{ label?: string; dateIso?: string | null }>;
        allowMultiple?: boolean;
        isAnonymous?: boolean;
        allowAddOptions?: boolean;
        comment?: string;
        pinMessage?: boolean;
      } => ({})
    );

  const kind: ChatPollKind = body.kind === 'date' ? 'date' : 'general';
  const question = (body.question ?? '').trim().slice(0, 300);
  if (!question) {
    return c.json({ error: 'Укажите тему голосования' }, 400);
  }

  const rawOptions = Array.isArray(body.options) ? body.options : [];
  const cleanOptions = rawOptions
    .map((o) => ({
      label: (o?.label ?? '').trim().slice(0, 160),
      dateIso: o?.dateIso ? String(o.dateIso).trim().slice(0, 40) : null,
    }))
    .filter((o) => o.label.length > 0)
    .slice(0, 24);

  if (cleanOptions.length < 2) {
    return c.json({ error: 'Добавьте минимум 2 варианта ответа' }, 400);
  }

  const message = await createChatPollWithMessage(c.env.DB, {
    user,
    kind,
    question,
    options: cleanOptions,
    allowMultiple: body.allowMultiple ?? kind === 'date',
    isAnonymous: Boolean(body.isAnonymous),
    allowAddOptions: body.allowAddOptions ?? kind === 'date',
    comment: (body.comment ?? '').trim().slice(0, 2000),
    pinMessage: Boolean(body.pinMessage),
  });

  await broadcastCampaignEvent(c.env, 'chat:message_created', { message }, user.id);
  return c.json({ message });
});

app.post('/chat/polls/:id/vote', async (c) => {
  const user = c.get('user')!;
  const pollId = Number.parseInt(c.req.param('id'), 10);
  if (!Number.isFinite(pollId) || pollId <= 0) {
    return c.json({ error: 'Некорректный идентификатор голосования' }, 400);
  }

  const body = await c.req
    .json<{ optionId?: number }>()
    .catch((): { optionId?: number } => ({}));
  const optionId = Number(body.optionId);
  if (!Number.isInteger(optionId) || optionId <= 0) {
    return c.json({ error: 'Укажите вариант ответа' }, 400);
  }

  const res = await toggleChatPollVote(c.env.DB, pollId, optionId, user.id);
  if (!res.ok) {
    return c.json({ error: res.error }, 400);
  }

  await broadcastCampaignEvent(c.env, 'chat:poll_updated', { poll: res.poll }, user.id);
  return c.json({ poll: res.poll });
});

app.post('/chat/polls/:id/options', async (c) => {
  const user = c.get('user')!;
  const pollId = Number.parseInt(c.req.param('id'), 10);
  if (!Number.isFinite(pollId) || pollId <= 0) {
    return c.json({ error: 'Некорректный идентификатор голосования' }, 400);
  }

  const pollMeta = await c.env.DB.prepare(
    `SELECT creator_id, allow_add_options FROM chat_polls WHERE id = ?`
  )
    .bind(pollId)
    .first<{ creator_id: number; allow_add_options: number }>();

  if (!pollMeta) {
    return c.json({ error: 'Голосование не найдено' }, 404);
  }
  if (!pollMeta.allow_add_options && pollMeta.creator_id !== user.id && user.role !== 'dm') {
    return c.json({ error: 'Добавление вариантов в этом опросе отключено' }, 403);
  }

  const body = await c.req
    .json<{ label?: string; dateIso?: string | null }>()
    .catch((): { label?: string; dateIso?: string | null } => ({}));

  const label = (body.label ?? '').trim().slice(0, 160);
  if (!label) {
    return c.json({ error: 'Введите текст варианта' }, 400);
  }

  const res = await addChatPollOption(
    c.env.DB,
    pollId,
    label,
    body.dateIso ? String(body.dateIso).trim().slice(0, 40) : null,
    user.id
  );
  if (!res.ok) {
    return c.json({ error: res.error }, 400);
  }

  await broadcastCampaignEvent(c.env, 'chat:poll_updated', { poll: res.poll }, user.id);
  return c.json({ poll: res.poll });
});

app.post('/chat/polls/:id/close', async (c) => {
  const user = c.get('user')!;
  const pollId = Number.parseInt(c.req.param('id'), 10);
  if (!Number.isFinite(pollId) || pollId <= 0) {
    return c.json({ error: 'Некорректный идентификатор голосования' }, 400);
  }

  const pollMeta = await c.env.DB.prepare(
    `SELECT creator_id, is_closed FROM chat_polls WHERE id = ?`
  )
    .bind(pollId)
    .first<{ creator_id: number; is_closed: number }>();

  if (!pollMeta) {
    return c.json({ error: 'Голосование не найдено' }, 404);
  }
  if (pollMeta.creator_id !== user.id && user.role !== 'dm') {
    return c.json({ error: 'Закрыть опрос может его автор или Мастер' }, 403);
  }

  const body = await c.req
    .json<{ isClosed?: boolean }>()
    .catch((): { isClosed?: boolean } => ({}));
  const nextClosed = typeof body.isClosed === 'boolean' ? body.isClosed : !pollMeta.is_closed;

  const poll = await setChatPollClosed(c.env.DB, pollId, nextClosed);
  if (!poll) {
    return c.json({ error: 'Голосование не найдено' }, 404);
  }

  await broadcastCampaignEvent(c.env, 'chat:poll_updated', { poll }, user.id);
  return c.json({ poll });
});

app.post('/chat/polls/:id/confirm-session', async (c) => {
  const user = c.get('user')!;
  const pollId = Number.parseInt(c.req.param('id'), 10);
  if (!Number.isFinite(pollId) || pollId <= 0) {
    return c.json({ error: 'Некорректный идентификатор голосования' }, 400);
  }

  const pollMeta = await c.env.DB.prepare(
    `SELECT creator_id FROM chat_polls WHERE id = ?`
  )
    .bind(pollId)
    .first<{ creator_id: number }>();

  if (!pollMeta) {
    return c.json({ error: 'Голосование не найдено' }, 404);
  }
  if (pollMeta.creator_id !== user.id && user.role !== 'dm') {
    return c.json({ error: 'Утвердить дату сессии может автор голосования или Мастер' }, 403);
  }

  const body = await c.req
    .json<{ optionId?: number; note?: string }>()
    .catch((): { optionId?: number; note?: string } => ({}));

  const optionId = Number(body.optionId);
  if (!Number.isInteger(optionId) || optionId <= 0) {
    return c.json({ error: 'Выберите вариант даты для утверждения' }, 400);
  }

  const campaignId = c.env.CAMPAIGN_ID || 'fraith-main';
  const confirmed = await confirmPollOptionAsNextSession(c.env.DB, {
    campaignId,
    pollId,
    optionId,
    note: (body.note ?? '').trim().slice(0, 240),
    updatedBy: user.id,
  });

  if (!confirmed) {
    return c.json({ error: 'Вариант даты не найден' }, 404);
  }

  await Promise.all([
    broadcastCampaignEvent(c.env, 'chat:poll_updated', { poll: confirmed.poll }, user.id),
    broadcastCampaignEvent(
      c.env,
      'chat:session_updated',
      { nextSession: confirmed.nextSession },
      user.id
    ),
  ]);

  return c.json(confirmed);
});

app.put('/chat/session', async (c) => {
  const user = c.get('user')!;
  const body = await c.req
    .json<{ label?: string; dateIso?: string | null; note?: string }>()
    .catch((): { label?: string; dateIso?: string | null; note?: string } => ({}));

  const label = (body.label ?? '').trim().slice(0, 160);
  if (!label) {
    return c.json({ error: 'Укажите дату и время следующей сессии' }, 400);
  }

  const campaignId = c.env.CAMPAIGN_ID || 'fraith-main';
  const nextSession = await upsertNextSessionBanner(c.env.DB, {
    campaignId,
    label,
    dateIso: body.dateIso ? String(body.dateIso).trim().slice(0, 40) : null,
    note: (body.note ?? '').trim().slice(0, 240),
    updatedBy: user.id,
  });

  await broadcastCampaignEvent(c.env, 'chat:session_updated', { nextSession }, user.id);
  return c.json({ nextSession });
});

app.delete('/chat/session', async (c) => {
  const user = c.get('user')!;
  const campaignId = c.env.CAMPAIGN_ID || 'fraith-main';
  await clearNextSessionBanner(c.env.DB, campaignId);
  await broadcastCampaignEvent(c.env, 'chat:session_updated', { nextSession: null }, user.id);
  return c.json({ ok: true });
});

// ============================================================================
// «Доска» (infinite canvas) — изолированный набор маршрутов /api/boards/*
// ============================================================================

registerBoardRoutes(app);

// ============================================================================
// «Бой» (конструктор боёв и трекер инициативы) — изолированный набор /api/combats/*
// ============================================================================

registerCombatRoutes(app);

export const onRequest = handle(app);
