import React from 'react';
import { Heart, Shield, Skull, X } from 'lucide-react';
import { resolveImageUrl } from '../../lib/artwork';
import type { BestiaryCreature } from '../../lib/types';
import { FormattedText } from '../common/FormattedText';
import { getCrRimColor } from './BestiaryTile';

interface BestiaryDetailProps {
  creature: BestiaryCreature | null;
  onClose: () => void;
}

export const BestiaryDetail: React.FC<BestiaryDetailProps> = ({ creature, onClose }) => {
  if (!creature) return null;

  const crColor = getCrRimColor(creature.crNumeric);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          borderColor: crColor,
          boxShadow: `0 0 0 1px ${crColor}, 0 0 28px -6px ${crColor}`,
        }}
        className="glass-panel hud-corners hud-cut max-w-lg w-full overflow-hidden border"
      >
        <div className="relative h-52 bg-[#070B14] border-b border-primary/30">
          <img
            src={resolveImageUrl(creature.imageKey, 'dragon')}
            alt={creature.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#070B14] via-[#070B14]/35 to-transparent" />
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 p-2 glass-panel text-muted hover:text-text"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="absolute bottom-3 left-5 right-5 flex items-end justify-between gap-2">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
                SPECIMEN // {creature.creatureType}
              </div>
              <h3 className="font-anime font-extrabold text-2xl uppercase text-text">
                {creature.name}
              </h3>
            </div>
            <span
              style={{ borderColor: crColor, color: crColor }}
              className="font-mono font-extrabold text-sm px-3 py-1 bg-[#070B14]/90 border tabular-nums"
            >
              CR {creature.cr}
            </span>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-3 gap-2.5 text-center">
            <div className="p-3 bg-[#070B14]/80 border border-primary/25">
              <div className="font-mono text-[10px] uppercase text-muted flex items-center justify-center gap-1">
                <Skull className="w-3.5 h-3.5 text-primary" />
                CR
              </div>
              <div className="font-mono font-extrabold text-base mt-0.5 tabular-nums">
                {creature.cr}
              </div>
            </div>
            <div className="p-3 bg-[#070B14]/80 border border-primary/25">
              <div className="font-mono text-[10px] uppercase text-muted flex items-center justify-center gap-1">
                <Shield className="w-3.5 h-3.5 text-primary" />
                AC
              </div>
              <div className="font-mono font-extrabold text-base mt-0.5 tabular-nums">
                {creature.ac}
              </div>
            </div>
            <div className="p-3 bg-[#070B14]/80 border border-primary/25">
              <div className="font-mono text-[10px] uppercase text-muted flex items-center justify-center gap-1">
                <Heart className="w-3.5 h-3.5 text-rose-400" />
                HP
              </div>
              <div className="font-mono font-extrabold text-sm mt-0.5 tabular-nums">
                {creature.hp}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary font-bold">
              // ДОСЬЕ БЕСТИАРИЯ
            </div>
            <FormattedText text={creature.description} className="text-sm text-text/95" />
          </div>
        </div>
      </div>
    </div>
  );
};
