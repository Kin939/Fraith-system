/**
 * Пресеты шрифтов доски (кириллица + латиница).
 *
 * Каждый пресет подменяет четыре шрифтовых слота tldraw (draw / sans / serif / mono)
 * через CSS-переменные --tl-font-* (см. src/components/board/boardFonts.css).
 * Все подключённые гарнитуры содержат кириллические и латинские глифы.
 */

import '@fontsource/inter/cyrillic-400.css';
import '@fontsource/inter/latin-400.css';
import '@fontsource/pt-serif/cyrillic-400.css';
import '@fontsource/pt-serif/latin-400.css';
import '@fontsource/pt-serif/cyrillic-700.css';
import '@fontsource/pt-serif/latin-700.css';
import '@fontsource/jetbrains-mono/cyrillic-400.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import '@fontsource/caveat/cyrillic-400.css';
import '@fontsource/caveat/latin-400.css';

import '@fontsource/manrope/cyrillic-400.css';
import '@fontsource/manrope/latin-400.css';
import '@fontsource/manrope/cyrillic-700.css';
import '@fontsource/manrope/latin-700.css';
import '@fontsource/lora/cyrillic-400.css';
import '@fontsource/lora/latin-400.css';
import '@fontsource/lora/cyrillic-700.css';
import '@fontsource/lora/latin-700.css';
import '@fontsource/fira-code/cyrillic-400.css';
import '@fontsource/fira-code/latin-400.css';
import '@fontsource/neucha/cyrillic-400.css';
import '@fontsource/neucha/latin-400.css';

export type BoardFontPresetId = 'classic' | 'modern';

export interface BoardFontPreset {
  id: BoardFontPresetId;
  label: string;
  hint: string;
  faces: { draw: string; sans: string; serif: string; mono: string };
}

export const BOARD_FONT_PRESETS: BoardFontPreset[] = [
  {
    id: 'classic',
    label: 'Классика',
    hint: 'Inter · PT Serif · JetBrains Mono · Caveat',
    faces: { draw: 'Caveat', sans: 'Inter', serif: 'PT Serif', mono: 'JetBrains Mono' },
  },
  {
    id: 'modern',
    label: 'Современная',
    hint: 'Manrope · Lora · Fira Code · Neucha',
    faces: { draw: 'Neucha', sans: 'Manrope', serif: 'Lora', mono: 'Fira Code' },
  },
];

export const DEFAULT_FONT_PRESET: BoardFontPresetId = 'classic';

export function normalizeFontPreset(raw?: string | null): BoardFontPresetId {
  return raw === 'modern' ? 'modern' : DEFAULT_FONT_PRESET;
}

export function fontPresetClass(raw?: string | null): string {
  return `board-fonts--${normalizeFontPreset(raw)}`;
}
