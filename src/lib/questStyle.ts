import { getHudAssetUrl, isHudAssetKey, type HudAssetKey } from './hudIcons';
import type { Quest, QuestStatus, QuestTilePattern, QuestTileStyle } from './types';

export type QuestAccentPreset = {
  id: string;
  label: string;
  hex: string;
};

/** Curated HUD accents for quest tiles — "important" ones sit at the top of the list. */
export const QUEST_ACCENT_PRESETS: QuestAccentPreset[] = [
  { id: 'crimson', label: 'Багровый', hex: '#f43f5e' },
  { id: 'amber', label: 'Золото', hex: '#f59e0b' },
  { id: 'toxic', label: 'Токсин', hex: '#a3e635' },
  { id: 'emerald', label: 'Изумруд', hex: '#10b981' },
  { id: 'cyan', label: 'Циан', hex: '#00e5ff' },
  { id: 'azure', label: 'Лазурь', hex: '#3b82f6' },
  { id: 'violet', label: 'Аметист', hex: '#7c4dff' },
  { id: 'magenta', label: 'Магента', hex: '#e879f9' },
  { id: 'steel', label: 'Сталь', hex: '#94a3b8' },
  { id: 'ash', label: 'Пепел', hex: '#64748b' },
];

export type TilePatternGroupId =
  | 'plain'
  | 'geometry'
  | 'magic'
  | 'tech'
  | 'danger'
  | 'nature';

export interface TilePatternGroup {
  id: TilePatternGroupId;
  label: string;
}

export const QUEST_PATTERN_GROUPS: TilePatternGroup[] = [
  { id: 'plain', label: 'Чистые' },
  { id: 'geometry', label: 'Геометрия' },
  { id: 'magic', label: 'Магия' },
  { id: 'tech', label: 'Техно' },
  { id: 'danger', label: 'Опасность' },
  { id: 'nature', label: 'Природа' },
];

export interface QuestPatternOption {
  id: QuestTilePattern;
  label: string;
  description: string;
  group: TilePatternGroupId;
}

/** 34 decorative tile fills, grouped by mood. CSS lives in src/index.css. */
export const QUEST_PATTERN_OPTIONS: QuestPatternOption[] = [
  { id: 'none', label: 'Чистая', description: 'Ровная поверхность без узора', group: 'plain' },

  // — Geometry —
  { id: 'grid', label: 'Сетка', description: 'Тактическая координатная сетка', group: 'geometry' },
  { id: 'dots', label: 'Точки', description: 'Ровный точечный матричный фон', group: 'geometry' },
  { id: 'diagonal', label: 'Диагональ', description: 'Тонкие диагональные линии', group: 'geometry' },
  { id: 'crosshatch', label: 'Кресты', description: 'Перекрещенная штриховка', group: 'geometry' },
  { id: 'diamonds', label: 'Ромбы', description: 'Ромбовидная решётка', group: 'geometry' },
  { id: 'hex', label: 'Гексы', description: 'Соты из шестиугольников', group: 'geometry' },
  { id: 'triangles', label: 'Треугольники', description: 'Зубчатые треугольные клинья', group: 'geometry' },
  { id: 'chevron', label: 'Шевроны', description: 'Строгие V-образные полосы', group: 'geometry' },
  { id: 'stripes', label: 'Полосы', description: 'Вертикальные технические полосы', group: 'geometry' },
  { id: 'rings', label: 'Кольца', description: 'Концентрические окружности', group: 'geometry' },
  { id: 'plaid', label: 'Клетка', description: 'Тканая клетка тёмного сукна', group: 'geometry' },
  { id: 'blueprint', label: 'Чертёж', description: 'Инженерная сетка с крупными осями', group: 'geometry' },
  { id: 'circuit', label: 'Плата', description: 'Дорожки и контакты печатной платы', group: 'geometry' },
  { id: 'barcode', label: 'Штрихкод', description: 'Неровные вертикальные штрихи', group: 'geometry' },

  // — Magic —
  { id: 'runes', label: 'Руны', description: 'Редкие глифы древнего договора', group: 'magic' },
  { id: 'stars', label: 'Звёзды', description: 'Астральная пыль и созвездия', group: 'magic' },
  { id: 'sparkles', label: 'Искры', description: 'Яркие колючие блики магии', group: 'magic' },
  { id: 'arcane', label: 'Аркана', description: 'Магический круг с делениями', group: 'magic' },
  { id: 'nebula', label: 'Туманность', description: 'Мягкие облака звёздной пыли', group: 'magic' },
  { id: 'sigil', label: 'Сигил', description: 'Большая печать-пентаграмма', group: 'magic' },
  { id: 'pulse', label: 'Пульс', description: 'Волны расходящейся энергии', group: 'magic' },

  // — Tech / HUD —
  { id: 'scanlines', label: 'Скан', description: 'Строки сканирующего HUD', group: 'tech' },
  { id: 'crt', label: 'CRT', description: 'Развёртка старого монитора', group: 'tech' },
  { id: 'datastream', label: 'Данные', description: 'Поток коротких цифровых штрихов', group: 'tech' },
  { id: 'target', label: 'Прицел', description: 'Перекрестие с кольцами захвата', group: 'tech' },

  // — Danger —
  { id: 'hazard', label: 'Опасность', description: 'Диагональные полосы тревоги', group: 'danger' },
  { id: 'flames', label: 'Пламя', description: 'Языки огня по нижней кромке', group: 'danger' },
  { id: 'cracks', label: 'Трещины', description: 'Разломы по камню и металлу', group: 'danger' },

  // — Nature & materials —
  { id: 'scales', label: 'Чешуя', description: 'Драконья чешуя рядами', group: 'nature' },
  { id: 'vines', label: 'Лозы', description: 'Ползучие стебли и усики', group: 'nature' },
  { id: 'wood', label: 'Дерево', description: 'Волокна старой древесины', group: 'nature' },
  { id: 'stone', label: 'Камень', description: 'Крапчатая каменная крошка', group: 'nature' },
  { id: 'waves', label: 'Волны', description: 'Рябь воды и морская зыбь', group: 'nature' },
];

export const QUEST_TILE_PATTERNS: QuestTilePattern[] = QUEST_PATTERN_OPTIONS.map(
  (option) => option.id
);

export function patternsByGroup(group: TilePatternGroupId): QuestPatternOption[] {
  return QUEST_PATTERN_OPTIONS.filter((option) => option.group === group);
}

export const QUEST_EMBLEM_OPTIONS: Array<{ id: HudAssetKey; label: string }> = [
  { id: 'dice', label: 'Дайс d20' },
  { id: 'dragon', label: 'Дракон' },
  { id: 'skull', label: 'Череп' },
  { id: 'crown', label: 'Корона' },
  { id: 'blades', label: 'Клинки' },
  { id: 'shield', label: 'Щит' },
  { id: 'orb', label: 'Сфера' },
  { id: 'flame', label: 'Пламя' },
  { id: 'bolt', label: 'Разряд' },
  { id: 'spark', label: 'Искра' },
];

const PATTERN_SET = new Set<string>(QUEST_TILE_PATTERNS);

export function normalizeQuestAccent(raw?: string | null): string | null {
  const value = (raw || '').trim();
  if (!value) return null;
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return value.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(value)) {
    return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`.toLowerCase();
  }
  const preset = QUEST_ACCENT_PRESETS.find((p) => p.id === value.toLowerCase());
  return preset ? preset.hex : null;
}

export function normalizeQuestPattern(raw?: string | null): QuestTilePattern {
  const value = (raw || '').trim().toLowerCase();
  return (PATTERN_SET.has(value) ? value : 'none') as QuestTilePattern;
}

export function normalizeQuestTileStyle(input: {
  tileAccent?: string | null;
  tileEmblem?: string | null;
  tilePattern?: string | null;
  isImportant?: boolean;
}): QuestTileStyle {
  const emblem = (input.tileEmblem || '').trim();
  return {
    accent: normalizeQuestAccent(input.tileAccent),
    emblem: isHudAssetKey(emblem) ? emblem : null,
    pattern: normalizeQuestPattern(input.tilePattern),
    isImportant: Boolean(input.isImportant),
  };
}

const STATUS_ACCENT: Record<QuestStatus, string> = {
  active: '#00e5ff',
  available: '#94a3b8',
  completed: '#10b981',
  failed: '#f43f5e',
};

export function resolveQuestAccent(quest: Pick<Quest, 'status' | 'tileStyle'>): string {
  return quest.tileStyle?.accent || STATUS_ACCENT[quest.status] || STATUS_ACCENT.active;
}

/** Generic accent CSS variables for any tile (quests, talents, …). */
export function tileCssVars(
  style: { accent?: string | null; isImportant?: boolean } | null | undefined,
  fallbackAccent: string
): Record<string, string> {
  const accent = style?.accent || fallbackAccent;
  const important = Boolean(style?.isImportant);
  return {
    '--q-accent': accent,
    '--q-accent-soft': `${accent}2e`,
    '--q-accent-strong': `${accent}80`,
    '--q-glow': important ? `${accent}55` : 'transparent',
  };
}

export function questEmblemUrl(emblem?: string | null): string | null {
  if (!emblem || !isHudAssetKey(emblem)) return null;
  return getHudAssetUrl(emblem);
}

/** Inline CSS custom properties consumed by `.quest-tile` styles in index.css. */
export function questTileCssVars(
  quest: Pick<Quest, 'status' | 'tileStyle'>
): Record<string, string> {
  return tileCssVars(quest.tileStyle, resolveQuestAccent(quest));
}

/** Talents default to an arcane violet, gold when marked as a key talent. */
export function talentAccentFallback(style?: { isImportant?: boolean } | null): string {
  return style?.isImportant ? '#f59e0b' : '#7c4dff';
}
