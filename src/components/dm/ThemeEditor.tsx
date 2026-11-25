import React, { useEffect, useState } from 'react';
import { Check, Palette, RotateCcw, Sparkles } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import {
  ANIME_THEME_PRESETS,
  DEFAULT_ANIME_THEME,
  hexToGlow,
  themeToScopedStyle,
} from '../../lib/theme';
import { useCampaignStore } from '../../lib/store';
import type { AuthUser, CharacterProfile, ThemeVariables } from '../../lib/types';

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
        if (res.users.length > 0) {
          const first = res.users[0];
          setSelectedUserId(first.id);
          setDraftTheme({ ...first.theme });
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
    setDraftTheme({ ...u.theme });
  };

  const updateField = (key: keyof ThemeVariables, value: string) => {
    setDraftTheme((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'primary') {
        next.glow = hexToGlow(value, 0.42);
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
      if (currentUser?.id === selectedUserId) {
        applyLiveTheme(res.theme);
      }
      pushToast({
        title: 'Тема применена и сохранена в D1',
        message: 'Аккаунт получил обновлённые CSS-переменные в реальном времени.',
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
    { key: 'bg', label: 'Глубокий фон', cssVar: '--bg' },
    { key: 'surface', label: 'Стеклянная панель', cssVar: '--surface' },
    { key: 'primary', label: 'Основной неон', cssVar: '--primary' },
    { key: 'accent', label: 'Вторичный акцент', cssVar: '--accent' },
    { key: 'text', label: 'Основной текст', cssVar: '--text' },
    { key: 'textMuted', label: 'Приглушённый текст', cssVar: '--text-muted' },
    { key: 'border', label: 'Граница панелей', cssVar: '--border' },
  ];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
      {/* Left Column: Account Picker + Color Pickers + Presets */}
      <div className="xl:col-span-7 glass-panel rounded-3xl p-6 space-y-5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2.5">
            <Palette className="w-5 h-5 text-primary" />
            <div>
              <h3 className="font-anime font-bold text-lg">
                Кастомизация аниме-темы для каждого аккаунта
              </h3>
              <p className="text-xs text-muted">
                Таблица D1: <code>user_themes (user_id, theme_json)</code>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setDraftTheme({ ...DEFAULT_ANIME_THEME })}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-xs text-muted hover:text-text"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Базовая тёмная
          </button>
        </div>

        {/* Account Selector (DM, Player 1, Player 2, Player 3) */}
        <div className="space-y-1.5">
          <div className="text-xs text-muted font-medium">Выберите аккаунт:</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {accounts.map((acc) => {
              const active = acc.id === selectedUserId;
              return (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => handleSelectAccount(acc)}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    active
                      ? 'bg-primary/20 border-primary shadow-neon'
                      : 'bg-bg/60 border-border hover:border-primary/40'
                  }`}
                >
                  <div className="text-xs font-anime font-bold truncate">
                    {acc.role === 'dm' ? '👑 Мастер (dm)' : `⚔ Игрок ${acc.playerId}`}
                  </div>
                  <div className="text-[11px] text-muted truncate mt-0.5">{acc.displayName}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Curated Anime Presets */}
        <div className="space-y-1.5">
          <div className="text-xs text-muted font-medium">Готовые неоновые пресеты:</div>
          <div className="flex flex-wrap gap-2">
            {ANIME_THEME_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setDraftTheme({ ...preset.theme })}
                className="px-3 py-1.5 rounded-xl border border-border bg-bg/60 hover:border-primary text-xs flex items-center gap-2 transition-colors"
                title={preset.subtitle}
              >
                <span
                  className="w-3 h-3 rounded-full"
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
              className="p-3 rounded-2xl bg-bg/60 border border-border flex items-center justify-between gap-3"
            >
              <div>
                <div className="text-xs font-semibold">{label}</div>
                <code className="text-[11px] text-muted">{cssVar}</code>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={draftTheme[key].startsWith('#') ? draftTheme[key] : '#a855f7'}
                  onChange={(e) => updateField(key, e.target.value)}
                  className="w-9 h-9 rounded-lg bg-transparent cursor-pointer border-0"
                />
                <input
                  type="text"
                  value={draftTheme[key]}
                  onChange={(e) => updateField(key, e.target.value)}
                  className="anime-input w-24 text-xs font-mono py-1.5 px-2"
                />
              </div>
            </div>
          ))}

          <div className="p-3 rounded-2xl bg-bg/60 border border-border flex flex-col justify-center gap-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold">Свечение неона</span>
              <code className="text-[11px] text-muted">--glow</code>
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
            onClick={handleApplyTheme}
            className="anime-btn-primary px-6 py-2.5 text-sm inline-flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            <span>
              {saving
                ? 'Применение...'
                : `Применить для ${selectedAccount?.username || 'аккаунта'}`}
            </span>
          </button>
        </div>
      </div>

      {/* Right Column: Live Isolated Real-Time Mini-Preview (without saving!) */}
      <div className="xl:col-span-5 space-y-3">
        <div className="text-xs uppercase tracking-wider text-muted font-semibold px-1">
          Живой предпросмотр (в реальном времени, до сохранения)
        </div>

        <div
          style={themeToScopedStyle(draftTheme)}
          className="rounded-3xl p-5 space-y-4 border transition-colors"
        >
          <div
            style={{
              backgroundColor: 'var(--bg)',
              color: 'var(--text)',
              borderColor: 'var(--border)',
            }}
            className="rounded-3xl p-5 border space-y-4 shadow-glass"
          >
            {/* Preview 1: Mini Character Card */}
            <div
              style={{
                backgroundColor: 'var(--surface)',
                borderColor: 'var(--primary)',
                boxShadow: '0 0 22px var(--glow)',
              }}
              className="rounded-2xl p-4 border space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div
                    style={{ color: 'var(--accent)' }}
                    className="text-[10px] font-bold uppercase tracking-widest"
                  >
                    Превью карточки персонажа
                  </div>
                  <div className="font-anime font-extrabold text-base mt-0.5">
                    {selectedAccount?.displayName || 'Аэлин Звёздный Шёпот'}
                  </div>
                </div>
                <span
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--primary) 22%, transparent)',
                    color: 'var(--primary)',
                    borderColor: 'var(--primary)',
                  }}
                  className="text-xs font-anime font-bold px-2.5 py-1 rounded-xl border"
                >
                  Ур. 5 • ХП 32/32
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />
                <span>Изучено заклинаний: 6/8 • Золото: 145 ЗМ</span>
              </div>
            </div>

            {/* Preview 2: Mini Quest Tile */}
            <div
              style={{
                backgroundColor: 'var(--surface)',
                borderColor: 'var(--border)',
              }}
              className="rounded-2xl p-4 border space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="font-anime font-bold text-sm">Поймай 10 кобольдов</div>
                <span
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--accent) 20%, transparent)',
                    color: 'var(--accent)',
                  }}
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                >
                  Активен
                </span>
              </div>

              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Выследить шайку изобретателей в Хрустальных штольнях Фрейта.
              </p>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span style={{ color: 'var(--text-muted)' }}>Прогресс</span>
                  <span className="font-anime font-bold">4 / 10</span>
                </div>
                <div
                  style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}
                  className="h-2 rounded-full border overflow-hidden"
                >
                  <div
                    style={{
                      width: '40%',
                      background: 'linear-gradient(90deg, var(--primary), var(--accent))',
                    }}
                    className="h-full rounded-full"
                  />
                </div>
              </div>

              <button
                type="button"
                style={{
                  background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                  boxShadow: '0 0 16px var(--glow)',
                }}
                className="w-full py-2 rounded-xl text-xs font-bold text-white"
              >
                Пример неоновой кнопки
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
