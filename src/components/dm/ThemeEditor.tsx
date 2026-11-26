import React, { useEffect, useState } from 'react';
import { Check, Palette, RotateCcw } from 'lucide-react';
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
        next.glow = hexToGlow(value, 0.22);
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
        title: 'Тема сохранена',
        message: 'Акцент аккаунта обновлён в реальном времени',
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
    { key: 'primary', label: 'Индивидуальный акцент игрока', cssVar: '--primary' },
    { key: 'accent', label: 'Вторичный оттенок (наведение)', cssVar: '--accent' },
    { key: 'bg', label: 'Фон страницы', cssVar: '--bg' },
    { key: 'surface', label: 'Поверхность карточек', cssVar: '--surface' },
    { key: 'text', label: 'Основной текст', cssVar: '--text' },
    { key: 'textMuted', label: 'Приглушённый текст', cssVar: '--text-muted' },
    { key: 'border', label: 'Тонкие разделители', cssVar: '--border' },
  ];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      <div className="xl:col-span-7 glass-panel hud-cut p-6 space-y-5">
        <div className="flex items-center justify-between gap-3 flex-wrap border-b border-border pb-4">
          <div className="flex items-center gap-2.5">
            <Palette className="w-4 h-4 text-muted" strokeWidth={1.5} />
            <div>
              <h3 className="font-medium text-base text-text">
                Персональная тема аккаунта
              </h3>
              <p className="text-xs text-muted mt-0.5">
                Индивидуальный акцент сохраняется в <code>user_themes</code> и подсвечивает активного героя
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setDraftTheme({ ...DEFAULT_ANIME_THEME })}
            className="h-8 inline-flex items-center gap-1.5 px-3 border border-border bg-bg text-xs text-secondary hover:text-text transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5 text-muted" strokeWidth={1.5} />
            <span>По умолчанию</span>
          </button>
        </div>

        {/* Account Selector */}
        <div className="space-y-2">
          <div className="text-xs text-muted">Выберите аккаунт</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {accounts.map((acc) => {
              const active = acc.id === selectedUserId;
              return (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => handleSelectAccount(acc)}
                  className={`p-3 border text-left transition-colors hud-cut-sm ${
                    active
                      ? 'bg-raised border-primary/60 text-text'
                      : 'bg-bg border-border text-secondary hover:text-text'
                  }`}
                >
                  <div className="text-xs font-medium truncate">
                    {acc.role === 'dm' ? 'Мастер (dm)' : `Игрок ${acc.playerId}`}
                  </div>
                  <div className="text-xs text-muted truncate mt-0.5">
                    {acc.displayName}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Curated Presets */}
        <div className="space-y-2">
          <div className="text-xs text-muted">Готовые акценты</div>
          <div className="flex flex-wrap gap-2">
            {ANIME_THEME_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setDraftTheme({ ...preset.theme })}
                className="h-8 px-3 border border-border bg-bg hover:bg-raised text-xs text-secondary hover:text-text flex items-center gap-2 transition-colors"
                title={preset.subtitle}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full"
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
              className="p-3 bg-bg border border-border flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="text-xs font-medium text-text truncate">{label}</div>
                <code className="text-xs text-muted">{cssVar}</code>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <input
                  type="color"
                  value={draftTheme[key].startsWith('#') ? draftTheme[key] : '#00E5FF'}
                  onChange={(e) => updateField(key, e.target.value)}
                  className="w-8 h-8 bg-transparent cursor-pointer border border-border p-0"
                />
                <input
                  type="text"
                  value={draftTheme[key]}
                  onChange={(e) => updateField(key, e.target.value)}
                  className="anime-input w-28 h-8 text-xs font-mono py-1 px-2"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-end pt-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleApplyTheme()}
            className="anime-btn-primary h-10 px-5 text-xs inline-flex items-center gap-2"
          >
            <Check className="w-4 h-4" strokeWidth={1.5} />
            <span>
              {saving
                ? 'Сохранение…'
                : `Сохранить тему (${selectedAccount?.username || 'аккаунт'})`}
            </span>
          </button>
        </div>
      </div>

      <div className="xl:col-span-5 xl:sticky xl:top-6">
        <ThemePreview draftTheme={draftTheme} selectedAccount={selectedAccount} />
      </div>
    </div>
  );
};
