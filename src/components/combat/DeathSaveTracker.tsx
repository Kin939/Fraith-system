import React from 'react';
import { HeartPulse, ShieldCheck } from 'lucide-react';
import { DEATH_SAVE_TARGET, deathSaveOutcome, type DeathSavesView } from '../../lib/combatProtocol';

interface DeathSaveTrackerProps {
  saves: DeathSavesView;
  canEdit: boolean;
  onSave?: (kind: 'success' | 'failure') => void;
  onStabilize?: (stable: boolean) => void;
}

const Pip: React.FC<{ filled: boolean; tone: 'positive' | 'negative' }> = ({ filled, tone }) => (
  <span
    className={`w-2.5 h-2.5 border ${
      filled
        ? tone === 'positive'
          ? 'bg-positive border-positive'
          : 'bg-negative border-negative'
        : 'border-border bg-transparent'
    }`}
  />
);

/**
 * Спасброски от смерти: 3 успеха — стабилизация, 3 провала — смерть.
 * Полностью автоматизирован только счётчик; сами броски делает игрок/мастер.
 */
export const DeathSaveTracker: React.FC<DeathSaveTrackerProps> = ({ saves, canEdit, onSave, onStabilize }) => {
  const outcome = deathSaveOutcome(saves.successes, saves.failures, saves.stable);
  const label =
    outcome === 'stable' ? 'Стабилен' : outcome === 'dead' ? 'Мёртв' : 'При смерти';
  const tone =
    outcome === 'stable' ? 'text-positive border-positive/50' : outcome === 'dead' ? 'text-negative border-negative/60' : 'text-warning border-warning/50';

  return (
    <div className={`mt-1.5 px-2 py-1.5 border bg-deep/50 ${tone}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wide">
          <HeartPulse className="w-3 h-3" strokeWidth={1.75} />
          {label}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1" title={`Успехи ${saves.successes}/${DEATH_SAVE_TARGET}`}>
            {Array.from({ length: DEATH_SAVE_TARGET }).map((_, index) => (
              <Pip key={`s${index}`} filled={index < saves.successes} tone="positive" />
            ))}
          </div>
          <div className="flex items-center gap-1" title={`Провалы ${saves.failures}/${DEATH_SAVE_TARGET}`}>
            {Array.from({ length: DEATH_SAVE_TARGET }).map((_, index) => (
              <Pip key={`f${index}`} filled={index < saves.failures} tone="negative" />
            ))}
          </div>
        </div>
      </div>

      {canEdit && (
        <div className="flex items-center gap-1 mt-1.5">
          <button
            type="button"
            onClick={() => onSave?.('success')}
            className="h-6 px-1.5 text-[9px] font-mono uppercase border border-positive/50 text-positive hover:bg-positive/10"
            title="Отметить успех"
          >
            + успех
          </button>
          <button
            type="button"
            onClick={() => onSave?.('failure')}
            className="h-6 px-1.5 text-[9px] font-mono uppercase border border-negative/50 text-negative hover:bg-negative/10"
            title="Отметить провал"
          >
            + провал
          </button>
          <button
            type="button"
            onClick={() => onStabilize?.(!saves.stable)}
            className="h-6 px-1.5 text-[9px] font-mono uppercase border border-border text-muted hover:text-text flex items-center gap-1"
            title="Стабилизировать / снять стабилизацию"
          >
            <ShieldCheck className="w-3 h-3" strokeWidth={1.75} /> стабилизировать
          </button>
        </div>
      )}
    </div>
  );
};
