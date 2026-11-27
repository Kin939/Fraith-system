import type { Hono } from 'hono';
import type { Env, Variables } from '../functions/api/[[route]]';
import type { AuthUser } from '../src/lib/types';
import type {
  CombatActor,
  CombatParticipantView,
  CombatStatus,
  CombatSummary,
  CombatView,
  MonsterHpVisibility,
} from '../src/lib/combatProtocol';
import { getUserAvatarUrl } from '../src/lib/db';
import { DND_CONDITIONS } from '../src/lib/combatProtocol';

/**
 * HTTP-слой вкладки «Бой».
 *
 * Метаданные и авторитарное состояние живут в D1 (`combats`, `combat_participants`,
 * `combat_effects`, `combat_log`), живая синхронизация — в CombatRoom (Durable Object,
 * один инстанс на бой). Все мутации проходят через DO, поэтому порядок инициативы,
 * таймер и логи всегда консистентны.
 *
 * Бестиарий только ЧИТАЕТСЯ: структура `bestiary` не меняется, при добавлении моба
 * в бой мы делаем снимок публичных полей и стат-блока.
 */

type AppEnv = { Bindings: Env; Variables: Variables };

interface CombatRow {
  id: string;
  campaign_id: string;
  name: string;
  status: CombatStatus;
  current_turn_index: number;
  round_number: number;
  turn_timer_seconds: number | null;
  created_by: number;
  created_at: number;
  updated_at: number;
}

interface BestiaryRow {
  id: number;
  name: string;
  cr: string;
  cr_numeric: number;
  creature_type: string;
  size: string;
  ac: number;
  hp: string;
  description: string;
  image_url: string;
  image_full_url: string;
  is_revealed: number;
  speed: string;
  senses: string;
  languages: string;
}

const MAX_NAME = 80;

/**
 * Чтение JSON-тела с типизированным пустым фолбэком.
 * Важно: фолбэк приводится к тому же типу T, иначе TS сужает объединение
 * и ломает доступ к свойствам (проверено на практике).
 */
async function readJson<T>(request: { json: <U>() => Promise<U> }, fallback: T): Promise<T> {
  try {
    return await request.json<T>();
  } catch {
    return fallback;
  }
}

function newId(): string {
  return crypto.randomUUID();
}

function campaignId(env: Env): string {
  return env.CAMPAIGN_ID || 'fraith-main-campaign';
}

function actorFor(user: AuthUser): CombatActor {
  return {
    userId: user.id,
    role: user.role === 'dm' ? 'dm' : 'player',
    playerId: user.playerId ?? null,
    displayName: user.displayName,
  };
}

function roomStub(env: Env, combatId: string) {
  if (!env.COMBAT_ROOM) return null;
  const id = env.COMBAT_ROOM.idFromName(combatId);
  return env.COMBAT_ROOM.get(id);
}

async function fetchCombat(env: Env, combatId: string): Promise<CombatRow | null> {
  return await env.DB.prepare(`SELECT * FROM combats WHERE id = ?`).bind(combatId).first<CombatRow>();
}

async function callRoom<T>(
  env: Env,
  combatId: string,
  path: string,
  init?: { method?: string; body?: unknown }
): Promise<T | null> {
  const stub = roomStub(env, combatId);
  if (!stub) return null;
  const url = new URL(`https://combat-do.internal${path}`);
  url.searchParams.set('combatId', combatId);
  const request = new Request(url.toString(), {
    method: init?.method ?? 'GET',
    headers: init?.body ? { 'content-type': 'application/json' } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  try {
    const res = await stub.fetch(request);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function mutate(
  env: Env,
  combatId: string,
  action: string,
  payload: Record<string, unknown>,
  actor: CombatActor
): Promise<{ ok: boolean; error?: string; status?: number }> {
  const stub = roomStub(env, combatId);
  if (!stub) return { ok: false, error: 'Синхронизация боя недоступна', status: 503 };
  const url = new URL('https://combat-do.internal/mutate');
  url.searchParams.set('combatId', combatId);
  const res = await stub.fetch(
    new Request(url.toString(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action, payload, actor }),
    })
  );
  if (res.ok) return { ok: true };
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  return { ok: false, error: body.error ?? 'Не удалось изменить бой', status: res.status };
}

async function loadView(env: Env, combatId: string, user: AuthUser): Promise<CombatView | null> {
  const stub = roomStub(env, combatId);
  if (!stub) return null;
  const url = new URL('https://combat-do.internal/state');
  url.searchParams.set('combatId', combatId);
  url.searchParams.set('role', user.role === 'dm' ? 'dm' : 'player');
  url.searchParams.set('userId', String(user.id));
  if (user.playerId != null) url.searchParams.set('playerId', String(user.playerId));
  const res = await stub.fetch(new Request(url.toString()));
  if (!res.ok) return null;
  return (await res.json()) as CombatView;
}

/** «22 (4d8 + 4)» → { average: 22, dice: '4d8 + 4' } */
function parseHp(raw: string): { average: number; dice: string } {
  const text = (raw || '').trim();
  const match = text.match(/^(\d+)\s*(?:\(([^)]+)\))?/);
  if (match) {
    const average = Number.parseInt(match[1], 10);
    return {
      average: Number.isFinite(average) ? average : 10,
      dice: (match[2] ?? '').trim() || `${Math.max(1, Math.round((average || 10) / 4.5))}d8`,
    };
  }
  const diceMatch = text.match(/(\d+d\d+(?:\s*[+-]\s*\d+)?)/);
  if (diceMatch) return { average: Math.max(1, Math.round(evalDiceAverage(diceMatch[1]))), dice: diceMatch[1] };
  return { average: 10, dice: '3d6' };
}

function evalDiceAverage(expr: string): number {
  const match = expr.match(/(\d+)d(\d+)(?:\s*([+-])\s*(\d+))?/i);
  if (!match) return 10;
  const count = Number.parseInt(match[1], 10);
  const sides = Number.parseInt(match[2], 10);
  const modifier = match[4] ? Number.parseInt(match[4], 10) * (match[3] === '-' ? -1 : 1) : 0;
  return count * ((sides + 1) / 2) + modifier;
}

function buildStatblock(row: BestiaryRow): string {
  const parts = [
    `${row.name} · CR ${row.cr} · ${row.creature_type}${row.size ? ` (${row.size})` : ''}`,
    `AC ${row.ac} · HP ${row.hp}`,
    row.speed ? `Скорость: ${row.speed}` : '',
    row.senses ? `Чувства: ${row.senses}` : '',
    row.languages ? `Языки: ${row.languages}` : '',
    row.description ? '' : '',
    row.description ?? '',
  ];
  return parts.filter(Boolean).join('\n').slice(0, 20000);
}

async function listCampaignPlayers(env: Env) {
  const rows = await env.DB.prepare(
    `SELECT u.id, u.username, u.display_name, u.player_id,
            c.character_name, c.char_class, c.race, c.level, c.hp_current, c.hp_max
     FROM users u
     LEFT JOIN character_profiles c ON c.player_id = u.player_id
     WHERE u.role = 'player'
     ORDER BY u.player_id ASC`
  ).all<{
    id: number;
    username: string;
    display_name: string;
    player_id: number | null;
    character_name: string | null;
    char_class: string | null;
    race: string | null;
    level: number | null;
    hp_current: number | null;
    hp_max: number | null;
  }>();

  return Promise.all(
    (rows.results ?? []).map(async (row) => ({
      userId: row.id,
      playerId: row.player_id,
      username: row.username,
      displayName: row.display_name,
      characterName: row.character_name ?? row.display_name,
      charClass: row.char_class ?? '',
      race: row.race ?? '',
      level: row.level ?? 1,
      // Текущие HP берём из листа персонажа, чтобы трекер стартовал с реальными числами.
      hpCurrent: row.hp_current ?? 0,
      hpMax: row.hp_max ?? 0,
      avatarUrl: await getUserAvatarUrl(env.DB, row.id),
    }))
  );
}

export function registerCombatRoutes(app: Hono<AppEnv>): void {
  /* ---------------------------------------------------------------- бестиарий */

  // Список существ для конструктора боя. Читаем существующую таблицу `bestiary`,
  // ничего в ней не меняя; стат-блоки отдаём только мастеру.
  app.get('/combats/bestiary', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Необходима авторизация' }, 401);
    if (user.role !== 'dm') return c.json({ error: 'Конструктор боя доступен мастеру' }, 403);

    const { results } = await c.env.DB.prepare(
      `SELECT id, name, cr, cr_numeric, creature_type, size, ac, hp, description,
              image_url, image_full_url, is_revealed, speed, senses, languages
       FROM bestiary
       ORDER BY cr_numeric ASC, name ASC`
    ).all<BestiaryRow>();

    const creatures = (results ?? []).map((row) => {
      const hp = parseHp(row.hp);
      return {
        id: row.id,
        name: row.name,
        cr: row.cr,
        crNumeric: row.cr_numeric,
        creatureType: row.creature_type,
        size: row.size,
        ac: row.ac,
        hpAverage: hp.average,
        hpDice: hp.dice,
        hpRaw: row.hp,
        imageUrl: row.image_url || row.image_full_url,
        isRevealed: Boolean(row.is_revealed),
        statblock: buildStatblock(row),
      };
    });

    return c.json({ creatures });
  });

  // Справочник состояний для конструктора эффектов (не БД — статический SRD-список).
  app.get('/combats/conditions', (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Необходима авторизация' }, 401);
    return c.json({ conditions: DND_CONDITIONS });
  });

  app.get('/combats/members', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Необходима авторизация' }, 401);
    const players = await listCampaignPlayers(c.env);
    return c.json({ players });
  });

  /* ---------------------------------------------------------------- история */

  /**
   * История завершённых боёв. Доступна всей партии, но имена, скрытые
   * мастером, остаются скрытыми и в архиве.
   */
  app.get('/combats/history', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Необходима авторизация' }, 401);
    const isDm = user.role === 'dm';

    const { results } = await c.env.DB.prepare(
      `SELECT cb.id, cb.name, cb.round_number, cb.created_at, cb.updated_at,
              (SELECT COUNT(*) FROM combat_participants p WHERE p.combat_id = cb.id) AS participant_count,
              (SELECT COUNT(*) FROM combat_participants p
                 WHERE p.combat_id = cb.id AND p.is_defeated = 1) AS defeated_count,
              (SELECT COUNT(*) FROM combat_participants p
                 WHERE p.combat_id = cb.id AND p.participant_type = 'monster') AS monster_count,
              (SELECT COUNT(*) FROM combat_log l WHERE l.combat_id = cb.id) AS event_count
       FROM combats cb
       WHERE cb.campaign_id = ? AND cb.status = 'finished'
       ORDER BY cb.updated_at DESC
       LIMIT 60`
    )
      .bind(campaignId(c.env))
      .all<{
        id: string;
        name: string;
        round_number: number;
        created_at: number;
        updated_at: number;
        participant_count: number;
        defeated_count: number;
        monster_count: number;
        event_count: number;
      }>();

    const combats = results ?? [];
    if (combats.length === 0) return c.json({ combats: [], isDm });

    const ids = combats.map((row) => row.id);
    const placeholders = ids.map(() => '?').join(',');
    const participantsResult = await c.env.DB.prepare(
      `SELECT combat_id, id, display_name, participant_type, is_defeated, hide_name, current_hp, max_hp
       FROM combat_participants
       WHERE combat_id IN (${placeholders})
       ORDER BY initiative_order ASC`
    )
      .bind(...ids)
      .all<{
        combat_id: string;
        id: string;
        display_name: string;
        participant_type: 'player' | 'monster';
        is_defeated: number;
        hide_name: number;
        current_hp: number | null;
        max_hp: number | null;
      }>();

    const byCombat = new Map<string, typeof participantsResult.results>();
    for (const row of participantsResult.results ?? []) {
      const list = byCombat.get(row.combat_id) ?? [];
      list.push(row);
      byCombat.set(row.combat_id, list);
    }

    return c.json({
      isDm,
      combats: combats.map((row) => {
        const roster = byCombat.get(row.id) ?? [];
        return {
          id: row.id,
          name: row.name,
          roundNumber: Number(row.round_number ?? 1),
          startedAt: Number(row.created_at ?? 0),
          finishedAt: Number(row.updated_at ?? 0),
          participantCount: Number(row.participant_count ?? 0),
          defeatedCount: Number(row.defeated_count ?? 0),
          monsterCount: Number(row.monster_count ?? 0),
          eventCount: Number(row.event_count ?? 0),
          participants: roster.slice(0, 16).map((participant) => ({
            id: participant.id,
            name:
              !isDm && participant.hide_name ? 'Неизвестное существо' : participant.display_name,
            type: participant.participant_type,
            isDefeated: Boolean(participant.is_defeated),
            currentHp: isDm || !participant.hide_name ? participant.current_hp : null,
            maxHp: isDm || !participant.hide_name ? participant.max_hp : null,
          })),
        };
      }),
    });
  });

  /* ------------------------------------------------------------------- список */

  app.get('/combats', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Необходима авторизация' }, 401);
    const isDm = user.role === 'dm';

    const { results } = await c.env.DB.prepare(
      `SELECT cb.id, cb.name, cb.status, cb.round_number, cb.updated_at, cb.created_at,
              cb.current_turn_index,
              (SELECT COUNT(*) FROM combat_participants p WHERE p.combat_id = cb.id) AS participant_count,
              (SELECT p.display_name FROM combat_participants p
                WHERE p.combat_id = cb.id AND p.initiative_order = cb.current_turn_index) AS current_name,
              (SELECT p.hide_name FROM combat_participants p
                WHERE p.combat_id = cb.id AND p.initiative_order = cb.current_turn_index) AS current_hidden
       FROM combats cb
       WHERE cb.campaign_id = ? ${isDm ? '' : "AND cb.status <> 'setup'"}
       ORDER BY cb.updated_at DESC`
    )
      .bind(campaignId(c.env))
      .all<{
        id: string;
        name: string;
        status: CombatStatus;
        round_number: number;
        updated_at: number;
        created_at: number;
        participant_count: number;
        current_name: string | null;
        current_hidden: number | null;
      }>();

    const combats: CombatSummary[] = (results ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      status: row.status,
      roundNumber: row.round_number,
      participantCount: Number(row.participant_count ?? 0),
      updatedAt: Number(row.updated_at),
      createdAt: Number(row.created_at),
      isDm,
      currentParticipantName:
        !isDm && row.current_hidden ? 'Неизвестное существо' : row.current_name,
    }));

    return c.json({ combats, isDm });
  });

  /* ------------------------------------------------------------------ создание */

  app.post('/combats', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Необходима авторизация' }, 401);
    if (user.role !== 'dm') return c.json({ error: 'Создавать бои может только мастер' }, 403);

    const body = await readJson<{
        name?: string;
        turnTimerSeconds?: number | null;
        settings?: {
          allowPlayerTurn?: boolean;
          showPlayerHp?: boolean;
          showOtherDeathSaves?: boolean;
          monsterHpVisibility?: MonsterHpVisibility;
        };
        participants?: Array<{
          participantType?: 'player' | 'monster';
          userId?: number;
          playerId?: number;
          monsterBestiaryId?: number;
          displayName?: string;
          imageUrl?: string;
          initiativeValue?: number;
          currentHp?: number;
          maxHp?: number;
          armorClass?: number;
          isHiddenFromPlayers?: boolean;
          hideName?: boolean;
          statblock?: string;
          quantity?: number;
        }>;
      }>(c.req, {});

    const id = newId();
    const ts = Date.now();
    const name = (body.name || '').trim().slice(0, MAX_NAME) || 'Новый бой';
    const timerSeconds =
      body.turnTimerSeconds == null ? null : Math.min(3600, Math.max(5, Math.trunc(body.turnTimerSeconds)));

    await c.env.DB.prepare(
      `INSERT INTO combats (id, campaign_id, name, status, current_turn_index, round_number,
         turn_timer_seconds, turn_timer_ends_at, turn_timer_paused_remaining_ms,
         allow_player_turn, show_player_hp, show_other_death_saves, monster_hp_visibility,
         created_by, created_at, updated_at)
       VALUES (?, ?, ?, 'setup', 0, 1, ?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        id,
        campaignId(c.env),
        name,
        timerSeconds,
        body.settings?.allowPlayerTurn ? 1 : 0,
        body.settings?.showPlayerHp === false ? 0 : 1,
        body.settings?.showOtherDeathSaves ? 1 : 0,
        body.settings?.monsterHpVisibility === 'hidden' || body.settings?.monsterHpVisibility === 'numbers'
          ? body.settings.monsterHpVisibility
          : 'bar',
        user.id,
        ts,
        ts
      )
      .run();

    // Участники: игроки — из ростера кампании, мобы — из бестиария (только чтение).
    const participants = body.participants ?? [];
    if (participants.length > 0) {
      const bestiaryIds = participants
        .filter((item) => item.participantType === 'monster' && item.monsterBestiaryId)
        .map((item) => Number(item.monsterBestiaryId));
      const creatureById = new Map<number, BestiaryRow>();
      if (bestiaryIds.length > 0) {
        const placeholders = bestiaryIds.map(() => '?').join(', ');
        const { results } = await c.env.DB.prepare(
          `SELECT id, name, cr, cr_numeric, creature_type, size, ac, hp, description,
                  image_url, image_full_url, is_revealed, speed, senses, languages
           FROM bestiary WHERE id IN (${placeholders})`
        )
          .bind(...bestiaryIds)
          .all<BestiaryRow>();
        (results ?? []).forEach((row) => creatureById.set(row.id, row));
      }

      const statements: D1PreparedStatement[] = [];
      let order = 0;
      for (const item of participants) {
        const type = item.participantType === 'monster' ? 'monster' : 'player';
        const quantity = type === 'monster' ? Math.min(20, Math.max(1, Math.trunc(item.quantity ?? 1))) : 1;
        const creature = item.monsterBestiaryId ? creatureById.get(Number(item.monsterBestiaryId)) : undefined;
        const hp = creature ? parseHp(creature.hp) : { average: item.maxHp ?? 10, dice: '' };
        for (let index = 0; index < quantity; index += 1) {
          const displayName =
            type === 'monster'
              ? quantity > 1
                ? `${creature?.name ?? item.displayName ?? 'Существо'} ${index + 1}`
                : creature?.name ?? item.displayName ?? 'Существо'
              : (item.displayName || '').trim() || 'Игрок';
          statements.push(
            c.env.DB.prepare(
              `INSERT INTO combat_participants (id, combat_id, participant_type, user_id, player_id,
                 monster_bestiary_id, display_name, image_url, initiative_value, initiative_order,
                 current_hp, max_hp, temp_hp, armor_class, is_hidden_from_players, hide_name,
                 is_defeated, death_saves_successes, death_saves_failures, is_stable, statblock, notes, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 0, 0, 0, 0, ?, '', ?)`
            ).bind(
              newId(),
              id,
              type,
              item.userId ?? null,
              item.playerId ?? null,
              item.monsterBestiaryId ?? null,
              displayName.slice(0, 80),
              (creature ? creature.image_url || creature.image_full_url : item.imageUrl) ?? '',
              Math.trunc(item.initiativeValue ?? 0),
              order,
              type === 'monster' ? hp.average : Math.max(1, Math.trunc(item.currentHp ?? item.maxHp ?? 10)),
              type === 'monster' ? hp.average : Math.max(1, Math.trunc(item.maxHp ?? 10)),
              item.armorClass != null ? Math.trunc(item.armorClass) : creature?.ac ?? null,
              (type === 'monster' ? item.isHiddenFromPlayers !== false : false) ? 1 : 0,
              item.hideName ? 1 : 0,
              type === 'monster' ? buildStatblock(creature ?? ({ ...emptyCreature(), name: displayName } as BestiaryRow)) : '',
              ts
            )
          );
          order += 1;
        }
      }
      if (statements.length > 0) await c.env.DB.batch(statements);

      // Сортируем по инициативе (убывание) и фиксируем порядок.
      const rows = await c.env.DB.prepare(
        `SELECT id, initiative_value, created_at FROM combat_participants WHERE combat_id = ?`
      )
        .bind(id)
        .all<{ id: string; initiative_value: number; created_at: number }>();
      const sorted = (rows.results ?? []).sort((a, b) => {
        if (b.initiative_value !== a.initiative_value) return b.initiative_value - a.initiative_value;
        return a.created_at - b.created_at;
      });
      const orderStatements = sorted.map((row, index) =>
        c.env.DB.prepare(`UPDATE combat_participants SET initiative_order = ? WHERE id = ?`).bind(index, row.id)
      );
      if (orderStatements.length > 0) await c.env.DB.batch(orderStatements);
    }

    const view = await loadView(c.env, id, user);
    return c.json({ combat: view });
  });

  /* ------------------------------------------------------------------ чтение */

  app.get('/combats/:id', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Необходима авторизация' }, 401);
    const combat = await fetchCombat(c.env, c.req.param('id'));
    if (!combat) return c.json({ error: 'Бой не найден' }, 404);
    if (user.role !== 'dm' && combat.status === 'setup') {
      return c.json({ error: 'Бой ещё не начат' }, 403);
    }
    const view = await loadView(c.env, combat.id, user);
    if (!view) return c.json({ error: 'Не удалось загрузить состояние боя' }, 503);
    return c.json({ combat: view });
  });

  /* --------------------------------------------------------------- настройки */

  app.patch('/combats/:id', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Необходима авторизация' }, 401);
    if (user.role !== 'dm') return c.json({ error: 'Изменять бой может только мастер' }, 403);
    const combat = await fetchCombat(c.env, c.req.param('id'));
    if (!combat) return c.json({ error: 'Бой не найден' }, 404);

    const body = await readJson<{
        name?: string;
        status?: CombatStatus;
        settings?: {
          turnTimerSeconds?: number | null;
          allowPlayerTurn?: boolean;
          showPlayerHp?: boolean;
          showOtherDeathSaves?: boolean;
          monsterHpVisibility?: MonsterHpVisibility;
        };
      }>(c.req, {});

    const actor = actorFor(user);

    if (typeof body.name === 'string' && body.name.trim()) {
      await c.env.DB.prepare(`UPDATE combats SET name = ?, updated_at = ? WHERE id = ?`)
        .bind(body.name.trim().slice(0, MAX_NAME), Date.now(), combat.id)
        .run();
      await callRoom(c.env, combat.id, '/reload', { method: 'POST' });
    }

    if (body.settings) {
      const result = await mutate(c.env, combat.id, 'settings', { ...body.settings }, actor);
      if (!result.ok) return c.json({ error: result.error }, (result.status ?? 400) as 400);
    }

    if (body.status) {
      const result = await mutate(c.env, combat.id, 'status', { status: body.status }, actor);
      if (!result.ok) return c.json({ error: result.error }, (result.status ?? 400) as 400);
    }

    const view = await loadView(c.env, combat.id, user);
    return c.json({ combat: view });
  });

  app.delete('/combats/:id', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Необходима авторизация' }, 401);
    if (user.role !== 'dm') return c.json({ error: 'Удалять бои может только мастер' }, 403);
    const combat = await fetchCombat(c.env, c.req.param('id'));
    if (!combat) return c.json({ error: 'Бой не найден' }, 404);

    await c.env.DB.batch([
      c.env.DB.prepare(`DELETE FROM combat_log WHERE combat_id = ?`).bind(combat.id),
      c.env.DB.prepare(`DELETE FROM combat_effects WHERE combat_id = ?`).bind(combat.id),
      c.env.DB.prepare(`DELETE FROM combat_participants WHERE combat_id = ?`).bind(combat.id),
      c.env.DB.prepare(`DELETE FROM combats WHERE id = ?`).bind(combat.id),
    ]);

    return c.json({ ok: true });
  });

  /* -------------------------------------------------------------- участники */

  app.post('/combats/:id/participants', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Необходима авторизация' }, 401);
    if (user.role !== 'dm') return c.json({ error: 'Добавлять участников может только мастер' }, 403);
    const combat = await fetchCombat(c.env, c.req.param('id'));
    if (!combat) return c.json({ error: 'Бой не найден' }, 404);

    const body = await readJson<{
        participants?: Array<{
          participantType?: 'player' | 'monster';
          userId?: number;
          playerId?: number;
          monsterBestiaryId?: number;
          displayName?: string;
          imageUrl?: string;
          initiativeValue?: number;
          currentHp?: number;
          maxHp?: number;
          armorClass?: number;
          isHiddenFromPlayers?: boolean;
          hideName?: boolean;
          statblock?: string;
          quantity?: number;
        }>;
      }>(c.req, {});

    const incoming = body.participants ?? [];
    const creatureIds = incoming
      .filter((item) => item.participantType === 'monster' && item.monsterBestiaryId)
      .map((item) => Number(item.monsterBestiaryId));

    const creatureById = new Map<number, BestiaryRow>();
    if (creatureIds.length > 0) {
      const placeholders = creatureIds.map(() => '?').join(', ');
      const { results } = await c.env.DB.prepare(
        `SELECT id, name, cr, cr_numeric, creature_type, size, ac, hp, description,
                image_url, image_full_url, is_revealed, speed, senses, languages
         FROM bestiary WHERE id IN (${placeholders})`
      )
        .bind(...creatureIds)
        .all<BestiaryRow>();
      (results ?? []).forEach((row) => creatureById.set(row.id, row));
    }

    const expanded: Array<Record<string, unknown>> = [];
    for (const item of incoming) {
      const type = item.participantType === 'monster' ? 'monster' : 'player';
      const quantity = type === 'monster' ? Math.min(20, Math.max(1, Math.trunc(item.quantity ?? 1))) : 1;
      const creature = item.monsterBestiaryId ? creatureById.get(Number(item.monsterBestiaryId)) : undefined;
      const hp = creature ? parseHp(creature.hp) : { average: item.maxHp ?? 10, dice: '' };
      for (let index = 0; index < quantity; index += 1) {
        expanded.push({
          participantType: type,
          userId: item.userId ?? null,
          playerId: item.playerId ?? null,
          monsterBestiaryId: item.monsterBestiaryId ?? null,
          displayName:
            type === 'monster'
              ? quantity > 1
                ? `${creature?.name ?? 'Существо'} ${index + 1}`
                : creature?.name ?? item.displayName ?? 'Существо'
              : item.displayName ?? 'Игрок',
          imageUrl: (creature ? creature.image_url || creature.image_full_url : item.imageUrl) ?? '',
          initiativeValue: Math.trunc(item.initiativeValue ?? 0),
          currentHp: type === 'monster' ? hp.average : Math.max(1, Math.trunc(item.currentHp ?? item.maxHp ?? 10)),
          maxHp: type === 'monster' ? hp.average : Math.max(1, Math.trunc(item.maxHp ?? 10)),
          armorClass: item.armorClass ?? creature?.ac ?? null,
          isHiddenFromPlayers: type === 'monster' ? item.isHiddenFromPlayers !== false : false,
          hideName: Boolean(item.hideName),
          statblock: type === 'monster' && creature ? buildStatblock(creature) : item.statblock ?? '',
        });
      }
    }

    const result = await mutate(c.env, combat.id, 'add-participants', { participants: expanded }, actorFor(user));
    if (!result.ok) return c.json({ error: result.error }, (result.status ?? 400) as 400);
    const view = await loadView(c.env, combat.id, user);
    return c.json({ combat: view });
  });

  app.patch('/combats/:id/participants/:pid', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Необходима авторизация' }, 401);
    if (user.role !== 'dm') return c.json({ error: 'Менять участников может только мастер' }, 403);
    const combat = await fetchCombat(c.env, c.req.param('id'));
    if (!combat) return c.json({ error: 'Бой не найден' }, 404);

    const participantId = c.req.param('pid');
    const body = await readJson<{
        displayName?: string;
        initiativeValue?: number;
        currentHp?: number;
        maxHp?: number;
        tempHp?: number;
        hpDelta?: number;
        armorClass?: number | null;
        isHiddenFromPlayers?: boolean;
        hideName?: boolean;
        notes?: string;
      }>(c.req, {});

    const actor = actorFor(user);
    const payload = { participantId };

    if (typeof body.hpDelta === 'number' && body.hpDelta !== 0) {
      const result = await mutate(c.env, combat.id, 'hp', { ...payload, delta: body.hpDelta }, actor);
      if (!result.ok) return c.json({ error: result.error }, (result.status ?? 400) as 400);
    }
    if (typeof body.currentHp === 'number' || typeof body.maxHp === 'number') {
      const result = await mutate(
        c.env,
        combat.id,
        'set-hp',
        {
          ...payload,
          // undefined = «не менять текущие HP»; иначе смена одного максимума
          // обнуляла здоровье участника.
          value: typeof body.currentHp === 'number' ? body.currentHp : undefined,
          maxHp: body.maxHp,
        },
        actor
      );
      if (!result.ok) return c.json({ error: result.error }, (result.status ?? 400) as 400);
    }
    if (typeof body.tempHp === 'number') {
      const result = await mutate(c.env, combat.id, 'temp-hp', { ...payload, value: body.tempHp }, actor);
      if (!result.ok) return c.json({ error: result.error }, (result.status ?? 400) as 400);
    }
    if (typeof body.initiativeValue === 'number') {
      const result = await mutate(c.env, combat.id, 'initiative', { ...payload, value: body.initiativeValue }, actor);
      if (!result.ok) return c.json({ error: result.error }, (result.status ?? 400) as 400);
    }
    const rest: Record<string, unknown> = { ...payload };
    if (body.displayName !== undefined) rest.displayName = body.displayName;
    if (body.armorClass !== undefined) rest.armorClass = body.armorClass;
    if (body.isHiddenFromPlayers !== undefined) rest.isHiddenFromPlayers = body.isHiddenFromPlayers;
    if (body.hideName !== undefined) rest.hideName = body.hideName;
    if (body.notes !== undefined) rest.notes = body.notes;
    if (Object.keys(rest).length > 1) {
      const result = await mutate(c.env, combat.id, 'participant', rest, actor);
      if (!result.ok) return c.json({ error: result.error }, (result.status ?? 400) as 400);
    }

    const view = await loadView(c.env, combat.id, user);
    return c.json({ combat: view });
  });

  app.delete('/combats/:id/participants/:pid', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Необходима авторизация' }, 401);
    if (user.role !== 'dm') return c.json({ error: 'Удалять участников может только мастер' }, 403);
    const combat = await fetchCombat(c.env, c.req.param('id'));
    if (!combat) return c.json({ error: 'Бой не найден' }, 404);
    const result = await mutate(
      c.env,
      combat.id,
      'remove-participant',
      { participantId: c.req.param('pid') },
      actorFor(user)
    );
    if (!result.ok) return c.json({ error: result.error }, (result.status ?? 400) as 400);
    const view = await loadView(c.env, combat.id, user);
    return c.json({ combat: view });
  });

  /* ----------------------------------------------------------------- эффекты */

  app.post('/combats/:id/effects', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Необходима авторизация' }, 401);
    if (user.role !== 'dm') return c.json({ error: 'Добавлять эффекты может только мастер' }, 403);
    const combat = await fetchCombat(c.env, c.req.param('id'));
    if (!combat) return c.json({ error: 'Бой не найден' }, 404);

    const body = await readJson<{
        participantId?: string;
        effectName?: string;
        effectType?: 'condition' | 'exhaustion' | 'custom';
        exhaustionLevel?: number;
        durationType?: 'rounds' | 'until_save' | 'until_removed' | 'permanent' | null;
        durationValue?: number | null;
        description?: string;
        isVisibleToPlayers?: boolean;
      }>(c.req, {});

    if (!body.participantId || !body.effectName) {
      return c.json({ error: 'Нужны participantId и effectName' }, 400);
    }

    const result = await mutate(
      c.env,
      combat.id,
      body.effectType === 'exhaustion' ? 'exhaustion' : 'effect-add',
      { ...body },
      actorFor(user)
    );
    if (!result.ok) return c.json({ error: result.error }, (result.status ?? 400) as 400);
    const view = await loadView(c.env, combat.id, user);
    return c.json({ combat: view });
  });

  app.patch('/combats/:id/effects/:eid', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Необходима авторизация' }, 401);
    if (user.role !== 'dm') return c.json({ error: 'Менять эффекты может только мастер' }, 403);
    const combat = await fetchCombat(c.env, c.req.param('id'));
    if (!combat) return c.json({ error: 'Бой не найден' }, 404);
    const body = await readJson<{ durationValue?: number; description?: string; isVisibleToPlayers?: boolean }>(c.req, {});
    const result = await mutate(
      c.env,
      combat.id,
      'effect-update',
      { effectId: c.req.param('eid'), ...body },
      actorFor(user)
    );
    if (!result.ok) return c.json({ error: result.error }, (result.status ?? 400) as 400);
    const view = await loadView(c.env, combat.id, user);
    return c.json({ combat: view });
  });

  app.delete('/combats/:id/effects/:eid', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Необходима авторизация' }, 401);
    if (user.role !== 'dm') return c.json({ error: 'Снимать эффекты может только мастер' }, 403);
    const combat = await fetchCombat(c.env, c.req.param('id'));
    if (!combat) return c.json({ error: 'Бой не найден' }, 404);
    const result = await mutate(c.env, combat.id, 'effect-remove', { effectId: c.req.param('eid') }, actorFor(user));
    if (!result.ok) return c.json({ error: result.error }, (result.status ?? 400) as 400);
    const view = await loadView(c.env, combat.id, user);
    return c.json({ combat: view });
  });

  /* ------------------------------------------------- ход, таймер, спасброски */

  app.post('/combats/:id/next-turn', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Необходима авторизация' }, 401);
    const combat = await fetchCombat(c.env, c.req.param('id'));
    if (!combat) return c.json({ error: 'Бой не найден' }, 404);
    const result = await mutate(c.env, combat.id, 'next-turn', {}, actorFor(user));
    if (!result.ok) return c.json({ error: result.error }, (result.status ?? 400) as 400);
    const view = await loadView(c.env, combat.id, user);
    return c.json({ combat: view });
  });

  app.post('/combats/:id/timer', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Необходима авторизация' }, 401);
    if (user.role !== 'dm') return c.json({ error: 'Управлять таймером может только мастер' }, 403);
    const combat = await fetchCombat(c.env, c.req.param('id'));
    if (!combat) return c.json({ error: 'Бой не найден' }, 404);
    const body = await readJson<{ action?: 'configure' | 'pause' | 'reset' | 'extend'; seconds?: number | null }>(c.req, {});
    const result = await mutate(c.env, combat.id, 'timer', { ...body }, actorFor(user));
    if (!result.ok) return c.json({ error: result.error }, (result.status ?? 400) as 400);
    const view = await loadView(c.env, combat.id, user);
    return c.json({ combat: view });
  });

  app.post('/combats/:id/death-saves', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Необходима авторизация' }, 401);
    if (user.role !== 'dm') return c.json({ error: 'Отмечать спасброски может только мастер' }, 403);
    const combat = await fetchCombat(c.env, c.req.param('id'));
    if (!combat) return c.json({ error: 'Бой не найден' }, 404);
    const body = await readJson<{ participantId?: string; kind?: 'success' | 'failure'; stable?: boolean }>(c.req, {});

    const action = body.stable !== undefined ? 'stabilize' : 'death-save';
    const result = await mutate(c.env, combat.id, action, { ...body }, actorFor(user));
    if (!result.ok) return c.json({ error: result.error }, (result.status ?? 400) as 400);
    const view = await loadView(c.env, combat.id, user);
    return c.json({ combat: view });
  });

  app.post('/combats/:id/exhaustion', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Необходима авторизация' }, 401);
    if (user.role !== 'dm') return c.json({ error: 'Менять истощение может только мастер' }, 403);
    const combat = await fetchCombat(c.env, c.req.param('id'));
    if (!combat) return c.json({ error: 'Бой не найден' }, 404);
    const body = await readJson<{ participantId?: string; level?: number }>(c.req, {});
    const result = await mutate(
      c.env,
      combat.id,
      'exhaustion',
      { participantId: body.participantId, level: body.level ?? 1 },
      actorFor(user)
    );
    if (!result.ok) return c.json({ error: result.error }, (result.status ?? 400) as 400);
    const view = await loadView(c.env, combat.id, user);
    return c.json({ combat: view });
  });

  app.get('/combats/:id/log', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Необходима авторизация' }, 401);
    const combat = await fetchCombat(c.env, c.req.param('id'));
    if (!combat) return c.json({ error: 'Бой не найден' }, 404);

    const isDm = user.role === 'dm';
    // В живом бою журнал содержит скрытые эффекты и имена — читает только мастер.
    // Завершённый бой становится историей партии, но имена скрытых существ
    // остаются скрытыми и в архиве.
    if (!isDm && combat.status !== 'finished') {
      return c.json({ error: 'Журнал идущего боя доступен только мастеру' }, 403);
    }

    const { results } = await c.env.DB.prepare(
      `SELECT id, event_type, participant_id, payload_json, created_at
       FROM combat_log WHERE combat_id = ? ORDER BY created_at DESC LIMIT 200`
    )
      .bind(combat.id)
      .all<{ id: string; event_type: string; participant_id: string | null; payload_json: string; created_at: number }>();

    const hiddenIds = new Set<string>();
    if (!isDm) {
      const { results: participants } = await c.env.DB.prepare(
        `SELECT id, hide_name FROM combat_participants WHERE combat_id = ? AND hide_name = 1`
      )
        .bind(combat.id)
        .all<{ id: string; hide_name: number }>();
      for (const row of participants ?? []) hiddenIds.add(row.id);
    }

    return c.json({
      log: (results ?? []).map((row) => {
        const payload = JSON.parse(row.payload_json || '{}') as Record<string, unknown>;
        if (!isDm && row.participant_id && hiddenIds.has(row.participant_id)) {
          return {
            id: row.id,
            eventType: row.event_type,
            participantId: null,
            payload: { ...payload, name: 'Неизвестное существо', hp: undefined, maxHp: undefined },
            createdAt: row.created_at,
          };
        }
        return {
          id: row.id,
          eventType: row.event_type,
          participantId: row.participant_id,
          payload,
          createdAt: row.created_at,
        };
      }),
    });
  });

  /* --------------------------------------------------------------- WebSocket */

  app.get('/combats/:id/ws', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Требуется авторизация для WebSocket-подключения' }, 401);
    const combat = await fetchCombat(c.env, c.req.param('id'));
    if (!combat) return c.json({ error: 'Бой не найден' }, 404);
    if (user.role !== 'dm' && combat.status === 'setup') return c.json({ error: 'Бой ещё не начат' }, 403);
    if (c.req.header('Upgrade')?.toLowerCase() !== 'websocket') {
      return c.json({ error: 'Expected WebSocket Upgrade' }, 426);
    }
    if (!c.env.COMBAT_ROOM) return c.json({ error: 'Durable Object COMBAT_ROOM не настроен' }, 503);

    const stub = roomStub(c.env, combat.id)!;
    const doUrl = new URL('https://combat-do.internal/ws');
    doUrl.searchParams.set('combatId', combat.id);
    doUrl.searchParams.set('userId', String(user.id));
    doUrl.searchParams.set('displayName', user.displayName);
    doUrl.searchParams.set('role', user.role === 'dm' ? 'dm' : 'player');
    if (user.playerId != null) doUrl.searchParams.set('playerId', String(user.playerId));
    doUrl.searchParams.set('color', user.theme?.accent || '#22d3ee');
    if (user.avatarUrl) doUrl.searchParams.set('avatar', user.avatarUrl);

    return stub.fetch(new Request(doUrl.toString(), c.req.raw));
  });

}

function emptyCreature(): BestiaryRow {
  return {
    id: 0,
    name: 'Существо',
    cr: '1',
    cr_numeric: 1,
    creature_type: 'Чудовище',
    size: '',
    ac: 12,
    hp: '10',
    description: '',
    image_url: '',
    image_full_url: '',
    is_revealed: 0,
    speed: '',
    senses: '',
    languages: '',
  };
}

export type { CombatParticipantView };
