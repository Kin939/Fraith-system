import { DurableObject } from 'cloudflare:workers';
import {
  DND_CONDITIONS,
  MAX_EXHAUSTION,
  conditionRule,
  type CombatActor,
  type CombatActorRole,
  type CombatEffect,
  type CombatLogEntry,
  type CombatParticipantView,
  type CombatSettings,
  type CombatStatus,
  type CombatView,
  type DeathSavesView,
  type EffectDurationType,
  type EffectType,
  type MonsterHpVisibility,
  type ParticipantType,
} from '../src/lib/combatProtocol';

/**
 * CombatRoom — один Durable Object на один бой.
 *
 * Ответственность:
 *  • авторитарное состояние боя: порядок инициативы, текущий ход, раунд, HP, эффекты, таймер;
 *  • немедленная рассылка изменений всем подключённым клиентам;
 *  • фильтрация данных по роли: игроки физически не получают HP/AC/стат-блоки
 *    скрытых мобов — сервер не отправляет скрытые числа вовсе;
 *  • персист состояния в D1 (`combats` / `combat_participants` / `combat_effects` / `combat_log`);
 *  • эфемерный presence (кто сейчас на вкладке «Бой»).
 *
 * Полностью изолирован от CampaignRoom и BoardRoom.
 */

export interface CombatRoomEnv {
  DB: D1Database;
  CAMPAIGN_ID?: string;
}

interface CombatRow {
  id: string;
  campaign_id: string;
  name: string;
  status: CombatStatus;
  current_turn_index: number;
  round_number: number;
  turn_timer_seconds: number | null;
  turn_timer_ends_at: number | null;
  turn_timer_paused_remaining_ms: number | null;
  allow_player_turn: number;
  show_player_hp: number;
  show_other_death_saves: number;
  monster_hp_visibility: MonsterHpVisibility;
  created_by: number;
  created_at: number;
  updated_at: number;
}

interface ParticipantRow {
  id: string;
  combat_id: string;
  participant_type: ParticipantType;
  user_id: number | null;
  player_id: number | null;
  monster_bestiary_id: number | null;
  display_name: string;
  image_url: string;
  initiative_value: number;
  initiative_order: number;
  current_hp: number | null;
  max_hp: number | null;
  temp_hp: number;
  armor_class: number | null;
  is_hidden_from_players: number;
  hide_name: number;
  is_defeated: number;
  death_saves_successes: number;
  death_saves_failures: number;
  is_stable: number;
  statblock: string;
  notes: string;
  created_at: number;
}

interface EffectRow {
  id: string;
  combat_id: string;
  participant_id: string;
  effect_name: string;
  effect_type: EffectType;
  exhaustion_level: number;
  duration_type: EffectDurationType | null;
  duration_value: number | null;
  description: string;
  is_visible_to_players: number;
  created_at: number;
}

interface CombatState {
  meta: CombatRow;
  participants: ParticipantRow[];
  effects: EffectRow[];
  /** Участники, удалённые в этой сессии, — чтобы вычистить их из D1 при persist */
  removedParticipantIds?: string[];
}

export interface CombatAttachment {
  userId: number;
  displayName: string;
  role: CombatActorRole;
  playerId: number | null;
  color: string;
  avatarUrl: string | null;
  connectedAt: number;
}

const LOG_LIMIT = 400;
const VIEW_LOG_LIMIT = 60;

const now = () => Date.now();
const newId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

const clampInt = (value: unknown, min: number, max: number, fallback = 0): number => {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
};

const normalizeTimerSeconds = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '' || value === 0) return null;
  const parsed = clampInt(value, 5, 3600, 60);
  return parsed > 0 ? parsed : null;
};

const normalizeHpVisibility = (value: unknown): MonsterHpVisibility =>
  value === 'hidden' || value === 'numbers' || value === 'bar' ? value : 'bar';

const normalizeDuration = (value: unknown): EffectDurationType | null =>
  value === 'rounds' || value === 'until_save' || value === 'until_removed' || value === 'permanent'
    ? value
    : null;

export class CombatRoom extends DurableObject<CombatRoomEnv> {
  private state: CombatState | null = null;
  private loadPromise: Promise<void> | null = null;
  private combatId = '';
  private log: CombatLogEntry[] = [];
  private pendingLog: CombatLogEntry[] = [];
  private peers = new Map<number, CombatAttachment>();
  private persistQueued = false;

  /* ------------------------------------------------------------- lifecycle */

  private ensureLoaded(): Promise<void> {
    if (this.state) return Promise.resolve();
    if (!this.loadPromise) {
      this.loadPromise = this.load().finally(() => {
        this.loadPromise = null;
      });
    }
    return this.loadPromise;
  }

  private async load(): Promise<void> {
    const combatId = this.combatId;
    if (!combatId) return;
    const meta = await this.env.DB.prepare(`SELECT * FROM combats WHERE id = ?`)
      .bind(combatId)
      .first<CombatRow>();
    if (!meta) return;
    const participants = await this.env.DB.prepare(
      `SELECT * FROM combat_participants WHERE combat_id = ? ORDER BY initiative_order ASC`
    )
      .bind(combatId)
      .all<ParticipantRow>();
    const effects = await this.env.DB.prepare(`SELECT * FROM combat_effects WHERE combat_id = ?`)
      .bind(combatId)
      .all<EffectRow>();
    const logRows = await this.env.DB.prepare(
      `SELECT * FROM combat_log WHERE combat_id = ? ORDER BY created_at DESC LIMIT ?`
    )
      .bind(combatId, LOG_LIMIT)
      .all<{ id: string; event_type: string; participant_id: string | null; payload_json: string; created_at: number }>();

    this.log = (logRows.results ?? [])
      .map((row) => ({
        id: row.id,
        eventType: row.event_type,
        participantId: row.participant_id,
        payload: safeJson(row.payload_json),
        createdAt: row.created_at,
      }))
      .reverse();

    this.state = {
      meta,
      participants: participants.results ?? [],
      effects: effects.results ?? [],
    };
  }

  /** Подхватить изменения, сделанные напрямую в D1 (REST-роуты создания боя). */
  async reload(): Promise<void> {
    this.state = null;
    await this.ensureLoaded();
    this.broadcastState();
  }

  /* ------------------------------------------------------------------ fetch */

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    this.combatId = url.searchParams.get('combatId') || this.combatId;
    await this.ensureLoaded();

    if (!this.state) {
      return Response.json({ error: 'Бой не найден' }, { status: 404 });
    }

    const upgrade = request.headers.get('Upgrade')?.toLowerCase() === 'websocket';

    if (!upgrade) {
      if (url.pathname === '/state') {
        const role = (url.searchParams.get('role') === 'dm' ? 'dm' : 'player') as CombatActorRole;
        const userId = Number.parseInt(url.searchParams.get('userId') || '0', 10);
        const playerIdParam = Number.parseInt(url.searchParams.get('playerId') || '0', 10);
        return Response.json(this.buildView(role, userId, playerIdParam || null));
      }
      if (url.pathname === '/mutate' && request.method === 'POST') {
        const body = (await request.json().catch(() => ({}))) as {
          action?: string;
          payload?: Record<string, unknown>;
          actor?: CombatActor;
        };
        if (!body.action || !body.actor) return Response.json({ error: 'Некорректный запрос' }, { status: 400 });
        const result = await this.applyAction(body.action, body.payload ?? {}, body.actor);
        if (!result.ok) return Response.json({ error: result.error }, { status: result.status ?? 400 });
        // REST-мутация обязана разослать новое состояние всем открытым сокетам,
        // иначе игроки видят изменения только после перезагрузки страницы.
        if (result.stateChanged) this.broadcastState();
        return Response.json(result.view ?? this.buildView(body.actor.role, body.actor.userId, body.actor.playerId));
      }
      if (url.pathname === '/reload' && request.method === 'POST') {
        await this.reload();
        return Response.json({ ok: true });
      }
      if (url.pathname === '/peers') {
        return Response.json({ peers: [...this.peers.values()] });
      }
      return new Response('CombatRoom Durable Object Active', { status: 200 });
    }

    const userId = Number.parseInt(url.searchParams.get('userId') || '0', 10);
    if (!userId) return new Response('Forbidden', { status: 403 });

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    const attachment: CombatAttachment = {
      userId,
      displayName: url.searchParams.get('displayName') || 'Участник',
      role: url.searchParams.get('role') === 'dm' ? 'dm' : 'player',
      playerId: Number.parseInt(url.searchParams.get('playerId') || '0', 10) || null,
      color: normalizeColor(url.searchParams.get('color')),
      avatarUrl: normalizeAvatar(url.searchParams.get('avatar')),
      connectedAt: now(),
    };
    this.ctx.acceptWebSocket(server, [`user:${userId}`]);
    server.serializeAttachment(attachment);
    this.peers.set(userId, attachment);
    this.broadcastPresence();
    return new Response(null, { status: 101, webSocket: client });
  }

  /* -------------------------------------------------------------- WS events */

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    await this.ensureLoaded();
    if (typeof message !== 'string' || !this.state) return;
    const peer = ws.deserializeAttachment() as CombatAttachment | null;
    if (!peer) return;

    let parsed: { type?: string; payload?: Record<string, unknown> } = {};
    try {
      parsed = JSON.parse(message) as { type?: string; payload?: Record<string, unknown> };
    } catch {
      return;
    }

    if (parsed.type === 'ping') {
      safeSend(ws, { type: 'pong', timestamp: now() });
      return;
    }
    if (parsed.type === 'hello') {
      this.peers.set(peer.userId, peer);
      safeSend(ws, {
        type: 'welcome',
        payload: {
          selfId: peer.userId,
          role: peer.role,
          state: this.buildView(peer.role, peer.userId, peer.playerId),
          peers: [...this.peers.values()],
        },
      });
      this.broadcastPresence();
      return;
    }

    const action = parsed.type;
    if (!action) return;
    const actor: CombatActor = {
      userId: peer.userId,
      role: peer.role,
      playerId: peer.playerId,
      displayName: peer.displayName,
    };
    const result = await this.applyAction(action, parsed.payload ?? {}, actor);
    if (!result.ok) {
      safeSend(ws, { type: 'error', payload: { message: result.error } });
      return;
    }
    if (result.stateChanged) this.broadcastState();
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const peer = ws.deserializeAttachment() as CombatAttachment | null;
    if (peer) this.peers.delete(peer.userId);
    this.broadcastPresence();
    try {
      ws.close();
    } catch {
      /* уже закрыт */
    }
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    const peer = ws.deserializeAttachment() as CombatAttachment | null;
    if (peer) this.peers.delete(peer.userId);
    this.broadcastPresence();
  }

  /* ------------------------------------------------------------- view build */

  private buildView(role: CombatActorRole, userId: number, playerId: number | null): CombatView {
    const state = this.state!;
    const isDm = role === 'dm';
    const meta = state.meta;
    const currentId = state.participants[meta.current_turn_index]?.id ?? null;

    const participants: CombatParticipantView[] = state.participants.map((row) => {
      const isYou =
        row.participant_type === 'player' &&
        ((userId != null && row.user_id === userId) || (playerId != null && row.player_id === playerId));
      const concealed = !isDm && Boolean(row.is_hidden_from_players);
      const playerHpVisible = isDm || isYou || Boolean(meta.show_player_hp);
      const canSeeNumbers =
        isDm ||
        (row.participant_type === 'player'
          ? playerHpVisible
          : !concealed && meta.monster_hp_visibility === 'numbers');
      const canSeeBar =
        isDm ||
        (row.participant_type === 'player'
          ? playerHpVisible
          : !concealed && meta.monster_hp_visibility !== 'hidden');

      const effects = state.effects
        .filter((effect) => effect.participant_id === row.id)
        .filter((effect) => isDm || Boolean(effect.is_visible_to_players))
        .map(mapEffect);

      const exhaustion = state.effects.find(
        (effect) => effect.participant_id === row.id && effect.effect_type === 'exhaustion'
      );
      const deathSavesVisible = isDm || isYou || Boolean(meta.show_other_death_saves);
      const deathSaves: DeathSavesView | null =
        row.participant_type === 'player' && deathSavesVisible && !concealed
          ? {
              successes: row.death_saves_successes,
              failures: row.death_saves_failures,
              stable: Boolean(row.is_stable),
            }
          : null;

      const maxHp = row.max_hp ?? null;
      const currentHp = row.current_hp ?? null;
      const hpNumbers = canSeeNumbers && currentHp != null ? currentHp : null;
      const hpMax = canSeeNumbers ? maxHp : null;

      return {
        id: row.id,
        participantType: row.participant_type,
        displayName: !isDm && row.hide_name ? 'Неизвестное существо' : row.display_name,
        imageUrl: row.image_url,
        initiativeValue: row.initiative_value,
        initiativeOrder: row.initiative_order,
        isCurrent: row.id === currentId,
        isHiddenFromPlayers: Boolean(row.is_hidden_from_players),
        hideName: Boolean(row.hide_name),
        isDefeated: Boolean(row.is_defeated),
        isYou,
        userId: row.user_id,
        playerId: row.player_id,
        monsterBestiaryId: row.monster_bestiary_id,
        currentHp: hpNumbers,
        maxHp: hpMax,
        tempHp: canSeeNumbers ? row.temp_hp : null,
        armorClass: isDm || (!concealed && row.participant_type === 'player') ? row.armor_class : null,
        // Полоса считается по истинным значениям даже когда числа скрыты —
        // иначе игрок видел бы пустой индикатор вместо доли HP.
        hpPercent:
          canSeeBar && maxHp && maxHp > 0
            ? Math.max(0, Math.min(100, Math.round(((currentHp ?? 0) / maxHp) * 100)))
            : null,
        hpNumbersVisible: Boolean(canSeeNumbers),
        deathSaves,
        exhaustionLevel: exhaustion?.exhaustion_level ?? 0,
        effects,
        statblock: isDm ? row.statblock : null,
        notes: isDm ? row.notes : null,
        monsterMeta: null,
      };
    });

    const currentParticipant = state.participants[meta.current_turn_index];
    const canAdvanceTurn =
      isDm ||
      (Boolean(meta.allow_player_turn) &&
        Boolean(currentParticipant) &&
        currentParticipant.participant_type === 'player' &&
        ((userId != null && currentParticipant.user_id === userId) ||
          (playerId != null && currentParticipant.player_id === playerId)));

    return {
      id: meta.id,
      campaignId: meta.campaign_id,
      name: meta.name,
      status: meta.status,
      currentTurnIndex: meta.current_turn_index,
      roundNumber: meta.round_number,
      createdAt: meta.created_at,
      updatedAt: meta.updated_at,
      createdBy: meta.created_by,
      isDm,
      canAdvanceTurn,
      settings: {
        turnTimerSeconds: meta.turn_timer_seconds,
        turnTimerEndsAt: meta.turn_timer_ends_at,
        turnTimerPausedRemainingMs: meta.turn_timer_paused_remaining_ms,
        allowPlayerTurn: Boolean(meta.allow_player_turn),
        showPlayerHp: Boolean(meta.show_player_hp),
        showOtherDeathSaves: Boolean(meta.show_other_death_saves),
        monsterHpVisibility: meta.monster_hp_visibility,
      },
      participants,
      // Журнал содержит имена скрытых существ и скрытые эффекты — только мастеру.
      log: isDm ? this.log.slice(-VIEW_LOG_LIMIT) : [],
    };
  }

  private broadcastState(): void {
    const sockets = this.ctx.getWebSockets();
    for (const ws of sockets) {
      const peer = ws.deserializeAttachment() as CombatAttachment | null;
      if (!peer) continue;
      safeSend(ws, {
        type: 'state',
        payload: {
          state: this.buildView(peer.role, peer.userId, peer.playerId),
          peers: [...this.peers.values()],
        },
      });
    }
  }

  private broadcastPresence(): void {
    const payload = { type: 'presence', payload: { peers: [...this.peers.values()] } };
    for (const ws of this.ctx.getWebSockets()) safeSend(ws, payload);
  }

  /* ------------------------------------------------------------- mutations */

  private async applyAction(
    action: string,
    payload: Record<string, unknown>,
    actor: CombatActor
  ): Promise<{ ok: boolean; error?: string; status?: number; view?: CombatView; stateChanged?: boolean }> {
    await this.ensureLoaded();
    if (!this.state) return { ok: false, error: 'Бой не найден', status: 404 };
    const meta = this.state.meta;
    const isDm = actor.role === 'dm';

    if (meta.status === 'finished' && action !== 'status') {
      return { ok: false, error: 'Бой завершён — трекер доступен только для чтения', status: 409 };
    }

    const currentRow = this.state.participants[meta.current_turn_index];
    const isMyTurn =
      Boolean(currentRow) &&
      currentRow.participant_type === 'player' &&
      ((actor.userId != null && currentRow.user_id === actor.userId) ||
        (actor.playerId != null && currentRow.player_id === actor.playerId));

    // Завершать ход может мастер — либо игрок в свой ход, если мастер разрешил.
    if (action === 'next-turn' || action === 'timer') {
      const allowed = isDm || (meta.allow_player_turn && isMyTurn && action === 'next-turn');
      if (!allowed) return { ok: false, error: 'Недостаточно прав', status: 403 };
    } else if (!isDm) {
      return { ok: false, error: 'Управлять боем может только Мастер', status: 403 };
    }

    switch (action) {
      case 'next-turn':
        await this.advanceTurn();
        break;
      case 'hp':
        await this.changeHp(payload);
        break;
      case 'set-hp':
        await this.setHp(payload);
        break;
      case 'temp-hp':
        await this.setTempHp(payload);
        break;
      case 'initiative':
        await this.setInitiative(payload);
        break;
      case 'participant':
        await this.updateParticipant(payload);
        break;
      case 'add-participants':
        await this.addParticipants(payload);
        break;
      case 'remove-participant':
        await this.removeParticipant(payload);
        break;
      case 'effect-add':
        await this.addEffect(payload);
        break;
      case 'effect-update':
        await this.updateEffect(payload);
        break;
      case 'effect-remove':
        await this.removeEffect(payload);
        break;
      case 'exhaustion':
        await this.setExhaustion(payload);
        break;
      case 'death-save':
        await this.deathSave(payload);
        break;
      case 'stabilize':
        await this.stabilize(payload);
        break;
      case 'timer':
        await this.timerAction(payload);
        break;
      case 'settings':
        await this.updateSettings(payload);
        break;
      case 'status':
        await this.setStatus(payload, actor);
        break;
      default:
        return { ok: false, error: `Неизвестное действие: ${action}`, status: 400 };
    }

    this.state.meta.updated_at = now();
    await this.persist();
    return { ok: true, stateChanged: true };
  }

  private participant(id: unknown): ParticipantRow | null {
    const pid = typeof id === 'string' ? id : '';
    return this.state?.participants.find((row) => row.id === pid) ?? null;
  }

  private async advanceTurn(): Promise<void> {
    const state = this.state!;
    const meta = state.meta;
    if (state.participants.length === 0) return;

    const leaving = state.participants[meta.current_turn_index];
    if (leaving) {
      await this.tickEffects(leaving.id);
      await this.appendLog('turn_end', leaving.id, { name: leaving.display_name });
    }

    let nextIndex = meta.current_turn_index + 1;
    if (nextIndex >= state.participants.length) {
      nextIndex = 0;
      meta.round_number += 1;
      await this.appendLog('round_start', null, { round: meta.round_number });
    }
    meta.current_turn_index = nextIndex;

    const next = state.participants[nextIndex];
    if (next) {
      await this.appendLog('turn_start', next.id, { name: next.display_name, round: meta.round_number });
    }
    this.restartTurnTimer();
  }

  /** Уменьшает счётчики эффектов с длительностью в раундах на завершении хода. */
  private async tickEffects(participantId: string): Promise<void> {
    const state = this.state!;
    const expiring: EffectRow[] = [];
    for (const effect of state.effects) {
      if (effect.participant_id !== participantId) continue;
      if (effect.duration_type !== 'rounds' || effect.duration_value == null) continue;
      effect.duration_value -= 1;
      if (effect.duration_value <= 0) expiring.push(effect);
    }
    for (const effect of expiring) {
      state.effects = state.effects.filter((item) => item.id !== effect.id);
      await this.appendLog('effect_removed', participantId, {
        name: effect.effect_name,
        reason: 'duration',
      });
    }
  }

  private restartTurnTimer(): void {
    const meta = this.state!.meta;
    if (!meta.turn_timer_seconds || meta.turn_timer_seconds <= 0) {
      meta.turn_timer_ends_at = null;
      meta.turn_timer_paused_remaining_ms = null;
      return;
    }
    meta.turn_timer_ends_at = now() + meta.turn_timer_seconds * 1000;
    meta.turn_timer_paused_remaining_ms = null;
  }

  private async changeHp(payload: Record<string, unknown>): Promise<void> {
    const row = this.participant(payload.participantId);
    if (!row) return;
    const delta = clampInt(payload.delta, -9999, 9999, 0);
    if (delta === 0) return;

    if (row.participant_type === 'monster') {
      const max = row.max_hp ?? 0;
      let remaining = delta;
      if (delta < 0 && row.temp_hp > 0) {
        const absorbed = Math.min(row.temp_hp, -delta);
        row.temp_hp -= absorbed;
        remaining = delta + absorbed;
      }
      const next = Math.max(0, Math.min(max, (row.current_hp ?? 0) + remaining));
      row.current_hp = next;
      row.is_defeated = next <= 0 ? 1 : 0;
      await this.appendLog(delta < 0 ? 'damage' : 'heal', row.id, {
        name: row.display_name,
        delta,
        hp: next,
        max,
      });
      return;
    }

    // Игрок: урон/лечение с учётом спасбросков от смерти.
    let remaining = delta;
    if (delta < 0 && row.temp_hp > 0) {
      const absorbed = Math.min(row.temp_hp, -delta);
      row.temp_hp -= absorbed;
      remaining = delta + absorbed;
    }
    const next = Math.max(0, (row.current_hp ?? 0) + remaining);
    row.current_hp = next;
    if (next > 0) {
      row.is_defeated = 0;
      row.is_stable = 0;
      row.death_saves_successes = 0;
      row.death_saves_failures = 0;
      this.state!.effects = this.state!.effects.filter(
        (effect) =>
          !(
            effect.participant_id === row.id &&
            effect.effect_type === 'condition' &&
            effect.effect_name === 'Unconscious'
          )
      );
    } else if (next === 0 && (row.current_hp ?? 0) === 0) {
      this.ensureUnconscious(row);
    }
    await this.appendLog(delta < 0 ? 'damage' : 'heal', row.id, { name: row.display_name, delta, hp: next });
  }

  private async setHp(payload: Record<string, unknown>): Promise<void> {
    const row = this.participant(payload.participantId);
    if (!row) return;
    // Раньше здесь стоял `row.max_hp ?? clampInt(payload.maxHp, …)`: при уже
    // заданном максимуме новое значение из панели игнорировалось.
    if (payload.maxHp !== undefined) row.max_hp = clampInt(payload.maxHp, 1, 9999, row.max_hp ?? 10);
    const max = Math.max(1, row.max_hp ?? 10);

    // Меняли только максимум — текущие HP не трогаем (иначе персонаж «умирал»
    // от одного изменения максимального значения). Просто подрезаем до нового максимума.
    if (payload.value === undefined) {
      if ((row.current_hp ?? 0) > max) row.current_hp = max;
      await this.appendLog('participant_updated', row.id, { name: row.display_name, max });
      return;
    }

    const value = clampInt(payload.value, 0, max, 0);
    row.current_hp = value;
    row.is_defeated = value <= 0 ? 1 : 0;
    if (row.participant_type === 'player') {
      if (value > 0) {
        row.is_stable = 0;
        row.death_saves_successes = 0;
        row.death_saves_failures = 0;
        this.state!.effects = this.state!.effects.filter(
          (effect) =>
            !(
              effect.participant_id === row.id &&
              effect.effect_type === 'condition' &&
              effect.effect_name === 'Unconscious'
            )
        );
      } else {
        this.ensureUnconscious(row);
      }
    }
    await this.appendLog('hp_set', row.id, { name: row.display_name, hp: value, max });
  }

  private async setTempHp(payload: Record<string, unknown>): Promise<void> {
    const row = this.participant(payload.participantId);
    if (!row) return;
    row.temp_hp = clampInt(payload.value, 0, 999, 0);
    await this.appendLog('temp_hp', row.id, { name: row.display_name, temp: row.temp_hp });
  }

  private ensureUnconscious(row: ParticipantRow): void {
    const state = this.state!;
    const existing = state.effects.find(
      (effect) =>
        effect.participant_id === row.id && effect.effect_type === 'condition' && effect.effect_name === 'Unconscious'
    );
    row.is_defeated = 1;
    row.death_saves_successes = 0;
    row.death_saves_failures = 0;
    row.is_stable = 0;
    if (existing) return;
    state.effects.push({
      id: newId('ce'),
      combat_id: row.combat_id,
      participant_id: row.id,
      effect_name: 'Unconscious',
      effect_type: 'condition',
      exhaustion_level: 0,
      duration_type: null,
      duration_value: null,
      description: conditionRule('Unconscious')?.description ?? '',
      is_visible_to_players: 1,
      created_at: now(),
    });
  }

  private async setInitiative(payload: Record<string, unknown>): Promise<void> {
    const row = this.participant(payload.participantId);
    if (!row) return;
    const value = clampInt(payload.value, -99, 99, row.initiative_value);
    row.initiative_value = value;
    const currentId = this.state!.participants[this.state!.meta.current_turn_index]?.id ?? null;
    this.resort(currentId);
    await this.appendLog('initiative_changed', row.id, { name: row.display_name, initiative: value });
  }

  /** Пересортировка инициативы с сохранением текущего хода. */
  private resort(currentId: string | null): void {
    const state = this.state!;
    state.participants.sort((a, b) => {
      if (b.initiative_value !== a.initiative_value) return b.initiative_value - a.initiative_value;
      return a.created_at - b.created_at;
    });
    state.participants.forEach((row, index) => {
      row.initiative_order = index;
    });
    if (currentId) {
      const index = state.participants.findIndex((row) => row.id === currentId);
      state.meta.current_turn_index = index >= 0 ? index : 0;
    } else {
      state.meta.current_turn_index = Math.min(
        state.meta.current_turn_index,
        Math.max(0, state.participants.length - 1)
      );
    }
  }

  private async updateParticipant(payload: Record<string, unknown>): Promise<void> {
    const row = this.participant(payload.participantId);
    if (!row) return;
    if (typeof payload.displayName === 'string' && payload.displayName.trim()) {
      row.display_name = payload.displayName.trim().slice(0, 80);
    }
    if (payload.armorClass !== undefined) {
      row.armor_class = payload.armorClass === null ? null : clampInt(payload.armorClass, 0, 40, row.armor_class ?? 10);
    }
    if (payload.maxHp !== undefined) {
      row.max_hp = clampInt(payload.maxHp, 1, 9999, row.max_hp ?? 1);
      if ((row.current_hp ?? 0) > row.max_hp) row.current_hp = row.max_hp;
    }
    if (payload.currentHp !== undefined) {
      const max = row.max_hp ?? 10;
      const value = clampInt(payload.currentHp, 0, max, row.current_hp ?? 0);
      row.current_hp = value;
      row.is_defeated = value <= 0 ? 1 : 0;
      if (row.participant_type === 'player') {
        if (value > 0) {
          row.is_stable = 0;
          row.death_saves_successes = 0;
          row.death_saves_failures = 0;
          this.state!.effects = this.state!.effects.filter(
            (effect) =>
              !(
                effect.participant_id === row.id &&
                effect.effect_type === 'condition' &&
                effect.effect_name === 'Unconscious'
              )
          );
        } else {
          this.ensureUnconscious(row);
        }
      }
    }
    if (payload.tempHp !== undefined) row.temp_hp = clampInt(payload.tempHp, 0, 999, 0);
    if (payload.isHiddenFromPlayers !== undefined) {
      row.is_hidden_from_players = payload.isHiddenFromPlayers ? 1 : 0;
    }
    if (payload.hideName !== undefined) {
      row.hide_name = payload.hideName ? 1 : 0;
    }
    if (typeof payload.notes === 'string') row.notes = payload.notes.slice(0, 2000);
    if (payload.initiativeValue !== undefined) {
      row.initiative_value = clampInt(payload.initiativeValue, -99, 99, row.initiative_value);
      const currentId = this.state!.participants[this.state!.meta.current_turn_index]?.id ?? null;
      this.resort(currentId);
    }
    await this.appendLog('participant_updated', row.id, { name: row.display_name });
  }

  private async addParticipants(payload: Record<string, unknown>): Promise<void> {
    const state = this.state!;
    const list = Array.isArray(payload.participants) ? (payload.participants as Array<Record<string, unknown>>) : [];
    for (const item of list) {
      const type: ParticipantType = item.participantType === 'monster' ? 'monster' : 'player';
      const row: ParticipantRow = {
        id: newId('cp'),
        combat_id: state.meta.id,
        participant_type: type,
        user_id: item.userId != null ? clampInt(item.userId, 1, 999999, 0) : null,
        player_id: item.playerId != null ? clampInt(item.playerId, 1, 999, 0) : null,
        monster_bestiary_id: item.monsterBestiaryId != null ? clampInt(item.monsterBestiaryId, 1, 9999999, 0) : null,
        display_name:
          typeof item.displayName === 'string' && item.displayName.trim()
            ? item.displayName.trim().slice(0, 80)
            : type === 'monster'
              ? 'Существо'
              : 'Игрок',
        image_url: typeof item.imageUrl === 'string' ? item.imageUrl.slice(0, 600) : '',
        initiative_value: clampInt(item.initiativeValue, -99, 99, 0),
        initiative_order: state.participants.length,
        current_hp: item.currentHp != null ? clampInt(item.currentHp, 0, 9999, 0) : null,
        max_hp: item.maxHp != null ? clampInt(item.maxHp, 1, 9999, 10) : null,
        temp_hp: clampInt(item.tempHp, 0, 999, 0),
        armor_class: item.armorClass != null ? clampInt(item.armorClass, 0, 40, 10) : null,
        is_hidden_from_players: item.isHiddenFromPlayers ? 1 : 0,
        hide_name: item.hideName ? 1 : 0,
        is_defeated: 0,
        death_saves_successes: 0,
        death_saves_failures: 0,
        is_stable: 0,
        statblock: typeof item.statblock === 'string' ? item.statblock.slice(0, 20000) : '',
        notes: typeof item.notes === 'string' ? item.notes.slice(0, 2000) : '',
        created_at: now(),
      };
      state.participants.push(row);
      await this.appendLog('participant_added', row.id, { name: row.display_name, type });
    }
    const currentId = state.participants[state.meta.current_turn_index]?.id ?? null;
    this.resort(currentId);
  }

  private async removeParticipant(payload: Record<string, unknown>): Promise<void> {
    const row = this.participant(payload.participantId);
    if (!row) return;
    const state = this.state!;
    const currentId = state.participants[state.meta.current_turn_index]?.id ?? null;
    state.participants = state.participants.filter((item) => item.id !== row.id);
    state.effects = state.effects.filter((effect) => effect.participant_id !== row.id);
    state.removedParticipantIds = [...(state.removedParticipantIds ?? []), row.id];
    this.resort(currentId === row.id ? null : currentId);
    await this.appendLog('participant_removed', row.id, { name: row.display_name });
  }

  private async addEffect(payload: Record<string, unknown>): Promise<void> {
    const row = this.participant(payload.participantId);
    if (!row) return;
    const effectType: EffectType =
      payload.effectType === 'custom' || payload.effectType === 'exhaustion' ? payload.effectType : 'condition';
    const name = typeof payload.effectName === 'string' ? payload.effectName.trim().slice(0, 80) : '';
    if (!name) return;
    if (effectType === 'condition' && !DND_CONDITIONS.some((rule) => rule.name === name)) {
      // Разрешаем и произвольные «условия», но канонические описания берём из справочника.
    }
    if (effectType === 'exhaustion') {
      await this.setExhaustion({ participantId: row.id, level: payload.exhaustionLevel ?? 1 });
      return;
    }
    const durationType = normalizeDuration(payload.durationType);
    const durationValue =
      durationType === 'rounds' ? clampInt(payload.durationValue, 1, 999, 1) : null;

    this.state!.effects.push({
      id: newId('ce'),
      combat_id: this.state!.meta.id,
      participant_id: row.id,
      effect_name: name,
      effect_type: effectType,
      exhaustion_level: 0,
      duration_type: durationType,
      duration_value: durationValue,
      description:
        typeof payload.description === 'string' && payload.description.trim()
          ? payload.description.trim().slice(0, 600)
          : effectType === 'condition'
            ? conditionRule(name)?.description ?? ''
            : '',
      is_visible_to_players: payload.isVisibleToPlayers === false ? 0 : 1,
      created_at: now(),
    });
    await this.appendLog('effect_added', row.id, { name, effectType, visible: payload.isVisibleToPlayers !== false });
  }

  private async updateEffect(payload: Record<string, unknown>): Promise<void> {
    const effect = this.state!.effects.find((item) => item.id === payload.effectId);
    if (!effect) return;
    if (typeof payload.description === 'string') effect.description = payload.description.slice(0, 600);
    if (payload.durationValue !== undefined) {
      effect.duration_value = effect.duration_type === 'rounds' ? clampInt(payload.durationValue, 1, 999, 1) : null;
    }
    if (payload.isVisibleToPlayers !== undefined) {
      effect.is_visible_to_players = payload.isVisibleToPlayers ? 1 : 0;
    }
    await this.appendLog('effect_updated', effect.participant_id, { name: effect.effect_name });
  }

  private async removeEffect(payload: Record<string, unknown>): Promise<void> {
    const effect = this.state!.effects.find((item) => item.id === payload.effectId);
    if (!effect) return;
    this.state!.effects = this.state!.effects.filter((item) => item.id !== effect.id);
    await this.appendLog('effect_removed', effect.participant_id, { name: effect.effect_name, reason: 'manual' });
  }

  /** Истощение: суммируется, хранится одним эффектом на участника (0 — снимает). */
  private async setExhaustion(payload: Record<string, unknown>): Promise<void> {
    const row = this.participant(payload.participantId);
    if (!row) return;
    const level = clampInt(payload.level, 0, MAX_EXHAUSTION, 0);
    const state = this.state!;
    const existing = state.effects.find(
      (effect) => effect.participant_id === row.id && effect.effect_type === 'exhaustion'
    );
    if (level === 0) {
      if (existing) {
        state.effects = state.effects.filter((effect) => effect.id !== existing.id);
        await this.appendLog('exhaustion_changed', row.id, { level: 0 });
      }
      return;
    }
    if (existing) {
      existing.exhaustion_level = level;
      existing.description = `Истощение ${level}`;
    } else {
      state.effects.push({
        id: newId('ce'),
        combat_id: state.meta.id,
        participant_id: row.id,
        effect_name: 'Exhaustion',
        effect_type: 'exhaustion',
        exhaustion_level: level,
        duration_type: 'until_removed',
        duration_value: null,
        description: `Истощение ${level}`,
        is_visible_to_players: 1,
        created_at: now(),
      });
    }
    await this.appendLog('exhaustion_changed', row.id, { level });
  }

  private async deathSave(payload: Record<string, unknown>): Promise<void> {
    const row = this.participant(payload.participantId);
    if (!row || row.participant_type !== 'player') return;
    const kind = payload.kind === 'failure' ? 'failure' : 'success';
    if (row.is_stable) return;
    if (kind === 'success') {
      row.death_saves_successes = Math.min(3, row.death_saves_successes + 1);
      if (row.death_saves_successes >= 3) row.is_stable = 1;
    } else {
      row.death_saves_failures = Math.min(3, row.death_saves_failures + 1);
      if (row.death_saves_failures >= 3) {
        row.is_defeated = 1;
        row.is_stable = 0;
      }
    }
    await this.appendLog('death_save', row.id, {
      name: row.display_name,
      kind,
      successes: row.death_saves_successes,
      failures: row.death_saves_failures,
    });
  }

  private async stabilize(payload: Record<string, unknown>): Promise<void> {
    const row = this.participant(payload.participantId);
    if (!row) return;
    const stable = payload.stable === false ? 0 : 1;
    row.is_stable = stable ? 1 : 0;
    if (stable) {
      row.death_saves_successes = 0;
      row.death_saves_failures = 0;
      row.is_defeated = 1;
    }
    await this.appendLog('stabilized', row.id, { name: row.display_name, stable: Boolean(stable) });
  }

  private async timerAction(payload: Record<string, unknown>): Promise<void> {
    const meta = this.state!.meta;
    const action = payload.action;
    const seconds = normalizeTimerSeconds(payload.seconds);
    if (action === 'configure') {
      meta.turn_timer_seconds = seconds;
      meta.turn_timer_ends_at = null;
      meta.turn_timer_paused_remaining_ms = null;
      if (seconds && meta.status === 'active') this.restartTurnTimer();
      await this.appendLog('timer_configured', null, { seconds });
      return;
    }
    if (!meta.turn_timer_seconds) return;
    if (action === 'pause') {
      const remaining = meta.turn_timer_ends_at ? Math.max(0, meta.turn_timer_ends_at - now()) : null;
      meta.turn_timer_paused_remaining_ms = remaining ?? meta.turn_timer_seconds * 1000;
      meta.turn_timer_ends_at = null;
      await this.appendLog('timer_paused', null, { remainingMs: meta.turn_timer_paused_remaining_ms });
      return;
    }
    if (action === 'reset') {
      meta.turn_timer_paused_remaining_ms = null;
      this.restartTurnTimer();
      await this.appendLog('timer_restarted', null, {});
      return;
    }
    if (action === 'extend') {
      const extra = clampInt(payload.seconds, 5, 3600, 30);
      const base = meta.turn_timer_ends_at ?? now() + (meta.turn_timer_paused_remaining_ms ?? 0);
      meta.turn_timer_ends_at = base + extra * 1000;
      meta.turn_timer_paused_remaining_ms = null;
      await this.appendLog('timer_extended', null, { seconds: extra });
    }
  }

  private async updateSettings(payload: Record<string, unknown>): Promise<void> {
    const meta = this.state!.meta;
    if (payload.turnTimerSeconds !== undefined) {
      meta.turn_timer_seconds = normalizeTimerSeconds(payload.turnTimerSeconds);
      meta.turn_timer_ends_at = null;
      meta.turn_timer_paused_remaining_ms = null;
    }
    if (payload.allowPlayerTurn !== undefined) meta.allow_player_turn = payload.allowPlayerTurn ? 1 : 0;
    if (payload.showPlayerHp !== undefined) meta.show_player_hp = payload.showPlayerHp ? 1 : 0;
    if (payload.showOtherDeathSaves !== undefined) meta.show_other_death_saves = payload.showOtherDeathSaves ? 1 : 0;
    if (payload.monsterHpVisibility !== undefined) {
      meta.monster_hp_visibility = normalizeHpVisibility(payload.monsterHpVisibility);
    }
    await this.appendLog('settings_updated', null, {});
  }

  private async setStatus(payload: Record<string, unknown>, actor: CombatActor): Promise<void> {
    const meta = this.state!.meta;
    if (actor.role !== 'dm') return;
    const status = payload.status;
    const allowed: CombatStatus[] = ['setup', 'active', 'paused', 'finished'];
    if (!allowed.includes(status as CombatStatus)) return;
    meta.status = status as CombatStatus;
    if (status === 'active') {
      meta.current_turn_index = Math.min(
        meta.current_turn_index,
        Math.max(0, this.state!.participants.length - 1)
      );
      this.restartTurnTimer();
      await this.appendLog('combat_started', null, { round: meta.round_number });
    }
    if (status === 'setup') {
      meta.round_number = 1;
      meta.current_turn_index = 0;
      meta.turn_timer_ends_at = null;
      meta.turn_timer_paused_remaining_ms = null;
      await this.appendLog('combat_reset', null, {});
    }
    if (status === 'finished') {
      meta.turn_timer_ends_at = null;
      await this.appendLog('combat_finished', null, { round: meta.round_number });
    }
    if (status === 'paused') {
      await this.appendLog('combat_paused', null, {});
    }
  }

  /* ------------------------------------------------------------- persistence */

  private async appendLog(eventType: string, participantId: string | null, payload: Record<string, unknown>) {
    const entry: CombatLogEntry = {
      id: newId('cl'),
      eventType,
      participantId,
      payload,
      createdAt: now(),
    };
    this.log.push(entry);
    if (this.log.length > LOG_LIMIT) this.log = this.log.slice(-LOG_LIMIT);
    this.pendingLog.push(entry);
  }

  private async persist(): Promise<void> {
    const state = this.state;
    if (!state) return;
    const statements: D1PreparedStatement[] = [];

    statements.push(
      this.env.DB.prepare(
        `INSERT INTO combats (id, campaign_id, name, status, current_turn_index, round_number,
             turn_timer_seconds, turn_timer_ends_at, turn_timer_paused_remaining_ms,
             allow_player_turn, show_player_hp, show_other_death_saves, monster_hp_visibility,
             created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           status = excluded.status,
           current_turn_index = excluded.current_turn_index,
           round_number = excluded.round_number,
           turn_timer_seconds = excluded.turn_timer_seconds,
           turn_timer_ends_at = excluded.turn_timer_ends_at,
           turn_timer_paused_remaining_ms = excluded.turn_timer_paused_remaining_ms,
           allow_player_turn = excluded.allow_player_turn,
           show_player_hp = excluded.show_player_hp,
           show_other_death_saves = excluded.show_other_death_saves,
           monster_hp_visibility = excluded.monster_hp_visibility,
           updated_at = excluded.updated_at`
      ).bind(
        state.meta.id,
        state.meta.campaign_id,
        state.meta.name,
        state.meta.status,
        state.meta.current_turn_index,
        state.meta.round_number,
        state.meta.turn_timer_seconds,
        state.meta.turn_timer_ends_at,
        state.meta.turn_timer_paused_remaining_ms,
        state.meta.allow_player_turn,
        state.meta.show_player_hp,
        state.meta.show_other_death_saves,
        state.meta.monster_hp_visibility,
        state.meta.created_by,
        state.meta.created_at,
        state.meta.updated_at
      )
    );

    for (const row of state.participants) {
      statements.push(
        this.env.DB.prepare(
          `INSERT INTO combat_participants (id, combat_id, participant_type, user_id, player_id,
               monster_bestiary_id, display_name, image_url, initiative_value, initiative_order,
               current_hp, max_hp, temp_hp, armor_class, is_hidden_from_players, hide_name,
               is_defeated, death_saves_successes, death_saves_failures, is_stable, statblock, notes, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             display_name = excluded.display_name,
             image_url = excluded.image_url,
             initiative_value = excluded.initiative_value,
             initiative_order = excluded.initiative_order,
             current_hp = excluded.current_hp,
             max_hp = excluded.max_hp,
             temp_hp = excluded.temp_hp,
             armor_class = excluded.armor_class,
             is_hidden_from_players = excluded.is_hidden_from_players,
             hide_name = excluded.hide_name,
             is_defeated = excluded.is_defeated,
             death_saves_successes = excluded.death_saves_successes,
             death_saves_failures = excluded.death_saves_failures,
             is_stable = excluded.is_stable,
             statblock = excluded.statblock,
             notes = excluded.notes`
        ).bind(
          row.id,
          row.combat_id,
          row.participant_type,
          row.user_id,
          row.player_id,
          row.monster_bestiary_id,
          row.display_name,
          row.image_url,
          row.initiative_value,
          row.initiative_order,
          row.current_hp,
          row.max_hp,
          row.temp_hp,
          row.armor_class,
          row.is_hidden_from_players,
          row.hide_name,
          row.is_defeated,
          row.death_saves_successes,
          row.death_saves_failures,
          row.is_stable,
          row.statblock,
          row.notes,
          row.created_at
        )
      );
    }

    for (const effect of state.effects) {
      statements.push(
        this.env.DB.prepare(
          `INSERT INTO combat_effects (id, combat_id, participant_id, effect_name, effect_type,
               exhaustion_level, duration_type, duration_value, description, is_visible_to_players, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             effect_name = excluded.effect_name,
             exhaustion_level = excluded.exhaustion_level,
             duration_type = excluded.duration_type,
             duration_value = excluded.duration_value,
             description = excluded.description,
             is_visible_to_players = excluded.is_visible_to_players`
        ).bind(
          effect.id,
          effect.combat_id,
          effect.participant_id,
          effect.effect_name,
          effect.effect_type,
          effect.exhaustion_level,
          effect.duration_type,
          effect.duration_value,
          effect.description,
          effect.is_visible_to_players,
          effect.created_at
        )
      );
    }

    for (const entry of this.pendingLog) {
      statements.push(
        this.env.DB.prepare(
          `INSERT OR IGNORE INTO combat_log (id, combat_id, event_type, participant_id, payload_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(
          entry.id,
          state.meta.id,
          entry.eventType,
          entry.participantId,
          JSON.stringify(entry.payload),
          entry.createdAt
        )
      );
    }
    this.pendingLog = [];

    // Удаляем записи, которых больше нет в состоянии (участники/эффекты).
    const participantIds = state.participants.map((row) => row.id);
    const effectIds = state.effects.map((row) => row.id);
    const removedIds = state.removedParticipantIds ?? [];
    state.removedParticipantIds = [];

    if (removedIds.length > 0) {
      for (const id of removedIds) {
        statements.push(
          this.env.DB.prepare(`DELETE FROM combat_effects WHERE participant_id = ?`).bind(id),
          this.env.DB.prepare(`DELETE FROM combat_participants WHERE id = ?`).bind(id)
        );
      }
    } else if (participantIds.length === 0) {
      statements.push(this.env.DB.prepare(`DELETE FROM combat_participants WHERE combat_id = ?`).bind(state.meta.id));
    }

    if (effectIds.length === 0) {
      statements.push(
        this.env.DB.prepare(`DELETE FROM combat_effects WHERE combat_id = ? AND participant_id NOT IN (SELECT id FROM combat_participants WHERE combat_id = ?)`).bind(
          state.meta.id,
          state.meta.id
        )
      );
    } else {
      const placeholders = effectIds.map(() => '?').join(', ');
      statements.push(
        this.env.DB.prepare(
          `DELETE FROM combat_effects WHERE combat_id = ? AND id NOT IN (${placeholders})`
        ).bind(state.meta.id, ...effectIds)
      );
    }

    await this.env.DB.batch(statements);
    this.persistQueued = false;
  }
}

/* ------------------------------------------------------------------ helpers */

function mapEffect(row: EffectRow): CombatEffect {
  return {
    id: row.id,
    participantId: row.participant_id,
    effectName: row.effect_name,
    effectType: row.effect_type,
    exhaustionLevel: row.exhaustion_level,
    durationType: row.duration_type,
    durationValue: row.duration_value,
    description: row.description,
    isVisibleToPlayers: Boolean(row.is_visible_to_players),
    createdAt: row.created_at,
  };
}

function safeJson(raw: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function safeSend(ws: WebSocket, message: unknown): void {
  try {
    ws.send(JSON.stringify(message));
  } catch {
    /* сокет уже закрыт */
  }
}

function normalizeColor(raw: string | null): string {
  const value = (raw ?? '').trim();
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#22d3ee';
}

function normalizeAvatar(raw: string | null): string | null {
  const value = (raw ?? '').trim();
  if (!value || value.length > 600) return null;
  if (value.startsWith('/') || value.startsWith('https://') || value.startsWith('data:image/')) return value;
  return null;
}

export type { CombatEffect, CombatSettings, CombatView };
