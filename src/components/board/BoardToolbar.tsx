import React, { useState } from 'react';
import {
  Download,
  FileImage,
  FileText,
  Maximize,
  MessageSquare,
  Minimize2,
  Network,
  Plus,
  Scan,
  ThumbsUp,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useValue, type Editor } from 'tldraw';
import type { BoardPermission, BoardSummary } from '../../lib/boards';
import { SessionTimer } from './SessionTimer';
import { BoardPresenceBar } from './BoardPresence';
import type { BoardSocketApi } from '../../hooks/useBoardSocket';
import { exportBoardPdf, exportBoardPng } from '../../lib/boardExport';

interface BoardToolbarProps {
  board: BoardSummary | null;
  permission: BoardPermission | null;
  editor: Editor | null;
  socket: BoardSocketApi;
  tool: 'comment' | 'vote' | null;
  onToolChange: (tool: 'comment' | 'vote' | null) => void;
  onAddMindMapNode: () => void;
  onSaveTemplate: () => void;
  onToast: (title: string, message: string, variant?: 'info' | 'error' | 'success' | 'warning') => void;
  compact: boolean;
  onToggleCompact: () => void;
}

const iconButton =
  'w-8 h-8 flex items-center justify-center border border-border text-muted hover:text-text hover:border-primary/50 transition-colors disabled:opacity-35 disabled:cursor-not-allowed';

export const BoardToolbar: React.FC<BoardToolbarProps> = ({
  board,
  permission,
  editor,
  socket,
  tool,
  onToolChange,
  onAddMindMapNode,
  onSaveTemplate,
  onToast,
  compact,
  onToggleCompact,
}) => {
  const [exporting, setExporting] = useState(false);
  const canWrite = permission === 'write';
  const selectionCount = useValue(
    'board-toolbar-selection',
    () => (editor ? editor.getSelectedShapeIds().length : 0),
    [editor]
  );

  const runExport = async (kind: 'png' | 'pdf') => {
    if (!editor || !board) return;
    setExporting(true);
    try {
      if (kind === 'png') await exportBoardPng(editor, board.name);
      else await exportBoardPdf(editor, board.name);
      onToast(
        kind === 'png' ? 'PNG сохранён' : 'Открыто окно печати',
        kind === 'png'
          ? 'Файл доски скачан на устройство'
          : 'Выберите «Сохранить как PDF» в диалоге печати',
        'success'
      );
    } catch (err) {
      onToast('Экспорт не удался', err instanceof Error ? err.message : 'Попробуйте снова', 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="min-w-0 mr-1">
        <div className="text-sm text-text font-medium truncate max-w-[220px]">{board?.name ?? 'Доска'}</div>
        <div className="text-[10px] font-mono uppercase tracking-wide text-muted">
          {permission === 'write' ? 'совместное редактирование' : permission ? 'только чтение' : 'нет доступа'}
        </div>
      </div>

      <BoardPresenceBar peers={socket.peers} status={socket.status} selfId={socket.selfId} />

      <SessionTimer
        timer={socket.timer}
        canControl={canWrite}
        onAction={(action, durationMs) => socket.timerAction(action, durationMs)}
      />

      <div className="flex items-center gap-1 ml-auto">
        <button
          type="button"
          className={`${iconButton} ${tool === 'comment' ? 'text-primary border-primary/60' : ''}`}
          onClick={() => onToolChange(tool === 'comment' ? null : 'comment')}
          disabled={!editor}
          title="Оставить комментарий"
        >
          <MessageSquare className="w-4 h-4" strokeWidth={1.5} />
        </button>
        <button
          type="button"
          className={`${iconButton} ${tool === 'vote' ? 'text-warning border-warning/60' : ''}`}
          onClick={() => onToolChange(tool === 'vote' ? null : 'vote')}
          disabled={!editor || !canWrite}
          title="Голосование по объекту"
        >
          <ThumbsUp className="w-4 h-4" strokeWidth={1.5} />
        </button>

        <span className="w-px h-5 bg-border mx-1" />

        <button type="button" className={iconButton} disabled={!editor} onClick={() => editor?.zoomOut()} title="Уменьшить">
          <ZoomOut className="w-4 h-4" strokeWidth={1.5} />
        </button>
        <button type="button" className={iconButton} disabled={!editor} onClick={() => editor?.zoomIn()} title="Увеличить">
          <ZoomIn className="w-4 h-4" strokeWidth={1.5} />
        </button>
        <button
          type="button"
          className={iconButton}
          disabled={!editor}
          onClick={() => editor?.zoomToFit({ animation: { duration: 220 } })}
          title="Вписать всё в экран"
        >
          <Maximize className="w-4 h-4" strokeWidth={1.5} />
        </button>
        <button
          type="button"
          className={iconButton}
          disabled={!editor || selectionCount === 0}
          onClick={() => editor?.zoomToSelection({ animation: { duration: 220 } })}
          title="Приблизить к выделению"
        >
          <Scan className="w-4 h-4" strokeWidth={1.5} />
        </button>

        <span className="w-px h-5 bg-border mx-1" />

        <button
          type="button"
          className={iconButton}
          disabled={!editor || !canWrite}
          onClick={onAddMindMapNode}
          title="Добавить узел интеллект-карты к выделенному"
        >
          <Network className="w-4 h-4" strokeWidth={1.5} />
        </button>
        <button
          type="button"
          className={iconButton}
          disabled={!editor || !canWrite}
          onClick={onSaveTemplate}
          title="Сохранить выделение как шаблон"
        >
          <Plus className="w-4 h-4" strokeWidth={1.5} />
        </button>

        <span className="w-px h-5 bg-border mx-1" />

        <button
          type="button"
          className={iconButton}
          disabled={!editor || exporting}
          onClick={() => void runExport('png')}
          title="Скачать PNG"
        >
          <FileImage className="w-4 h-4" strokeWidth={1.5} />
        </button>
        <button
          type="button"
          className={iconButton}
          disabled={!editor || exporting}
          onClick={() => void runExport('pdf')}
          title="Скачать PDF (через печать)"
        >
          <FileText className="w-4 h-4" strokeWidth={1.5} />
        </button>
        <button
          type="button"
          className={iconButton}
          onClick={onToggleCompact}
          title={compact ? 'Развернуть холст' : 'Свернуть боковые панели'}
        >
          {compact ? (
            <Download className="w-4 h-4 rotate-180" strokeWidth={1.5} />
          ) : (
            <Minimize2 className="w-4 h-4" strokeWidth={1.5} />
          )}
        </button>
      </div>
    </div>
  );
};
