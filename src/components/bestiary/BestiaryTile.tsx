import React from 'react';
import { Eye, EyeOff, HelpCircle, Shield } from 'lucide-react';
import { resolveImageUrl } from '../../lib/artwork';
import type { BestiaryCreature } from '../../lib/types';

interface BestiaryTileProps {
  creature: BestiaryCreature;
  isDm: boolean;
  onSelect: (creature: BestiaryCreature) => void;
  onToggleReveal?: (creature: BestiaryCreature) => void;
}

/**
 * Maps Challenge Rating (CR) along the Sci-Fi theme spectrum:
 * Low CR (<= 2) -> Cyan/Teal (`var(--primary)` / #00E5FF)
 * Mid CR (3 - 8) -> Electric Violet (#7C4DFF)
 * High CR (>= 9) -> Apex Crimson-Magenta (#FF2E63)
 */
export function getCrRimColor(crNumeric: number): string {
  if (crNumeric >= 9) return '#FF2E63';
  if (crNumeric >= 3) return '#7C4DFF';
  return 'var(--primary)';
}

export const BestiaryTile: React.FC<BestiaryTileProps> = ({
  creature,
  isDm,
  onSelect,
  onToggleReveal,
}) => {
  // Unrevealed creature for players: dark HUD tile, faceless circular portrait, large ???, light hover border, zero data leak
  if (!creature.isRevealed && !isDm) {
    return (
      <div className="glass-panel hud-cut hud-corners p-6 flex flex-col items-center text-center justify-between gap-4 bg-[#070B14]/90 border border-primary/15 hover:border-primary/45 transition-all duration-200 select-none">
        {/* Faceless Circular Portrait */}
        <div className="w-24 h-24 rounded-full bg-[#070B14] border border-primary/30 flex items-center justify-center relative overflow-hidden">
          <svg
            viewBox="0 0 96 96"
            className="w-20 h-20 opacity-65"
            aria-hidden="true"
          >
            <circle cx="48" cy="34" r="16" fill="#0F172A" stroke="#8FA3BF" strokeOpacity="0.45" strokeWidth="1.5" />
            <path
              d="M20 88 C22 64 34 56 48 56 C62 56 74 64 76 88 Z"
              fill="#0F172A"
              stroke="#8FA3BF"
              strokeOpacity="0.45"
              strokeWidth="1.5"
            />
          </svg>
        </div>

        <div className="space-y-1.5">
          <div className="font-mono font-extrabold text-2xl tracking-[0.28em] text-muted tabular-nums">
            ???
          </div>
          <p className="text-xs text-muted leading-relaxed">
            Сразись с этим существом чтобы открыть его в бестиарии
          </p>
        </div>

        <span className="font-mono text-[10px] uppercase tracking-widest px-2.5 py-1 bg-[#070B14] border border-primary/20 text-muted inline-flex items-center gap-1">
          <HelpCircle className="w-3 h-3" />
          CR // ???
        </span>
      </div>
    );
  }

  const portraitUrl = resolveImageUrl(creature.imageKey, 'dragon');
  const crColor = getCrRimColor(creature.crNumeric);

  return (
    <div
      onClick={() => onSelect(creature)}
      style={
        {
          borderColor: `color-mix(in srgb, ${crColor} 58%, transparent)`,
          boxShadow: `0 0 0 1px color-mix(in srgb, ${crColor} 45%, transparent), 0 0 22px -7px ${crColor}`,
        } as React.CSSProperties
      }
      className={`glass-panel hud-cut hud-corners p-5 flex flex-col items-center text-center justify-between gap-4 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 relative ${
        !creature.isRevealed && isDm ? 'opacity-80' : ''
      }`}
    >
      {/* Top CR + DM Reveal Control */}
      <div className="w-full flex items-center justify-between gap-2">
        <span
          style={{
            borderColor: crColor,
            color: crColor,
            backgroundColor: `color-mix(in srgb, ${crColor} 14%, #070B14)`,
          }}
          className="font-mono text-[11px] font-extrabold px-2.5 py-0.5 border tabular-nums"
        >
          CR {creature.cr}
        </span>

        {isDm && onToggleReveal && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleReveal(creature);
            }}
            title={creature.isRevealed ? 'Скрыть обратно в ???' : 'Открыть существо игрокам'}
            className={`inline-flex items-center gap-1 px-2 py-0.5 font-mono text-[10px] uppercase font-bold border transition-colors ${
              creature.isRevealed
                ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300'
                : 'bg-amber-500/15 border-amber-500/50 text-amber-200'
            }`}
          >
            {creature.isRevealed ? (
              <>
                <Eye className="w-3 h-3" />
                OPEN
              </>
            ) : (
              <>
                <EyeOff className="w-3 h-3" />
                HIDDEN
              </>
            )}
          </button>
        )}
      </div>

      {/* Circular Revealed Portrait with CR Rim Light */}
      <div
        style={{
          borderColor: crColor,
          boxShadow: `0 0 20px -4px ${crColor}`,
        }}
        className="w-24 h-24 rounded-full p-1 bg-[#070B14] border-2"
      >
        <img
          src={portraitUrl}
          alt={creature.name}
          className="w-full h-full rounded-full object-cover bg-[#070B14]"
        />
      </div>

      <div className="space-y-1">
        <h3 className="font-anime font-bold text-base uppercase tracking-wide leading-snug">
          {creature.name}
        </h3>
        <div className="text-xs text-muted">{creature.creatureType}</div>
      </div>

      <div className="w-full pt-2 border-t border-primary/20 flex items-center justify-center gap-4 font-mono text-xs text-muted tabular-nums">
        <span className="inline-flex items-center gap-1">
          <Shield className="w-3.5 h-3.5 text-primary" />
          AC {creature.ac}
        </span>
        <span>HP {creature.hp}</span>
      </div>
    </div>
  );
};
