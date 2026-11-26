import React from 'react';
import { Star, Wand2 } from 'lucide-react';
import {
  QUEST_ACCENT_PRESETS,
  QUEST_EMBLEM_OPTIONS,
  QUEST_PATTERN_GROUPS,
  QUEST_PATTERN_OPTIONS,
  patternsByGroup,
  questEmblemUrl,
  type TilePatternGroupId,
} from '../../lib/questStyle';
import type { TilePattern } from '../../lib/types';

export interface TileStyleValue {
  accent: string | null;
  emblem: string | null;
  pattern: TilePattern;
  isImportant: boolean;
}

export interface TileStylePreset {
  id: string;
  label: string;
  hint: string;
  patch: Partial<TileStyleValue>;
}

export const DEFAULT_TILE_STYLE_PRESETS: TileStylePreset[] = [
  {
    id: 'urgent',
    label: 'Срочно',
    hint: 'Багровый · опасность · череп',
    patch: { accent: '#f43f5e', pattern: 'hazard', emblem: 'skull', isImportant: true },
  },
  {
    id: 'epic',
    label: 'Эпик',
    hint: 'Золото · звёзды · корона',
    patch: { accent: '#f59e0b', pattern: 'stars', emblem: 'crown', isImportant: true },
  },
  {
    id: 'arcane',
    label: 'Тайна',
    hint: 'Аметист · руны · сфера',
    patch: { accent: '#7c4dff', pattern: 'runes', emblem: 'orb', isImportant: false },
  },
  {
    id: 'hunt',
    label: 'Охота',
    hint: 'Циан · сетка · дракон',
    patch: { accent: '#00e5ff', pattern: 'grid', emblem: 'dragon', isImportant: false },
  },
  {
    id: 'stealth',
    label: 'Тихо',
    hint: 'Сталь · без узора · щит',
    patch: { accent: '#94a3b8', pattern: 'none', emblem: 'shield', isImportant: false },
  },
];

interface TileStyleControlsProps {
  value: TileStyleValue;
  onChange: (patch: Partial<TileStyleValue>) => void;
  /** Label of the highlight toggle — "Важный" for quests, "Ключевой" for talents */
  importantLabel?: string;
  importantInactiveLabel?: string;
  presets?: TileStylePreset[];
  compact?: boolean;
}

/**
 * Shared appearance controls (accent palette, HUD emblem, pattern, highlight flag)
 * used by both the quest tile editor and the talent tile editor.
 */
export const TileStyleControls: React.FC<TileStyleControlsProps> = ({
  value,
  onChange,
  importantLabel = 'Важный',
  importantInactiveLabel = 'Обычный',
  presets = DEFAULT_TILE_STYLE_PRESETS,
  compact = false,
}) => {
  const accent = value.accent || '#00e5ff';
  const [patternGroup, setPatternGroup] = React.useState<'all' | TilePatternGroupId>('all');
  const visiblePatterns =
    patternGroup === 'all' ? QUEST_PATTERN_OPTIONS : patternsByGroup(patternGroup);

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-secondary">Подсветка</div>
        <button
          type="button"
          onClick={() => onChange({ isImportant: !value.isImportant })}
          className={`h-8 px-2.5 text-[11px] inline-flex items-center gap-1.5 border transition-colors ${
            value.isImportant
              ? 'border-[color:var(--q-accent-strong)] text-text'
              : 'border-border text-secondary hover:text-text'
          }`}
          style={{ ['--q-accent-strong' as string]: `${accent}80` }}
          aria-pressed={value.isImportant}
        >
          <Star
            className="w-3.5 h-3.5"
            strokeWidth={1.6}
            fill={value.isImportant ? 'currentColor' : 'none'}
            style={{ color: value.isImportant ? accent : undefined }}
          />
          <span>{value.isImportant ? importantLabel : importantInactiveLabel}</span>
        </button>
      </div>

      <div className="space-y-1.5">
        <div className="text-xs text-secondary inline-flex items-center gap-1.5">
          <Wand2 className="w-3.5 h-3.5 text-muted" strokeWidth={1.5} />
          <span>Готовые стили</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {presets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => onChange(preset.patch)}
              title={preset.hint}
              className="h-7 px-2 text-[11px] bg-deep border border-border text-secondary hover:text-text hover:border-border/80 transition-colors inline-flex items-center gap-1.5"
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: preset.patch.accent || '#00e5ff' }}
              />
              <span>{preset.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="text-xs text-secondary">Акцентный цвет</div>
        <div className="flex flex-wrap items-center gap-1.5">
          {QUEST_ACCENT_PRESETS.map((preset) => {
            const active = (value.accent || '').toLowerCase() === preset.hex;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onChange({ accent: preset.hex })}
                title={preset.label}
                aria-pressed={active}
                className={`w-7 h-7 border transition-transform hover:scale-105 ${
                  active ? 'border-text' : 'border-border'
                }`}
                style={{
                  backgroundColor: preset.hex,
                  boxShadow: active ? `0 0 10px -1px ${preset.hex}` : undefined,
                }}
              />
            );
          })}
          <label
            className="h-7 px-2 text-[11px] bg-deep border border-border text-secondary hover:text-text inline-flex items-center gap-1.5 cursor-pointer"
            title="Свой цвет"
          >
            <input
              type="color"
              value={accent}
              onChange={(e) => onChange({ accent: e.target.value })}
              className="w-4 h-4 bg-transparent border-0 p-0 cursor-pointer"
            />
            <span>Свой</span>
          </label>
          {value.accent && (
            <button
              type="button"
              onClick={() => onChange({ accent: null })}
              className="h-7 px-2 text-[11px] border border-border text-muted hover:text-text"
              title="Вернуть цвет по умолчанию"
            >
              Авто
            </button>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="text-xs text-secondary">Эмблема</div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => onChange({ emblem: null })}
            className={`h-9 px-2 text-[11px] border transition-colors ${
              value.emblem ? 'border-border text-muted hover:text-text' : 'border-text text-text'
            }`}
          >
            Без
          </button>
          {QUEST_EMBLEM_OPTIONS.map((emblem) => {
            const active = value.emblem === emblem.id;
            return (
              <button
                key={emblem.id}
                type="button"
                onClick={() => onChange({ emblem: emblem.id })}
                title={emblem.label}
                aria-pressed={active}
                className={`w-9 h-9 flex items-center justify-center border transition-colors ${
                  active ? 'border-text bg-raised' : 'border-border bg-deep hover:bg-raised/70'
                }`}
              >
                <img
                  src={questEmblemUrl(emblem.id) ?? ''}
                  alt={emblem.label}
                  draggable={false}
                  className="w-5 h-5 object-contain"
                />
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs text-secondary">Узор фона</div>
          <span className="text-[10px] font-mono text-muted">
            {QUEST_PATTERN_OPTIONS.length} вариантов
          </span>
        </div>

        <div className="flex flex-wrap gap-1">
          {(
            [
              { id: 'all' as const, label: 'Все' },
              ...QUEST_PATTERN_GROUPS.map((g) => ({ id: g.id, label: g.label })),
            ]
          ).map((group) => {
            const active = patternGroup === group.id;
            const count =
              group.id === 'all'
                ? QUEST_PATTERN_OPTIONS.length
                : patternsByGroup(group.id as TilePatternGroupId).length;
            return (
              <button
                key={group.id}
                type="button"
                onClick={() => setPatternGroup(group.id)}
                aria-pressed={active}
                className={`h-6 px-1.5 text-[10px] border transition-colors ${
                  active
                    ? 'border-text text-text bg-raised'
                    : 'border-border text-muted hover:text-text'
                }`}
              >
                {group.label}
                <span className="ml-1 font-mono opacity-70">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 max-h-60 overflow-y-auto pr-1">
          {visiblePatterns.map((pattern) => {
            const active = value.pattern === pattern.id;
            return (
              <button
                key={pattern.id}
                type="button"
                onClick={() => onChange({ pattern: pattern.id })}
                title={pattern.description}
                aria-pressed={active}
                className={`relative h-12 border overflow-hidden text-left transition-colors ${
                  active
                    ? 'border-text bg-raised'
                    : 'border-border bg-deep hover:bg-raised/70'
                }`}
                style={{
                  ['--q-accent' as string]: accent,
                  ['--q-accent-soft' as string]: `${accent}55`,
                }}
              >
                {pattern.id !== 'none' ? (
                  <span
                    aria-hidden
                    className={`quest-tile__pattern quest-pattern--${pattern.id}`}
                    style={{ opacity: 0.9 }}
                  />
                ) : (
                  <span
                    aria-hidden
                    className="absolute inset-0"
                    style={{
                      background:
                        'linear-gradient(135deg, rgba(255,255,255,0.04), transparent 60%)',
                    }}
                  />
                )}
                <span className="absolute inset-x-0 bottom-0 z-10 px-1 py-0.5 text-[9px] leading-tight text-text bg-gradient-to-t from-black/80 to-transparent truncate">
                  {pattern.label}
                </span>
                {active && (
                  <span
                    className="absolute top-0 right-0 z-10 w-3 h-3"
                    style={{ backgroundColor: accent }}
                    aria-hidden
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
