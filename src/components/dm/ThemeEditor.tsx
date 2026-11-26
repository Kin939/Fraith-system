import React, { useEffect, useState } from 'react';
import { Check, Palette, RotateCcw } from 'lucide-react';
import { HudIcon } from '../common/HudIcon';
import { apiFetch } from '../../lib/api';
import {
  ANIME_THEME_PRESETS,
  DEFAULT_ANIME_THEME,
  hexToGlow,
  parseThemeJson,
  syncAllAccountThemes,
} from '../../lib/theme';
import { useCampaignStore } from '../../lib/store';
import type { AuthUser, CharacterProfile, ThemeVariables } from '../../lib/types';
import { ThemePreview } from './ThemePreview';

export { ThemePreview } from './ThemePreview';

export const ThemeEditor: React.FC = () => {
  const currentUser = useCampaignStore((s) => s.user);
  const applyLiveTheme = useCampaignStore((s) => s.applyLiveTheme);
  const pushToast = useCampaignStore((s) => s.pushToast);

  const [accounts, setAccounts] = useState<AuthUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number>(1);
  const [draftTheme, setDraftTheme] = useState<ThemeVariables>({ ...DEFAULT_ANIME_THEME });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch<{ users: AuthUser[]; characters: CharacterProfile[] }>(
          '/api/dm/users'
        );
        setAccounts(res.users);
        syncAllAccountThemes(res.users);
        if (res.users.length > 0) {
          const first = res.users[0];
          setSelectedUserId(first.id);
          setDraftTheme(parseThemeJson(JSON.stringify(first.theme)));
        }
      } catch (err) {
        pushToast({
          title: 'Не удалось загрузить профили тем',
          message: err instanceof Error ? err.message : 'Ошибка API',
          variant: 'error',
        });
      }
    })();
  }, [pushToast]);

  const handleSelectAccount = (u: AuthUser) => {
    setSelectedUserId(u.id);
    setDraftTheme(parseThemeJson(JSON.stringify(u.theme)));
  };

  const updateField = (key: keyof ThemeVariables, value: string) => {
    setDraftTheme((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'primary') {
        next.border = hexToGlow(value, 0.4);
        next.glow = hexToGlow(value, 0.45);
      }
      return next;
    });
  };

  const handleApplyTheme = async () => {
    setSaving(true);
    try {
      const res = await apiFetch<{ users: AuthUser[]; theme: ThemeVariables }>(
        `/api/dm/themes/${selectedUserId}`,
        {
          method: 'PUT',
          body: JSON.stringify({ theme: draftTheme }),
        }
      );
      setAccounts(res.users);
      syncAllAccountThemes(res.users);
      if (currentUser?.id === selectedUserId) {
        applyLiveTheme(res.theme);
      }
      pushToast({
        title: 'Тема применена и сохранена в D1',
        message: 'CSS-переменные аккаунта обновлены в реальном времени.',
        variant: 'success',
      });
    } catch (err) {
      pushToast({
        title: 'Ошибка сохранения темы',
        message: err instanceof Error ? err.message : 'Проверьте цвета',
        variant: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const selectedAccount = accounts.find((a) => a.id === selectedUserId) ?? null;

  const colorFields: Array<{ key: keyof ThemeVariables; label: string; cssVar: string }> = [
    { key: 'primary', label: 'Основной акцент (Rim-неон)', cssVar: '--primary' },
    { key: 'accent', label: 'Вторичный акцент (Hover)', cssVar: '--accent' },
    { key: 'bg', label: 'Глубокий фон', cssVar: '--bg' },
    { key: 'surface', label: 'Поверхность панели', cssVar: '--surface' },
    { key: 'text', label: 'Основной текст', cssVar: '--text' },
    { key: 'textMuted', label: 'Приглушённый текст', cssVar: '--text-muted' },
    { key: 'border', label: 'Граница (40% акцента)', cssVar: '--border' },
  ];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      {/* Left Column: Account Picker + Color Pickers + Presets */}
      <div className="xl:col-span-7 glass-panel hud-corners hud-cut p-6 space-y-5">
        <div className="flex items-center justify-between gap-2 flex-wrap border-b border-primary/25 pb-3">
          <div className="flex items-center gap-2.5">
            <Palette className="w-5 h-5 text-primary" />
            <div>
              <h3 className="font-anime font-bold text-lg uppercase">
                // КАСТОМИЗАЦИЯ ТЕМЫ АККАУНТА
              </h3>
              <p className="font-mono text-[11px] text-muted">
                D1 TABLE: <code>user_themes (user_id, theme_json)</code> • FALLBACK #00E5FF
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setDraftTheme({ ...DEFAULT_ANIME_THEME })}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-primary/30 bg-[#070B14] font-mono text-xs uppercase text-muted hover:text-primary hover:border-primary transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Сброс #00E5FF</span>
          </button>
        </div>

        {/* Account Selector (DM, Player 1, Player 2, Player 3) */}
        <div className="space-y-1.5">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted">
            // ВЫБЕРИТЕ ЦЕЛЕВОЙ АККАУНТ:
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {accounts.map((acc) => {
              const active = acc.id === selectedUserId;
              return (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => handleSelectAccount(acc)}
                  className={`p-3 border text-left transition-all hud-cut-sm ${
                    active
                      ? 'bg-primary/15 border-primary shadow-rim'
                      : 'bg-[#070B14]/80 border-primary/25 hover:border-primary/60'
                  }`}
                >
                  <div className="text-xs font-anime font-bold uppercase truncate flex items-center gap-1.5">
                    <HudIcon asset={acc.role === 'dm' ? 'crown' : 'blades'} size="xs" />
                    <span>{acc.role === 'dm' ? 'Мастер (dm)' : `Игрок ${acc.playerId}`}</span>
                  </div>
                  <div className="font-mono text-[10px] text-muted truncate mt-1">
                    {acc.displayName}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Curated Sci-Fi Rim Presets */}
        <div className="space-y-1.5">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted">
            // ТАКТИЧЕСКИЕ ПРЕСЕТЫ RIM-ПОДСВЕТКИ:
          </div>
          <div className="flex flex-wrap gap-2">
            {ANIME_THEME_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setDraftTheme({ ...preset.theme })}
                className="px-3 py-1.5 border border-primary/30 bg-[#070B14]/85 hover:border-primary font-mono text-xs flex items-center gap-2 transition-colors"
                title={preset.subtitle}
              >
                <span
                  className="w-2.5 h-2.5 border border-white/30"
                  style={{ backgroundColor: preset.theme.primary }}
                />
                <span>{preset.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* CSS Variable Color Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {colorFields.map(({ key, label, cssVar }) => (
            <div
              key={key}
              className="p-3 bg-[#070B14]/80 border border-primary/25 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="text-xs font-semibold truncate">{label}</div>
                <code className="text-[10px] text-muted">{cssVar}</code>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <input
                  type="color"
                  value={draftTheme[key].startsWith('#') ? draftTheme[key] : '#00E5FF'}
                  onChange={(e) => updateField(key, e.target.value)}
                  className="w-8 h-8 bg-transparent cursor-pointer border border-primary/30 p-0"
                />
                <input
                  type="text"
                  value={draftTheme[key]}
                  onChange={(e) => updateField(key, e.target.value)}
                  className="anime-input w-28 text-xs font-mono py-1.5 px-2"
                />
              </div>
            </div>
          ))}

          <div className="p-3 bg-[#070B14]/80 border border-primary/25 flex flex-col justify-center gap-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold">Свечение неона</span>
              <code className="text-[10px] text-muted">--glow</code>
            </div>
            <input
              type="text"
              value={draftTheme.glow}
              onChange={(e) => updateField('glow', e.target.value)}
              className="anime-input w-full text-xs font-mono py-1.5 px-2 mt-1"
            />
          </div>
        </div>

        <div className="flex items-center justify-end pt-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleApplyTheme()}
            className="anime-btn-primary px-6 py-2.5 text-xs inline-flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            <span>
              {saving
                ? 'Применение...'
                : `Применить (${selectedAccount?.username || 'аккаунт'})`}
            </span>
          </button>
        </div>
      </div>

      {/* Right Column: Isolated Live Preview Component */}
      <div className="xl:col-span-5 xl:sticky xl:top-5">
        <ThemePreview draftTheme={draftTheme} selectedAccount={selectedAccount} />
      </div>
    </div>
  );
};
