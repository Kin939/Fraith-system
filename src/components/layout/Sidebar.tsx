import React, { useState } from 'react';
import {
  BookOpen,
  Crown,
  LogOut,
  ScrollText,
  Skull,
  Sparkles,
  Trash2,
  User,
  Users,
} from 'lucide-react';
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

  const navItems: Array<{ id: CampaignTabId; label: string; icon: React.ReactNode }> = [
    {
      id: 'character',
      label: isDm ? 'Персонажи' : 'Мой персонаж',
      icon: isDm ? (
        <Users className="w-4 h-4" strokeWidth={1.5} />
      ) : (
        <User className="w-4 h-4" strokeWidth={1.5} />
      ),
    },
    { id: 'quests', label: 'Квесты', icon: <ScrollText className="w-4 h-4" strokeWidth={1.5} /> },
    { id: 'bestiary', label: 'Бестиарий', icon: <Skull className="w-4 h-4" strokeWidth={1.5} /> },
    { id: 'spells', label: 'Заклинания', icon: <BookOpen className="w-4 h-4" strokeWidth={1.5} /> },
    { id: 'talents', label: 'Дерево талантов', icon: <Sparkles className="w-4 h-4" strokeWidth={1.5} /> },
  ];

  if (isDm) {
    navItems.push({
      id: 'dm',
      label: 'Мастер',
      icon: <Crown className="w-4 h-4" strokeWidth={1.5} />,
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
        message: 'История кубиков очищена у всех участников за столом',
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
    <aside className="hidden lg:flex lg:w-64 lg:flex-col bg-deep border-r border-border min-h-screen sticky top-0 h-screen p-4 justify-between shrink-0">
      <div className="overflow-y-auto pr-1">
        {/* Brand Row */}
        <div className="flex items-center justify-between h-10 px-2">
          <div className="flex items-center gap-2.5">
            <img
              src={resolvePublicAssetUrl('/favicon-64.png')}
              onError={(e) => {
                if (!e.currentTarget.src.endsWith('/favicon.svg')) {
                  e.currentTarget.src = '/favicon.svg';
                }
              }}
              alt="Fraith"
              className="w-6 h-6 object-cover"
            />
            <span className="font-medium text-base text-text leading-none">
              Fraith
            </span>
          </div>

          <span
            title={wsConnected ? 'Соединение со столом активно' : 'Переподключение'}
            className="inline-flex items-center gap-1.5 text-xs text-muted"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                wsConnected ? 'bg-positive' : 'bg-warning'
              }`}
            />
            <span>{wsConnected ? 'В сети' : 'Связь…'}</span>
          </span>
        </div>

        {/* Shared Inspiration Row */}
        <div className="mt-4 h-9 px-2.5 bg-surface border border-border flex items-center justify-between">
          <span className="text-xs text-secondary">Вдохновение отряда</span>
          <span className="font-mono text-sm font-medium text-primary tabular-nums">
            {inspirationPoints}
          </span>
        </div>

        {/* Navigation Section (24px above, 8px below, 36px rows, 4px gap) */}
        <div className="mt-6 mb-2 px-2 text-xs text-muted">Навигация</div>
        <nav className="space-y-1" aria-label="Основная навигация">
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`group w-full h-9 flex items-center gap-2.5 px-2.5 text-sm transition-colors border-l-2 ${
                  active
                    ? 'bg-raised text-text font-medium border-l-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                    : 'text-secondary hover:text-text hover:bg-surface border-l-transparent'
                }`}
              >
                <span
                  className={`w-4 h-4 flex items-center justify-center shrink-0 transition-colors ${
                    active ? 'text-primary' : 'text-muted group-hover:text-secondary'
                  }`}
                >
                  {item.icon}
                </span>
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Online Party Presence (24px above, 8px below) */}
        <div className="mt-6 mb-2 px-2 flex items-center justify-between text-xs text-muted">
          <span>За столом</span>
          <span className="font-mono tabular-nums">{onlineUsers.length} из 4</span>
        </div>
        <div className="space-y-1">
          {onlineUsers.length === 0 ? (
            <div className="px-2.5 py-1.5 text-xs text-muted">Никого нет в сети</div>
          ) : (
            onlineUsers.map((m) => (
              <div
                key={m.userId}
                className="h-8 flex items-center justify-between px-2.5 text-xs text-secondary"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-positive shrink-0" />
                  <span className="truncate text-text">{m.displayName}</span>
                </div>
                <span className="font-mono text-xs text-muted shrink-0 tabular-nums">
                  {m.role === 'dm' ? 'Мастер' : `Игрок ${m.playerId}`}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Live Dice Roll Feed */}
        <div className="mt-6 mb-2 px-2 flex items-center justify-between">
          <span className="text-xs text-muted">Броски</span>

          {isDm && rolls.length > 0 && (
            <button
              type="button"
              disabled={clearingRolls}
              onClick={() => void handleClearRolls()}
              className="inline-flex items-center gap-1 text-xs text-muted hover:text-negative transition-colors"
              title="Очистить историю бросков у всех за столом"
            >
              <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>{clearingRolls ? '…' : 'Очистить'}</span>
            </button>
          )}
        </div>

        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
          {rolls.length === 0 ? (
            <div className="px-2.5 py-2 text-xs text-muted">
              Пока нет бросков
            </div>
          ) : (
            rolls.slice(0, 8).map((r, idx) => (
              <div
                key={`${r.id ?? idx}-${r.createdAt}`}
                className="p-2.5 bg-surface border border-border text-xs space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-text truncate">{r.characterName}</span>
                  <span
                    className={`hud-keycap ${
                      r.isCrit
                        ? r.critKind === 'failure'
                          ? 'text-negative border-negative/30'
                          : 'text-positive border-positive/30'
                        : 'text-text'
                    }`}
                  >
                    {r.total}
                  </span>
                </div>
                <div className="font-mono text-xs text-muted truncate">
                  {r.title} · {r.breakdown || r.formula}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Current User Footer */}
      <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-medium text-text truncate">
            {user.displayName}
          </div>
          <div className="text-xs text-muted truncate">
            {isDm ? 'Мастер кампании' : `Игрок ${user.playerId} · ${user.username}`}
          </div>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="w-8 h-8 flex items-center justify-center border border-border bg-surface text-muted hover:text-text transition-colors shrink-0"
          title="Выйти из аккаунта"
        >
          <LogOut className="w-4 h-4" strokeWidth={1.5} />
        </button>
      </div>
    </aside>
  );
};
