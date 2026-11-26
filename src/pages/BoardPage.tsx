import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { MessageSquare, LayoutTemplate, ThumbsUp } from 'lucide-react';
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
  type BoardMember,
  type BoardPermission,
  type BoardSummary,
  type BoardTemplateRecord,
} from '../lib/boards';
import { useBoardSocket } from '../hooks/useBoardSocket';
import { BoardCanvas } from '../components/board/BoardCanvas';
import { BoardList } from '../components/board/BoardList';
import { BoardToolbar } from '../components/board/BoardToolbar';
import { CommentPanel } from '../components/board/CommentPanel';
import { TemplatePanel } from '../components/board/TemplatePanel';
import { VotePanel } from '../components/board/VotePanel';
import { addMindMapChild, type BuiltinTemplate } from '../components/board/boardTemplates';

type SidePanel = 'comments' | 'templates' | 'votes';
type BoardTool = 'comment' | 'vote' | null;

/**
 * Вкладка «Доска» — клон Miro/SBoard без встроенного ИИ.
 *
 * Холст: tldraw SDK (infinite canvas, стикеры, фигуры, текст, перо/маркер,
 * фреймы, картинки, коннекторы). Совместная работа: BoardRoom Durable Object
 * на каждую доску (см. workers/board-do.ts).
 */
export const BoardPage: React.FC = () => {
  const user = useCampaignStore((s) => s.user);
  const pushToast = useCampaignStore((s) => s.pushToast);

  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [members, setMembers] = useState<BoardMember[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [tool, setTool] = useState<BoardTool>(null);
  const [panel, setPanel] = useState<SidePanel>('comments');
  const [compact, setCompact] = useState(false);
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
      setCanManage(data.canManage);
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
      await loadBoards();
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
    socket.addComment({ text, shapeId: pendingAnchor.shapeId, x: pendingAnchor.x, y: pendingAnchor.y });
    void mentions;
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

  return (
    <div className="-m-4 sm:-m-6 lg:-m-8 flex flex-col h-[calc(100dvh-7.5rem)] lg:h-[calc(100dvh-0rem)] bg-bg overflow-hidden">
      <div className="px-4 py-2 border-b border-border bg-deep shrink-0">
        <BoardToolbar
          board={activeBoard}
          permission={permission}
          editor={editor}
          socket={socket}
          tool={tool}
          onToolChange={setTool}
          onAddMindMapNode={() => {
            if (!editor) return;
            const created = addMindMapChild(editor);
            if (!created) notify('Нужен узел', 'Выделите фигуру, к которой добавить ветвь', 'warning');
          }}
          onSaveTemplate={() => {
            setPanel('templates');
            setCompact(false);
          }}
          onToast={notify}
          compact={compact}
          onToggleCompact={() => setCompact((prev) => !prev)}
        />
      </div>

      <div className="flex flex-1 min-h-0">
        {!compact && (
          <div className="hidden md:flex">
            <BoardList
              boards={boards}
              members={members}
              activeId={activeId}
              canManage={canManage}
              onSelect={setActiveId}
              onCreate={(name) => void handleCreateBoard(name)}
              onRename={(boardId, name) => void handleRenameBoard(boardId, name)}
              onDelete={(boardId) => void handleDeleteBoard(boardId)}
              onBackground={(boardId, background) => void handleBackground(boardId, background)}
              onAccess={(boardId, userId, next) => void handleAccess(boardId, userId, next)}
            />
          </div>
        )}

        <div className="flex-1 min-w-0 flex flex-col">
          {activeBoard ? (
            <BoardCanvas
              key={activeBoard.id}
              boardId={activeBoard.id}
              permission={activeBoard.permission ?? 'read'}
              background={activeBoard.background}
              gridSize={activeBoard.gridSize}
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
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="glass-panel hud-cut p-6 text-center space-y-2 max-w-sm">
                <div className="text-sm text-text">
                  {loading ? 'Загрузка досок…' : 'Нет доступных досок'}
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  {canManage
                    ? 'Создайте доску кнопкой «+» в списке слева и выдайте доступ игрокам.'
                    : 'Мастер ещё не открыл вам ни одну доску.'}
                </p>
              </div>
            </div>
          )}
        </div>

        {!compact && (
          <aside className="hidden lg:flex w-72 shrink-0 border-l border-border bg-deep flex-col min-h-0">
            <div className="flex items-center border-b border-border shrink-0">
              {(
                [
                  { id: 'comments' as SidePanel, label: 'Комментарии', icon: MessageSquare, count: socket.comments.filter((c) => !c.resolved).length },
                  { id: 'templates' as SidePanel, label: 'Шаблоны', icon: LayoutTemplate, count: templates.length },
                  { id: 'votes' as SidePanel, label: 'Голоса', icon: ThumbsUp, count: Object.keys(socket.votes).length },
                ]
              ).map((tab) => {
                const Icon = tab.icon;
                const active = panel === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setPanel(tab.id)}
                    className={`flex-1 h-9 flex items-center justify-center gap-1 text-[10px] font-mono uppercase tracking-wide border-b-2 transition-colors ${
                      active
                        ? 'border-b-primary text-text bg-raised/50'
                        : 'border-b-transparent text-muted hover:text-text'
                    }`}
                    title={tab.label}
                  >
                    <Icon className="w-3 h-3" strokeWidth={1.5} />
                    {tab.count > 0 && <span className="tabular-nums">{tab.count}</span>}
                  </button>
                );
              })}
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
                  canManage={canManage}
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
