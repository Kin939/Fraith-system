import React, { useState } from 'react';
import { Crown, Flame, KeyRound, Shield, UserCheck } from 'lucide-react';

interface LoginPageProps {
  onLogin: (username: string, password: string) => Promise<boolean>;
  loading: boolean;
  error: string | null;
}

const DEMO_ACCOUNTS = [
  {
    username: 'dm',
    password: 'master123',
    label: 'Мастер (DM)',
    subtitle: 'Полный доступ + редактор тем',
    badge: 'DM',
  },
  {
    username: 'player1',
    password: 'player123',
    label: 'Аэлин (Игрок 1)',
    subtitle: 'Wizard 5 • Прорицание',
    badge: 'P1',
  },
  {
    username: 'player2',
    password: 'player123',
    label: 'Каэл (Игрок 2)',
    subtitle: 'Cleric 5 • Сумерки',
    badge: 'P2',
  },
  {
    username: 'player3',
    password: 'player123',
    label: 'Никс (Игрок 3)',
    subtitle: 'Warlock 5 • Архифея',
    badge: 'P3',
  },
];

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin, loading, error }) => {
  const [username, setUsername] = useState('dm');
  const [password, setPassword] = useState('master123');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onLogin(username, password);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="glass-panel neon-border rounded-3xl max-w-md w-full p-7 space-y-6">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-2xl anime-btn-primary flex items-center justify-center shadow-neon">
            <Flame className="w-7 h-7 text-white" />
          </div>
          <h1 className="font-anime font-extrabold text-2xl tracking-wide">
            FRAITH<span className="text-primary">.SYSTEM</span>
          </h1>
          <p className="text-xs text-muted">
            Портал D&amp;D-кампании на Cloudflare Pages, D1, R2 и Durable Objects
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-muted mb-1">Логин аккаунта</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="dm, player1, player2, player3"
              className="anime-input w-full text-sm"
            />
          </div>

          <div>
            <label className="block text-xs text-muted mb-1">Пароль</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="anime-input w-full text-sm"
            />
          </div>

          {error && (
            <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="anime-btn-primary w-full py-3 text-sm flex items-center justify-center gap-2"
          >
            <KeyRound className="w-4 h-4" />
            <span>{loading ? 'Вход в кампанию...' : 'Войти за стол'}</span>
          </button>
        </form>

        <div className="pt-3 border-t border-border space-y-2.5">
          <div className="text-[11px] uppercase tracking-wider text-muted flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-accent" />
            Seed-аккаунты кампании (быстрый выбор):
          </div>

          <div className="grid grid-cols-2 gap-2">
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.username}
                type="button"
                onClick={() => {
                  setUsername(acc.username);
                  setPassword(acc.password);
                  void onLogin(acc.username, acc.password);
                }}
                className="p-2.5 rounded-2xl bg-bg/60 border border-border hover:border-primary text-left transition-all"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-anime font-bold truncate">{acc.label}</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/20 text-primary">
                    {acc.badge === 'DM' ? <Crown className="w-3 h-3 inline" /> : acc.badge}
                  </span>
                </div>
                <div className="text-[10px] text-muted truncate mt-0.5">{acc.subtitle}</div>
              </button>
            ))}
          </div>

          <div className="text-[11px] text-muted/80 flex items-center gap-1.5 pt-1">
            <UserCheck className="w-3.5 h-3.5 text-primary shrink-0" />
            <span>Сессия защищена JWT в httpOnly cookie + поддержка Cloudflare Access.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
