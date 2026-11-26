import React from 'react';
import { Minus, Plus, Skull } from 'lucide-react';
import { EXHAUSTION_EFFECTS, MAX_EXHAUSTION, exhaustionSummary } from '../../lib/combatProtocol';

interface ExhaustionTrackerProps {
  level: number;
  canEdit: boolean;
  onChange?: (level: number) => void;
  compact?: boolean;
}

/**
 * Истощение 0–6 по правилам 5e: уровни суммируются, на 6-м персонаж погибает.
 * Хранится отдельным эффектом `effect_type = 'exhaustion'`.
 */
export const ExhaustionTracker: React.FC<ExhaustionTrackerProps> = ({ level, canEdit, onChange, compact = false }) => {
  const clamped = Math.max(0, Math.min(MAX_EXHAUSTION, level));
  const active = exhaustionSummary(clamped);

  if (compact) {
    if (clamped === 0) return null;
    return (
      <span
        className="inline-flex items-center gap-1.5 h-6 px-2 border border-negative/60 bg-negative/10 text-[11px] text-negative leading-none"
        title={active.join('\n')}
      >
        <Skull className="w-3 h-3" strokeWidth={1.75} /> истощение {clamped}
      </span>
    );
  }

  return (
    <div className="px-3 py-2.5 border border-border bg-deep/50">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-mono uppercase tracking-wide text-secondary flex items-center gap-1.5">
          <Skull className="w-4 h-4 text-negative" strokeWidth={1.75} /> Истощение
        </span>
        <div className="flex items-center gap-1.5">
          {canEdit && (
            <button
              type="button"
              onClick={() => onChange?.(Math.max(0, clamped - 1))}
              disabled={clamped <= 0}
              className="w-8 h-8 flex items-center justify-center border border-border text-secondary hover:text-text hover:border-primary/50 disabled:opacity-30"
              title="Снять уровень"
            >
              <Minus className="w-4 h-4" strokeWidth={2} />
            </button>
          )}
          <span className="w-8 text-center font-mono text-base text-negative tabular-nums">{clamped}</span>
          {canEdit && (
            <button
              type="button"
              onClick={() => onChange?.(Math.min(MAX_EXHAUSTION, clamped + 1))}
              disabled={clamped >= MAX_EXHAUSTION}
              className="w-8 h-8 flex items-center justify-center border border-border text-secondary hover:text-text hover:border-primary/50 disabled:opacity-30"
              title="Добавить уровень"
            >
              <Plus className="w-4 h-4" strokeWidth={2} />
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 mt-2">
        {EXHAUSTION_EFFECTS.map((entry) => (
          <span
            key={entry.level}
            title={`Ур. ${entry.level}: ${entry.summary}`}
            className={`h-1.5 flex-1 ${entry.level <= clamped ? 'bg-negative' : 'bg-raised'}`}
          />
        ))}
      </div>

      {active.length > 0 && (
        <ul className="mt-2 space-y-1">
          {active.map((line) => (
            <li key={line} className="text-[11px] text-secondary leading-snug">
              {line}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
