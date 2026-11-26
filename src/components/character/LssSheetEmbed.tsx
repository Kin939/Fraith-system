import React, { useEffect, useState } from 'react';
import {
  Download,
  FileJson,
  Lock,
  Monitor,
  RefreshCw,
  RotateCcw,
  ScrollText,
  Unlock,
  Upload,
  X,
} from 'lucide-react';
import { LSS_ALLOWED_ORIGINS, LSS_CHARACTER_LIST_EMBED_URL, LSS_SCHEMA_V1_URL } from '../../lib/lss';
import { packLssStructures, unwrapLssJsonMutable } from '../../lib/lssSheetParser';
import { useCampaignStore } from '../../lib/store';
import type {
  CharacterProfile,
  JournalEntry,
  LearnedSpellRecord,
  PlayerId,
} from '../../lib/types';
import { LssNativeSheet } from './LssNativeSheet';

interface LssSheetEmbedProps {
  playerId: PlayerId;
  profile: CharacterProfile;
  journal: JournalEntry | null;
  learnedSpells: LearnedSpellRecord[];
  isDm: boolean;
  onSyncJson: (lssJson: unknown) => Promise<void>;
  onResetSlot: () => Promise<void>;
  onRefreshCache: () => Promise<void>;
  syncing: boolean;
  externalOpenImport?: number;
}

export const LssSheetEmbed: React.FC<LssSheetEmbedProps> = ({
  profile,
  journal,
  learnedSpells,
  isDm,
  onSyncJson,
  onResetSlot,
  onRefreshCache,
  syncing,
  externalOpenImport,
}) => {
  const pushToast = useCampaignStore((s) => s.pushToast);
  const updateCharacterProfileInStore = useCampaignStore(
    (s) => s.updateCharacterProfileInStore
  );

  const [dmAllowEdit, setDmAllowEdit] = useState(false);
  const [viewMode, setViewMode] = useState<'native' | 'iframe'>('native');
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    setDmAllowEdit(false);
  }, [profile.playerId]);

  useEffect(() => {
    if (externalOpenImport && externalOpenImport > 0) {
      setImportModalOpen(true);
    }
  }, [externalOpenImport]);

  useEffect(() => {
    if (viewMode !== 'iframe') return;
    const onMessage = (ev: MessageEvent) => {
      if (!LSS_ALLOWED_ORIGINS.includes(ev.origin)) return;
      if (ev.data && typeof ev.data === 'object') {
        const payload = ev.data as Record<string, unknown>;
        if (payload.jsonType === 'character' || payload.data) {
          void onSyncJson(payload);
        }
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [viewMode, onSyncJson]);

  const canEdit = !isDm || dmAllowEdit;

  const handleQuickUploadFile = async (file: File) => {
    try {
      const rawText = await file.text();
      const parsed = JSON.parse(rawText) as unknown;
      await onSyncJson(parsed);
      pushToast({
        title: 'Чарник импортирован',
        message: `Файл «${file.name}» загружен в лист персонажа`,
        variant: 'success',
      });
    } catch (err) {
      pushToast({
        title: 'Ошибка чтения JSON',
        message: err instanceof Error ? err.message : 'Проверьте экспорт из Long Story Short',
        variant: 'error',
      });
    }
  };

  const handleFileUploadInModal = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setJsonText(text);
  };

  const handleApplyJsonImport = async () => {
    if (!jsonText.trim()) return;
    setImporting(true);
    try {
      const parsed = JSON.parse(jsonText) as unknown;
      await onSyncJson(parsed);
      pushToast({
        title: 'Чарник загружен',
        message: 'Данные персонажа синхронизированы',
        variant: 'success',
      });
      setImportModalOpen(false);
      setJsonText('');
    } catch (err) {
      pushToast({
        title: 'Ошибка импорта JSON',
        message:
          err instanceof Error
            ? err.message
            : 'Проверьте корректность .json файла Long Story Short',
        variant: 'error',
      });
    } finally {
      setImporting(false);
    }
  };

  const handleExportJson = () => {
    if (!profile.rawLssJson) return;
    const packed = packLssStructures(unwrapLssJsonMutable(profile.rawLssJson));
    const blob = new Blob([JSON.stringify(packed, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = (profile.characterName || `player-${profile.playerId}`)
      .replace(/[^\p{L}\p{N}_-]+/gu, '_')
      .slice(0, 40);
    a.href = url;
    a.download = `${safeName}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const hasCharacter = Boolean(profile.characterName.trim() || profile.rawLssJson);
  const iframeSrc = profile.lssEmbedUrl?.trim() || LSS_CHARACTER_LIST_EMBED_URL;

  return (
    <div className="glass-panel hud-cut overflow-hidden flex flex-col">
      {/* Quiet Sheet Toolbar */}
      <div className="px-4 py-3 border-b border-border bg-deep flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm font-medium text-text">Лист персонажа</span>
          <span className="text-xs text-muted">Игрок {profile.playerId}</span>

          <div className="inline-flex items-center border border-border bg-bg p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('native')}
              className={`h-7 px-2.5 text-xs inline-flex items-center gap-1.5 transition-colors ${
                viewMode === 'native'
                  ? 'bg-raised text-text font-medium'
                  : 'text-muted hover:text-text'
              }`}
            >
              <ScrollText className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>Нативный лист</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('iframe')}
              className={`h-7 px-2.5 text-xs inline-flex items-center gap-1.5 transition-colors ${
                viewMode === 'iframe'
                  ? 'bg-raised text-text font-medium'
                  : 'text-muted hover:text-text'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>Окно LSS</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isDm && (
            <button
              type="button"
              onClick={() => setDmAllowEdit((v) => !v)}
              className={`h-8 inline-flex items-center gap-1.5 px-3 text-xs border transition-colors ${
                dmAllowEdit
                  ? 'border-warning/40 bg-warning/10 text-warning font-medium'
                  : 'border-border bg-surface text-secondary hover:text-text'
              }`}
              title="Разрешить Мастеру редактировать поля чарника этого игрока"
            >
              {dmAllowEdit ? (
                <>
                  <Unlock className="w-3.5 h-3.5" strokeWidth={1.5} />
                  <span>Правка Мастером</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" strokeWidth={1.5} />
                  <span>Только просмотр</span>
                </>
              )}
            </button>
          )}

          {profile.rawLssJson && (
            <button
              type="button"
              onClick={handleExportJson}
              className="h-8 inline-flex items-center gap-1.5 px-3 text-xs border border-border bg-surface text-secondary hover:text-text transition-colors"
              title="Скачать чарник в формате .json"
            >
              <Download className="w-3.5 h-3.5 text-muted" strokeWidth={1.5} />
              <span>Экспорт</span>
            </button>
          )}

          {canEdit && (
            <button
              type="button"
              onClick={() => setImportModalOpen(true)}
              className="hud-btn-secondary h-8 inline-flex items-center gap-1.5 px-3 text-xs"
            >
              <FileJson className="w-3.5 h-3.5 text-muted" strokeWidth={1.5} />
              <span>Импорт JSON</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => void onRefreshCache()}
            disabled={syncing}
            className="w-8 h-8 inline-flex items-center justify-center border border-border bg-surface text-muted hover:text-text transition-colors"
            title="Синхронизировать с сервером"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-primary' : ''}`}
              strokeWidth={1.5}
            />
          </button>

          {hasCharacter && canEdit && (
            <button
              type="button"
              onClick={() => void onResetSlot()}
              className="w-8 h-8 inline-flex items-center justify-center border border-border bg-surface text-muted hover:text-negative transition-colors"
              title="Очистить слот персонажа"
            >
              <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
          )}
        </div>
      </div>

      {/* Main Sheet Body */}
      {viewMode === 'iframe' ? (
        <div className="w-full bg-bg relative">
          <iframe
            src={iframeSrc}
            title={`Long Story Short — Игрок ${profile.playerId}`}
            className="w-full h-[780px] border-0 bg-bg"
            allow="clipboard-read; clipboard-write"
          />
        </div>
      ) : (
        <LssNativeSheet
          profile={profile}
          journal={journal}
          learnedSpells={learnedSpells}
          canEdit={canEdit}
          isDm={isDm}
          onQuickUploadFile={handleQuickUploadFile}
          onOpenImportModal={() => setImportModalOpen(true)}
          onSyncJson={onSyncJson}
          onProfileUpdated={(nextProfile) =>
            updateCharacterProfileInStore(profile.playerId, nextProfile)
          }
        />
      )}

      {/* Quiet Sync Footer */}
      <div className="px-4 py-2.5 bg-deep border-t border-border text-xs text-muted flex flex-wrap items-center justify-between gap-2">
        <span>Автосохранение листа Long Story Short включено</span>
        <span className="font-mono tabular-nums">
          {profile.lastSyncedAt
            ? `Обновлено ${new Date(profile.lastSyncedAt).toLocaleString('ru-RU')}`
            : 'Ещё не синхронизировано'}
        </span>
      </div>

      {/* Import JSON Modal */}
      {importModalOpen && (
        <div
          onClick={() => setImportModalOpen(false)}
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="glass-panel hud-cut max-w-xl w-full p-6 space-y-4 shadow-glass"
          >
            <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
              <div>
                <h3 className="font-medium text-base text-text">
                  Импорт листа из Long Story Short
                </h3>
                <p className="text-xs text-secondary mt-1">
                  Экспортируйте персонажа в файл <code>.json</code> (схема{' '}
                  <a
                    href={LSS_SCHEMA_V1_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline"
                  >
                    character.json
                  </a>
                  ) и выберите его ниже или вставьте текст.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                className="p-1 text-muted hover:text-text transition-colors"
              >
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>

            <div>
              <label className="hud-btn-secondary inline-flex items-center gap-2 h-9 px-4 text-xs cursor-pointer">
                <Upload className="w-4 h-4 text-muted" strokeWidth={1.5} />
                <span>Выбрать файл .json</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileUploadInModal}
                  className="hidden"
                />
              </label>
            </div>

            <textarea
              data-no-format="true"
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              rows={8}
              placeholder="Содержимое .json файла"
              className="anime-input w-full font-mono text-xs"
            />

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                className="h-9 px-4 border border-border text-xs text-secondary hover:text-text transition-colors"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={importing || !jsonText.trim()}
                onClick={() => void handleApplyJsonImport()}
                className="anime-btn-primary h-9 px-4 text-xs"
              >
                {importing ? 'Импорт…' : 'Импортировать'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
