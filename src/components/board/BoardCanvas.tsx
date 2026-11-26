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
import type { TLContent } from '@tldraw/editor';
import 'tldraw/tldraw.css';
import './boardFonts.css';
import type { AuthUser } from '../../lib/types';
import type { BoardBackground, BoardPermission } from '../../lib/boards';
import { uploadBoardFile } from '../../lib/boards';
import { TLDRAW_LICENSE_KEY } from '../../lib/boardConfig';
import { fontPresetClass } from '../../lib/boardFonts';
import type { BoardSocketApi } from '../../hooks/useBoardSocket';
import { BoardCursorOverlay, BoardSelectionOverlay } from './BoardPresence';
import { X } from 'lucide-react';
import { BoardCommentPins, BoardMinimap, BoardVoteBadges } from './BoardPins';

/* -------------------------------------------------------------------------- */
/*  Фон доски: точки / линии / клетки (в тёмной теме, движется с зумом)        */
/* -------------------------------------------------------------------------- */

const BoardBackgroundLayer: React.FC<{ variant: BoardBackground; size: number; color: string }> = ({
  variant,
  size,
  color,
}) => {
  const editor = useEditor();
  const camera = useValue('board-bg-camera', () => editor.getCamera(), [editor]);

  const base = color || 'var(--bg-deep,#08090f)';

  if (variant === 'plain') {
    return <div className="absolute inset-0" style={{ backgroundColor: base }} />;
  }

  const spacing = Math.max(8, size * camera.z);
  const lineColor = 'rgba(148,163,184,0.22)';
  const styles: React.CSSProperties = {
    backgroundColor: base,
    backgroundPosition: `${camera.x}px ${camera.y}px`,
    backgroundSize: `${spacing}px ${spacing}px`,
  };

  if (variant === 'dots') {
    styles.backgroundImage = `radial-gradient(circle, ${lineColor} 1px, transparent 1.4px)`;
  } else if (variant === 'lines') {
    styles.backgroundImage = `linear-gradient(to right, ${lineColor} 1px, transparent 1px)`;
  } else {
    styles.backgroundImage = `linear-gradient(to right, ${lineColor} 1px, transparent 1px), linear-gradient(to bottom, ${lineColor} 1px, transparent 1px)`;
  }

  return <div className="absolute inset-0" style={styles} />;
};

/**
 * Колесо мыши = зум (к пользователю / от пользователя), пинч на тачпаде — тоже зум.
 * Панорамирование: Space+драг, средняя кнопка мыши или правая кнопка с драгом.
 */
const CAMERA_OPTIONS = {
  wheelBehavior: 'zoom' as const,
  zoomSpeed: 1.15,
  panSpeed: 1,
  zoomSteps: [0.05, 0.1, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4, 6, 8, 12, 16],
};

interface BoardCanvasProps {
  boardId: string;
  permission: BoardPermission;
  background: BoardBackground;
  bgColor?: string;
  gridSize: number;
  fontPreset: string;
  socket: BoardSocketApi;
  user: AuthUser;
  tool: 'comment' | 'vote' | null;
  onCanvasPick: (pick: { point: { x: number; y: number }; shapeId: string | null }) => void;
  onEditorReady: (editor: Editor | null) => void;
  activeCommentId: string | null;
  onSelectComment: (commentId: string) => void;
}

/** Подсказка по управлению: показывается один раз, скрывается по крестику. */
const BoardHint: React.FC<{ onDismiss: () => void }> = ({ onDismiss }) => (
  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[230] flex items-center gap-2 px-2.5 py-1 border border-border bg-deep/92 backdrop-blur-sm text-[10px] font-mono text-muted whitespace-nowrap max-w-[92vw] overflow-x-auto">
    <span className="text-secondary">колесо — зум</span>
    <span className="text-border">·</span>
    <span>space / СКМ — панорама</span>
    <span className="text-border">·</span>
    <span>ctrl+Z / ctrl+Y</span>
    <span className="text-border">·</span>
    <span>ctrl+C / V / D</span>
    <span className="text-border">·</span>
    <span>del — удалить</span>
    <span className="text-border">·</span>
    <span className="text-primary/80">стрелка: тяните от объекта к объекту</span>
    <button type="button" onClick={onDismiss} className="text-muted hover:text-text shrink-0" title="Скрыть подсказку">
      <X className="w-3 h-3" strokeWidth={2} />
    </button>
  </div>
);

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
  bgColor,
  gridSize,
  fontPreset,
  socket,
  tool,
  onCanvasPick,
  onEditorReady,
  activeCommentId,
  onSelectComment,
}) => {
  const [editor, setEditor] = useState<Editor | null>(null);
  const [synced, setSynced] = useState(false);
  const [hintVisible, setHintVisible] = useState(true);
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
      Background: () => <BoardBackgroundLayer variant={background} size={gridSize} color={bgColor ?? ''} />,
    }),
    [background, gridSize]
  );

  const handleMount = useCallback(
    (mounted: Editor) => {
      mounted.user.updateUserPreferences({ colorScheme: 'dark' });
      mounted.updateInstanceState({ isReadonly: readOnly });
      // Фокус на холсте нужен, чтобы нативные хоткеи tldraw (Ctrl+Z, Del, копирование) работали сразу.
      requestAnimationFrame(() => {
        try {
          mounted.getContainer().focus();
        } catch {
          /* контейнер мог ещё не смонтироваться */
        }
      });
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

  // ------------------------------------------------- буфер обмена (свой, надёжный)

  /**
   * В embedded-превью доступ к системному буферу часто заблокирован политикой
   * разрешений, из-за чего Ctrl+C/Ctrl+V «молча» не работают. Держим собственный
   * снимок выделения: копирование по-прежнему попадает в системный буфер (если
   * браузер разрешает), а вставка использует системные данные, когда они есть,
   * и внутренний снимок — когда их нет.
   */
  const clipboardRef = useRef<TLContent | null>(null);

  useEffect(() => {
    if (!editor) return;

    const pointerPoint = () => {
      const point = editor.inputs.currentPagePoint;
      if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) {
        return { x: point.x, y: point.y };
      }
      const bounds = editor.getViewportPageBounds();
      return { x: bounds.center.x, y: bounds.center.y };
    };

    const handleCopy = () => {
      if (readOnly) return;
      const ids = editor.getSelectedShapeIds();
      if (ids.length === 0) return;
      const content = editor.getContentFromCurrentPage(ids);
      if (content) clipboardRef.current = content;
    };

    const handlePaste = (event: ClipboardEvent) => {
      if (readOnly) return;
      const buffer = clipboardRef.current;
      if (!buffer) return;
      const types = event.clipboardData ? Array.from(event.clipboardData.types) : [];
      if (types.length > 0) return; // в системном буфере есть данные — пусть работает tldraw

      event.preventDefault();
      event.stopPropagation();
      editor.putContentOntoCurrentPage(buffer, { point: pointerPoint(), select: true });
    };

    window.addEventListener('copy', handleCopy, true);
    window.addEventListener('paste', handlePaste, true);
    return () => {
      window.removeEventListener('copy', handleCopy, true);
      window.removeEventListener('paste', handlePaste, true);
    };
  }, [editor, readOnly]);

  // --------------------------------------------------- клавиатурные сокращения

  /**
   * tldraw сам обрабатывает хоткеи, если у холста есть фокус. Наш обработчик —
   * страховка для случая, когда фокус остался в интерфейсе доски: он срабатывает
   * только если tldraw событие не поглотил (event.defaultPrevented === false).
   */
  useEffect(() => {
    if (!editor) return;

    const handler = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;

      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (target.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      }
      if (editor.getEditingShapeId()) return; // идёт редактирование текста внутри фигуры

      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      const selection = editor.getSelectedShapeIds();

      if (mod && key === 'z') {
        event.preventDefault();
        if (event.shiftKey) editor.redo();
        else editor.undo();
        return;
      }
      if (mod && key === 'y') {
        event.preventDefault();
        editor.redo();
        return;
      }
      if (mod && key === 'a') {
        event.preventDefault();
        editor.selectAll();
        return;
      }
      if (mod && key === 'd') {
        event.preventDefault();
        if (selection.length > 0 && !readOnly) editor.duplicateShapes(selection, { x: 24, y: 24 });
        return;
      }
      if (mod && key === 'x') {
        // Своя «вырезать»: снимок в буфер + удаление, без зависимости от прав браузера.
        if (selection.length > 0 && !readOnly) {
          event.preventDefault();
          const content = editor.getContentFromCurrentPage(selection);
          if (content) clipboardRef.current = content;
          editor.deleteShapes(selection);
        }
        return;
      }
      if (mod && (key === 'c' || key === 'v' || key === 's' || key === 'p')) {
        return; // копирование/вставка — нативные обработчики tldraw (+ наш фолбэк выше)
      }
      if (!mod && (event.key === 'Delete' || event.key === 'Backspace')) {
        if (selection.length > 0 && !readOnly) {
          event.preventDefault();
          editor.deleteShapes(selection);
        }
        return;
      }
      if (!mod && event.key === 'Escape') {
        editor.setCurrentTool('select');
        editor.selectNone();
        return;
      }
      if (!mod && (event.key === '+' || event.key === '=')) {
        event.preventDefault();
        editor.zoomIn();
        return;
      }
      if (!mod && event.key === '-') {
        event.preventDefault();
        editor.zoomOut();
        return;
      }
      if (!mod && event.key === '0') {
        event.preventDefault();
        editor.resetZoom();
        return;
      }
      if (!mod && key === 'f') {
        if (selection.length > 0) editor.zoomToSelection({ animation: { duration: 200 } });
        else editor.zoomToFit({ animation: { duration: 200 } });
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [editor, readOnly]);

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
    <div
      className={`relative flex-1 min-w-0 h-full overflow-hidden bg-deep ${fontPresetClass(fontPreset)}`}
    >
      <div ref={containerRef} className="absolute inset-0">
        <Tldraw
          licenseKey={TLDRAW_LICENSE_KEY}
          onMount={handleMount}
          assets={assets}
          components={components}
          autoFocus
          inferDarkMode={false}
          cameraOptions={CAMERA_OPTIONS}
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
          {hintVisible && <BoardHint onDismiss={() => setHintVisible(false)} />}
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
