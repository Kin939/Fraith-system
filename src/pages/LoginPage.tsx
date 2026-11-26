import React, { useState } from 'react';
import { Eye, EyeOff, KeyRound } from 'lucide-react';
import { HudIcon } from '../components/common/HudIcon';
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
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="glass-panel neon-border hud-corners hud-cut max-w-md w-full p-7 space-y-6">
        {/* Top Telemetry Strip */}
        <div className="flex items-center justify-between border-b border-primary/30 pb-3">
          <span className="font-mono text-[10px] tracking-[0.22em] text-primary uppercase">
            AUTH // TERMINAL 01
          </span>
          <span className="font-mono text-[10px] text-muted">D&amp;D 5E // SYNC</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="w-16 h-16 border border-primary/60 bg-[#070B14] p-1 shadow-rim shrink-0 relative">
            <img
              src={resolvePublicAssetUrl('/apple-touch-icon.png')}
              onError={(e) => {
                if (!e.currentTarget.src.endsWith('/favicon.svg')) {
                  e.currentTarget.src = '/favicon.svg';
                }
              }}
              alt="FRAITH.SYSTEM"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="min-w-0">
            <h1 className="font-anime font-extrabold text-2xl tracking-wider uppercase">
              FRAITH<span className="text-primary">.SYSTEM</span>
            </h1>
            <p className="text-xs text-muted flex items-center gap-1.5 mt-1">
              <HudIcon asset="blades" size="xs" />
              <span>Тактический командный интерфейс кампании</span>
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-widest text-muted mb-1.5">
              // CALLSIGN (ЛОГИН)
            </label>
            <input
              type="text"
              required
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="player1 / dm..."
              className="anime-input w-full text-sm font-mono"
            />
          </div>

          <div>
            <label className="block font-mono text-[10px] uppercase tracking-widest text-muted mb-1.5">
              // ACCESS KEY (ПАРОЛЬ)
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="anime-input w-full text-sm font-mono pr-10"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted hover:text-primary transition-colors"
                title={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-rose-500/15 border border-rose-500/50 text-xs text-rose-200 font-mono">
              ERR // {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !username.trim() || !password}
            className="anime-btn-primary w-full py-3 text-sm flex items-center justify-center gap-2"
          >
            <KeyRound className="w-4 h-4" />
            <span>{loading ? 'АВТОРИЗАЦИЯ...' : 'ПОДКЛЮЧИТЬСЯ'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
