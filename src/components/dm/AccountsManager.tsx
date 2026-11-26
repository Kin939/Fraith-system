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

  // Per-player password edit drafts
  const [playerDrafts, setPlayerDrafts] = useState<Record<number, string>>({});
  const [savingUserId, setSavingUserId] = useState<number | null>(null);

  // DM self password change form
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
        message: 'Пароль игрока должен содержать минимум 6 символов.',
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
        message: 'Старые сессии этого игрока сброшены, новый пароль сохранён в этой вкладке.',
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
        message: 'Новый пароль Мастера должен содержать минимум 6 символов.',
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
        title: 'Пароль Мастера (dm) изменён',
        message: 'Все посторонние сессии принудительно завершены.',
        variant: 'success',
      });
    } catch (err) {
      pushToast({
        title: 'Не удалось изменить пароль DM',
        message: err instanceof Error ? err.message : 'Проверьте текущий пароль Мастера',
        variant: 'error',
      });
    } finally {
      setSavingDmPassword(false);
    }
  };

  const playerAccounts = accounts.filter((a) => a.role === 'player');

  return (
    <div className="space-y-5">
      {/* Players Credentials Grid */}
      <div className="glass-panel rounded-3xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-primary/20 border border-primary/40 flex items-center justify-center text-primary">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-anime font-bold text-base uppercase">
                // Индивидуальные пароли игроков (хранятся только у Мастера)
              </h2>
              <p className="text-xs text-muted">
                У каждого игрока свой отдельный логин и пароль. Отправьте каждому игроку его пару для входа.
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-muted">Загрузка доступов аккаунтов...</div>
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
                  className="p-4 rounded-2xl bg-bg/70 border border-border space-y-3.5 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/40">
                            Слот #{pid}
                          </span>
                          <span className="font-anime font-bold text-sm text-text">
                            {char?.characterName || acc.displayName}
                          </span>
                        </div>
                        <div className="text-xs text-muted mt-1 flex items-center gap-1.5">
                          <UserCheck className="w-3.5 h-3.5 text-accent" />
                          <span>Логин:</span>
                          <code className="font-mono font-bold text-text">{acc.username}</code>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setDmSelectedPlayerId(pid);
                          setActiveTab('character');
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-surface border border-border hover:border-primary/50 text-[11px] font-semibold text-muted hover:text-text inline-flex items-center gap-1 transition-colors"
                        title="Открыть лист этого игрока во вкладке «Персонаж»"
                      >
                        <Eye className="w-3.5 h-3.5 text-primary" />
                        <span>Лист</span>
                      </button>
                    </div>

                    {/* Current Active Password Readout + Copy */}
                    <div className="p-3 rounded-xl bg-surface/80 border border-primary/25 space-y-2">
                      <div className="flex items-center justify-between text-[11px] text-muted">
                        <span>Действующий пароль игрока:</span>
                        {acc.updatedAt && (
                          <span>
                            {new Date(acc.updatedAt + 'Z').toLocaleDateString('ru-RU')}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <code className="font-mono font-bold text-sm text-accent select-all break-all">
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
                          className="p-1.5 rounded-lg bg-bg/80 border border-border hover:border-accent text-muted hover:text-text transition-colors shrink-0"
                          title="Скопировать только пароль"
                        >
                          {copiedId === `pwd-${acc.id}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          void copyText(
                            `pair-${acc.id}`,
                            `Логин: ${acc.username}\nПароль: ${acc.plainPassword || ''}`,
                            `Данные входа для Игрока #${pid} скопированы`
                          )
                        }
                        className="w-full py-1.5 px-3 rounded-xl bg-primary/15 hover:bg-primary/25 border border-primary/35 text-xs font-semibold text-primary inline-flex items-center justify-center gap-1.5 transition-colors"
                      >
                        {copiedId === `pair-${acc.id}` ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>Скопировать логин + пароль</span>
                      </button>
                    </div>

                    {/* Change / Regenerate Player Password */}
                    <div className="space-y-1.5 pt-1">
                      <label className="block text-[11px] text-muted">
                        Задать новый пароль для {acc.username}:
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
                          placeholder="Новый пароль (от 6 симв.)"
                          className="anime-input w-full text-xs font-mono"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setPlayerDrafts((prev) => ({
                              ...prev,
                              [acc.id]: generatePlayerPassword(pid),
                            }))
                          }
                          className="p-2 rounded-xl bg-surface border border-border hover:border-accent text-muted hover:text-accent transition-colors shrink-0"
                          title="Сгенерировать случайный пароль"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={savingUserId === acc.id || !isChanged || draftPwd.trim().length < 6}
                    onClick={() => void handleSavePlayerPassword(acc)}
                    className="anime-btn-primary w-full py-2 text-xs inline-flex items-center justify-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>
                      {savingUserId === acc.id
                        ? 'Сохранение...'
                        : isChanged
                          ? 'Обновить пароль игрока'
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
      <div className="glass-panel rounded-3xl p-5 border border-amber-500/30 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 shrink-0">
            <Crown className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-anime font-bold text-sm uppercase flex items-center gap-2 flex-wrap">
              <span>// Защита аккаунта Мастера (`dm`)</span>
              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300">
                <ShieldCheck className="w-3 h-3" />
                Защищено bcrypt + версией сессии
              </span>
            </h3>
            <p className="text-xs text-muted mt-0.5">
              Пароль Мастера хранится только в виде криптографического хэша (не выводится на экран), а вход без него заблокирован. Ниже вы можете при желании сменить пароль `dm`.
            </p>
          </div>
        </div>

        <form onSubmit={handleChangeDmPassword} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div>
            <label className="block text-xs text-muted mb-1">Текущий пароль DM</label>
            <input
              type="password"
              required
              value={dmCurrentPassword}
              onChange={(e) => setDmCurrentPassword(e.target.value)}
              placeholder="Текущий пароль dm..."
              className="anime-input w-full text-xs"
            />
          </div>

          <div>
            <label className="block text-xs text-muted mb-1">Новый пароль DM (от 6 символов)</label>
            <input
              type="password"
              required
              minLength={6}
              value={dmNewPassword}
              onChange={(e) => setDmNewPassword(e.target.value)}
              placeholder="Новый секретный пароль..."
              className="anime-input w-full text-xs"
            />
          </div>

          <button
            type="submit"
            disabled={savingDmPassword || !dmCurrentPassword || dmNewPassword.trim().length < 6}
            className="anime-btn-primary py-2.5 px-4 text-xs inline-flex items-center justify-center gap-1.5"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>{savingDmPassword ? 'Обновление...' : 'Сменить пароль DM'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
