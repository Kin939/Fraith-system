import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Tldraw,
  getSnapshot,
  loadSnapshot,
  useEditor,
  useValue,
  type Editor,
  type RecordsDiff,
  type TLAssetStore,
  type TLComponents,
  type TLRecord,
} from 'tldraw';
import 'tldraw/tldraw.css';
import type { AuthUser } from '../../lib/types';
import type { BoardBackground, BoardPermission } from '../../lib/boards';
import { uploadBoardFile } from '../../lib/boards';
import { TLDRAW_LICENSE_KEY } from '../../lib/boardConfig';
import type { BoardSocketApi } from '../../hooks/useBoardSocket';
import { BoardCursorOverlay, BoardSelectionOverlay } from './BoardPresence';
import { BoardCommentPins, BoardMinimap, BoardVoteBadges } from './BoardPins';

/* -------------------------------------------------------------------------- */
/*  Фон доски: точки / линии / клетки (в тёмной теме, движется с зумом)        */
/* -------------------------------------------------------------------------- */

const BoardBackgroundLayer: React.FC<{ variant: BoardBackground; size: number }> = ({ variant, size }) => {
  const editor = useEditor();
  const camera = useValue('board-bg-camera', () => editor.getCamera(), [editor]);

  if (variant === 'plain') {
    return <div className="absolute inset-0" style={{ backgroundColor: 'var(--bg-deep,#08090f)' }} />;
  }

  const spacing = Math.max(8, size * camera.z);
  const color = 'rgba(148,163,184,0.22)';
  const styles: React.CSSProperties = {
    backgroundColor: 'var(--bg-deep,#08090f)',
    backgroundPosition: `${camera.x}px ${camera.y}px`,
    backgroundSize: `${spacing}px ${spacing}px`,
  };

  if (variant === 'dots') {
    styles.backgroundImage = `radial-gradient(circle, ${color} 1px, transparent 1.4px)`;
  } else if (variant === 'lines') {
    styles.backgroundImage = `linear-gradient(to right, ${color} 1px, transparent 1px)`;
  } else {
    styles.backgroundImage = `linear-gradient(to right, ${color} 1px, transparent 1px), linear-gradient(to bottom, ${color} 1px, transparent 1px)`;
  }

  return <div className="absolute inset-0" style={styles} />;
};

interface BoardCanvasProps {
  boardId: string;
  permission: BoardPermission;
  background: BoardBackground;
  gridSize: number;
  socket: BoardSocketApi;
  user: AuthUser;
  tool: 'comment' | 'vote' | null;
  onCanvasPick: (pick: { point: { x: number; y: number }; shapeId: string | null }) => void;
  onEditorReady: (editor: Editor | null) => void;
  activeCommentId: string | null;
  onSelectComment: (commentId: string) => void;
}

/**
 * Холст доски: tldraw SDK + двусторонняя синхронизация через BoardRoom DO.
 *
 * Локальные изменения store → diff → WS → DO → остальные клиенты.
 * Presence и курсоры эфемерны и не попадают в документ.
 */
export const BoardCanvas: React.FC<BoardCanvasProps> = ({
  boardId,
  permission,
  background,
  gridSize,
  socket,
  tool,
  onCanvasPick,
  onEditorReady,
  activeCommentId,
  onSelectComment,
}) => {
  const [editor, setEditor] = useState<Editor | null>(null);
  const [synced, setSynced] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastCursorAtRef = useRef(0);
  const lastSelectionRef = useRef('');
  const readOnly = permission === 'read';

  const assets = useMemo<TLAssetStore>(
    () => ({
      upload: async (_asset, file) => {
        const uploaded = await uploadBoardFile(boardId, file);
        return { src: uploaded.url };
      },
      resolve: (asset) => {
        const props = asset.props as { src?: string };
        return props.src ?? '';
      },
    }),
    [boardId]
  );

  const components = useMemo<TLComponents>(
    () => ({
      Background: () => <BoardBackgroundLayer variant={background} size={gridSize} />,
    }),
    [background, gridSize]
  );

  const handleMount = useCallback(
    (mounted: Editor) => {
      mounted.user.updateUserPreferences({ colorScheme: 'dark' });
      mounted.updateInstanceState({ isReadonly: readOnly });
      setEditor(mounted);
      onEditorReady(mounted);
    },
    [onEditorReady, readOnly]
  );

  useEffect(() => {
    if (!editor) return;
    editor.updateInstanceState({ isReadonly: readOnly });
  }, [editor, readOnly]);

  // ------------------------------------------------------------ синхронизация

  // Стабильные функции сокета (сам объект пересоздаётся при каждом сообщении presence).
  const { subscribe, sendDiff, sendInit, sendSelection, sendCursor } = socket;

  useEffect(() => {
    if (!editor) return;
    let disposed = false;

    const applyRemoteDiff = (diff: unknown) => {
      try {
        editor.store.mergeRemoteChanges(() => {
          editor.store.applyDiff(diff as RecordsDiff<TLRecord>);
        });
      } catch (err) {
        setSyncError(err instanceof Error ? err.message : 'Не удалось применить изменение');
      }
    };

    const applySnapshot = (records: Record<string, unknown>) => {
      try {
        const current = getSnapshot(editor.store);
        editor.store.mergeRemoteChanges(() => {
          loadSnapshot(editor.store, {
            store: records as never,
            schema: current.document.schema,
          });
        });
        if (editor.getCurrentPageShapes().length > 0) {
          editor.zoomToFit({ animation: { duration: 0 } });
        }
      } catch (err) {
        setSyncError(err instanceof Error ? err.message : 'Не удалось загрузить доску');
      }
    };

    const unsubscribe = subscribe((event) => {
      if (disposed) return;
      switch (event.kind) {
        case 'snapshot': {
          applySnapshot(event.records);
          setSynced(true);
          break;
        }
        case 'empty': {
          setSynced(true);
          if (!readOnly) {
            const snapshot = editor.store.getStoreSnapshot('document');
            sendInit(snapshot.store as unknown as Record<string, unknown>);
          }
          break;
        }
        case 'replay': {
          event.patches.forEach((patch) => applyRemoteDiff(patch.diff));
          setSynced(true);
          break;
        }
        case 'patch': {
          applyRemoteDiff(event.diff);
          break;
        }
        case 'reset-hint': {
          /* другая вкладка инициализировала пустую доску — локальное состояние уже совпадает */
          break;
        }
        case 'resync': {
          // Доска уже была инициализирована другим участником: ждём полный снапшот.
          setSynced(false);
          break;
        }
        default:
          break;
      }
    });

    const unlistenLocal = editor.store.listen(
      (entry) => {
        if (readOnly) return;
        const diff = entry.changes as RecordsDiff<TLRecord>;
        const changed =
          Object.keys(diff.added).length + Object.keys(diff.updated).length + Object.keys(diff.removed).length;
        if (changed === 0) return;
        sendDiff(diff);
      },
      { scope: 'document', source: 'user' }
    );

    const unlistenSelection = editor.store.listen(
      () => {
        const ids = editor.getSelectedShapeIds().map(String);
        const key = ids.join(',');
        if (key === lastSelectionRef.current) return;
        lastSelectionRef.current = key;
        sendSelection(ids);
      },
      { scope: 'session', source: 'all' }
    );

    return () => {
      disposed = true;
      unsubscribe();
      unlistenLocal();
      unlistenSelection();
    };
  }, [editor, subscribe, sendDiff, sendInit, sendSelection, readOnly]);

  // ----------------------------------------------------- курсоры и выделения

  useEffect(() => {
    if (!editor) return;
    const container = containerRef.current;
    if (!container) return;

    const handleMove = (event: PointerEvent) => {
      const now = performance.now();
      if (now - lastCursorAtRef.current < 45) return;
      lastCursorAtRef.current = now;
      const rect = container.getBoundingClientRect();
      const point = editor.screenToPage({ x: event.clientX - rect.left, y: event.clientY - rect.top });
      sendCursor(point.x, point.y, String(editor.getCurrentPageId()));
    };

    const handleLeave = () => {
      sendCursor(Number.NaN, Number.NaN, String(editor.getCurrentPageId()));
    };

    container.addEventListener('pointermove', handleMove, { passive: true });
    container.addEventListener('pointerleave', handleLeave, { passive: true });
    return () => {
      container.removeEventListener('pointermove', handleMove);
      container.removeEventListener('pointerleave', handleLeave);
    };
  }, [editor, sendCursor]);

  // ------------------------------------------------------------------ разметка

  const handlePick = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!editor || !tool) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const point = editor.screenToPage({ x: event.clientX - rect.left, y: event.clientY - rect.top });
    const shape = editor.getShapeAtPoint(point, { hitInside: true, margin: 6 });
    onCanvasPick({ point, shapeId: shape ? String(shape.id) : null });
  };

  return (
    <div className="relative flex-1 min-w-0 h-full overflow-hidden bg-deep">
      <div ref={containerRef} className="absolute inset-0">
        <Tldraw
          licenseKey={TLDRAW_LICENSE_KEY}
          onMount={handleMount}
          assets={assets}
          components={components}
          autoFocus={false}
          inferDarkMode={false}
        />
      </div>

      {editor && (
        <>
          <BoardSelectionOverlay editor={editor} socket={socket} selfId={socket.selfId} />
          <BoardCursorOverlay editor={editor} socket={socket} selfId={socket.selfId} />
          <BoardCommentPins
            editor={editor}
            comments={socket.comments}
            activeCommentId={activeCommentId}
            onSelect={onSelectComment}
            showResolved
          />
          <BoardVoteBadges editor={editor} votes={socket.votes} />
          <BoardMinimap editor={editor} />
        </>
      )}

      {tool && (
        <div
          className="absolute inset-0 z-[260] cursor-crosshair"
          style={{ backgroundColor: 'rgba(34,211,238,0.06)' }}
          onPointerDown={handlePick}
        >
          <div className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1.5 border border-primary/60 bg-deep/95 text-[11px] text-primary font-mono uppercase tracking-wide">
            {tool === 'comment' ? 'Кликните по холсту, чтобы поставить комментарий' : 'Кликните по объекту для голоса'}
          </div>
        </div>
      )}

      {!synced && (
        <div className="absolute inset-0 z-[270] flex items-center justify-center bg-deep/80 backdrop-blur-sm">
          <div className="glass-panel hud-cut px-5 py-4 text-center space-y-1">
            <div className="text-sm text-text">Синхронизация доски…</div>
            <div className="text-[11px] text-muted font-mono">
              {socket.status === 'reconnecting' ? 'переподключение' : 'загрузка состояния'}
            </div>
          </div>
        </div>
      )}

      {readOnly && synced && (
        <div className="absolute top-3 left-3 z-[240] px-2 py-1 border border-warning/50 bg-deep/95 text-[10px] font-mono uppercase tracking-wide text-warning pointer-events-none">
          Только чтение
        </div>
      )}

      {syncError && (
        <div className="absolute bottom-3 left-3 z-[240] max-w-xs px-3 py-2 border border-negative/50 bg-deep/95 text-[11px] text-negative">
          {syncError}
        </div>
      )}
    </div>
  );
};
