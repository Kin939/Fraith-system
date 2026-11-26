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

  // Preserve postMessage sync listener when embedded LSS iframe mode is open
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
        message: `Файл «${file.name}» успешно загружен в тактический лист.`,
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
        message: 'Данные персонажа синхронизированы.',
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
    <div className="glass-panel hud-corners hud-cut overflow-hidden flex flex-col">
      {/* HUD Frame Header: CHARACTER SHEET // SYNC */}
      <div className="px-4 py-2.5 border-b border-primary/35 bg-[#070B14]/85 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] px-2.5 py-1 bg-primary/15 text-primary border border-primary/50">
            CHARACTER SHEET // SYNC
          </span>
          <span className="font-mono text-[11px] text-muted uppercase">
            SLOT P0{profile.playerId}
          </span>
          <div className="inline-flex items-center border border-primary/30 bg-[#070B14]">
            <button
              type="button"
              onClick={() => setViewMode('native')}
              className={`px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider inline-flex items-center gap-1 transition-colors ${
                viewMode === 'native'
                  ? 'bg-primary text-[#040810] font-bold'
                  : 'text-muted hover:text-text'
              }`}
            >
              <ScrollText className="w-3 h-3" />
              <span>HUD SHEET</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('iframe')}
              className={`px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider inline-flex items-center gap-1 transition-colors ${
                viewMode === 'iframe'
                  ? 'bg-primary text-[#040810] font-bold'
                  : 'text-muted hover:text-text'
              }`}
            >
              <Monitor className="w-3 h-3" />
              <span>LSS IFRAME</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isDm && (
            <button
              type="button"
              onClick={() => setDmAllowEdit((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono uppercase tracking-wide border transition-colors ${
                dmAllowEdit
                  ? 'border-amber-400/60 bg-amber-500/15 text-amber-200 font-bold'
                  : 'border-primary/30 bg-[#070B14] text-muted hover:text-text'
              }`}
              title="Разрешить Мастеру редактировать поля чарника этого игрока"
            >
              {dmAllowEdit ? (
                <>
                  <Unlock className="w-3.5 h-3.5" />
                  <span>DM EDIT: ON</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>DM EDIT</span>
                </>
              )}
            </button>
          )}

          {profile.rawLssJson && (
            <button
              type="button"
              onClick={handleExportJson}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-primary/30 bg-[#070B14] text-muted hover:text-primary hover:border-primary transition-colors"
              title="Скачать чарник в формате .json (совместим с Long Story Short)"
            >
              <Download className="w-3.5 h-3.5 text-primary" />
              <span>Экспорт .json</span>
            </button>
          )}

          {canEdit && (
            <button
              type="button"
              onClick={() => setImportModalOpen(true)}
              className="hud-btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold"
            >
              <FileJson className="w-3.5 h-3.5 text-primary" />
              <span>Импорт .json</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => void onRefreshCache()}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-primary/30 bg-[#070B14] text-muted hover:text-primary hover:border-primary transition-colors"
            title="Синхронизировать с сервером"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-primary' : ''}`} />
          </button>

          {hasCharacter && canEdit && (
            <button
              type="button"
              onClick={() => void onResetSlot()}
              className="p-1.5 border border-primary/30 bg-[#070B14] text-muted hover:text-rose-300 hover:border-rose-500/50 transition-colors"
              title="Очистить слот персонажа"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Sheet Body: Native 3-Page Sheet or Embedded Long Story Short Iframe */}
      {viewMode === 'iframe' ? (
        <div className="w-full bg-[#070B14] relative">
          <iframe
            src={iframeSrc}
            title={`Long Story Short — Player ${profile.playerId}`}
            className="w-full h-[780px] border-0 bg-[#070B14]"
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

      {/* Telemetry Footer */}
      <div className="px-4 py-2 bg-[#070B14]/85 border-t border-primary/25 font-mono text-[10px] uppercase tracking-wider text-muted flex flex-wrap items-center justify-between gap-2">
        <span>
          PROTOCOL: <strong className="text-primary">LSS .JSON + POSTMESSAGE</strong> // AUTO-SAVE ACTIVE
        </span>
        <span className="tabular-nums">
          LAST SYNC:{' '}
          {profile.lastSyncedAt
            ? new Date(profile.lastSyncedAt).toLocaleString('ru-RU')
            : 'PENDING'}
        </span>
      </div>

      {/* Import JSON Modal */}
      {importModalOpen && (
        <div
          onClick={() => setImportModalOpen(false)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="glass-panel neon-border hud-corners hud-cut max-w-xl w-full p-6 space-y-4"
          >
            <div className="flex items-start justify-between gap-3 border-b border-primary/25 pb-3">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
                  // IMPORT LSS PAYLOAD
                </div>
                <h3 className="font-anime font-bold text-lg uppercase">
                  Импорт чарника Long Story Short (.json)
                </h3>
                <p className="text-xs text-muted mt-1">
                  Экспортируйте своего персонажа в файл <code>.json</code> в Long Story Short (схема{' '}
                  <a
                    href={LSS_SCHEMA_V1_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline"
                  >
                    character.json
                  </a>
                  ) и загрузите ниже.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                className="p-1.5 border border-primary/30 text-muted hover:text-text"
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
                className="px-4 py-2 border border-primary/30 text-xs font-mono uppercase text-muted hover:text-text"
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
