import React from 'react';
import { Check, GripHorizontal, Lock, Pencil, Sparkles } from 'lucide-react';
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
  const iconUrl = resolveImageUrl(node.imageKey, '✦');
  const isUnlocked = Boolean(node.isUnlocked);

  return (
    <div
      onPointerDown={(e) => onPointerDown?.(e, node)}
      onClick={() => {
        if (!isDragging) onSelect(node);
      }}
      className={`w-44 h-44 rounded-3xl p-3.5 flex flex-col items-center justify-between text-center select-none relative group transition-shadow ${
        isDm ? 'cursor-grab active:cursor-grabbing touch-none' : 'cursor-pointer'
      } ${
        isDragging ? 'z-30 scale-105 shadow-neon ring-2 ring-accent' : ''
      } ${
        isSelectedInEditor ? 'ring-2 ring-primary shadow-neon' : ''
      } ${
        isUnlocked
          ? 'glass-panel neon-border ring-2 ring-emerald-400/75'
          : unlockedPrerequisite
            ? 'glass-panel hover:border-primary'
            : 'glass-panel opacity-70 border-dashed hover:opacity-95'
      }`}
    >
      {/* Top Row: Cost & Shared Party Status */}
      <div className="w-full flex items-center justify-between gap-1">
        <span
          className={`inline-flex items-center gap-1 text-[11px] font-anime font-extrabold px-2 py-0.5 rounded-lg border ${
            isUnlocked
              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
              : canAfford && unlockedPrerequisite
                ? 'bg-accent/20 border-accent/40 text-accent'
                : 'bg-bg/70 border-border text-muted'
          }`}
        >
          <Sparkles className="w-3 h-3" />
          {node.cost}
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
              className="w-5 h-5 rounded-full bg-surface/90 border border-border hover:border-primary text-muted hover:text-primary flex items-center justify-center transition-colors"
              title="Редактировать узел"
            >
              <Pencil className="w-2.5 h-2.5" />
            </button>
          )}

          {isDm && (
            <span
              className="text-muted/60 group-hover:text-accent transition-colors"
              title="Перетащите плитку мышью в нужное место"
            >
              <GripHorizontal className="w-3.5 h-3.5" />
            </span>
          )}

          {isUnlocked ? (
            <span
              className="w-5 h-5 rounded-full bg-emerald-500/25 text-emerald-300 flex items-center justify-center"
              title="Талант открыт для всей группы"
            >
              <Check className="w-3.5 h-3.5" />
            </span>
          ) : !unlockedPrerequisite ? (
            <span
              className="w-5 h-5 rounded-full bg-bg/80 text-muted flex items-center justify-center"
              title="Требуется предыдущий талант"
            >
              <Lock className="w-3 h-3" />
            </span>
          ) : null}
        </div>
      </div>

      {/* Square Icon */}
      <div className="w-16 h-16 rounded-2xl overflow-hidden border border-border shadow-md pointer-events-none">
        <img
          src={iconUrl}
          alt={node.title}
          draggable={false}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Title & Shared Status Pill */}
      <div className="w-full space-y-1 pointer-events-none">
        <div className="font-anime font-bold text-xs leading-tight line-clamp-2">{node.title}</div>
        <div className="text-[10px] font-semibold">
          {isUnlocked ? (
            <span className="text-emerald-300">✦ Открыт для группы</span>
          ) : unlockedPrerequisite ? (
            <span className="text-muted">Доступен к открытию</span>
          ) : (
            <span className="text-muted/70">Закрыт</span>
          )}
        </div>
      </div>
    </div>
  );
};
