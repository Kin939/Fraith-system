import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, LayoutTemplate, MessageSquare, ThumbsUp, X } from 'lucide-react';
import { useValue, type Editor } from 'tldraw';
import { useCampaignStore } from '../lib/store';
import {
  createBoard as createBoardApi,
  deleteBoard as deleteBoardApi,
  deleteBoardTemplate,
  fetchBoardTemplates,
  listBoards,
  saveBoardTemplate,
  updateBoard as updateBoardApi,
  type BoardBackground,
  type BoardFontPreset,
  type BoardMember,
  type BoardPermission,
  type BoardSummary,
  type BoardTemplateRecord,
} from '../lib/boards';
import { useBoardSocket } from '../hooks/useBoardSocket';
import { BoardCanvas } from '../components/board/BoardCanvas';
import { BoardList } from '../components/board/BoardList';
import { BoardToolbar, type BoardSidePanelId } from '../components/board/BoardToolbar';
import { CommentPanel } from '../components/board/CommentPanel';
import { TemplatePanel } from '../components/board/TemplatePanel';
import { VotePanel } from '../components/board/VotePanel';
import { addMindMapChild, type BuiltinTemplate } from '../components/board/boardTemplates';

type BoardTool = 'comment' | 'vote' | null;

/**
 * Вкладка «Доска» — клон Miro/SBoard без встроенного ИИ.
 *
 * Холст занимает всю площадь вкладки (кроме левой навигации приложения):
 * список досок и правая панель — плавающие, со скрытием/выездом.
 */
export const BoardPage: React.FC = () => {
  const user = useCampaignStore((s) => s.user);
  const pushToast = useCampaignStore((s) => s.pushToast);

  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [members, setMembers] = useState<BoardMember[]>([]);
  const [isDm, setIsDm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [tool, setTool] = useState<BoardTool>(null);
  const [panel, setPanel] = useState<BoardSidePanelId>(null);
  const [compact, setCompact] = useState(false);
  const [listOpen, setListOpen] = useState(true);
  const [edgeHover, setEdgeHover] = useState(false);
  const [templates, setTemplates] = useState<BoardTemplateRecord[]>([]);
  const [pendingAnchor, setPendingAnchor] = useState<{ x: number; y: number; shapeId: string | null } | null>(null);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);

  const activeBoard = useMemo(
    () => boards.find((board) => board.id === activeId) ?? null,
    [boards, activeId]
  );
  const permission = activeBoard?.permission ?? null;
  const socket = useBoardSocket({ boardId: activeId, enabled: Boolean(activeBoard) });

  const notify = useCallback(
    (title: string, message: string, variant: 'info' | 'error' | 'success' | 'warning' = 'info') => {
      pushToast({ title, message, variant });
    },
    [pushToast]
  );

  const loadBoards = useCallback(async () => {
    try {
      const data = await listBoards();
      setBoards(data.boards);
      setMembers(data.members);
      setIsDm(Boolean((data as { isDm?: boolean }).isDm));
      setActiveId((prev) => {
        if (prev && data.boards.some((board) => board.id === prev)) return prev;
        return data.boards[0]?.id ?? null;
      });
    } catch (err) {
      notify('Не удалось загрузить доски', err instanceof Error ? err.message : 'Попробуйте снова', 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    void loadBoards();
  }, [loadBoards]);

  const loadTemplates = useCallback(async (boardId: string) => {
    try {
      const data = await fetchBoardTemplates(boardId);
      setTemplates(data.templates);
    } catch {
      setTemplates([]);
    }
  }, []);

  useEffect(() => {
    if (!activeId) {
      setTemplates([]);
      return;
    }
    void loadTemplates(activeId);
  }, [activeId, loadTemplates]);

  // Переключение доски сбрасывает редактор (новый tldraw store + новый DO-канал).
  useEffect(() => {
    setEditor(null);
    setPendingAnchor(null);
    setActiveCommentId(null);
    setTool(null);
  }, [activeId]);

  /* ------------------------------------------------------------------ доски */

  const handleCreateBoard = async (name: string) => {
    try {
      const data = await createBoardApi({ name });
      await loadBoards();
      setActiveId(data.board.id);
      notify('Доска создана', name, 'success');
    } catch (err) {
      notify('Не удалось создать доску', err instanceof Error ? err.message : 'Попробуйте снова', 'error');
    }
  };

  const handleRenameBoard = async (boardId: string, name: string) => {
    try {
      await updateBoardApi(boardId, { name });
      setBoards((prev) => prev.map((board) => (board.id === boardId ? { ...board, name } : board)));
    } catch (err) {
      notify('Не удалось переименовать', err instanceof Error ? err.message : 'Попробуйте снова', 'error');
    }
  };

  const handleDeleteBoard = async (boardId: string) => {
    try {
      await deleteBoardApi(boardId);
      if (activeId === boardId) setActiveId(null);
      await loadBoards();
      notify('Доска удалена', 'Содержимое холста стёрто', 'info');
    } catch (err) {
      notify('Не удалось удалить доску', err instanceof Error ? err.message : 'Попробуйте снова', 'error');
    }
  };

  const handleBackground = async (boardId: string, background: BoardBackground) => {
    try {
      await updateBoardApi(boardId, { background });
      setBoards((prev) => prev.map((board) => (board.id === boardId ? { ...board, background } : board)));
    } catch (err) {
      notify('Не удалось сменить фон', err instanceof Error ? err.message : 'Попробуйте снова', 'error');
    }
  };

  const handleFontPreset = async (boardId: string, fontPreset: BoardFontPreset) => {
    // Применяем сразу локально (мгновенная смена типографики), затем сохраняем на сервере.
    setBoards((prev) => prev.map((board) => (board.id === boardId ? { ...board, fontPreset } : board)));
    try {
      await updateBoardApi(boardId, { fontPreset });
    } catch (err) {
      notify('Не удалось сменить шрифт', err instanceof Error ? err.message : 'Попробуйте снова', 'error');
    }
  };

  const handleBgColor = async (boardId: string, bgColor: string) => {
    setBoards((prev) => prev.map((board) => (board.id === boardId ? { ...board, bgColor } : board)));
    try {
      await updateBoardApi(boardId, { bgColor });
    } catch (err) {
      notify('Не удалось сменить цвет', err instanceof Error ? err.message : 'Попробуйте снова', 'error');
    }
  };

  const handleAccess = async (boardId: string, userId: number, nextPermission: BoardPermission | null) => {
    try {
      const data = await updateBoardApi(boardId, { access: [{ userId, permission: nextPermission }] });
      setBoards((prev) =>
        prev.map((board) =>
          board.id === boardId
            ? {
                ...board,
                access: data.access.map((entry) => ({ userId: entry.userId, permission: entry.permission })),
              }
            : board
        )
      );
      notify(
        'Права обновлены',
        nextPermission === null ? 'Доступ игрока закрыт' : nextPermission === 'read' ? 'Только чтение' : 'Полный доступ',
        'success'
      );
    } catch (err) {
      notify('Не удалось изменить права', err instanceof Error ? err.message : 'Попробуйте снова', 'error');
    }
  };

  /* --------------------------------------------------------------- шаблоны */

  const handleApplyBuiltin = (template: BuiltinTemplate) => {
    if (!editor) return;
    const viewport = editor.getViewportPageBounds();
    const origin = { x: viewport.center.x - 260, y: viewport.center.y - 180 };
    try {
      template.build(editor, origin);
      editor.selectNone();
      notify('Шаблон вставлен', template.name, 'success');
    } catch (err) {
      notify('Не удалось вставить шаблон', err instanceof Error ? err.message : 'Попробуйте снова', 'error');
    }
  };

  const handleApplyCustom = (template: BoardTemplateRecord) => {
    if (!editor) return;
    try {
      const content = JSON.parse(template.content) as Parameters<Editor['putContentOntoCurrentPage']>[0];
      const viewport = editor.getViewportPageBounds();
      editor.putContentOntoCurrentPage(content, {
        point: { x: viewport.center.x, y: viewport.center.y },
        select: true,
      });
      notify('Шаблон вставлен', template.name, 'success');
    } catch (err) {
      notify('Не удалось вставить шаблон', err instanceof Error ? err.message : 'Повреждённый шаблон', 'error');
    }
  };

  const handleSaveSelectionAsTemplate = async (name: string, scope: 'board' | 'global') => {
    if (!editor || !activeId) return;
    const selected = editor.getSelectedShapeIds();
    if (selected.length === 0) {
      notify('Нет выделения', 'Выделите объекты на холсте', 'warning');
      return;
    }
    const content = editor.getContentFromCurrentPage(selected);
    if (!content) return;
    try {
      await saveBoardTemplate(activeId, { name, content: JSON.stringify(content), scope });
      await loadTemplates(activeId);
      notify('Шаблон сохранён', name, 'success');
    } catch (err) {
      notify('Не удалось сохранить шаблон', err instanceof Error ? err.message : 'Попробуйте снова', 'error');
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!activeId) return;
    try {
      await deleteBoardTemplate(activeId, templateId);
      await loadTemplates(activeId);
    } catch (err) {
      notify('Не удалось удалить шаблон', err instanceof Error ? err.message : 'Попробуйте снова', 'error');
    }
  };

  /* ------------------------------------------------------------ комментарии */

  const handleCanvasPick = ({ point, shapeId }: { point: { x: number; y: number }; shapeId: string | null }) => {
    if (tool === 'vote') {
      if (shapeId) {
        socket.vote(shapeId, 1);
        notify('Голос добавлен', 'Точка засчитана объекту', 'success');
      } else {
        notify('Объект не найден', 'Кликните по фигуре или стикеру', 'warning');
      }
      setTool(null);
      return;
    }

    setPendingAnchor({ x: point.x, y: point.y, shapeId });
    setPanel('comments');
    setTool(null);
  };

  const handleSubmitAnchor = (text: string, mentions: number[]) => {
    if (!pendingAnchor) return;
    socket.addComment({
      text,
      shapeId: pendingAnchor.shapeId,
      x: pendingAnchor.x,
      y: pendingAnchor.y,
      mentions,
    });
    setPendingAnchor(null);
  };

  const selection = useValue(
    'board-page-selection',
    () => {
      if (!editor) return { count: 0, firstId: null as string | null };
      const ids = editor.getSelectedShapeIds();
      return { count: ids.length, firstId: ids.length > 0 ? String(ids[0]) : null };
    },
    [editor]
  );

  if (!user) return null;

  const handleVisible = listOpen || edgeHover;

  return (
    <div className="h-[calc(100dvh-6.1rem)] lg:h-screen w-full flex flex-col bg-bg overflow-hidden">
      <div className="px-3 py-2 border-b border-border bg-deep shrink-0">
        <BoardToolbar
          board={activeBoard}
          permission={permission}
          editor={editor}
          socket={socket}
          tool={tool}
          panel={panel}
          listOpen={listOpen}
          onToolChange={setTool}
          onPanelChange={(next) => setPanel(next)}
          onToggleList={() => setListOpen((prev) => !prev)}
          onAddMindMapNode={() => {
            if (!editor) return;
            const created = addMindMapChild(editor);
            if (!created) notify('Нужен узел', 'Выделите фигуру, к которой добавить ветвь', 'warning');
          }}
          onSaveTemplate={() => setPanel('templates')}
          onToast={notify}
          compact={compact}
          onToggleCompact={() => setCompact((prev) => !prev)}
          canDeletePage={isDm || Boolean(activeBoard?.canEdit)}
        />
      </div>

      <div className="relative flex-1 min-h-0">
        {activeBoard ? (
          <BoardCanvas
            key={activeBoard.id}
            boardId={activeBoard.id}
            permission={activeBoard.permission ?? 'read'}
            background={activeBoard.background}
            bgColor={activeBoard.bgColor ?? ''}
            gridSize={activeBoard.gridSize}
            fontPreset={activeBoard.fontPreset ?? 'classic'}
            socket={socket}
            user={user}
            tool={tool}
            onCanvasPick={handleCanvasPick}
            onEditorReady={setEditor}
            activeCommentId={activeCommentId}
            onSelectComment={(commentId) => {
              setActiveCommentId(commentId);
              setPanel('comments');
            }}
          />
        ) : (
          <div className="h-full flex items-center justify-center p-6">
            <div className="glass-panel hud-cut p-6 text-center space-y-2 max-w-sm">
              <div className="text-sm text-text">
                {loading ? 'Загрузка досок…' : 'Нет доступных досок'}
              </div>
              <p className="text-xs text-muted leading-relaxed">
                Создайте доску кнопкой «+» в списке слева — её увидят все участники кампании.
              </p>
            </div>
          </div>
        )}

        {/* ---------- выезжающий список досок ---------- */}
        <div
          className={`absolute inset-y-0 left-0 z-30 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            listOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <BoardList
            boards={boards}
            members={members}
            activeId={activeId}
            isDm={isDm}
            onSelect={(boardId) => {
              setActiveId(boardId);
              setListOpen(false);
            }}
            onCreate={(name) => void handleCreateBoard(name)}
            onRename={(boardId, name) => void handleRenameBoard(boardId, name)}
            onDelete={(boardId) => void handleDeleteBoard(boardId)}
            onBackground={(boardId, background) => void handleBackground(boardId, background)}
            onFontPreset={(boardId, preset) => void handleFontPreset(boardId, preset)}
            onBgColor={(boardId, color) => void handleBgColor(boardId, color)}
            onAccess={(boardId, userId, next) => void handleAccess(boardId, userId, next)}
          />
        </div>

        {/* ---------- зона наведения у левого края (когда панель скрыта) ---------- */}
        {!listOpen && (
          <div
            className="absolute inset-y-0 left-0 w-4 z-20"
            onPointerEnter={() => setEdgeHover(true)}
            onPointerLeave={() => setEdgeHover(false)}
          />
        )}

        {/* ---------- «язычок» сворачивания ---------- */}
        <button
          type="button"
          onClick={() => {
            setListOpen((prev) => !prev);
            setEdgeHover(false);
          }}
          onPointerEnter={() => setEdgeHover(true)}
          className={`absolute top-1/2 -translate-y-1/2 z-40 h-16 w-5 flex items-center justify-center border border-border bg-deep/95 text-muted hover:text-primary hover:border-primary/60 transition-all duration-300 ${
            handleVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          style={{ left: listOpen ? '16rem' : '0.25rem' }}
          title={listOpen ? 'Свернуть панель досок' : 'Показать доски'}
        >
          {listOpen ? (
            <ChevronLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.5} />
          )}
        </button>

        {/* ---------- правая панель (плавающая) ---------- */}
        {panel && !compact && (
          <aside className="absolute inset-y-0 right-0 z-30 w-72 border-l border-border bg-deep/97 backdrop-blur-sm flex flex-col min-h-0 shadow-glass">
            <div className="flex items-center justify-between px-2 h-9 border-b border-border shrink-0">
              <div className="flex items-center gap-1">
                {(
                  [
                    { id: 'comments' as const, label: 'Комм.', icon: MessageSquare },
                    { id: 'templates' as const, label: 'Шаблоны', icon: LayoutTemplate },
                    { id: 'votes' as const, label: 'Голоса', icon: ThumbsUp },
                  ]
                ).map((tab) => {
                  const Icon = tab.icon;
                  const active = panel === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setPanel(tab.id)}
                      className={`h-7 px-2 flex items-center gap-1 text-[10px] font-mono uppercase tracking-wide border transition-colors ${
                        active
                          ? 'border-primary/60 text-primary bg-primary/10'
                          : 'border-border text-muted hover:text-text'
                      }`}
                    >
                      <Icon className="w-3 h-3" strokeWidth={1.5} />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => setPanel(null)}
                className="w-6 h-6 flex items-center justify-center text-muted hover:text-text"
                title="Скрыть панель"
              >
                <X className="w-3.5 h-3.5" strokeWidth={1.5} />
              </button>
            </div>

            <div className="flex-1 min-h-0">
              {panel === 'comments' && (
                <CommentPanel
                  comments={socket.comments}
                  members={members}
                  selfId={socket.selfId}
                  isDm={user.role === 'dm'}
                  pendingAnchor={pendingAnchor}
                  onCancelAnchor={() => setPendingAnchor(null)}
                  onSubmitAnchor={handleSubmitAnchor}
                  onReply={(commentId, text, mentions) => socket.replyComment(commentId, text, mentions)}
                  onResolve={(commentId, resolved) => socket.resolveComment(commentId, resolved)}
                  onDelete={(commentId) => socket.removeComment(commentId)}
                  activeCommentId={activeCommentId}
                  onSelect={setActiveCommentId}
                />
              )}
              {panel === 'templates' && (
                <TemplatePanel
                  templates={templates}
                  canManage={isDm}
                  canWrite={permission === 'write'}
                  hasSelection={selection.count > 0}
                  onApplyBuiltin={handleApplyBuiltin}
                  onApplyCustom={handleApplyCustom}
                  onSaveSelection={handleSaveSelectionAsTemplate}
                  onDelete={(templateId) => void handleDeleteTemplate(templateId)}
                />
              )}
              {panel === 'votes' && (
                <VotePanel
                  votes={socket.votes}
                  members={members}
                  selfId={socket.selfId}
                  isDm={user.role === 'dm'}
                  canWrite={permission === 'write'}
                  selectedShapeId={selection.firstId}
                  onVote={(shapeId, delta) => socket.vote(shapeId, delta)}
                  onClear={() => socket.clearVotes()}
                  onPickObject={() => setTool('vote')}
                />
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};

export default BoardPage;
