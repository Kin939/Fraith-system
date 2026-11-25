import React, { useEffect, useRef, useState } from 'react';
import {
  createBridgeSheetSource,
  DiceRollPayload,
  formatRollMessage,
  rollVariant,
  SHEET_IFRAME_SANDBOX,
  SheetEvent,
} from '@longstoryshort/vtt-sdk';
import {
  Dices,
  ExternalLink,
  FileJson,
  Lock,
  MousePointerClick,
  RefreshCw,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { apiFetch } from '../../lib/api';
import {
  LSS_ALLOWED_ORIGINS,
  LSS_CHARACTER_LIST_EMBED_URL,
  LSS_SCHEMA_V1_URL,
} from '../../lib/lss';
import { useCampaignStore } from '../../lib/store';
import type { CharacterProfile, PlayerId } from '../../lib/types';

interface LssSheetEmbedProps {
  playerId: PlayerId;
  profile: CharacterProfile;
  isReadOnlyViewer: boolean;
  onSyncJson: (lssJson: unknown, lssEmbedUrl?: string) => Promise<void>;
  onSyncHealth: (hp: { hpCurrent: number; hpMax: number; hpTemp: number }) => Promise<void>;
  onRefreshCache: () => Promise<void>;
  syncing: boolean;
  externalOpenImport?: number;
}

export const LssSheetEmbed: React.FC<LssSheetEmbedProps> = ({
  profile,
  isReadOnlyViewer,
  onSyncJson,
  onSyncHealth,
  onRefreshCache,
  syncing,
  externalOpenImport,
}) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const pushToast = useCampaignStore((s) => s.pushToast);

  const [iframeKey, setIframeKey] = useState(0);
  const [manifestSystem, setManifestSystem] = useState<string | null>(null);
  const [lastEventBadge, setLastEventBadge] = useState<string>('Ожидание событий postMessage');
  const [strictPointerLock, setStrictPointerLock] = useState<boolean>(isReadOnlyViewer);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const [embedUrlDraft, setEmbedUrlDraft] = useState(profile.lssEmbedUrl || LSS_CHARACTER_LIST_EMBED_URL);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    setStrictPointerLock(isReadOnlyViewer);
    setEmbedUrlDraft(profile.lssEmbedUrl || LSS_CHARACTER_LIST_EMBED_URL);
  }, [isReadOnlyViewer, profile.playerId, profile.lssEmbedUrl]);

  useEffect(() => {
    if (externalOpenImport && externalOpenImport > 0) {
      setImportModalOpen(true);
    }
  }, [externalOpenImport]);

  const embedUrl = profile.lssEmbedUrl || LSS_CHARACTER_LIST_EMBED_URL;

  useEffect(() => {
    const iframeEl = iframeRef.current;
    if (!iframeEl) return;

    const source = createBridgeSheetSource({
      iframe: iframeEl,
      allowedOrigins: LSS_ALLOWED_ORIGINS,
    });

    const unsubRoll = source.onRoll((roll: DiceRollPayload) => {
      const formatted = formatRollMessage(roll);
      const variant = rollVariant(roll);
      setLastEventBadge(`lss:roll • ${roll.title} = ${roll.total}`);

      pushToast({
        title: formatted,
        message: `${roll.formula} → ${roll.breakdown}`,
        variant,
      });

      void apiFetch('/api/rolls', {
        method: 'POST',
        body: JSON.stringify({
          characterName: roll.characterName || profile.characterName || `Игрок ${profile.playerId}`,
          title: roll.title,
          formula: roll.formula,
          breakdown: roll.breakdown,
          total: roll.total,
          isCrit: roll.isCrit,
          critKind: roll.critKind,
        }),
      }).catch(() => {
        // Ignore transient network errors
      });
    });

    const unsubEvent = source.onEvent((event: SheetEvent) => {
      if (event.type === 'lss:manifest') {
        setManifestSystem(event.payload.sheetSystem);
        setLastEventBadge(`lss:manifest (${event.payload.sheetSystem})`);
      } else if (event.type === 'dnd:health') {
        setLastEventBadge(
          `dnd:health • ${event.payload.current}/${event.payload.max} (+${event.payload.temp})`
        );
        if (!isReadOnlyViewer) {
          void onSyncHealth({
            hpCurrent: event.payload.current,
            hpMax: event.payload.max,
            hpTemp: event.payload.temp,
          });
        }
      } else if (event.type === 'lss:group-status') {
        setLastEventBadge(
          `lss:group-status • ${event.payload.connected ? 'в группе' : 'автономно'}`
        );
      }
    });

    return () => {
      unsubRoll();
      unsubEvent();
      source.dispose();
    };
  }, [iframeKey, profile.playerId, profile.characterName, isReadOnlyViewer, onSyncHealth, pushToast]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setJsonText(text);
  };

  const handleApplyJsonImport = async () => {
    if (!jsonText.trim() && (!embedUrlDraft.trim() || embedUrlDraft === profile.lssEmbedUrl)) {
      return;
    }
    setImporting(true);
    try {
      const parsed = jsonText.trim() ? (JSON.parse(jsonText) as unknown) : null;
      await onSyncJson(parsed, embedUrlDraft.trim() || undefined);
      pushToast({
        title: 'Чарник персонажа загружен',
        message: 'Данные персонажа из Long Story Short сохранены в Cloudflare D1.',
        variant: 'success',
      });
      setImportModalOpen(false);
      setJsonText('');
    } catch (err) {
      pushToast({
        title: 'Ошибка импорта JSON',
        message: err instanceof Error ? err.message : 'Проверьте корректность .json файла Long Story Short',
        variant: 'error',
      });
    } finally {
      setImporting(false);
    }
  };

  const handleTestRollBroadcast = async () => {
    const d20 = Math.floor(Math.random() * 20) + 1;
    const total = d20;
    const isCrit = d20 === 20 || d20 === 1;
    const critKind = d20 === 20 ? 'success' : d20 === 1 ? 'failure' : undefined;
    const rollerName = profile.characterName || `Игрок ${profile.playerId}`;

    await apiFetch('/api/rolls', {
      method: 'POST',
      body: JSON.stringify({
        characterName: rollerName,
        title: 'Бросок к20',
        formula: '1к20',
        breakdown: `(${d20})`,
        total: String(total),
        isCrit,
        critKind,
      }),
    });

    pushToast({
      title: `🎲 ${rollerName}: Бросок к20 — ${total}`,
      message: `Результат (${d20}) отправлен в общий лог стола`,
      variant: isCrit ? (d20 === 20 ? 'success' : 'error') : 'info',
    });
  };

  return (
    <div className="glass-panel rounded-3xl overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-border bg-bg/50 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-primary/20 text-primary border border-primary/40">
            <ShieldCheck className="w-3.5 h-3.5" />
            Long Story Short Embed
          </span>
          <span className="text-xs text-muted">
            {manifestSystem ? `SDK: ${manifestSystem}` : lastEventBadge}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setStrictPointerLock((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs border transition-colors ${
              strictPointerLock
                ? 'border-amber-500/50 bg-amber-500/15 text-amber-200'
                : 'border-border bg-surface text-muted hover:text-text'
            }`}
            title="Переключить защитный экран только-чтения поверх iframe"
          >
            {strictPointerLock ? (
              <>
                <Lock className="w-3.5 h-3.5" />
                Экран чтения (вкл)
              </>
            ) : (
              <>
                <MousePointerClick className="w-3.5 h-3.5" />
                Навигация в листе
              </>
            )}
          </button>

          {!isReadOnlyViewer && (
            <>
              <button
                type="button"
                onClick={handleTestRollBroadcast}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs border border-border bg-surface text-muted hover:text-accent hover:border-accent/50 transition-colors"
                title="Проверить отправку броска в общий канал кампании"
              >
                <Dices className="w-3.5 h-3.5" />
                к20
              </button>

              <button
                type="button"
                onClick={() => setImportModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-accent/15 text-accent border border-accent/40 hover:bg-accent/25 transition-colors"
              >
                <FileJson className="w-3.5 h-3.5" />
                Загрузить чарник (.json)
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => {
              setIframeKey((k) => k + 1);
              void onRefreshCache();
            }}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs border border-border bg-surface text-muted hover:text-text transition-colors"
            title="Перезагрузить iframe и обновить кэш D1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-primary' : ''}`} />
            Обновить
          </button>

          <a
            href={embedUrl}
            target="_blank"
            rel="noreferrer"
            className="p-1.5 rounded-xl border border-border text-muted hover:text-text"
            title="Открыть Long Story Short в новой вкладке"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      <div className="relative w-full h-[560px] bg-[#0b0b14]">
        <iframe
          key={`${profile.playerId}-${iframeKey}`}
          ref={iframeRef}
          src={embedUrl}
          sandbox={SHEET_IFRAME_SANDBOX}
          allow="clipboard-write"
          title={`Лист персонажа Long Story Short — Игрок ${profile.playerId}`}
          className="w-full h-full border-0 block"
        />

        {strictPointerLock && (
          <div className="absolute inset-0 bg-bg/20 backdrop-blur-[1px] flex items-end justify-center p-4 pointer-events-auto">
            <div className="glass-panel px-4 py-2 rounded-2xl text-xs text-muted flex items-center gap-3 border border-amber-500/30">
              <Lock className="w-4 h-4 text-amber-300 shrink-0" />
              <span>
                Режим строгого просмотра (лист защищён от случайного редактирования). Для прокрутки
                внутри LSS нажмите «Экран чтения».
              </span>
              <button
                type="button"
                onClick={() => setStrictPointerLock(false)}
                className="px-2.5 py-1 rounded-lg bg-primary/20 text-primary font-semibold hover:bg-primary/30 shrink-0"
              >
                Разблокировать прокрутку
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="px-4 py-2 bg-bg/60 border-t border-border text-[11px] text-muted flex flex-wrap items-center justify-between gap-2">
        <span>
          Связь только через <code className="text-primary">window.postMessage</code> (
          <code className="text-accent">@longstoryshort/vtt-sdk</code>) — без доступа к DOM iframe.
        </span>
        <span>
          Последняя синхронизация:{' '}
          {profile.lastSyncedAt ? new Date(profile.lastSyncedAt).toLocaleString('ru-RU') : 'не выполнялась'}
        </span>
      </div>

      {importModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel neon-border rounded-3xl max-w-xl w-full p-6 space-y-4">
            <div>
              <h3 className="font-anime font-bold text-lg">
                Загрузка чарника из Long Story Short
              </h3>
              <p className="text-xs text-muted mt-1">
                Экспортируйте своего персонажа в файл <code>.json</code> в Long Story Short (или в
                формате{' '}
                <a
                  href={LSS_SCHEMA_V1_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent underline"
                >
                  character.json v1
                </a>
                ) и загрузите ниже — имя, класс, раса, уровень, ХП, монеты и заметки автоматически
                сохранятся за вашим слотом.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs text-muted">
                Ссылка на embed-лист Long Story Short (необязательно):
              </label>
              <input
                type="url"
                value={embedUrlDraft}
                onChange={(e) => setEmbedUrlDraft(e.target.value)}
                placeholder="https://longstoryshort.app/iframe/characters/..."
                className="anime-input w-full text-xs"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="anime-btn-primary inline-flex items-center gap-2 px-4 py-2 text-xs cursor-pointer">
                <Upload className="w-4 h-4" />
                <span>Выбрать .json файл персонажа</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            <textarea
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
                disabled={
                  importing ||
                  (!jsonText.trim() &&
                    (!embedUrlDraft.trim() || embedUrlDraft.trim() === profile.lssEmbedUrl))
                }
                onClick={handleApplyJsonImport}
                className="anime-btn-primary px-4 py-2 text-xs"
              >
                {importing ? 'Сохранение...' : 'Сохранить чарник'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
