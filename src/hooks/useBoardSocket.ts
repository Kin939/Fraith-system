import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  BoardComment,
  BoardPeer,
  BoardSocketStatus,
  BoardStoreEvent,
  BoardTimerAction,
  BoardTimerState,
  BoardVotes,
} from '../lib/boardProtocol';
import { clearOutbox, flushOutboxViaHttp, pushOutbox, readOutbox, type BoardDiff } from '../lib/boardOutbox';

interface UseBoardSocketOptions {
  boardId: string | null;
  enabled: boolean;
}

interface BoardEphemeralCursor {
  type: 'cursor';
  payload: { x: number; y: number; pageId: string | null; userId: number; displayName: string; color: string };
}

interface BoardEphemeralSelection {
  type: 'selection';
  payload: { userId: number; ids: string[]; color: string; displayName: string };
}

export type BoardEphemeralMessage = BoardEphemeralCursor | BoardEphemeralSelection;

const RECONNECT_BASE_MS = 500;
const RECONNECT_MAX_MS = 10_000;
const PING_INTERVAL_MS = 25_000;

/**
 * WebSocket-канал доски: presence, живые курсоры, патчи документа,
 * комментарии, dot-voting и общий таймер сессии.
 *
 * Авто-переподключение с экспоненциальной задержкой; при реконнекте клиент
 * присылает `lastSeq`, и DO доигрывает пропущенные патчи (replay) — либо
 * отдаёт полный снапшот, если журнал уже обрезан.
 */
export function useBoardSocket({ boardId, enabled }: UseBoardSocketOptions) {
  const [status, setStatus] = useState<BoardSocketStatus>('idle');
  const [selfId, setSelfId] = useState<number | null>(null);
  const [peers, setPeers] = useState<BoardPeer[]>([]);
  const [comments, setComments] = useState<BoardComment[]>([]);
  const [votes, setVotes] = useState<BoardVotes>({});
  const [timer, setTimer] = useState<BoardTimerState | null>(null);
  /** Сколько правок ещё не ушло на сервер (для индикатора «сохраняю…»). */
  const [pendingDiffs, setPendingDiffs] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const seqRef = useRef<number>(-1);  /** Локальные патчи, не ушедшие в сокет (реконнект/закрытый сокет). */
  const pendingDiffsRef = useRef<BoardDiff[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const storeHandlersRef = useRef(new Set<(event: BoardStoreEvent) => void>());
  const ephemeralHandlersRef = useRef(new Set<(message: BoardEphemeralMessage) => void>());
  const pendingSnapshotRef = useRef<Record<string, unknown> | null>(null);
  const attemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const manuallyClosedRef = useRef(false);
  const boardIdRef = useRef<string | null>(boardId);

  const emitStore = useCallback((event: BoardStoreEvent) => {
    storeHandlersRef.current.forEach((handler) => {
      try {
        handler(event);
      } catch {
        /* один сломанный подписчик не должен ломать синхронизацию */
      }
    });
  }, []);

  const emitEphemeral = useCallback((message: BoardEphemeralMessage) => {
    ephemeralHandlersRef.current.forEach((handler) => {
      try {
        handler(message);
      } catch {
        /* noop */
      }
    });
  }, []);

  /** Досылает накопленные патчи после ресинка: иначе удаление, сделанное в
   *  момент обрыва связи, терялось и после F5 «возвращалось» на доску. */
  const flushPendingDiffs = useCallback(() => {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    const socket = wsRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    if (pendingDiffsRef.current.length === 0) return;
    const queued = pendingDiffsRef.current;
    pendingDiffsRef.current = [];
    try {
      for (const diff of queued) {
        socket.send(JSON.stringify({ type: 'diff', payload: { diff } }));
      }
    } finally {
      clearOutbox(boardIdRef.current ?? '');
      setPendingDiffs(pendingDiffsRef.current.length);
    }

    // После досылки просим повторную синхронизацию: снапшот мог прийти до наших
    // патчей, и локальный документ разошёлся бы с сервером (удалённая фигура
    // осталась бы на экране до перезагрузки). Replay вернёт авторитетное состояние.
    if (resyncTimerRef.current) clearTimeout(resyncTimerRef.current);
    resyncTimerRef.current = setTimeout(() => {
      resyncTimerRef.current = null;
      const current = wsRef.current;
      if (current && current.readyState === WebSocket.OPEN) {
        current.send(JSON.stringify({ type: 'hello', payload: { lastSeq: seqRef.current } }));
      }
    }, 500);
  }, []);

  const scheduleFlush = useCallback(() => {
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    // Небольшая пауза: сначала применяем снапшот/init, потом досылаем свои патчи.
    flushTimerRef.current = setTimeout(flushPendingDiffs, 400);
  }, [flushPendingDiffs]);

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      let data: { type?: string; payload?: Record<string, unknown> } = {};
      try {
        data = JSON.parse(String(event.data));
      } catch {
        return;
      }
      const payload = data.payload ?? {};

      switch (data.type) {
        case 'welcome': {
          const mode = payload.mode as 'empty' | 'snapshot' | 'replay';
          setSelfId((payload.selfId as number) ?? null);
          setPeers((payload.peers as BoardPeer[]) ?? []);
          setComments((payload.comments as BoardComment[]) ?? []);
          setVotes((payload.votes as BoardVotes) ?? {});
          setTimer((payload.timer as BoardTimerState) ?? null);
          seqRef.current = Number(payload.seq) || 0;
          setStatus('open');

          if (mode === 'snapshot') {
            pendingSnapshotRef.current = {};
          } else if (mode === 'replay') {
            pendingSnapshotRef.current = null;
            emitStore({
              kind: 'replay',
              patches: (payload.patches as Array<{ seq: number; diff: unknown }>) ?? [],
              seq: seqRef.current,
            });
          } else {
            pendingSnapshotRef.current = null;
            emitStore({ kind: 'empty' });
          }
          if (pendingDiffsRef.current.length > 0) scheduleFlush();
          break;
        }
        case 'snapshot:chunk': {
          const records = payload.records as Record<string, unknown> | undefined;
          if (records && pendingSnapshotRef.current) {
            Object.assign(pendingSnapshotRef.current, records);
          }
          if (payload.done && pendingSnapshotRef.current) {
            const snapshot = pendingSnapshotRef.current;
            pendingSnapshotRef.current = null;
            emitStore({ kind: 'snapshot', records: snapshot });
            if (pendingDiffsRef.current.length > 0) scheduleFlush();
          }
          break;
        }
        case 'diff': {
          const seq = Number(payload.seq) || seqRef.current;
          seqRef.current = seq;
          emitStore({ kind: 'patch', diff: payload.diff, seq });
          break;
        }
        case 'reset-hint': {
          emitStore({ kind: 'reset-hint' });
          break;
        }
        case 'reload': {
          // Доску инициализировал другой участник — перечитываем снапшот.
          seqRef.current = -1;
          pendingSnapshotRef.current = {};
          emitStore({ kind: 'resync' });
          const socket = wsRef.current;
          if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'hello', payload: { lastSeq: -1 } }));
          }
          break;
        }
        case 'presence': {
          setPeers((payload.peers as BoardPeer[]) ?? []);
          break;
        }
        case 'cursor': {
          emitEphemeral({
            type: 'cursor',
            payload: payload as BoardEphemeralCursor['payload'],
          });
          break;
        }
        case 'selection': {
          emitEphemeral({
            type: 'selection',
            payload: payload as BoardEphemeralSelection['payload'],
          });
          break;
        }
        case 'comment:add': {
          const comment = payload.comment as BoardComment | undefined;
          if (comment) {
            setComments((prev) => (prev.some((c) => c.id === comment.id) ? prev : [...prev, comment]));
          }
          break;
        }
        case 'comment:update': {
          const comment = payload.comment as BoardComment | undefined;
          if (comment) {
            setComments((prev) => prev.map((c) => (c.id === comment.id ? comment : c)));
          }
          break;
        }
        case 'comment:delete': {
          setComments((prev) => prev.filter((c) => c.id !== payload.commentId));
          break;
        }
        case 'votes': {
          setVotes((payload.votes as BoardVotes) ?? {});
          break;
        }
        case 'timer': {
          setTimer((payload.timer as BoardTimerState) ?? null);
          break;
        }
        case 'reset': {
          seqRef.current = 0;
          pendingSnapshotRef.current = null;
          emitStore({ kind: 'empty' });
          break;
        }
        default:
          break;
      }
    },
    [emitEphemeral, emitStore, scheduleFlush]
  );

  const connect = useCallback(() => {
    const target = boardIdRef.current;
    if (!target || manuallyClosedRef.current) return;

    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        /* noop */
      }
      wsRef.current = null;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.host}/api/boards/${encodeURIComponent(target)}/ws`;

    setStatus((prev) => (prev === 'open' ? prev : attemptsRef.current === 0 ? 'connecting' : 'reconnecting'));

    let socket: WebSocket;
    try {
      socket = new WebSocket(url);
    } catch {
      setStatus('closed');
      return;
    }
    wsRef.current = socket;

    socket.onopen = () => {
      attemptsRef.current = 0;
      setStatus('open');
      socket.send(JSON.stringify({ type: 'hello', payload: { lastSeq: seqRef.current } }));
      if (pingTimerRef.current) clearInterval(pingTimerRef.current);
      pingTimerRef.current = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'ping' }));
      }, PING_INTERVAL_MS);
    };

    socket.onmessage = handleMessage;

    socket.onclose = () => {
      if (pingTimerRef.current) {
        clearInterval(pingTimerRef.current);
        pingTimerRef.current = null;
      }
      if (manuallyClosedRef.current) {
        setStatus('closed');
        return;
      }
      setStatus('reconnecting');
      const delay = Math.min(RECONNECT_BASE_MS * 2 ** attemptsRef.current, RECONNECT_MAX_MS);
      attemptsRef.current += 1;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = setTimeout(() => connect(), delay);
    };

    socket.onerror = () => {
      /* onclose придёт следом и запустит реконнект */
    };
  }, [handleMessage]);

  useEffect(() => {
    boardIdRef.current = boardId;
    manuallyClosedRef.current = false;
    seqRef.current = -1;
    pendingSnapshotRef.current = null;
    attemptsRef.current = 0;
    setPeers([]);
    setComments([]);
    setVotes({});
    setTimer(null);
    setSelfId(null);

    // Восстанавливаем недоставленные правки прошлой сессии (F5, переключение вкладки).
    pendingDiffsRef.current = boardId ? readOutbox(boardId) : [];
    setPendingDiffs(pendingDiffsRef.current.length);
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }

    if (!enabled || !boardId) {
      setStatus('idle');
      return;
    }
    connect();

    /**
     * Уход со страницы (переключение вкладки, закрытие): сокет ещё может быть
     * жив, но переподключения уже не будет. Поэтому остаток очереди досылаем
     * по HTTP keepalive — иначе последнее удаление терялось.
     */
    const flushOnLeave = () => {
      if (pendingDiffsRef.current.length === 0) return;
      void flushOutboxViaHttp(boardId);
    };
    window.addEventListener('pagehide', flushOnLeave);

    return () => {
      window.removeEventListener('pagehide', flushOnLeave);
      flushOnLeave();
      manuallyClosedRef.current = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (resyncTimerRef.current) {
        clearTimeout(resyncTimerRef.current);
        resyncTimerRef.current = null;
      }
      if (pingTimerRef.current) clearInterval(pingTimerRef.current);
      pingTimerRef.current = null;
      const socket = wsRef.current;
      wsRef.current = null;
      if (socket) {
        socket.onclose = null;
        socket.onmessage = null;
        try {
          socket.close();
        } catch {
          /* noop */
        }
      }
      setStatus('idle');
    };
  }, [boardId, enabled, connect]);

  const send = useCallback((type: string, payload: Record<string, unknown> = {}) => {
    const socket = wsRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      // Правки холста не выбрасываем: копим и досылаем после переподключения.
      // Остальные сообщения (курсоры, комментарии, голоса) эфемерны или требуют
      // подтверждения — их молча отбрасываем, как и раньше.
      if (type === 'diff' && payload.diff) {
        const diff = payload.diff as BoardDiff;
        pendingDiffsRef.current.push(diff);
        if (pendingDiffsRef.current.length > 400) pendingDiffsRef.current.shift();
        if (boardIdRef.current) pushOutbox(boardIdRef.current, diff);
        setPendingDiffs(pendingDiffsRef.current.length);
      }
      return;
    }
    try {
      socket.send(JSON.stringify({ type, payload }));
    } catch {
      if (type === 'diff' && payload.diff) {
        const diff = payload.diff as BoardDiff;
        pendingDiffsRef.current.push(diff);
        if (boardIdRef.current) pushOutbox(boardIdRef.current, diff);
        setPendingDiffs(pendingDiffsRef.current.length);
      }
    }
  }, []);

  const subscribe = useCallback((handler: (event: BoardStoreEvent) => void) => {
    storeHandlersRef.current.add(handler);
    return () => {
      storeHandlersRef.current.delete(handler);
    };
  }, []);

  const subscribeEphemeral = useCallback((handler: (message: BoardEphemeralMessage) => void) => {
    ephemeralHandlersRef.current.add(handler);
    return () => {
      ephemeralHandlersRef.current.delete(handler);
    };
  }, []);

  const addComment = useCallback(
    (input: { text: string; shapeId: string | null; x: number; y: number; mentions?: number[] }) => {
      send('comment:add', input);
    },
    [send]
  );

  const replyComment = useCallback(
    (commentId: string, text: string, mentions: number[]) => {
      send('comment:reply', { commentId, text, mentions });
    },
    [send]
  );

  const resolveComment = useCallback(
    (commentId: string, resolved: boolean) => send('comment:resolve', { commentId, resolved }),
    [send]
  );

  const removeComment = useCallback(
    (commentId: string) => send('comment:delete', { commentId }),
    [send]
  );

  const vote = useCallback(
    (shapeId: string, delta: 1 | -1) => send('vote', { shapeId, delta }),
    [send]
  );

  const clearVotes = useCallback(() => send('votes:clear'), [send]);

  const timerAction = useCallback(
    (action: BoardTimerAction, durationMs?: number) => send('timer', { action, durationMs }),
    [send]
  );

  const sendDiff = useCallback(
    (diff: unknown) => {
      send('diff', { diff: diff as Record<string, unknown> });
    },
    [send]
  );

  const sendInit = useCallback(
    (records: Record<string, unknown>) => send('init', { records }),
    [send]
  );

  const sendCursor = useCallback(
    (x: number, y: number, pageId: string | null) => send('cursor', { x, y, pageId }),
    [send]
  );

  const sendSelection = useCallback((ids: string[]) => send('selection', { ids }), [send]);

  return {
    status,
    selfId,
    peers,
    pendingDiffs,
    comments,
    votes,
    timer,
    send,
    subscribe,
    subscribeEphemeral,
    sendDiff,
    sendInit,
    sendCursor,
    sendSelection,
    addComment,
    replyComment,
    resolveComment,
    removeComment,
    vote,
    clearVotes,
    timerAction,
  };
}

export type BoardSocketApi = ReturnType<typeof useBoardSocket>;
