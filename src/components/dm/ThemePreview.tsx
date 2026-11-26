import React from 'react';
import { Clock } from 'lucide-react';
import { getHudAssetUrl } from '../../lib/hudIcons';
import { themeToScopedStyle } from '../../lib/theme';
import type { AuthUser, ThemeVariables } from '../../lib/types';

export interface ThemePreviewProps {
  draftTheme: ThemeVariables;
  selectedAccount: AuthUser | null;
}

/**
 * Isolated real-time preview of per-account CSS variables.
 * Renders a mini Character Select rim-lit card and a mini Quest tile with segmented
 * progress using inline scoped CSS variables — never writes to D1 or global DOM.
 */
export const ThemePreview: React.FC<ThemePreviewProps> = ({
  draftTheme,
  selectedAccount,
}) => {
  const operatorLabel =
    selectedAccount?.role === 'dm'
      ? 'MASTER // ARCHITECT'
      : `UNIT // P0${selectedAccount?.playerId ?? 1}`;

  return (
    <div className="space-y-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary font-bold px-1">
        // LIVE PREVIEW (REAL-TIME, ДО ЗАПИСИ В D1)
      </div>

      <div
        style={{
          ...themeToScopedStyle(draftTheme),
          background: `radial-gradient(circle at 50% 35%, #0B1220 0%, ${draftTheme.bg} 78%)`,
          color: 'var(--text)',
          borderColor: 'color-mix(in srgb, var(--primary) 40%, transparent)',
        }}
        className="p-5 border hud-cut hud-corners space-y-4 transition-colors duration-200"
      >
        {/* Preview 1: Mini Sci-Fi Anime Character Select Card with Rim-Lighting */}
        <div
          style={{
            backgroundColor: 'color-mix(in srgb, var(--surface) 88%, transparent)',
            borderColor: 'var(--primary)',
            boxShadow: '0 0 0 1px var(--primary), 0 0 24px -6px var(--primary)',
          }}
          className="p-3.5 border hud-cut space-y-3 relative overflow-hidden"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-20"
            style={{
              background: 'linear-gradient(125deg, var(--primary) 0%, transparent 55%)',
            }}
          />

          <div className="relative z-10 flex items-stretch gap-3">
            <div
              style={{
                borderColor: 'var(--primary)',
                backgroundColor: 'var(--bg)',
                boxShadow: '0 0 14px -4px var(--primary)',
              }}
              className="w-14 h-16 border relative flex items-center justify-center shrink-0"
            >
              <svg viewBox="0 0 80 100" className="absolute inset-0 w-full h-full">
                <path
                  d="M40 14 C49 14 54 21 53 31 C52 38 48 43 46 46 L66 56 L72 98 L8 98 L14 56 L34 46 C32 43 28 38 27 31 C26 21 31 14 40 14 Z"
                  fill="#0B1220"
                  stroke="var(--primary)"
                  strokeWidth="1.8"
                />
              </svg>
              <img
                src={getHudAssetUrl(selectedAccount?.role === 'dm' ? 'crown' : 'blades')}
                alt=""
                draggable={false}
                className="relative z-10 w-7 h-7 object-cover mix-blend-lighten mt-4"
              />
            </div>

            <div className="min-w-0 flex-1 flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2">
                <span
                  style={{ color: 'var(--primary)' }}
                  className="font-mono text-[10px] font-bold uppercase tracking-[0.16em]"
                >
                  {operatorLabel}
                </span>
                <span
                  style={{
                    borderColor: 'color-mix(in srgb, var(--primary) 55%, transparent)',
                    backgroundColor: 'var(--bg)',
                  }}
                  className="font-mono text-[10px] font-bold px-1.5 py-0.5 border tabular-nums"
                >
                  LVL 07
                </span>
              </div>

              <div>
                <div className="font-anime font-extrabold text-sm uppercase tracking-wide truncate">
                  {selectedAccount?.displayName || 'ОПЕРАТИВНИК'}
                </div>
                <div style={{ color: 'var(--text-muted)' }} className="text-[11px] truncate">
                  Пси-клинок // Rim-Lighting Active
                </div>
              </div>

              <div
                style={{
                  backgroundColor: 'var(--bg)',
                  borderColor: 'color-mix(in srgb, var(--primary) 30%, transparent)',
                }}
                className="h-1 w-full border overflow-hidden mt-1"
              >
                <div
                  style={{ width: '78%', backgroundColor: 'var(--primary)' }}
                  className="h-full"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Preview 2: Mini Quest Tile with Segmented Progress */}
        <div
          style={{
            backgroundColor: 'color-mix(in srgb, var(--surface) 85%, transparent)',
            borderColor: 'color-mix(in srgb, var(--primary) 40%, transparent)',
          }}
          className="p-3.5 border hud-cut space-y-2.5"
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <div
                style={{ color: 'var(--primary)' }}
                className="font-mono text-[9px] uppercase tracking-[0.18em]"
              >
                QUEST // DIRECTIVE 04
              </div>
              <div className="font-anime font-bold text-sm uppercase">
                Осколки Астрального Шпиля
              </div>
            </div>
            <span
              style={{
                backgroundColor: 'color-mix(in srgb, var(--primary) 16%, transparent)',
                borderColor: 'color-mix(in srgb, var(--primary) 55%, transparent)',
                color: 'var(--primary)',
              }}
              className="inline-flex items-center gap-1 font-mono text-[10px] font-bold px-2 py-0.5 border"
            >
              <Clock className="w-3 h-3" />
              ACTIVE
            </span>
          </div>

          <p style={{ color: 'var(--text-muted)' }} className="text-xs">
            Проверка читаемости текста, контраста поверхности и сегментов прогресса.
          </p>

          <div className="space-y-1">
            <div className="flex justify-between font-mono text-[10px] tabular-nums">
              <span style={{ color: 'var(--text-muted)' }}>PROGRESS</span>
              <span className="font-bold">6/10 [60%]</span>
            </div>
            <div className="grid grid-cols-10 gap-1">
              {Array.from({ length: 10 }, (_, idx) => (
                <span
                  key={idx}
                  style={
                    idx < 6
                      ? {
                          backgroundColor: 'var(--primary)',
                          borderColor: 'var(--primary)',
                          boxShadow: '0 0 8px var(--glow)',
                        }
                      : {
                          backgroundColor: 'var(--bg)',
                          borderColor: 'color-mix(in srgb, var(--primary) 24%, transparent)',
                        }
                  }
                  className="h-2 border"
                />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              style={{
                backgroundColor: 'var(--primary)',
                color: '#040810',
                borderColor: 'var(--primary)',
                boxShadow: '0 0 18px -6px var(--primary)',
              }}
              className="py-1.5 text-[11px] font-anime font-extrabold uppercase tracking-wider border"
            >
              ОСНОВНОЙ АКЦЕНТ
            </button>
            <button
              type="button"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--accent) 18%, var(--bg))',
                color: 'var(--text)',
                borderColor: 'color-mix(in srgb, var(--accent) 65%, transparent)',
              }}
              className="py-1.5 text-[11px] font-anime font-bold uppercase tracking-wider border"
            >
              ВТОРИЧНЫЙ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
