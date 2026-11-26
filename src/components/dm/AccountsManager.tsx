import React, { useCallback, useEffect, useState } from 'react';
import {
  Check,
  Copy,
  Crown,
  Eye,
  KeyRound,
  Lock,
  RefreshCw,
  Save,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { useCampaignStore } from '../../lib/store';
import type { DmManagedAccountInfo, PlayerId } from '../../lib/types';

function generatePlayerPassword(playerId: number | null): string {
  const words = ['Blade', 'Runes', 'Spark', 'Shield', 'Draco', 'Aether', 'Raven', 'Valor'];
  const word = words[Math.floor(Math.random() * words.length)];
  const digits = Math.floor(1000 + Math.random() * 9000);
  const prefix = playerId ? `Hero${playerId}` : 'Fraith';
  return `${prefix}-${digits}-${word}`;
}

export const AccountsManager: React.FC = () => {
  const charactersById = useCampaignStore((s) => s.charactersById);
  const setDmSelectedPlayerId = useCampaignStore((s) => s.setDmSelectedPlayerId);
  const setActiveTab = useCampaignStore((s) => s.setActiveTab);
  const pushToast = useCampaignStore((s) => s.pushToast);

  const [accounts, setAccounts] = useState<DmManagedAccountInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [playerDrafts, setPlayerDrafts] = useState<Record<number, string>>({});
  const [savingUserId, setSavingUserId] = useState<number | null>(null);

  const [dmCurrentPassword, setDmCurrentPassword] = useState('');
  const [dmNewPassword, setDmNewPassword] = useState('');
  const [savingDmPassword, setSavingDmPassword] = useState(false);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ accounts: DmManagedAccountInfo[] }>('/api/dm/accounts');
      setAccounts(res.accounts);
      const drafts: Record<number, string> = {};
      for (const acc of res.accounts) {
        if (acc.role === 'player') {
          drafts[acc.id] = acc.plainPassword || '';
        }
      }
      setPlayerDrafts(drafts);
    } catch (err) {
      pushToast({
        title: 'Ошибка загрузки доступов',
        message: err instanceof Error ? err.message : 'Не удалось получить список аккаунтов',
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  const copyText = async (key: string, value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(key);
      window.setTimeout(() => setCopiedId((prev) => (prev === key ? null : prev)), 2000);
      pushToast({
        title: 'Скопировано в буфер',
        message: label,
        variant: 'success',
      });
    } catch {
      pushToast({
        title: 'Не удалось скопировать',
        message: value,
        variant: 'info',
      });
    }
  };

  const handleSavePlayerPassword = async (acc: DmManagedAccountInfo) => {
    const nextPassword = (playerDrafts[acc.id] || '').trim();
    if (nextPassword.length < 6) {
      pushToast({
        title: 'Слишком короткий пароль',
        message: 'Пароль игрока должен содержать минимум 6 символов',
        variant: 'warning',
      });
      return;
    }

    setSavingUserId(acc.id);
    try {
      const res = await apiFetch<{ accounts: DmManagedAccountInfo[] }>(
        `/api/dm/accounts/${acc.id}/password`,
        {
          method: 'PUT',
          body: JSON.stringify({ newPassword: nextPassword }),
        }
      );
      setAccounts(res.accounts);
      pushToast({
        title: `Пароль ${acc.username} обновлён`,
        message: 'Старые сессии сброшены, новый пароль сохранён',
        variant: 'success',
      });
    } catch (err) {
      pushToast({
        title: 'Ошибка смены пароля',
        message: err instanceof Error ? err.message : 'Попробуйте снова',
        variant: 'error',
      });
    } finally {
      setSavingUserId(null);
    }
  };

  const handleChangeDmPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const dmAcc = accounts.find((a) => a.role === 'dm');
    if (!dmAcc) return;

    if (dmNewPassword.trim().length < 6) {
      pushToast({
        title: 'Слишком короткий пароль',
        message: 'Новый пароль Мастера должен содержать минимум 6 символов',
        variant: 'warning',
      });
      return;
    }

    setSavingDmPassword(true);
    try {
      await apiFetch(`/api/dm/accounts/${dmAcc.id}/password`, {
        method: 'PUT',
        body: JSON.stringify({
          currentPassword: dmCurrentPassword,
          newPassword: dmNewPassword.trim(),
        }),
      });
      setDmCurrentPassword('');
      setDmNewPassword('');
      pushToast({
        title: 'Пароль Мастера изменён',
        message: 'Все посторонние сессии завершены',
        variant: 'success',
      });
    } catch (err) {
      pushToast({
        title: 'Не удалось изменить пароль Мастера',
        message: err instanceof Error ? err.message : 'Проверьте текущий пароль',
        variant: 'error',
      });
    } finally {
      setSavingDmPassword(false);
    }
  };

  const playerAccounts = accounts.filter((a) => a.role === 'player');

  return (
    <div className="space-y-6">
      {/* Players Credentials Grid */}
      <div className="glass-panel hud-cut p-6 space-y-5">
        <div className="flex items-start gap-3">
          <KeyRound className="w-4 h-4 text-muted mt-1 shrink-0" strokeWidth={1.5} />
          <div>
            <h2 className="font-medium text-base text-text">
              Индивидуальные доступы игроков
            </h2>
            <p className="text-xs text-secondary mt-0.5">
              У каждого игрока свой логин и пароль. Скопируйте пару и отправьте участнику кампании.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-muted">Загрузка доступов…</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {playerAccounts.map((acc) => {
              const pid = (acc.playerId ?? 1) as PlayerId;
              const char = charactersById[pid];
              const draftPwd = playerDrafts[acc.id] ?? acc.plainPassword ?? '';
              const isChanged = draftPwd.trim() !== (acc.plainPassword ?? '');

              return (
                <div
                  key={acc.id}
                  className="p-4 bg-bg border border-border hud-cut-sm space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="hud-keycap">
                            Игрок {pid}
                          </span>
                          <span className="font-medium text-sm text-text">
                            {char?.characterName || acc.displayName}
                          </span>
                        </div>
                        <div className="text-xs text-secondary mt-1.5 flex items-center gap-1.5">
                          <UserCheck className="w-3.5 h-3.5 text-muted" strokeWidth={1.5} />
                          <span>Логин:</span>
                          <code className="font-mono text-text">{acc.username}</code>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setDmSelectedPlayerId(pid);
                          setActiveTab('character');
                        }}
                        className="h-8 px-2.5 bg-surface border border-border text-xs text-secondary hover:text-text inline-flex items-center gap-1.5 transition-colors"
                        title="Открыть лист этого игрока"
                      >
                        <Eye className="w-3.5 h-3.5 text-muted" strokeWidth={1.5} />
                        <span>Лист</span>
                      </button>
                    </div>

                    {/* Current Active Password Readout + Copy */}
                    <div className="p-3 bg-surface border border-border space-y-2.5">
                      <div className="flex items-center justify-between text-xs text-muted">
                        <span>Текущий пароль</span>
                        {acc.updatedAt && (
                          <span className="font-mono tabular-nums">
                            {new Date(acc.updatedAt + 'Z').toLocaleDateString('ru-RU')}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <code className="font-mono text-sm text-text select-all break-all">
                          {acc.plainPassword || '—'}
                        </code>
                        <button
                          type="button"
                          onClick={() =>
                            void copyText(
                              `pwd-${acc.id}`,
                              acc.plainPassword || '',
                              `Пароль для ${acc.username} скопирован`
                            )
                          }
                          className="w-8 h-8 bg-bg border border-border text-muted hover:text-text flex items-center justify-center transition-colors shrink-0"
                          title="Скопировать пароль"
                        >
                          {copiedId === `pwd-${acc.id}` ? (
                            <Check className="w-3.5 h-3.5 text-positive" strokeWidth={1.5} />
                          ) : (
                            <Copy className="w-3.5 h-3.5" strokeWidth={1.5} />
                          )}
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          void copyText(
                            `pair-${acc.id}`,
                            `Логин: ${acc.username}\nПароль: ${acc.plainPassword || ''}`,
                            `Данные входа для игрока ${pid} скопированы`
                          )
                        }
                        className="w-full h-8 px-3 bg-raised border border-border hover:border-text/20 text-xs text-text inline-flex items-center justify-center gap-1.5 transition-colors"
                      >
                        {copiedId === `pair-${acc.id}` ? (
                          <Check className="w-3.5 h-3.5 text-positive" strokeWidth={1.5} />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-muted" strokeWidth={1.5} />
                        )}
                        <span>Скопировать логин и пароль</span>
                      </button>
                    </div>

                    {/* Change / Regenerate Player Password */}
                    <div className="space-y-1.5">
                      <label className="block text-xs text-secondary">
                        Новый пароль для {acc.username}
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={draftPwd}
                          onChange={(e) =>
                            setPlayerDrafts((prev) => ({
                              ...prev,
                              [acc.id]: e.target.value,
                            }))
                          }
                          placeholder="От 6 символов"
                          className="anime-input w-full h-9 text-xs font-mono"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setPlayerDrafts((prev) => ({
                              ...prev,
                              [acc.id]: generatePlayerPassword(pid),
                            }))
                          }
                          className="w-9 h-9 bg-surface border border-border text-muted hover:text-text flex items-center justify-center transition-colors shrink-0"
                          title="Сгенерировать пароль"
                        >
                          <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.5} />
                        </button>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={savingUserId === acc.id || !isChanged || draftPwd.trim().length < 6}
                    onClick={() => void handleSavePlayerPassword(acc)}
                    className="anime-btn-primary w-full h-9 text-xs inline-flex items-center justify-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" strokeWidth={1.5} />
                    <span>
                      {savingUserId === acc.id
                        ? 'Сохранение…'
                        : isChanged
                          ? 'Обновить пароль'
                          : 'Пароль актуален'}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* DM Own Password Security Card */}
      <div className="glass-panel hud-cut p-6 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3">
            <Crown className="w-4 h-4 text-muted mt-1 shrink-0" strokeWidth={1.5} />
            <div>
              <h3 className="font-medium text-base text-text">
                Защита аккаунта Мастера (<code>dm</code>)
              </h3>
              <p className="text-xs text-secondary mt-0.5">
                Пароль Мастера хранится только в виде криптографического хэша bcrypt с версионированием сессий.
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs text-positive">
            <ShieldCheck className="w-4 h-4" strokeWidth={1.5} />
            <span>Сессия защищена</span>
          </span>
        </div>

        <form onSubmit={handleChangeDmPassword} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div>
            <label className="block text-xs text-secondary mb-1.5">Текущий пароль Мастера</label>
            <input
              type="password"
              required
              value={dmCurrentPassword}
              onChange={(e) => setDmCurrentPassword(e.target.value)}
              placeholder="Текущий пароль"
              className="anime-input w-full h-9 text-xs"
            />
          </div>

          <div>
            <label className="block text-xs text-secondary mb-1.5">Новый пароль (от 6 символов)</label>
            <input
              type="password"
              required
              minLength={6}
              value={dmNewPassword}
              onChange={(e) => setDmNewPassword(e.target.value)}
              placeholder="Новый пароль"
              className="anime-input w-full h-9 text-xs"
            />
          </div>

          <button
            type="submit"
            disabled={savingDmPassword || !dmCurrentPassword || dmNewPassword.trim().length < 6}
            className="anime-btn-primary h-9 px-4 text-xs inline-flex items-center justify-center gap-1.5"
          >
            <Lock className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>{savingDmPassword ? 'Обновление…' : 'Сменить пароль Мастера'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
