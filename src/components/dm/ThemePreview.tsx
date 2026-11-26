import React from 'react';
import { getHudAssetUrl } from '../../lib/hudIcons';
import { themeToScopedStyle } from '../../lib/theme';
import type { AuthUser, ThemeVariables } from '../../lib/types';

export interface ThemePreviewProps {
  draftTheme: ThemeVariables;
  selectedAccount: AuthUser | null;
}

/**
 * Isolated real-time preview of per-account CSS variables.
 * Renders a mini Character Select card and a mini Quest card using inline scoped
 * CSS variables — never writes to D1 or global DOM until saved.
 */
export const ThemePreview: React.FC<ThemePreviewProps> = ({
  draftTheme,
  selectedAccount,
}) => {
  const operatorLabel =
    selectedAccount?.role === 'dm'
      ? 'Мастер кампании'
      : `Игрок ${selectedAccount?.playerId ?? 1}`;

  return (
    <div className="space-y-2">
      <div className="text-xs text-muted px-1">
        Живое превью темы (до сохранения)
      </div>

      <div
        style={{
          ...themeToScopedStyle(draftTheme),
          backgroundColor: draftTheme.bg,
          color: 'var(--text)',
          borderColor: 'var(--border)',
        }}
        className="p-5 border hud-cut space-y-4 transition-colors"
      >
        {/* Preview 1: Active Character Card with Personal Contour */}
        <div
          style={{
            backgroundColor: '#1a1e28',
            borderColor: 'color-mix(in srgb, var(--primary) 65%, transparent)',
            boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.08)',
          }}
          className="p-4 border hud-cut space-y-3"
        >
          <div className="flex items-stretch gap-3">
            <div
              style={{
                borderColor: 'color-mix(in srgb, var(--primary) 55%, transparent)',
                backgroundColor: '#07080d',
              }}
              className="w-14 h-16 border relative flex items-center justify-center shrink-0"
            >
              <svg viewBox="0 0 80 100" className="absolute inset-0 w-full h-full">
                <path
                  d="M40 14 C49 14 54 21 53 31 C52 38 48 43 46 46 L66 56 L72 98 L8 98 L14 56 L34 46 C32 43 28 38 27 31 C26 21 31 14 40 14 Z"
                  fill="#11141c"
                  stroke="var(--primary)"
                  strokeWidth="1.5"
                />
              </svg>
              <img
                src={getHudAssetUrl(selectedAccount?.role === 'dm' ? 'crown' : 'blades')}
                alt=""
                draggable={false}
                className="relative z-10 w-7 h-7 object-cover mix-blend-lighten opacity-75 mt-4"
              />
            </div>

            <div className="min-w-0 flex-1 flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2">
                <span style={{ color: 'var(--text-muted)' }} className="text-xs">
                  {operatorLabel}
                </span>
                <span
                  style={{
                    borderColor: 'var(--border)',
                    backgroundColor: '#11141c',
                  }}
                  className="font-mono text-xs px-1.5 py-0.5 border tabular-nums"
                >
                  Ур. 7
                </span>
              </div>

              <div>
                <div className="font-medium text-sm truncate">
                  {selectedAccount?.displayName || 'Герой отряда'}
                </div>
                <div style={{ color: 'var(--text-muted)' }} className="text-xs truncate">
                  Контур активной карточки героя
                </div>
              </div>

              <div
                style={{ backgroundColor: '#07080d' }}
                className="h-1 w-full overflow-hidden mt-1"
              >
                <div
                  style={{ width: '78%', backgroundColor: 'var(--primary)' }}
                  className="h-full"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Preview 2: Quiet Quest Card */}
        <div
          style={{
            backgroundColor: draftTheme.surface,
            borderColor: 'var(--border)',
          }}
          className="p-4 border hud-cut space-y-3"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-medium text-sm">
                Осколки Астрального шпиля
              </div>
              <p style={{ color: 'var(--text-muted)' }} className="text-xs mt-1">
                Проверка контраста текста, фона и акцентной шкалы прогресса
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs shrink-0">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: 'var(--primary)' }}
              />
              <span>Активен</span>
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between font-mono text-xs tabular-nums">
              <span style={{ color: 'var(--text-muted)' }}>Прогресс</span>
              <span>6 из 10</span>
            </div>
            <div className="grid grid-cols-10 gap-1">
              {Array.from({ length: 10 }, (_, idx) => (
                <span
                  key={idx}
                  style={{
                    backgroundColor: idx < 6 ? 'var(--primary)' : '#07080d',
                  }}
                  className="h-1.5"
                />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              style={{
                backgroundColor: 'var(--primary)',
                color: '#07080d',
                borderColor: 'var(--primary)',
              }}
              className="h-8 text-xs font-medium border"
            >
              Главное действие
            </button>
            <button
              type="button"
              style={{
                backgroundColor: '#1a1e28',
                color: 'var(--text)',
                borderColor: 'var(--border)',
              }}
              className="h-8 text-xs font-medium border"
            >
              Вторичная кнопка
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
