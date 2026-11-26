import { DurableObject } from 'cloudflare:workers';

/**
 * BoardRoom — один Durable Object на одну доску («Доска» = Miro/SBoard-клон).
 *
 * Ответственность:
 *  • хранит документ холста (записи tldraw store) в SQLite-хранилище DO;
 *  • принимает патчи от клиентов и рассылает их остальным участникам;
 *  • ведёт presence / живые курсоры / выделения (эфемерно, без записи на диск);
 *  • хранит комментарии (треды с @mentions), dot-voting и общий таймер сессии;
 *  • держит журнал последних патчей (seq + ring buffer) для replay после реконнекта.
 *
 * Полностью изолирован от CampaignRoom: сообщения мессенджера, бросков и квестов
 * идут через другой DO и не блокируются тяжёлыми правками холста.
 */

export interface BoardRoomEnv {
  DB: D1Database;
}

export type BoardPermission = 'read' | 'write';

export interface PeerAttachment {
  userId: number;
  username: string;
  displayName: string;
  role: 'dm' | 'player';
  permission: BoardPermission;
  color: string;
  avatarUrl: string | null;
  connectedAt: number;
}

export interface BoardCommentReply {
  id: string;
  authorId: number;
  authorName: string;
  text: string;
  createdAt: number;
  mentions: number[];
}

export interface BoardComment {
  id: string;
  /** Объект, к которому привязан тред, либо точка на холсте */
  shapeId: string | null;
  x: number;
  y: number;
  authorId: number;
  authorName: string;
  text: string;
  createdAt: number;
  resolved: boolean;
  /** Упомянутые участники (@ник) */
  mentions?: number[];
  replies: BoardCommentReply[];
}

export type BoardVotes = Record<string, Record<string, number>>;

export interface BoardTimerState {
  durationMs: number;
  startedAt: number | null;
  elapsedMs: number;
  running: boolean;
  updatedAt: number;
}

type RecordsDiff = {
  added?: Record<string, unknown>;
  updated?: Record<string, [unknown, unknown]>;
  removed?: Record<string, unknown>;
};

type JournalEntry = { seq: number; diff: RecordsDiff; userId: number };

interface StoredDoc {
  records: Record<string, unknown>;
  seq: number;
  journal: JournalEntry[];
}

export interface PeerState {
  userId: number;
  username: string;
  displayName: string;
  role: 'dm' | 'player';
  permission: BoardPermission;
  color: string;
  avatarUrl: string | null;
  cursor: { x: number; y: number; pageId: string | null } | null;
  selection: string[];
  connectedAt: number;
}

const DEFAULT_TIMER: BoardTimerState = {
  durationMs: 5 * 60 * 1000,
  startedAt: null,
  elapsedMs: 0,
  running: false,
  updatedAt: 0,
};

const JOURNAL_LIMIT = 400;
const SNAPSHOT_CHUNK = 200;
const CURSOR_THROTTLE_MS = 45;
const VOTE_CAP_PER_OBJECT = 3;

export class BoardRoom extends DurableObject<BoardRoomEnv> {
  private records: Record<string, unknown> = {};
  private seq = 0;
  private journal: JournalEntry[] = [];
  private comments: BoardComment[] = [];
  private votes: BoardVotes = {};
  private timer: BoardTimerState = { ...DEFAULT_TIMER };

  private cursors = new Map<number, { x: number; y: number; pageId: string | null }>();
  private selections = new Map<number, string[]>();
  private lastCursorSentAt = new Map<number, number>();

  private loaded = false;
  private loadPromise: Promise<void> | null = null;
  private dirty = false;
  private patchesSincePersist = 0;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private boardId = '';

  // ---------------------------------------------------------------- lifecycle

  private ensureLoaded(): Promise<void> {
    if (this.loaded) return Promise.resolve();
    if (!this.loadPromise) {
      this.loadPromise = this.load().finally(() => {
        this.loaded = true;
        this.loadPromise = null;
      });
    }
    return this.loadPromise;
  }

  private async load(): Promise<void> {
    const doc = await this.ctx.storage.get<StoredDoc>('doc');
    if (doc) {
      this.records = doc.records ?? {};
      this.seq = doc.seq ?? 0;
      this.journal = Array.isArray(doc.journal) ? doc.journal.slice(-JOURNAL_LIMIT) : [];
    }
    this.comments = (await this.ctx.storage.get<BoardComment[]>('comments')) ?? [];
    this.votes = (await this.ctx.storage.get<BoardVotes>('votes')) ?? {};
    this.timer = (await this.ctx.storage.get<BoardTimerState>('timer')) ?? { ...DEFAULT_TIMER };
  }

  private schedulePersist(): void {
    this.dirty = true;
    if (this.persistTimer) return;
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      void this.persistDoc();
    }, 900);
  }

  private async persistDoc(): Promise<void> {
    if (!this.dirty) return;
    this.dirty = false;
    await this.ctx.storage.put<StoredDoc>('doc', {
      records: this.records,
      seq: this.seq,
      journal: this.journal.slice(-JOURNAL_LIMIT),
    });
  }

  // ------------------------------------------------------------------- fetch

  async fetch(request: Request): Promise<Response> {
    await this.ensureLoaded();
    const url = new URL(request.url);
    this.boardId = url.searchParams.get('boardId') || this.boardId;

    const isUpgrade = request.headers.get('Upgrade')?.toLowerCase() === 'websocket';
    if (!isUpgrade) {
      if (url.pathname === '/state') {
        return Response.json({
          boardId: this.boardId,
          seq: this.seq,
          records: Object.keys(this.records).length,
          comments: this.comments.length,
        });
      }
      if (url.pathname === '/reset' && request.method === 'POST') {
        this.records = {};
        this.seq = 0;
        this.journal = [];
        this.comments = [];
        this.votes = {};
        this.timer = { ...DEFAULT_TIMER };
        await this.ctx.storage.put({
          doc: { records: {}, seq: 0, journal: [] } as StoredDoc,
          comments: [] as BoardComment[],
          votes: {} as BoardVotes,
          timer: this.timer,
        });
        this.broadcast({ type: 'reset', payload: {} }, null);
        return Response.json({ ok: true });
      }
      if (url.pathname === '/flush' && request.method === 'POST') {
        await this.persistDoc();
        return Response.json({ ok: true });
      }
      return new Response('BoardRoom Durable Object Active', { status: 200 });
    }

    const userId = Number.parseInt(url.searchParams.get('userId') || '0', 10);
    const permission = (url.searchParams.get('permission') === 'write' ? 'write' : 'read') as BoardPermission;

    if (!userId) {
      return new Response('Forbidden', { status: 403 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    const attachment: PeerAttachment = {
      userId,
      username: url.searchParams.get('username') || 'guest',
      displayName: url.searchParams.get('displayName') || 'Участник',
      role: url.searchParams.get('role') === 'dm' ? 'dm' : 'player',
      permission,
      color: normalizeColor(url.searchParams.get('color')),
      avatarUrl: normalizeAvatar(url.searchParams.get('avatar')),
      connectedAt: Date.now(),
    };

    this.ctx.acceptWebSocket(server, [`user:${userId}`]);
    server.serializeAttachment(attachment);

    // Начальная синхронизация выполняет клиент через `hello` (нужен lastSeq для replay).
    this.broadcastPresence();

    return new Response(null, { status: 101, webSocket: client });
  }

  // -------------------------------------------------------------- WS handlers

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    await this.ensureLoaded();
    if (typeof message !== 'string') return;

    const sender = ws.deserializeAttachment() as PeerAttachment | null;
    if (!sender) return;

    let parsed: { type?: string; payload?: Record<string, unknown> } = {};
    try {
      parsed = JSON.parse(message) as { type?: string; payload?: Record<string, unknown> };
    } catch {
      return;
    }

    const type = parsed.type;
    const payload = parsed.payload ?? {};

    if (type === 'ping') {
      safeSend(ws, { type: 'pong', timestamp: Date.now() });
      return;
    }

    if (type === 'hello') {
      this.sendWelcome(ws, sender, payload);
      this.broadcastPresence();
      return;
    }

    const canWrite = sender.permission === 'write' || sender.role === 'dm';

    if (type === 'diff') {
      if (!canWrite) return;
      const diff = payload.diff as RecordsDiff | undefined;
      if (!diff) return;
      this.applyDiff(diff);
      this.seq += 1;
      const entry: JournalEntry = { seq: this.seq, diff, userId: sender.userId };
      this.journal.push(entry);
      if (this.journal.length > JOURNAL_LIMIT) this.journal.shift();
      this.schedulePersist();
      // Периодическая синхронная запись: setTimeout может не пережить выгрузку DO,
      // поэтому каждые 25 патчей фиксируем документ в SQLite-хранилище сразу.
      this.patchesSincePersist += 1;
      if (this.patchesSincePersist >= 25) {
        this.patchesSincePersist = 0;
        await this.persistDoc();
      }
      this.broadcast({ type: 'diff', payload: { diff, seq: this.seq }, senderId: sender.userId }, ws);
      return;
    }

    if (type === 'init') {
      if (!canWrite) return;
      if (Object.keys(this.records).length > 0) {
        // Доска уже инициализирована другим участником — просим клиента перечитать снапшот.
        safeSend(ws, { type: 'reload', payload: { reason: 'already-initialized' } });
        return;
      }
      const incoming = payload.records as Record<string, unknown> | undefined;
      if (!incoming) return;
      this.records = { ...incoming };
      this.seq = 1;
      this.journal = [{ seq: 1, diff: { added: incoming, updated: {}, removed: {} }, userId: sender.userId }];
      this.patchesSincePersist += 1;
      await this.persistDoc();
      // Остальные клиенты могли подключиться к пустой доске раньше — просим перечитать снапшот,
      // иначе их локальный документ не будет знать о новых page/document-записях.
      this.broadcast({ type: 'reload', payload: { reason: 'initialized' } }, ws);
      return;
    }

    if (type === 'cursor') {
      const x = Number(payload.x);
      const y = Number(payload.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      const cursor = { x, y, pageId: (payload.pageId as string | null) ?? null };
      this.cursors.set(sender.userId, cursor);
      const now = Date.now();
      const last = this.lastCursorSentAt.get(sender.userId) ?? 0;
      if (now - last < CURSOR_THROTTLE_MS) return;
      this.lastCursorSentAt.set(sender.userId, now);
      this.broadcast(
        {
          type: 'cursor',
          payload: { ...cursor, userId: sender.userId, displayName: sender.displayName, color: sender.color },
        },
        ws
      );
      return;
    }

    if (type === 'selection') {
      const ids = Array.isArray(payload.ids) ? (payload.ids as string[]).slice(0, 500) : [];
      this.selections.set(sender.userId, ids);
      this.broadcast(
        { type: 'selection', payload: { userId: sender.userId, ids, color: sender.color, displayName: sender.displayName } },
        ws
      );
      return;
    }

    if (type === 'comment:add') {
      const text = String(payload.text ?? '').slice(0, 4000).trim();
      if (!text) return;
      const comment: BoardComment = {
        id: `cm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        shapeId: (payload.shapeId as string | null) ?? null,
        x: Number(payload.x) || 0,
        y: Number(payload.y) || 0,
        authorId: sender.userId,
        authorName: sender.displayName,
        text,
        createdAt: Date.now(),
        resolved: false,
        mentions: Array.isArray(payload.mentions)
          ? (payload.mentions as unknown[]).filter((id): id is number => Number.isFinite(Number(id))).map(Number)
          : [],
        replies: [],
      };
      this.comments.push(comment);
      await this.ctx.storage.put('comments', this.comments);
      this.broadcast({ type: 'comment:add', payload: { comment } }, null);
      return;
    }

    if (type === 'comment:reply') {
      const comment = this.comments.find((c) => c.id === payload.commentId);
      if (!comment) return;
      const text = String(payload.text ?? '').slice(0, 4000).trim();
      if (!text) return;
      comment.replies.push({
        id: `cr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        authorId: sender.userId,
        authorName: sender.displayName,
        text,
        createdAt: Date.now(),
        mentions: Array.isArray(payload.mentions) ? (payload.mentions as number[]).filter(Number.isFinite) : [],
      });
      await this.ctx.storage.put('comments', this.comments);
      this.broadcast({ type: 'comment:update', payload: { comment } }, null);
      return;
    }

    if (type === 'comment:resolve') {
      const comment = this.comments.find((c) => c.id === payload.commentId);
      if (!comment) return;
      comment.resolved = Boolean(payload.resolved);
      await this.ctx.storage.put('comments', this.comments);
      this.broadcast({ type: 'comment:update', payload: { comment } }, null);
      return;
    }

    if (type === 'comment:delete') {
      const comment = this.comments.find((c) => c.id === payload.commentId);
      if (!comment) return;
      if (comment.authorId !== sender.userId && sender.role !== 'dm') return;
      this.comments = this.comments.filter((c) => c.id !== payload.commentId);
      await this.ctx.storage.put('comments', this.comments);
      this.broadcast({ type: 'comment:delete', payload: { commentId: payload.commentId } }, null);
      return;
    }

    if (type === 'vote') {
      const shapeId = String(payload.shapeId ?? '');
      if (!shapeId) return;
      const delta = payload.delta === -1 ? -1 : 1;
      const bucket = this.votes[shapeId] ?? {};
      const key = String(sender.userId);
      const next = (bucket[key] ?? 0) + delta;
      if (next <= 0) delete bucket[key];
      else bucket[key] = Math.min(next, VOTE_CAP_PER_OBJECT);
      if (Object.keys(bucket).length === 0) delete this.votes[shapeId];
      else this.votes[shapeId] = bucket;
      await this.ctx.storage.put('votes', this.votes);
      this.broadcast({ type: 'votes', payload: { votes: this.votes, shapeId } }, null);
      return;
    }

    if (type === 'votes:clear') {
      if (sender.role !== 'dm' && !canWrite) return;
      this.votes = {};
      await this.ctx.storage.put('votes', this.votes);
      this.broadcast({ type: 'votes', payload: { votes: this.votes, shapeId: null } }, null);
      return;
    }

    if (type === 'timer') {
      if (!canWrite) return;
      const action = String(payload.action ?? '');
      const now = Date.now();
      if (action === 'start') {
        if (!this.timer.running) {
          this.timer = { ...this.timer, running: true, startedAt: now, updatedAt: now };
        }
      } else if (action === 'pause') {
        if (this.timer.running && this.timer.startedAt) {
          this.timer = {
            ...this.timer,
            running: false,
            elapsedMs: this.timer.elapsedMs + (now - this.timer.startedAt),
            startedAt: null,
            updatedAt: now,
          };
        }
      } else if (action === 'reset') {
        this.timer = {
          ...this.timer,
          running: false,
          startedAt: null,
          elapsedMs: 0,
          updatedAt: now,
        };
      } else if (action === 'set') {
        const durationMs = Math.min(Math.max(Number(payload.durationMs) || 0, 10_000), 6 * 60 * 60 * 1000);
        this.timer = { ...this.timer, durationMs, elapsedMs: 0, running: false, startedAt: null, updatedAt: now };
      } else {
        return;
      }
      await this.ctx.storage.put('timer', this.timer);
      this.broadcast({ type: 'timer', payload: { timer: this.timer } }, null);
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    // ВАЖНО: без предварительной загрузки состояния persistDoc() записал бы пустой документ.
    await this.ensureLoaded();
    const sender = ws.deserializeAttachment() as PeerAttachment | null;
    if (sender) {
      this.cursors.delete(sender.userId);
      this.selections.delete(sender.userId);
      this.lastCursorSentAt.delete(sender.userId);
    }
    try {
      ws.close();
    } catch {
      /* already closed */
    }
    this.broadcastPresence();
    await this.persistDoc();
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.webSocketClose(ws);
  }

  // ------------------------------------------------------------------ helpers

  private applyDiff(diff: RecordsDiff): void {
    if (diff.added) {
      for (const [id, record] of Object.entries(diff.added)) this.records[id] = record;
    }
    if (diff.updated) {
      for (const [id, pair] of Object.entries(diff.updated)) {
        if (!Array.isArray(pair)) continue;
        this.records[id] = pair[1];
      }
    }
    if (diff.removed) {
      for (const id of Object.keys(diff.removed)) delete this.records[id];
    }
  }

  private peers(): PeerState[] {
    return this.ctx.getWebSockets().map((ws) => {
      const a = ws.deserializeAttachment() as PeerAttachment | null;
      const userId = a?.userId ?? 0;
      return {
        userId,
        username: a?.username ?? 'guest',
        displayName: a?.displayName ?? 'Участник',
        role: a?.role ?? 'player',
        permission: a?.permission ?? 'read',
        color: a?.color ?? '#22d3ee',
        avatarUrl: a?.avatarUrl ?? null,
        cursor: this.cursors.get(userId) ?? null,
        selection: this.selections.get(userId) ?? [],
        connectedAt: a?.connectedAt ?? 0,
      };
    });
  }

  private broadcastPresence(): void {
    this.broadcast({ type: 'presence', payload: { peers: this.peers() } }, null);
  }

  private sendWelcome(ws: WebSocket, sender: PeerAttachment, payload: Record<string, unknown>): void {
    const peers = this.peers();
    const lastSeq = Number(payload.lastSeq ?? -1);
    const base = {
      seq: this.seq,
      selfId: sender.userId,
      permission: sender.permission,
      peers,
      comments: this.comments,
      votes: this.votes,
      timer: this.timer,
      recordCount: Object.keys(this.records).length,
    };

    const canReplay =
      lastSeq >= 0 &&
      lastSeq <= this.seq &&
      (this.journal.length === 0 || lastSeq >= this.journal[0].seq - 1);

    if (canReplay) {
      safeSend(ws, {
        type: 'welcome',
        payload: { ...base, mode: 'replay', patches: this.journal.filter((j) => j.seq > lastSeq) },
      });
      return;
    }

    if (Object.keys(this.records).length === 0) {
      safeSend(ws, { type: 'welcome', payload: { ...base, mode: 'empty' } });
      return;
    }

    safeSend(ws, { type: 'welcome', payload: { ...base, mode: 'snapshot', total: Object.keys(this.records).length } });

    const entries = Object.entries(this.records);
    for (let i = 0; i < entries.length; i += SNAPSHOT_CHUNK) {
      const slice = entries.slice(i, i + SNAPSHOT_CHUNK);
      safeSend(ws, {
        type: 'snapshot:chunk',
        payload: {
          records: Object.fromEntries(slice),
          done: i + SNAPSHOT_CHUNK >= entries.length,
        },
      });
    }
  }

  private broadcast(message: unknown, except: WebSocket | null): void {
    const data = JSON.stringify(message);
    for (const ws of this.ctx.getWebSockets()) {
      if (except && ws === except) continue;
      safeSend(ws, data);
    }
  }
}

function safeSend(ws: WebSocket, message: unknown): void {
  try {
    ws.send(typeof message === 'string' ? message : JSON.stringify(message));
  } catch {
    /* socket closed mid-broadcast */
  }
}

function normalizeAvatar(raw: string | null): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;
  if (value.startsWith('/') || value.startsWith('https://') || value.startsWith('data:')) {
    return value.slice(0, 600);
  }
  return null;
}

function normalizeColor(raw: string | null): string {
  if (!raw) return '#22d3ee';
  return /^#[0-9a-fA-F]{3,8}$/.test(raw) ? raw : '#22d3ee';
}
