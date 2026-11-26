import React, { useEffect, useState } from 'react';
import { Check, Pencil, Send, Trash2, X } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { useCampaignStore } from '../../lib/store';
import type { EntityNote, NoteEntityKind } from '../../lib/types';
import { PlayerAvatar } from './PlayerAvatar';

interface EntityNotesProps {
  kind: NoteEntityKind;
  entityId: number;
  /** Hide the section header when the host card already renders one */
  hideHeader?: boolean;
  className?: string;
}

const NOTE_MAX_LENGTH = 2000;

const COLLECTION: Record<NoteEntityKind, string> = {
  quest: 'quests',
  npc: 'npcs',
  creature: 'bestiary',
};

const ENTITY_LABEL: Record<NoteEntityKind, string> = {
  quest: 'квесту',
  npc: 'этому НПС',
  creature: 'этому существу',
};

function parseSqliteUtcDate(raw: string): Date {
  if (!raw) return new Date();
  if (raw.includes('T')) {
    return new Date(raw.endsWith('Z') || raw.includes('+') ? raw : `${raw}Z`);
  }
  return new Date(`${raw.replace(' ', 'T')}Z`);
}

function formatNoteDate(raw: string): string {
  const dt = parseSqliteUtcDate(raw);
  if (Number.isNaN(dt.getTime())) return '';
  const now = new Date();
  const sameDay =
    dt.getFullYear() === now.getFullYear() &&
    dt.getMonth() === now.getMonth() &&
    dt.getDate() === now.getDate();
  const time = dt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return `сегодня в ${time}`;
  const date = dt.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  return `${date}, ${time}`;
}

/**
 * Party notes for quests, NPCs and bestiary monsters. Every note is written in
 * first person by a member of the table, so each entry always shows *whose*
 * face and name it was written from (player character or DM).
 * Real-time synced through the campaign socket.
 */
export const EntityNotes: React.FC<EntityNotesProps> = ({
  kind,
  entityId,
  hideHeader = false,
  className = '',
}) => {
  const user = useCampaignStore((s) => s.user);
  const storeKey = `${kind}:${entityId}`;
  const notes = useCampaignStore((s) => s.entityNotes[storeKey]);
  const setEntityNotes = useCampaignStore((s) => s.setEntityNotes);
  const charactersById = useCampaignStore((s) => s.charactersById);
  const pushToast = useCampaignStore((s) => s.pushToast);

  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);

  const collection = COLLECTION[kind];

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiFetch<{ notes: EntityNote[] }>(`/api/${collection}/${entityId}/notes`)
      .then((res) => {
        if (!cancelled) setEntityNotes(kind, entityId, res.notes);
      })
      .catch(() => {
        if (!cancelled) setEntityNotes(kind, entityId, []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [collection, entityId, kind, setEntityNotes]);

  const isDm = user?.role === 'dm';
  const list = notes ?? [];

  const ownCharacterName =
    user?.role === 'player' && user.playerId ? charactersById[user.playerId]?.characterName : null;
  const ownAvatarUrl = user?.avatarUrl ?? null;
  const speakingAs =
    user?.role === 'dm' ? 'Мастер' : ownCharacterName || user?.displayName || 'Персонаж';

  const handleSubmit = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const res = await apiFetch<{ notes: EntityNote[] }>(
        `/api/${collection}/${entityId}/notes`,
        { method: 'POST', body: JSON.stringify({ body: text }) }
      );
      setEntityNotes(kind, entityId, res.notes);
      setDraft('');
      pushToast({
        title: 'Заметка добавлена',
        message: `От лица: ${speakingAs}. Её увидят все участники стола`,
        variant: 'success',
      });
    } catch (err) {
      pushToast({
        title: 'Не удалось добавить заметку',
        message: err instanceof Error ? err.message : 'Попробуйте ещё раз',
        variant: 'error',
      });
    } finally {
      setSending(false);
    }
  };

  const handleSaveEdit = async (note: EntityNote) => {
    const text = editDraft.trim();
    if (!text || busyId !== null) return;
    setBusyId(note.id);
    try {
      const res = await apiFetch<{ notes: EntityNote[] }>(`/api/notes/${note.id}`, {
        method: 'PUT',
        body: JSON.stringify({ body: text }),
      });
      setEntityNotes(kind, entityId, res.notes);
      setEditingId(null);
      setEditDraft('');
    } catch (err) {
      pushToast({
        title: 'Не удалось обновить заметку',
        message: err instanceof Error ? err.message : 'Попробуйте ещё раз',
        variant: 'error',
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (note: EntityNote) => {
    if (busyId !== null) return;
    if (!window.confirm('Удалить эту заметку? Её больше не увидят участники стола.')) return;
    setBusyId(note.id);
    try {
      const res = await apiFetch<{ notes: EntityNote[] }>(`/api/notes/${note.id}`, {
        method: 'DELETE',
      });
      setEntityNotes(kind, entityId, res.notes);
      if (editingId === note.id) setEditingId(null);
    } catch (err) {
      pushToast({
        title: 'Не удалось удалить заметку',
        message: err instanceof Error ? err.message : 'Попробуйте ещё раз',
        variant: 'error',
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {!hideHeader && (
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs text-muted">
            Заметки отряда
            {list.length > 0 && (
              <span className="font-mono text-secondary tabular-nums ml-1.5">· {list.length}</span>
            )}
          </div>
          <div className="text-[11px] text-muted">Видны всем за столом</div>
        </div>
      )}

      {loading && list.length === 0 ? (
        <div className="text-xs text-muted">Загрузка заметок…</div>
      ) : list.length === 0 ? (
        <div className="text-xs text-muted border border-dashed border-border p-3">
          Пока заметок нет. Напишите первую — от лица своего персонажа.
        </div>
      ) : (
        <div className="space-y-2.5">
          {list.map((note) => {
            const isOwn = user?.id === note.authorId;
            const canEdit = isOwn || isDm;
            const authorLabel =
              note.authorRole === 'player'
                ? note.authorCharacterName || note.authorName
                : note.authorName || 'Мастер';
            const subLabel =
              note.authorRole === 'player'
                ? note.authorCharacterName
                  ? `игрок ${note.authorName}`
                  : 'игрок'
                : 'мастер кампании';

            return (
              <div
                key={note.id}
                className="p-3 bg-bg border border-border border-l-2 space-y-2"
                style={{
                  borderLeftColor: note.authorRole === 'dm' ? '#f59e0b' : 'var(--primary)',
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <PlayerAvatar
                      avatarUrl={note.authorAvatarUrl}
                      displayName={authorLabel}
                      role={note.authorRole}
                      playerId={note.authorPlayerId}
                      size="sm"
                      showRoleBadge={false}
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-text truncate">{authorLabel}</div>
                      <div className="text-[11px] text-muted truncate">
                        от лица {note.authorRole === 'player' ? 'персонажа' : 'мастера'} · {subLabel}{' '}
                        · {formatNoteDate(note.updatedAt || note.createdAt)}
                        {note.updatedAt ? ' · изменено' : ''}
                      </div>
                    </div>
                  </div>

                  {canEdit && editingId !== note.id && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(note.id);
                          setEditDraft(note.body);
                        }}
                        className="h-7 w-7 inline-flex items-center justify-center text-muted hover:text-text transition-colors"
                        title="Редактировать заметку"
                      >
                        <Pencil className="w-3.5 h-3.5" strokeWidth={1.5} />
                      </button>
                      <button
                        type="button"
                        disabled={busyId === note.id}
                        onClick={() => void handleDelete(note)}
                        className="h-7 w-7 inline-flex items-center justify-center text-muted hover:text-negative transition-colors disabled:opacity-50"
                        title="Удалить заметку"
                      >
                        <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                      </button>
                    </div>
                  )}
                </div>

                {editingId === note.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value.slice(0, NOTE_MAX_LENGTH))}
                      rows={3}
                      className="w-full bg-surface border border-border p-2.5 text-xs text-text resize-y outline-none focus:border-primary/60"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={!editDraft.trim() || busyId === note.id}
                        onClick={() => void handleSaveEdit(note)}
                        className="h-7 px-2.5 text-[11px] bg-raised border border-border text-text inline-flex items-center gap-1 disabled:opacity-50"
                      >
                        <Check className="w-3.5 h-3.5" strokeWidth={1.6} />
                        <span>Сохранить</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(null);
                          setEditDraft('');
                        }}
                        className="h-7 px-2.5 text-[11px] text-muted hover:text-text inline-flex items-center gap-1"
                      >
                        <X className="w-3.5 h-3.5" strokeWidth={1.6} />
                        <span>Отмена</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-secondary whitespace-pre-wrap break-words">
                    {note.body}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Composer — always shows which face the note will be written from */}
      <div className="p-3 bg-bg border border-border space-y-2">
        <div className="flex items-center gap-2 text-[11px] text-muted">
          <PlayerAvatar
            avatarUrl={ownAvatarUrl}
            displayName={speakingAs}
            role={user?.role ?? 'player'}
            playerId={user?.playerId ?? null}
            size="xs"
            showRoleBadge={false}
          />
          <span className="min-w-0 truncate">
            Заметка от лица:{' '}
            <span className="text-text font-medium">{speakingAs}</span>
            {user?.role === 'player' && (
              <span className="text-muted"> · игрок {user.displayName}</span>
            )}
          </span>
        </div>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, NOTE_MAX_LENGTH))}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              void handleSubmit();
            }
          }}
          rows={2}
          placeholder={
            isDm
              ? `Заметка мастера к ${ENTITY_LABEL[kind]}: уточнение, подсказка, деталь сцены…`
              : 'Заметка от лица персонажа: что он думает, заметил или обещал…'
          }
          className="w-full bg-surface border border-border p-2.5 text-xs text-text placeholder:text-muted resize-y outline-none focus:border-primary/60"
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-muted font-mono tabular-nums">
            {draft.length} / {NOTE_MAX_LENGTH}
          </span>
          <button
            type="button"
            disabled={!draft.trim() || sending}
            onClick={() => void handleSubmit()}
            className="h-8 px-3 text-xs bg-raised border border-border text-text inline-flex items-center gap-1.5 hover:border-primary/60 transition-colors disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>{sending ? 'Отправка…' : 'Добавить заметку'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
