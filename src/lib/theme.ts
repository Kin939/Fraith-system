import type { CSSProperties } from 'react';
import type { ThemeVariables } from './types';

export const DEFAULT_ANIME_THEME: ThemeVariables = {
  bg: '#0f0f1a',
  surface: '#1a1a2e',
  primary: '#a855f7',
  accent: '#22d3ee',
  text: '#f4f4fe',
  textMuted: '#94a3b8',
  border: '#2e2e4d',
  glow: 'rgba(168, 85, 247, 0.42)',
};

export interface ThemePreset {
  id: string;
  name: string;
  subtitle: string;
  theme: ThemeVariables;
}

export const ANIME_THEME_PRESETS: ThemePreset[] = [
  {
    id: 'abyssal-violet',
    name: 'Бездна Фрейта',
    subtitle: 'Базовая тёмная неоново-фиолетовая тема',
    theme: DEFAULT_ANIME_THEME,
  },
  {
    id: 'cyber-astral',
    name: 'Астральный Гримуар',
    subtitle: 'Глубокий индиго, небесный неон и розовый акцент',
    theme: {
      bg: '#0b1020',
      surface: '#151d36',
      primary: '#38bdf8',
      accent: '#f472b6',
      text: '#f0f7ff',
      textMuted: '#93a8c7',
      border: '#26365e',
      glow: 'rgba(56, 189, 248, 0.42)',
    },
  },
  {
    id: 'solar-oath',
    name: 'Клятва Затмения',
    subtitle: 'Сумеречное золото и алая заря храмовника',
    theme: {
      bg: '#130f1c',
      surface: '#211a30',
      primary: '#f59e0b',
      accent: '#fb7185',
      text: '#fdf8f3',
      textMuted: '#b5a7c7',
      border: '#3b2e54',
      glow: 'rgba(245, 158, 11, 0.38)',
    },
  },
  {
    id: 'sakura-eldritch',
    name: 'Лунная Сакура',
    subtitle: 'Мистический пурпур Архифеи и бирюзовый эфир',
    theme: {
      bg: '#120b16',
      surface: '#201329',
      primary: '#ec4899',
      accent: '#2dd4bf',
      text: '#fdf2f8',
      textMuted: '#b89cc4',
      border: '#3d224d',
      glow: 'rgba(236, 72, 153, 0.44)',
    },
  },
  {
    id: 'jade-phantom',
    name: 'Нефритовый Фантом',
    subtitle: 'Изумрудный огонь некромантии и холодный обсидиан',
    theme: {
      bg: '#091414',
      surface: '#112426',
      primary: '#10b981',
      accent: '#a78bfa',
      text: '#ecfdf5',
      textMuted: '#86b5aa',
      border: '#1f4244',
      glow: 'rgba(16, 185, 129, 0.40)',
    },
  },
];

export function hexToGlow(hex: string, alpha = 0.42): string {
  const cleaned = hex.replace('#', '').trim();
  if (cleaned.length !== 6) return DEFAULT_ANIME_THEME.glow;
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return DEFAULT_ANIME_THEME.glow;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function parseThemeJson(raw?: string | null): ThemeVariables {
  if (!raw) return { ...DEFAULT_ANIME_THEME };
  try {
    const parsed = JSON.parse(raw) as Partial<ThemeVariables>;
    return {
      bg: typeof parsed.bg === 'string' ? parsed.bg : DEFAULT_ANIME_THEME.bg,
      surface: typeof parsed.surface === 'string' ? parsed.surface : DEFAULT_ANIME_THEME.surface,
      primary: typeof parsed.primary === 'string' ? parsed.primary : DEFAULT_ANIME_THEME.primary,
      accent: typeof parsed.accent === 'string' ? parsed.accent : DEFAULT_ANIME_THEME.accent,
      text: typeof parsed.text === 'string' ? parsed.text : DEFAULT_ANIME_THEME.text,
      textMuted:
        typeof parsed.textMuted === 'string' ? parsed.textMuted : DEFAULT_ANIME_THEME.textMuted,
      border: typeof parsed.border === 'string' ? parsed.border : DEFAULT_ANIME_THEME.border,
      glow: typeof parsed.glow === 'string' ? parsed.glow : DEFAULT_ANIME_THEME.glow,
    };
  } catch {
    return { ...DEFAULT_ANIME_THEME };
  }
}

export function applyThemeToDocument(theme: ThemeVariables): void {
  const g = globalThis as unknown as {
    document?: { documentElement?: { style: { setProperty(k: string, v: string): void } } };
  };
  const root = g.document?.documentElement;
  if (!root) return;
  root.style.setProperty('--bg', theme.bg);
  root.style.setProperty('--surface', theme.surface);
  root.style.setProperty('--primary', theme.primary);
  root.style.setProperty('--accent', theme.accent);
  root.style.setProperty('--text', theme.text);
  root.style.setProperty('--text-muted', theme.textMuted);
  root.style.setProperty('--border', theme.border);
  root.style.setProperty('--glow', theme.glow);
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
