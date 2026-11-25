import React, { useEffect, useState } from 'react';
import {
  Download,
  FileJson,
  Lock,
  RefreshCw,
  RotateCcw,
  ScrollText,
  Unlock,
  Upload,
  X,
} from 'lucide-react';
import { LSS_SCHEMA_V1_URL } from '../../lib/lss';
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

  const canEdit = !isDm || dmAllowEdit;

  const handleQuickUploadFile = async (file: File) => {
    try {
      const rawText = await file.text();
      const parsed = JSON.parse(rawText) as unknown;
      await onSyncJson(parsed);
      pushToast({
        title: 'Чарник импортирован',
        message: `Файл «${file.name}» успешно загружен в классический лист.`,
        variant: 'success',
      });
    } catch (err) {
      pushToast({
        title: 'Ошибка чтения .json файла',
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
        title: 'Чарник персонажа загружен',
        message: 'Данные персонажа сохранены.',
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

  return (
    <div className="glass-panel rounded-3xl overflow-hidden flex flex-col">
      {/* Top Sheet Utility Bar */}
      <div className="px-4 py-2.5 border-b border-border bg-bg/60 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-primary/20 text-primary border border-primary/40">
            Игрок #{profile.playerId}
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted">
            <ScrollText className="w-3.5 h-3.5 text-accent" />
            <span>Классический лист D&amp;D 5e</span>
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isDm && (
            <button
              type="button"
              onClick={() => setDmAllowEdit((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs border transition-colors ${
                dmAllowEdit
                  ? 'border-amber-400/50 bg-amber-500/15 text-amber-200 font-semibold'
                  : 'border-border bg-surface text-muted hover:text-text'
              }`}
              title="Разрешить Мастеру редактировать поля чарника этого игрока (опыт доступен Мастеру всегда)"
            >
              {dmAllowEdit ? (
                <>
                  <Unlock className="w-3.5 h-3.5" />
                  <span>Правка Мастером: ВКЛ</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>Правка Мастером</span>
                </>
              )}
            </button>
          )}

          {profile.rawLssJson && (
            <button
              type="button"
              onClick={handleExportJson}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs border border-border bg-surface text-muted hover:text-text transition-colors"
              title="Скачать чарник в формате .json (совместим с Long Story Short)"
            >
              <Download className="w-3.5 h-3.5 text-primary" />
              <span>Скачать .json</span>
            </button>
          )}

          {canEdit && (
            <button
              type="button"
              onClick={() => setImportModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-accent/15 text-accent border border-accent/40 hover:bg-accent/25 transition-colors"
            >
              <FileJson className="w-3.5 h-3.5" />
              <span>Импорт .json</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => void onRefreshCache()}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs border border-border bg-surface text-muted hover:text-text transition-colors"
            title="Синхронизировать с сервером"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-primary' : ''}`} />
          </button>

          {hasCharacter && canEdit && (
            <button
              type="button"
              onClick={() => void onResetSlot()}
              className="p-1.5 rounded-xl border border-border text-muted hover:text-rose-300 hover:border-rose-500/40 transition-colors"
              title="Очистить слот персонажа"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Full-Width Classic 3-Page Sheet */}
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

      {/* Footer Sync Info */}
      <div className="px-4 py-2 bg-bg/60 border-t border-border text-[11px] text-muted flex flex-wrap items-center justify-between gap-2">
        <span>
          Полная совместимость с форматом <strong className="text-primary">LSS .json</strong> •
          автосохранение всех изменений листа
        </span>
        <span>
          Синхронизация:{' '}
          {profile.lastSyncedAt
            ? new Date(profile.lastSyncedAt).toLocaleString('ru-RU')
            : 'не выполнялась'}
        </span>
      </div>

      {/* Import JSON Modal */}
      {importModalOpen && (
        <div
          onClick={() => setImportModalOpen(false)}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="glass-panel neon-border rounded-3xl max-w-xl w-full p-6 space-y-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-anime font-bold text-lg">
                  Импорт чарника из Long Story Short (.json)
                </h3>
                <p className="text-xs text-muted mt-1">
                  Экспортируйте своего персонажа в файл <code>.json</code> в Long Story Short (схема{' '}
                  <a
                    href={LSS_SCHEMA_V1_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent underline"
                  >
                    character.json
                  </a>
                  ) и выберите его ниже. Все 3 страницы листа заполнятся автоматически.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                className="p-1.5 rounded-xl border border-border text-muted hover:text-text"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="anime-btn-primary inline-flex items-center gap-2 px-4 py-2 text-xs cursor-pointer">
                <Upload className="w-4 h-4" />
                <span>Выбрать .json файл персонажа</span>
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
              placeholder="Или вставьте содержимое экспортированного .json файла из Long Story Short..."
              className="anime-input w-full font-mono text-xs"
            />

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-border text-xs text-muted hover:text-text"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={importing || !jsonText.trim()}
                onClick={() => void handleApplyJsonImport()}
                className="anime-btn-primary px-4 py-2 text-xs"
              >
                {importing ? 'Загрузка...' : 'Импортировать чарник'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
