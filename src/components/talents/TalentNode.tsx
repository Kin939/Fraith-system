import React from 'react';
import { Check, GripHorizontal, Lock, Pencil, Star } from 'lucide-react';
import { resolveImageUrl } from '../../lib/artwork';
import { questEmblemUrl, talentAccentFallback, tileCssVars } from '../../lib/questStyle';
import type { TalentNode as TalentNodeModel } from '../../lib/types';

interface TalentNodeProps {
  node: TalentNodeModel;
  unlockedPrerequisite: boolean;
  canAfford: boolean;
  isDm: boolean;
  isDragging?: boolean;
  isSelectedInEditor?: boolean;
  /** Tile edge length in px (controlled from the talents tile-size switch) */
  sizePx?: number;
  /** Dim tiles that are not marked as key talents */
  dimmed?: boolean;
  onPointerDown?: (e: React.PointerEvent<HTMLDivElement>, node: TalentNodeModel) => void;
  onSelect: (node: TalentNodeModel) => void;
  onEditNode?: (node: TalentNodeModel) => void;
  onToggleFeatured?: (node: TalentNodeModel) => void;
}

export const TalentNode: React.FC<TalentNodeProps> = ({
  node,
  unlockedPrerequisite,
  canAfford,
  isDm,
  isDragging,
  isSelectedInEditor,
  sizePx = 176,
  dimmed = false,
  onPointerDown,
  onSelect,
  onEditNode,
  onToggleFeatured,
}) => {
  const isUnlocked = Boolean(node.isUnlocked);
  const style = node.tileStyle;
  const featured = Boolean(style?.isImportant);
  const accent = style?.accent || talentAccentFallback(style);
  const emblem = questEmblemUrl(style?.emblem);
  const pattern = style?.pattern ?? 'none';
  const artUrl = node.imageKey ? resolveImageUrl(node.imageKey, 'spark') : emblem;

  const artSize = sizePx >= 230 ? 'w-20 h-20' : sizePx >= 200 ? 'w-[72px] h-[72px]' : sizePx >= 165 ? 'w-16 h-16' : 'w-12 h-12';

  return (
    <div
      onPointerDown={(e) => onPointerDown?.(e, node)}
      onClick={() => {
        if (!isDragging) onSelect(node);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(node);
        }
      }}
      role="button"
      tabIndex={0}
      style={{ width: `${sizePx}px`, height: `${sizePx}px`, ...tileCssVars(style, accent) }}
      title={`${node.title} · ${node.cost} очк. вдохновения${featured ? ' · ключевой талант' : ''}`}
      className={`quest-tile p-2.5 flex flex-col items-center justify-between text-center select-none relative group transition-opacity ${
        isDm ? 'cursor-grab active:cursor-grabbing touch-none' : 'cursor-pointer'
      } ${isDragging ? 'z-30' : ''} ${isSelectedInEditor ? 'quest-tile--selected' : ''} ${
        featured ? 'quest-tile--important' : ''
      } ${dimmed ? 'opacity-35 hover:opacity-90' : ''} ${
        isUnlocked
          ? 'quest-tile--selected'
          : unlockedPrerequisite
            ? ''
            : 'opacity-70 hover:opacity-95'
      }`}
    >
      <span aria-hidden className="quest-tile__rail" />
      {pattern !== 'none' && (
        <span aria-hidden className={`quest-tile__pattern quest-pattern--${pattern}`} />
      )}

      {/* Top Row: Cost Keycap & DM controls */}
      <div className="relative z-10 w-full flex items-center justify-between gap-1">
        <span
          className={`hud-keycap ${
            isUnlocked
              ? 'text-[color:var(--q-accent)] border-[color:var(--q-accent-strong)]'
              : canAfford && unlockedPrerequisite
                ? 'text-text'
                : 'text-muted'
          }`}
        >
          {node.cost} очк.
        </span>

        <div className="flex items-center gap-1">
          {isDm && onToggleFeatured && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onToggleFeatured(node);
              }}
              className={`w-5 h-5 flex items-center justify-center transition-colors ${
                featured ? 'text-[color:var(--q-accent)]' : 'text-muted hover:text-text'
              }`}
              title={featured ? 'Снять метку ключевого таланта' : 'Отметить ключевым талантом'}
            >
              <Star className="w-3 h-3" strokeWidth={1.7} fill={featured ? 'currentColor' : 'none'} />
            </button>
          )}

          {isDm && onEditNode && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onEditNode(node);
              }}
              className="w-5 h-5 bg-bg border border-border hover:border-text/20 text-muted hover:text-text flex items-center justify-center transition-colors"
              title="Редактировать талант и плитку"
            >
              <Pencil className="w-2.5 h-2.5" strokeWidth={1.5} />
            </button>
          )}

          {isDm && (
            <span
              className="text-muted group-hover:text-secondary transition-colors"
              title="Перетащите плитку мышью"
            >
              <GripHorizontal className="w-3 h-3" strokeWidth={1.5} />
            </span>
          )}

          {isUnlocked ? (
            <span
              className="w-5 h-5 bg-positive/10 border border-positive/30 text-positive flex items-center justify-center"
              title="Талант открыт для всей группы"
            >
              <Check className="w-3 h-3" strokeWidth={1.7} />
            </span>
          ) : !unlockedPrerequisite ? (
            <span
              className="w-5 h-5 bg-bg border border-border text-muted flex items-center justify-center"
              title="Требуется предыдущий талант"
            >
              <Lock className="w-2.5 h-2.5" strokeWidth={1.5} />
            </span>
          ) : null}
        </div>
      </div>

      {/* Artwork / Emblem */}
      <div
        className={`relative z-10 ${artSize} overflow-hidden pointer-events-none border bg-deep flex items-center justify-center ${
          isUnlocked ? 'border-[color:var(--q-accent-strong)]' : 'border-border'
        }`}
      >
        {artUrl ? (
          <img
            src={artUrl}
            alt={node.title}
            draggable={false}
            className={`w-full h-full ${
              node.imageKey ? 'object-cover' : 'object-contain p-1.5'
            } ${!isUnlocked && !unlockedPrerequisite ? 'grayscale opacity-70' : ''}`}
          />
        ) : (
          <Star className="w-6 h-6 text-muted" strokeWidth={1.4} />
        )}
        {featured && (
          <span
            className="absolute top-0 right-0 h-4 px-1 inline-flex items-center gap-0.5 text-[9px] font-medium"
            style={{ backgroundColor: `${accent}dd`, color: '#0b0b12' }}
          >
            <Star className="w-2 h-2" strokeWidth={2} fill="currentColor" />
            KEY
          </span>
        )}
      </div>

      {/* Title & Status */}
      <div className="relative z-10 w-full space-y-0.5 pointer-events-none">
        <div
          className={`font-medium text-text leading-snug ${
            sizePx >= 200 ? 'text-xs line-clamp-3' : 'text-[11px] line-clamp-2'
          }`}
        >
          {node.title}
        </div>
        <div className="text-[10px]">
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
