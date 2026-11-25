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

export const BestiaryTile: React.FC<BestiaryTileProps> = ({
  creature,
  isDm,
  onSelect,
  onToggleReveal,
}) => {
  // Player view of an unrevealed creature: faceless circular portrait with ?, large ???, exact required caption
  if (!creature.isRevealed && !isDm) {
    return (
      <div className="glass-panel rounded-3xl p-6 flex flex-col items-center text-center justify-between gap-4 border border-border/80 opacity-85 select-none">
        <div className="w-24 h-24 rounded-full bg-bg/90 border-2 border-dashed border-border flex items-center justify-center relative shadow-inner">
          <div className="w-16 h-16 rounded-full bg-surface/90 flex items-center justify-center text-muted">
            <span className="font-anime font-extrabold text-3xl text-muted/80">?</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="font-anime font-extrabold text-2xl tracking-widest text-muted">???</div>
          <p className="text-xs text-muted leading-relaxed">
            Сразись с этим существом чтобы открыть его в бестиарии
          </p>
        </div>

        <span className="text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full bg-bg/70 border border-border text-muted inline-flex items-center gap-1">
          <HelpCircle className="w-3 h-3" />
          ПО: ???
        </span>
      </div>
    );
  }

  const portraitUrl = resolveImageUrl(creature.imageKey, '🐉');

  return (
    <div
      onClick={() => onSelect(creature)}
      className={`glass-panel rounded-3xl p-5 flex flex-col items-center text-center justify-between gap-4 cursor-pointer transition-all hover:-translate-y-1 hover:border-primary/60 relative ${
        !creature.isRevealed && isDm ? 'border-dashed border-amber-500/50' : ''
      }`}
    >
      {/* Top CR + DM Reveal Control */}
      <div className="w-full flex items-center justify-between gap-2">
        <span className="text-[11px] font-anime font-extrabold px-2.5 py-0.5 rounded-full bg-primary/20 border border-primary/40 text-primary">
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
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${
              creature.isRevealed
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                : 'bg-amber-500/15 border-amber-500/40 text-amber-200'
            }`}
          >
            {creature.isRevealed ? (
              <>
                <Eye className="w-3 h-3" />
                Открыто
              </>
            ) : (
              <>
                <EyeOff className="w-3 h-3" />
                Скрыто (DM)
              </>
            )}
          </button>
        )}
      </div>

      {/* Circular Revealed Portrait */}
      <div className="w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-primary to-accent shadow-neon">
        <img
          src={portraitUrl}
          alt={creature.name}
          className="w-full h-full rounded-full object-cover bg-bg"
        />
      </div>

      <div className="space-y-1">
        <h3 className="font-anime font-bold text-base leading-snug">{creature.name}</h3>
        <div className="text-xs text-muted">{creature.creatureType}</div>
      </div>

      <div className="w-full pt-2 border-t border-border/60 flex items-center justify-center gap-4 text-xs text-muted">
        <span className="inline-flex items-center gap-1">
          <Shield className="w-3.5 h-3.5 text-accent" />
          КД {creature.ac}
        </span>
        <span>ХП {creature.hp}</span>
      </div>
    </div>
  );
};
