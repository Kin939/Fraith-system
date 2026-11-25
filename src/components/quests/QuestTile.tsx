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
    label: 'Активен',
    badgeClass: 'bg-primary/20 text-primary border-primary/40',
    icon: <Clock className="w-3 h-3" />,
  },
  available: {
    label: 'Доступен',
    badgeClass: 'bg-accent/20 text-accent border-accent/40',
    icon: <Compass className="w-3 h-3" />,
  },
  completed: {
    label: 'Завершён',
    badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  failed: {
    label: 'Провален',
    badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    icon: <XCircle className="w-3 h-3" />,
  },
};

export const QuestTile: React.FC<QuestTileProps> = ({ quest, selected, onSelect }) => {
  const pct = Math.min(
    100,
    Math.round((quest.progressCurrent / Math.max(1, quest.progressTarget)) * 100)
  );
  const statusInfo = STATUS_META[quest.status] ?? STATUS_META.active;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left p-4 rounded-3xl transition-all flex flex-col justify-between gap-3 ${
        selected
          ? 'glass-panel neon-border scale-[1.01]'
          : 'glass-panel hover:border-primary/50 opacity-90 hover:opacity-100'
      }`}
    >
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-anime font-bold text-base leading-snug line-clamp-2">
            {quest.title}
          </h3>
          <span
            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${statusInfo.badgeClass}`}
          >
            {statusInfo.icon}
            {statusInfo.label}
          </span>
        </div>

        <p className="text-xs text-muted line-clamp-2 leading-relaxed">{quest.shortDesc}</p>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-muted">Прогресс выполнения</span>
          <span className="font-anime font-bold text-text">
            {quest.progressCurrent} / {quest.progressTarget} ({pct}%)
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-bg/80 border border-border/80 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${pct}%`,
              background:
                quest.status === 'completed'
                  ? 'linear-gradient(90deg, #10b981, #34d399)'
                  : 'linear-gradient(90deg, var(--primary), var(--accent))',
            }}
          />
        </div>
      </div>
    </button>
  );
};
