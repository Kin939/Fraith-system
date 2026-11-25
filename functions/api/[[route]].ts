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
  getCharacterProfile,
  getJournalEntry,
  getTalentsState,
  getUserByEmail,
  getUserById,
  getUserByUsername,
  learnSpellForPlayer,
  listAllUsersWithThemes,
  listBestiary,
  listCharacterProfiles,
  listDmManagedAccounts,
  listLearnedSpellsForPlayer,
  listQuests,
  listRecentRolls,
  listSpells,
  mapUserRowToAuthUser,
  nextCustomSpellId,
  parseCrToNumeric,
  purchaseTalentForPlayer,
  saveJournalEntry,
  unlearnSpellForPlayer,
  updateAccountPassword,
  upsertUserTheme,
} from '../../src/lib/db';
import { parseLssCharacterPayload } from '../../src/lib/lss';
import { getImageFromR2, uploadImageToR2 } from '../../src/lib/r2';
import { parseThemeJson } from '../../src/lib/theme';
import type { AuthUser, PlayerId, QuestStatus, Spell, ThemeVariables } from '../../src/lib/types';

export interface Env {
  DB: D1Database;
  BUCKET?: R2Bucket;
  CAMPAIGN_DO: DurableObjectNamespace;
  ASSETS?: Fetcher;
  JWT_SECRET?: string;
  CAMPAIGN_ID?: string;
  CF_ACCESS_ENABLED?: string;
}

type Variables = {
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

app.get('/auth/me', (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ user: null }, 401);
  }
  return c.json({ user });
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

// ============================================================================
// Tab 1: Characters, Personal Journal & Long Story Short (LSS) Sync
// ============================================================================

app.get('/characters', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Необходима авторизация' }, 401);

  const allProfiles = await listCharacterProfiles(c.env.DB);
  if (user.role === 'dm') {
    return c.json({ characters: allProfiles });
  }

  // Players get their own full profile + party summary names/classes
  const filtered = allProfiles.map((p) =>
    p.playerId === user.playerId
      ? p
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

  const [profile, journal, learnedSpells] = await Promise.all([
    getCharacterProfile(c.env.DB, playerId),
    getJournalEntry(c.env.DB, playerId),
    listLearnedSpellsForPlayer(c.env.DB, playerId),
  ]);

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

app.get('/quests', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Необходима авторизация' }, 401);

  const quests = await listQuests(c.env.DB);
  return c.json({ quests });
});

app.post('/dm/quests', async (c) => {
  const user = c.get('user')!;
  const body = await c.req.json<{
    title: string;
    shortDesc: string;
    fullDesc: string;
    reward?: string;
    parameters?: Record<string, string>;
    progressCurrent?: number;
    progressTarget?: number;
    imageKey?: string | null;
    status?: QuestStatus;
  }>();

  if (!body.title?.trim() || !body.shortDesc?.trim()) {
    return c.json({ error: 'Укажите название и краткое описание квеста' }, 400);
  }

  const status: QuestStatus = ['active', 'completed', 'failed', 'available'].includes(
    body.status as string
  )
    ? (body.status as QuestStatus)
    : 'active';

  await c.env.DB.prepare(
    `INSERT INTO quests (title, short_desc, full_desc, reward, parameters_json, progress_current, progress_target, image_key, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
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
      status
    )
    .run();

  const quests = await listQuests(c.env.DB);
  await broadcastCampaignEvent(c.env, 'quests:updated', { quests }, user.id);
  return c.json({ quests });
});

app.put('/dm/quests/:id', async (c) => {
  const user = c.get('user')!;
  const id = Number.parseInt(c.req.param('id'), 10);
  const body = await c.req.json<{
    title: string;
    shortDesc: string;
    fullDesc: string;
    reward?: string;
    parameters?: Record<string, string>;
    progressCurrent?: number;
    progressTarget?: number;
    imageKey?: string | null;
    status?: QuestStatus;
  }>();

  const status: QuestStatus = ['active', 'completed', 'failed', 'available'].includes(
    body.status as string
  )
    ? (body.status as QuestStatus)
    : 'active';

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
         status = ?
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
      id
    )
    .run();

  const quests = await listQuests(c.env.DB);
  await broadcastCampaignEvent(c.env, 'quests:updated', { quests }, user.id);
  return c.json({ quests });
});

app.delete('/dm/quests/:id', async (c) => {
  const user = c.get('user')!;
  const id = Number.parseInt(c.req.param('id'), 10);
  await c.env.DB.prepare(`DELETE FROM quests WHERE id = ?`).bind(id).run();

  const quests = await listQuests(c.env.DB);
  await broadcastCampaignEvent(c.env, 'quests:updated', { quests }, user.id);
  return c.json({ quests });
});

// ============================================================================
// Tab 3: Bestiary (Role-masked read, CR sorting, DM CRUD)
// ============================================================================

app.get('/bestiary', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Необходима авторизация' }, 401);

  const creatures = await listBestiary(c.env.DB, user.role);
  return c.json({ creatures });
});

app.post('/dm/bestiary', async (c) => {
  const user = c.get('user')!;
  const body = await c.req.json<{
    name: string;
    cr: string;
    creatureType?: string;
    ac?: number;
    hp?: string;
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
    `INSERT INTO bestiary (name, cr, cr_numeric, creature_type, ac, hp, description, image_key, is_revealed, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      body.name.trim(),
      crStr,
      crNumeric,
      (body.creatureType || 'Чудовище').trim(),
      Math.max(1, Math.trunc(body.ac ?? 13)),
      (body.hp || '27 (5d8 + 5)').trim(),
      (body.description || '').trim(),
      body.imageKey || null,
      body.isRevealed ? 1 : 0,
      Math.trunc(body.sortOrder ?? 0)
    )
    .run();

  // Send invalidation signal without unmasked spoilers so players re-fetch masked view
  await broadcastCampaignEvent(c.env, 'bestiary:updated', { updatedAt: Date.now() }, user.id);
  const creatures = await listBestiary(c.env.DB, 'dm');
  return c.json({ creatures });
});

app.put('/dm/bestiary/:id', async (c) => {
  const user = c.get('user')!;
  const id = Number.parseInt(c.req.param('id'), 10);
  const body = await c.req.json<{
    name: string;
    cr: string;
    creatureType?: string;
    ac?: number;
    hp?: string;
    description?: string;
    imageKey?: string | null;
    isRevealed?: boolean;
    sortOrder?: number;
  }>();

  const crStr = (body.cr || '1').trim();
  const crNumeric = parseCrToNumeric(crStr);

  await c.env.DB.prepare(
    `UPDATE bestiary
     SET name = ?,
         cr = ?,
         cr_numeric = ?,
         creature_type = ?,
         ac = ?,
         hp = ?,
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
      Math.max(1, Math.trunc(body.ac ?? 13)),
      (body.hp || '27 (5d8 + 5)').trim(),
      (body.description || '').trim(),
      body.imageKey || null,
      body.isRevealed ? 1 : 0,
      Math.trunc(body.sortOrder ?? 0),
      id
    )
    .run();

  await broadcastCampaignEvent(c.env, 'bestiary:updated', { updatedAt: Date.now() }, user.id);
  const creatures = await listBestiary(c.env.DB, 'dm');
  return c.json({ creatures });
});

app.delete('/dm/bestiary/:id', async (c) => {
  const user = c.get('user')!;
  const id = Number.parseInt(c.req.param('id'), 10);
  await c.env.DB.prepare(`DELETE FROM bestiary WHERE id = ?`).bind(id).run();

  await broadcastCampaignEvent(c.env, 'bestiary:updated', { updatedAt: Date.now() }, user.id);
  const creatures = await listBestiary(c.env.DB, 'dm');
  return c.json({ creatures });
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
    return c.json({ error: 'Только игрок может изучать заклинания для своего персонажа' }, 403);
  }

  const spellId = Number.parseInt(c.req.param('id'), 10);
  if (!Number.isFinite(spellId) || spellId <= 0) {
    return c.json({ error: 'Некорректный идентификатор заклинания' }, 400);
  }

  let catalogSpell = await resolveDndsuSpellFromAssets(c.env, c.req.url, spellId);
  if (!catalogSpell) {
    const body = await c.req
      .json<{ spell?: Spell }>()
      .catch((): { spell?: Spell } => ({}));
    if (body.spell && body.spell.id === spellId && body.spell.name) {
      catalogSpell = body.spell;
    }
  }

  const res = await learnSpellForPlayer(c.env.DB, user.playerId, spellId, catalogSpell);
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
  if (user.role !== 'player' || !user.playerId) {
    return c.json({ error: 'Покупка талантов доступна игрокам для своего персонажа' }, 403);
  }

  const talentId = Number.parseInt(c.req.param('id'), 10);
  const campaignId = getCampaignId(c.env);
  const res = await purchaseTalentForPlayer(c.env.DB, campaignId, user.playerId, talentId);
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

app.post('/dm/talents', async (c) => {
  const user = c.get('user')!;
  const campaignId = getCampaignId(c.env);
  const body = await c.req.json<{
    title: string;
    description: string;
    imageKey?: string | null;
    cost?: number;
    positionX?: number;
    positionY?: number;
    parentId?: number | null;
  }>();

  if (!body.title?.trim()) {
    return c.json({ error: 'Укажите название таланта' }, 400);
  }

  await c.env.DB.prepare(
    `INSERT INTO talent_tree (title, description, image_key, cost, position_x, position_y, parent_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      body.title.trim(),
      (body.description || '').trim(),
      body.imageKey || null,
      Math.max(0, Math.trunc(body.cost ?? 1)),
      Math.max(0, Math.trunc(body.positionX ?? 0)),
      Math.max(0, Math.trunc(body.positionY ?? 0)),
      body.parentId || null
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
  const body = await c.req.json<{
    title: string;
    description: string;
    imageKey?: string | null;
    cost?: number;
    positionX?: number;
    positionY?: number;
    parentId?: number | null;
  }>();

  const safeParentId = body.parentId && body.parentId !== id ? body.parentId : null;

  await c.env.DB.prepare(
    `UPDATE talent_tree
     SET title = ?,
         description = ?,
         image_key = ?,
         cost = ?,
         position_x = ?,
         position_y = ?,
         parent_id = ?
     WHERE id = ?`
  )
    .bind(
      body.title.trim(),
      (body.description || '').trim(),
      body.imageKey || null,
      Math.max(0, Math.trunc(body.cost ?? 1)),
      Math.max(0, Math.trunc(body.positionX ?? 0)),
      Math.max(0, Math.trunc(body.positionY ?? 0)),
      safeParentId,
      id
    )
    .run();

  const state = await getTalentsState(c.env.DB, campaignId);
  await broadcastCampaignEvent(c.env, 'talents:updated', state, user.id);
  return c.json(state);
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
           lss_embed_url = COALESCE(?, lss_embed_url)
       WHERE player_id = ?`
    ).bind(
      trimmedName,
      trimmedClass,
      (body.subclass || '').trim(),
      (body.race || '').trim(),
      trimmedName ? Math.max(1, Math.min(20, Math.trunc(body.level ?? 1))) : 0,
      Math.max(0, Math.trunc(body.maxSpells ?? 0)),
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

export const onRequest = handle(app);
