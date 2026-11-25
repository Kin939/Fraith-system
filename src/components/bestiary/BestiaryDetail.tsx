import React from 'react';
import { Heart, Shield, Skull, X } from 'lucide-react';
import { resolveImageUrl } from '../../lib/artwork';
import type { BestiaryCreature } from '../../lib/types';

interface BestiaryDetailProps {
  creature: BestiaryCreature | null;
  onClose: () => void;
}

export const BestiaryDetail: React.FC<BestiaryDetailProps> = ({ creature, onClose }) => {
  if (!creature) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-panel neon-border rounded-3xl max-w-lg w-full overflow-hidden"
      >
        <div className="relative h-52 bg-bg border-b border-border">
          <img
            src={resolveImageUrl(creature.imageKey, '🐉')}
            alt={creature.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/25 to-transparent" />
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 p-2 rounded-xl glass-panel text-muted hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="absolute bottom-3 left-5 right-5 flex items-end justify-between gap-2">
            <div>
              <div className="text-xs text-accent font-semibold">{creature.creatureType}</div>
              <h3 className="font-anime font-extrabold text-2xl text-white">{creature.name}</h3>
            </div>
            <span className="font-anime font-extrabold text-sm px-3 py-1 rounded-xl bg-primary/30 border border-primary text-white">
              CR {creature.cr}
            </span>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-3 gap-2.5 text-center">
            <div className="p-3 rounded-2xl bg-bg/60 border border-border">
              <div className="text-[11px] text-muted flex items-center justify-center gap-1">
                <Skull className="w-3.5 h-3.5 text-primary" />
                Опасность
              </div>
              <div className="font-anime font-extrabold text-base mt-0.5">CR {creature.cr}</div>
            </div>
            <div className="p-3 rounded-2xl bg-bg/60 border border-border">
              <div className="text-[11px] text-muted flex items-center justify-center gap-1">
                <Shield className="w-3.5 h-3.5 text-accent" />
                Класс Доспеха
              </div>
              <div className="font-anime font-extrabold text-base mt-0.5">{creature.ac}</div>
            </div>
            <div className="p-3 rounded-2xl bg-bg/60 border border-border">
              <div className="text-[11px] text-muted flex items-center justify-center gap-1">
                <Heart className="w-3.5 h-3.5 text-rose-400" />
                Хиты
              </div>
              <div className="font-anime font-extrabold text-sm mt-0.5">{creature.hp}</div>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="text-xs uppercase tracking-wider text-muted font-semibold">
              Записи бестиария
            </div>
            <p className="text-sm text-text/95 leading-relaxed whitespace-pre-line">
              {creature.description}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
