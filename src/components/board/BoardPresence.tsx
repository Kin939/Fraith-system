import React, { useEffect, useState } from 'react';
import { Crown, Wifi, WifiOff } from 'lucide-react';
import { useValue, type Editor } from 'tldraw';
import type { BoardPeer } from '../../lib/boardProtocol';
import type { BoardSocketApi } from '../../hooks/useBoardSocket';

/* -------------------------------------------------------------------------- */
/*  Живые курсоры участников                                                   */
/* -------------------------------------------------------------------------- */

interface LiveCursor {
  x: number;
  y: number;
  pageId: string | null;
  displayName: string;
  color: string;
  at: number;
}

export const BoardCursorOverlay: React.FC<{
  editor: Editor;
  socket: BoardSocketApi;
  selfId: number | null;
}> = ({ editor, socket, selfId }) => {
  const [cursors, setCursors] = useState<Record<number, LiveCursor>>({});
  const camera = useValue('board-cursor-camera', () => editor.getCamera(), [editor]);
  const { subscribeEphemeral } = socket;

  useEffect(
    () =>
      subscribeEphemeral((message) => {
        if (message.type !== 'cursor') return;
        const payload = message.payload;
        if (payload.userId === selfId) return;
        setCursors((prev) => ({
          ...prev,
          [payload.userId]: {
            x: payload.x,
            y: payload.y,
            pageId: payload.pageId ?? null,
            displayName: payload.displayName,
            color: payload.color,
            at: Date.now(),
          },
        }));
      }),
    [subscribeEphemeral, selfId]
  );

  useEffect(() => {
    const prune = setInterval(() => {
      const cutoff = Date.now() - 15_000;
      setCursors((prev) => {
        const next: Record<number, LiveCursor> = {};
        let changed = false;
        Object.entries(prev).forEach(([id, cursor]) => {
          if (cursor.at >= cutoff) next[Number(id)] = cursor;
          else changed = true;
        });
        return changed ? next : prev;
      });
    }, 5000);
    return () => clearInterval(prune);
  }, []);

  const pageId = editor.getCurrentPageId();
  const visible = Object.entries(cursors).filter(
    ([, cursor]) => !cursor.pageId || cursor.pageId === pageId
  );

  return (
    <div className="absolute inset-0 pointer-events-none z-[2] overflow-hidden" data-camera={camera.x + camera.y + camera.z}>
      {visible.map(([id, cursor]) => {
        const point = editor.pageToViewport({ x: cursor.x, y: cursor.y });
        if (point.x < -60 || point.y < -60) return null;
        return (
          <div
            key={id}
            className="absolute flex items-start gap-1 transition-transform duration-75 ease-linear will-change-transform"
            style={{ transform: `translate3d(${point.x}px, ${point.y}px, 0)` }}
          >
            <svg width="18" height="22" viewBox="0 0 18 22" fill="none" aria-hidden="true">
              <path
                d="M1 1L16 11.2L8.9 12.4L5.6 20L1 1Z"
                fill={cursor.color}
                stroke="rgba(6,8,16,0.85)"
                strokeWidth="1.2"
              />
            </svg>
            <span
              className="mt-4 px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap max-w-[160px] truncate border"
              style={{
                backgroundColor: 'rgba(8,10,20,0.88)',
                borderColor: cursor.color,
                color: cursor.color,
                boxShadow: `0 0 12px ${cursor.color}55`,
              }}
            >
              {cursor.displayName}
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

export const BoardSelectionOverlay: React.FC<{
  editor: Editor;
  socket: BoardSocketApi;
  selfId: number | null;
}> = ({ editor, socket, selfId }) => {
  const [selections, setSelections] = useState<Record<number, { ids: string[]; color: string; displayName: string }>>({});
  const camera = useValue('board-selection-camera', () => editor.getCamera(), [editor]);
  const { subscribeEphemeral } = socket;

  useEffect(
    () =>
      subscribeEphemeral((message) => {
        if (message.type !== 'selection') return;
        if (message.payload.userId === selfId) return;
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

  return (
    <div className="absolute inset-0 pointer-events-none z-[2] overflow-hidden" data-camera={camera.z}>
      {Object.entries(selections).flatMap(([userId, selection]) =>
        selection.ids.slice(0, 40).map((shapeId) => {
          const bounds = editor.getShapePageBounds(shapeId as never);
          if (!bounds) return null;
          const topLeft = editor.pageToViewport({ x: bounds.minX, y: bounds.minY });
          const bottomRight = editor.pageToViewport({ x: bounds.maxX, y: bounds.maxY });
          return (
            <div
              key={`${userId}-${shapeId}`}
              className="absolute border-2"
              style={{
                left: topLeft.x,
                top: topLeft.y,
                width: Math.max(2, bottomRight.x - topLeft.x),
                height: Math.max(2, bottomRight.y - topLeft.y),
                borderColor: selection.color,
                backgroundColor: `${selection.color}14`,
                boxShadow: `0 0 12px ${selection.color}44`,
              }}
            />
          );
        })
      )}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  Панель присутствия                                                         */
/* -------------------------------------------------------------------------- */

const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?';

export const BoardPresenceBar: React.FC<{
  peers: BoardPeer[];
  status: BoardSocketApi['status'];
  selfId: number | null;
}> = ({ peers, status, selfId }) => {
  const online = status === 'open';
  return (
    <div className="flex items-center gap-2">
      <div
        className={`flex items-center gap-1.5 px-2 h-8 border text-[10px] font-mono uppercase tracking-wide ${
          online ? 'border-positive/40 text-positive' : 'border-warning/40 text-warning'
        }`}
        title={online ? 'Синхронизация активна' : 'Переподключение…'}
      >
        {online ? <Wifi className="w-3 h-3" strokeWidth={1.5} /> : <WifiOff className="w-3 h-3" strokeWidth={1.5} />}
        <span>{online ? 'live' : 'sync'}</span>
      </div>

      <div className="flex items-center -space-x-1.5">
        {peers.slice(0, 6).map((peer) => (
          <div
            key={`${peer.userId}-${peer.connectedAt}`}
            title={`${peer.displayName}${peer.permission === 'read' ? ' · только чтение' : ''}`}
            className="relative w-8 h-8 flex items-center justify-center text-[11px] font-semibold border bg-deep"
            style={{
              borderColor: peer.color,
              color: peer.color,
              boxShadow: peer.userId === selfId ? `0 0 10px ${peer.color}66` : undefined,
            }}
          >
            {initials(peer.displayName)}
            {peer.role === 'dm' && (
              <Crown className="absolute -top-1 -right-1 w-3 h-3 text-warning" strokeWidth={1.5} />
            )}
          </div>
        ))}
        {peers.length > 6 && (
          <div className="w-8 h-8 flex items-center justify-center text-[10px] border border-border text-muted bg-deep">
            +{peers.length - 6}
          </div>
        )}
      </div>
    </div>
  );
};
