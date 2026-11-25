import React, { useState } from 'react';
import { Eye, EyeOff, KeyRound } from 'lucide-react';

interface LoginPageProps {
  onLogin: (username: string, password: string) => Promise<boolean>;
  loading: boolean;
  error: string | null;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin, loading, error }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    await onLogin(username.trim(), password);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="glass-panel neon-border rounded-3xl max-w-md w-full p-7 space-y-6">
        <div className="text-center space-y-2">
          <img
            src="/apple-touch-icon.png"
            alt="FRAITH.SYSTEM"
            className="w-16 h-16 mx-auto rounded-2xl object-cover border border-primary/50 shadow-neon"
          />
          <h1 className="font-anime font-extrabold text-2xl tracking-wide">
            FRAITH<span className="text-primary">.SYSTEM</span>
          </h1>
          <p className="text-xs text-muted">Портал D&amp;D 5e кампании</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-muted mb-1">Логин</label>
            <input
              type="text"
              required
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Введите логин..."
              className="anime-input w-full text-sm"
            />
          </div>

          <div>
            <label className="block text-xs text-muted mb-1">Пароль</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Введите пароль..."
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
            <span>{loading ? 'Вход...' : 'Войти'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
