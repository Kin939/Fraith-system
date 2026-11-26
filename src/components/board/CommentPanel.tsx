import React, { useMemo, useState } from 'react';
import { Check, MapPin, MessageSquare, Send, Trash2, X } from 'lucide-react';
import type { BoardComment } from '../../lib/boardProtocol';
import type { BoardMember } from '../../lib/boards';
import { PeerAvatar } from '../common/PeerAvatar';

interface CommentPanelProps {
  comments: BoardComment[];
  members: BoardMember[];
  selfId: number | null;
  isDm: boolean;
  pendingAnchor: { x: number; y: number; shapeId: string | null } | null;
  onCancelAnchor: () => void;
  onSubmitAnchor: (text: string, mentions: number[]) => void;
  onReply: (commentId: string, text: string, mentions: number[]) => void;
  onResolve: (commentId: string, resolved: boolean) => void;
  onDelete: (commentId: string) => void;
  activeCommentId: string | null;
  onSelect: (commentId: string | null) => void;
}

/** Разбор @mentions по известным участникам кампании. */
export function parseMentions(text: string, members: BoardMember[]): { ids: number[]; names: string[] } {
  const ids = new Set<number>();
  const names: string[] = [];
  members.forEach((member) => {
    const candidates = [member.displayName, member.username].filter(Boolean);
    const mentioned = candidates.some((candidate) =>
      new RegExp(`@${candidate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text)
    );
    if (mentioned) {
      ids.add(member.id);
      names.push(member.displayName);
    }
  });
  return { ids: Array.from(ids), names };
}

const formatTime = (timestamp: number) =>
  new Date(timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

export const CommentPanel: React.FC<CommentPanelProps> = ({
  comments,
  members,
  selfId,
  isDm,
  pendingAnchor,
  onCancelAnchor,
  onSubmitAnchor,
  onReply,
  onResolve,
  onDelete,
  activeCommentId,
  onSelect,
}) => {
  const [draft, setDraft] = useState('');
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [showResolved, setShowResolved] = useState(false);

  const visible = useMemo(
    () => comments.filter((comment) => showResolved || !comment.resolved),
    [comments, showResolved]
  );
  const openCount = comments.filter((comment) => !comment.resolved).length;
  const memberById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);
  const memberAvatar = (userId: number) => memberById.get(userId)?.avatarUrl ?? null;
  const memberColor = (userId: number) => (memberById.get(userId)?.role === 'dm' ? '#f59e0b' : '#00e5ff');

  const submitAnchor = () => {
    const text = draft.trim();
    if (!text || !pendingAnchor) return;
    const mentions = parseMentions(text, members).ids;
    onSubmitAnchor(text, mentions);
    setDraft('');
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between px-3 h-9 border-b border-border shrink-0">
        <span className="text-[11px] font-mono uppercase tracking-wide text-secondary">
          Комментарии · {openCount}
        </span>
        <button
          type="button"
          onClick={() => setShowResolved((prev) => !prev)}
          className={`text-[10px] font-mono uppercase px-1.5 py-0.5 border transition-colors ${
            showResolved ? 'border-primary/50 text-primary' : 'border-border text-muted hover:text-text'
          }`}
        >
          решённые
        </button>
      </div>

      {pendingAnchor && (
        <div className="p-3 border-b border-border bg-raised/40 space-y-2 shrink-0">
          <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase text-primary">
            <MapPin className="w-3 h-3" strokeWidth={1.5} />
            <span>{pendingAnchor.shapeId ? 'к объекту' : 'к точке холста'}</span>
          </div>
          <textarea
            autoFocus
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Текст комментария, можно @Имя"
            rows={3}
            className="w-full bg-deep border border-border px-2 py-1.5 text-xs text-text outline-none focus:border-primary/60 resize-none"
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) submitAnchor();
            }}
          />
          <div className="flex items-center gap-2">
            <button type="button" onClick={submitAnchor} className="anime-btn-primary px-2.5 py-1 text-[11px] flex items-center gap-1">
              <Send className="w-3 h-3" strokeWidth={1.5} /> Добавить
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft('');
                onCancelAnchor();
              }}
              className="px-2.5 py-1 text-[11px] border border-border text-muted hover:text-text"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-border/60">
        {visible.length === 0 && (
          <div className="p-4 text-[11px] text-muted leading-relaxed">
            Пока нет комментариев. Нажмите «Комментарий» в шапке доски и кликните по объекту или точке холста.
          </div>
        )}

        {visible.map((comment) => {
          const isActive = activeCommentId === comment.id;
          const canDelete = isDm || comment.authorId === selfId;
          return (
            <div
              key={comment.id}
              className={`p-3 space-y-2 cursor-pointer transition-colors ${
                isActive ? 'bg-primary/5' : 'hover:bg-raised/40'
              } ${comment.resolved ? 'opacity-60' : ''}`}
              onClick={() => onSelect(isActive ? null : comment.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex items-start gap-2">
                  <PeerAvatar
                    name={comment.authorName}
                    color={memberColor(comment.authorId)}
                    avatarUrl={memberAvatar(comment.authorId)}
                    size={22}
                    crown={memberById.get(comment.authorId)?.role === 'dm'}
                  />
                  <div className="min-w-0">
                  <div className="text-[11px] text-text font-medium truncate">{comment.authorName}</div>
                  <div className="text-[10px] text-muted font-mono">
                    {formatTime(comment.createdAt)}
                    {comment.shapeId ? ' · объект' : ' · точка'}
                  </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onResolve(comment.id, !comment.resolved);
                    }}
                    className={`w-6 h-6 flex items-center justify-center border transition-colors ${
                      comment.resolved
                        ? 'border-positive/50 text-positive'
                        : 'border-border text-muted hover:text-text'
                    }`}
                    title={comment.resolved ? 'Вернуть в работу' : 'Отметить решённым'}
                  >
                    <Check className="w-3 h-3" strokeWidth={1.5} />
                  </button>
                  {canDelete && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDelete(comment.id);
                      }}
                      className="w-6 h-6 flex items-center justify-center border border-border text-muted hover:text-negative"
                      title="Удалить тред"
                    >
                      <Trash2 className="w-3 h-3" strokeWidth={1.5} />
                    </button>
                  )}
                </div>
              </div>

              <p className="text-xs text-secondary whitespace-pre-wrap break-words">{comment.text}</p>

              {(comment.mentions ?? []).length > 0 && (
                <div className="flex flex-wrap items-center gap-1">
                  {(comment.mentions ?? []).map((userId) => {
                    const member = memberById.get(userId);
                    return (
                      <span
                        key={userId}
                        className="flex items-center gap-1 pl-0.5 pr-1.5 h-5 border border-primary/40 bg-primary/10 text-[9px] font-mono text-primary"
                      >
                        <PeerAvatar
                          name={member?.displayName ?? `#${userId}`}
                          color={memberColor(userId)}
                          avatarUrl={memberAvatar(userId)}
                          size={14}
                        />
                        {member?.displayName ?? `#${userId}`}
                      </span>
                    );
                  })}
                </div>
              )}

              {comment.replies.length > 0 && (
                <div className="space-y-1.5 pl-2 border-l border-border/70">
                  {comment.replies.map((reply) => (
                    <div key={reply.id}>
                      <div className="text-[10px] text-muted font-mono flex items-center gap-1">
                        <PeerAvatar
                          name={reply.authorName}
                          color={memberColor(reply.authorId)}
                          avatarUrl={memberAvatar(reply.authorId)}
                          size={14}
                        />
                        {reply.authorName} · {formatTime(reply.createdAt)}
                      </div>
                      <div className="text-[11px] text-secondary whitespace-pre-wrap break-words">{reply.text}</div>
                    </div>
                  ))}
                </div>
              )}

              {isActive && (
                <div className="flex items-center gap-1 pt-1">
                  <input
                    value={replyDrafts[comment.id] ?? ''}
                    onChange={(event) =>
                      setReplyDrafts((prev) => ({ ...prev, [comment.id]: event.target.value }))
                    }
                    placeholder="Ответить… (@Имя)"
                    className="flex-1 h-7 bg-deep border border-border px-2 text-[11px] text-text outline-none focus:border-primary/60"
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter') return;
                      const value = (replyDrafts[comment.id] ?? '').trim();
                      if (!value) return;
                      onReply(comment.id, value, parseMentions(value, members).ids);
                      setReplyDrafts((prev) => ({ ...prev, [comment.id]: '' }));
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const value = (replyDrafts[comment.id] ?? '').trim();
                      if (!value) return;
                      onReply(comment.id, value, parseMentions(value, members).ids);
                      setReplyDrafts((prev) => ({ ...prev, [comment.id]: '' }));
                    }}
                    className="w-7 h-7 flex items-center justify-center border border-border text-muted hover:text-primary"
                    title="Отправить"
                  >
                    <Send className="w-3 h-3" strokeWidth={1.5} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="px-3 py-2 border-t border-border text-[10px] text-muted flex items-center gap-1.5 shrink-0">
        <MessageSquare className="w-3 h-3" strokeWidth={1.5} />
        <span>Треды закреплены за объектом или точкой холста</span>
        {activeCommentId && (
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="ml-auto text-muted hover:text-text"
            title="Снять выбор"
          >
            <X className="w-3 h-3" strokeWidth={1.5} />
          </button>
        )}
      </div>
    </div>
  );
};
