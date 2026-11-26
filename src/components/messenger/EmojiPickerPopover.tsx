import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Clock, Plus, Search, Sparkles, Trash2, Upload, X } from 'lucide-react';
import { apiFetch, uploadCustomCampaignEmoji } from '../../lib/api';
import {
  EmojiPackCategoryId,
  getEmojiBlobUrl,
  resolveEmojiVisual,
  useEmojiPack,
} from '../../lib/emojiPack';
import { useCampaignStore } from '../../lib/store';
import type { CustomCampaignEmoji } from '../../lib/types';
import { CustomEmojiGlyph } from './CustomEmoji';

export const QUICK_REACTION_EMOJIS = [
  ':nat20:',
  ':nat1:',
  '🔥',
  '😂',
  '👍',
  '❤️',
  ':tavern:',
  '👀',
];

type PickerTabId = 'recent' | 'custom' | EmojiPackCategoryId;

const RECENT_STORAGE_KEY = 'fraith_recent_emojis_v2';

const CATEGORY_TABS: Array<{
  id: PickerTabId;
  label: string;
  sampleToken: string;
}> = [
  { id: 'dnd', label: 'Гильдия D&D', sampleToken: ':nat20:' },
  { id: 'custom', label: 'Свои', sampleToken: ':mimic:' },
  { id: 'smileys', label: 'Эмоции', sampleToken: '😂' },
  { id: 'gestures', label: 'Жесты и герои', sampleToken: '🧙' },
  { id: 'animals', label: 'Звери и стихии', sampleToken: '🐉' },
  { id: 'food', label: 'Таверна и еда', sampleToken: '🍺' },
  { id: 'activities', label: 'Игры и бой', sampleToken: '🎲' },
  { id: 'objects', label: 'Предметы', sampleToken: '📜' },
  { id: 'symbols', label: 'Сердца и знаки', sampleToken: '❤️' },
];

const DEFAULT_RECENT_TOKENS = [
  ':nat20:',
  ':nat1:',
  ':tavern:',
  ':loot:',
  ':fireball:',
  ':mimic:',
  '😂',
  '🔥',
  '👍',
  '❤️',
  '🎲',
  '😎',
  '💀',
  '🥳',
  '👀',
  '✅',
];

function loadRecentEmojis(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_STORAGE_KEY);
    if (!raw) return DEFAULT_RECENT_TOKENS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.filter((x): x is string => typeof x === 'string').slice(0, 24);
    }
  } catch {
    // ignore storage errors
  }
  return DEFAULT_RECENT_TOKENS;
}

export function recordRecentEmoji(token: string): void {
  try {
    const current = loadRecentEmojis().filter((e) => e !== token);
    const updated = [token, ...current].slice(0, 24);
    localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // ignore storage errors
  }
}

interface DisplayEmojiEntry {
  key: string;
  token: string;
  label: string;
  url: string;
  isLargeBadge?: boolean;
  customId?: number;
  creatorId?: number;
}

interface EmojiPickerPopoverProps {
  onSelect: (emojiToken: string) => void;
  onClose: () => void;
  align?: 'left' | 'right';
  compact?: boolean;
}

export const EmojiPickerPopover: React.FC<EmojiPickerPopoverProps> = ({
  onSelect,
  onClose,
  align = 'right',
  compact = false,
}) => {
  const { ready, items: packItems, byCategory } = useEmojiPack();
  const user = useCampaignStore((s) => s.user);
  const customEmojis = useCampaignStore((s) => s.customEmojis);
  const setCustomEmojis = useCampaignStore((s) => s.setCustomEmojis);
  const pushToast = useCampaignStore((s) => s.pushToast);

  const [activeTab, setActiveTab] = useState<PickerTabId>('smileys');
  const [search, setSearch] = useState('');
  const [recents, setRecents] = useState<string[]>(() => loadRecentEmojis());
  const [visibleLimit, setVisibleLimit] = useState(144);
  const [hoveredItem, setHoveredItem] = useState<DisplayEmojiEntry | null>(null);

  // Custom emoji upload state
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadingCustom, setUploadingCustom] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const customFileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setVisibleLimit(144);
  }, [activeTab, search]);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  const displayedEntries = useMemo<DisplayEmojiEntry[]>(() => {
    const q = search.trim().toLowerCase();

    if (q) {
      const matches: DisplayEmojiEntry[] = [];
      for (const ce of customEmojis) {
        if (
          ce.name.toLowerCase().includes(q) ||
          ce.code.toLowerCase().includes(q) ||
          ce.token.toLowerCase().includes(q)
        ) {
          matches.push({
            key: `ce-${ce.id}`,
            token: ce.token,
            label: ce.name,
            url: ce.imageUrl,
            isLargeBadge: true,
            customId: ce.id,
            creatorId: ce.creatorId,
          });
        }
      }
      for (const item of packItems) {
        if (item.keywords.includes(q) || item.token.includes(q)) {
          matches.push({
            key: item.id,
            token: item.token,
            label: item.label,
            url: getEmojiBlobUrl(item),
            isLargeBadge: item.category === 'dnd',
          });
        }
      }
      return matches;
    }

    if (activeTab === 'recent') {
      const out: DisplayEmojiEntry[] = [];
      for (const tok of recents) {
        const vis = resolveEmojiVisual(tok, customEmojis);
        if (vis) {
          out.push({
            key: `rec-${tok}`,
            token: vis.token,
            label: vis.label,
            url: vis.url,
            isLargeBadge: vis.isCustomBadge,
          });
        }
      }
      return out;
    }

    if (activeTab === 'custom') {
      return customEmojis.map((ce) => ({
        key: `ce-${ce.id}`,
        token: ce.token,
        label: ce.name,
        url: ce.imageUrl,
        isLargeBadge: true,
        customId: ce.id,
        creatorId: ce.creatorId,
      }));
    }

    const catItems = byCategory.get(activeTab) ?? [];
    return catItems.map((item) => ({
      key: item.id,
      token: item.token,
      label: item.label,
      url: getEmojiBlobUrl(item),
      isLargeBadge: item.category === 'dnd',
    }));
  }, [activeTab, byCategory, customEmojis, packItems, recents, search]);

  const slicedEntries = useMemo(
    () => displayedEntries.slice(0, visibleLimit),
    [displayedEntries, visibleLimit]
  );

  const handleGridScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (
      visibleLimit < displayedEntries.length &&
      el.scrollHeight - el.scrollTop - el.clientHeight < 120
    ) {
      setVisibleLimit((cur) => Math.min(displayedEntries.length, cur + 144));
    }
  };

  const handlePick = (token: string) => {
    recordRecentEmoji(token);
    setRecents(loadRecentEmojis());
    onSelect(token);
  };

  const handleUploadCustomEmoji = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile || uploadingCustom) return;

    setUploadingCustom(true);
    try {
      const res = await uploadCustomCampaignEmoji(
        uploadFile,
        uploadName.trim() || uploadFile.name.replace(/\.[^.]+$/, '')
      );
      setCustomEmojis(res.customEmojis);
      setUploadFile(null);
      setUploadName('');
      setShowUploadForm(false);
      pushToast({
        title: 'Кастомный эмодзи добавлен',
        message: `Теперь доступен всей группе как ${res.emoji.token}`,
        variant: 'success',
      });
    } catch (err) {
      pushToast({
        title: 'Не удалось загрузить эмодзи',
        message: err instanceof Error ? err.message : 'Попробуйте другой файл',
        variant: 'error',
      });
    } finally {
      setUploadingCustom(false);
    }
  };

  const handleDeleteCustomEmoji = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Удалить этот кастомный эмодзи кампании?')) return;
    try {
      const res = await apiFetch<{ ok: boolean; customEmojis: CustomCampaignEmoji[] }>(
        `/api/chat/emojis/${id}`,
        { method: 'DELETE' }
      );
      setCustomEmojis(res.customEmojis);
    } catch (err) {
      pushToast({
        title: 'Ошибка удаления',
        message: err instanceof Error ? err.message : 'Попробуйте снова',
        variant: 'error',
      });
    }
  };

  const activeCategoryLabel = search.trim()
    ? `Найдено: ${displayedEntries.length}`
    : activeTab === 'recent'
      ? 'Недавние'
      : CATEGORY_TABS.find((t) => t.id === activeTab)?.label ?? 'Эмодзи';

  const isStickerGrid = !search.trim() && (activeTab === 'dnd' || activeTab === 'custom');

  return (
    <div
      ref={containerRef}
      className={`absolute bottom-full mb-2 ${
        align === 'right' ? 'right-0' : 'left-0'
      } z-40 ${
        compact ? 'w-[332px] sm:w-[368px]' : 'w-[340px] sm:w-[420px]'
      } bg-surface border border-border hud-cut-sm shadow-glass flex flex-col overflow-hidden`}
    >
      {/* Top Search & Category Strip */}
      <div className="p-2.5 border-b border-border space-y-2 bg-deep">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-text">
            <Sparkles className="w-3.5 h-3.5 text-primary" strokeWidth={1.5} />
            <span>Эмодзи и паки кампании</span>
            {ready && (
              <span className="font-mono text-[10px] text-muted tabular-nums">
                {packItems.length + customEmojis.length}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-text p-0.5 transition-colors"
            title="Закрыть"
          >
            <X className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search
            className="w-3.5 h-3.5 text-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
            strokeWidth={1.5}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по 1500+ эмодзи (крит, смех, дракон, пиво…)"
            className="anime-input w-full pl-8 pr-7 py-1.5 text-xs"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-text"
            >
              <X className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
          )}
        </div>

        {/* Category Icon Tabs */}
        {!search.trim() && (
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
            <button
              type="button"
              onClick={() => setActiveTab('recent')}
              title="Недавние"
              className={`h-8 w-8 flex items-center justify-center border transition-colors shrink-0 ${
                activeTab === 'recent'
                  ? 'bg-raised border-primary text-primary'
                  : 'bg-surface border-border text-muted hover:text-text'
              }`}
            >
              <Clock className="w-4 h-4" strokeWidth={1.5} />
            </button>
            {CATEGORY_TABS.map((cat) => {
              const active = activeTab === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveTab(cat.id)}
                  title={cat.label}
                  className={`h-8 px-2 flex items-center justify-center gap-1.5 border transition-colors shrink-0 ${
                    active
                      ? 'bg-raised border-primary text-text font-medium'
                      : 'bg-surface border-border text-secondary hover:text-text'
                  }`}
                >
                  <CustomEmojiGlyph token={cat.sampleToken} sizeClass="w-4 h-4" />
                  {(cat.id === 'dnd' || cat.id === 'custom') && !compact && (
                    <span className="text-[11px] whitespace-nowrap">
                      {cat.id === 'dnd' ? 'D&D' : `Свои (${customEmojis.length})`}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Category Subheader + Custom Upload Button */}
      <div className="px-3 py-1.5 bg-surface border-b border-border/60 flex items-center justify-between gap-2 text-[11px] text-secondary">
        <span className="font-medium">{activeCategoryLabel}</span>
        {activeTab === 'custom' && !search.trim() ? (
          <button
            type="button"
            onClick={() => setShowUploadForm((v) => !v)}
            className="text-primary hover:underline inline-flex items-center gap-1 font-medium"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>Добавить свой эмодзи</span>
          </button>
        ) : (
          <span className="text-muted font-mono tabular-nums">
            {displayedEntries.length} шт.
          </span>
        )}
      </div>

      {/* Inline Custom Emoji Uploader */}
      {activeTab === 'custom' && showUploadForm && !search.trim() && (
        <form
          onSubmit={handleUploadCustomEmoji}
          className="p-2.5 bg-deep border-b border-border space-y-2"
        >
          <input
            ref={customFileRef}
            type="file"
            accept="image/png,image/webp,image/gif,image/jpeg"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setUploadFile(f);
              if (f && !uploadName.trim()) {
                setUploadName(f.name.replace(/\.[^.]+$/, '').slice(0, 24));
              }
            }}
            className="hidden"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => customFileRef.current?.click()}
              className="anime-btn-secondary h-8 px-2.5 text-xs inline-flex items-center gap-1.5 shrink-0"
            >
              <Upload className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>{uploadFile ? 'Заменить' : 'Выбрать картинку / GIF'}</span>
            </button>
            <input
              type="text"
              value={uploadName}
              onChange={(e) => setUploadName(e.target.value)}
              placeholder="Название (напр. Пепе, Крит)"
              className="anime-input flex-1 h-8 px-2.5 text-xs"
            />
          </div>
          {uploadFile && (
            <div className="flex items-center justify-between gap-2 text-[11px] text-muted">
              <span className="truncate">{uploadFile.name}</span>
              <button
                type="submit"
                disabled={uploadingCustom}
                className="anime-btn-primary h-7 px-3 text-xs shrink-0"
              >
                {uploadingCustom ? 'Сохранение…' : 'Сохранить в пак'}
              </button>
            </div>
          )}
        </form>
      )}

      {/* Emoji / Sticker Grid */}
      <div
        onScroll={handleGridScroll}
        className={`p-2 max-h-64 overflow-y-auto grid ${
          isStickerGrid ? 'grid-cols-6 gap-1.5' : 'grid-cols-8 sm:grid-cols-9 gap-1'
        }`}
      >
        {!ready && packItems.length === 0 ? (
          <div className="col-span-full py-10 text-center text-xs text-muted">
            Загрузка паков эмодзи…
          </div>
        ) : slicedEntries.length === 0 ? (
          <div className="col-span-full py-8 text-center space-y-2 px-4">
            <div className="text-xs text-secondary">
              {activeTab === 'custom' && !search.trim()
                ? 'У вашей кампании пока нет загруженных своих эмодзи'
                : 'По этому запросу эмодзи не найдены'}
            </div>
            {activeTab === 'custom' && !search.trim() && !showUploadForm && (
              <button
                type="button"
                onClick={() => setShowUploadForm(true)}
                className="anime-btn-primary h-8 px-3 text-xs inline-flex items-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" strokeWidth={1.5} />
                <span>Загрузить первый эмодзи (PNG / GIF / WEBP)</span>
              </button>
            )}
          </div>
        ) : (
          slicedEntries.map((entry) => {
            const canDeleteCustom =
              entry.customId !== undefined &&
              Boolean(user && (user.role === 'dm' || user.id === entry.creatorId));

            return (
              <div key={entry.key} className="relative group/emo">
                <button
                  type="button"
                  onMouseEnter={() => setHoveredItem(entry)}
                  onClick={() => handlePick(entry.token)}
                  title={`${entry.label} (${entry.token})`}
                  className={`w-full ${
                    isStickerGrid ? 'h-12' : 'h-9'
                  } flex items-center justify-center hover:bg-raised border border-transparent hover:border-border transition-all rounded-sm`}
                >
                  <img
                    src={entry.url}
                    alt={entry.token}
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                    className={`${
                      isStickerGrid || entry.isLargeBadge ? 'w-8 h-8' : 'w-6 h-6'
                    } object-contain select-none group-hover/emo:scale-110 transition-transform`}
                  />
                </button>
                {canDeleteCustom && entry.customId !== undefined && (
                  <button
                    type="button"
                    onClick={(e) => handleDeleteCustomEmoji(entry.customId!, e)}
                    title="Удалить эмодзи"
                    className="hidden group-hover/emo:flex absolute -top-1 -right-1 w-4 h-4 bg-deep border border-border text-muted hover:text-negative items-center justify-center"
                  >
                    <Trash2 className="w-2.5 h-2.5" strokeWidth={1.5} />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Discord-style Preview Footer */}
      <div className="h-10 px-3 bg-deep border-t border-border flex items-center justify-between gap-2 shrink-0">
        {hoveredItem ? (
          <>
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src={hoveredItem.url}
                alt={hoveredItem.token}
                className="w-6 h-6 object-contain shrink-0"
              />
              <span className="text-xs font-medium text-text truncate capitalize">
                {hoveredItem.label}
              </span>
            </div>
            <span className="text-[11px] font-mono text-muted shrink-0">
              {hoveredItem.token}
            </span>
          </>
        ) : (
          <span className="text-[11px] text-muted">
            Наведите на эмодзи для просмотра · Нажмите для вставки
          </span>
        )}
      </div>
    </div>
  );
};
