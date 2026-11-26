import { useCallback, useEffect, useRef, useState } from 'react';
import type { CombatRoomPeer, CombatView } from '../lib/combatProtocol';

export type CombatSocketStatus = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed' | 'error';

interface UseCombatSocketOptions {
  combatId: string | null;
  enabled: boolean;
  /** Начальное состояние из REST (пока WebSocket не подключился) */
  initialState?: CombatView | null;
}

const RECONNECT_BASE_MS = 600;
const RECONNECT_MAX_MS = 12_000;
const PING_INTERVAL_MS = 25_000;

/**
 * WebSocket-канал боя: сервер присылает полное отфильтрованное состояние после
 * каждого изменения, клиент только слушает и шлёт ping.
 *
 * Фильтрация по роли делается на сервере (Durable Object), поэтому игрок
 * физически не получает HP/AC/стат-блоки скрытых мобов.
 */
export function useCombatSocket({ combatId, enabled, initialState = null }: UseCombatSocketOptions) {
  const [state, setState] = useState<CombatView | null>(initialState);
  const [peers, setPeers] = useState<CombatRoomPeer[]>([]);
  const [status, setStatus] = useState<CombatSocketStatus>('idle');
  const [lastError, setLastError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const attemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const closedByUsRef = useRef(false);
  const combatIdRef = useRef<string | null>(combatId);

  useEffect(() => {
    combatIdRef.current = combatId;
  }, [combatId]);

  useEffect(() => {
    setState(initialState);
  }, [initialState]);

  const cleanup = useCallback(() => {
    if (pingTimerRef.current) {
      clearInterval(pingTimerRef.current);
      pingTimerRef.current = null;
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    const socket = wsRef.current;
    wsRef.current = null;
    if (socket) {
      socket.onclose = null;
      socket.onerror = null;
      socket.onmessage = null;
      socket.onopen = null;
      try {
        socket.close();
      } catch {
        /* уже закрыт */
      }
    }
  }, []);

  const connect = useCallback(() => {
    const id = combatIdRef.current;
    if (!id) return;
    cleanup();
    setStatus((prev) => (prev === 'open' ? prev : attemptsRef.current > 0 ? 'reconnecting' : 'connecting'));

    const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${scheme}://${window.location.host}/api/combats/${encodeURIComponent(id)}/ws`;

    let socket: WebSocket;
    try {
      socket = new WebSocket(url);
    } catch {
      setStatus('error');
      return;
    }
    wsRef.current = socket;

    socket.onopen = () => {
      attemptsRef.current = 0;
      setStatus('open');
      setLastError(null);
      socket.send(JSON.stringify({ type: 'hello', payload: {} }));
      pingTimerRef.current = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'ping' }));
      }, PING_INTERVAL_MS);
    };

    socket.onmessage = (event) => {
      let data: { type?: string; payload?: Record<string, unknown> } = {};
      try {
        data = JSON.parse(String(event.data)) as { type?: string; payload?: Record<string, unknown> };
      } catch {
        return;
      }
      const payload = data.payload ?? {};
      if (data.type === 'welcome' || data.type === 'state') {
        if (payload.state) setState(payload.state as CombatView);
        if (Array.isArray(payload.peers)) setPeers(payload.peers as CombatRoomPeer[]);
        setStatus('open');
      } else if (data.type === 'presence') {
        if (Array.isArray(payload.peers)) setPeers(payload.peers as CombatRoomPeer[]);
      } else if (data.type === 'error') {
        setLastError(String(payload.message ?? 'Ошибка синхронизации'));
      }
    };

    socket.onclose = () => {
      wsRef.current = null;
      if (closedByUsRef.current) {
        setStatus('closed');
        return;
      }
      setStatus('reconnecting');
      attemptsRef.current += 1;
      const delay = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** Math.min(5, attemptsRef.current));
      reconnectTimerRef.current = setTimeout(connect, delay);
    };

    socket.onerror = () => {
      setStatus('error');
    };
  }, [cleanup]);

  useEffect(() => {
    closedByUsRef.current = false;
    if (!enabled || !combatId) {
      cleanup();
      setStatus('idle');
      return;
    }
    attemptsRef.current = 0;
    connect();
    return () => {
      closedByUsRef.current = true;
      cleanup();
    };
  }, [combatId, enabled, connect, cleanup]);

  const reconnect = useCallback(() => {
    attemptsRef.current = 0;
    connect();
  }, [connect]);

  return { state, peers, status, lastError, reconnect, setState };
}

export type CombatSocketApi = ReturnType<typeof useCombatSocket>;
