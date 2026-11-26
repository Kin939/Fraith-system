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

export const QUEST_TILE_PATTERNS: QuestTilePattern[] = [
  'none',
  'runes',
  'grid',
  'hazard',
  'stars',
  'scanlines',
];

export const QUEST_PATTERN_OPTIONS: Array<{
  id: QuestTilePattern;
  label: string;
  description: string;
}> = [
  { id: 'none', label: 'Чистая', description: 'Ровная поверхность без узора' },
  { id: 'runes', label: 'Руны', description: 'Редкие глифы древнего договора' },
  { id: 'grid', label: 'Сетка', description: 'Тактическая координатная сетка' },
  { id: 'hazard', label: 'Опасность', description: 'Диагональные полосы тревоги' },
  { id: 'stars', label: 'Звёзды', description: 'Астральная пыль и созвездия' },
  { id: 'scanlines', label: 'Скан', description: 'Строки сканирующего HUD' },
];

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

export function questEmblemUrl(emblem?: string | null): string | null {
  if (!emblem || !isHudAssetKey(emblem)) return null;
  return getHudAssetUrl(emblem);
}

/** Inline CSS custom properties consumed by `.quest-tile` styles in index.css. */
export function questTileCssVars(
  quest: Pick<Quest, 'status' | 'tileStyle'>
): Record<string, string> {
  const accent = resolveQuestAccent(quest);
  const important = Boolean(quest.tileStyle?.isImportant);
  return {
    '--q-accent': accent,
    '--q-accent-soft': `${accent}2e`,
    '--q-accent-strong': `${accent}80`,
    '--q-glow': important ? `${accent}55` : 'transparent',
  };
}
