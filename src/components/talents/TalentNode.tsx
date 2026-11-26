import React from 'react';
import { Check, GripHorizontal, Lock, Pencil } from 'lucide-react';
import { HudIcon } from '../common/HudIcon';
import { resolveImageUrl } from '../../lib/artwork';
import type { TalentNode as TalentNodeModel } from '../../lib/types';

interface TalentNodeProps {
  node: TalentNodeModel;
  unlockedPrerequisite: boolean;
  canAfford: boolean;
  isDm: boolean;
  isDragging?: boolean;
  isSelectedInEditor?: boolean;
  onPointerDown?: (e: React.PointerEvent<HTMLDivElement>, node: TalentNodeModel) => void;
  onSelect: (node: TalentNodeModel) => void;
  onEditNode?: (node: TalentNodeModel) => void;
}

export const TalentNode: React.FC<TalentNodeProps> = ({
  node,
  unlockedPrerequisite,
  canAfford,
  isDm,
  isDragging,
  isSelectedInEditor,
  onPointerDown,
  onSelect,
  onEditNode,
}) => {
  const iconUrl = resolveImageUrl(node.imageKey, 'spark');
  const isUnlocked = Boolean(node.isUnlocked);

  return (
    <div
      onPointerDown={(e) => onPointerDown?.(e, node)}
      onClick={() => {
        if (!isDragging) onSelect(node);
      }}
      className={`w-44 h-44 p-3 flex flex-col items-center justify-between text-center select-none relative group hud-corners transition-all duration-200 ${
        isDm ? 'cursor-grab active:cursor-grabbing touch-none' : 'cursor-pointer'
      } ${
        isDragging ? 'z-30 scale-105 rim-card--active' : ''
      } ${
        isSelectedInEditor ? 'rim-card--active' : ''
      } ${
        isUnlocked
          ? 'glass-panel rim-card--active'
          : unlockedPrerequisite
            ? 'rim-card'
            : 'glass-panel opacity-50 border-primary/20 hover:opacity-75'
      }`}
    >
      {/* Top Row: Corner Cost Badge & Status */}
      <div className="w-full flex items-center justify-between gap-1">
        <span
          className={`inline-flex items-center gap-1 font-mono text-[11px] font-extrabold px-1.5 py-0.5 border tabular-nums ${
            isUnlocked
              ? 'bg-primary text-[#040810] border-primary'
              : canAfford && unlockedPrerequisite
                ? 'bg-primary/15 border-primary/60 text-primary'
                : 'bg-[#070B14]/90 border-primary/25 text-muted'
          }`}
        >
          <HudIcon asset="spark" size="xs" />
          <span>{node.cost}</span>
        </span>

        <div className="flex items-center gap-1">
          {isDm && onEditNode && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onEditNode(node);
              }}
              className="w-5 h-5 bg-[#070B14] border border-primary/35 hover:border-primary text-muted hover:text-primary flex items-center justify-center transition-colors"
              title="Редактировать узел"
            >
              <Pencil className="w-2.5 h-2.5" />
            </button>
          )}

          {isDm && (
            <span
              className="text-muted/60 group-hover:text-primary transition-colors"
              title="Перетащите плитку мышью"
            >
              <GripHorizontal className="w-3.5 h-3.5" />
            </span>
          )}

          {isUnlocked ? (
            <span
              className="w-5 h-5 bg-primary/20 border border-primary text-primary flex items-center justify-center"
              title="Талант открыт для всей группы"
            >
              <Check className="w-3.5 h-3.5" />
            </span>
          ) : !unlockedPrerequisite ? (
            <span
              className="w-5 h-5 bg-[#070B14] border border-primary/20 text-muted flex items-center justify-center"
              title="Требуется предыдущий талант"
            >
              <Lock className="w-3 h-3" />
            </span>
          ) : null}
        </div>
      </div>

      {/* Square R2 / HUD Artwork Tile */}
      <div
        className={`w-16 h-16 overflow-hidden border pointer-events-none bg-[#070B14] ${
          isUnlocked ? 'border-primary shadow-rim' : 'border-primary/35'
        }`}
      >
        <img
          src={iconUrl}
          alt={node.title}
          draggable={false}
          className={`w-full h-full object-cover ${
            !isUnlocked && !unlockedPrerequisite ? 'grayscale' : ''
          }`}
        />
      </div>

      {/* Title & Status */}
      <div className="w-full space-y-0.5 pointer-events-none">
        <div className="font-anime font-bold text-xs uppercase tracking-wide leading-tight line-clamp-2">
          {node.title}
        </div>
        <div className="font-mono text-[10px] uppercase tracking-wider">
          {isUnlocked ? (
            <span className="text-primary font-bold">ACTIVE // UNLOCKED</span>
          ) : unlockedPrerequisite ? (
            <span className="text-muted">AVAILABLE</span>
          ) : (
            <span className="text-muted/70">LOCKED</span>
          )}
        </div>
      </div>
    </div>
  );
};
