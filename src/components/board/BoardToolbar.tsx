import React, { useState } from 'react';
import {
  FileImage,
  FileText,
  LayoutTemplate,
  Maximize,
  MessageSquare,
  Minimize2,
  Network,
  PanelLeft,
  Plus,
  Scan,
  Settings2,
  ThumbsUp,
  Trash2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useValue, type Editor } from 'tldraw';
import type { BoardPermission, BoardSummary } from '../../lib/boards';
import { SessionTimer } from './SessionTimer';
import { BoardPresenceBar } from './BoardPresence';
import type { BoardSocketApi } from '../../hooks/useBoardSocket';
import { exportBoardPdf, exportBoardPng } from '../../lib/boardExport';

export type BoardSidePanelId = 'comments' | 'templates' | 'votes' | null;

interface BoardToolbarProps {
  board: BoardSummary | null;
  permission: BoardPermission | null;
  editor: Editor | null;
  socket: BoardSocketApi;
  tool: 'comment' | 'vote' | null;
  panel: BoardSidePanelId;
  listOpen: boolean;
  onToolChange: (tool: 'comment' | 'vote' | null) => void;
  onPanelChange: (panel: BoardSidePanelId) => void;
  onToggleList: () => void;
  onAddMindMapNode: () => void;
  onSaveTemplate: () => void;
  onToast: (title: string, message: string, variant?: 'info' | 'error' | 'success' | 'warning') => void;
  compact: boolean;
  onToggleCompact: () => void;
  /** Удалять страницы может только Мастер или автор доски (игроки — нет) */
  canDeletePage: boolean;
}

const iconButton =
  'w-8 h-8 flex items-center justify-center border border-border text-muted hover:text-text hover:border-primary/50 transition-colors disabled:opacity-35 disabled:cursor-not-allowed';
const activeButton = 'text-primary border-primary/60 bg-primary/10';

export const BoardToolbar: React.FC<BoardToolbarProps> = ({
  board,
  permission,
  editor,
  socket,
  tool,
  panel,
  listOpen,
  onToolChange,
  onPanelChange,
  onToggleList,
  onAddMindMapNode,
  onSaveTemplate,
  onToast,
  compact,
  onToggleCompact,
  canDeletePage,
}) => {
  const [exporting, setExporting] = useState(false);
  const canWrite = permission === 'write';

  const selectionCount = useValue(
    'board-toolbar-selection',
    () => (editor ? editor.getSelectedShapeIds().length : 0),
    [editor]
  );
  const pageCount = useValue('board-toolbar-pages', () => (editor ? editor.getPages().length : 0), [editor]);

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

  const addPage = () => {
    if (!editor) return;
    editor.createPage({ name: `Страница ${editor.getPages().length + 1}` });
  };

  const deletePage = () => {
    if (!editor) return;
    if (!canDeletePage) {
      onToast('Удалять страницы может Мастер', 'Игроки могут только добавлять страницы', 'warning');
      return;
    }
    const pages = editor.getPages();
    if (pages.length <= 1) {
      onToast('Нельзя удалить последнюю страницу', 'Оставьте хотя бы одну страницу доски', 'warning');
      return;
    }
    const current = pages.find((page) => page.id === editor.getCurrentPageId());
    if (!current) return;
    if (!window.confirm(`Удалить страницу «${current.name || 'Страница'}»?`)) return;
    editor.deletePage(current.id);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        type="button"
        onClick={onToggleList}
        className={`${iconButton} ${listOpen ? activeButton : ''}`}
        title={listOpen ? 'Свернуть список досок' : 'Показать список досок'}
      >
        <PanelLeft className="w-4 h-4" strokeWidth={1.5} />
      </button>

      <div className="min-w-0 mr-1">
        <div className="text-sm text-text font-medium truncate max-w-[220px]">{board?.name ?? 'Доска'}</div>
        <div className="text-[10px] font-mono uppercase tracking-wide text-muted">
          {permission === 'write' ? 'совместное редактирование' : permission ? 'только чтение' : 'нет доступа'}
          {editor ? ` · стр. ${pageCount}` : ''}
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
          className={`${iconButton} ${tool === 'comment' ? activeButton : ''}`}
          onClick={() => onToolChange(tool === 'comment' ? null : 'comment')}
          disabled={!editor}
          title="Оставить комментарий"
        >
          <MessageSquare className="w-4 h-4" strokeWidth={1.5} />
        </button>
        <button
          type="button"
          className={`${iconButton} ${tool === 'vote' ? 'text-warning border-warning/60 bg-warning/10' : ''}`}
          onClick={() => onToolChange(tool === 'vote' ? null : 'vote')}
          disabled={!editor || !canWrite}
          title="Голосование по объекту"
        >
          <ThumbsUp className="w-4 h-4" strokeWidth={1.5} />
        </button>

        <span className="w-px h-5 bg-border mx-1" />

        <button type="button" className={iconButton} disabled={!editor} onClick={() => editor?.zoomOut()} title="Уменьшить (−)">
          <ZoomOut className="w-4 h-4" strokeWidth={1.5} />
        </button>
        <button type="button" className={iconButton} disabled={!editor} onClick={() => editor?.zoomIn()} title="Увеличить (+)">
          <ZoomIn className="w-4 h-4" strokeWidth={1.5} />
        </button>
        <button
          type="button"
          className={iconButton}
          disabled={!editor}
          onClick={() => editor?.zoomToFit({ animation: { duration: 220 } })}
          title="Вписать всё в экран (F)"
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
          onClick={addPage}
          title="Добавить страницу"
        >
          <Plus className="w-4 h-4" strokeWidth={1.5} />
        </button>
        <button
          type="button"
          className={iconButton}
          disabled={!editor || !canDeletePage || pageCount <= 1}
          onClick={deletePage}
          title="Удалить текущую страницу"
        >
          <Trash2 className="w-4 h-4" strokeWidth={1.5} />
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
          className={`${iconButton} ${panel === 'templates' ? activeButton : ''}`}
          onClick={() => onPanelChange(panel === 'templates' ? null : 'templates')}
          title="Шаблоны"
        >
          <LayoutTemplate className="w-4 h-4" strokeWidth={1.5} />
        </button>
        <button
          type="button"
          className={`${iconButton} ${panel === 'comments' ? activeButton : ''}`}
          onClick={() => onPanelChange(panel === 'comments' ? null : 'comments')}
          title="Комментарии"
        >
          <MessageSquare className="w-4 h-4" strokeWidth={1.5} />
        </button>
        <button
          type="button"
          className={`${iconButton} ${panel === 'votes' ? 'text-warning border-warning/60 bg-warning/10' : ''}`}
          onClick={() => onPanelChange(panel === 'votes' ? null : 'votes')}
          title="Голоса"
        >
          <ThumbsUp className="w-4 h-4" strokeWidth={1.5} />
        </button>
        <button
          type="button"
          className={iconButton}
          disabled={!editor || !canWrite}
          onClick={onSaveTemplate}
          title="Сохранить выделение как шаблон"
        >
          <Settings2 className="w-4 h-4" strokeWidth={1.5} />
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
          title={compact ? 'Показать панели' : 'Скрыть боковые панели'}
        >
          <Minimize2 className="w-4 h-4" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
};
