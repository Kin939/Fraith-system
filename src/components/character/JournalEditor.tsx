import React, { useEffect, useRef, useState } from 'react';
import { BookText, Check, Edit3, Eye, Save } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { useCampaignStore } from '../../lib/store';
import { markJournalDirtyState } from '../../lib/syncTracker';
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

  const activePidRef = useRef(playerId);
  const latestDraftRef = useRef({ title, content });
  const editSeqRef = useRef(0);
  const syncedSeqRef = useRef(0);
  const saveInFlightRef = useRef(false);
  const autoSaveTimerRef = useRef<number | null>(null);

  latestDraftRef.current = { title, content };

  const flushJournalSaveRef = useRef<((manualToast?: boolean) => Promise<void>) | null>(null);

  flushJournalSaveRef.current = async (manualToast = false) => {
    if (readOnly) return;
    if (saveInFlightRef.current) return;
    if (!manualToast && editSeqRef.current <= syncedSeqRef.current) return;

    saveInFlightRef.current = true;
    setSaving(true);
    const pid = activePidRef.current;
    const targetSeq = editSeqRef.current;
    const snapshot = { ...latestDraftRef.current };

    try {
      const res = await apiFetch<{ journal: JournalEntry }>(`/api/player/${pid}/journal`, {
        method: 'PUT',
        body: JSON.stringify(snapshot),
      });
      if (targetSeq > syncedSeqRef.current) {
        syncedSeqRef.current = targetSeq;
      }
      const caughtUp = editSeqRef.current <= syncedSeqRef.current;
      if (caughtUp) {
        setDirty(false);
        markJournalDirtyState(pid, false);
        updateJournalInStore(pid, res.journal);
      }
      if (manualToast) {
        pushToast({
          title: 'Журнал сохранён',
          message: 'Записи вашего персонажа обновлены в базе D1.',
          variant: 'success',
        });
      }
    } catch (err) {
      if (manualToast) {
        pushToast({
          title: 'Ошибка сохранения журнала',
          message: err instanceof Error ? err.message : 'Попробуйте снова',
          variant: 'error',
        });
      }
    } finally {
      saveInFlightRef.current = false;
      const allCaughtUp = editSeqRef.current <= syncedSeqRef.current;
      if (!allCaughtUp) {
        if (autoSaveTimerRef.current) window.clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = window.setTimeout(() => {
          autoSaveTimerRef.current = null;
          void flushJournalSaveRef.current?.(false);
        }, 300);
      } else {
        setSaving(false);
      }
    }
  };

  useEffect(() => {
    if (playerId !== activePidRef.current) {
      if (autoSaveTimerRef.current) {
        window.clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
      void flushJournalSaveRef.current?.(false);
      activePidRef.current = playerId;
      editSeqRef.current = 0;
      syncedSeqRef.current = 0;
      setTitle(journal?.title ?? 'Личный дневник');
      setContent(journal?.content ?? '');
      setDirty(false);
      markJournalDirtyState(playerId, false);
      return;
    }

    if (editSeqRef.current > syncedSeqRef.current || saveInFlightRef.current) {
      return;
    }
    setTitle(journal?.title ?? 'Личный дневник');
    setContent(journal?.content ?? '');
    setDirty(false);
  }, [playerId, journal?.title, journal?.content]);

  useEffect(() => {
    if (readOnly) setPreviewMode(true);
  }, [readOnly]);

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        window.clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
      void flushJournalSaveRef.current?.(false);
    };
  }, []);

  const scheduleAutoSave = () => {
    editSeqRef.current += 1;
    setDirty(true);
    markJournalDirtyState(playerId, true);
    if (autoSaveTimerRef.current) {
      window.clearTimeout(autoSaveTimerRef.current);
    }
    autoSaveTimerRef.current = window.setTimeout(() => {
      autoSaveTimerRef.current = null;
      void flushJournalSaveRef.current?.(false);
    }, 900);
  };

  const handleManualSave = () => {
    if (readOnly) return;
    if (autoSaveTimerRef.current) {
      window.clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    void flushJournalSaveRef.current?.(true);
  };

  return (
    <div className="glass-panel hud-neon-top hud-corners p-5 space-y-3.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2.5">
          <BookText className="w-4 h-4 text-primary" />
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
              JOURNAL // PERSONAL LOG
            </div>
            <h3 className="font-anime font-bold text-base uppercase">
              Личный журнал приключенца
            </h3>
          </div>
        </div>

        {readOnly ? (
          <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider px-2.5 py-1 bg-[#070B14]/80 border border-primary/30 text-muted">
            <Eye className="w-3.5 h-3.5 text-primary" />
            READ-ONLY // MASTER VIEW
          </span>
        ) : (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPreviewMode((v) => !v)}
              className={`px-2.5 py-1.5 text-xs font-mono uppercase tracking-wider border inline-flex items-center gap-1.5 transition-colors ${
                previewMode
                  ? 'bg-primary/15 border-primary text-primary'
                  : 'bg-[#070B14]/80 border-primary/30 text-muted hover:text-text'
              }`}
            >
              {previewMode ? <Edit3 className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{previewMode ? 'Редактор' : 'Чтение'}</span>
            </button>
            <button
              type="button"
              disabled={saving || !dirty}
              onClick={handleManualSave}
              className="anime-btn-primary px-3.5 py-1.5 text-xs inline-flex items-center gap-1.5"
            >
              {dirty ? <Save className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
              <span>{saving ? 'Сохранение...' : dirty ? 'Сохранить' : 'Сохранено'}</span>
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
          scheduleAutoSave();
        }}
        placeholder="Название дневника..."
        className="anime-input w-full text-sm font-semibold"
      />

      {previewMode ? (
        <div
          onClick={() => {
            if (!readOnly) setPreviewMode(false);
          }}
          className={`min-h-[10rem] p-3.5 bg-[#070B14]/75 border border-primary/25 text-sm ${
            !readOnly ? 'cursor-text hover:border-primary/60' : ''
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
            scheduleAutoSave();
          }}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
              e.preventDefault();
              handleManualSave();
            }
          }}
          rows={7}
          placeholder="Ведите заметки о тайнах кампании, уликах и NPC. Выделите любой фрагмент текста, чтобы сделать его жирным, курсивом, цветным или кликабельным броском кубиков."
          className="anime-input w-full text-sm leading-relaxed resize-y"
        />
      )}

      <div className="font-mono text-[10px] uppercase tracking-wider text-muted flex flex-wrap items-center justify-between gap-2">
        <span>
          {!readOnly
            ? 'AUTO-SAVE // ВЫДЕЛИТЕ ТЕКСТ ДЛЯ ПАНЕЛИ ВЁРСТКИ (CTRL+B / CTRL+I)'
            : 'TABLE // JOURNAL_ENTRIES'}
        </span>
        {journal?.updatedAt && (
          <span className="tabular-nums">
            SYNC: {new Date(journal.updatedAt).toLocaleString('ru-RU')}
          </span>
        )}
      </div>
    </div>
  );
};
