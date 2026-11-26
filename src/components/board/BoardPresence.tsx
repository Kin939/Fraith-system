import React, { useEffect, useRef, useState } from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { PeerAvatar } from '../common/PeerAvatar';
import { useValue, type Editor } from 'tldraw';
import type { BoardPeer } from '../../lib/boardProtocol';
import type { BoardSocketApi } from '../../hooks/useBoardSocket';

/* -------------------------------------------------------------------------- */
/*  Аватар участника (везде, где показывается пользователь)                    */
/* -------------------------------------------------------------------------- */

export { PeerAvatar } from '../common/PeerAvatar';

/* -------------------------------------------------------------------------- */
/*  Живые курсоры участников (плавная интерполяция)                            */
/* -------------------------------------------------------------------------- */

interface LiveCursor {
  x: number;
  y: number;
  pageId: string | null;
  displayName: string;
  color: string;
  avatarUrl?: string | null;
  at: number;
}

export const BoardCursorOverlay: React.FC<{
  editor: Editor;
  socket: BoardSocketApi;
  selfId: number | null;
}> = ({ editor, socket, selfId }) => {
  const targetsRef = useRef<Record<number, LiveCursor>>({});
  const [cursors, setCursors] = useState<Record<number, LiveCursor>>({});
  const camera = useValue('board-cursor-camera', () => editor.getCamera(), [editor]);
  const { subscribeEphemeral } = socket;

  useEffect(
    () =>
      subscribeEphemeral((message) => {
        if (message.type !== 'cursor') return;
        const payload = message.payload;
        if (payload.userId === selfId) return;
        if (!Number.isFinite(payload.x) || !Number.isFinite(payload.y)) {
          delete targetsRef.current[payload.userId];
          return;
        }
        targetsRef.current[payload.userId] = {
          x: payload.x,
          y: payload.y,
          pageId: payload.pageId ?? null,
          displayName: payload.displayName,
          color: payload.color,
          at: Date.now(),
        };
      }),
    [subscribeEphemeral, selfId]
  );

  // Один rAF-цикл: плавно догоняем целевую позицию курсора (без рывков от сетевых пакетов).
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const targets = targetsRef.current;
      const now = Date.now();
      setCursors((prev) => {
        const next: Record<number, LiveCursor> = {};
        let changed = false;

        for (const [rawId, target] of Object.entries(targets)) {
          const id = Number(rawId);
          if (now - target.at > 4000) {
            delete targets[id];
            changed = true;
            continue;
          }
          const current = prev[id];
          if (!current) {
            next[id] = { ...target };
            changed = true;
            continue;
          }
          const dx = target.x - current.x;
          const dy = target.y - current.y;
          if (Math.abs(dx) < 0.4 && Math.abs(dy) < 0.4) {
            next[id] = current;
            continue;
          }
          next[id] = {
            ...current,
            x: current.x + dx * 0.28,
            y: current.y + dy * 0.28,
            at: target.at,
            displayName: target.displayName,
            color: target.color,
          };
          changed = true;
        }

        if (!changed && Object.keys(prev).length === Object.keys(next).length) return prev;
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const pageId = editor.getCurrentPageId();
  const visible = Object.entries(cursors).filter(
    ([, cursor]) => !cursor.pageId || cursor.pageId === pageId
  );

  return (
    <div
      className="absolute inset-0 pointer-events-none z-[2] overflow-hidden"
      data-camera={camera.x + camera.y + camera.z}
    >
      {visible.map(([id, cursor]) => {
        const point = editor.pageToViewport({ x: cursor.x, y: cursor.y });
        if (point.x < -80 || point.y < -80) return null;
        return (
          <div
            key={id}
            className="absolute flex items-start gap-1 will-change-transform"
            style={{ transform: `translate3d(${point.x}px, ${point.y}px, 0)` }}
          >
            <svg width="16" height="20" viewBox="0 0 18 22" fill="none" aria-hidden="true">
              <path
                d="M1 1L16 11.2L8.9 12.4L5.6 20L1 1Z"
                fill={cursor.color}
                stroke="rgba(6,8,16,0.85)"
                strokeWidth="1.2"
              />
            </svg>
            <span
              className="mt-3.5 flex items-center gap-1 pl-0.5 pr-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap max-w-[170px] border"
              style={{
                backgroundColor: 'rgba(8,10,20,0.9)',
                borderColor: cursor.color,
                color: cursor.color,
                boxShadow: `0 0 12px ${cursor.color}55`,
              }}
            >
              {cursor.avatarUrl && (
                <img
                  src={cursor.avatarUrl}
                  alt=""
                  className="w-3.5 h-3.5 object-cover rounded-full"
                  onError={(event) => {
                    event.currentTarget.style.display = 'none';
                  }}
                />
              )}
              <span className="truncate">{cursor.displayName}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  Выделения других участников                                                */
/* -------------------------------------------------------------------------- */

interface PeerSelection {
  ids: string[];
  color: string;
  displayName: string;
  avatarUrl?: string | null;
}

export const BoardSelectionOverlay: React.FC<{
  editor: Editor;
  socket: BoardSocketApi;
  selfId: number | null;
}> = ({ editor, socket, selfId }) => {
  const [selections, setSelections] = useState<Record<number, PeerSelection>>({});
  const camera = useValue('board-selection-camera', () => editor.getCamera(), [editor]);
  const { subscribeEphemeral } = socket;

  useEffect(
    () =>
      subscribeEphemeral((message) => {
        if (message.type !== 'selection') return;
        if (message.payload.userId === selfId) return;
        if (message.payload.ids.length === 0) {
          setSelections((prev) => {
            if (!prev[message.payload.userId]) return prev;
            const next = { ...prev };
            delete next[message.payload.userId];
            return next;
          });
          return;
        }
        setSelections((prev) => ({
          ...prev,
          [message.payload.userId]: {
            ids: message.payload.ids,
            color: message.payload.color,
            displayName: message.payload.displayName,
          },
        }));
      }),
    [subscribeEphemeral, selfId]
  );

  // Аватары участников подтягиваем из presence-снимка.
  useEffect(() => {
    if (socket.peers.length === 0) return;
    setSelections((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const peer of socket.peers) {
        const entry = next[peer.userId];
        if (entry && entry.avatarUrl !== peer.avatarUrl) {
          next[peer.userId] = { ...entry, avatarUrl: peer.avatarUrl };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [socket.peers]);

  return (
    <div className="absolute inset-0 pointer-events-none z-[2] overflow-hidden" data-camera={camera.z}>
      {Object.entries(selections).map(([rawId, selection]) => {
        const boxes = selection.ids
          .slice(0, 120)
          .map((shapeId) => editor.getShapePageBounds(shapeId as never))
          .filter((bounds): bounds is NonNullable<typeof bounds> => Boolean(bounds));
        if (boxes.length === 0) return null;

        const minX = Math.min(...boxes.map((b) => b.minX));
        const minY = Math.min(...boxes.map((b) => b.minY));
        const anchor = editor.pageToViewport({ x: minX, y: minY });

        return (
          <React.Fragment key={`sel-${rawId}`}>
            {boxes.map((bounds, index) => {
              const topLeft = editor.pageToViewport({ x: bounds.minX, y: bounds.minY });
              const bottomRight = editor.pageToViewport({ x: bounds.maxX, y: bounds.maxY });
              return (
                <div
                  key={index}
                  className="absolute"
                  style={{
                    left: topLeft.x - 3,
                    top: topLeft.y - 3,
                    width: Math.max(4, bottomRight.x - topLeft.x) + 6,
                    height: Math.max(4, bottomRight.y - topLeft.y) + 6,
                    border: `1.5px solid ${selection.color}`,
                    borderRadius: 6,
                    backgroundColor: `${selection.color}12`,
                    boxShadow: `0 0 0 1px ${selection.color}22, 0 0 14px ${selection.color}55`,
                  }}
                />
              );
            })}

            <div
              className="absolute flex items-center gap-1 pl-0.5 pr-1.5 h-5 border"
              style={{
                left: anchor.x - 3,
                top: anchor.y - 25,
                backgroundColor: 'rgba(8,10,20,0.92)',
                borderColor: selection.color,
                color: selection.color,
                boxShadow: `0 0 10px ${selection.color}44`,
              }}
            >
              {selection.avatarUrl ? (
                <img
                  src={selection.avatarUrl}
                  alt=""
                  className="w-3.5 h-3.5 object-cover rounded-full"
                  onError={(event) => {
                    event.currentTarget.style.display = 'none';
                  }}
                />
              ) : null}
              <span className="text-[9px] font-medium whitespace-nowrap">{selection.displayName}</span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  Панель присутствия                                                         */
/* -------------------------------------------------------------------------- */

export const BoardPresenceBar: React.FC<{
  peers: BoardPeer[];
  status: BoardSocketApi['status'];
  selfId: number | null;
  /** Правки, ещё не подтверждённые сервером. */
  pendingDiffs?: number;
}> = ({ peers, status, selfId, pendingDiffs = 0 }) => {
  const online = status === 'open';
  const saving = pendingDiffs > 0;
  return (
    <div className="flex items-center gap-2">
      <div
        className={`flex items-center gap-1.5 px-2 h-8 border text-[10px] font-mono uppercase tracking-wide ${
          !online
            ? 'border-warning/40 text-warning'
            : saving
              ? 'border-primary/50 text-primary'
              : 'border-positive/40 text-positive'
        }`}
        title={
          !online
            ? 'Переподключение…'
            : saving
              ? `Сохраняю правки: ${pendingDiffs}`
              : 'Все правки сохранены'
        }
      >
        {!online ? (
          <WifiOff className="w-3 h-3" strokeWidth={1.5} />
        ) : (
          <Wifi className="w-3 h-3" strokeWidth={1.5} />
        )}
        <span>{!online ? 'sync' : saving ? 'сохраняю…' : 'сохранено'}</span>
      </div>

      {/* Аватары участников: строго в ряд, без наездов друг на друга */}
      <div className="flex items-center gap-1.5">
        {peers.slice(0, 7).map((peer) => (
          <div
            key={`${peer.userId}-${peer.connectedAt}`}
            className="relative shrink-0 rounded-full ring-2 ring-deep transition-transform duration-150 hover:scale-110"
          >
            <PeerAvatar
              name={peer.displayName}
              color={peer.color}
              avatarUrl={peer.avatarUrl}
              size={26}
              active={peer.userId === selfId}
              crown={peer.role === 'dm'}
              title={`${peer.displayName}${peer.permission === 'read' ? ' · только чтение' : ''}`}
            />
          </div>
        ))}
        {peers.length > 7 && (
          <span className="ml-1 text-[10px] font-mono text-muted">+{peers.length - 7}</span>
        )}
      </div>
    </div>
  );
};
