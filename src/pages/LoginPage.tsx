import React, { useRef, useState } from 'react';
import { Crown, Eye, EyeOff, Flame, KeyRound, Lock, User } from 'lucide-react';

interface LoginPageProps {
  onLogin: (username: string, password: string) => Promise<boolean>;
  loading: boolean;
  error: string | null;
}

const ACCOUNT_SLOTS = [
  {
    username: 'dm',
    label: 'Мастер (DM)',
    subtitle: 'Защищённый вход Архитектора',
    badge: 'DM',
    isDm: true,
  },
  {
    username: 'player1',
    label: 'Игрок 1',
    subtitle: 'Слот героя #1',
    badge: 'P1',
    isDm: false,
  },
  {
    username: 'player2',
    label: 'Игрок 2',
    subtitle: 'Слот героя #2',
    badge: 'P2',
    isDm: false,
  },
  {
    username: 'player3',
    label: 'Игрок 3',
    subtitle: 'Слот героя #3',
    badge: 'P3',
    isDm: false,
  },
];

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin, loading, error }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const passwordInputRef = useRef<HTMLInputElement | null>(null);

  const handleSelectAccount = (targetUsername: string) => {
    setUsername(targetUsername);
    setPassword('');
    window.setTimeout(() => {
      passwordInputRef.current?.focus();
    }, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    await onLogin(username.trim(), password);
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
            Портал D&amp;D-кампании • Вход только по индивидуальному паролю
          </p>
        </div>

        {/* Account login selector (fills username only — password is ALWAYS required) */}
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-wider text-muted flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-accent" />
            Выберите аккаунт и введите пароль:
          </div>

          <div className="grid grid-cols-2 gap-2">
            {ACCOUNT_SLOTS.map((acc) => {
              const selected = username.trim().toLowerCase() === acc.username;
              return (
                <button
                  key={acc.username}
                  type="button"
                  onClick={() => handleSelectAccount(acc.username)}
                  className={`p-2.5 rounded-2xl border text-left transition-all group ${
                    selected
                      ? 'bg-primary/18 border-primary shadow-neon'
                      : 'bg-bg/70 hover:bg-primary/10 border-border hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold text-text group-hover:text-primary transition-colors">
                      {acc.label}
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-primary/20 text-primary inline-flex items-center gap-1">
                      {acc.isDm ? <Crown className="w-3 h-3" /> : <User className="w-3 h-3" />}
                      {acc.badge}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted truncate mt-0.5 font-mono">
                    {acc.username}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-muted mb-1">Логин аккаунта</label>
            <input
              type="text"
              required
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="dm, player1, player2 или player3"
              className="anime-input w-full text-sm"
            />
          </div>

          <div>
            <label className="block text-xs text-muted mb-1">Индивидуальный пароль</label>
            <div className="relative">
              <input
                ref={passwordInputRef}
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Введите пароль аккаунта..."
                className="anime-input w-full text-sm pr-10"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted hover:text-text transition-colors"
                title={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !username.trim() || !password}
            className="anime-btn-primary w-full py-3 text-sm flex items-center justify-center gap-2"
          >
            <KeyRound className="w-4 h-4" />
            <span>{loading ? 'Проверка пароля...' : 'Войти за стол'}</span>
          </button>
        </form>

        <div className="pt-2 border-t border-border text-[11px] text-muted text-center">
          Пароли слотов игроков выдаются Мастером кампании.
        </div>
      </div>
    </div>
  );
};
