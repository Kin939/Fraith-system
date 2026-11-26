import React from 'react';
import { CheckCircle2, Clock, Compass, XCircle } from 'lucide-react';
import type { Quest, QuestStatus } from '../../lib/types';

interface QuestTileProps {
  quest: Quest;
  selected: boolean;
  onSelect: () => void;
}

const STATUS_META: Record<
  QuestStatus,
  { label: string; badgeClass: string; icon: React.ReactNode }
> = {
  active: {
    label: 'ACTIVE',
    badgeClass: 'bg-primary/15 text-primary border-primary/50',
    icon: <Clock className="w-3 h-3" />,
  },
  available: {
    label: 'AVAILABLE',
    badgeClass: 'bg-accent/20 text-text border-accent/60',
    icon: <Compass className="w-3 h-3" />,
  },
  completed: {
    label: 'COMPLETE',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/50',
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  failed: {
    label: 'FAILED',
    badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/50',
    icon: <XCircle className="w-3 h-3" />,
  },
};

export const QuestTile: React.FC<QuestTileProps> = ({ quest, selected, onSelect }) => {
  const ratio = Math.min(1, Math.max(0, quest.progressCurrent / Math.max(1, quest.progressTarget)));
  const pct = Math.round(ratio * 100);
  const segmentCount = quest.progressTarget === 5 ? 5 : 10;
  const filledSegments = Math.round(ratio * segmentCount);
  const statusInfo = STATUS_META[quest.status] ?? STATUS_META.active;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left p-4 hud-cut hud-corners flex flex-col justify-between gap-3.5 rim-card ${
        selected ? 'rim-card--active' : 'opacity-90 hover:opacity-100'
      }`}
    >
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary/85">
              Q-{String(quest.id).padStart(2, '0')} // DIRECTIVE
            </div>
            <h3 className="font-anime font-bold text-base uppercase tracking-wide leading-snug line-clamp-2 mt-0.5">
              {quest.title}
            </h3>
          </div>

          <span
            className={`inline-flex items-center gap-1 font-mono text-[10px] font-bold px-2 py-0.5 border shrink-0 ${statusInfo.badgeClass}`}
          >
            {statusInfo.icon}
            {statusInfo.label}
          </span>
        </div>

        <p className="text-xs text-muted line-clamp-2 leading-relaxed">{quest.shortDesc}</p>
      </div>

      {/* Segmented Tactical Progress Scale (1/10 or 1/5 segments) */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between font-mono text-[11px] tabular-nums">
          <span className="text-muted uppercase tracking-wider">PROGRESS</span>
          <span className="font-bold text-text">
            {quest.progressCurrent}/{quest.progressTarget}{' '}
            <span className="text-primary">[{pct}%]</span>
          </span>
        </div>

        <div
          className="grid gap-1"
          style={{ gridTemplateColumns: `repeat(${segmentCount}, minmax(0, 1fr))` }}
          aria-label={`Прогресс ${pct}%`}
        >
          {Array.from({ length: segmentCount }, (_, idx) => {
            const lit = idx < filledSegments;
            return (
              <span
                key={idx}
                className={`h-2 border transition-all duration-200 ${
                  lit
                    ? quest.status === 'completed'
                      ? 'bg-emerald-400 border-emerald-300 shadow-[0_0_8px_rgba(52,211,153,0.6)]'
                      : 'bg-primary border-primary shadow-[0_0_8px_var(--glow)]'
                    : 'bg-[#070B14]/90 border-primary/25'
                }`}
              />
            );
          })}
        </div>
      </div>
    </button>
  );
};
