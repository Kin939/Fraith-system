import React from 'react';
import { Check, GripHorizontal, Lock, Pencil } from 'lucide-react';
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
      className={`w-44 h-44 p-3 flex flex-col items-center justify-between text-center select-none relative group hud-cut-sm transition-colors ${
        isDm ? 'cursor-grab active:cursor-grabbing touch-none' : 'cursor-pointer'
      } ${
        isDragging ? 'z-30 rim-card--active' : ''
      } ${
        isSelectedInEditor ? 'rim-card--active' : ''
      } ${
        isUnlocked
          ? 'glass-panel rim-card--active'
          : unlockedPrerequisite
            ? 'rim-card'
            : 'glass-panel opacity-75 border-border hover:opacity-100'
      }`}
    >
      {/* Top Row: Cost Keycap & Status */}
      <div className="w-full flex items-center justify-between gap-1">
        <span
          className={`hud-keycap ${
            isUnlocked
              ? 'text-primary border-primary/50'
              : canAfford && unlockedPrerequisite
                ? 'text-text'
                : 'text-muted'
          }`}
        >
          {node.cost} очк.
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
              className="w-6 h-6 bg-bg border border-border hover:border-text/20 text-muted hover:text-text flex items-center justify-center transition-colors"
              title="Редактировать узел"
            >
              <Pencil className="w-3 h-3" strokeWidth={1.5} />
            </button>
          )}

          {isDm && (
            <span
              className="text-muted group-hover:text-secondary transition-colors"
              title="Перетащите плитку мышью"
            >
              <GripHorizontal className="w-3.5 h-3.5" strokeWidth={1.5} />
            </span>
          )}

          {isUnlocked ? (
            <span
              className="w-5 h-5 bg-positive/10 border border-positive/30 text-positive flex items-center justify-center"
              title="Талант открыт для всей группы"
            >
              <Check className="w-3.5 h-3.5" strokeWidth={1.5} />
            </span>
          ) : !unlockedPrerequisite ? (
            <span
              className="w-5 h-5 bg-bg border border-border text-muted flex items-center justify-center"
              title="Требуется предыдущий талант"
            >
              <Lock className="w-3 h-3" strokeWidth={1.5} />
            </span>
          ) : null}
        </div>
      </div>

      {/* Square R2 / Artwork Tile */}
      <div
        className={`w-16 h-16 overflow-hidden border pointer-events-none bg-deep ${
          isUnlocked ? 'border-primary/60' : 'border-border'
        }`}
      >
        <img
          src={iconUrl}
          alt={node.title}
          draggable={false}
          className={`w-full h-full object-cover ${
            !isUnlocked && !unlockedPrerequisite ? 'grayscale opacity-75' : ''
          }`}
        />
      </div>

      {/* Title & Status */}
      <div className="w-full space-y-0.5 pointer-events-none">
        <div className="font-medium text-xs text-text leading-snug line-clamp-2">
          {node.title}
        </div>
        <div className="text-xs">
          {isUnlocked ? (
            <span className="text-positive">Открыт</span>
          ) : unlockedPrerequisite ? (
            <span className="text-secondary">Доступен</span>
          ) : (
            <span className="text-muted">Закрыт</span>
          )}
        </div>
      </div>
    </div>
  );
};
