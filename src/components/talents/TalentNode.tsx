import React from 'react';
import { Check, Lock, Sparkles } from 'lucide-react';
import { resolveImageUrl } from '../../lib/artwork';
import type { PlayerId, TalentNode as TalentNodeModel } from '../../lib/types';

interface TalentNodeProps {
  node: TalentNodeModel;
  ownedByCurrentPlayer: boolean;
  unlockedPrerequisite: boolean;
  canAfford: boolean;
  owners: PlayerId[];
  onSelect: (node: TalentNodeModel) => void;
}

export const TalentNode: React.FC<TalentNodeProps> = ({
  node,
  ownedByCurrentPlayer,
  unlockedPrerequisite,
  canAfford,
  owners,
  onSelect,
}) => {
  const iconUrl = resolveImageUrl(node.imageKey, '✦');

  return (
    <button
      type="button"
      onClick={() => onSelect(node)}
      className={`w-44 h-44 rounded-3xl p-3.5 flex flex-col items-center justify-between text-center transition-all relative group ${
        ownedByCurrentPlayer
          ? 'glass-panel neon-border ring-2 ring-emerald-400/70'
          : unlockedPrerequisite
            ? 'glass-panel hover:border-primary hover:-translate-y-1'
            : 'glass-panel opacity-65 border-dashed hover:opacity-90'
      }`}
    >
      {/* Top Row: Cost & Ownership Status */}
      <div className="w-full flex items-center justify-between">
        <span
          className={`inline-flex items-center gap-1 text-[11px] font-anime font-extrabold px-2 py-0.5 rounded-lg border ${
            ownedByCurrentPlayer
              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
              : canAfford && unlockedPrerequisite
                ? 'bg-accent/20 border-accent/40 text-accent'
                : 'bg-bg/70 border-border text-muted'
          }`}
        >
          <Sparkles className="w-3 h-3" />
          {node.cost}
        </span>

        {ownedByCurrentPlayer ? (
          <span className="w-5 h-5 rounded-full bg-emerald-500/25 text-emerald-300 flex items-center justify-center">
            <Check className="w-3.5 h-3.5" />
          </span>
        ) : !unlockedPrerequisite ? (
          <span className="w-5 h-5 rounded-full bg-bg/80 text-muted flex items-center justify-center">
            <Lock className="w-3 h-3" />
          </span>
        ) : null}
      </div>

      {/* Square Icon */}
      <div className="w-16 h-16 rounded-2xl overflow-hidden border border-border shadow-md group-hover:scale-105 transition-transform">
        <img src={iconUrl} alt={node.title} className="w-full h-full object-cover" />
      </div>

      {/* Title & Party Badges */}
      <div className="w-full space-y-1">
        <div className="font-anime font-bold text-xs leading-tight line-clamp-2">{node.title}</div>
        <div className="flex items-center justify-center gap-1 min-h-[16px]">
          {owners.map((pid) => (
            <span
              key={pid}
              className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-primary/25 text-primary border border-primary/40"
              title={`Приобретено Игроком ${pid}`}
            >
              P{pid}
            </span>
          ))}
        </div>
      </div>
    </button>
  );
};
