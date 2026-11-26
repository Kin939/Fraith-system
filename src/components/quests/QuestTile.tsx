import React from 'react';
import type { Quest, QuestStatus } from '../../lib/types';

interface QuestTileProps {
  quest: Quest;
  selected: boolean;
  onSelect: () => void;
}

const STATUS_META: Record<QuestStatus, { label: string; dotClass: string }> = {
  active: {
    label: 'Активен',
    dotClass: 'bg-primary',
  },
  available: {
    label: 'Доступен',
    dotClass: 'bg-secondary',
  },
  completed: {
    label: 'Завершён',
    dotClass: 'bg-positive',
  },
  failed: {
    label: 'Провален',
    dotClass: 'bg-negative',
  },
};

export const QuestTile: React.FC<QuestTileProps> = ({ quest, selected, onSelect }) => {
  const ratio = Math.min(1, Math.max(0, quest.progressCurrent / Math.max(1, quest.progressTarget)));
  const segmentCount = quest.progressTarget === 5 ? 5 : 10;
  const filledSegments = Math.round(ratio * segmentCount);
  const statusInfo = STATUS_META[quest.status] ?? STATUS_META.active;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left p-5 hud-cut flex flex-col justify-between gap-4 rim-card ${
        selected ? 'rim-card--active' : ''
      }`}
    >
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-medium text-base text-text leading-snug line-clamp-2">
            {quest.title}
          </h3>

          <span className="inline-flex items-center gap-1.5 text-xs text-secondary shrink-0 mt-0.5">
            <span className={`w-2 h-2 rounded-full ${statusInfo.dotClass}`} />
            <span>{statusInfo.label}</span>
          </span>
        </div>

        <p className="text-xs text-secondary line-clamp-2 leading-relaxed">{quest.shortDesc}</p>
      </div>

      {/* Segmented Progress Scale */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted">Прогресс</span>
          <span className="font-mono text-secondary tabular-nums">
            {quest.progressCurrent} из {quest.progressTarget}
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
                className={`h-1.5 transition-colors ${
                  lit
                    ? quest.status === 'completed'
                      ? 'bg-positive'
                      : 'bg-primary'
                    : 'bg-deep'
                }`}
              />
            );
          })}
        </div>
      </div>
    </button>
  );
};
