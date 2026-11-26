import React from 'react';
import { X } from 'lucide-react';
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
      className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-panel hud-cut max-w-lg w-full overflow-hidden shadow-glass"
      >
        <div className="relative h-52 bg-deep border-b border-border">
          <img
            src={resolveImageUrl(creature.imageKey, 'dragon')}
            alt={creature.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/40 to-transparent" />
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 bg-surface/90 border border-border flex items-center justify-center text-muted hover:text-text transition-colors"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>

          <div className="absolute bottom-4 left-6 right-6 flex items-end justify-between gap-3">
            <div>
              <div className="text-xs text-secondary">{creature.creatureType}</div>
              <h3 className="font-medium text-2xl text-text mt-0.5">
                {creature.name}
              </h3>
            </div>
            <span className="hud-keycap">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: crColor }}
              />
              <span>Опасность {creature.cr}</span>
            </span>
          </div>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-bg border border-border">
              <div className="text-xs text-muted">Опасность</div>
              <div className="font-mono font-medium text-lg text-text mt-1 tabular-nums">
                {creature.cr}
              </div>
            </div>
            <div className="p-3 bg-bg border border-border">
              <div className="text-xs text-muted">Класс доспеха</div>
              <div className="font-mono font-medium text-lg text-text mt-1 tabular-nums">
                {creature.ac}
              </div>
            </div>
            <div className="p-3 bg-bg border border-border">
              <div className="text-xs text-muted">Хиты</div>
              <div className="font-mono font-medium text-lg text-text mt-1 tabular-nums">
                {creature.hp}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs text-muted">Описание</div>
            <FormattedText text={creature.description} className="text-sm text-secondary" />
          </div>
        </div>
      </div>
    </div>
  );
};
