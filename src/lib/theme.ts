import type { CSSProperties } from 'react';
import type { AuthUser, PlayerId, ThemeVariables } from './types';

export type ThemeUserSlot = 'dm' | 'player1' | 'player2' | 'player3';

export const DEFAULT_ANIME_THEME: ThemeVariables = {
  bg: '#070B14',
  surface: '#0F172A',
  primary: '#00E5FF',
  accent: '#7C4DFF',
  text: '#E6F1FF',
  textMuted: '#8FA3BF',
  border: 'rgba(0, 229, 255, 0.40)',
  glow: 'rgba(0, 229, 255, 0.45)',
};

export interface ThemePreset {
  id: string;
  name: string;
  subtitle: string;
  theme: ThemeVariables;
}

export const ANIME_THEME_PRESETS: ThemePreset[] = [
  {
    id: 'tactical-cyan',
    name: 'TACTICAL // CYAN',
    subtitle: 'Базовый тактический циан (#00E5FF) + фиолетовый вторичный (#7C4DFF)',
    theme: DEFAULT_ANIME_THEME,
  },
  {
    id: 'vanguard-ice',
    name: 'VANGUARD // ARCTIC',
    subtitle: 'Ледяной голубой rim-контур и индиго-голограмма',
    theme: {
      bg: '#070B14',
      surface: '#0F172A',
      primary: '#38BDF8',
      accent: '#7C4DFF',
      text: '#E6F1FF',
      textMuted: '#8FA3BF',
      border: 'rgba(56, 189, 248, 0.40)',
      glow: 'rgba(56, 189, 248, 0.45)',
    },
  },
  {
    id: 'valkyrie-amber',
    name: 'VALKYRIE // SOLAR',
    subtitle: 'Янтарный тактический контур и фиолетовый импульс',
    theme: {
      bg: '#070B14',
      surface: '#0F172A',
      primary: '#FFB300',
      accent: '#7C4DFF',
      text: '#E6F1FF',
      textMuted: '#8FA3BF',
      border: 'rgba(255, 179, 0, 0.40)',
      glow: 'rgba(255, 179, 0, 0.45)',
    },
  },
  {
    id: 'phantom-crimson',
    name: 'PHANTOM // MAGENTA',
    subtitle: 'Агрессивный неоново-малиновый rim-свет оперативника',
    theme: {
      bg: '#070B14',
      surface: '#0F172A',
      primary: '#FF2E93',
      accent: '#7C4DFF',
      text: '#E6F1FF',
      textMuted: '#8FA3BF',
      border: 'rgba(255, 46, 147, 0.40)',
      glow: 'rgba(255, 46, 147, 0.45)',
    },
  },
  {
    id: 'wraith-emerald',
    name: 'WRAITH // MATRIX',
    subtitle: 'Изумрудный био-неон и холодный тактический обсидиан',
    theme: {
      bg: '#070B14',
      surface: '#0F172A',
      primary: '#00F5A0',
      accent: '#7C4DFF',
      text: '#E6F1FF',
      textMuted: '#8FA3BF',
      border: 'rgba(0, 245, 160, 0.40)',
      glow: 'rgba(0, 245, 160, 0.45)',
    },
  },
];

const LEGACY_SEED_BGS = new Set(['#0f0f1a', '#0b1020', '#130f1c', '#120b16']);
const LEGACY_SEED_SURFACES = new Set(['#1a1a2e', '#151d36', '#211a30', '#201329']);

export function hexToGlow(hex: string, alpha = 0.45): string {
  const cleaned = hex.replace('#', '').trim();
  if (cleaned.length !== 6) return DEFAULT_ANIME_THEME.glow;
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return DEFAULT_ANIME_THEME.glow;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Normalizes stored `user_themes` JSON while upgrading untouched legacy seed dark-purple
 * backgrounds to `#070B14` / `#0F172A` and `#00E5FF` fallback when uncustomized.
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

    const primary = rawPrimary || DEFAULT_ANIME_THEME.primary;
    const accent = isLegacySeedBg ? DEFAULT_ANIME_THEME.accent : rawAccent || DEFAULT_ANIME_THEME.accent;
    const bg = !rawBg || isLegacySeedBg ? DEFAULT_ANIME_THEME.bg : rawBg;
    const surface =
      !rawSurface || isLegacySeedSurface ? DEFAULT_ANIME_THEME.surface : rawSurface;
    const text =
      !parsed.text || isLegacySeedBg ? DEFAULT_ANIME_THEME.text : parsed.text;
    const textMuted =
      !parsed.textMuted || isLegacySeedBg ? DEFAULT_ANIME_THEME.textMuted : parsed.textMuted;
    const border =
      !parsed.border || isLegacySeedBg ? hexToGlow(primary, 0.4) : parsed.border;
    const glow =
      !parsed.glow || isLegacySeedBg ? hexToGlow(primary, 0.45) : parsed.glow;

    return {
      bg,
      surface,
      primary,
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
    primary: '#FFB300',
    border: hexToGlow('#FFB300', 0.4),
    glow: hexToGlow('#FFB300', 0.45),
  },
  player3: {
    ...DEFAULT_ANIME_THEME,
    primary: '#FF2E93',
    border: hexToGlow('#FF2E93', 0.4),
    glow: hexToGlow('#FF2E93', 0.45),
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

/**
 * Applies per-user palette strictly via `[data-theme-user="player1|player2|player3|dm"]`
 * CSS variable rules without duplicating component styles or clobbering nested slot cards.
 */
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

/**
 * Generates an inline CSSProperties object with scoped CSS variables for live preview
 * inside ThemeEditor without mutating documentElement or saving to D1.
 */
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
