/**
 * Outbox правок доски.
 *
 * Зачем: правки холста уходят по WebSocket. Если сокет закрыт (переключение
 * вкладки, реконнект, спящий ноутбук), сообщение просто выбрасывалось — и
 * удалённая фигура «возвращалась» после F5, потому что сервер о ней не узнал.
 *
 * Теперь неотправленные патчи живут в памяти + sessionStorage (переживают
 * перезагрузку страницы) и досылаются двумя путями:
 *  1. по WebSocket сразу после welcome/снапшота;
 *  2. по HTTP (keepalive) при уходе со страницы — если сокет уже мёртв.
 */
export type BoardDiff = Record<string, unknown>;

type Outbox = Record<string, BoardDiff[]>;

const STORAGE_KEY = 'fraith:board-outbox';
/** Больше этого не копим: старые патчи всё равно перекрыты новым снапшотом. */
const MAX_PER_BOARD = 400;

const memory: Outbox = {};

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

function loadFromStorage(): Outbox {
  const store = storage();
  if (!store) return {};
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    const result: Outbox = {};
    for (const [boardId, diffs] of Object.entries(parsed as Outbox)) {
      if (Array.isArray(diffs) && diffs.length > 0) result[boardId] = diffs.slice(-MAX_PER_BOARD);
    }
    return result;
  } catch {
    return {};
  }
}

function persist(): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(memory));
  } catch {
    /* квота или приватный режим — живём только в памяти */
  }
}

export function readOutbox(boardId: string): BoardDiff[] {
  if (!(boardId in memory)) {
    const restored = loadFromStorage();
    for (const [key, diffs] of Object.entries(restored)) {
      if (!(key in memory)) memory[key] = diffs;
    }
  }
  return memory[boardId] ? [...memory[boardId]] : [];
}

export function pushOutbox(boardId: string, diff: BoardDiff): void {
  if (!boardId) return;
  const current = memory[boardId] ?? readOutbox(boardId);
  const next = [...current, diff].slice(-MAX_PER_BOARD);
  memory[boardId] = next;
  persist();
}

export function clearOutbox(boardId: string): void {
  if (!boardId) return;
  delete memory[boardId];
  persist();
}

/**
 * Досылает накопленные патчи по HTTP с keepalive — работает, даже когда
 * страница уже закрывается, а WebSocket недоступен.
 * Возвращает true, если сервер принял патчи (очередь очищена).
 */
export async function flushOutboxViaHttp(boardId: string): Promise<boolean> {
  if (!boardId) return false;
  const diffs = readOutbox(boardId);
  if (diffs.length === 0) return true;
  try {
    const res = await fetch(`/api/boards/${encodeURIComponent(boardId)}/diffs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ diffs }),
      keepalive: true,
      credentials: 'same-origin',
    });
    if (!res.ok) return false;
    clearOutbox(boardId);
    return true;
  } catch {
    return false;
  }
}
