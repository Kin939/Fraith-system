import React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import type { BestiaryCreature } from '../../lib/types';
import { MonsterArt } from './MonsterArt';

interface BestiaryTileProps {
  creature: BestiaryCreature;
  isDm: boolean;
  onSelect: (creature: BestiaryCreature) => void;
  onToggleReveal?: (creature: BestiaryCreature) => void;
}

/**
 * Semantic CR indicator color (toned to sit inside the Ink ramp):
 * <= 2: primary accent, 3–8: amber (#e5a93b), >= 9: coral (#e5484d)
 */
export function getCrRimColor(crNumeric: number): string {
  if (crNumeric >= 9) return '#e5484d';
  if (crNumeric >= 3) return '#e5a93b';
  return 'var(--primary)';
}

export const BestiaryTile: React.FC<BestiaryTileProps> = ({
  creature,
  isDm,
  onSelect,
  onToggleReveal,
}) => {
  // Unrevealed creature for players: quiet matte card, faceless silhouette, zero data leak
  if (!creature.isRevealed && !isDm) {
    return (
      <div className="glass-panel hud-cut p-5 flex flex-col items-center text-center justify-between gap-4 select-none">
        <div className="w-24 h-24 rounded-full bg-deep border border-border flex items-center justify-center relative overflow-hidden mt-2">
          <svg
            viewBox="0 0 96 96"
            className="w-20 h-20 opacity-50"
            aria-hidden="true"
          >
            <circle cx="48" cy="34" r="16" fill="#11141c" stroke="#7a8296" strokeOpacity="0.4" strokeWidth="1.5" />
            <path
              d="M20 88 C22 64 34 56 48 56 C62 56 74 64 76 88 Z"
              fill="#11141c"
              stroke="#7a8296"
              strokeOpacity="0.4"
              strokeWidth="1.5"
            />
          </svg>
        </div>

        <div className="space-y-1">
          <div className="font-mono text-base font-medium text-muted">
            ???
          </div>
          <p className="text-xs text-muted leading-relaxed">
            Сразитесь с этим существом, чтобы открыть запись
          </p>
        </div>

        <span className="text-xs text-muted font-mono">
          Опасность ?
        </span>
      </div>
    );
  }

  const crColor = getCrRimColor(creature.crNumeric);

  return (
    <div
      onClick={() => onSelect(creature)}
      className={`rim-card hud-cut p-5 flex flex-col items-center text-center justify-between gap-4 cursor-pointer ${
        !creature.isRevealed && isDm ? 'opacity-75' : ''
      }`}
    >
      {/* Top Row: CR status dot + DM Reveal Control */}
      <div className="w-full flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 font-mono text-xs text-secondary tabular-nums">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: crColor }}
          />
          <span>Опасность {creature.cr}</span>
        </span>

        {isDm && onToggleReveal && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleReveal(creature);
            }}
            title={creature.isRevealed ? 'Скрыть от игроков' : 'Открыть игрокам'}
            className={`inline-flex items-center gap-1 h-6 px-2 text-xs border transition-colors ${
              creature.isRevealed
                ? 'bg-positive/10 border-positive/30 text-positive'
                : 'bg-raised border-border text-muted hover:text-text'
            }`}
          >
            {creature.isRevealed ? (
              <>
                <Eye className="w-3.5 h-3.5" strokeWidth={1.5} />
                <span>Открыто</span>
              </>
            ) : (
              <>
                <EyeOff className="w-3.5 h-3.5" strokeWidth={1.5} />
                <span>Скрыто</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Circular Revealed Portrait */}
      <div
        style={{ borderColor: `color-mix(in srgb, ${crColor} 55%, transparent)` }}
        className="w-24 h-24 rounded-full p-1 bg-deep border shrink-0"
      >
        <MonsterArt
          creature={creature}
          imgClassName="w-full h-full rounded-full object-cover bg-deep"
          fallback={
            <div
              className="w-full h-full rounded-full bg-deep flex items-center justify-center font-mono text-lg font-medium"
              style={{ color: crColor }}
              title="У этого существа нет иллюстрации на dnd.su"
            >
              {creature.name.slice(0, 1).toUpperCase()}
            </div>
          }
        />
      </div>

      <div className="space-y-0.5 min-w-0 w-full">
        <h3 className="font-medium text-base text-text leading-snug truncate">
          {creature.name}
        </h3>
        <div className="text-xs text-secondary truncate">{creature.creatureType}</div>
        {creature.sourceTitle && (
          <div className="text-[10px] text-muted font-mono truncate" title={creature.sourceTitle}>
            {creature.sourceTitle}
          </div>
        )}
        {creature.notesCount > 0 && (
          <div className="text-[10px] text-primary/80 font-mono tabular-nums">
            заметки · {creature.notesCount}
          </div>
        )}
      </div>

      <div className="w-full pt-3 border-t border-border grid grid-cols-3 gap-1 font-mono text-xs text-secondary tabular-nums text-center">
        <span title="Класс доспеха">КД {creature.ac}</span>
        <span className="truncate" title={`Хиты ${creature.hp}`}>
          Хиты {creature.hp}
        </span>
        <span title="Опыт за победу">
          Опыт {creature.xp.toLocaleString('ru-RU')}
        </span>
      </div>
    </div>
  );
};
