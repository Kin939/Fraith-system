import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  MessageSquare,
  Sparkles,
  Star,
  XCircle,
} from 'lucide-react';
import { resolveImageUrl } from '../../lib/artwork';
import { questEmblemUrl, questTileCssVars, resolveQuestAccent } from '../../lib/questStyle';
import type { TileSize } from '../../lib/tileSize';
import type { Quest, QuestStatus } from '../../lib/types';

interface QuestTileProps {
  quest: Quest;
  selected: boolean;
  onSelect: () => void;
  /** DM-only: renders the quick "important" star toggle */
  canToggleImportant?: boolean;
  onToggleImportant?: (quest: Quest) => void;
  onEditStyle?: (quest: Quest) => void;
  /** Legacy shorthand — equals size="compact" */
  compact?: boolean;
  /** Tile density from the shared S/M/L/XL switch */
  size?: TileSize;
}

const STATUS_META: Record<
  QuestStatus,
  { label: string; dotClass: string; icon: React.ReactNode }
> = {
  active: {
    label: 'Активен',
    dotClass: 'bg-primary',
    icon: <Clock3 className="w-3 h-3" strokeWidth={1.6} />,
  },
  available: {
    label: 'Доступен',
    dotClass: 'bg-secondary',
    icon: <Sparkles className="w-3 h-3" strokeWidth={1.6} />,
  },
  completed: {
    label: 'Завершён',
    dotClass: 'bg-positive',
    icon: <CheckCircle2 className="w-3 h-3" strokeWidth={1.6} />,
  },
  failed: {
    label: 'Провален',
    dotClass: 'bg-negative',
    icon: <XCircle className="w-3 h-3" strokeWidth={1.6} />,
  },
};

/** Wide, horizontal card geometry — quest tiles are rectangles, never squares. */
const MEDIA_WIDTH: Record<TileSize, string> = {
  compact: 'w-[68px]',
  normal: 'w-[92px]',
  large: 'w-[112px]',
  huge: 'w-[136px]',
};

const TILE_MIN_HEIGHT: Record<TileSize, string> = {
  compact: 'min-h-[76px]',
  normal: 'min-h-[98px]',
  large: 'min-h-[118px]',
  huge: 'min-h-[142px]',
};

const TILE_PADDING: Record<TileSize, string> = {
  compact: 'p-2.5 sm:p-3',
  normal: 'p-3 sm:p-3.5',
  large: 'p-4 sm:p-4',
  huge: 'p-4 sm:p-5',
};

export const QuestTile: React.FC<QuestTileProps> = ({
  quest,
  selected,
  onSelect,
  canToggleImportant = false,
  onToggleImportant,
  onEditStyle,
  compact = false,
  size,
}) => {
  const tileSize: TileSize = size ?? (compact ? 'compact' : 'normal');
  const isCompact = tileSize === 'compact';
  const isLarge = tileSize === 'large' || tileSize === 'huge';
  const hideDescription = isCompact;

  const ratio = Math.min(1, Math.max(0, quest.progressCurrent / Math.max(1, quest.progressTarget)));
  const segmentCount = quest.progressTarget === 5 ? 5 : 10;
  const filledSegments = Math.round(ratio * segmentCount);
  const statusInfo = STATUS_META[quest.status] ?? STATUS_META.active;
  const accent = resolveQuestAccent(quest);
  const emblem = questEmblemUrl(quest.tileStyle?.emblem);
  const pattern = quest.tileStyle?.pattern ?? 'none';
  const important = Boolean(quest.tileStyle?.isImportant);
  const coverUrl = quest.imageKey ? resolveImageUrl(quest.imageKey, 'blades') : null;
  const notesCount = Math.max(0, quest.notesCount ?? 0);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      style={questTileCssVars(quest)}
      className={`quest-tile group flex w-full items-stretch text-left ${TILE_MIN_HEIGHT[tileSize]} ${
        selected ? 'quest-tile--selected' : ''
      } ${important ? 'quest-tile--important' : ''} cursor-pointer`}
    >
      {/* Decorative layers */}
      <span aria-hidden className="quest-tile__rail" />
      {pattern !== 'none' && (
        <span aria-hidden className={`quest-tile__pattern quest-pattern--${pattern}`} />
      )}

      {/* Left media plate keeps the card rectangular & wide */}
      <div
        className={`relative z-10 ml-[2px] shrink-0 self-stretch overflow-hidden border-r border-border/70 bg-deep/70 ${MEDIA_WIDTH[tileSize]}`}
      >
        {coverUrl ? (
          <img
            src={coverUrl}
            alt=""
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            {emblem ? (
              <img
                src={emblem}
                alt=""
                draggable={false}
                className={`quest-tile__emblem object-contain opacity-90 ${
                  isCompact ? 'w-6 h-6' : isLarge ? 'w-9 h-9' : 'w-7 h-7'
                }`}
              />
            ) : (
              <span className="text-muted opacity-70">{statusInfo.icon}</span>
            )}
          </div>
        )}
        <span
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/45 to-transparent pointer-events-none"
        />
      </div>

      {/* Content */}
      <div
        className={`relative z-10 flex min-w-0 flex-1 flex-col justify-between ${
          isCompact ? 'gap-2' : 'gap-2.5'
        } ${TILE_PADDING[tileSize]}`}
      >
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3
              className={`min-w-0 font-medium text-text leading-snug ${
                isCompact
                  ? 'text-sm line-clamp-1'
                  : isLarge
                    ? 'text-base line-clamp-2'
                    : 'text-[15px] line-clamp-1'
              }`}
            >
              {quest.title}
            </h3>

            {canToggleImportant && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleImportant?.(quest);
                }}
                className={`p-0.5 transition-colors shrink-0 ${
                  important ? 'text-[var(--q-accent)]' : 'text-muted hover:text-text'
                }`}
                title={important ? 'Снять отметку важного' : 'Отметить важным квестом'}
              >
                <Star
                  className="w-4 h-4"
                  strokeWidth={1.6}
                  fill={important ? 'currentColor' : 'none'}
                />
              </button>
            )}
          </div>

          <div className="flex items-center gap-[7px] flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-[11px] text-secondary">
              <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotClass}`} />
              <span>{statusInfo.label}</span>
            </span>
            {important && (
              <span className="quest-tile__badge inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium tracking-wide">
                <Star className="w-2.5 h-2.5" strokeWidth={2} fill="currentColor" />
                <span>ВАЖНО</span>
              </span>
            )}
            {!isCompact &&
              quest.status === 'active' &&
              quest.progressTarget > 0 &&
              ratio < 0.34 && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-muted border border-border/80">
                  <AlertTriangle className="w-2.5 h-2.5" strokeWidth={1.8} />
                  <span>риск</span>
                </span>
              )}
            {notesCount > 0 && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-secondary border border-border/80"
                title={`Заметок отряда: ${notesCount}`}
              >
                <MessageSquare className="w-2.5 h-2.5" strokeWidth={1.8} />
                <span className="font-mono tabular-nums">{notesCount}</span>
              </span>
            )}
          </div>

          {!hideDescription && (
            <p
              className={`text-secondary leading-relaxed ${
                isLarge ? 'text-xs sm:text-[13px] line-clamp-2' : 'text-xs line-clamp-1'
              }`}
            >
              {quest.shortDesc}
            </p>
          )}
        </div>

        {/* Segmented progress, laid out horizontally to keep the card wide */}
        <div className="flex items-center gap-3">
          <div
            className="grid gap-1 flex-1 min-w-0"
            style={{ gridTemplateColumns: `repeat(${segmentCount}, minmax(0, 1fr))` }}
            aria-label={`Прогресс ${quest.progressCurrent} из ${quest.progressTarget}`}
          >
            {Array.from({ length: segmentCount }, (_, idx) => {
              const lit = idx < filledSegments;
              return (
                <span
                  key={idx}
                  className={`h-1.5 ${lit ? 'quest-tile__progress-lit' : 'bg-deep'}`}
                />
              );
            })}
          </div>
          <span className="font-mono text-[11px] text-secondary tabular-nums shrink-0">
            {quest.progressCurrent}/{quest.progressTarget}
          </span>
        </div>
      </div>

      {/* DM quick style entry */}
      {onEditStyle && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEditStyle(quest);
          }}
          className="absolute bottom-1.5 right-1.5 z-20 opacity-0 group-hover:opacity-100 transition-opacity h-6 px-2 text-[10px] bg-surface/90 border border-border text-secondary hover:text-text inline-flex items-center gap-1"
          title="Настроить оформление плитки"
        >
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: accent }}
            aria-hidden
          />
          <span>Оформление</span>
        </button>
      )}
    </div>
  );
};
