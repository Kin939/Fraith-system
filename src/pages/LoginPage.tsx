import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { resolvePublicAssetUrl } from '../lib/cdnAssets';

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
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="glass-panel hud-cut max-w-sm w-full p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 border border-border bg-deep p-1 shrink-0">
            <img
              src={resolvePublicAssetUrl('/apple-touch-icon.png')}
              onError={(e) => {
                if (!e.currentTarget.src.endsWith('/favicon.svg')) {
                  e.currentTarget.src = '/favicon.svg';
                }
              }}
              alt="Fraith"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="min-w-0">
            <h1 className="font-medium text-lg text-text leading-tight">Fraith</h1>
            <p className="text-xs text-secondary mt-0.5">
              Портал кампании D&amp;D 5e
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-secondary mb-1.5">
              Логин
            </label>
            <input
              type="text"
              required
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="player1 или dm"
              className="anime-input w-full h-10"
            />
          </div>

          <div>
            <label className="block text-xs text-secondary mb-1.5">
              Пароль
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Пароль"
                className="anime-input w-full h-10 pr-10"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted hover:text-text transition-colors"
                title={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" strokeWidth={1.5} />
                ) : (
                  <Eye className="w-4 h-4" strokeWidth={1.5} />
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-negative/10 border border-negative/30 text-xs text-negative">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !username.trim() || !password}
            className="anime-btn-primary w-full h-11 text-sm flex items-center justify-center"
          >
            <span>{loading ? 'Вход…' : 'Войти'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
