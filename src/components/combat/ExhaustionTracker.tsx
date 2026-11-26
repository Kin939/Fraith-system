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
 * Истощение 0–6 по правилам 5e. Уровни суммируются (не стакаются как прочие
 * эффекты), на 6-м уровне персонаж погибает. Хранится отдельным эффектом
 * `effect_type = 'exhaustion'`, поэтому виден игрокам вместе с остальными
 * видимыми состояниями.
 */
export const ExhaustionTracker: React.FC<ExhaustionTrackerProps> = ({ level, canEdit, onChange, compact = false }) => {
  const clamped = Math.max(0, Math.min(MAX_EXHAUSTION, level));
  const active = exhaustionSummary(clamped);

  if (compact && !canEdit) {
    if (clamped === 0) return null;
    return (
      <span
        className="inline-flex items-center gap-1 h-5 px-1.5 border border-negative/60 bg-negative/10 text-[10px] text-negative"
        title={active.join('\n')}
      >
        <Skull className="w-2.5 h-2.5" strokeWidth={1.75} /> истощение {clamped}
      </span>
    );
  }

  return (
    <div className="mt-1.5 px-2 py-1.5 border border-border bg-deep/50">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-mono uppercase tracking-wide text-muted flex items-center gap-1">
          <Skull className="w-3 h-3 text-negative" strokeWidth={1.75} /> Истощение
        </span>
        <div className="flex items-center gap-1">
          {canEdit && (
            <button
              type="button"
              onClick={() => onChange?.(Math.max(0, clamped - 1))}
              disabled={clamped <= 0}
              className="w-5 h-5 flex items-center justify-center border border-border text-muted hover:text-text disabled:opacity-30"
              title="Снять уровень"
            >
              <Minus className="w-2.5 h-2.5" strokeWidth={2} />
            </button>
          )}
          <span className="w-5 text-center font-mono text-[11px] text-negative tabular-nums">{clamped}</span>
          {canEdit && (
            <button
              type="button"
              onClick={() => onChange?.(Math.min(MAX_EXHAUSTION, clamped + 1))}
              disabled={clamped >= MAX_EXHAUSTION}
              className="w-5 h-5 flex items-center justify-center border border-border text-muted hover:text-text disabled:opacity-30"
              title="Добавить уровень"
            >
              <Plus className="w-2.5 h-2.5" strokeWidth={2} />
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-0.5 mt-1">
        {EXHAUSTION_EFFECTS.map((entry) => (
          <span
            key={entry.level}
            title={`Ур. ${entry.level}: ${entry.summary}`}
            className={`h-1 flex-1 ${entry.level <= clamped ? 'bg-negative' : 'bg-raised'}`}
          />
        ))}
      </div>

      {active.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {active.map((line) => (
            <li key={line} className="text-[9px] font-mono text-muted leading-tight">
              {line}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
