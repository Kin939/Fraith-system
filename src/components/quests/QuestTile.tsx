import React from 'react';
import { AlertTriangle, CheckCircle2, Clock3, Sparkles, Star, XCircle } from 'lucide-react';
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
      className={`quest-tile group w-full text-left ${
        isCompact ? 'p-3' : isLarge ? 'p-5 sm:p-6' : 'p-4 sm:p-5'
      } flex flex-col justify-between ${
        isCompact ? 'gap-2.5' : 'gap-3.5'
      } cursor-pointer ${
        selected ? 'quest-tile--selected' : ''
      } ${important ? 'quest-tile--important' : ''}`}
    >
      {/* Decorative layers */}
      <span aria-hidden className="quest-tile__rail" />
      {pattern !== 'none' && (
        <span aria-hidden className={`quest-tile__pattern quest-pattern--${pattern}`} />
      )}

      {/* Header */}
      <div className="relative z-10 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2.5 min-w-0">
            {coverUrl ? (
              <span
                className={`relative shrink-0 overflow-hidden hud-cut-sm border border-border/80 mt-0.5 ${
                  isCompact ? 'w-7 h-7' : isLarge ? 'w-11 h-11' : 'w-9 h-9'
                }`}
              >
                <img
                  src={coverUrl}
                  alt=""
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
              </span>
            ) : emblem ? (
              <img
                src={emblem}
                alt=""
                draggable={false}
                className={`quest-tile__emblem object-contain shrink-0 mt-0.5 ${
                  isCompact ? 'w-6 h-6' : isLarge ? 'w-9 h-9' : 'w-7 h-7'
                }`}
              />
            ) : null}

            <div className="min-w-0">
              <h3
                className={`font-medium text-text leading-snug ${
                  isCompact ? 'text-sm line-clamp-2' : isLarge ? 'text-base sm:text-lg line-clamp-3' : 'text-base line-clamp-2'
                }`}
              >
                {quest.title}
              </h3>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
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
                {quest.status === 'active' && quest.progressTarget > 0 && ratio < 0.34 && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-muted border border-border/80">
                    <AlertTriangle className="w-2.5 h-2.5" strokeWidth={1.8} />
                    <span>риск</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {canToggleImportant && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleImportant?.(quest);
              }}
              className={`p-1 transition-colors shrink-0 ${
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

        {!hideDescription && (
          <p
            className={`text-secondary leading-relaxed ${
              isLarge ? 'text-xs sm:text-sm line-clamp-3' : 'text-xs line-clamp-2'
            }`}
          >
            {quest.shortDesc}
          </p>
        )}
      </div>

      {/* Segmented progress */}
      <div className="relative z-10 space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-muted inline-flex items-center gap-1">
            {statusInfo.icon}
            <span>Прогресс</span>
          </span>
          <span className="font-mono text-secondary tabular-nums">
            {quest.progressCurrent} / {quest.progressTarget}
          </span>
        </div>

        <div
          className="grid gap-1"
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
      </div>

      {/* DM quick style entry */}
      {onEditStyle && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEditStyle(quest);
          }}
          className="absolute bottom-2 right-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity h-6 px-2 text-[10px] bg-surface/90 border border-border text-secondary hover:text-text inline-flex items-center gap-1"
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
