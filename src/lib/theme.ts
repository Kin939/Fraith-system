import type { CSSProperties } from 'react';
import type { AuthUser, PlayerId, ThemeVariables } from './types';

export type ThemeUserSlot = 'dm' | 'player1' | 'player2' | 'player3';

export const DEFAULT_ANIME_THEME: ThemeVariables = {
  bg: '#0b0d14',
  surface: '#11141c',
  primary: '#38bdf8',
  accent: '#a3a9b8',
  text: '#eef0f5',
  textMuted: '#7a8296',
  border: 'rgba(238, 240, 245, 0.08)',
  glow: 'rgba(56, 189, 248, 0.16)',
};

export interface ThemePreset {
  id: string;
  name: string;
  subtitle: string;
  theme: ThemeVariables;
}

export const ANIME_THEME_PRESETS: ThemePreset[] = [
  {
    id: 'ink-sky',
    name: 'Холодный сланец',
    subtitle: 'Нейтральная палитра Ink (#0b0d14) и небесно-голубой акцент',
    theme: DEFAULT_ANIME_THEME,
  },
  {
    id: 'graphite-cyan',
    name: 'Графит и бирюза',
    subtitle: 'Тёмный графит (#141415) и чистый бирюзовый акцент',
    theme: {
      bg: '#141415',
      surface: '#19191b',
      primary: '#2dd4bf',
      accent: '#a1a1a6',
      text: '#ededed',
      textMuted: '#85858b',
      border: 'rgba(237, 237, 237, 0.08)',
      glow: 'rgba(45, 212, 191, 0.16)',
    },
  },
  {
    id: 'warm-amber',
    name: 'Тёплый янтарь',
    subtitle: 'Тёплый угольный фон (#161513) и янтарный акцент',
    theme: {
      bg: '#161513',
      surface: '#1c1a18',
      primary: '#e5a93b',
      accent: '#aaa398',
      text: '#efe9de',
      textMuted: '#8a847a',
      border: 'rgba(239, 233, 222, 0.08)',
      glow: 'rgba(229, 169, 59, 0.16)',
    },
  },
  {
    id: 'ember-coral',
    name: 'Алый уголь',
    subtitle: 'Сланцевый фон (#0b0d14) и приглушённый кораллово-алый акцент',
    theme: {
      bg: '#0b0d14',
      surface: '#11141c',
      primary: '#e5484d',
      accent: '#a3a9b8',
      text: '#eef0f5',
      textMuted: '#7a8296',
      border: 'rgba(238, 240, 245, 0.08)',
      glow: 'rgba(229, 72, 77, 0.16)',
    },
  },
  {
    id: 'moss-sage',
    name: 'Лесной шалфей',
    subtitle: 'Спокойный сланцевый фон и приглушённый зелёный акцент',
    theme: {
      bg: '#0b0d14',
      surface: '#11141c',
      primary: '#4cc38a',
      accent: '#a3a9b8',
      text: '#eef0f5',
      textMuted: '#7a8296',
      border: 'rgba(238, 240, 245, 0.08)',
      glow: 'rgba(76, 195, 138, 0.16)',
    },
  },
];

const LEGACY_SEED_BGS = new Set([
  '#0f0f1a',
  '#0b1020',
  '#130f1c',
  '#120b16',
  '#070b14',
]);
const LEGACY_SEED_SURFACES = new Set([
  '#1a1a2e',
  '#151d36',
  '#211a30',
  '#201329',
  '#0f172a',
]);

export function hexToGlow(hex: string, alpha = 0.16): string {
  const cleaned = hex.replace('#', '').trim();
  if (cleaned.length !== 6) return DEFAULT_ANIME_THEME.glow;
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return DEFAULT_ANIME_THEME.glow;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Normalizes stored `user_themes` JSON onto the quiet Ink neutral ramp while keeping
 * each player's distinct accent color and honoring custom ThemeEditor palettes.
 */
export function parseThemeJson(raw?: string | null): ThemeVariables {
  if (!raw) return { ...DEFAULT_ANIME_THEME };
  try {
    const parsed = JSON.parse(raw) as Partial<ThemeVariables>;
    const rawBg = typeof parsed.bg === 'string' ? parsed.bg : '';
    const rawSurface = typeof parsed.surface === 'string' ? parsed.surface : '';
    const rawPrimary = typeof parsed.primary === 'string' ? parsed.primary : '';
    const rawAccent = typeof parsed.accent === 'string' ? parsed.accent : '';

    const isLegacyUntouchedDm =
      rawBg.toLowerCase() === '#0f0f1a' && rawPrimary.toLowerCase() === '#a855f7';

    if (isLegacyUntouchedDm) {
      return { ...DEFAULT_ANIME_THEME };
    }

    const isLegacySeedBg = LEGACY_SEED_BGS.has(rawBg.toLowerCase());
    const isLegacySeedSurface = LEGACY_SEED_SURFACES.has(rawSurface.toLowerCase());

    const normalizedPrimary =
      rawPrimary.toLowerCase() === '#ec4899' || rawPrimary.toLowerCase() === '#ff2e93'
        ? '#e5484d'
        : rawPrimary.toLowerCase() === '#f59e0b' || rawPrimary.toLowerCase() === '#ffb300'
          ? '#e5a93b'
          : rawPrimary || DEFAULT_ANIME_THEME.primary;

    const accent =
      isLegacySeedBg || rawAccent.toLowerCase() === '#7c4dff'
        ? DEFAULT_ANIME_THEME.accent
        : rawAccent || DEFAULT_ANIME_THEME.accent;
    const bg = !rawBg || isLegacySeedBg ? DEFAULT_ANIME_THEME.bg : rawBg;
    const surface =
      !rawSurface || isLegacySeedSurface ? DEFAULT_ANIME_THEME.surface : rawSurface;
    const text =
      !parsed.text || isLegacySeedBg ? DEFAULT_ANIME_THEME.text : parsed.text;
    const textMuted =
      !parsed.textMuted || isLegacySeedBg ? DEFAULT_ANIME_THEME.textMuted : parsed.textMuted;
    const border =
      !parsed.border || isLegacySeedBg || parsed.border.includes('0.4')
        ? DEFAULT_ANIME_THEME.border
        : parsed.border;
    const glow = hexToGlow(normalizedPrimary, 0.16);

    return {
      bg,
      surface,
      primary: normalizedPrimary,
      accent,
      text,
      textMuted,
      border,
      glow,
    };
  } catch {
    return { ...DEFAULT_ANIME_THEME };
  }
}

export function getUserThemeSlot(
  user?: Pick<AuthUser, 'role' | 'playerId'> | null
): ThemeUserSlot {
  if (!user || user.role === 'dm') return 'dm';
  if (user.playerId === 1) return 'player1';
  if (user.playerId === 2) return 'player2';
  if (user.playerId === 3) return 'player3';
  return 'dm';
}

export function playerIdToThemeSlot(pid: PlayerId): ThemeUserSlot {
  return `player${pid}` as ThemeUserSlot;
}

const slotThemesRegistry: Record<ThemeUserSlot, ThemeVariables> = {
  dm: { ...DEFAULT_ANIME_THEME },
  player1: { ...DEFAULT_ANIME_THEME },
  player2: {
    ...DEFAULT_ANIME_THEME,
    primary: '#e5a93b',
    glow: hexToGlow('#e5a93b', 0.16),
  },
  player3: {
    ...DEFAULT_ANIME_THEME,
    primary: '#e5484d',
    glow: hexToGlow('#e5484d', 0.16),
  },
};

function renderSlotCssRule(slot: ThemeUserSlot, t: ThemeVariables): string {
  return `[data-theme-user="${slot}"] {
  --bg: ${t.bg};
  --surface: ${t.surface};
  --primary: ${t.primary};
  --accent: ${t.accent};
  --text: ${t.text};
  --text-muted: ${t.textMuted};
  --border: ${t.border};
  --glow: ${t.glow};
}`;
}

interface BrowserStyleEl {
  id: string;
  textContent: string | null;
}

interface BrowserDocLike {
  getElementById(id: string): BrowserStyleEl | null;
  createElement(tag: 'style'): BrowserStyleEl;
  head: { appendChild(el: BrowserStyleEl): void };
  documentElement: {
    getAttribute(name: string): string | null;
    setAttribute(name: string, value: string): void;
  };
}

function getBrowserDoc(): BrowserDocLike | undefined {
  return (globalThis as unknown as { document?: BrowserDocLike }).document;
}

function flushThemeSlotStylesheet(): void {
  const doc = getBrowserDoc();
  if (!doc) return;
  let styleEl = doc.getElementById('fraith-user-themes');
  if (!styleEl) {
    styleEl = doc.createElement('style');
    styleEl.id = 'fraith-user-themes';
    doc.head.appendChild(styleEl);
  }
  styleEl.textContent = (Object.keys(slotThemesRegistry) as ThemeUserSlot[])
    .map((slot) => renderSlotCssRule(slot, slotThemesRegistry[slot]))
    .join('\n');
}

export function syncAllAccountThemes(users: AuthUser[]): void {
  for (const u of users) {
    const slot = getUserThemeSlot(u);
    slotThemesRegistry[slot] = parseThemeJson(JSON.stringify(u.theme));
  }
  flushThemeSlotStylesheet();
}

export function getSlotTheme(slot: ThemeUserSlot): ThemeVariables {
  return slotThemesRegistry[slot];
}

export function applyThemeToDocument(
  theme: ThemeVariables,
  slotOverride?: ThemeUserSlot
): void {
  const doc = getBrowserDoc();
  if (!doc) return;
  const normalized = parseThemeJson(JSON.stringify(theme));
  const root = doc.documentElement;
  const activeSlot =
    slotOverride ||
    (root.getAttribute('data-theme-user') as ThemeUserSlot | null) ||
    'dm';

  slotThemesRegistry[activeSlot] = normalized;
  root.setAttribute('data-theme-user', activeSlot);
  flushThemeSlotStylesheet();
}

export function themeToScopedStyle(theme: ThemeVariables): CSSProperties {
  return {
    '--bg': theme.bg,
    '--surface': theme.surface,
    '--primary': theme.primary,
    '--accent': theme.accent,
    '--text': theme.text,
    '--text-muted': theme.textMuted,
    '--border': theme.border,
    '--glow': theme.glow,
  } as CSSProperties;
}
