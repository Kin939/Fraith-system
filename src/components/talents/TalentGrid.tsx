import React from 'react';
import { Check, Lock, Pencil, Sparkles, Star } from 'lucide-react';
import { resolveImageUrl } from '../../lib/artwork';
import { questEmblemUrl, talentAccentFallback, tileCssVars } from '../../lib/questStyle';
import { tileGridCols, type TileSize } from '../../lib/tileSize';
import type { TalentNode } from '../../lib/types';

interface TalentGridProps {
  nodes: TalentNode[];
  nodeMap: Map<number, TalentNode>;
  size: TileSize;
  onlyFeatured: boolean;
  isDm: boolean;
  onSelect: (node: TalentNode) => void;
  onEditNode?: (node: TalentNode) => void;
  onToggleFeatured?: (node: TalentNode) => void;
}

/**
 * Card grid alternative to the canvas tree — better for reading on phones and
 * for quickly scanning "what is available". Density is controlled by the
 * shared tile-size switch.
 */
export const TalentGrid: React.FC<TalentGridProps> = ({
  nodes,
  nodeMap,
  size,
  onlyFeatured,
  isDm,
  onSelect,
  onEditNode,
  onToggleFeatured,
}) => {
  const visibleNodes = onlyFeatured
    ? nodes.filter((n) => n.tileStyle?.isImportant)
    : nodes;

  const ordered = [...visibleNodes].sort((a, b) => {
    if (Boolean(a.tileStyle?.isImportant) !== Boolean(b.tileStyle?.isImportant)) {
      return a.tileStyle?.isImportant ? -1 : 1;
    }
    if (Boolean(a.isUnlocked) !== Boolean(b.isUnlocked)) return a.isUnlocked ? -1 : 1;
    return a.id - b.id;
  });

  if (ordered.length === 0) {
    return (
      <div className="glass-panel hud-cut p-8 text-center text-sm text-muted">
        {onlyFeatured
          ? 'Ключевых талантов пока нет — отметьте звёздочкой важные узлы дерева'
          : 'Мастер ещё не добавил таланты в кампанию'}
      </div>
    );
  }

  const compact = size === 'compact';

  return (
    <div className={`grid gap-3 ${tileGridCols(size)}`}>
      {ordered.map((node) => {
        const parent = node.parentId ? nodeMap.get(node.parentId) : undefined;
        const prereqMet = !parent || Boolean(parent.isUnlocked);
        const featured = Boolean(node.tileStyle?.isImportant);
        const accent = node.tileStyle?.accent || talentAccentFallback(node.tileStyle);
        const emblem = questEmblemUrl(node.tileStyle?.emblem);
        const artUrl = node.imageKey ? resolveImageUrl(node.imageKey, 'spark') : emblem;

        return (
          <div
            key={node.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(node)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(node);
              }
            }}
            style={tileCssVars(node.tileStyle, accent)}
            className={`quest-tile group text-left flex flex-col justify-between cursor-pointer relative ${
              compact ? 'p-3 gap-2' : 'p-4 gap-3'
            } ${featured ? 'quest-tile--important' : ''} ${
              node.isUnlocked ? 'quest-tile--selected' : ''
            } ${!prereqMet ? 'opacity-70 hover:opacity-100' : ''}`}
          >
            <span aria-hidden className="quest-tile__rail" />
            {node.tileStyle?.pattern && node.tileStyle.pattern !== 'none' && (
              <span
                aria-hidden
                className={`quest-tile__pattern quest-pattern--${node.tileStyle.pattern}`}
              />
            )}

            <div className="relative z-10 flex items-start gap-2.5">
              <span
                className={`shrink-0 overflow-hidden border bg-deep flex items-center justify-center ${
                  compact ? 'w-8 h-8' : 'w-11 h-11'
                } ${node.isUnlocked ? 'border-[color:var(--q-accent-strong)]' : 'border-border'}`}
              >
                {artUrl ? (
                  <img
                    src={artUrl}
                    alt=""
                    loading="lazy"
                    draggable={false}
                    className={`w-full h-full ${node.imageKey ? 'object-cover' : 'object-contain p-1'}`}
                  />
                ) : (
                  <Sparkles className="w-4 h-4 text-muted" strokeWidth={1.4} />
                )}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h3
                    className={`font-medium text-text leading-snug line-clamp-2 ${
                      compact ? 'text-xs' : 'text-sm'
                    }`}
                  >
                    {node.title}
                  </h3>
                  <span className="hud-keycap shrink-0">{node.cost} очк.</span>
                </div>

                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  {node.isUnlocked ? (
                    <span className="inline-flex items-center gap-1 text-[10px] text-positive">
                      <Check className="w-2.5 h-2.5" strokeWidth={2} />
                      открыт
                    </span>
                  ) : prereqMet ? (
                    <span className="text-[10px] text-secondary">доступен</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] text-muted">
                      <Lock className="w-2.5 h-2.5" strokeWidth={1.6} />
                      нужен предыдущий
                    </span>
                  )}
                  {featured && (
                    <span className="quest-tile__badge inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-medium tracking-wide">
                      <Star className="w-2 h-2" strokeWidth={2} fill="currentColor" />
                      <span>КЛЮЧЕВОЙ</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {!compact && node.description && (
              <p className="relative z-10 text-[11px] text-secondary line-clamp-2 leading-relaxed">
                {node.description}
              </p>
            )}

            {isDm && (
              <div className="relative z-10 flex items-center gap-1.5 opacity-70 group-hover:opacity-100 transition-opacity">
                {onToggleFeatured && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFeatured(node);
                    }}
                    className={`h-6 px-1.5 text-[10px] border inline-flex items-center gap-1 ${
                      featured
                        ? 'border-[color:var(--q-accent-strong)] text-[color:var(--q-accent)]'
                        : 'border-border text-muted hover:text-text'
                    }`}
                    title="Переключить ключевой талант"
                  >
                    <Star
                      className="w-2.5 h-2.5"
                      strokeWidth={1.8}
                      fill={featured ? 'currentColor' : 'none'}
                    />
                    <span>{featured ? 'Ключевой' : 'Отметить'}</span>
                  </button>
                )}
                {onEditNode && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditNode(node);
                    }}
                    className="h-6 px-1.5 text-[10px] border border-border text-secondary hover:text-text inline-flex items-center gap-1"
                    title="Редактировать талант и плитку"
                  >
                    <Pencil className="w-2.5 h-2.5" strokeWidth={1.6} />
                    <span>Изменить</span>
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
