/**
 * Конфигурация клиента доски.
 *
 * tldraw SDK в production требует ключ лицензии (без него SDK показывает
 * watermark). Ключ прокидывается через переменную сборки Vite:
 *   VITE_TLDRAW_LICENSE_KEY=...   (см. README → «Доска (tldraw)»)
 *
 * В dev/preview ключ не обязателен.
 */
const rawEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};

export const TLDRAW_LICENSE_KEY: string | undefined =
  rawEnv.VITE_TLDRAW_LICENSE_KEY?.trim() || undefined;

export const BOARD_COLORS = [
  '#22d3ee',
  '#a855f7',
  '#4cc38a',
  '#e5a93b',
  '#f472b6',
  '#60a5fa',
  '#f87171',
] as const;

export const colorForUser = (userId: number, accent?: string): string => {
  if (accent && /^#[0-9a-fA-F]{3,8}$/.test(accent)) return accent;
  return BOARD_COLORS[Math.abs(userId) % BOARD_COLORS.length];
};
