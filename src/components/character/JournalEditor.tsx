import React, { useEffect, useState } from 'react';
import { BookText, Check, Edit3, Eye, Save } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { useCampaignStore } from '../../lib/store';
import type { JournalEntry, PlayerId } from '../../lib/types';
import { FormattedText } from '../common/FormattedText';

interface JournalEditorProps {
  playerId: PlayerId;
  journal: JournalEntry | null;
  readOnly: boolean;
}

export const JournalEditor: React.FC<JournalEditorProps> = ({ playerId, journal, readOnly }) => {
  const updateJournalInStore = useCampaignStore((s) => s.updateJournalInStore);
  const pushToast = useCampaignStore((s) => s.pushToast);

  const [title, setTitle] = useState(journal?.title ?? 'Личный дневник');
  const [content, setContent] = useState(journal?.content ?? '');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [previewMode, setPreviewMode] = useState(readOnly);

  useEffect(() => {
    setTitle(journal?.title ?? 'Личный дневник');
    setContent(journal?.content ?? '');
    setDirty(false);
  }, [playerId, journal?.title, journal?.content]);

  useEffect(() => {
    if (readOnly) setPreviewMode(true);
  }, [readOnly]);

  const handleSave = async () => {
    if (readOnly) return;
    setSaving(true);
    try {
      const res = await apiFetch<{ journal: JournalEntry }>(`/api/player/${playerId}/journal`, {
        method: 'PUT',
        body: JSON.stringify({ title, content }),
      });
      updateJournalInStore(playerId, res.journal);
      setDirty(false);
      pushToast({
        title: 'Журнал сохранён',
        message: 'Записи вашего персонажа обновлены в базе D1.',
        variant: 'success',
      });
    } catch (err) {
      pushToast({
        title: 'Ошибка сохранения журнала',
        message: err instanceof Error ? err.message : 'Попробуйте снова',
        variant: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="glass-panel rounded-3xl p-5 space-y-3.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <BookText className="w-5 h-5 text-primary" />
          <h3 className="font-anime font-bold text-base">Личный журнал приключенца</h3>
        </div>

        {readOnly ? (
          <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-xl bg-bg/60 border border-border text-muted">
            <Eye className="w-3.5 h-3.5 text-accent" />
            Просмотр Мастера (только чтение)
          </span>
        ) : (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPreviewMode((v) => !v)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border inline-flex items-center gap-1.5 transition-colors ${
                previewMode
                  ? 'bg-accent/20 border-accent text-accent'
                  : 'bg-bg/60 border-border text-muted hover:text-text'
              }`}
            >
              {previewMode ? <Edit3 className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{previewMode ? 'Редактор' : 'Чтение'}</span>
            </button>
            <button
              type="button"
              disabled={saving || !dirty}
              onClick={handleSave}
              className="anime-btn-primary px-3.5 py-1.5 text-xs inline-flex items-center gap-1.5"
            >
              {dirty ? <Save className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
              <span>{saving ? 'Сохранение...' : dirty ? 'Сохранить в D1' : 'Сохранено'}</span>
            </button>
          </div>
        )}
      </div>

      <input
        type="text"
        value={title}
        readOnly={readOnly}
        onChange={(e) => {
          setTitle(e.target.value);
          setDirty(true);
        }}
        placeholder="Название дневника..."
        className="anime-input w-full text-sm font-semibold"
      />

      {previewMode ? (
        <div
          onClick={() => {
            if (!readOnly) setPreviewMode(false);
          }}
          className={`min-h-[10rem] p-3.5 rounded-2xl bg-bg/60 border border-border text-sm ${
            !readOnly ? 'cursor-text hover:border-primary/40' : ''
          }`}
        >
          {content.trim() ? (
            <FormattedText text={content} />
          ) : (
            <span className="text-muted text-xs">
              {readOnly
                ? 'У этого героя пока нет записей в личном журнале...'
                : 'Нажмите, чтобы начать вести записи...'}
            </span>
          )}
        </div>
      ) : (
        <textarea
          value={content}
          readOnly={readOnly}
          onChange={(e) => {
            setContent(e.target.value);
            setDirty(true);
          }}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
              e.preventDefault();
              void handleSave();
            }
          }}
          rows={7}
          placeholder="Ведите заметки о тайнах кампании, уликах и NPC. Выделите любой фрагмент текста, чтобы сделать его жирным, курсивом, цветным или кликабельным броском кубиков!"
          className="anime-input w-full text-sm leading-relaxed resize-y"
        />
      )}

      <div className="text-[11px] text-muted flex flex-wrap items-center justify-between gap-2">
        <span>
          {!readOnly
            ? 'Совет: выделите текст мышью/пальцем для всплывающей панели вёрстки (Ctrl+B / Ctrl+I)'
            : 'Таблица D1: journal_entries'}
        </span>
        {journal?.updatedAt && (
          <span>Обновлено: {new Date(journal.updatedAt).toLocaleString('ru-RU')}</span>
        )}
      </div>
    </div>
  );
};
