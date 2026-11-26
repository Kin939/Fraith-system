import React, { useState } from 'react';
import {
  BookOpen,
  Crown,
  Dices,
  LogOut,
  ScrollText,
  Skull,
  Sparkles,
  Trash2,
  User,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { HudIcon } from '../common/HudIcon';
import { resolvePublicAssetUrl } from '../../lib/cdnAssets';
import { apiFetch } from '../../lib/api';
import { CampaignTabId, useCampaignStore } from '../../lib/store';

interface SidebarProps {
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onLogout }) => {
  const user = useCampaignStore((s) => s.user);
  const activeTab = useCampaignStore((s) => s.activeTab);
  const setActiveTab = useCampaignStore((s) => s.setActiveTab);
  const wsConnected = useCampaignStore((s) => s.wsConnected);
  const onlineUsers = useCampaignStore((s) => s.onlineUsers);
  const inspirationPoints = useCampaignStore((s) => s.inspirationPoints);
  const rolls = useCampaignStore((s) => s.rolls);
  const setRolls = useCampaignStore((s) => s.setRolls);
  const pushToast = useCampaignStore((s) => s.pushToast);

  const [clearingRolls, setClearingRolls] = useState(false);

  if (!user) return null;

  const isDm = user.role === 'dm';

  const navItems: Array<{ id: CampaignTabId; index: string; label: string; icon: React.ReactNode }> = [
    {
      id: 'character',
      index: '01',
      label: isDm ? 'Персонажи' : 'Мой персонаж',
      icon: isDm ? <Users className="w-4 h-4" /> : <User className="w-4 h-4" />,
    },
    { id: 'quests', index: '02', label: 'Квесты', icon: <ScrollText className="w-4 h-4" /> },
    { id: 'bestiary', index: '03', label: 'Бестиарий', icon: <Skull className="w-4 h-4" /> },
    { id: 'spells', index: '04', label: 'Заклинания', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'talents', index: '05', label: 'Дерево талантов', icon: <Sparkles className="w-4 h-4" /> },
  ];

  if (isDm) {
    navItems.push({
      id: 'dm',
      index: '06',
      label: 'Мастер',
      icon: <Crown className="w-4 h-4" />,
    });
  }

  const handleClearRolls = async () => {
    if (!isDm || rolls.length === 0) return;
    setClearingRolls(true);
    try {
      await apiFetch('/api/dm/rolls', { method: 'DELETE' });
      setRolls([]);
      pushToast({
        title: 'Лента бросков очищена',
        message: 'История кубиков очищена у всех участников за столом.',
        variant: 'info',
      });
    } catch (err) {
      pushToast({
        title: 'Ошибка очистки ленты',
        message: err instanceof Error ? err.message : 'Попробуйте снова',
        variant: 'error',
      });
    } finally {
      setClearingRolls(false);
    }
  };

  return (
    <aside className="hidden lg:flex lg:w-72 lg:flex-col glass-panel hud-corners border-r border-primary/35 min-h-screen sticky top-0 h-screen p-4 justify-between shrink-0">
      <div className="space-y-5 overflow-y-auto pr-1">
        {/* Brand Tactical Header */}
        <div className="flex items-center justify-between px-1 pt-1 pb-3 border-b border-primary/25">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 border border-primary/60 bg-[#070B14] p-0.5 shadow-rim shrink-0">
              <img
                src={resolvePublicAssetUrl('/apple-touch-icon.png')}
                onError={(e) => {
                  if (!e.currentTarget.src.endsWith('/favicon.svg')) {
                    e.currentTarget.src = '/favicon.svg';
                  }
                }}
                alt="FRAITH.SYS"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <div className="font-anime font-extrabold text-lg tracking-wider leading-tight">
                FRAITH<span className="text-primary">.SYS</span>
              </div>
              <div className="font-mono text-[10px] text-muted uppercase tracking-[0.18em]">
                D&amp;D 5E // TACTICAL
              </div>
            </div>
          </div>
          <span
            title={wsConnected ? 'Durable Object WebSocket активен' : 'Переподключение...'}
            className={`inline-flex items-center gap-1 px-2 py-0.5 font-mono text-[10px] font-bold border ${
              wsConnected
                ? 'border-emerald-400/50 bg-emerald-500/10 text-emerald-300'
                : 'border-amber-400/50 bg-amber-500/10 text-amber-300'
            }`}
          >
            {wsConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            LIVE
          </span>
        </div>

        {/* Shared Inspiration HUD Readout */}
        <div className="p-3 bg-[#070B14]/85 border border-primary/35 hud-cut-sm flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted">
            <HudIcon asset="spark" size="sm" />
            <span className="uppercase tracking-wider text-[11px] font-semibold">
              Пул вдохновений
            </span>
          </div>
          <span className="font-mono font-extrabold text-base text-primary tabular-nums">
            {inspirationPoints}
          </span>
        </div>

        {/* Navigation with Neon Bottom Bar & Monochrome->Accent Icons */}
        <nav className="space-y-1.5" aria-label="Основная навигация">
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`group relative w-full flex items-center gap-3 px-3.5 py-2.5 text-xs uppercase tracking-wider transition-all duration-200 border ${
                  active
                    ? 'bg-primary/12 text-text border-primary/60 border-b-2 border-b-primary shadow-[0_10px_22px_-10px_var(--primary)] font-bold'
                    : 'bg-[#070B14]/45 text-muted hover:text-text border-transparent hover:border-primary/35'
                }`}
              >
                <span className="font-mono text-[10px] opacity-60">{item.index}</span>
                <span
                  className={`transition-colors duration-200 ${
                    active ? 'text-primary' : 'text-muted group-hover:text-text'
                  }`}
                >
                  {item.icon}
                </span>
                <span className="font-anime truncate">{item.label}</span>
                {item.id === 'dm' && (
                  <span className="ml-auto font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 border border-accent/60 bg-accent/15 text-text">
                    DM
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Online Party Presence */}
        <div className="pt-3 border-t border-primary/20 space-y-2">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted px-1 flex items-center justify-between">
            <span>// КАНАЛ ОТРЯДА</span>
            <span className="text-primary font-bold tabular-nums">{onlineUsers.length}/4</span>
          </div>
          <div className="space-y-1.5">
            {onlineUsers.length === 0 ? (
              <div className="text-xs text-muted px-2 py-1 font-mono">SCANNING...</div>
            ) : (
              onlineUsers.map((m) => (
                <div
                  key={m.userId}
                  className="flex items-center justify-between px-2.5 py-1.5 bg-[#070B14]/70 border border-primary/25 text-xs"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="w-1.5 h-1.5 bg-emerald-400 shadow-[0_0_8px_#34d399] shrink-0" />
                    <span className="truncate font-medium">{m.displayName}</span>
                  </div>
                  <span className="font-mono text-[10px] px-1.5 py-0.5 border border-primary/35 bg-primary/10 text-primary shrink-0">
                    {m.role === 'dm' ? 'DM' : `P${m.playerId}`}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Live Dice Roll Feed */}
        <div className="pt-3 border-t border-primary/20 space-y-2">
          <div className="px-1 flex items-center justify-between gap-2">
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted flex items-center gap-1.5">
              <Dices className="w-3.5 h-3.5 text-primary" />
              <span>// ЛЕНТА БРОСКОВ</span>
            </div>

            {isDm && rolls.length > 0 && (
              <button
                type="button"
                disabled={clearingRolls}
                onClick={() => void handleClearRolls()}
                className="inline-flex items-center gap-1 px-2 py-0.5 font-mono text-[10px] font-bold bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/45 text-rose-300 transition-colors"
                title="Очистить ленту бросков у всех за столом"
              >
                <Trash2 className="w-3 h-3" />
                <span>{clearingRolls ? '...' : 'CLR'}</span>
              </button>
            )}
          </div>

          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {rolls.length === 0 ? (
              <div className="text-xs text-muted px-2.5 py-2 bg-[#070B14]/55 border border-primary/20">
                Ожидание телеметрии бросков...
              </div>
            ) : (
              rolls.slice(0, 8).map((r, idx) => (
                <div
                  key={`${r.id ?? idx}-${r.createdAt}`}
                  className="px-2.5 py-1.5 bg-[#070B14]/75 border border-primary/25 border-l-2 border-l-primary text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-text truncate">{r.characterName}</span>
                    <span
                      className={`font-mono font-extrabold tabular-nums px-1.5 py-0.5 text-xs border ${
                        r.isCrit
                          ? r.critKind === 'failure'
                            ? 'bg-rose-500/20 border-rose-500/50 text-rose-300'
                            : 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                          : 'bg-primary/15 border-primary/45 text-primary'
                      }`}
                    >
                      {r.total}
                    </span>
                  </div>
                  <div className="font-mono text-[10px] text-muted truncate mt-0.5">
                    {r.title} // {r.breakdown || r.formula}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Current Operator Footer */}
      <div className="pt-3 border-t border-primary/30 flex items-center justify-between gap-2">
        <div className="min-w-0 flex items-center gap-2">
          <HudIcon asset={isDm ? 'crown' : 'blades'} size="sm" />
          <div className="min-w-0">
            <div className="text-xs font-bold uppercase tracking-wider truncate">
              {user.displayName}
            </div>
            <div className="font-mono text-[10px] text-muted">
              {isDm ? 'ROLE // MASTER (DM)' : `SLOT // P0${user.playerId} (${user.username})`}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="p-2 border border-primary/30 bg-[#070B14]/80 text-muted hover:text-rose-300 hover:border-rose-500/50 transition-colors shrink-0"
          title="Выйти из аккаунта"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
};
