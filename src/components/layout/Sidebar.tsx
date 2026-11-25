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

  const navItems: Array<{ id: CampaignTabId; label: string; icon: React.ReactNode }> = [
    {
      id: 'character',
      label: isDm ? 'Персонажи' : 'Мой персонаж',
      icon: isDm ? <Users className="w-4 h-4" /> : <User className="w-4 h-4" />,
    },
    { id: 'quests', label: 'Квесты', icon: <ScrollText className="w-4 h-4" /> },
    { id: 'bestiary', label: 'Бестиарий', icon: <Skull className="w-4 h-4" /> },
    { id: 'spells', label: 'Заклинания', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'talents', label: 'Дерево талантов', icon: <Sparkles className="w-4 h-4" /> },
  ];

  if (isDm) {
    navItems.push({
      id: 'dm',
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
    <aside className="hidden lg:flex lg:w-72 lg:flex-col glass-panel border-r border-border min-h-screen sticky top-0 h-screen p-4 justify-between">
      <div className="space-y-5 overflow-y-auto pr-1">
        {/* Brand Header */}
        <div className="flex items-center justify-between px-2 pt-1">
          <div className="flex items-center gap-3">
            <img
              src="/apple-touch-icon.png"
              alt="FRAITH.SYS"
              className="w-10 h-10 rounded-2xl object-cover border border-primary/50 shadow-neon shrink-0"
            />
            <div>
              <div className="font-anime font-extrabold text-lg tracking-wide leading-tight">
                FRAITH<span className="text-primary">.SYS</span>
              </div>
              <div className="text-[11px] text-muted uppercase tracking-widest">
                D&amp;D 5e // Кампания
              </div>
            </div>
          </div>
          <span
            title={wsConnected ? 'Durable Object WebSocket активен' : 'Переподключение...'}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold border ${
              wsConnected
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                : 'border-amber-500/40 bg-amber-500/10 text-amber-300'
            }`}
          >
            {wsConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            LIVE
          </span>
        </div>

        {/* Shared Inspiration Quick Pill */}
        <div className="rounded-2xl p-3 bg-bg/70 border border-border flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted">
            <Sparkles className="w-4 h-4 text-accent" />
            <span>Общие вдохновения</span>
          </div>
          <span className="font-anime font-extrabold text-base text-accent">
            {inspirationPoints} ✦
          </span>
        </div>

        {/* Navigation */}
        <nav className="space-y-1.5">
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-sm font-medium transition-all ${
                  active
                    ? 'bg-primary/20 text-text neon-border font-semibold'
                    : 'text-muted hover:text-text hover:bg-white/5 border border-transparent'
                }`}
              >
                <span className={active ? 'text-primary' : 'text-muted'}>{item.icon}</span>
                <span>{item.label}</span>
                {item.id === 'dm' && (
                  <span className="ml-auto text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-accent/20 text-accent">
                    DM
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Online Party Presence */}
        <div className="pt-2 border-t border-border/70 space-y-2">
          <div className="text-[11px] uppercase tracking-wider text-muted px-1 flex items-center justify-between">
            <span>За столом сейчас</span>
            <span className="text-primary font-semibold">{onlineUsers.length}/4</span>
          </div>
          <div className="space-y-1.5">
            {onlineUsers.length === 0 ? (
              <div className="text-xs text-muted px-2 py-1">Синхронизация канала...</div>
            ) : (
              onlineUsers.map((m) => (
                <div
                  key={m.userId}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-bg/50 border border-border/60 text-xs"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                    <span className="truncate">{m.displayName}</span>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary shrink-0">
                    {m.role === 'dm' ? 'DM' : `P${m.playerId}`}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Live Dice Roll Feed + DM Clear Button */}
        <div className="pt-2 border-t border-border/70 space-y-2">
          <div className="px-1 flex items-center justify-between gap-2">
            <div className="text-[11px] uppercase tracking-wider text-muted flex items-center gap-1.5">
              <Dices className="w-3.5 h-3.5 text-primary" />
              <span>Лента бросков</span>
            </div>

            {isDm && rolls.length > 0 && (
              <button
                type="button"
                disabled={clearingRolls}
                onClick={() => void handleClearRolls()}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/35 text-rose-300 transition-colors"
                title="Очистить ленту бросков у всех за столом"
              >
                <Trash2 className="w-3 h-3" />
                <span>{clearingRolls ? '...' : 'Очистить'}</span>
              </button>
            )}
          </div>

          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {rolls.length === 0 ? (
              <div className="text-xs text-muted px-2.5 py-2 rounded-xl bg-bg/40 border border-border/50">
                Лента пуста. Броски из чарников появятся здесь в реальном времени.
              </div>
            ) : (
              rolls.slice(0, 8).map((r, idx) => (
                <div
                  key={`${r.id ?? idx}-${r.createdAt}`}
                  className="px-2.5 py-1.5 rounded-xl bg-bg/60 border border-border/60 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-text truncate">{r.characterName}</span>
                    <span
                      className={`font-anime font-extrabold px-1.5 py-0.5 rounded text-xs ${
                        r.isCrit
                          ? r.critKind === 'failure'
                            ? 'bg-rose-500/20 text-rose-300'
                            : 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-primary/20 text-primary'
                      }`}
                    >
                      {r.total}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted truncate">
                    {r.title} • {r.breakdown || r.formula}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Current Account Footer */}
      <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate">{user.displayName}</div>
          <div className="text-xs text-muted">
            {isDm ? 'Мастер кампании (DM)' : `Игрок #${user.playerId} (${user.username})`}
          </div>
        </div>
        <button
          onClick={onLogout}
          className="p-2 rounded-xl border border-border text-muted hover:text-rose-300 hover:border-rose-500/40 transition-colors shrink-0"
          title="Выйти из аккаунта"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
};
